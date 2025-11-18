import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Contar total de chunks indexados
    const { count: totalChunks } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    // Contar productos únicos indexados usando función SQL eficiente (DISTINCT)
    const uniqueProductIds = new Set<number>();
    
    try {
      // Intentar usar función RPC si existe (más eficiente)
      const { data: indexedProductIds, error: rpcError } = await supabase
        .rpc('get_indexed_product_ids');

      if (!rpcError && indexedProductIds) {
        indexedProductIds.forEach((item: any) => {
          if (item.product_id) {
            uniqueProductIds.add(item.product_id);
          }
        });
      } else {
        // Fallback: usar consulta con DISTINCT directamente
        const { data: uniqueProducts, error: distinctError } = await supabase
          .from('product_embeddings')
          .select('product_id')
          .limit(50000);

        if (!distinctError && uniqueProducts) {
          uniqueProducts.forEach((item: any) => {
            if (item.product_id) {
              uniqueProductIds.add(item.product_id);
            }
          });
        } else {
          console.error('[get-indexed-stats] Error fetching unique products:', distinctError || rpcError);
        }
      }
    } catch (error) {
      console.error('[get-indexed-stats] Exception fetching unique products:', error);
    }

    res.status(200).json({
      success: true,
      total: totalChunks || 0,
      uniqueProducts: uniqueProductIds.size,
    });
  } catch (error) {
    console.error('Error getting indexed stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


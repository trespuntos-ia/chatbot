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
        console.log(`[get-indexed-stats] Using RPC function: found ${uniqueProductIds.size} unique products`);
      } else {
        // Fallback: usar consulta con DISTINCT directamente usando paginación para obtener TODOS
        console.log('[get-indexed-stats] RPC function not available, using paginated DISTINCT query');
        let offset = 0;
        const pageSize = 10000;
        let hasMore = true;
        let totalFetched = 0;

        while (hasMore) {
          const { data: uniqueProducts, error: distinctError } = await supabase
            .from('product_embeddings')
            .select('product_id')
            .range(offset, offset + pageSize - 1);

          if (distinctError) {
            console.error('[get-indexed-stats] Error fetching unique products:', distinctError);
            break;
          }

          if (!uniqueProducts || uniqueProducts.length === 0) {
            hasMore = false;
            break;
          }

          uniqueProducts.forEach((item: any) => {
            if (item.product_id) {
              uniqueProductIds.add(item.product_id);
            }
          });

          totalFetched += uniqueProducts.length;
          offset += pageSize;
          
          // Si obtuvimos menos que pageSize, no hay más datos
          if (uniqueProducts.length < pageSize) {
            hasMore = false;
          }
        }
        
        console.log(`[get-indexed-stats] Paginated query: fetched ${totalFetched} chunks, found ${uniqueProductIds.size} unique products`);
      }
    } catch (error) {
      console.error('[get-indexed-stats] Exception fetching unique products:', error);
    }

    // Obtener total de productos en la base de datos para calcular progreso
    const { count: totalProductsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    const totalProducts = totalProductsCount || 0;
    const uniqueProducts = uniqueProductIds.size;
    const remaining = Math.max(0, totalProducts - uniqueProducts);

    res.status(200).json({
      success: true,
      total: totalChunks || 0,
      uniqueProducts,
      totalProducts,
      remaining,
      progress: totalProducts > 0 ? Math.round((uniqueProducts / totalProducts) * 100) : 0,
    });
  } catch (error) {
    console.error('Error getting indexed stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


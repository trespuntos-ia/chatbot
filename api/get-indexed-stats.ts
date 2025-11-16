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

    // Contar productos únicos indexados usando SQL directo (más eficiente)
    // Hacemos múltiples consultas paginadas para obtener todos los productos únicos
    const uniqueProductIds = new Set<number>();
    let offset = 0;
    const pageSize = 10000;
    let hasMore = true;

    while (hasMore) {
      const { data: uniqueProducts, error: fetchError } = await supabase
        .from('product_embeddings')
        .select('product_id')
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        console.error('[get-indexed-stats] Error fetching products:', fetchError);
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

      // Si obtuvimos menos productos que el tamaño de página, no hay más
      if (uniqueProducts.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      // Límite de seguridad para evitar loops infinitos
      if (offset > 100000) {
        console.warn('[get-indexed-stats] Reached safety limit, stopping');
        break;
      }
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


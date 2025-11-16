import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint para obtener el estado de la indexación automática
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Contar productos totales
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Contar productos indexados usando múltiples consultas paginadas para obtener todos
    const indexedProductIds = new Set<number>();
    let offset = 0;
    const pageSize = 10000;
    let hasMore = true;

    while (hasMore) {
      const { data: indexedProducts, error: fetchError } = await supabase
        .from('product_embeddings')
        .select('product_id')
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        console.error('[get-indexing-status] Error fetching products:', fetchError);
        break;
      }

      if (!indexedProducts || indexedProducts.length === 0) {
        hasMore = false;
        break;
      }

      indexedProducts.forEach((item: any) => {
        if (item.product_id) {
          indexedProductIds.add(item.product_id);
        }
      });

      // Si obtuvimos menos productos que el tamaño de página, no hay más
      if (indexedProducts.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      // Límite de seguridad para evitar loops infinitos
      if (offset > 100000) {
        console.warn('[get-indexing-status] Reached safety limit, stopping');
        break;
      }
    }

    const totalIndexed = indexedProductIds.size;
    const remaining = Math.max(0, (totalProducts || 0) - totalIndexed);
    const percentage = totalProducts && totalProducts > 0 
      ? Math.round((totalIndexed / totalProducts) * 100) 
      : 0;

    // Contar chunks totales
    const { count: totalChunks } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    return res.status(200).json({
      success: true,
      status: remaining === 0 ? 'completed' : 'in_progress',
      totalProducts: totalProducts || 0,
      totalIndexed,
      remaining,
      percentage,
      totalChunks: totalChunks || 0,
      message: remaining === 0
        ? '✅ Todos los productos están indexados'
        : `⏳ Indexación en progreso: ${totalIndexed}/${totalProducts} productos (${percentage}%)`,
      cronSchedule: 'Cada 5 minutos',
      nextRun: 'El cron job ejecutará automáticamente cada 5 minutos hasta completar',
    });
  } catch (error) {
    console.error('[get-indexing-status] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


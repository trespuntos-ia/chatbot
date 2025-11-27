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

    // Contar total de chunks indexados (siempre usar count exacto)
    const { count: totalChunks, error: chunksError } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    if (chunksError) {
      console.error('[get-indexed-stats] Error counting chunks:', chunksError);
    }
    
    console.log(`[get-indexed-stats] Total chunks: ${totalChunks || 0}`);

    // Contar productos únicos indexados - MÉTODO MEJORADO Y MÁS CONFIABLE
    // Usar el mismo método que index-products-rag-auto para consistencia
    const uniqueProductIds = new Set<number>();
    
    try {
      // Intentar usar función RPC si existe (más eficiente y consistente con index-products-rag-auto)
      const { data: indexedProductIds, error: rpcError } = await supabase
        .rpc('get_indexed_product_ids');

      if (!rpcError && indexedProductIds) {
        indexedProductIds.forEach((item: any) => {
          if (item.product_id) {
            uniqueProductIds.add(Number(item.product_id));
          }
        });
        console.log(`[get-indexed-stats] Found ${uniqueProductIds.size} unique products (via RPC)`);
      } else {
        // Fallback: usar paginación completa (mismo método que index-products-rag-auto)
        console.log('[get-indexed-stats] RPC function not available, using paginated query');
        let statsOffset = 0;
        const pageSize = 10000;
        let hasMore = true;
        let totalFetched = 0;
        const startTime = Date.now();

        while (hasMore) {
          const { data: chunks, error: fetchError } = await supabase
            .from('product_embeddings')
            .select('product_id')
            .range(statsOffset, statsOffset + pageSize - 1);

          if (fetchError) {
            console.error('[get-indexed-stats] Error fetching chunks:', fetchError);
            break;
          }

          if (!chunks || chunks.length === 0) {
            hasMore = false;
            break;
          }

          // Agregar todos los product_id al Set (automáticamente elimina duplicados)
          chunks.forEach((item: any) => {
            if (item.product_id !== null && item.product_id !== undefined) {
              uniqueProductIds.add(Number(item.product_id));
            }
          });

          totalFetched += chunks.length;
          statsOffset += pageSize;
          
          // Si obtuvimos menos que pageSize, no hay más datos
          if (chunks.length < pageSize) {
            hasMore = false;
          }
          
          // Límite de seguridad
          if (statsOffset > 200000) {
            console.warn('[get-indexed-stats] Reached safety limit');
            break;
          }
          
          // Log de progreso cada 10000 chunks
          if (totalFetched % 10000 === 0) {
            console.log(`[get-indexed-stats] Progress: fetched ${totalFetched} chunks, found ${uniqueProductIds.size} unique products so far...`);
          }
        }
        
        const elapsedTime = Date.now() - startTime;
        console.log(`[get-indexed-stats] ✅ Completed: fetched ${totalFetched} chunks, found ${uniqueProductIds.size} unique products in ${elapsedTime}ms`);
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
    const progress = totalProducts > 0 ? Math.round((uniqueProducts / totalProducts) * 100) : 0;

    // Log final para debugging
    console.log(`[get-indexed-stats] Final stats: chunks=${totalChunks || 0}, uniqueProducts=${uniqueProducts}, totalProducts=${totalProducts}, remaining=${remaining}, progress=${progress}%`);

    res.status(200).json({
      success: true,
      total: totalChunks || 0,
      uniqueProducts,
      totalProducts,
      remaining,
      progress,
      timestamp: new Date().toISOString(), // Agregar timestamp para verificar que se actualiza
    });
  } catch (error) {
    console.error('Error getting indexed stats:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


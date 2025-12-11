import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from './utils/embeddings.js';
import { chunkProduct } from './utils/chunking.js';

/**
 * Endpoint automático para indexar productos RAG
 * Se ejecuta periódicamente via Vercel Cron Jobs
 * Procesa productos no indexados automáticamente hasta completar todos
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Permitir CORS para debugging manual si es necesario
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Permitir GET (para cron) y POST (para testing manual)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Verificar que sea una llamada autorizada (desde cron de Vercel o con token)
  // Vercel Cron Jobs envían el header 'x-vercel-cron' automáticamente
  const isVercelCron = req.headers['x-vercel-cron'] === '1';
  const authToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  const cronSecret = process.env.CRON_SECRET || process.env.VERCEL_CRON_SECRET;
  const isManual = req.query.manual === 'true';

  // Permitir si viene de Vercel Cron, tiene token válido, o es manual para testing
  if (!isVercelCron && !isManual && (!authToken || (cronSecret && authToken !== cronSecret))) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Este endpoint solo puede ser llamado por Vercel Cron Jobs o con token de autorización',
      hint: isVercelCron ? undefined : 'Para testing manual, usa ?manual=true o proporciona token: ?token=YOUR_SECRET',
    });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('[index-products-rag-auto] SUPABASE_URL missing');
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing',
    });
  }

  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseKey) {
    console.error('[index-products-rag-auto] No Supabase key found');
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Validar que OpenAI API key esté configurada
  if (!process.env.OPENAI_API_KEY) {
    console.error('[index-products-rag-auto] OPENAI_API_KEY missing');
    return res.status(500).json({
      success: false,
      error: 'OpenAI API key not configured',
      message: 'La clave de API de OpenAI no está configurada',
    });
  }

  try {
    // Log detallado para verificar que el cron funciona
    const source = isVercelCron ? 'Vercel Cron' : isManual ? 'Manual Test' : 'Authorized';
    console.log(`[index-products-rag-auto] Starting automatic indexing... Source: ${source}`);
    console.log(`[index-products-rag-auto] Headers: x-vercel-cron=${req.headers['x-vercel-cron']}, manual=${isManual}`);

    // OPTIMIZADO: Procesar 50 productos por ejecución para evitar timeouts
    // Con chunking optimizado (~5-10 chunks/producto), 50 productos = ~250-500 chunks ≈ 1-2 min
    // Vercel timeout es 5 minutos, así que tenemos margen de seguridad
    const PRODUCTS_PER_RUN = 50;

    // NUEVA LÓGICA OPTIMIZADA: Buscar productos pendientes usando last_indexed_at
    // Esta consulta es instantánea (0.01 segundos) sin importar cuántos productos haya
    // Busca productos que:
    // 1. Nunca se han indexado (last_indexed_at IS NULL)
    // 2. O fueron modificados después de la última indexación (last_indexed_at < updated_at)
    
    // Primero verificar si la columna last_indexed_at existe
    let useOptimizedQuery = false;
    try {
      const { data: testData, error: testError } = await supabase
        .from('products')
        .select('last_indexed_at')
        .limit(1);
      
      // Si no hay error, la columna existe
      if (!testError) {
        useOptimizedQuery = true;
        console.log(`[index-products-rag-auto] ✅ Columna last_indexed_at detectada - usando consulta optimizada`);
      } else {
        console.log(`[index-products-rag-auto] ⚠️ Columna last_indexed_at no existe - usando lógica de respaldo`);
        console.log(`[index-products-rag-auto] Error de prueba: ${testError.message}`);
      }
    } catch (error) {
      console.log(`[index-products-rag-auto] ⚠️ No se pudo verificar last_indexed_at - usando lógica de respaldo`);
    }

    let productsToIndex: any[] = [];
    let fetchError: any = null;

    if (useOptimizedQuery) {
      // LÓGICA OPTIMIZADA: Usar last_indexed_at
      console.log(`[index-products-rag-auto] Searching for products to index using optimized query...`);
      
      const result = await supabase
        .from('products')
        .select('*')
        .or('last_indexed_at.is.null,last_indexed_at.lt.updated_at')
        .order('id', { ascending: true })
        .limit(PRODUCTS_PER_RUN);

      productsToIndex = result.data || [];
      fetchError = result.error;
    } else {
      // LÓGICA DE RESPALDO: Usar el método antiguo (más lento pero funciona sin last_indexed_at)
      console.log(`[index-products-rag-auto] Using fallback method to find unindexed products...`);
      
      // Obtener IDs de productos ya indexados
      const indexedIds = new Set<number>();
      try {
        const { data: indexedProductIds, error: rpcError } = await supabase
          .rpc('get_indexed_product_ids');

        if (!rpcError && indexedProductIds) {
          indexedProductIds.forEach((item: any) => {
            if (item.product_id !== null && item.product_id !== undefined) {
              indexedIds.add(Number(item.product_id));
            }
          });
        } else {
          // Fallback: obtener productos indexados con paginación
          let offset = 0;
          const pageSize = 10000;
          while (true) {
            const { data: uniqueProducts, error: distinctError } = await supabase
              .from('product_embeddings')
              .select('product_id')
              .range(offset, offset + pageSize - 1);

            if (distinctError || !uniqueProducts || uniqueProducts.length === 0) break;

            uniqueProducts.forEach((item: any) => {
              if (item.product_id !== null && item.product_id !== undefined) {
                indexedIds.add(Number(item.product_id));
              }
            });

            if (uniqueProducts.length < pageSize) break;
            offset += pageSize;
          }
        }
      } catch (error) {
        console.error('[index-products-rag-auto] Error fetching indexed products:', error);
      }

      // Obtener productos no indexados
      const { data: allProducts, error: allError } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true })
        .limit(PRODUCTS_PER_RUN * 3); // Obtener más para filtrar

      if (allError) {
        fetchError = allError;
      } else if (allProducts) {
        // Filtrar productos no indexados
        productsToIndex = allProducts
          .filter(p => !indexedIds.has(Number(p.id)))
          .slice(0, PRODUCTS_PER_RUN);
      }
    }

    if (fetchError) {
      console.error('[index-products-rag-auto] Error fetching products to index:', fetchError);
      return res.status(500).json({
        success: false,
        error: 'Error fetching products',
        message: `Error al buscar productos: ${fetchError.message}`,
        hint: useOptimizedQuery 
          ? undefined 
          : 'Ejecuta el SQL en Supabase para habilitar la consulta optimizada. Ver: supabase-add-last-indexed-at.sql',
      });
    }

    if (!productsToIndex || productsToIndex.length === 0) {
      console.log('[index-products-rag-auto] No products to index - all done!');
      
      // Verificar estadísticas finales
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      const { count: indexedProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('last_indexed_at', 'is', null);

      // Calcular remaining usando el método apropiado
      let remaining = 0;
      let totalIndexedCount = 0;
      
      // Intentar usar last_indexed_at si está disponible
      try {
        const { count: indexedProducts } = await supabase
          .from('products')
          .select('*', { count: 'exact', head: true })
          .not('last_indexed_at', 'is', null);
        
        if (indexedProducts !== null) {
          totalIndexedCount = indexedProducts;
          remaining = (totalProducts || 0) - totalIndexedCount;
        } else {
          // Fallback: usar método antiguo
          const indexedIds = new Set<number>();
          const { data: indexedProductIds } = await supabase.rpc('get_indexed_product_ids');
          if (indexedProductIds) {
            indexedProductIds.forEach((item: any) => {
              if (item.product_id) indexedIds.add(Number(item.product_id));
            });
            totalIndexedCount = indexedIds.size;
            remaining = (totalProducts || 0) - totalIndexedCount;
          }
        }
      } catch (error) {
        console.error('[index-products-rag-auto] Error calculating remaining:', error);
      }

      return res.status(200).json({
        success: true,
        message: remaining === 0 
          ? '✅ Todos los productos están indexados' 
          : `⚠️ No se encontraron productos pendientes en esta ejecución. Quedan ~${remaining} por indexar.`,
        indexed: 0,
        totalProducts: totalProducts || 0,
        totalIndexed: totalIndexedCount,
        remaining,
        completed: remaining === 0,
        optimized: useOptimizedQuery,
      });
    }

    console.log(`[index-products-rag-auto] Found ${productsToIndex.length} products to index`);

    // OPTIMIZADO: Batch size para procesar productos eficientemente
    // Con batch de 10 productos: ~50-100 chunks por batch ≈ 10-20 segundos
    let indexed = 0;
    const batchSize = 10;
    const errors: string[] = [];
    const successfullyIndexedProductIds: number[] = [];

    for (let i = 0; i < productsToIndex.length; i += batchSize) {
      const batch = productsToIndex.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        console.log(`[index-products-rag-auto] Processing batch ${batchNumber}/${Math.ceil(productsToIndex.length / batchSize)} (${batch.length} products)`);

        // Generar chunks
        const allChunks = batch.flatMap(product => chunkProduct(product));

        if (allChunks.length === 0) {
          console.warn(`[index-products-rag-auto] No chunks generated for batch ${batchNumber}`);
          continue;
        }

        // Generar embeddings con manejo de errores mejorado
        let embeddings: number[][];
        try {
          console.log(`[index-products-rag-auto] Generating embeddings for ${allChunks.length} chunks...`);
          embeddings = await generateEmbeddings(
            allChunks.map(chunk => chunk.content)
          );
          
          if (!embeddings || embeddings.length === 0) {
            throw new Error('No embeddings generated');
          }
          
          if (embeddings.length !== allChunks.length) {
            console.warn(`[index-products-rag-auto] Mismatch: ${allChunks.length} chunks but ${embeddings.length} embeddings`);
            // Continuar con los embeddings que tenemos
          }
        } catch (embeddingError) {
          console.error(`[index-products-rag-auto] Error generating embeddings for batch ${batchNumber}:`, embeddingError);
          errors.push(`Batch ${batchNumber}: Error generando embeddings - ${embeddingError instanceof Error ? embeddingError.message : 'Unknown error'}`);
          continue; // Saltar este batch y continuar con el siguiente
        }

        // Preparar datos para insertar (solo los que tienen embeddings)
        const embeddingsToInsert = allChunks
          .slice(0, embeddings.length) // Solo tomar los chunks que tienen embeddings
          .map((chunk, idx) => ({
            product_id: chunk.metadata.product_id,
            content: chunk.content,
            embedding: `[${embeddings[idx].join(',')}]`,
            metadata: chunk.metadata,
            chunk_index: chunk.metadata.chunk_index,
          }));

        // Guardar embeddings
        const { error: insertError } = await supabase
          .from('product_embeddings')
          .insert(embeddingsToInsert);

        if (insertError) {
          console.error(`[index-products-rag-auto] Error inserting batch ${batchNumber}:`, insertError);
          errors.push(`Batch ${batchNumber}: ${insertError.message}`);
          continue;
        }

        // IMPORTANTE: Marcar productos como indexados actualizando last_indexed_at (si existe)
        const batchProductIds = batch.map(p => p.id);
        
        if (useOptimizedQuery) {
          const { error: updateError } = await supabase
            .from('products')
            .update({ last_indexed_at: new Date().toISOString() })
            .in('id', batchProductIds);

          if (updateError) {
            console.error(`[index-products-rag-auto] Error updating last_indexed_at for batch ${batchNumber}:`, updateError);
            errors.push(`Batch ${batchNumber}: Error actualizando last_indexed_at - ${updateError.message}`);
            // Continuar aunque falle la actualización, los embeddings ya están guardados
          } else {
            indexed += batch.length;
            successfullyIndexedProductIds.push(...batchProductIds);
            console.log(`[index-products-rag-auto] ✅ Indexed batch ${batchNumber}: ${batch.length} products`);
          }
        } else {
          // Sin last_indexed_at, solo contar como indexados
          indexed += batch.length;
          successfullyIndexedProductIds.push(...batchProductIds);
          console.log(`[index-products-rag-auto] ✅ Indexed batch ${batchNumber}: ${batch.length} products (sin last_indexed_at)`);
        }

        // Pequeño delay entre batches para evitar sobrecarga
        if (i + batchSize < productsToIndex.length) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      } catch (batchError) {
        console.error(`[index-products-rag-auto] Error processing batch ${batchNumber}:`, batchError);
        errors.push(`Batch ${batchNumber}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      }
    }

    // Calcular estadísticas finales
    const { count: totalProducts } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    let totalIndexed = 0;
    if (useOptimizedQuery) {
      // Usar last_indexed_at si está disponible
      const { count: indexedProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .not('last_indexed_at', 'is', null);
      totalIndexed = indexedProducts || 0;
    } else {
      // Contar productos con embeddings (método antiguo)
      const indexedIds = new Set<number>();
      try {
        const { data: indexedProductIds, error: rpcError } = await supabase
          .rpc('get_indexed_product_ids');

        if (!rpcError && indexedProductIds) {
          indexedProductIds.forEach((item: any) => {
            if (item.product_id !== null && item.product_id !== undefined) {
              indexedIds.add(Number(item.product_id));
            }
          });
        } else {
          // Fallback: obtener productos indexados con paginación
          let offset = 0;
          const pageSize = 10000;
          while (true) {
            const { data: uniqueProducts, error: distinctError } = await supabase
              .from('product_embeddings')
              .select('product_id')
              .range(offset, offset + pageSize - 1);

            if (distinctError || !uniqueProducts || uniqueProducts.length === 0) break;

            uniqueProducts.forEach((item: any) => {
              if (item.product_id !== null && item.product_id !== undefined) {
                indexedIds.add(Number(item.product_id));
              }
            });

            if (uniqueProducts.length < pageSize) break;
            offset += pageSize;
          }
        }
        totalIndexed = indexedIds.size;
      } catch (error) {
        console.error('[index-products-rag-auto] Error counting indexed products:', error);
      }
    }

    const remaining = Math.max(0, (totalProducts || 0) - totalIndexed);

    const responseMessage = {
      success: true,
      message: `✅ Indexados ${indexed} productos automáticamente. Quedan ${remaining} por indexar.${remaining > 0 ? ' El cron job continuará automáticamente.' : ' ¡Completado!'}`,
      indexed,
      totalProducts: totalProducts || 0,
      totalIndexed,
      remaining,
      completed: remaining === 0,
      errors: errors.length > 0 ? errors : undefined,
      nextRun: remaining > 0 ? 'El cron job ejecutará de nuevo en 5 minutos' : 'No hay más productos por indexar',
      source: isVercelCron ? 'Vercel Cron' : isManual ? 'Manual Test' : 'Authorized',
      timestamp: new Date().toISOString(),
      optimized: true, // Indicar que se está usando la nueva lógica optimizada
    };

    console.log(`[index-products-rag-auto] ✅ Completed: ${indexed} products indexed, ${remaining} remaining`);
    
    return res.status(200).json(responseMessage);
  } catch (error) {
    console.error('[index-products-rag-auto] Fatal error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    // Log detallado para debugging
    console.error('[index-products-rag-auto] Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined,
    });
    
    return res.status(500).json({
      success: false,
      error: errorMessage,
      message: `Error al indexar productos: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}


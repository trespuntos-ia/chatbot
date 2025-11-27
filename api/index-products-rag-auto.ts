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

    // OPTIMIZADO: Aumentado para máxima cobertura y velocidad
    // Con chunking optimizado (~5-10 chunks/producto), 150 productos = ~750-1500 chunks ≈ 2-3 min
    // Vercel timeout es 5 minutos, así que tenemos margen de seguridad
    const PRODUCTS_PER_RUN = 150; // Aumentado de 50 a 150 para indexar más rápido

    // Obtener IDs de productos ya indexados usando función SQL eficiente (DISTINCT)
    // Esto es mucho más eficiente que obtener todos los chunks y filtrar
    const indexedIds = new Set<number>();
    
    try {
      // Intentar usar función RPC si existe (más eficiente)
      const { data: indexedProductIds, error: rpcError } = await supabase
        .rpc('get_indexed_product_ids');

      if (!rpcError && indexedProductIds) {
        indexedProductIds.forEach((item: any) => {
          if (item.product_id !== null && item.product_id !== undefined) {
            indexedIds.add(Number(item.product_id));
          }
        });
        console.log(`[index-products-rag-auto] Found ${indexedIds.size} already indexed products (via RPC)`);
      } else {
        // Fallback: usar consulta con DISTINCT directamente usando paginación
        console.log('[index-products-rag-auto] RPC function not available, using paginated DISTINCT query');
        let embeddingsOffset = 0;
        const pageSize = 10000;
        let hasMore = true;
        let totalFetched = 0;

        while (hasMore) {
          const { data: uniqueProducts, error: distinctError } = await supabase
            .from('product_embeddings')
            .select('product_id')
            .range(embeddingsOffset, embeddingsOffset + pageSize - 1);

          if (distinctError) {
            console.warn('[index-products-rag-auto] Error fetching indexed products:', distinctError);
            break;
          }

          if (!uniqueProducts || uniqueProducts.length === 0) {
            hasMore = false;
            break;
          }

          uniqueProducts.forEach((item: any) => {
            if (item.product_id !== null && item.product_id !== undefined) {
              indexedIds.add(Number(item.product_id));
            }
          });

          totalFetched += uniqueProducts.length;
          embeddingsOffset += pageSize;

          // Si obtuvimos menos que pageSize, no hay más datos
          if (uniqueProducts.length < pageSize) {
            hasMore = false;
          }

          // Límite de seguridad
          if (embeddingsOffset > 200000) {
            console.warn('[index-products-rag-auto] Reached safety limit while fetching indexed products');
            break;
          }
        }

        console.log(`[index-products-rag-auto] Found ${indexedIds.size} already indexed products (via paginated DISTINCT fallback, fetched ${totalFetched} chunks)`);
      }
    } catch (error) {
      console.error('[index-products-rag-auto] Exception fetching indexed products:', error);
      // Continuar con Set vacío
    }

    console.log(`[index-products-rag-auto] Total indexed products found: ${indexedIds.size}`);
    
    // DEBUG: Mostrar algunos IDs indexados para verificar
    const indexedIdsArray = Array.from(indexedIds).sort((a, b) => a - b);
    const sampleIndexedIds = indexedIdsArray.slice(0, 10);
    const minIndexedId = indexedIdsArray.length > 0 ? indexedIdsArray[0] : null;
    const maxIndexedId = indexedIdsArray.length > 0 ? indexedIdsArray[indexedIdsArray.length - 1] : null;
    console.log(`[index-products-rag-auto] Sample indexed IDs (first 10):`, sampleIndexedIds);
    console.log(`[index-products-rag-auto] Indexed IDs range: ${minIndexedId} - ${maxIndexedId}`);

    // Obtener el total de productos primero
    const { count: totalProductsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    console.log(`[index-products-rag-auto] Total products in database: ${totalProductsCount || 0}`);

    // ESTRATEGIA SIMPLIFICADA: Obtener productos secuencialmente desde el principio
    // y filtrar los que NO están indexados. Si llegamos al final sin encontrar suficientes,
    // empezar de nuevo desde el principio (puede haber productos nuevos o cambios)
    const fetchLimit = 500; // Batch grande para eficiencia
    let productsToIndex: any[] = [];
    let offset = 0;
    let attempts = 0;
    const maxAttempts = Math.ceil((totalProductsCount || 1608) / fetchLimit) * 2; // Revisar toda la BD 2 veces máximo
    let totalProductsChecked = 0;
    let hasLooped = false; // Para saber si ya revisamos toda la BD una vez

    console.log(`[index-products-rag-auto] Starting search for unindexed products. Need ${PRODUCTS_PER_RUN} products. Total products: ${totalProductsCount || 0}, max attempts: ${maxAttempts}`);

    while (productsToIndex.length < PRODUCTS_PER_RUN && attempts < maxAttempts) {
      // Si llegamos al final de la BD, volver al principio
      if (offset >= (totalProductsCount || 1608)) {
        if (hasLooped) {
          console.log(`[index-products-rag-auto] Already looped once, stopping search`);
          break;
        }
        console.log(`[index-products-rag-auto] Reached end of products, looping back to start`);
        offset = 0;
        hasLooped = true;
        attempts++;
        continue;
      }

      const { data: batchData, error: fetchError } = await supabase
        .from('products')
        .select('*')
        .order('id', { ascending: true })
        .range(offset, offset + fetchLimit - 1);

      if (fetchError) {
        console.error('[index-products-rag-auto] Error fetching products:', fetchError);
        offset += fetchLimit;
        attempts++;
        continue;
      }

      if (!batchData || batchData.length === 0) {
        // Si no hay más datos, volver al principio si no hemos looped
        if (!hasLooped) {
          console.log(`[index-products-rag-auto] No more products at offset ${offset}, looping back`);
          offset = 0;
          hasLooped = true;
        } else {
          console.log(`[index-products-rag-auto] No more products and already looped, stopping`);
          break;
        }
        attempts++;
        continue;
      }

      totalProductsChecked += batchData.length;
      
      // DEBUG: Mostrar algunos IDs del batch para comparar
      const batchIds = batchData.map(p => Number(p.id)).sort((a, b) => a - b);
      const sampleBatchIds = batchIds.slice(0, 10);
      const minBatchId = batchIds.length > 0 ? batchIds[0] : null;
      const maxBatchId = batchIds.length > 0 ? batchIds[batchIds.length - 1] : null;
      console.log(`[index-products-rag-auto] Batch at offset ${offset}: ${batchData.length} products, sample IDs:`, sampleBatchIds);
      console.log(`[index-products-rag-auto] Batch IDs range: ${minBatchId} - ${maxBatchId}`);
      
      // DEBUG: Verificar si alguno de los sample IDs está en indexedIds
      const sampleCheckResults = sampleBatchIds.map(id => ({
        id,
        idType: typeof id,
        isIndexed: indexedIds.has(id),
        indexedIdsHasType: typeof Array.from(indexedIds)[0]
      }));
      console.log(`[index-products-rag-auto] Sample ID check results:`, JSON.stringify(sampleCheckResults, null, 2));
      
      // DEBUG: Mostrar algunos IDs del Set indexedIds para comparar tipos
      const sampleIndexedFromSet = Array.from(indexedIds).slice(0, 10);
      console.log(`[index-products-rag-auto] Sample IDs from indexedIds Set (first 10):`, sampleIndexedFromSet);
      
      // Filtrar solo los que no están indexados
      const unindexedInBatch = batchData.filter(p => {
        const productId = Number(p.id);
        const isIndexed = indexedIds.has(productId);
        return !isIndexed;
      });
      
      const indexedInBatch = batchData.length - unindexedInBatch.length;
      const unindexedPercent = batchData.length > 0 ? Math.round((unindexedInBatch.length / batchData.length) * 100) : 0;
      console.log(`[index-products-rag-auto] Batch ${offset}-${offset + batchData.length - 1}: ${unindexedInBatch.length} unindexed, ${indexedInBatch} indexed (${unindexedPercent}% unindexed)`);
      
      // DEBUG: Si encontramos productos no indexados, mostrar algunos IDs
      if (unindexedInBatch.length > 0) {
        const sampleUnindexedIds = unindexedInBatch.slice(0, 5).map(p => Number(p.id));
        console.log(`[index-products-rag-auto] ✅ Found ${unindexedInBatch.length} unindexed products! Sample IDs:`, sampleUnindexedIds);
      } else if (batchData.length > 0) {
        // Si no encontramos productos no indexados, mostrar algunos IDs del batch para debug
        console.log(`[index-products-rag-auto] ⚠️ No unindexed products in this batch. All ${batchData.length} products are already indexed.`);
      }
      
      // Agregar productos no indexados encontrados
      const remaining = PRODUCTS_PER_RUN - productsToIndex.length;
      productsToIndex.push(...unindexedInBatch.slice(0, remaining));

      // Si encontramos suficientes, salir
      if (productsToIndex.length >= PRODUCTS_PER_RUN) {
        console.log(`[index-products-rag-auto] ✅ Found enough products: ${productsToIndex.length}`);
        break;
      }

      // Avanzar al siguiente rango
      offset += fetchLimit;
      attempts++;
      
      // Log cada 10 intentos
      if (attempts % 10 === 0) {
        console.log(`[index-products-rag-auto] Progress: ${attempts} attempts, checked ${totalProductsChecked} products, found ${productsToIndex.length} unindexed so far`);
      }
    }
    
    console.log(`[index-products-rag-auto] Final search result: checked ${totalProductsChecked} products across ${attempts} attempts, found ${productsToIndex.length} products to index`);

    if (productsToIndex.length === 0) {
      console.log('[index-products-rag-auto] No products to index - all done!');
      
      // Verificar si realmente están todos indexados
      const { count: totalProducts } = await supabase
        .from('products')
        .select('*', { count: 'exact', head: true });

      const totalIndexed = indexedIds.size;
      const remaining = (totalProducts || 0) - totalIndexed;

      return res.status(200).json({
        success: true,
        message: remaining === 0 
          ? '✅ Todos los productos están indexados' 
          : `⚠️ No se encontraron productos no indexados en esta ejecución. Quedan ~${remaining} por indexar.`,
        indexed: 0,
        totalProducts: totalProducts || 0,
        totalIndexed,
        remaining,
        completed: remaining === 0,
      });
    }

    console.log(`[index-products-rag-auto] Found ${productsToIndex.length} products to index`);

    // OPTIMIZADO: Batch size aumentado para procesar más productos eficientemente
    // Con batch de 15 productos: ~75-150 chunks por batch ≈ 15-30 segundos
    let indexed = 0;
    const batchSize = 15; // Aumentado de 5 a 15 para máxima eficiencia
    const errors: string[] = [];

    for (let i = 0; i < productsToIndex.length; i += batchSize) {
      const batch = productsToIndex.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        console.log(`[index-products-rag-auto] Processing batch ${batchNumber}/${Math.ceil(productsToIndex.length / batchSize)}`);

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

        // IMPORTANTE: Verificar que estos productos realmente NO están indexados antes de insertar
        // Esto previene re-indexación de productos que ya tienen chunks
        const batchProductIds = new Set(batch.map(p => p.id));
        const alreadyIndexedInBatch = new Set<number>();
        
        // Verificar rápidamente si alguno de estos productos ya tiene chunks
        const { data: existingChunks, error: checkError } = await supabase
          .from('product_embeddings')
          .select('product_id')
          .in('product_id', Array.from(batchProductIds))
          .limit(1000);
        
        if (!checkError && existingChunks) {
          existingChunks.forEach((item: any) => {
            if (item.product_id) {
              alreadyIndexedInBatch.add(item.product_id);
            }
          });
        }
        
        // Filtrar productos que ya están indexados
        const productsToActuallyIndex = batch.filter(p => !alreadyIndexedInBatch.has(p.id));
        // Filtrar chunks basándose en el product_id del chunk, no en el índice del batch
        const chunksToInsert = embeddingsToInsert.filter(chunk => !alreadyIndexedInBatch.has(chunk.product_id));
        
        if (productsToActuallyIndex.length === 0) {
          console.log(`[index-products-rag-auto] Batch ${batchNumber}: Todos los productos ya están indexados, saltando...`);
          continue;
        }
        
        if (chunksToInsert.length === 0) {
          console.log(`[index-products-rag-auto] Batch ${batchNumber}: No hay chunks nuevos para insertar, saltando...`);
          continue;
        }
        
        console.log(`[index-products-rag-auto] Batch ${batchNumber}: Insertando ${chunksToInsert.length} chunks para ${productsToActuallyIndex.length} productos nuevos (${alreadyIndexedInBatch.size} ya estaban indexados)`);
        
        // Guardar embeddings solo para productos que realmente no están indexados
        const { error: insertError } = await supabase
          .from('product_embeddings')
          .insert(chunksToInsert);

        if (insertError) {
          console.error(`[index-products-rag-auto] Error inserting batch ${batchNumber}:`, insertError);
          errors.push(`Batch ${batchNumber}: ${insertError.message}`);
          continue;
        }

        indexed += productsToActuallyIndex.length;
        console.log(`[index-products-rag-auto] ✅ Indexed batch ${batchNumber}: ${productsToActuallyIndex.length} products (${alreadyIndexedInBatch.size} ya estaban indexados)`);

        // Pequeño delay entre batches
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

    // Recontar productos indexados usando el MISMO método que get-indexed-stats para consistencia
    // Usar el mismo método exacto para evitar discrepancias
    const updatedIndexedIds = new Set<number>();
    
    try {
      // Intentar usar función RPC si existe (mismo método que get-indexed-stats)
      const { data: indexedProductIds, error: rpcError } = await supabase
        .rpc('get_indexed_product_ids');

      if (!rpcError && indexedProductIds) {
        indexedProductIds.forEach((item: any) => {
          if (item.product_id) {
            updatedIndexedIds.add(Number(item.product_id));
          }
        });
        console.log(`[index-products-rag-auto] Recounted ${updatedIndexedIds.size} unique products (via RPC)`);
      } else {
        // Fallback: usar paginación completa (mismo método que get-indexed-stats)
        console.log('[index-products-rag-auto] RPC not available, using paginated query for recount');
        let recountOffset = 0;
        const pageSize = 10000; // Mismo tamaño que get-indexed-stats
        let hasMore = true;
        let totalFetched = 0;

        while (hasMore) {
          const { data: updatedIndexedProducts, error: fetchError } = await supabase
            .from('product_embeddings')
            .select('product_id')
            .range(recountOffset, recountOffset + pageSize - 1);

          if (fetchError) {
            console.error('[index-products-rag-auto] Error recounting indexed products:', fetchError);
            break;
          }

          if (!updatedIndexedProducts || updatedIndexedProducts.length === 0) {
            hasMore = false;
            break;
          }

          updatedIndexedProducts.forEach((item: any) => {
            if (item.product_id !== null && item.product_id !== undefined) {
              updatedIndexedIds.add(Number(item.product_id));
            }
          });

          totalFetched += updatedIndexedProducts.length;
          
          if (updatedIndexedProducts.length < pageSize) {
            hasMore = false;
          } else {
            recountOffset += pageSize;
          }

          // Límite de seguridad
          if (recountOffset > 200000) {
            console.warn('[index-products-rag-auto] Reached safety limit while recounting');
            break;
          }
        }
        
        console.log(`[index-products-rag-auto] Recounted ${updatedIndexedIds.size} unique products (via pagination, fetched ${totalFetched} chunks)`);
      }
    } catch (error) {
      console.error('[index-products-rag-auto] Exception recounting indexed products:', error);
    }

    const totalIndexed = updatedIndexedIds.size;

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


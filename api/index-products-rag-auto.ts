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
          if (item.product_id) {
            indexedIds.add(item.product_id);
          }
        });
        console.log(`[index-products-rag-auto] Found ${indexedIds.size} already indexed products (via RPC)`);
      } else {
        // Fallback: usar consulta con DISTINCT directamente usando paginación
        console.log('[index-products-rag-auto] RPC function not available, using paginated DISTINCT query');
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
            console.warn('[index-products-rag-auto] Error fetching indexed products:', distinctError);
            break;
          }

          if (!uniqueProducts || uniqueProducts.length === 0) {
            hasMore = false;
            break;
          }

          uniqueProducts.forEach((item: any) => {
            if (item.product_id) {
              indexedIds.add(item.product_id);
            }
          });

          totalFetched += uniqueProducts.length;
          offset += pageSize;

          // Si obtuvimos menos que pageSize, no hay más datos
          if (uniqueProducts.length < pageSize) {
            hasMore = false;
          }

          // Límite de seguridad
          if (offset > 200000) {
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

    // Obtener productos NO indexados (obtener más para filtrar)
    const FETCH_MULTIPLIER = 4; // Obtener 4x más productos para filtrar
    const fetchLimit = PRODUCTS_PER_RUN * FETCH_MULTIPLIER;
    const { data: allProductsData, error: fetchError } = await supabase
      .from('products')
      .select('*')
      .limit(fetchLimit); // Obtener más para tener mejor probabilidad de encontrar productos no indexados

    if (fetchError) {
      throw fetchError;
    }

    // Filtrar solo los que no están indexados
    const unindexedProducts = (allProductsData || []).filter(p => !indexedIds.has(p.id));
    const productsToIndex = unindexedProducts.slice(0, PRODUCTS_PER_RUN);

    // Si no encontramos suficientes, intentar con offset
    if (productsToIndex.length < PRODUCTS_PER_RUN && allProductsData && allProductsData.length === fetchLimit) {
      let offset = fetchLimit;
      let attempts = 0;
      const maxAttempts = 5;

      while (productsToIndex.length < PRODUCTS_PER_RUN && attempts < maxAttempts) {
        const { data: moreData, error: moreError } = await supabase
          .from('products')
          .select('*')
          .range(offset, offset + fetchLimit - 1);

        if (moreError || !moreData || moreData.length === 0) break;

        const moreUnindexed = moreData.filter(p => !indexedIds.has(p.id));
        productsToIndex.push(...moreUnindexed.slice(0, PRODUCTS_PER_RUN - productsToIndex.length));

        offset += fetchLimit;
        attempts++;
      }
    }

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

        // Generar embeddings
        const embeddings = await generateEmbeddings(
          allChunks.map(chunk => chunk.content)
        );

        if (embeddings.length !== allChunks.length) {
          throw new Error(`Mismatch: ${allChunks.length} chunks but ${embeddings.length} embeddings`);
        }

        // Preparar datos para insertar
        const embeddingsToInsert = allChunks.map((chunk, idx) => ({
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

    // Recontar productos indexados usando paginación para obtener todos
    const updatedIndexedIds = new Set<number>();
    let offset = 0;
    let hasMore = true;
    const pageSize = 1000; // Tamaño de página para paginación

    while (hasMore) {
      const { data: updatedIndexedProducts, error: fetchError } = await supabase
        .from('product_embeddings')
        .select('product_id')
        .range(offset, offset + pageSize - 1);

      if (fetchError) {
        console.error('[index-products-rag-auto] Error recounting indexed products:', fetchError);
        break;
      }

      if (!updatedIndexedProducts || updatedIndexedProducts.length === 0) {
        hasMore = false;
        break;
      }

      updatedIndexedProducts.forEach((item: any) => {
        if (item.product_id) {
          updatedIndexedIds.add(item.product_id);
        }
      });

      if (updatedIndexedProducts.length < pageSize) {
        hasMore = false;
      } else {
        offset += pageSize;
      }

      // Límite de seguridad
      if (offset > 100000) {
        console.warn('[index-products-rag-auto] Reached safety limit while recounting');
        break;
      }
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
    console.error('[index-products-rag-auto] Error:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    });
  }
}


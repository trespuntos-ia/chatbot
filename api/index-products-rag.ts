import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from './utils/embeddings.js';
import { chunkProduct } from './utils/chunking.js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    console.error('[index-products-rag] SUPABASE_URL missing');
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing. Need SUPABASE_URL',
      details: 'Configura SUPABASE_URL en las variables de entorno de Vercel',
    });
  }

  // Usar service role key si está disponible, sino usar anon key
  const supabaseKey = supabaseServiceKey || supabaseAnonKey;
  if (!supabaseKey) {
    console.error('[index-products-rag] No Supabase key found (neither SERVICE_ROLE_KEY nor ANON_KEY)');
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing. Need SUPABASE_SERVICE_ROLE_KEY or SUPABASE_ANON_KEY',
      details: 'Configura SUPABASE_SERVICE_ROLE_KEY o SUPABASE_ANON_KEY en las variables de entorno de Vercel',
    });
  }

  console.log('[index-products-rag] Using Supabase key:', supabaseServiceKey ? 'SERVICE_ROLE_KEY' : 'ANON_KEY');
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { force = false, limit = null } = req.body || {};
    
    console.log('[index-products-rag] Starting indexing:', { force, limit });
    
    // Obtener productos con paginación si es necesario
    let allProducts: any[] = [];
    
    if (limit !== null && typeof limit === 'number') {
      // Límite específico
      console.log(`[index-products-rag] Fetching ${limit} products...`);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(limit);
      
      if (error) throw error;
      allProducts = data || [];
    } else if (!force) {
      // Límite por defecto si no es force
      // CONFIGURABLE: Aumentar si la conexión es estable (50 → 100, 150, etc.)
      // Con chunking optimizado (~5-10 chunks/producto), 100 productos = ~500-1000 chunks ≈ 1-2 min
      const DEFAULT_LIMIT = 100; // Aumentado de 50 a 100 para indexar más productos
      console.log(`[index-products-rag] Fetching ${DEFAULT_LIMIT} products (default limit)...`);
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(DEFAULT_LIMIT);
      
      if (error) throw error;
      allProducts = data || [];
    } else {
      // force=true: obtener productos NO indexados usando consulta SQL eficiente
      // CONFIGURABLE: Aumentar si la conexión es estable (50 → 100, 150, etc.)
      // Con chunking optimizado (~5-10 chunks/producto), 100 productos = ~500-1000 chunks ≈ 1-2 min
      // Vercel timeout es 5 minutos, así que tenemos margen de seguridad
      const MAX_PRODUCTS_PER_CALL = 100; // Aumentado de 50 a 100 para indexar más productos por llamada
      console.log(`[index-products-rag] Fetching unindexed products (max ${MAX_PRODUCTS_PER_CALL} per call)...`);
      
      // Usar RPC o consulta directa para obtener productos no indexados
      // Primero obtener IDs de productos ya indexados (con límite razonable)
      const { data: indexedProducts } = await supabase
        .from('product_embeddings')
        .select('product_id')
        .limit(50000); // Aumentar límite para tener más IDs
      
      const indexedIds = new Set(
        indexedProducts?.map(p => p.product_id) || []
      );
      
      console.log(`[index-products-rag] Found ${indexedIds.size} already indexed products`);
      
      // Obtener MÁS productos (200) y filtrar para asegurar que tenemos al menos MAX_PRODUCTS_PER_CALL no indexados
      const FETCH_MULTIPLIER = 4; // Obtener 4x más productos para filtrar
      const fetchLimit = MAX_PRODUCTS_PER_CALL * FETCH_MULTIPLIER;
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .limit(fetchLimit); // Obtener más para tener mejor probabilidad de encontrar productos no indexados
      
      if (error) throw error;
      
      // Filtrar solo los que no están indexados y tomar máximo MAX_PRODUCTS_PER_CALL
      const unindexedProducts = (data || []).filter(p => !indexedIds.has(p.id));
      allProducts = unindexedProducts.slice(0, MAX_PRODUCTS_PER_CALL); // Tomar máximo configurado
      
      console.log(`[index-products-rag] Found ${allProducts.length} unindexed products (out of ${data?.length || 0} fetched, ${unindexedProducts.length} unindexed)`);
      
      // Si no encontramos suficientes, intentar con offset
      if (allProducts.length < MAX_PRODUCTS_PER_CALL && data && data.length === fetchLimit) {
        console.log('[index-products-rag] Not enough unindexed products, trying with offset...');
        let offset = fetchLimit;
        let attempts = 0;
        const maxAttempts = 5; // Máximo 5 intentos adicionales
        
        while (allProducts.length < MAX_PRODUCTS_PER_CALL && attempts < maxAttempts) {
          const { data: moreData, error: moreError } = await supabase
            .from('products')
            .select('*')
            .range(offset, offset + fetchLimit - 1);
          
          if (moreError) break;
          if (!moreData || moreData.length === 0) break;
          
          const moreUnindexed = moreData.filter(p => !indexedIds.has(p.id));
          allProducts = [...allProducts, ...moreUnindexed].slice(0, MAX_PRODUCTS_PER_CALL);
          
          offset += fetchLimit;
          attempts++;
          
          console.log(`[index-products-rag] Attempt ${attempts}: Found ${moreUnindexed.length} more unindexed products, total: ${allProducts.length}`);
        }
      }
    }
    
    if (!allProducts || allProducts.length === 0) {
      console.log('[index-products-rag] No products found');
      return res.json({ 
        success: true, 
        message: 'No hay productos para indexar',
        indexed: 0,
        total: 0,
      });
    }

    // Si no es force, filtrar productos que ya tienen embeddings
    let products = allProducts;
    if (!force) {
      console.log('[index-products-rag] Checking for already indexed products...');
      const { data: indexedProducts, error: indexedError } = await supabase
        .from('product_embeddings')
        .select('product_id')
        .limit(5000); // Limitar para evitar timeout
      
      if (indexedError) {
        console.warn('[index-products-rag] Error checking indexed products:', indexedError);
        // Continuar con todos los productos si falla
      } else if (indexedProducts && indexedProducts.length > 0) {
        const indexedIds = new Set(indexedProducts.map(p => p.product_id));
        products = allProducts.filter(p => !indexedIds.has(p.id));
        console.log(`[index-products-rag] Filtered: ${allProducts.length} -> ${products.length} products to index`);
      }
    }

    if (products.length === 0) {
      console.log('[index-products-rag] No products to index after filtering');
      return res.json({ 
        success: true, 
        message: 'Todos los productos ya están indexados',
        indexed: 0,
        total: allProducts.length,
      });
    }

    console.log(`[index-products-rag] Found ${products.length} products to index`);

    let indexed = 0;
    // CONFIGURABLE: Aumentar batch size si la conexión es estable (5 → 10, 15, etc.)
    // Con batch de 10 productos: ~50-100 chunks por batch ≈ 10-20 segundos
    // Esto permite procesar más productos sin riesgo de timeout
    const batchSize = 10; // Aumentado de 5 a 10 para procesar más rápido
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;
      
      try {
        console.log(`[index-products-rag] Processing batch ${batchNumber}/${Math.ceil(products.length / batchSize)} (${batch.length} products)`);
        
        // Generar chunks para todos los productos del batch
        const allChunks = batch.flatMap(product => chunkProduct(product));
        
        if (allChunks.length === 0) {
          console.warn(`[index-products-rag] No chunks generated for batch ${batchNumber}`);
          continue;
        }
        
        console.log(`[index-products-rag] Generated ${allChunks.length} chunks for batch ${batchNumber}`);
        
        // Generar embeddings para todos los chunks
        console.log(`[index-products-rag] Generating embeddings for batch ${batchNumber}...`);
        const embeddings = await generateEmbeddings(
          allChunks.map(chunk => chunk.content)
        );
        
        if (embeddings.length !== allChunks.length) {
          throw new Error(`Mismatch: ${allChunks.length} chunks but ${embeddings.length} embeddings`);
        }
        
        console.log(`[index-products-rag] Generated ${embeddings.length} embeddings for batch ${batchNumber}`);
        
        // Preparar datos para insertar
        const embeddingsToInsert = allChunks.map((chunk, idx) => ({
          product_id: chunk.metadata.product_id,
          content: chunk.content,
          embedding: `[${embeddings[idx].join(',')}]`, // Formato para pgvector
          metadata: chunk.metadata,
          chunk_index: chunk.metadata.chunk_index,
        }));
        
        // Guardar embeddings en Supabase
        console.log(`[index-products-rag] Inserting ${embeddingsToInsert.length} embeddings to Supabase...`);
        const { error: insertError } = await supabase
          .from('product_embeddings')
          .insert(embeddingsToInsert);
        
        if (insertError) {
          console.error(`[index-products-rag] Error inserting batch ${batchNumber}:`, insertError);
          errors.push(`Batch ${batchNumber}: ${insertError.message}`);
          continue;
        }
        
        indexed += batch.length;
        console.log(`[index-products-rag] ✅ Successfully indexed batch ${batchNumber}: ${batch.length} products`);
        
        // Rate limiting: esperar un poco entre batches
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 500)); // Reducir delay
        }
      } catch (batchError) {
        console.error(`[index-products-rag] Error processing batch ${batchNumber}:`, batchError);
        errors.push(`Batch ${batchNumber}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      }
    }

    // Calcular cuántos productos quedan por indexar
    const { count: totalProductsCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });
    
    const { data: indexedProductsData } = await supabase
      .from('product_embeddings')
      .select('product_id')
      .limit(10000);
    
    const totalProducts = totalProductsCount || 0;
    const indexedProductIds = new Set(
      indexedProductsData?.map((p: any) => p.product_id) || []
    );
    const totalIndexed = indexedProductIds.size;
    const remaining = Math.max(0, totalProducts - totalIndexed);

    return res.json({
      success: true,
      message: `Indexados ${indexed} productos${remaining > 0 ? `. Quedan ${remaining} por indexar. Puedes ejecutar de nuevo para continuar.` : '. ¡Todos los productos están indexados!'}`,
      indexed,
      total: products.length,
      totalProducts,
      totalIndexed,
      remaining,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('[index-products-rag] Error indexing products:', {
      error,
      errorType: error?.constructor?.name,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' && error instanceof Error ? error.stack : undefined,
    });
  }
}


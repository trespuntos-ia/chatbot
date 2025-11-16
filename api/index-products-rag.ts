import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from './utils/embeddings';
import { chunkProduct } from './utils/chunking';

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

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({
      success: false,
      error: 'Supabase configuration missing. Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY',
    });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { force = false, limit = null } = req.body || {};
    
    // Obtener productos
    let query = supabase.from('products').select('*');
    
    if (!force) {
      // Solo productos que no tienen embeddings
      // Primero obtener IDs de productos que ya tienen embeddings
      const { data: indexedProducts } = await supabase
        .from('product_embeddings')
        .select('product_id');
      
      if (indexedProducts && indexedProducts.length > 0) {
        const indexedIds = indexedProducts.map(p => p.product_id);
        query = query.not('id', 'in', `(${indexedIds.join(',')})`);
      }
    }
    
    if (limit && typeof limit === 'number') {
      query = query.limit(limit);
    }
    
    const { data: products, error } = await query;
    
    if (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
    
    if (!products || products.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No hay productos para indexar',
        indexed: 0,
        total: 0,
      });
    }

    let indexed = 0;
    const batchSize = 10; // Procesar en lotes para evitar rate limits
    const errors: string[] = [];

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      try {
        // Generar chunks para todos los productos del batch
        const allChunks = batch.flatMap(product => chunkProduct(product));
        
        if (allChunks.length === 0) {
          console.warn(`No chunks generated for batch starting at index ${i}`);
          continue;
        }
        
        // Generar embeddings para todos los chunks
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
          embedding: `[${embeddings[idx].join(',')}]`, // Formato para pgvector
          metadata: chunk.metadata,
          chunk_index: chunk.metadata.chunk_index,
        }));
        
        // Guardar embeddings en Supabase
        const { error: insertError } = await supabase
          .from('product_embeddings')
          .insert(embeddingsToInsert);
        
        if (insertError) {
          console.error(`Error inserting batch at index ${i}:`, insertError);
          errors.push(`Batch ${i}: ${insertError.message}`);
          continue;
        }
        
        indexed += batch.length;
        console.log(`Indexed batch ${Math.floor(i / batchSize) + 1}: ${batch.length} products`);
        
        // Rate limiting: esperar un poco entre batches
        if (i + batchSize < products.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      } catch (batchError) {
        console.error(`Error processing batch at index ${i}:`, batchError);
        errors.push(`Batch ${i}: ${batchError instanceof Error ? batchError.message : 'Unknown error'}`);
      }
    }

    return res.json({
      success: true,
      message: `Indexados ${indexed} productos`,
      indexed,
      total: products.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.error('Error indexing products:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


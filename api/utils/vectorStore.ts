import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddings';

interface RetrievedChunk {
  id: number;
  product_id: number;
  content: string;
  similarity: number;
  metadata: any;
}

/**
 * Busca chunks similares usando búsqueda vectorial
 */
export async function retrieveRelevantChunks(
  query: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<RetrievedChunk[]> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase configuration missing');
    return [];
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // Generar embedding de la query
    const queryEmbedding = await generateEmbedding(query);
    
    // Buscar chunks similares usando la función SQL
    const { data, error } = await supabase.rpc('search_similar_chunks', {
      query_embedding: `[${queryEmbedding.join(',')}]`,
      match_threshold: threshold,
      match_count: limit,
    });

    if (error) {
      console.error('Error retrieving chunks:', error);
      return [];
    }

    if (!data || !Array.isArray(data)) {
      return [];
    }

    return data.map((item: any) => ({
      id: item.id,
      product_id: item.product_id,
      content: item.content,
      similarity: item.similarity,
      metadata: item.metadata || {},
    }));
  } catch (error) {
    console.error('Error in retrieveRelevantChunks:', error);
    return [];
  }
}


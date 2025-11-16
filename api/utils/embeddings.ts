import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-small'; // Cambiado a small para compatibilidad con HNSW en Supabase (máx 2000 dims)
const EMBEDDING_DIMENSIONS = 1536;

/**
 * Genera un embedding para un texto
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text.trim(),
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  return response.data[0].embedding;
}

/**
 * Genera embeddings para múltiples textos (más eficiente)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (!texts || texts.length === 0) {
    return [];
  }

  // Filtrar textos vacíos
  const validTexts = texts.filter(t => t && t.trim().length > 0);
  
  if (validTexts.length === 0) {
    return [];
  }

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: validTexts.map(t => t.trim()),
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  return response.data.map(item => item.embedding);
}


-- Función para buscar chunks similares usando búsqueda vectorial
-- Ejecutar este script en Supabase SQL Editor después de crear la tabla

CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  product_id bigint,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    product_embeddings.id,
    product_embeddings.product_id,
    product_embeddings.content,
    1 - (product_embeddings.embedding <=> query_embedding) as similarity,
    product_embeddings.metadata
  FROM product_embeddings
  WHERE 1 - (product_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY product_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Comentario
COMMENT ON FUNCTION search_similar_chunks IS 'Busca chunks de productos similares usando búsqueda por similitud de coseno en vectores';


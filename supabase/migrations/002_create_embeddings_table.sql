-- Tabla para almacenar embeddings de productos
-- Ejecutar este script en Supabase SQL Editor después de habilitar pgvector

CREATE TABLE IF NOT EXISTS product_embeddings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Texto original del chunk
  embedding vector(1536), -- Dimensión de text-embedding-3-small (compatible con HNSW en Supabase)
  metadata JSONB DEFAULT '{}', -- Metadatos adicionales
  chunk_index INTEGER DEFAULT 0, -- Índice del chunk si el producto tiene múltiples
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índice vectorial HNSW para búsqueda rápida
CREATE INDEX IF NOT EXISTS product_embeddings_embedding_idx 
ON product_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para búsqueda por product_id
CREATE INDEX IF NOT EXISTS product_embeddings_product_id_idx 
ON product_embeddings(product_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_embeddings_updated_at 
  BEFORE UPDATE ON product_embeddings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_embeddings_updated_at();

-- RLS Policies
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON product_embeddings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON product_embeddings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON product_embeddings
  FOR UPDATE USING (true);

-- Comentarios
COMMENT ON TABLE product_embeddings IS 'Embeddings vectoriales de productos para búsqueda semántica RAG';
COMMENT ON COLUMN product_embeddings.embedding IS 'Vector embedding de 1536 dimensiones generado con text-embedding-3-small';


-- Script para crear la tabla de videos de productos en Supabase

-- Eliminar políticas existentes si las hay (para hacerlo idempotente)
DROP POLICY IF EXISTS "Allow public read access" ON product_videos;
DROP POLICY IF EXISTS "Allow public insert access" ON product_videos;
DROP POLICY IF EXISTS "Allow public update access" ON product_videos;
DROP POLICY IF EXISTS "Allow public delete access" ON product_videos;

-- Crear tabla product_videos si no existe
CREATE TABLE IF NOT EXISTS product_videos (
  id BIGSERIAL PRIMARY KEY,
  youtube_url TEXT NOT NULL,
  title TEXT,
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  UNIQUE (youtube_url)
);

-- Índices
DROP INDEX IF EXISTS idx_product_videos_product_id;
DROP INDEX IF EXISTS idx_product_videos_created_at;

CREATE INDEX idx_product_videos_product_id ON product_videos(product_id);
CREATE INDEX idx_product_videos_created_at ON product_videos(created_at DESC);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_product_videos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para updated_at
DROP TRIGGER IF EXISTS trg_product_videos_updated_at ON product_videos;
CREATE TRIGGER trg_product_videos_updated_at
  BEFORE UPDATE ON product_videos
  FOR EACH ROW
  EXECUTE FUNCTION update_product_videos_updated_at();

-- Comentarios
COMMENT ON TABLE product_videos IS 'Videos de YouTube asociados a productos';
COMMENT ON COLUMN product_videos.youtube_url IS 'URL del video de YouTube';
COMMENT ON COLUMN product_videos.title IS 'Título descriptivo del video';
COMMENT ON COLUMN product_videos.product_id IS 'ID del producto asociado';

-- Activar RLS
ALTER TABLE product_videos ENABLE ROW LEVEL SECURITY;

-- Políticas básicas (ajusta según tus necesidades)
CREATE POLICY "Allow public read access" ON product_videos
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON product_videos
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON product_videos
  FOR UPDATE USING (true);

CREATE POLICY "Allow public delete access" ON product_videos
  FOR DELETE USING (true);


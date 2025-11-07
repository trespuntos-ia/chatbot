-- Tabla para almacenar contenido web indexado
-- Este contenido se actualiza cada noche y se usa para enriquecer las respuestas del bot
CREATE TABLE IF NOT EXISTS web_content_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL, -- Hash SHA256 para detectar cambios
  content_type TEXT DEFAULT 'product_page', -- product_page, documentation, article, etc.
  metadata JSONB, -- Información adicional (descripción, características, especificaciones, etc.)
  source TEXT, -- Origen del contenido (ej: "100x100chef.com", "manual_usuario.pdf")
  product_id BIGINT REFERENCES products(id) ON DELETE SET NULL, -- Relación opcional con producto
  last_scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  next_check_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() + INTERVAL '1 day', -- Próxima verificación
  scrape_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active', -- active, error, outdated
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_web_content_url ON web_content_index(url);
CREATE INDEX IF NOT EXISTS idx_web_content_hash ON web_content_index(content_hash);
CREATE INDEX IF NOT EXISTS idx_web_content_type ON web_content_index(content_type);
CREATE INDEX IF NOT EXISTS idx_web_content_product_id ON web_content_index(product_id);
CREATE INDEX IF NOT EXISTS idx_web_content_next_check ON web_content_index(next_check_at);
CREATE INDEX IF NOT EXISTS idx_web_content_status ON web_content_index(status);

-- Índice para búsqueda full-text en contenido
CREATE INDEX IF NOT EXISTS idx_web_content_content_fts ON web_content_index USING gin(to_tsvector('spanish', content));
CREATE INDEX IF NOT EXISTS idx_web_content_title_fts ON web_content_index USING gin(to_tsvector('spanish', title));

-- Índice para búsqueda en metadata JSONB
CREATE INDEX IF NOT EXISTS idx_web_content_metadata ON web_content_index USING gin(metadata);

-- Función para actualizar last_updated_at
CREATE OR REPLACE FUNCTION update_web_content_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar last_updated_at
CREATE TRIGGER update_web_content_updated_at 
  BEFORE UPDATE ON web_content_index 
  FOR EACH ROW 
  EXECUTE FUNCTION update_web_content_updated_at();

-- Tabla para configurar URLs a indexar
CREATE TABLE IF NOT EXISTS web_content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  content_type TEXT DEFAULT 'product_page',
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5, -- 1-10, mayor = más prioridad
  scrape_interval_days INTEGER DEFAULT 1, -- Cada cuántos días verificar
  last_scraped_at TIMESTAMP WITH TIME ZONE,
  next_scrape_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE, -- Si está relacionado con un producto
  metadata JSONB, -- Configuración adicional (selectors, regex, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para web_content_sources
CREATE INDEX IF NOT EXISTS idx_web_sources_url ON web_content_sources(url);
CREATE INDEX IF NOT EXISTS idx_web_sources_enabled ON web_content_sources(enabled);
CREATE INDEX IF NOT EXISTS idx_web_sources_next_scrape ON web_content_sources(next_scrape_at);
CREATE INDEX IF NOT EXISTS idx_web_sources_product_id ON web_content_sources(product_id);

-- Función para actualizar next_scrape_at después de scrape
CREATE OR REPLACE FUNCTION update_next_scrape_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.last_scraped_at IS NOT NULL THEN
        UPDATE web_content_sources 
        SET next_scrape_at = NEW.last_scraped_at + (scrape_interval_days || 1 || INTERVAL '1 day')
        WHERE url = NEW.url;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Comentarios
COMMENT ON TABLE web_content_index IS 'Contenido web indexado para uso del chatbot. Se actualiza periódicamente.';
COMMENT ON TABLE web_content_sources IS 'Configuración de URLs a indexar y actualizar periódicamente.';
COMMENT ON COLUMN web_content_index.content_hash IS 'Hash SHA256 del contenido para detectar cambios sin re-scrapear';
COMMENT ON COLUMN web_content_index.next_check_at IS 'Fecha/hora de la próxima verificación de cambios';
COMMENT ON COLUMN web_content_index.metadata IS 'Metadatos extraídos (descripción, características, especificaciones, colores, etc.)';







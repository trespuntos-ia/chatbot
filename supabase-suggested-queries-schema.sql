-- ============================================
-- SCHEMA PARA SUGERENCIAS DE BÚSQUEDA
-- ============================================
-- Ejecuta este script en SQL Editor de Supabase
-- Para gestionar las sugerencias de búsqueda del chat

-- ============================================
-- TABLA: suggested_queries
-- ============================================
CREATE TABLE IF NOT EXISTS suggested_queries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query_text TEXT NOT NULL,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_suggested_queries_active ON suggested_queries(is_active);
CREATE INDEX IF NOT EXISTS idx_suggested_queries_order ON suggested_queries(display_order);

-- ============================================
-- TRIGGER: Actualizar updated_at automáticamente
-- ============================================
DROP TRIGGER IF EXISTS update_suggested_queries_updated_at ON suggested_queries;
CREATE TRIGGER update_suggested_queries_updated_at 
  BEFORE UPDATE ON suggested_queries 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
ALTER TABLE suggested_queries ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Allow public read access to suggested_queries" ON suggested_queries
  FOR SELECT USING (true);

-- Política para permitir escritura pública (ajusta según necesites)
CREATE POLICY "Allow public write access to suggested_queries" ON suggested_queries
  FOR ALL USING (true);

-- ============================================
-- DATOS POR DEFECTO
-- ============================================
INSERT INTO suggested_queries (query_text, display_order, is_active)
VALUES 
  ('Busco un ahumador portátil para showcooking en sala', 1, true),
  ('¿Tenéis herramientas para trabajar con nitrógeno líquido?', 2, true),
  ('Necesito una máquina para destilaciones en frío', 3, true),
  ('¿Tenéis copas o vasos que funcionen con hielo seco?', 4, true),
  ('Producto para infusionar aceites en frío', 5, true)
ON CONFLICT DO NOTHING;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE suggested_queries IS 'Sugerencias de búsqueda que aparecen en el chat';
COMMENT ON COLUMN suggested_queries.query_text IS 'Texto de la sugerencia';
COMMENT ON COLUMN suggested_queries.display_order IS 'Orden de visualización (menor = primero)';
COMMENT ON COLUMN suggested_queries.is_active IS 'Si es true, la sugerencia se muestra en el chat';


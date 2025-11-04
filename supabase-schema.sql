-- Tabla para almacenar productos de PrestaShop
CREATE TABLE IF NOT EXISTS products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT,
  category TEXT,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  image_url TEXT,
  product_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índice para búsquedas rápidas por SKU
CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku);

-- Índice para búsquedas por nombre (full-text search)
CREATE INDEX IF NOT EXISTS idx_products_name ON products USING gin(to_tsvector('spanish', name));

-- Índice para búsquedas por descripción (full-text search)
CREATE INDEX IF NOT EXISTS idx_products_description ON products USING gin(to_tsvector('spanish', description));

-- Índice para búsquedas por categoría
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Comentarios en la tabla y columnas
COMMENT ON TABLE products IS 'Productos de PrestaShop almacenados para consulta por IA';
COMMENT ON COLUMN products.id IS 'ID único del producto';
COMMENT ON COLUMN products.name IS 'Nombre del producto';
COMMENT ON COLUMN products.price IS 'Precio del producto';
COMMENT ON COLUMN products.category IS 'Categoría del producto';
COMMENT ON COLUMN products.description IS 'Descripción del producto';
COMMENT ON COLUMN products.sku IS 'SKU único del producto (usado para upsert)';
COMMENT ON COLUMN products.image_url IS 'URL de la imagen del producto';
COMMENT ON COLUMN products.product_url IS 'URL del producto en PrestaShop';
COMMENT ON COLUMN products.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN products.updated_at IS 'Fecha de última actualización';

-- Política RLS (Row Level Security) - Permitir lectura y escritura pública
-- Ajusta estas políticas según tus necesidades de seguridad
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública (opcional, ajusta según necesites)
CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (true);

-- Política para permitir inserción pública (opcional, ajusta según necesites)
CREATE POLICY "Allow public insert access" ON products
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización pública (opcional, ajusta según necesites)
CREATE POLICY "Allow public update access" ON products
  FOR UPDATE USING (true);


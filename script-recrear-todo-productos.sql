-- ============================================
-- SCRIPT PARA RECREAR TABLA PRODUCTOS DESDE CERO
-- ============================================
-- Este script borra y recrea la tabla products con todas las columnas necesarias
-- Incluye: category, subcategory, all_categories

-- ADVERTENCIA: Esto borrará TODOS los productos

-- 1. Borrar tabla products si existe
DROP TABLE IF EXISTS products CASCADE;

-- 2. Crear tabla products con todas las columnas
CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT,
  category TEXT,
  subcategory TEXT,
  all_categories JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  image_url TEXT,
  product_url TEXT,
  date_add TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- 3. Crear índices
CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_subcategory ON products(subcategory);
CREATE INDEX idx_products_all_categories ON products USING gin(all_categories);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_products_description ON products USING gin(to_tsvector('spanish', description));

-- 4. Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5. Trigger para actualizar updated_at
CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- 6. Comentarios
COMMENT ON TABLE products IS 'Productos de PrestaShop almacenados para consulta por IA';
COMMENT ON COLUMN products.all_categories IS 'Todas las categorías del producto en formato JSON. Cada categoría incluye: category (nivel 1), subcategory (nivel 2), subsubcategory (nivel 3), y hierarchy (array completo)';

-- 7. Política RLS (Row Level Security)
ALTER TABLE products ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON products
  FOR UPDATE USING (true);

-- 8. Verificar que la tabla está vacía
SELECT COUNT(*) as productos_en_tabla FROM products;
-- Debe retornar 0



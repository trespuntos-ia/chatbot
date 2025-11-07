-- Script para agregar columna subcategory a la tabla products
-- Ejecuta esto en SQL Editor de Supabase

-- Agregar columna subcategory si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'subcategory'
    ) THEN
        ALTER TABLE products ADD COLUMN subcategory TEXT;
    END IF;
END $$;

-- Actualizar comentario
COMMENT ON COLUMN products.subcategory IS 'Subcategoría del producto (categoría específica dentro de la categoría principal)';

-- Crear índice para búsquedas por subcategoría
CREATE INDEX IF NOT EXISTS idx_products_subcategory ON products(subcategory);








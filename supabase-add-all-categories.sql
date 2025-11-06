-- Script para agregar columna all_categories a la tabla products
-- Esta columna almacenará todas las categorías del producto en formato JSON

-- Agregar columna all_categories si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'all_categories'
    ) THEN
        ALTER TABLE products ADD COLUMN all_categories JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Actualizar comentario
COMMENT ON COLUMN products.all_categories IS 'Todas las categorías del producto en formato JSON. Cada categoría incluye: category (nivel 1), subcategory (nivel 2), subsubcategory (nivel 3), y hierarchy (array completo)';

-- Crear índice GIN para búsquedas eficientes en JSONB
CREATE INDEX IF NOT EXISTS idx_products_all_categories ON products USING gin(all_categories);

-- Migrar datos existentes: si hay category, crear array con una categoría
UPDATE products 
SET all_categories = CASE 
    WHEN category IS NOT NULL AND category != '' 
    THEN jsonb_build_array(
        jsonb_build_object(
            'category', category,
            'subcategory', COALESCE(subcategory, null),
            'is_primary', true
        )
    )
    ELSE '[]'::jsonb
END
WHERE all_categories IS NULL OR all_categories = '[]'::jsonb;



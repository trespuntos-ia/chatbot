-- Script para actualizar el schema con fecha de creación de PrestaShop
-- Ejecuta esto en SQL Editor de Supabase

-- Agregar columna date_add si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'date_add'
    ) THEN
        ALTER TABLE products ADD COLUMN date_add TIMESTAMP WITH TIME ZONE;
    END IF;
END $$;

-- Actualizar comentario
COMMENT ON COLUMN products.date_add IS 'Fecha de creación del producto en PrestaShop';

-- Crear índice para ordenar por fecha
CREATE INDEX IF NOT EXISTS idx_products_date_add ON products(date_add DESC);

-- Script para limpiar todos los productos (ejecutar si es necesario)
-- TRUNCATE TABLE products RESTART IDENTITY CASCADE;


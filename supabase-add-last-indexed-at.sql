-- Script para añadir columna last_indexed_at a la tabla products
-- Esto permite rastrear cuándo se indexó cada producto para optimizar la búsqueda de pendientes

-- 1. Añadir columna para rastrear cuándo se indexó cada producto
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- 2. Crear un índice para que encontrar los "pendientes" sea instantáneo
CREATE INDEX IF NOT EXISTS idx_products_last_indexed_at ON products(last_indexed_at);

-- 3. Marcar los que ya sabemos que tienen embeddings como "ya indexados"
-- Esto evita re-procesar lo que ya está hecho
UPDATE products
SET last_indexed_at = NOW()
WHERE id IN (
    SELECT DISTINCT product_id 
    FROM product_embeddings
    WHERE product_id IS NOT NULL
);

-- 4. Comentario en la columna para documentación
COMMENT ON COLUMN products.last_indexed_at IS 'Fecha y hora de la última indexación RAG del producto. NULL si nunca se ha indexado.';


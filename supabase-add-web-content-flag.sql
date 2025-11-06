-- Añadir columna para indicar si el producto tiene contenido web indexado
-- Esto permite saber fácilmente qué productos tienen información adicional disponible

-- 1. Añadir columna has_web_content a la tabla products
ALTER TABLE products 
ADD COLUMN IF NOT EXISTS has_web_content BOOLEAN DEFAULT false;

-- 2. Crear índice para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_products_has_web_content ON products(has_web_content) WHERE has_web_content = true;

-- 3. Actualizar productos existentes que ya tienen contenido web indexado
UPDATE products p
SET has_web_content = true
WHERE EXISTS (
    SELECT 1 
    FROM web_content_index wci 
    WHERE wci.product_id = p.id 
    AND wci.status = 'active'
);

-- 4. Crear función para actualizar automáticamente el flag cuando se indexa contenido web
CREATE OR REPLACE FUNCTION update_product_web_content_flag()
RETURNS TRIGGER AS $$
BEGIN
    -- Si se inserta o actualiza contenido web con product_id
    IF NEW.product_id IS NOT NULL THEN
        UPDATE products 
        SET has_web_content = true 
        WHERE id = NEW.product_id;
    END IF;
    
    -- Si se elimina contenido web o se desactiva
    IF (TG_OP = 'DELETE' OR (TG_OP = 'UPDATE' AND NEW.status = 'inactive')) THEN
        IF OLD.product_id IS NOT NULL THEN
            -- Verificar si hay otro contenido web activo para este producto
            IF NOT EXISTS (
                SELECT 1 
                FROM web_content_index 
                WHERE product_id = OLD.product_id 
                AND status = 'active'
                AND id != COALESCE(NEW.id, OLD.id)
            ) THEN
                UPDATE products 
                SET has_web_content = false 
                WHERE id = OLD.product_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. Crear trigger que se ejecuta cuando se inserta/actualiza/elimina contenido web
DROP TRIGGER IF EXISTS trigger_update_product_web_content_flag ON web_content_index;

CREATE TRIGGER trigger_update_product_web_content_flag
    AFTER INSERT OR UPDATE OR DELETE ON web_content_index
    FOR EACH ROW
    EXECUTE FUNCTION update_product_web_content_flag();

-- 6. Comentario para documentar la columna
COMMENT ON COLUMN products.has_web_content IS 'Indica si el producto tiene contenido web indexado disponible (información adicional de la página web del producto)';

-- 7. Verificar resultados
SELECT 
    COUNT(*) as total_productos,
    COUNT(*) FILTER (WHERE has_web_content = true) as con_contenido_web,
    COUNT(*) FILTER (WHERE has_web_content = false OR has_web_content IS NULL) as sin_contenido_web
FROM products;



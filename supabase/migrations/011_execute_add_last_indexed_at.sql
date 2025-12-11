-- Función temporal para ejecutar el script de añadir last_indexed_at
-- Esta función ejecuta todos los comandos necesarios

CREATE OR REPLACE FUNCTION execute_add_last_indexed_at()
RETURNS jsonb AS $$
DECLARE
  result jsonb := '{}'::jsonb;
  products_updated integer;
BEGIN
  -- 1. Añadir columna si no existe
  BEGIN
    ALTER TABLE products ADD COLUMN last_indexed_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
    result := result || jsonb_build_object('column_added', true);
  EXCEPTION WHEN duplicate_column THEN
    result := result || jsonb_build_object('column_added', false, 'column_exists', true);
  END;

  -- 2. Crear índice si no existe
  BEGIN
    CREATE INDEX idx_products_last_indexed_at ON products(last_indexed_at);
    result := result || jsonb_build_object('index_created', true);
  EXCEPTION WHEN duplicate_table THEN
    result := result || jsonb_build_object('index_created', false, 'index_exists', true);
  END;

  -- 3. Marcar productos ya indexados
  UPDATE products
  SET last_indexed_at = NOW()
  WHERE id IN (
    SELECT DISTINCT product_id 
    FROM product_embeddings
    WHERE product_id IS NOT NULL
  );
  
  GET DIAGNOSTICS products_updated = ROW_COUNT;
  result := result || jsonb_build_object('products_updated', products_updated);

  -- 4. Añadir comentario
  COMMENT ON COLUMN products.last_indexed_at IS 'Fecha y hora de la última indexación RAG del producto. NULL si nunca se ha indexado.';
  result := result || jsonb_build_object('comment_added', true);

  RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION execute_add_last_indexed_at() IS 'Función temporal para ejecutar el script de añadir last_indexed_at. Se puede eliminar después de ejecutarse.';


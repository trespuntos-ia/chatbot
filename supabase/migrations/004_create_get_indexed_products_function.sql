-- Función para obtener productos únicos indexados de forma eficiente
CREATE OR REPLACE FUNCTION get_indexed_product_ids()
RETURNS TABLE (product_id bigint) AS $$
  SELECT DISTINCT product_id 
  FROM product_embeddings
  ORDER BY product_id;
$$ LANGUAGE sql STABLE;

COMMENT ON FUNCTION get_indexed_product_ids() IS 'Obtiene la lista de product_ids únicos que tienen embeddings indexados';


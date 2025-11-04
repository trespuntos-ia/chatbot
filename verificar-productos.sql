-- Query rápida para verificar productos guardados

-- Ver el total de productos
SELECT COUNT(*) as total_productos FROM products;

-- Ver los últimos 10 productos guardados
SELECT 
  id,
  name,
  price,
  category,
  sku,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;

-- Ver estadísticas
SELECT 
  COUNT(*) as total_productos,
  COUNT(DISTINCT category) as total_categorias,
  COUNT(DISTINCT sku) as productos_unicos,
  MIN(created_at) as primer_producto,
  MAX(updated_at) as ultima_actualizacion
FROM products;

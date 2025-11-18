-- Paso 1: Verificar si el producto existe en la tabla products
SELECT 
  id,
  name,
  description,
  category,
  subcategory,
  sku
FROM products
WHERE name ILIKE '%volcanic%terra%' 
   OR name ILIKE '%volcanic terra%'
   OR name ILIKE '%terra volcanic%'
ORDER BY name;

-- Paso 2: Si el producto existe, verificar si está indexado
-- (Ejecuta esto después del Paso 1, reemplazando PRODUCT_ID con el ID encontrado)
SELECT 
  pe.id,
  pe.product_id,
  pe.chunk_index,
  LEFT(pe.content, 200) as content_preview,
  p.name as product_name
FROM product_embeddings pe
JOIN products p ON pe.product_id = p.id
WHERE pe.product_id = PRODUCT_ID  -- Reemplaza PRODUCT_ID con el ID del producto
ORDER BY pe.chunk_index;

-- Paso 3: Ver todos los productos que contienen "volcanic" (para referencia)
SELECT 
  id,
  name,
  category,
  subcategory
FROM products
WHERE name ILIKE '%volcanic%'
ORDER BY name;

-- Paso 4: Contar cuántos productos están indexados en total
SELECT 
  COUNT(DISTINCT product_id) as total_indexed_products,
  COUNT(*) as total_chunks
FROM product_embeddings;


-- Script para encontrar el producto correcto y corregir el documento

-- 1. Buscar el producto "Conchadora Twin Stones V2" por SKU o nombre
SELECT 
    id,
    name,
    sku,
    product_url
FROM products
WHERE 
    sku ILIKE '%30/0053%' 
    OR sku ILIKE '%300053%'
    OR name ILIKE '%twin stones%'
    OR name ILIKE '%conchadora%'
ORDER BY 
    CASE 
        WHEN sku ILIKE '%30/0053%' THEN 1
        WHEN name ILIKE '%twin stones%' THEN 2
        ELSE 3
    END
LIMIT 10;

-- 2. Una vez que encuentres el ID correcto (por ejemplo, si es 230), ejecuta esto:
-- Reemplaza 19886 con el ID del documento que quieres corregir
-- Reemplaza 230 con el ID correcto del producto que encontraste arriba

-- UPDATE documents
-- SET product_id = 230  -- ID correcto del producto
-- WHERE id = 19886;     -- ID del documento a corregir

-- 3. Verificar que se actualizó correctamente:
-- SELECT 
--     d.id as document_id,
--     d.original_filename,
--     d.product_id,
--     p.name as product_name,
--     p.sku as product_sku
-- FROM documents d
-- LEFT JOIN products p ON d.product_id = p.id
-- WHERE d.id = 19886;


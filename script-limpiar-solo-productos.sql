-- ============================================
-- SCRIPT PARA LIMPIAR SOLO PRODUCTOS
-- ============================================
-- Este script borra SOLO los productos, manteniendo:
-- - Conversaciones del chat
-- - Analytics
-- - Prompts
-- - Conexiones
-- - Documentos
-- - Todo lo demás

-- ADVERTENCIA: Esto borrará TODOS los productos
-- Puedes volver a escanearlos desde PrestaShop

-- Borrar todos los productos
TRUNCATE TABLE products CASCADE;

-- Resetear secuencia de IDs
ALTER SEQUENCE products_id_seq RESTART WITH 1;

-- Verificar que se borraron (debe retornar 0)
SELECT COUNT(*) as productos_restantes FROM products;



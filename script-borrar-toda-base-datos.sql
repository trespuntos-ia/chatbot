-- ============================================
-- ⚠️ ADVERTENCIA: ESTE SCRIPT BORRA TODA LA BASE DE DATOS ⚠️
-- ============================================
-- Este script elimina TODAS las tablas y datos de Supabase
-- 
-- SE PERDERÁ:
-- ✅ Todos los productos
-- ✅ Todas las conversaciones del chat
-- ✅ Todo el historial de analytics
-- ✅ Todos los prompts configurados
-- ✅ Todas las conexiones guardadas
-- ✅ Todos los documentos subidos
-- ✅ Todo el contenido web indexado
-- ✅ Todo el historial de sincronizaciones
--
-- ⚠️ ESTO ES IRREVERSIBLE - NO SE PUEDE DESHACER ⚠️
--
-- Ejecuta este script SOLO si estás seguro de que quieres empezar desde cero

-- ============================================
-- PASO 1: Eliminar todas las políticas RLS primero
-- ============================================

-- Products
DROP POLICY IF EXISTS "Allow public read access" ON products;
DROP POLICY IF EXISTS "Allow public insert access" ON products;
DROP POLICY IF EXISTS "Allow public update access" ON products;
DROP POLICY IF EXISTS "Allow public delete access" ON products;

-- Chat conversations
DROP POLICY IF EXISTS "Allow public read access" ON chat_conversations;
DROP POLICY IF EXISTS "Allow public insert access" ON chat_conversations;

-- Chat analytics summaries
DROP POLICY IF EXISTS "Allow public read access" ON chat_analytics_summaries;
DROP POLICY IF EXISTS "Allow public insert access" ON chat_analytics_summaries;

-- System prompts
DROP POLICY IF EXISTS "Allow public read access" ON system_prompts;
DROP POLICY IF EXISTS "Allow public insert access" ON system_prompts;
DROP POLICY IF EXISTS "Allow public update access" ON system_prompts;
DROP POLICY IF EXISTS "Allow public delete access" ON system_prompts;

-- Prompt variables
DROP POLICY IF EXISTS "Allow public read access" ON prompt_variables;
DROP POLICY IF EXISTS "Allow public insert access" ON prompt_variables;
DROP POLICY IF EXISTS "Allow public update access" ON prompt_variables;
DROP POLICY IF EXISTS "Allow public delete access" ON prompt_variables;

-- Prestashop connections
DROP POLICY IF EXISTS "Allow public read access" ON prestashop_connections;
DROP POLICY IF EXISTS "Allow public insert access" ON prestashop_connections;
DROP POLICY IF EXISTS "Allow public update access" ON prestashop_connections;
DROP POLICY IF EXISTS "Allow public delete access" ON prestashop_connections;

-- Product sync history
DROP POLICY IF EXISTS "Allow public read access" ON product_sync_history;
DROP POLICY IF EXISTS "Allow public insert access" ON product_sync_history;
DROP POLICY IF EXISTS "Allow public update access" ON product_sync_history;

-- Documents
DROP POLICY IF EXISTS "Allow public read access" ON documents;
DROP POLICY IF EXISTS "Allow public insert access" ON documents;
DROP POLICY IF EXISTS "Allow public update access" ON documents;
DROP POLICY IF EXISTS "Allow public delete access" ON documents;

-- Web content
DROP POLICY IF EXISTS "Allow public read access" ON web_content_index;
DROP POLICY IF EXISTS "Allow public insert access" ON web_content_index;
DROP POLICY IF EXISTS "Allow public update access" ON web_content_index;
DROP POLICY IF EXISTS "Allow public delete access" ON web_content_index;

DROP POLICY IF EXISTS "Allow public read access" ON web_content_sources;
DROP POLICY IF EXISTS "Allow public insert access" ON web_content_sources;
DROP POLICY IF EXISTS "Allow public update access" ON web_content_sources;
DROP POLICY IF EXISTS "Allow public delete access" ON web_content_sources;

-- ============================================
-- PASO 2: Eliminar triggers
-- ============================================

DROP TRIGGER IF EXISTS update_products_updated_at ON products;
DROP TRIGGER IF EXISTS update_system_prompts_updated_at ON system_prompts;
DROP TRIGGER IF EXISTS update_prompt_variables_updated_at ON prompt_variables;
DROP TRIGGER IF EXISTS update_prestashop_connections_updated_at ON prestashop_connections;
DROP TRIGGER IF EXISTS update_product_sync_history_updated_at ON product_sync_history;
DROP TRIGGER IF EXISTS update_documents_updated_at ON documents;
DROP TRIGGER IF EXISTS update_web_content_index_updated_at ON web_content_index;
DROP TRIGGER IF EXISTS update_web_content_sources_updated_at ON web_content_sources;

-- ============================================
-- PASO 3: Eliminar funciones
-- ============================================

DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- ============================================
-- PASO 4: Eliminar todas las tablas (en orden correcto por dependencias)
-- ============================================

-- Tablas con foreign keys primero (hijas)
DROP TABLE IF EXISTS prompt_variables CASCADE;
DROP TABLE IF EXISTS product_sync_history CASCADE;
DROP TABLE IF EXISTS web_content_index CASCADE;

-- Tablas principales
DROP TABLE IF EXISTS products CASCADE;
DROP TABLE IF EXISTS chat_conversations CASCADE;
DROP TABLE IF EXISTS chat_analytics_summaries CASCADE;
DROP TABLE IF EXISTS system_prompts CASCADE;
DROP TABLE IF EXISTS prestashop_connections CASCADE;
DROP TABLE IF EXISTS documents CASCADE;
DROP TABLE IF EXISTS web_content_sources CASCADE;

-- ============================================
-- PASO 5: Verificar que se borraron todas las tablas
-- ============================================

SELECT 
    table_name 
FROM 
    information_schema.tables 
WHERE 
    table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name IN (
        'products',
        'chat_conversations',
        'chat_analytics_summaries',
        'system_prompts',
        'prompt_variables',
        'prestashop_connections',
        'product_sync_history',
        'documents',
        'web_content_index',
        'web_content_sources'
    );

-- Si retorna 0 filas, significa que todas las tablas se borraron correctamente

-- ============================================
-- NOTA: Después de ejecutar este script, necesitarás:
-- ============================================
-- 1. Ejecutar todos los scripts de creación de tablas en este orden:
--    - supabase-schema.sql (products)
--    - supabase-add-subcategory.sql (agregar subcategory)
--    - supabase-add-all-categories.sql (agregar all_categories)
--    - supabase-prompts-schema.sql (system_prompts, prompt_variables)
--    - supabase-chat-analytics-schema.sql (chat_conversations, chat_analytics_summaries)
--    - supabase-sync-history-schema.sql (prestashop_connections, product_sync_history)
--    - supabase-documents-schema.sql (documents)
--    - supabase-web-content-schema.sql (web_content_index, web_content_sources)
--
-- 2. Reconfigurar conexiones PrestaShop en el dashboard
-- 3. Reconfigurar prompts del sistema
-- 4. Volver a subir documentos si los necesitas
-- 5. Volver a indexar contenido web
-- 6. Escanear productos desde PrestaShop



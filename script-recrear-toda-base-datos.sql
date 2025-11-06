-- ============================================
-- SCRIPT PARA RECREAR TODA LA BASE DE DATOS DESDE CERO
-- ============================================
-- Ejecuta este script DESPUÉS de borrar todas las tablas
-- Este script recrea todas las tablas con la estructura actualizada
-- Incluye: all_categories, subcategory, y todas las mejoras

-- ============================================
-- 1. PRODUCTOS (con todas las columnas nuevas)
-- ============================================

CREATE TABLE products (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  price TEXT,
  category TEXT,
  subcategory TEXT,
  all_categories JSONB DEFAULT '[]'::jsonb,
  description TEXT,
  sku TEXT UNIQUE NOT NULL,
  image_url TEXT,
  product_url TEXT,
  date_add TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_category ON products(category);
CREATE INDEX idx_products_subcategory ON products(subcategory);
CREATE INDEX idx_products_all_categories ON products USING gin(all_categories);
CREATE INDEX idx_products_name ON products USING gin(to_tsvector('spanish', name));
CREATE INDEX idx_products_description ON products USING gin(to_tsvector('spanish', description));

COMMENT ON TABLE products IS 'Productos de PrestaShop almacenados para consulta por IA';
COMMENT ON COLUMN products.all_categories IS 'Todas las categorías del producto en formato JSON con jerarquía completa';

-- ============================================
-- 2. CONVERSACIONES DEL CHAT
-- ============================================

CREATE TABLE chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  function_called TEXT,
  products_consulted JSONB,
  category_consulted TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  model_used TEXT,
  response_time_ms INTEGER,
  tokens_used INTEGER
);

CREATE INDEX idx_chat_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX idx_chat_conversations_created_at ON chat_conversations(created_at DESC);
CREATE INDEX idx_chat_conversations_function_called ON chat_conversations(function_called);
CREATE INDEX idx_chat_conversations_category ON chat_conversations(category_consulted);
CREATE INDEX idx_chat_conversations_products ON chat_conversations USING gin(products_consulted);

-- ============================================
-- 3. RESUMENES DE ANALYTICS
-- ============================================

CREATE TABLE chat_analytics_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_range_start TIMESTAMP WITH TIME ZONE NOT NULL,
  date_range_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary_text TEXT NOT NULL,
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by TEXT DEFAULT 'manual',
  total_conversations INTEGER,
  unique_sessions INTEGER,
  top_products_summary JSONB,
  top_categories_summary JSONB,
  insights TEXT,
  recommendations TEXT
);

CREATE INDEX idx_chat_analytics_summaries_date ON chat_analytics_summaries(date_range_end DESC);
CREATE INDEX idx_chat_analytics_summaries_generated ON chat_analytics_summaries(generated_at DESC);

-- ============================================
-- 4. PROMPTS DEL SISTEMA
-- ============================================

CREATE TABLE system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_system_prompts_active ON system_prompts(is_active);
CREATE INDEX idx_system_prompts_name ON system_prompts(name);
CREATE INDEX idx_prompt_variables_prompt_id ON prompt_variables(prompt_id);
CREATE INDEX idx_prompt_variables_name ON prompt_variables(variable_name);

-- ============================================
-- 5. CONEXIONES PRESTASHOP
-- ============================================

CREATE TABLE prestashop_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prestashop_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  lang_code INTEGER DEFAULT 1,
  lang_slug TEXT DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_prestashop_connections_active ON prestashop_connections(is_active);

-- ============================================
-- 6. HISTORIAL DE SINCRONIZACIONES
-- ============================================

CREATE TABLE product_sync_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  connection_id UUID REFERENCES prestashop_connections(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  sync_started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  sync_completed_at TIMESTAMP WITH TIME ZONE,
  total_products_scanned INTEGER DEFAULT 0,
  new_products_found INTEGER DEFAULT 0,
  products_imported INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  log_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_product_sync_history_connection ON product_sync_history(connection_id);
CREATE INDEX idx_product_sync_history_status ON product_sync_history(status);
CREATE INDEX idx_product_sync_history_started ON product_sync_history(sync_started_at DESC);

-- ============================================
-- 7. DOCUMENTOS
-- ============================================

CREATE TABLE documents (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  mime_type TEXT,
  extracted_text TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_documents_filename ON documents(filename);
CREATE INDEX idx_documents_file_type ON documents(file_type);
CREATE INDEX idx_documents_extracted_text ON documents USING gin(to_tsvector('spanish', extracted_text));

-- ============================================
-- 8. CONTENIDO WEB
-- ============================================

CREATE TABLE web_content_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  content_type TEXT,
  status TEXT DEFAULT 'active',
  last_indexed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE TABLE web_content_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID REFERENCES web_content_sources(id) ON DELETE CASCADE,
  product_id BIGINT REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  content_type TEXT,
  status TEXT DEFAULT 'active',
  indexed_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

CREATE INDEX idx_web_content_sources_url ON web_content_sources(url);
CREATE INDEX idx_web_content_sources_status ON web_content_sources(status);
CREATE INDEX idx_web_content_index_source ON web_content_index(source_id);
CREATE INDEX idx_web_content_index_product ON web_content_index(product_id);
CREATE INDEX idx_web_content_index_status ON web_content_index(status);
CREATE INDEX idx_web_content_index_content ON web_content_index USING gin(to_tsvector('spanish', content));

-- ============================================
-- 9. FUNCIONES Y TRIGGERS
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_products_updated_at 
  BEFORE UPDATE ON products 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_system_prompts_updated_at 
  BEFORE UPDATE ON system_prompts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prompt_variables_updated_at 
  BEFORE UPDATE ON prompt_variables 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_prestashop_connections_updated_at 
  BEFORE UPDATE ON prestashop_connections 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_product_sync_history_updated_at 
  BEFORE UPDATE ON product_sync_history 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_content_index_updated_at 
  BEFORE UPDATE ON web_content_index 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_web_content_sources_updated_at 
  BEFORE UPDATE ON web_content_sources 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 10. POLÍTICAS RLS (Row Level Security)
-- ============================================

-- Products
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON products FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON products FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON products FOR UPDATE USING (true);

-- Chat conversations
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON chat_conversations FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON chat_conversations FOR INSERT WITH CHECK (true);

-- Chat analytics summaries
ALTER TABLE chat_analytics_summaries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON chat_analytics_summaries FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON chat_analytics_summaries FOR INSERT WITH CHECK (true);

-- System prompts
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON system_prompts FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON system_prompts FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON system_prompts FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON system_prompts FOR DELETE USING (true);

-- Prompt variables
ALTER TABLE prompt_variables ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON prompt_variables FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON prompt_variables FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON prompt_variables FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON prompt_variables FOR DELETE USING (true);

-- Prestashop connections
ALTER TABLE prestashop_connections ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON prestashop_connections FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON prestashop_connections FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON prestashop_connections FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON prestashop_connections FOR DELETE USING (true);

-- Product sync history
ALTER TABLE product_sync_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON product_sync_history FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON product_sync_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON product_sync_history FOR UPDATE USING (true);

-- Documents
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON documents FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON documents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON documents FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON documents FOR DELETE USING (true);

-- Web content
ALTER TABLE web_content_sources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON web_content_sources FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON web_content_sources FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON web_content_sources FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON web_content_sources FOR DELETE USING (true);

ALTER TABLE web_content_index ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access" ON web_content_index FOR SELECT USING (true);
CREATE POLICY "Allow public insert access" ON web_content_index FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public update access" ON web_content_index FOR UPDATE USING (true);
CREATE POLICY "Allow public delete access" ON web_content_index FOR DELETE USING (true);

-- ============================================
-- VERIFICACIÓN: Contar tablas creadas
-- ============================================

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columnas
FROM 
    information_schema.tables t
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
    )
ORDER BY table_name;

-- Debe retornar 10 tablas



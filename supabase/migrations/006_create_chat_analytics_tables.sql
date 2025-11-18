-- Tabla para guardar todas las conversaciones del chat
CREATE TABLE IF NOT EXISTS chat_conversations (
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
  tokens_used INTEGER,
  feedback_helpful BOOLEAN
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_function_called ON chat_conversations(function_called);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_category ON chat_conversations(category_consulted);

-- Índice GIN para búsqueda en productos consultados
CREATE INDEX IF NOT EXISTS idx_chat_conversations_products ON chat_conversations USING gin(products_consulted);

-- Política RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Allow public read access" ON chat_conversations;
DROP POLICY IF EXISTS "Allow public insert access" ON chat_conversations;
DROP POLICY IF EXISTS "Allow public update access" ON chat_conversations;

CREATE POLICY "Allow public read access" ON chat_conversations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON chat_conversations
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON chat_conversations
  FOR UPDATE USING (true);

-- Tabla para guardar resúmenes narrativos generados por OpenAI
CREATE TABLE IF NOT EXISTS chat_analytics_summaries (
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

CREATE INDEX IF NOT EXISTS idx_chat_analytics_summaries_date ON chat_analytics_summaries(date_range_end DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_summaries_generated ON chat_analytics_summaries(generated_at DESC);

-- Política RLS
ALTER TABLE chat_analytics_summaries ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Allow public read access" ON chat_analytics_summaries;
DROP POLICY IF EXISTS "Allow public insert access" ON chat_analytics_summaries;

CREATE POLICY "Allow public read access" ON chat_analytics_summaries
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON chat_analytics_summaries
  FOR INSERT WITH CHECK (true);


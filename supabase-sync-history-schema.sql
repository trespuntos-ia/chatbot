-- Tabla para almacenar configuraciones de conexión de PrestaShop
CREATE TABLE IF NOT EXISTS prestashop_connections (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(255) NOT NULL DEFAULT 'Default Connection',
  prestashop_url TEXT NOT NULL,
  api_key TEXT NOT NULL,
  base_url TEXT,
  lang_code INTEGER DEFAULT 1,
  lang_slug VARCHAR(10) DEFAULT 'es',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabla para almacenar el historial de sincronización de productos
CREATE TABLE IF NOT EXISTS product_sync_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id UUID REFERENCES prestashop_connections(id) ON DELETE SET NULL,
  sync_started_at TIMESTAMPTZ DEFAULT NOW(),
  sync_completed_at TIMESTAMPTZ,
  status VARCHAR(50) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  total_products_scanned INTEGER DEFAULT 0,
  new_products_found INTEGER DEFAULT 0,
  products_imported INTEGER DEFAULT 0,
  products_updated INTEGER DEFAULT 0,
  errors JSONB DEFAULT '[]'::jsonb,
  log_messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para mejorar el rendimiento
CREATE INDEX IF NOT EXISTS idx_product_sync_history_connection_id ON product_sync_history(connection_id);
CREATE INDEX IF NOT EXISTS idx_product_sync_history_created_at ON product_sync_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_product_sync_history_status ON product_sync_history(status);

-- Habilitar RLS (Row Level Security)
ALTER TABLE prestashop_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_sync_history ENABLE ROW LEVEL SECURITY;

-- Eliminar políticas existentes si existen (para evitar errores al re-ejecutar)
DROP POLICY IF EXISTS "Enable read access for all users" ON prestashop_connections;
DROP POLICY IF EXISTS "Enable insert access for all users" ON prestashop_connections;
DROP POLICY IF EXISTS "Enable update access for all users" ON prestashop_connections;
DROP POLICY IF EXISTS "Enable delete access for all users" ON prestashop_connections;

DROP POLICY IF EXISTS "Enable read access for all users" ON product_sync_history;
DROP POLICY IF EXISTS "Enable insert access for all users" ON product_sync_history;
DROP POLICY IF EXISTS "Enable update access for all users" ON product_sync_history;

-- Políticas RLS para prestashop_connections
CREATE POLICY "Enable read access for all users" ON prestashop_connections
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON prestashop_connections
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON prestashop_connections
  FOR UPDATE USING (true);

CREATE POLICY "Enable delete access for all users" ON prestashop_connections
  FOR DELETE USING (true);

-- Políticas RLS para product_sync_history
CREATE POLICY "Enable read access for all users" ON product_sync_history
  FOR SELECT USING (true);

CREATE POLICY "Enable insert access for all users" ON product_sync_history
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Enable update access for all users" ON product_sync_history
  FOR UPDATE USING (true);

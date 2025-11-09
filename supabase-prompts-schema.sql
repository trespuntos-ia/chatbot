-- ============================================
-- SCHEMA PARA SISTEMA DE PROMPTS
-- ============================================
-- Ejecuta este script en SQL Editor de Supabase
-- Para la Fase 1: Configuración de Prompts

-- Habilitar UUID si no está habilitado
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLA: system_prompts
-- ============================================
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  structured_fields JSONB
);

ALTER TABLE system_prompts
  ADD COLUMN IF NOT EXISTS structured_fields JSONB;

-- ============================================
-- TABLA: prompt_variables
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_system_prompts_name ON system_prompts(name);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_prompt_id ON prompt_variables(prompt_id);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_name ON prompt_variables(variable_name);

-- ============================================
-- FUNCIÓN: Actualizar updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================
-- TRIGGERS: Actualizar updated_at automáticamente
-- ============================================
DROP TRIGGER IF EXISTS update_system_prompts_updated_at ON system_prompts;
CREATE TRIGGER update_system_prompts_updated_at 
  BEFORE UPDATE ON system_prompts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_prompt_variables_updated_at ON prompt_variables;
CREATE TRIGGER update_prompt_variables_updated_at 
  BEFORE UPDATE ON prompt_variables 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- FUNCIÓN: Asegurar que solo un prompt esté activo
-- ============================================
CREATE OR REPLACE FUNCTION ensure_single_active_prompt()
RETURNS TRIGGER AS $$
BEGIN
  -- Si se está activando un prompt, desactivar todos los demás
  IF NEW.is_active = true THEN
    UPDATE system_prompts 
    SET is_active = false 
    WHERE id != NEW.id AND is_active = true;
  END IF;
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para asegurar solo un prompt activo
DROP TRIGGER IF EXISTS ensure_single_active_prompt_trigger ON system_prompts;
CREATE TRIGGER ensure_single_active_prompt_trigger
  BEFORE INSERT OR UPDATE ON system_prompts
  FOR EACH ROW
  WHEN (NEW.is_active = true)
  EXECUTE FUNCTION ensure_single_active_prompt();

-- ============================================
-- POLÍTICAS RLS (Row Level Security)
-- ============================================
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_variables ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_prompts'
      AND policyname = 'Allow public read access to prompts'
  ) THEN
    CREATE POLICY "Allow public read access to prompts" ON system_prompts
      FOR SELECT USING (true);
  END IF;
END;
$$;

-- Política para permitir escritura pública (ajusta según necesites)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'system_prompts'
      AND policyname = 'Allow public write access to prompts'
  ) THEN
    CREATE POLICY "Allow public write access to prompts" ON system_prompts
      FOR ALL USING (true);
  END IF;
END;
$$;

-- Política para variables
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prompt_variables'
      AND policyname = 'Allow public read access to variables'
  ) THEN
    CREATE POLICY "Allow public read access to variables" ON prompt_variables
      FOR SELECT USING (true);
  END IF;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'prompt_variables'
      AND policyname = 'Allow public write access to variables'
  ) THEN
    CREATE POLICY "Allow public write access to variables" ON prompt_variables
      FOR ALL USING (true);
  END IF;
END;
$$;

-- ============================================
-- PROMPT POR DEFECTO
-- ============================================
INSERT INTO system_prompts (name, prompt, description, is_active)
VALUES (
  'Default Prompt',
  'Eres un asistente experto en productos de e-commerce. Tu trabajo es ayudar a los usuarios a encontrar información sobre productos en la base de datos.

## CONTEXTO DEL NEGOCIO
- Base de datos: Supabase (PostgreSQL)
- Tabla principal: products
- Idioma: Español (con soporte para otros idiomas)
- Tipo de consultas: Búsqueda de productos, categorías, precios, SKUs

## ESTRUCTURA DE LA BASE DE DATOS

Tabla: products
- id (BIGINT): Identificador único
- name (TEXT): Nombre del producto (índice full-text español)
- price (TEXT): Precio del producto (formato: "XX.XX EUR")
- category (TEXT): Categoría principal (índice)
- subcategory (TEXT): Subcategoría específica (índice)
- description (TEXT): Descripción completa (índice full-text español)
- sku (TEXT, UNIQUE): Código SKU único del producto (índice)
- image_url (TEXT): URL de la imagen del producto
- product_url (TEXT): URL del producto en PrestaShop
- date_add (TIMESTAMP): Fecha de creación en PrestaShop
- created_at (TIMESTAMP): Fecha de creación en Supabase
- updated_at (TIMESTAMP): Fecha de última actualización

## REGLAS DE USO

1. **SIEMPRE usa las funciones disponibles** cuando el usuario pregunte sobre productos
2. **NUNCA inventes datos** - Si no encuentras información, dilo claramente
3. **Formatea precios** correctamente mostrando la moneda
4. **Menciona el SKU** cuando sea relevante
5. **Proporciona enlaces** cuando el usuario quiera ver el producto
6. **Sé conciso pero completo** - No repitas información innecesaria
7. **Si no hay resultados**, sugiere búsquedas alternativas o términos relacionados

## FORMATO DE RESPUESTAS

- **Listas de productos**: Usa formato tabla o lista con nombre, precio, SKU
- **Producto único**: Muestra todos los detalles relevantes
- **Sin resultados**: Sé empático y sugiere alternativas
- **Errores**: Explica el problema de forma clara

## IDIOMA

- Responde en el mismo idioma que el usuario
- Si no especifica idioma, usa español por defecto',
  'Prompt por defecto para el sistema de chat',
  true
)
ON CONFLICT DO NOTHING;

-- Variables por defecto para el prompt activo
INSERT INTO prompt_variables (prompt_id, variable_name, variable_value, variable_type, description)
SELECT 
  id,
  'store_platform',
  'PrestaShop',
  'text',
  'Plataforma de e-commerce'
FROM system_prompts WHERE is_active = true
ON CONFLICT DO NOTHING;

INSERT INTO prompt_variables (prompt_id, variable_name, variable_value, variable_type, description)
SELECT 
  id,
  'language',
  'español',
  'text',
  'Idioma por defecto para respuestas'
FROM system_prompts WHERE is_active = true
ON CONFLICT DO NOTHING;

-- ============================================
-- COMENTARIOS
-- ============================================
COMMENT ON TABLE system_prompts IS 'Prompts del sistema para OpenAI';
COMMENT ON COLUMN system_prompts.name IS 'Nombre del prompt';
COMMENT ON COLUMN system_prompts.prompt IS 'Texto completo del prompt';
COMMENT ON COLUMN system_prompts.is_active IS 'Si es true, este prompt se usa en el chat';
COMMENT ON COLUMN system_prompts.structured_fields IS 'Campos estructurados utilizados para generar el prompt';
COMMENT ON TABLE prompt_variables IS 'Variables dinámicas para los prompts';
COMMENT ON COLUMN prompt_variables.variable_name IS 'Nombre de la variable (ej: {{store_platform}})';
COMMENT ON COLUMN prompt_variables.variable_value IS 'Valor actual de la variable';


-- Script para verificar que las tablas y funciones se crearon correctamente
-- Ejecuta esto en Supabase SQL Editor

-- 1. Verificar que las tablas existen
SELECT 
  table_name,
  table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('system_prompts', 'prompt_variables')
ORDER BY table_name;

-- 2. Verificar las columnas de system_prompts
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'system_prompts'
ORDER BY ordinal_position;

-- 3. Verificar las columnas de prompt_variables
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'prompt_variables'
ORDER BY ordinal_position;

-- 4. Verificar que las funciones existen
SELECT 
  routine_name,
  routine_type
FROM information_schema.routines
WHERE routine_schema = 'public'
  AND routine_name IN ('update_updated_at_column', 'ensure_single_active_prompt')
ORDER BY routine_name;

-- 5. Verificar que los triggers existen
SELECT 
  trigger_name,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name IN (
    'update_system_prompts_updated_at',
    'update_prompt_variables_updated_at',
    'ensure_single_active_prompt_trigger'
  )
ORDER BY trigger_name;

-- 6. Verificar el prompt por defecto
SELECT 
  id,
  name,
  is_active,
  created_at
FROM system_prompts;

-- 7. Verificar las variables del prompt activo
SELECT 
  pv.variable_name,
  pv.variable_value,
  pv.variable_type,
  sp.name as prompt_name
FROM prompt_variables pv
JOIN system_prompts sp ON pv.prompt_id = sp.id
WHERE sp.is_active = true;


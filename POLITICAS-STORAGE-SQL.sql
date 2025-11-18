-- Políticas de Storage para el bucket 'documents'
-- Ejecuta estas consultas en el SQL Editor de Supabase
-- Nota: Si las políticas ya existen, primero elimínalas y luego créalas de nuevo

-- 1. Eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access" ON storage.objects;

-- 2. Crear políticas nuevas

-- Política de Lectura (SELECT) - Permite leer archivos públicos
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política de Escritura (INSERT) - Permite subir archivos
CREATE POLICY "Allow public insert access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Política de Eliminación (DELETE) - Permite eliminar archivos
CREATE POLICY "Allow public delete access"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents');


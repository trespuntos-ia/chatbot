-- Agregar columna file_url a la tabla documents si no existe
-- Esta columna almacenará la URL del archivo si está en Supabase Storage
ALTER TABLE documents 
ADD COLUMN IF NOT EXISTS file_url TEXT;

-- Comentario en la columna
COMMENT ON COLUMN documents.file_url IS 'URL del archivo en Supabase Storage (si está disponible)';

-- Índice para búsquedas por URL
CREATE INDEX IF NOT EXISTS idx_documents_file_url ON documents(file_url) WHERE file_url IS NOT NULL;


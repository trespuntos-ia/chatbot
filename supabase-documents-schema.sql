-- Tabla para almacenar documentos subidos
CREATE TABLE IF NOT EXISTS documents (
  id BIGSERIAL PRIMARY KEY,
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  file_content BYTEA,
  extracted_text TEXT,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índice para búsquedas por nombre de archivo
CREATE INDEX IF NOT EXISTS idx_documents_filename ON documents(filename);

-- Índice para búsquedas de texto completo en el contenido extraído
CREATE INDEX IF NOT EXISTS idx_documents_extracted_text ON documents USING gin(to_tsvector('spanish', COALESCE(extracted_text, '')));

-- Índice para búsquedas por tipo de archivo
CREATE INDEX IF NOT EXISTS idx_documents_file_type ON documents(file_type);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_documents_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_documents_updated_at 
  BEFORE UPDATE ON documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_documents_updated_at();

-- Comentarios en la tabla y columnas
COMMENT ON TABLE documents IS 'Documentos subidos para consulta por IA';
COMMENT ON COLUMN documents.id IS 'ID único del documento';
COMMENT ON COLUMN documents.filename IS 'Nombre del archivo almacenado';
COMMENT ON COLUMN documents.original_filename IS 'Nombre original del archivo subido';
COMMENT ON COLUMN documents.file_type IS 'Tipo de archivo (pdf, docx, doc, etc.)';
COMMENT ON COLUMN documents.file_size IS 'Tamaño del archivo en bytes';
COMMENT ON COLUMN documents.file_content IS 'Contenido binario del archivo';
COMMENT ON COLUMN documents.extracted_text IS 'Texto extraído del documento para búsqueda';
COMMENT ON COLUMN documents.mime_type IS 'Tipo MIME del archivo';
COMMENT ON COLUMN documents.created_at IS 'Fecha de creación del registro';
COMMENT ON COLUMN documents.updated_at IS 'Fecha de última actualización';

-- Política RLS (Row Level Security) - Permitir lectura y escritura pública
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

-- Política para permitir lectura pública
CREATE POLICY "Allow public read access" ON documents
  FOR SELECT USING (true);

-- Política para permitir inserción pública
CREATE POLICY "Allow public insert access" ON documents
  FOR INSERT WITH CHECK (true);

-- Política para permitir actualización pública
CREATE POLICY "Allow public update access" ON documents
  FOR UPDATE USING (true);

-- Política para permitir eliminación pública
CREATE POLICY "Allow public delete access" ON documents
  FOR DELETE USING (true);


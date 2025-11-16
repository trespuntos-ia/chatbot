-- Habilitar extensión pgvector en Supabase
-- Ejecutar este script en Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar que está habilitada
SELECT * FROM pg_extension WHERE extname = 'vector';


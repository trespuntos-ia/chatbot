#!/bin/bash

# Script para configurar el entorno para implementación RAG

set -e

echo "🚀 Configurando entorno para implementación RAG..."

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js no está instalado"
  exit 1
fi

echo "✅ Node.js $(node --version)"

# Instalar dependencias necesarias
echo ""
echo "📦 Instalando dependencias..."

npm install langchain @langchain/openai @langchain/community

echo ""
echo "✅ Dependencias instaladas:"
echo "  - langchain"
echo "  - @langchain/openai"
echo "  - @langchain/community"

# Verificar variables de entorno
echo ""
echo "🔍 Verificando variables de entorno..."

required_vars=(
  "OPENAI_API_KEY"
  "SUPABASE_URL"
  "SUPABASE_ANON_KEY"
)

missing_vars=()

for var in "${required_vars[@]}"; do
  if [ -z "${!var}" ]; then
    missing_vars+=("$var")
  else
    echo "  ✅ $var está configurada"
  fi
done

if [ ${#missing_vars[@]} -gt 0 ]; then
  echo ""
  echo "⚠️  Variables de entorno faltantes:"
  for var in "${missing_vars[@]}"; do
    echo "  - $var"
  done
  echo ""
  echo "Configúralas en tu archivo .env o en Vercel:"
  echo "  OPENAI_API_KEY=sk-..."
  echo "  SUPABASE_URL=https://..."
  echo "  SUPABASE_ANON_KEY=eyJ..."
  echo ""
  echo "También necesitarás:"
  echo "  SUPABASE_SERVICE_ROLE_KEY=eyJ... (para indexación)"
fi

# Crear estructura de directorios
echo ""
echo "📁 Creando estructura de directorios..."

mkdir -p api/utils
mkdir -p supabase/migrations

echo "  ✅ api/utils/"
echo "  ✅ supabase/migrations/"

echo ""
echo "✅ Configuración completada!"
echo ""
echo "📋 Próximos pasos:"
echo "  1. Configurar pgvector en Supabase (ver PLAN-IMPLEMENTACION-RAG.md)"
echo "  2. Ejecutar migraciones SQL"
echo "  3. Indexar productos existentes"
echo "  4. Probar retrieval básico"
echo ""
echo "📖 Ver documentación completa en:"
echo "  - ANALISIS-VIABILIDAD-RAG.md"
echo "  - PLAN-IMPLEMENTACION-RAG.md"


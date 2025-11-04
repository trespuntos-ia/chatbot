#!/bin/bash

# Script para configurar variables de entorno en Vercel para Supabase

echo "🚀 Configuración de Variables de Entorno en Vercel"
echo "=================================================="
echo ""

# Verificar que Vercel CLI esté instalado
if ! command -v vercel &> /dev/null; then
    echo "❌ Vercel CLI no encontrado. Instálalo con: npm i -g vercel"
    exit 1
fi

echo "📋 Necesitamos las credenciales de Supabase:"
echo ""
read -p "Ingresa tu SUPABASE_URL (ej: https://xxxxx.supabase.co): " SUPABASE_URL
read -p "Ingresa tu SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ]; then
    echo "❌ Error: Ambas credenciales son requeridas"
    exit 1
fi

echo ""
echo "🔧 Configurando variables de entorno en Vercel..."
echo ""

# Configurar SUPABASE_URL
echo "Configurando SUPABASE_URL..."
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL production
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL preview
echo "$SUPABASE_URL" | vercel env add SUPABASE_URL development

# Configurar SUPABASE_ANON_KEY
echo "Configurando SUPABASE_ANON_KEY..."
echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY production
echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY preview
echo "$SUPABASE_ANON_KEY" | vercel env add SUPABASE_ANON_KEY development

echo ""
echo "✅ Variables de entorno configuradas!"
echo ""
echo "🔄 Redesplegando aplicación..."
cd /Users/jordi/Documents/GitHub/chatbot2
vercel --prod

echo ""
echo "✅ ¡Configuración completada!"
echo "Ahora puedes usar el botón 'Guardar en Base de Datos' en la aplicación."


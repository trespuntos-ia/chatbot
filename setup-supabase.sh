#!/bin/bash

# Script de ayuda para configurar Supabase
# Este script te guiará en el proceso

echo "🚀 Configuración de Supabase para PrestaShop Products"
echo "=================================================="
echo ""

echo "📋 PASO 1: Crear proyecto en Supabase"
echo "1. Ve a https://supabase.com"
echo "2. Crea una cuenta o inicia sesión"
echo "3. Crea un nuevo proyecto"
echo "4. Espera a que se complete la configuración (puede tardar unos minutos)"
echo ""
read -p "Presiona Enter cuando hayas creado el proyecto..."

echo ""
echo "📋 PASO 2: Obtener credenciales"
echo "1. Ve a Settings > API en tu proyecto de Supabase"
echo "2. Copia el 'Project URL'"
echo "3. Copia el 'anon/public' key"
echo ""

read -p "Ingresa tu SUPABASE_URL: " SUPABASE_URL
read -p "Ingresa tu SUPABASE_ANON_KEY: " SUPABASE_ANON_KEY

echo ""
echo "📋 PASO 3: Crear la tabla"
echo "1. Ve a SQL Editor en Supabase"
echo "2. Copia el contenido del archivo supabase-schema.sql"
echo "3. Pega y ejecuta el script"
echo ""
read -p "Presiona Enter cuando hayas ejecutado el script SQL..."

echo ""
echo "📋 PASO 4: Configurar variables en Vercel"
echo "Las variables de entorno se configurarán automáticamente..."
echo ""

# Configurar variables de entorno en Vercel usando la CLI
if command -v vercel &> /dev/null; then
    echo "Configurando variables de entorno en Vercel..."
    vercel env add SUPABASE_URL production <<< "$SUPABASE_URL" || echo "Error al agregar SUPABASE_URL"
    vercel env add SUPABASE_ANON_KEY production <<< "$SUPABASE_ANON_KEY" || echo "Error al agregar SUPABASE_ANON_KEY"
    echo "✅ Variables de entorno configuradas"
    echo ""
    echo "🔄 Redesplegando aplicación..."
    vercel --prod
else
    echo "⚠️  Vercel CLI no encontrado. Configura manualmente:"
    echo "1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables"
    echo "2. Agrega SUPABASE_URL = $SUPABASE_URL"
    echo "3. Agrega SUPABASE_ANON_KEY = $SUPABASE_ANON_KEY"
    echo "4. Redesplega la aplicación"
fi

echo ""
echo "✅ ¡Configuración completada!"
echo "Ahora puedes usar el botón 'Guardar en Base de Datos' en la aplicación."


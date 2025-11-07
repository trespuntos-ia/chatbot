#!/bin/bash

# Script para verificar cuántos productos ya están indexados
#
# Uso: bash scripts/verificar-progreso.sh

DOMAIN="https://chatbot-v2-murex.vercel.app"

echo "🔍 Verificando progreso de indexación..."
echo ""

# Contar productos indexados en Supabase
# Nota: Esto requiere acceso a Supabase. Si no funciona, puedes verificar manualmente.

echo "💡 Para verificar manualmente:"
echo "   1. Ve a tu proyecto en Supabase Dashboard"
echo "   2. Abre la tabla 'web_content_index'"
echo "   3. Verás cuántos productos están indexados"
echo ""
echo "   O ejecuta esta query en Supabase SQL Editor:"
echo "   SELECT COUNT(*) as total_indexados FROM web_content_index;"
echo ""

# Intentar contar productos con URLs (si tienes acceso a la API)
echo "📊 Productos con URLs disponibles:"
echo "   (Ejecuta en Supabase SQL Editor:)"
echo "   SELECT COUNT(*) as total_con_url FROM products WHERE product_url IS NOT NULL AND product_url != '';"
echo ""







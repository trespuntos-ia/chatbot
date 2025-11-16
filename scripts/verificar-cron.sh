#!/bin/bash

# Script para verificar que el cron job de indexación RAG funciona correctamente

echo "🔍 Verificando estado del cron job de indexación RAG..."
echo ""

# Obtener la URL del proyecto (puedes cambiarla)
DOMAIN="${1:-https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app}"

echo "📊 Estado actual de indexación:"
curl -s "${DOMAIN}/api/get-indexing-status" | jq '.'

echo ""
echo "🧪 Probando ejecución manual del cron:"
echo "Ejecutando: curl \"${DOMAIN}/api/index-products-rag-auto?manual=true\""
echo ""

RESPONSE=$(curl -s "${DOMAIN}/api/index-products-rag-auto?manual=true")
echo "$RESPONSE" | jq '.'

echo ""
echo "✅ Verificación completada"
echo ""
echo "📝 Para verificar que el cron funciona automáticamente:"
echo "1. Ve a Vercel Dashboard → Tu Proyecto → Logs"
echo "2. Busca ejecuciones de '/api/index-products-rag-auto'"
echo "3. El cron se ejecuta cada 5 minutos automáticamente"


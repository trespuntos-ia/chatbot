#!/bin/bash

# Script para probar manualmente el cron job de indexación RAG

DOMAIN="${1:-https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app}"

echo "🧪 Probando cron job manualmente..."
echo ""

echo "1️⃣ Verificando estado actual:"
curl -s "${DOMAIN}/api/get-indexing-status" | jq '.'

echo ""
echo "2️⃣ Ejecutando cron manualmente (con ?manual=true):"
RESPONSE=$(curl -s "${DOMAIN}/api/index-products-rag-auto?manual=true")
echo "$RESPONSE" | jq '.'

echo ""
echo "3️⃣ Verificando estado después de la ejecución:"
sleep 2
curl -s "${DOMAIN}/api/get-indexing-status" | jq '.'

echo ""
echo "✅ Prueba completada"


#!/bin/bash

# Script para indexar un producto usando curl
# 
# Uso: bash scripts/index-product-curl.sh [URL] [product_id]

DOMAIN="https://chatbot-v2-murex.vercel.app"
URL="${1:-https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html}"
PRODUCT_ID="${2:-}"

echo "🚀 Indexando producto..."
echo "   Dominio: $DOMAIN"
echo "   URL: $URL"
if [ -n "$PRODUCT_ID" ]; then
    echo "   Product ID: $PRODUCT_ID"
fi
echo ""

# Construir el JSON
if [ -n "$PRODUCT_ID" ]; then
    JSON_PAYLOAD=$(cat <<EOF
{
  "url": "$URL",
  "content_type": "product_page",
  "product_id": $PRODUCT_ID,
  "force": false
}
EOF
)
else
    JSON_PAYLOAD=$(cat <<EOF
{
  "url": "$URL",
  "content_type": "product_page",
  "force": false
}
EOF
)
fi

# Hacer la petición
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "$DOMAIN/api/index-web-content" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d "$JSON_PAYLOAD")

# Separar body y status code
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

echo "📡 Respuesta (HTTP $HTTP_CODE):"
echo ""

if [ "$HTTP_CODE" -eq 200 ] || [ "$HTTP_CODE" -eq 201 ]; then
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "✅ ¡Producto indexado correctamente!"
else
    echo "$BODY"
    echo ""
    echo "❌ Error al indexar (HTTP $HTTP_CODE)"
    echo ""
    echo "💡 Posibles soluciones:"
    echo "   1. Verifica que las tablas estén creadas en Supabase"
    echo "   2. Verifica las variables de entorno en Vercel"
    echo "   3. Verifica los logs de Vercel"
fi







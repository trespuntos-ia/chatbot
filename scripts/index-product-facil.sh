#!/bin/bash

# Script MÁS SIMPLE para indexar un producto
# Solo copia y pega este comando en tu terminal

echo "🚀 Indexando producto Aromatic Rellenable..."
echo ""

# Si quieres cambiar la URL, edita la línea de abajo
PRODUCT_URL="https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"
API_URL="https://chatbot-v2-murex.vercel.app"

echo "📝 URL del producto: $PRODUCT_URL"
echo "🔗 API: $API_URL"
echo ""
echo "⏳ Espera un momento..."
echo ""

# Hacer la petición y mostrar resultado
RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$API_URL/api/index-web-content" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$PRODUCT_URL\",\"content_type\":\"product_page\"}")

# Separar respuesta y código HTTP
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESULT" | sed '/HTTP_CODE/d')

echo "═══════════════════════════════════════════════════════"
echo ""

if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    echo "✅ ¡ÉXITO! Producto indexado correctamente"
    echo ""
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    echo "🎉 ¡Listo! Ahora prueba en el chat:"
    echo "   '¿Qué características tiene el Aromatic Rellenable?'"
else
    echo "❌ Error (HTTP $HTTP_CODE)"
    echo ""
    echo "$BODY"
    echo ""
    echo "💡 Si ves 'Supabase configuration missing':"
    echo "   1. Ve a Vercel Dashboard → Settings → Environment Variables"
    echo "   2. Verifica que tengas SUPABASE_URL y SUPABASE_SERVICE_KEY"
    echo ""
    echo "💡 Si ves 'relation web_content_index does not exist':"
    echo "   1. Ve a Supabase Dashboard → SQL Editor"
    echo "   2. Ejecuta el archivo supabase-web-content-schema.sql"
fi

echo ""



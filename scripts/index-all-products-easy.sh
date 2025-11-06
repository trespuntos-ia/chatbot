#!/bin/bash

# Script para indexar TODOS los productos automáticamente
# 
# Uso: bash scripts/index-all-products-easy.sh

DOMAIN="https://chatbot-v2-murex.vercel.app"

echo "🚀 Indexando TODOS los productos automáticamente..."
echo "   Dominio: $DOMAIN"
echo ""
echo "⏳ Esto puede tardar varios minutos dependiendo de cuántos productos tengas..."
echo "   (Se procesan 100 productos a la vez)"
echo ""

# Primera tanda: productos 0-99
LIMIT=100
OFFSET=0

echo "📦 Procesando productos del $OFFSET al $((OFFSET + LIMIT - 1))..."
echo ""

RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/index-all-products" \
  -H "Content-Type: application/json" \
  -d "{\"limit\": $LIMIT, \"offset\": $OFFSET, \"force\": false}")

# Separar respuesta y código HTTP
HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE" | cut -d: -f2)
BODY=$(echo "$RESULT" | sed '/HTTP_CODE/d')

if [ "$HTTP_CODE" = "200" ]; then
    echo "✅ Primera tanda completada"
    echo ""
    echo "$BODY" | python3 -m json.tool 2>/dev/null || echo "$BODY"
    echo ""
    
    # Extraer información de la respuesta
    PROCESSED=$(echo "$BODY" | grep -o '"processed":[0-9]*' | cut -d: -f2 || echo "0")
    INDEXED=$(echo "$BODY" | grep -o '"indexed":[0-9]*' | cut -d: -f2 || echo "0")
    SKIPPED=$(echo "$BODY" | grep -o '"skipped":[0-9]*' | cut -d: -f2 || echo "0")
    ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | cut -d: -f2 || echo "0")
    
    echo "═══════════════════════════════════════════════════════"
    echo "📊 Resumen:"
    echo "   Procesados: $PROCESSED"
    echo "   Indexados: $INDEXED"
    echo "   Sin cambios (ya indexados): $SKIPPED"
    echo "   Errores: $ERRORS"
    echo ""
    
    if [ "$PROCESSED" -eq "$LIMIT" ]; then
        echo "💡 Hay más productos. Puedes ejecutar de nuevo este script"
        echo "   para procesar los siguientes 100 productos."
        echo ""
        echo "   O ejecuta manualmente:"
        echo "   curl -X POST $DOMAIN/api/index-all-products \\"
        echo "     -H \"Content-Type: application/json\" \\"
        echo "     -d '{\"limit\": 100, \"offset\": 100}'"
    else
        echo "✅ ¡Todos los productos han sido procesados!"
    fi
else
    echo "❌ Error (HTTP $HTTP_CODE)"
    echo ""
    echo "$BODY"
    echo ""
    echo "💡 Verifica que las tablas estén creadas en Supabase"
fi

echo ""



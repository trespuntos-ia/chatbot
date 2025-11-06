#!/bin/bash

# Script para indexar TODOS los productos en múltiples tandas
# Procesa automáticamente todos los productos en lotes de 100
#
# Uso: bash scripts/index-all-products-complete.sh

DOMAIN="https://chatbot-v2-murex.vercel.app"
LIMIT=100
OFFSET=0
TOTAL_PROCESSED=0
TOTAL_INDEXED=0
TOTAL_SKIPPED=0
TOTAL_ERRORS=0

echo "🚀 Indexando TODOS los productos automáticamente..."
echo "   Dominio: $DOMAIN"
echo "   Lote: $LIMIT productos por tanda"
echo ""
echo "⏳ Esto puede tardar varios minutos..."
echo "   (Se hará una pausa de 2 segundos entre tandas para no sobrecargar)"
echo ""

BATCH=1

while true; do
    echo "═══════════════════════════════════════════════════════"
    echo "📦 Tanda $BATCH: Productos del $OFFSET al $((OFFSET + LIMIT - 1))"
    echo ""
    
    RESULT=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/index-all-products" \
      -H "Content-Type: application/json" \
      -d "{\"limit\": $LIMIT, \"offset\": $OFFSET, \"force\": false}")
    
    # Separar respuesta y código HTTP
    HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$RESULT" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "❌ Error (HTTP $HTTP_CODE)"
        echo "$BODY"
        break
    fi
    
    # Extraer información
    PROCESSED=$(echo "$BODY" | grep -o '"processed":[0-9]*' | cut -d: -f2 || echo "0")
    INDEXED=$(echo "$BODY" | grep -o '"indexed":[0-9]*' | cut -d: -f2 || echo "0")
    SKIPPED=$(echo "$BODY" | grep -o '"skipped":[0-9]*' | cut -d: -f2 || echo "0")
    ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | cut -d: -f2 || echo "0")
    
    # Acumular totales
    TOTAL_PROCESSED=$((TOTAL_PROCESSED + PROCESSED))
    TOTAL_INDEXED=$((TOTAL_INDEXED + INDEXED))
    TOTAL_SKIPPED=$((TOTAL_SKIPPED + SKIPPED))
    TOTAL_ERRORS=$((TOTAL_ERRORS + ERRORS))
    
    echo "✅ Tanda $BATCH completada:"
    echo "   Procesados: $PROCESSED"
    echo "   Indexados: $INDEXED"
    echo "   Sin cambios: $SKIPPED"
    echo "   Errores: $ERRORS"
    echo ""
    
    # Si procesó menos productos de los solicitados, significa que terminó
    if [ "$PROCESSED" -lt "$LIMIT" ]; then
        echo "✅ ¡Todos los productos han sido procesados!"
        break
    fi
    
    # Si no hubo productos procesados, también terminamos
    if [ "$PROCESSED" -eq "0" ]; then
        echo "✅ No hay más productos para procesar"
        break
    fi
    
    # Preparar siguiente tanda
    OFFSET=$((OFFSET + LIMIT))
    BATCH=$((BATCH + 1))
    
    # Pausa de 2 segundos para no sobrecargar
    echo "⏳ Esperando 2 segundos antes de la siguiente tanda..."
    sleep 2
    echo ""
done

echo "═══════════════════════════════════════════════════════"
echo "📊 RESUMEN FINAL:"
echo "   Total procesados: $TOTAL_PROCESSED"
echo "   Total indexados: $TOTAL_INDEXED"
echo "   Total sin cambios: $TOTAL_SKIPPED"
echo "   Total errores: $TOTAL_ERRORS"
echo ""
echo "🎉 ¡Proceso completado!"
echo ""



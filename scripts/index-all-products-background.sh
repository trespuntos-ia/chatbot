#!/bin/bash

# Script para indexar productos en segundo plano con mejor logging
# 
# Uso: bash scripts/index-all-products-background.sh

DOMAIN="https://chatbot-v2-murex.vercel.app"
LIMIT=50  # Reducido a 50 para ser más rápido
OFFSET=0

LOG_FILE="index-products-$(date +%Y%m%d-%H%M%S).log"

echo "🚀 Indexando productos (con logging en $LOG_FILE)..."
echo "   Dominio: $DOMAIN"
echo "   Lote: $LIMIT productos por tanda"
echo ""
echo "💡 Puedes cerrar esta ventana y revisar el progreso con:"
echo "   tail -f $LOG_FILE"
echo ""

BATCH=1

while true; do
    echo "[$(date +'%H:%M:%S')] Tanda $BATCH: Productos del $OFFSET al $((OFFSET + LIMIT - 1))" | tee -a "$LOG_FILE"
    
    START_TIME=$(date +%s)
    
    RESULT=$(curl -s --max-time 300 -w "\nHTTP_CODE:%{http_code}" -X POST "$DOMAIN/api/index-all-products" \
      -H "Content-Type: application/json" \
      -d "{\"limit\": $LIMIT, \"offset\": $OFFSET, \"force\": false}" 2>&1)
    
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    
    # Separar respuesta y código HTTP
    HTTP_CODE=$(echo "$RESULT" | grep "HTTP_CODE" | cut -d: -f2)
    BODY=$(echo "$RESULT" | sed '/HTTP_CODE/d')
    
    if [ "$HTTP_CODE" != "200" ]; then
        echo "[$(date +'%H:%M:%S')] ❌ Error (HTTP $HTTP_CODE) después de ${DURATION}s" | tee -a "$LOG_FILE"
        echo "$BODY" | tee -a "$LOG_FILE"
        break
    fi
    
    # Extraer información
    PROCESSED=$(echo "$BODY" | grep -o '"processed":[0-9]*' | cut -d: -f2 || echo "0")
    INDEXED=$(echo "$BODY" | grep -o '"indexed":[0-9]*' | cut -d: -f2 || echo "0")
    SKIPPED=$(echo "$BODY" | grep -o '"skipped":[0-9]*' | cut -d: -f2 || echo "0")
    ERRORS=$(echo "$BODY" | grep -o '"errors":[0-9]*' | cut -d: -f2 || echo "0")
    
    echo "[$(date +'%H:%M:%S')] ✅ Tanda $BATCH completada en ${DURATION}s: Procesados=$PROCESSED, Indexados=$INDEXED, Sin cambios=$SKIPPED, Errores=$ERRORS" | tee -a "$LOG_FILE"
    
    # Si procesó menos productos de los solicitados, significa que terminó
    if [ "$PROCESSED" -lt "$LIMIT" ] || [ "$PROCESSED" -eq "0" ]; then
        echo "[$(date +'%H:%M:%S')] ✅ ¡Todos los productos han sido procesados!" | tee -a "$LOG_FILE"
        break
    fi
    
    # Preparar siguiente tanda
    OFFSET=$((OFFSET + LIMIT))
    BATCH=$((BATCH + 1))
    
    # Pausa más corta
    sleep 1
done

echo "" | tee -a "$LOG_FILE"
echo "[$(date +'%H:%M:%S')] 🎉 Proceso completado. Log guardado en: $LOG_FILE" | tee -a "$LOG_FILE"







#!/bin/bash

# Script para guardar el código actual del chat antes de empezar con RAG

set -e

echo "🔄 Guardando código actual del chat..."

# Crear estructura de directorios
mkdir -p legacy/api
mkdir -p legacy/src/components
mkdir -p legacy/src/services
mkdir -p legacy/src/utils
mkdir -p legacy/src/contexts

# Copiar archivos del chat actual
echo "📁 Copiando archivos..."

# API endpoints
if [ -f "api/chat.ts" ]; then
  cp api/chat.ts legacy/api/chat.ts
  echo "  ✅ api/chat.ts"
fi

# Servicios
if [ -f "src/services/chatService.ts" ]; then
  cp src/services/chatService.ts legacy/src/services/chatService.ts
  echo "  ✅ src/services/chatService.ts"
fi

# Componentes
if [ -f "src/components/Chat.tsx" ]; then
  cp src/components/Chat.tsx legacy/src/components/Chat.tsx
  echo "  ✅ src/components/Chat.tsx"
fi

if [ -f "src/components/ChatWidget.tsx" ]; then
  cp src/components/ChatWidget.tsx legacy/src/components/ChatWidget.tsx
  echo "  ✅ src/components/ChatWidget.tsx"
fi

# Contextos
if [ -f "src/contexts/ChatContext.tsx" ]; then
  cp src/contexts/ChatContext.tsx legacy/src/contexts/ChatContext.tsx
  echo "  ✅ src/contexts/ChatContext.tsx"
fi

# Utilidades relacionadas
if [ -d "src/utils" ]; then
  find src/utils -name "*chat*" -o -name "*message*" | while read file; do
    if [ -f "$file" ]; then
      rel_path=${file#src/}
      mkdir -p "legacy/src/$(dirname "$rel_path")"
      cp "$file" "legacy/$rel_path"
      echo "  ✅ $file"
    fi
  done
fi

# Crear README con documentación
cat > legacy/README.md << 'EOF'
# Código Legacy del Chat

Este directorio contiene el código del sistema de chat anterior antes de la implementación de RAG.

## Archivos Guardados

- `api/chat.ts` - Endpoint principal del chat (búsqueda exacta por texto)
- `src/services/chatService.ts` - Servicio de comunicación con la API
- `src/components/Chat.tsx` - Componente principal del chat
- `src/components/ChatWidget.tsx` - Widget flotante del chat
- `src/contexts/ChatContext.tsx` - Contexto de React para el chat

## Funcionalidades del Sistema Anterior

### Búsqueda Exacta
- Búsqueda por texto exacto usando `.ilike()` en PostgreSQL
- Búsqueda en campos: nombre, descripción, SKU, URL del producto
- Búsqueda en categorías y subcategorías
- Búsqueda en contenido web indexado

### Flujo de Respuesta
1. Usuario envía mensaje
2. Sistema busca coincidencias exactas en:
   - Tabla `products`
   - Tabla `web_content_index`
   - Campos de categorías
3. Construye respuesta con productos encontrados
4. Retorna mensaje al usuario

### Limitaciones
- No usa embeddings ni búsqueda semántica
- Requiere coincidencia exacta o parcial de texto
- No entiende sinónimos o búsquedas conceptuales
- Respuestas limitadas a productos encontrados exactamente

## Restaurar Código Anterior

Si necesitas restaurar el código anterior:

```bash
cp legacy/api/chat.ts api/chat.ts
cp legacy/src/services/chatService.ts src/services/chatService.ts
cp legacy/src/components/Chat.tsx src/components/Chat.tsx
cp legacy/src/components/ChatWidget.tsx src/components/ChatWidget.tsx
cp legacy/src/contexts/ChatContext.tsx src/contexts/ChatContext.tsx
```

## Fecha de Backup

$(date)
EOF

echo ""
echo "✅ Backup completado!"
echo ""
echo "📝 Archivos guardados en: legacy/"
echo "📄 Documentación creada en: legacy/README.md"
echo ""
echo "Para restaurar el código anterior, ejecuta:"
echo "  cp legacy/api/chat.ts api/chat.ts"
echo "  cp legacy/src/services/chatService.ts src/services/chatService.ts"
echo "  # ... etc"


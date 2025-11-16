# Código Legacy del Chat

Este directorio contiene el código del sistema de chat anterior antes de la implementación de RAG.

## Archivos Guardados

- `api/chat.ts` - Endpoint principal del chat (búsqueda exacta por texto)
- `src/services/chatService.ts` - Servicio de comunicación con la API
- `src/components/Chat.tsx` - Componente principal del chat
- `src/components/ChatWidget.tsx` - Widget flotante del chat
- `src/contexts/ChatContext.tsx` - Contexto de React para el chat
- `src/utils/messageParser.ts` - Utilidades para parsear mensajes
- `src/utils/sourceLabels.ts` - Utilidades para etiquetas de fuentes

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
cp legacy/src/utils/messageParser.ts src/utils/messageParser.ts
cp legacy/src/utils/sourceLabels.ts src/utils/sourceLabels.ts
```

## Fecha de Backup

$(date)


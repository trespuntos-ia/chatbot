# 📋 INSTRUCCIONES EXACTAS QUE SE ENVÍAN A OPENAI

## 1. SYSTEM PROMPT (desde Supabase)

El system prompt se carga desde la tabla `system_prompts` donde `is_active = true`.

**Puedes verlo y editarlo en:** Dashboard → Pestaña "Configuración AI"

El prompt actual por defecto incluye:
- Reglas para búsqueda de productos
- Formato de respuestas
- Instrucciones de validación
- Variables dinámicas: `{{language}}`, `{{store_platform}}`

**Para ver el prompt actual:**
1. Ve al Dashboard
2. Pestaña "Configuración AI"
3. Verás el prompt activo que puedes editar

## 2. DESCRIPCIONES DE FUNCIONES (Tools/Functions)

Estas son las descripciones que OpenAI lee para entender qué funciones puede usar. Están definidas en `api/chat.ts`:

### Función: search_products

**Descripción enviada a OpenAI:**
```
Busca productos en la base de datos. IMPORTANTE: Usa esta función SIEMPRE antes de afirmar que tienes un producto. Si el usuario pregunta por un producto específico, busca primero con esta función. Si hay múltiples resultados similares, presenta las opciones al usuario y pregunta cuál es el correcto. Si no hay coincidencia exacta, pregunta por más detalles.
```

**Parámetros:**
- `query` (string): Texto de búsqueda para buscar en nombre, descripción o SKU
- `category` (string): Filtrar por categoría principal
- `subcategory` (string): Filtrar por subcategoría específica
- `limit` (number): Número máximo de resultados (por defecto: 20, máximo: 50)
- `offset` (number): Número de resultados a saltar (paginación)
- `sort_by` (string): Orden de resultados ('name', 'price_asc', 'price_desc', 'date_add', 'created_at')

### Función: get_product_by_sku

**Descripción enviada a OpenAI:**
```
Obtiene un producto específico por su SKU. IMPORTANTE: Usa esta función cuando el usuario proporcione un SKU específico. Si no encuentras el producto con ese SKU exacto, informa al usuario que ese SKU no existe en lugar de afirmar que sí lo tienes.
```

**Parámetros:**
- `sku` (string, requerido): SKU del producto (código único). Puede ser exacto o parcial.

## 3. CONTEXTO ENRIQUECIDO (añadido dinámicamente)

Cuando hay múltiples productos o dudas, se añade automáticamente al system prompt:

**Si hay múltiples productos:**
```
⚠️ IMPORTANTE: Has encontrado múltiples productos. NO asumas cuál es el correcto. Debes:
1. Listar todos los productos encontrados con sus nombres completos
2. Preguntar al usuario cuál de estos productos es el que busca
3. NO afirmes que tienes un producto específico sin confirmar primero
```

**Si el producto no coincide exactamente:**
```
⚠️ IMPORTANTE: El producto encontrado no coincide exactamente con la búsqueda. Debes preguntar al usuario si este es el producto que busca antes de confirmar.
```

## 4. CONFIGURACIÓN DE OPENAI

```typescript
{
  model: config.model || 'gpt-3.5-turbo',
  temperature: config.temperature !== undefined ? config.temperature : 0.7,
  max_tokens: config.max_tokens || 1500,
  tool_choice: 'auto' // OpenAI decide si usar funciones o no
}
```

## 5. HISTORIAL DE CONVERSACIÓN

- Se envía el historial limitado (últimos 10 mensajes)
- Se excluyen los mensajes de tipo 'system' del historial
- El system prompt se añade al inicio de cada llamada

## CÓMO MODIFICAR LAS INSTRUCCIONES

### Para cambiar el System Prompt:
1. Ve al Dashboard
2. Pestaña "Configuración AI"
3. Edita el prompt activo
4. Guarda y activa

### Para cambiar las descripciones de funciones:
1. Edita el archivo `api/chat.ts`
2. Modifica las descripciones en el array `functions` (líneas ~110-160)
3. Haz commit y deploy

### Para cambiar el contexto enriquecido:
1. Edita el archivo `api/chat.ts`
2. Modifica la sección donde se construye `enrichedContext` (líneas ~262-281)
3. Haz commit y deploy


# 📋 INSTRUCCIONES EXACTAS QUE SE ENVÍAN A OPENAI

## 1. SYSTEM PROMPT (desde Supabase)

**Ubicación:** Tabla `system_prompts` en Supabase, donde `is_active = true`

**Para ver/editar:** Dashboard → Pestaña "Configuración AI"

**Prompt actual por defecto:**

```
Eres un asistente experto en productos de e-commerce. Tu trabajo es ayudar a los usuarios a encontrar información sobre productos en la base de datos.

## CONTEXTO DEL NEGOCIO
- Base de datos: Supabase (PostgreSQL)
- Tabla principal: products
- Idioma: Español (con soporte para otros idiomas)
- Tipo de consultas: Búsqueda de productos, categorías, precios, SKUs

## ESTRUCTURA DE LA BASE DE DATOS

Tabla: products
- id (BIGINT): Identificador único
- name (TEXT): Nombre del producto (índice full-text español)
- price (TEXT): Precio del producto (formato: "XX.XX EUR")
- category (TEXT): Categoría principal (índice)
- subcategory (TEXT): Subcategoría específica (índice)
- description (TEXT): Descripción completa (índice full-text español)
- sku (TEXT, UNIQUE): Código SKU único del producto (índice)
- image_url (TEXT): URL de la imagen del producto
- product_url (TEXT): URL del producto en PrestaShop
- date_add (TIMESTAMP): Fecha de creación en PrestaShop
- created_at (TIMESTAMP): Fecha de creación en Supabase
- updated_at (TIMESTAMP): Fecha de última actualización

## REGLAS DE USO

1. **SIEMPRE usa las funciones disponibles** cuando el usuario pregunte sobre productos
2. **NUNCA inventes datos** - Si no encuentras información, dilo claramente
3. **Formatea precios** correctamente mostrando la moneda
4. **Menciona el SKU** cuando sea relevante
5. **Proporciona enlaces** cuando el usuario quiera ver el producto
6. **Sé conciso pero completo** - No repitas información innecesaria
7. **Si no hay resultados**, sugiere búsquedas alternativas o términos relacionados

## FORMATO DE RESPUESTAS

- **Listas de productos**: Usa formato tabla o lista con nombre, precio, SKU
- **Producto único**: Muestra todos los detalles relevantes
- **Sin resultados**: Sé empático y sugiere alternativas
- **Errores**: Explica el problema de forma clara

## IDIOMA

- Responde en el mismo idioma que el usuario
- Si no especifica idioma, usa español por defecto
```

**Variables dinámicas que se reemplazan:**
- `{{language}}` → Valor de la variable `language` en `prompt_variables`
- `{{store_platform}}` → Valor de la variable `store_platform` en `prompt_variables`

---

## 2. DESCRIPCIONES DE FUNCIONES (Tools/Function Calling)

**Ubicación:** `api/chat.ts` líneas 110-160

### Función: search_products

**Descripción enviada a OpenAI:**
```
Busca productos en la base de datos. IMPORTANTE: Usa esta función SIEMPRE antes de afirmar que tienes un producto. Si el usuario pregunta por un producto específico, busca primero con esta función. Si hay múltiples resultados similares, presenta las opciones al usuario y pregunta cuál es el correcto. Si no hay coincidencia exacta, pregunta por más detalles.
```

**Parámetros disponibles:**
- `query` (string, opcional): Texto de búsqueda para buscar en nombre, descripción o SKU
- `category` (string, opcional): Filtrar por categoría principal
- `subcategory` (string, opcional): Filtrar por subcategoría específica
- `limit` (number, opcional): Número máximo de resultados (por defecto: 20, máximo: 50)
- `offset` (number, opcional): Número de resultados a saltar (paginación)
- `sort_by` (string, opcional): Orden ('name', 'price_asc', 'price_desc', 'date_add', 'created_at')

### Función: get_product_by_sku

**Descripción enviada a OpenAI:**
```
Obtiene un producto específico por su SKU. IMPORTANTE: Usa esta función cuando el usuario proporcione un SKU específico. Si no encuentras el producto con ese SKU exacto, informa al usuario que ese SKU no existe en lugar de afirmar que sí lo tienes.
```

**Parámetros disponibles:**
- `sku` (string, **requerido**): SKU del producto (código único). Puede ser exacto o parcial.

---

## 3. CONTEXTO ENRIQUECIDO (añadido dinámicamente)

**Ubicación:** `api/chat.ts` líneas 263-282

Este contexto se añade automáticamente al system prompt cuando hay resultados de búsqueda.

### Si hay múltiples productos:
```
⚠️ IMPORTANTE: Has encontrado múltiples productos. NO asumas cuál es el correcto. Debes:
1. Listar todos los productos encontrados con sus nombres completos
2. Preguntar al usuario cuál de estos productos es el que busca
3. NO afirmes que tienes un producto específico sin confirmar primero
```

### Si hay un solo producto pero no coincide exactamente:
```
⚠️ IMPORTANTE: El producto encontrado no coincide exactamente con la búsqueda. Debes preguntar al usuario si este es el producto que busca antes de confirmar.
```

---

## 4. CONFIGURACIÓN DE OPENAI

**Ubicación:** `api/chat.ts` líneas 169-172

```typescript
{
  model: config.model || 'gpt-3.5-turbo',
  temperature: config.temperature !== undefined ? config.temperature : 0.7,
  max_tokens: config.max_tokens || 1500,
  tool_choice: 'auto' // OpenAI decide si usar funciones o no
}
```

**Configurable desde:** Dashboard → Pestaña "Chat" → Sección "Configuración"

---

## 5. MENSAJES ENVIADOS A OPENAI

**Estructura:**
```javascript
[
  { role: 'system', content: systemPrompt + enrichedContext },
  ...limitedHistory, // Últimos 10 mensajes (sin system messages)
  { role: 'user', content: message }
]
```

**Historial limitado:** Solo los últimos 10 mensajes para optimizar tokens.

---

## 📝 CÓMO MODIFICAR LAS INSTRUCCIONES

### Para cambiar el System Prompt:
1. Ve al Dashboard
2. Pestaña "Configuración AI"
3. Edita el prompt activo
4. Guarda y activa

### Para cambiar las descripciones de funciones:
1. Edita el archivo `api/chat.ts`
2. Modifica las descripciones en el array `functions` (líneas ~112-148)
3. Haz commit y deploy

### Para cambiar el contexto enriquecido:
1. Edita el archivo `api/chat.ts`
2. Modifica la sección donde se construye `enrichedContext` (líneas ~267-281)
3. Haz commit y deploy

### Para cambiar la configuración por defecto:
1. Edita el archivo `src/services/chatService.ts`
2. Modifica `DEFAULT_CHAT_CONFIG` (líneas ~43-50)
3. Haz commit y deploy


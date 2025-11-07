# 📚 Documentación Completa: Lógica del Sistema de Chat

**Última actualización:** 2024-12-19  
**Archivo principal:** `api/chat.ts`

Este documento explica en detalle toda la lógica, flujo y procesos que sigue el sistema de chat desde que recibe una pregunta del usuario hasta que genera una respuesta.

---

## 📋 Tabla de Contenidos

1. [Flujo General del Proceso](#flujo-general-del-proceso)
2. [Detección y Preprocesamiento](#detección-y-preprocesamiento)
3. [Sistema de Búsqueda de Productos](#sistema-de-búsqueda-de-productos)
4. [Generación de Respuestas](#generación-de-respuestas)
5. [Funciones Disponibles](#funciones-disponibles)
6. [Mejoras y Optimizaciones](#mejoras-y-optimizaciones)
7. [Historial de Cambios](#historial-de-cambios)

---

## 🔄 Flujo General del Proceso

### Diagrama de Flujo

```
Usuario envía mensaje
    ↓
[1] Validación de entrada
    ↓
[2] Cargar prompt del sistema desde Supabase
    ↓
[3] Detectar si es pregunta sobre productos
    ↓
[4] Preparar mensajes para OpenAI
    ↓
[5] Llamar a OpenAI (primera vez)
    ↓
[6] ¿OpenAI llamó a una función?
    ├─ SÍ → [7] Ejecutar función
    │         ↓
    │      [8] Preparar contexto enriquecido
    │         ↓
    │      [9] Llamar a OpenAI (segunda vez)
    │         ↓
    │      [10] Generar respuesta final
    │
    └─ NO → [11] Respuesta directa
    ↓
[12] Guardar en analytics
    ↓
[13] Devolver respuesta al usuario
```

---

## 1️⃣ Validación de Entrada

**Ubicación:** Líneas 88-94

### Proceso:

1. **Verificar método HTTP**: Solo acepta POST
2. **Verificar variables de entorno**:
   - `OPENAI_API_KEY` (obligatorio)
   - `SUPABASE_URL` (obligatorio)
   - `SUPABASE_ANON_KEY` (obligatorio)
3. **Validar mensaje del usuario**:
   - Debe existir
   - Debe ser string
   - No puede estar vacío

### Código:
```typescript
if (!message || typeof message !== 'string') {
  res.status(400).json({
    error: 'Missing or invalid message',
    details: 'The message field is required and must be a string'
  });
  return;
}
```

---

## 2️⃣ Cargar Prompt del Sistema

**Ubicación:** Líneas 96-116

### Proceso:

1. **Consultar Supabase**: Buscar prompts activos en la tabla `system_prompts`
2. **Filtrar**: Solo prompts con `is_active = true`
3. **Procesar variables**: Reemplazar variables dinámicas en el prompt
   - Formato: `{{variable_name}}`
   - Se reemplazan con valores de `prompt_variables`

### Función `processPrompt()`:
```typescript
function processPrompt(prompt: any): string {
  let processedPrompt = prompt.prompt;
  
  if (prompt.prompt_variables && prompt.prompt_variables.length > 0) {
    prompt.prompt_variables.forEach((variable: any) => {
      const regex = new RegExp(`\\{\\{${variable.variable_name}\\}\\}`, 'g');
      processedPrompt = processedPrompt.replace(regex, variable.variable_value || '');
    });
  }
  
  return processedPrompt;
}
```

### Si no hay prompt activo:
- Retorna error 500
- Mensaje: "Please activate a prompt in the Configuration AI section"

---

## 3️⃣ Detección y Preprocesamiento

### 3.1 Detectar si es Pregunta sobre Productos

**Ubicación:** Líneas 389-390, Función: `detectProductQuery()` (líneas 1067-1110)

#### Proceso:

1. **Palabras clave detectadas**:
   - Verbos: "tienes", "tiene", "busca", "buscar", "hay", "existe"
   - Sustantivos: "producto", "productos", "artículo", "artículos"
   - Acciones: "muestra", "muéstrame", "encuentra"
   - Específicos: "pajitas", "cartón", "precio", "cuánto cuesta"

2. **Patrones regex**:
   - `/tienes\s+\w+/i` → "tienes X"
   - `/productos?\s+de\s+\w+/i` → "productos de X"
   - `/hay\s+\w+/i` → "hay X"
   - Y más...

3. **Resultado**:
   - `true`: Es pregunta sobre productos → **Forzar búsqueda**
   - `false`: Pregunta general → Respuesta directa

#### Ejemplo:
```typescript
"¿Tienes pajitas de cartón?" → detectProductQuery() → true
"¿Cómo funciona esto?" → detectProductQuery() → false
```

### 3.2 Extraer Término de Búsqueda

**Ubicación:** Función: `extractSearchTermFromMessage()` (líneas 1112-1160)

#### Proceso:

1. **Aplicar patrones regex** para extraer el término:
   ```typescript
   /tienes\s+(.+?)(?:\?|$)/i → "tienes pajitas de cartón?" → "pajitas de cartón"
   /productos?\s+de\s+(.+?)(?:\?|$)/i → "productos de cocina?" → "cocina"
   ```

2. **Limpiar el término**:
   - Eliminar signos de interrogación: `?`, `¿`
   - Eliminar signos de puntuación al final
   - Trim espacios

3. **Fallback**: Si no coincide con patrones:
   - Filtrar palabras comunes ("tienes", "busca", etc.)
   - Devolver palabras relevantes restantes

#### Ejemplo:
```typescript
"¿Tienes pajitas de cartón?" → extractSearchTermFromMessage() → "pajitas de cartón"
"Busca productos de cocina" → extractSearchTermFromMessage() → "cocina"
```

### 3.3 Detectar Intención del Usuario

**Ubicación:** Función: `detectUserIntent()` (líneas 1162-1202)

#### Tipos de intención:

1. **`buy`** (comprar) - Urgencia: `high`
   - Palabras: "comprar", "precio", "cuánto cuesta", "disponible", "stock"
   
2. **`compare`** (comparar) - Urgencia: `medium`
   - Palabras: "comparar", "diferencia", "cuál es mejor", "vs", "versus"
   
3. **`info`** (información) - Urgencia: `low`
   - Palabras: "qué es", "para qué sirve", "cómo funciona", "características"
   
4. **`search`** (búsqueda) - Urgencia: `medium` (default)

#### Uso:
La intención se usa para personalizar las instrucciones que se dan a OpenAI en el contexto enriquecido.

---

## 4️⃣ Preparar Mensajes para OpenAI

**Ubicación:** Líneas 392-403

### Proceso:

1. **System Prompt**:
   - Prompt base desde Supabase (procesado)
   - Si es pregunta sobre productos: Añadir instrucción adicional
     ```
     ⚠️ ATENCIÓN: El usuario está preguntando sobre productos. 
     DEBES usar la función search_products ANTES de responder.
     ```

2. **Historial de conversación**:
   - Limitar a últimos 10 mensajes (para evitar exceder tokens)
   - Formato: Array de objetos `{ role: 'user'|'assistant', content: string }`

3. **Mensaje actual del usuario**:
   - Si se detecta **categoría** (`Pastelería`, `Chocolate`, etc.):
     ```
     [IMPORTANTE: El usuario pregunta sobre "Pastelería". DEBES usar
     search_products_by_category con category="Pastelería" y query="maquina refinar" ]
     ```
     Además, el bot forzará la llamada a `search_products_by_category` con la categoría detectada y un término de búsqueda limpio (sin stopwords como "soy", "busco", etc.).
   - Si no hay categoría: añadir contexto para `search_products` con la query extraída.

### Estructura final:
```typescript
[
  { role: 'system', content: enhancedSystemPrompt },
  ...limitedHistory,  // Últimos 10 mensajes
  { role: 'user', content: messageWithContext }
]
```

---

## 5️⃣ Primera Llamada a OpenAI

**Ubicación:** Líneas 410-444

### Configuración:

- **Modelo**: `gpt-3.5-turbo` (por defecto) o el configurado
- **Temperature**: 0.7 (por defecto)
- **Max tokens**: 1500 (por defecto)
- **Timeout**: 25 segundos

### Tool Choice (Forzar función):

```typescript
if (detectedCategory) {
  tool_choice = {
    type: 'function',
    function: {
      name: 'search_products_by_category',
      arguments: JSON.stringify({ category: 'Pastelería', query: 'maquina refinar' })
    }
  };
} else if (isProductQuery) {
  tool_choice = {
    type: 'function',
    function: { name: 'search_products' }
  };
} else {
  tool_choice = 'auto';
}
```

### Funciones disponibles:
- `search_products` (obligatoria para preguntas sobre productos)
- `get_product_by_sku`
- `get_similar_products`
- `get_product_recommendations`
- `compare_products`
- `search_products_by_category`
- `get_product_categories`
- `clarify_search_intent`
- `get_products_by_price_range`
- `get_product_specifications`
- `get_popular_products`
- `search_web_content`

### Validación de respuesta:
- Verificar que `completion.choices[0].message` existe
- Si no: Error 500

---

## 6️⃣ Ejecutar Función (si OpenAI la llamó)

**Ubicación:** Líneas 446-512

### Proceso:

1. **Extraer información de la llamada**:
   ```typescript
   const functionName = toolCall.function.name;
   const functionArgs = JSON.parse(toolCall.function.arguments);
   ```

2. **Ejecutar función correspondiente**:
   ```typescript
   switch (functionName) {
     case 'search_products':
       functionResult = await searchProducts(supabase, functionArgs);
       break;
     case 'get_product_by_sku':
       functionResult = await getProductBySku(supabase, functionArgs);
       break;
     // ... más casos
   }
   ```

3. **Manejo de errores**:
   - Si función no existe: Error 500
   - Si hay error en ejecución: Lanzar excepción

---

## 7️⃣ Sistema de Búsqueda de Productos

**Ubicación:** Función: `searchProducts()` (líneas 1272-1446)

### 7.1 Construcción de la Consulta SQL

#### Paso 1: Consulta base
```typescript
let query = supabase
  .from('products')
  .select('id, name, price, category, subcategory, sku, description, image_url, product_url, date_add', { count: 'exact' });
```

#### Paso 2: Procesar término de búsqueda

**Si hay `params.query`**:

1. **Dividir en palabras**:
   ```typescript
   const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
   // "pajitas de cartón" → ["pajitas", "de", "cartón"]
   ```

2. **Generar variaciones de cada palabra**:
   ```typescript
   generateWordVariations("cierre") → ["cierre", "cierra", "cerrar"]
   generateWordVariations("cartón") → ["cartón", "carton"]
   ```

3. **Crear condiciones de búsqueda**:
   - Para cada variación, buscar en: `name`, `description`, `sku`
   - Formato: `name.ilike.%variation%`
   - También buscar frase completa: `name.ilike.%pajitas de cartón%`

4. **Aplicar condiciones con OR**:
   ```typescript
   query = query.or(conditions.join(','));
   ```

#### Paso 3: Filtros adicionales

- **Categoría**: `query.ilike('category', '%categoria%')`
- **Subcategoría**: `query.ilike('subcategoría', '%subcategoria%')`
- **Ordenamiento**: Por `date_add`, `created_at`, `name`, o precio

#### Paso 4: Límites

```typescript
const baseLimit = params.limit || 15;
const maxLimit = 50;
const hasMultipleWords = words.length > 1;
const limit = hasMultipleWords ? baseLimit * 3 : baseLimit; // Hasta 45 para múltiples palabras
query = query.limit(limit);
```

### 7.2 Filtrado en Memoria (Post-procesamiento)

**Ubicación:** Líneas 1365-1424

#### Proceso:

1. **Si hay múltiples palabras**:

   a. **Filtrar palabras relevantes**:
      ```typescript
      const relevantWords = words.filter(w => 
        w.length > 2 && 
        !['de', 'la', 'el', 'los', 'las', 'un', 'una', 'del', 'con', 'por', 'para'].includes(w.toLowerCase())
      );
      // "pajitas de cartón" → ["pajitas", "cartón"] (elimina "de")
      ```

   b. **Calcular mínimo requerido**:
      ```typescript
      const optionalWords = new Set(['hacer','elaborar','preparar','crear','busco','buscar','necesito']);
      const requiredWords = relevantWords.filter(word => !optionalWords.has(normalizeText(word)));
      const minWordsRequired = requiredWords.length > 0
        ? Math.max(1, Math.min(requiredWords.length, Math.ceil(requiredWords.length * 0.6)))
        : Math.max(1, Math.ceil(relevantWords.length * 0.6));
      ```

   c. **Filtrar productos**:
      - Combinar todos los campos de texto del producto
      - Normalizar texto (eliminar acentos, minúsculas)
      - Contar cuántas palabras relevantes aparecen
      - **Incluir si**:
        - La frase completa aparece, O
        - Coinciden al menos `minWordsRequired` palabras **requeridas**
        - Si todas las palabras eran opcionales basta con que alguna coincida

   d. **Fallback inteligente**:
      - Si después del filtrado no queda ningún producto pero la consulta original sí devolvió resultados SQL → se usa la lista original (sin filtrar) para no perder coincidencias parciales

2. **Si solo hay una palabra relevante**:
   - No filtrar estrictamente
   - Dejar que el scoring de relevancia ordene

3. **Respuestas aceleradas**:
   - Si el resultado es **un único producto** con score ≥220 → se usa `buildQuickResponse`, evitando la segunda llamada a OpenAI (respuesta en ~1-1.5s).
   - Si hay **1-5 productos** → se usa `buildStructuredResponse` para generar una respuesta enumerada (🏆 recomendado + alternativas) directamente en el backend.
   - Solo se invoca una segunda llamada a OpenAI cuando hay muchos productos, comparaciones o contextos complejos.

### 7.3 Scoring de Relevancia

**Ubicación:** Función: `calculateRelevanceScore()` (líneas 1142-1178)

#### Algoritmo:

```typescript
let score = 0;

// Coincidencia exacta en nombre (máximo peso)
if (productName === normalizedSearch) {
  score += 200;
} else if (productName.includes(normalizedSearch)) {
  score += 100;
  // Bonus si está al inicio
  if (index < 5) score += 50;
}

// Coincidencia de palabras individuales
searchWords.forEach(word => {
  if (productName.includes(word)) score += 30;
  if (description.includes(word)) score += 10;
  if (category.includes(word)) score += 20;
});

// Coincidencia en SKU
if (sku.includes(normalizedSearch)) {
  score += 40;
}

return score;
```

#### Ordenamiento:
- Productos con mayor score primero
- Si mismo score, mantener orden original

### 7.4 Normalización de Texto

**Ubicación:** Función: `normalizeText()` (líneas 1054-1065)

```typescript
function normalizeText(text: string): string {
  return text
    .toLowerCase()           // "Cartón" → "cartón"
    .normalize('NFD')         // Descomponer acentos
    .replace(/[\u0300-\u036f]/g, '')  // Eliminar acentos → "carton"
    .trim();
}
```

**Propósito**: Permitir búsquedas sin importar acentos o mayúsculas.

---

## 8️⃣ Preparar Contexto Enriquecido

**Ubicación:** Líneas 514-612

### Proceso:

1. **Detectar intención del usuario**:
   ```typescript
   const userIntent = detectUserIntent(message);
   ```

2. **Construir instrucciones críticas**:
   ```
   📋 INSTRUCCIONES CRÍTICAS PARA RESPONDER:
   1. SIEMPRE presenta productos con esta estructura clara y profesional:
      - **Nombre completo del producto** (en negrita)
      - 💰 Precio: [precio] (SIEMPRE lo mencionas si está disponible)
      - 📦 Categoría: [categoría] (si está disponible)
      - 📝 Descripción breve (1-2 líneas destacando características principales)
      - 🔗 [Ver producto](URL) (si está disponible)
   
   2. Cuando haya múltiples productos:
      - Lista los TOP 3-5 más relevantes (ya están ordenados por relevancia)
      - Usa formato de lista numerada (1., 2., 3.) o con viñetas (•)
      - Incluye precio y link para cada uno
      ...
   ```

3. **Añadir instrucciones según intención**:
   - **`buy`**: Destacar precio, disponibilidad, facilitar compra
   - **`compare`**: Formato comparativo, destacar diferencias
   - **`info`**: Descripciones más detalladas, características técnicas

4. **Instrucciones según resultados**:
   - **Múltiples productos**: "Presenta los más relevantes primero"
   - **Un producto**: "Preséntalo con todos sus detalles"
   - **Sin resultados**: "Sugiere términos alternativos o pregunta por más detalles"

5. **Formatear productos encontrados**:
   ```typescript
   enrichedContext += formatProductsForPrompt(functionResult.products, 5);
   ```

### Función `formatProductsForPrompt()`:

**Ubicación:** Líneas 1080-1114

```typescript
function formatProductsForPrompt(products: any[], limit: number = 5): string {
  const limited = products.slice(0, limit);
  const formatted = limited.map((p, i) => {
    return `**${p.name}**
💰 Precio: ${p.price || 'No disponible'}
📦 Categoría: ${p.category || 'N/A'}
🏷️ SKU: ${p.sku || 'N/A'}
📝 ${descriptionPreview}
🔗 URL: ${p.product_url || 'N/A'}`;
  }).join('\n\n---\n\n');
  
  return formatted;
}
```

### Generar Sugerencias (si no hay resultados):

**Ubicación:** Líneas 590-600, Función: `generateSearchSuggestions()` (líneas 1184-1240)

#### Proceso:

1. **Generar variaciones de palabras**:
   ```typescript
   "pajitas" → ["pajita", "pajitas", ...]
   ```

2. **Buscar categorías similares**:
   - Consultar categorías en base de datos
   - Buscar coincidencias con términos de búsqueda

3. **Crear búsquedas más amplias**:
   - Remover palabras una por una
   - "pajitas de cartón" → "pajitas", "cartón"

4. **Devolver top 5 sugerencias**

---

## 9️⃣ Segunda Llamada a OpenAI

**Ubicación:** Líneas 617-749

### Proceso:

1. **Preparar mensajes con contexto**:
   ```typescript
   const messagesWithContext = [
     { role: 'system', content: systemPromptWithContext },
     ...limitedHistory,
     { role: 'user', content: message },
     responseMessage,  // Respuesta de OpenAI con tool_call
     {
       role: 'tool',
       tool_call_id: toolCall.id,
       content: JSON.stringify(functionResult)
     }
   ];
   ```

2. **Limitar tamaño de resultados**:
   - Máximo 10 productos en el resultado
   - Si hay más, crear resumen

3. **Llamar a OpenAI**:
   - Mismo modelo y configuración
   - Timeout: 30 segundos

4. **Validar respuesta**:
   - Verificar que `completion.choices[0].message.content` existe
   - Si está vacío: Usar fallback

### Fallback si OpenAI falla:

```typescript
if (functionResult.products && functionResult.products.length > 0) {
  const productNames = functionResult.products.slice(0, 5).map(p => p.name).join(', ');
  const fallbackMessage = `Encontré ${functionResult.products.length} producto(s): ${productNames}...`;
  // Devolver respuesta de fallback
}
```

---

## 🔟 Generación de Respuesta Final

**Ubicación:** Líneas 787-873

### Proceso:

1. **Extraer mensaje final**:
   ```typescript
   const finalMessage = secondCompletion.choices[0].message?.content || '';
   ```

2. **Determinar fuentes de información**:
   ```typescript
   const sources: string[] = [];
   if (productFunctions.includes(functionName)) {
     sources.push('products_db');
   } else if (functionName === 'search_web_content') {
     sources.push('web');
   }
   ```

3. **Preparar mensaje del asistente**:
   ```typescript
   const assistantMessage = {
     role: 'assistant',
     content: finalMessage,
     function_calls: [toolCall],
     sources: sources
   };
   ```

4. **Guardar en analytics**:
   ```typescript
   await saveConversationToAnalytics(
     supabase,
     sessionId,
     message,
     finalMessage,
     functionName,
     productsConsulted,
     categoryConsulted,
     model,
     responseTimeMs
   );
   ```

5. **Devolver respuesta**:
   ```typescript
   res.status(200).json({
     success: true,
     message: finalMessage,
     function_called: functionName,
     function_result: functionResult,
     conversation_id: conversationId,
     conversation_history: [...]
   });
   ```

---

## 1️⃣1️⃣ Respuesta Directa (sin función)

**Ubicación:** Líneas 874-909

### Cuándo ocurre:

- OpenAI no llamó a ninguna función
- El mensaje no es sobre productos
- Es una pregunta general

### Proceso:

1. **Extraer respuesta directa**:
   ```typescript
   const response = responseMessage.content || '';
   ```

2. **Guardar en analytics** (sin función ni productos)

3. **Devolver respuesta**:
   ```typescript
   res.status(200).json({
     success: true,
     message: response,
     conversation_history: [...]
   });
   ```

---

## 📊 Funciones Disponibles

### 1. `search_products`

**Descripción:** Búsqueda principal de productos (OBLIGATORIA para preguntas sobre productos)

**Parámetros:**
- `query` (string): Término de búsqueda
- `category` (string): Filtrar por categoría
- `subcategory` (string): Filtrar por subcategoría
- `limit` (number): Máximo de resultados (default: 15)
- `offset` (number): Paginación
- `sort_by` (string): Ordenamiento

**Retorna:**
```typescript
{
  products: Product[],
  total: number,
  limit: number,
  offset: number
}
```

### 2. `get_product_by_sku`

**Descripción:** Obtener producto específico por SKU

**Parámetros:**
- `sku` (string, requerido): SKU del producto

**Retorna:**
```typescript
{
  product: Product | null,
  found: boolean
}
```

### 3. `get_similar_products`

**Descripción:** Obtener productos similares a uno de referencia

**Parámetros:**
- `product_id` (string): ID del producto
- `product_name` (string): Nombre del producto
- `limit` (number): Máximo de resultados (default: 5)

### 4. `get_product_recommendations`

**Descripción:** Recomendaciones basadas en caso de uso

**Parámetros:**
- `use_case` (string, requerido): Para qué se necesita
- `category` (string): Filtrar por categoría
- `budget_range` (string): "bajo", "medio", "alto"
- `limit` (number): Máximo de resultados

### 5. `compare_products`

**Descripción:** Comparar múltiples productos

**Parámetros:**
- `product_names` (string[]): Nombres de productos
- `product_ids` (string[]): IDs de productos

### 6. `search_products_by_category`

**Descripción:** Búsqueda filtrada por categoría

**Parámetros:**
- `category` (string, requerido): Categoría
- `query` (string): Búsqueda adicional
- `limit` (number): Máximo de resultados

### 7. `get_product_categories`

**Descripción:** Obtener todas las categorías disponibles

**Parámetros:**
- `include_subcategories` (boolean): Incluir subcategorías

### 8. `clarify_search_intent`

**Descripción:** Aclarar intención y sugerir términos alternativos

**Parámetros:**
- `original_query` (string, requerido): Término original
- `failed_search` (boolean): Si la búsqueda falló

### 9. `get_products_by_price_range`

**Descripción:** Buscar por rango de precios

**Parámetros:**
- `min_price` (number): Precio mínimo
- `max_price` (number): Precio máximo
- `category` (string): Filtrar por categoría
- `query` (string): Búsqueda adicional

### 10. `get_product_specifications`

**Descripción:** Obtener especificaciones técnicas

**Parámetros:**
- `product_id` (string): ID del producto
- `product_name` (string): Nombre del producto

### 11. `get_popular_products`

**Descripción:** Obtener productos populares/recientes

**Parámetros:**
- `category` (string): Filtrar por categoría
- `limit` (number): Máximo de resultados

### 12. `search_web_content`

**Descripción:** Buscar en contenido web indexado

**Parámetros:**
- `query` (string, requerido): Término de búsqueda
- `product_id` (string): ID del producto (opcional)
- `limit` (number): Máximo de resultados

---

## 🚀 Mejoras y Optimizaciones

### 1. Detección Automática de Preguntas sobre Productos

**Implementado:** 2024-12-19

- Detecta automáticamente cuando el usuario pregunta sobre productos
- Fuerza el uso de `search_products` para evitar respuestas sin búsqueda
- Extrae automáticamente el término de búsqueda del mensaje

### 2. Búsqueda Flexible con Variaciones

**Implementado:** 2024-12-19

- Genera variaciones de palabras automáticamente
- Maneja acentos correctamente ("cartón" = "carton")
- Busca frase completa además de palabras individuales

### 3. Filtrado Inteligente

**Implementado:** 2024-12-19

- Ignora artículos y preposiciones ("de", "la", "el")
- Requiere solo 70% de palabras relevantes (no 100%)
- Incluye productos si la frase completa aparece

### 4. Scoring de Relevancia

**Implementado:** 2024-12-19

- Ordena productos por relevancia
- Prioriza coincidencias exactas en nombre
- Considera posición de coincidencia

### 5. Detección de Intención

**Implementado:** 2024-12-19

- Detecta si el usuario quiere comprar, comparar o informarse
- Personaliza instrucciones según intención

### 6. Sugerencias Automáticas

**Implementado:** 2024-12-19

- Genera sugerencias cuando no hay resultados
- Busca categorías similares
- Crea variaciones de búsqueda

### 7. Formateo Mejorado de Productos

**Implementado:** 2024-12-19

- Formato estructurado con emojis
- Información clara y organizada
- Limita descripciones a 200 caracteres

---

## 📝 Historial de Cambios

### 2024-12-19 - Mejoras en Búsqueda y Detección

**Cambios:**
- ✅ Añadida detección automática de preguntas sobre productos
- ✅ Implementado forzado de búsqueda cuando se detecta pregunta sobre productos
- ✅ Mejorado filtrado en memoria (70% de palabras en lugar de 100%)
- ✅ Añadida búsqueda de frase completa
- ✅ Mejorado manejo de acentos y variaciones
- ✅ Aumentado límite de búsqueda para múltiples palabras (hasta 50)
- ✅ Añadida función de extracción de término de búsqueda
- ✅ Implementada detección de intención del usuario
- ✅ Añadidas sugerencias automáticas cuando no hay resultados
- ✅ Mejorado formateo de productos para OpenAI

**Archivos modificados:**
- `api/chat.ts`

**Funciones nuevas:**
- `detectProductQuery()`: Detecta si es pregunta sobre productos
- `extractSearchTermFromMessage()`: Extrae término de búsqueda
- `detectUserIntent()`: Detecta intención del usuario
- `generateSearchSuggestions()`: Genera sugerencias de búsqueda

**Funciones mejoradas:**
- `searchProducts()`: Búsqueda más flexible
- `formatProductsForPrompt()`: Formato mejorado
- `calculateRelevanceScore()`: Scoring más preciso

---

## 🔍 Debugging y Logging

### Puntos de logging importantes:

1. **Request recibida** (línea 81):
   ```typescript
   console.log('[Chat API] Request recibida:', {
     hasMessage: !!message,
     messageLength: message?.length || 0,
     sessionId: sessionId || 'NO ENVIADO',
     conversationHistoryLength: conversationHistory?.length || 0
   });
   ```

2. **Función ejecutada** (línea 627):
   ```typescript
   console.log(`Function ${functionName} executed successfully. Result size:`, 
     JSON.stringify(functionResult).length, 'bytes');
   ```

3. **Analytics** (línea 1916):
   ```typescript
   console.log('[Analytics] Intentando guardar conversación:', {...});
   ```

---

## ⚠️ Manejo de Errores

### Errores comunes y soluciones:

1. **OpenAI no responde**:
   - Timeout de 25s (primera llamada) y 30s (segunda)
   - Fallback con mensaje básico si hay productos

2. **No hay prompt activo**:
   - Error 500 con mensaje claro
   - Instrucción para activar prompt en configuración

3. **Función no implementada**:
   - Error 500 con nombre de función

4. **Respuesta vacía de OpenAI**:
   - Usa fallback con nombres de productos encontrados

---

## 📚 Referencias

- **Archivo principal**: `api/chat.ts`
- **Documentación de mejoras**: `MEJORAS-RESPUESTAS-CHAT.md`
- **Propuesta completa**: `PROPUESTA-MEJORA-OPENAI.md`
- **Schema de Supabase**: `supabase-schema.sql`

---

**Nota:** Este documento debe actualizarse cada vez que se modifique la lógica del chat. Añadir cambios en la sección "Historial de Cambios" con fecha y descripción detallada.


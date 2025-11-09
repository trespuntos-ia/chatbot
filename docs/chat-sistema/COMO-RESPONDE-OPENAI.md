# 📝 Documentación: Cómo Responde OpenAI en el Sistema de Chat

**Última actualización:** 2025-11-07  
**Archivo principal:** `api/chat.ts`

> **Estado general:** Todo lo descrito aquí está **implementado** en el flujo actual del backend. Cualquier idea futura se marcará explícitamente como "Pendiente" hasta que se entregue.

Este documento explica específicamente cómo OpenAI genera las respuestas, qué instrucciones recibe, y qué se aplica al formato de la respuesta final.

---

## 📋 Tabla de Contenidos

1. [Flujo de Generación de Respuesta](#flujo-de-generación-de-respuesta)
2. [Instrucciones del System Prompt](#instrucciones-del-system-prompt)
3. [Contexto Enriquecido para OpenAI](#contexto-enriquecido-para-openai)
4. [Instrucciones Específicas por Tipo de Función](#instrucciones-específicas-por-tipo-de-función)
5. [Formato de Respuesta Esperado](#formato-de-respuesta-esperado)
6. [Casos Especiales](#casos-especiales)
7. [Manejo de Fallbacks](#manejo-de-fallbacks)

---

## 🔄 Flujo de Generación de Respuesta

**Estado:** Implementado (coordinado principalmente en `api/chat.ts`).

**Explicación sencilla:** Primero entendemos qué necesita la persona, luego pedimos datos reales (productos, comparaciones, etc.) y, con toda esa información, OpenAI responde siguiendo un guion fijo.

### Proceso Completo

```
1. Usuario envía mensaje
   ↓
2. Sistema detecta intención y tipo de búsqueda
   ↓
3. Primera llamada a OpenAI:
   - Prompt base cargado desde Supabase
   - Instrucciones extra según el tipo de consulta
   - Mensaje del usuario y, si procede, parte del historial
   ↓
4. OpenAI decide llamar a función (ej: search_products)
   ↓
5. Sistema ejecuta función y obtiene resultados
   ↓
6. Sistema prepara CONTEXTO ENRIQUECIDO:
   - Instrucciones CRÍTICAS sobre cómo responder
   - Productos encontrados (formateados)
   - Instrucciones según intención del usuario
   - Instrucciones según número de resultados
   ↓
7. Según el caso:
   - **Respuesta rápida/estructurada** (sin segunda llamada) cuando los resultados son muy precisos
   - **Segunda llamada a OpenAI** con el contexto enriquecido y el resultado de la función
   ↓
8. OpenAI (o el backend) genera la respuesta final y el sistema la devuelve formateada
```

> **Nota:** solo se envían los dos últimos mensajes relevantes del historial cuando el mensaje actual parece ser una continuación (`más barato`, `ese`, `otra opción`, etc.). Esto reduce tokens sin perder contexto útil.

---

## 🎯 Instrucciones del System Prompt

**Estado:** Implementado. Las reglas se generan cada vez antes de llamar al modelo.

**Resumen en lenguaje claro:** El prompt base define cómo debe comportarse el asistente y, dependiendo de lo que el usuario pregunte, añadimos instrucciones adicionales que le obligan a buscar datos reales antes de responder.

### Prompt Base (desde Supabase)

- **Estado:** Implementado.
- **Qué hace:** Carga el prompt activo desde la tabla `system_prompts` y rellena variables con `processPrompt()`.
- **Referencia:** Bloque inicial de `api/chat.ts` (≈ línea 90).

### Instrucciones Adicionales según Tipo de Consulta

#### 1. Para Preguntas sobre Productos (NO comparación)
- **Estado:** Implementado.
- **Referencia:** Detección de intención y ajuste del prompt (≈ líneas 390-450).

```typescript
if (isProductQuery && !isComparisonQuery) {
  if (detectedCategory) {
    enhancedSystemPrompt += `
⚠️ ATENCIÓN: El usuario está preguntando sobre productos en la categoría "${detectedCategory}". 
DEBES usar la función search_products_by_category con category="${detectedCategory}" ANTES de responder. 
También puedes usar search_products con query para buscar términos específicos dentro de esa categoría. 
NO respondas directamente sin buscar en la base de datos.`;
  } else {
    enhancedSystemPrompt += `
⚠️ ATENCIÓN: El usuario está preguntando sobre productos. 
DEBES usar la función search_products ANTES de responder. 
NO respondas directamente sin buscar en la base de datos.`;
  }
}
```

#### 2. Para Preguntas de Comparación
- **Estado:** Implementado.
- **Referencia:** Mismo bloque de detección (≈ líneas 390-450).

```typescript
if (isComparisonQuery) {
  enhancedSystemPrompt += `
⚠️ ATENCIÓN: El usuario quiere COMPARAR productos específicos. 
DEBES usar la función compare_products con los nombres de los productos mencionados. 
Extrae los nombres de los productos del mensaje y úsalos en product_names.`;
}
```

### Detección de categoría más inteligente (2025-11)

- **Qué cambia:** Antes se buscaba una palabra clave exacta; ahora combinamos puntuaciones por frases completas, coincidencias parciales y sinónimos normalizados para cada categoría (`CATEGORY_PATTERNS`).
- **Cómo funciona:** El mensaje se normaliza (acentos fuera, minúsculas), se generan *ngrams* y se evalúa cada patrón. Coincidencias en frases aportan más puntos; también se consideran variantes (`ahumar`, `ahumador`, `smoking`) y sinónimos de subcategorías.
- **Confianza:** Solo se devuelve una categoría cuando la puntuación supera un umbral; además almacenamos `matchedKeywords` para reusar el lenguaje del usuario al construir la query.
- **Integración:** El resultado se fusiona con la categoría sugerida por la comprensión semántica ligera. Si ambos coinciden, se prioriza; si difieren, se usa la opción con mayor confianza (`mergeIntentSignals`, `selectSearchTermCandidate`).
- **Referencia:** Lógica en `api/chat.ts` (≈ líneas 1180-1270 para el uso y 2430-2548 para el detector).

---

## 📝 Contexto Enriquecido para OpenAI

**Estado:** Implementado (≈ líneas 750-1050 de `api/chat.ts`).

**En palabras sencillas:** Si OpenAI llamó a alguna función, empaquetamos los resultados y añadimos instrucciones muy concretas para guiar la respuesta.

### Estructura del Contexto Enriquecido

El contexto incluye:

1. **Instrucciones críticas generales** (si no es comparación)
2. **Instrucciones específicas por intención** (buy, info, compare)
3. **Instrucciones según número de resultados**
4. **Productos encontrados formateados**
5. **Sugerencias** (si no hay resultados)

> **Optimización aplicada:** `promptReducer()` elimina líneas duplicadas y se respeta `MAX_CONTEXT_CHAR_LENGTH = 1500` caracteres antes de enviarlo al modelo.

---

## 🎨 Instrucciones Específicas por Tipo de Función

**Estado:** Implementado. Se añaden al contexto según la función elegida.

### 1. Para `compare_products` (Comparación) — **Implementado** (≈ líneas 760-820)

```
📊 INSTRUCCIONES PARA COMPARAR:

• Explica las diferencias clave entre los productos (precio, uso, características técnicas).
• Ofrece un resumen inicial y luego una comparación punto por punto.
• Cierra con una recomendación clara de cuándo elegir cada opción.
• Evita repetir especificaciones sin contexto; interpreta qué implican para el usuario.
```

### 2. Para Otras Funciones (search_products, etc.) — **Implementado** (≈ líneas 820-870)

```
📋 INSTRUCCIONES PRINCIPALES:

• Usa la estructura fija: Nombre en negrita, Precio, Categoría (si aplica), Descripción corta (1 frase) y Enlace.
• Ordena la respuesta en bloques: 🏆 RECOMENDADO (1 producto), 🔁 ALTERNATIVAS (siguientes 2), 💡 PUEDE INTERESARTE (resto en resumen).
• Presenta siempre el precio disponible y abre con “He encontrado X productos relacionados con [término]”.
• Si el producto no coincide exactamente, ofrece alternativas dentro de la misma categoría.
```

---

## 🎯 Instrucciones según Intención del Usuario

**Estado:** Implementado. `detectUserIntent()` devuelve `buy`, `info`, `compare` o `search` y aplica estos textos.

### Intención: `buy` (Comprar) — **Implementado** (≈ líneas 830-880)

```
⚠️ INTENCIÓN DETECTADA: El usuario quiere COMPRAR
• Destaca el precio y sugiere usar el enlace para completar la compra.
```

### Intención: `info` (Información) — **Implementado** (≈ líneas 830-880)

```
⚠️ INTENCIÓN DETECTADA: El usuario busca INFORMACIÓN
• Incluye características técnicas y explica para qué sirve cada producto.
```

---

## 📊 Instrucciones según Número de Resultados

**Estado:** Implementado. Se añaden en el contexto según la cantidad de productos encontrados.

### Múltiples Productos (2+) — **Implementado** (≈ líneas 870-900)

```
⚠️ IMPORTANTE: Has encontrado múltiples productos (ya ordenados por relevancia). 
Presenta los más relevantes primero.
```

### Un Solo Producto — **Implementado** (≈ líneas 880-920)

```
✅ Has encontrado un producto específico. Preséntalo con todos sus detalles.

⚠️ Nota: El producto encontrado puede no coincidir exactamente con la búsqueda. 
Asegúrate de mencionar el nombre completo.
```

### Sin Resultados (con categoría detectada) — **Implementado** (≈ líneas 900-950)

```
⚠️ No hay coincidencias exactas en la categoría "[CATEGORÍA]". Construye una respuesta breve así:
• Empatiza y ofrece ayuda inmediata.
• Pregunta qué tipo de [categoría] necesita (material, tamaño, uso) para afinar la búsqueda.
• Propón palabras clave o subcategorías alternativas usando las sugerencias disponibles.
• Invita al usuario a dar más detalles para continuar la búsqueda.
```

### Sin Resultados (sin categoría) — **Implementado** (≈ líneas 900-980)

```
⚠️ No hay productos que coincidan exactamente con la búsqueda. Responde del siguiente modo:
• Sé empático y ofrece continuar ayudando.
• Propón nuevas palabras clave basadas en las sugerencias generadas.
• Pide más detalles para refinar la búsqueda en la categoría correcta.

Además del mensaje, el backend realiza automáticamente:

- Una solicitud a `clarifySearchIntent` para obtener hasta cinco términos alternativos.
- Búsquedas rápidas (`searchProducts`) con esas variaciones para recuperar hasta cinco productos alternativos.

Los resultados se adjuntan en el contexto como `search_suggestions` y `alternative_products`, y se mantienen visibles para el frontend.
```

---

## 📦 Formato de Productos para OpenAI

**Estado:** Implementado. La función `formatProductsForPrompt()` prepara hasta cinco productos antes de enviarlos a OpenAI.

- **Referencia:** Alrededor de las líneas 2230-2310 de `api/chat.ts`.
- **Resumen sencillo:** Siempre generamos bloques con un producto destacado, alternativas y un resumen del resto para que OpenAI solo tenga que redactarlo.

### Formato para Un Producto

```
🏆 **RECOMENDADO**

**[Nombre del Producto]**
💰 Precio: [precio]
📦 Categoría: [categoría]
🏷️ SKU: [sku]
📝 [Descripción breve - máximo 120 caracteres]
🔗 URL: [product_url]
```

### Formato para Múltiples Productos

```
🏆 **RECOMENDADO**

**[Producto 1 - más relevante]**
💰 Precio: [precio]
📦 Categoría: [categoría]
📝 [Descripción breve ≤ 120 caracteres]
🔗 URL: [product_url]


🔁 **ALTERNATIVAS**

1. **[Producto 2]**
   💰 Precio: [precio]
   📦 Categoría: [categoría]
   📝 [Descripción breve ≤ 90 caracteres]
   🔗 URL: [product_url]

2. **[Producto 3]**
   ...

💡 **OTRAS OPCIONES (resumen)**
• [Producto 4] (precio)
• [Producto 5] (precio)

(Si hay más resultados, se indica cuántos quedan disponibles)
```

---

## 🎯 Formato de Respuesta Esperado

**Estado:** Implementado. OpenAI recibe instrucciones para seguir este esquema siempre que conteste productos o comparaciones.

OpenAI debe generar respuestas siguiendo este formato:

### Ejemplo para Múltiples Productos

```
He encontrado 3 productos relacionados con [término]:

🏆 **RECOMENDADO**

**Nombre del Producto**
💰 Precio: 45,90 €
📦 Categoría: Utensilios
📝 Descripción breve del producto...
🔗 [Ver producto](URL)

🔁 **ALTERNATIVAS**

1. **Otro Producto**
   💰 Precio: 32,50 €
   📝 Descripción...
   🔗 [Ver producto](URL)

2. **Tercer Producto**
   ...
```

### Ejemplo para Comparación

```
La principal diferencia entre [Producto A] y [Producto B] es...

**Comparación detallada:**

💰 **Precio:**
- [Producto A]: 45,90 €
- [Producto B]: 32,50 €
El [Producto A] es más caro pero...

📦 **Características:**
- [Producto A] tiene X, mientras que [Producto B] tiene Y

🎯 **Recomendación:**
Si buscas X, el [Producto A] es mejor. 
Si necesitas Y, el [Producto B] es más adecuado.
```

---

## ⚠️ Casos Especiales

### 1. Respuestas sin segunda llamada — **Implementado**

Cuando la información es suficientemente precisa, el backend responde directamente sin volver a consultar a OpenAI:

- **Quick Response (`buildQuickResponse`)**: Se activa si `search_products` devuelve exactamente un producto con `relevanceScore ≥ 220` y la intención no es `compare`. El backend arma el mensaje con un único bloque destacado.
- **Structured Response (`buildStructuredResponse`)**: Se activa cuando `search_products` o `search_products_by_category` devuelven entre 1 y 5 productos (no comparación). Se generan todos los bloques (`RECOMENDADO`, `ALTERNATIVAS`, etc.) desde el backend.

Ambos caminos están implementados alrededor de las líneas 660-760 y reducen la latencia. Los mensajes se guardan en analytics con las banderas `quick_response` o `structured_response`.

### 2. Comparación con Productos Encontrados — **Implementado** (≈ líneas 760-820)

Si se encuentran 2+ productos para comparar:
```
✅ Has encontrado X productos para comparar.
IMPORTANTE: DEBES crear una comparación detallada explicando las diferencias entre estos productos.
NO solo listes los productos. Explica QUÉ los hace diferentes.
Productos a comparar: [lista de nombres]
```

Si se encuentra solo 1 producto:
```
⚠️ Solo se encontró un producto. Explica sus características y menciona que no se pudo encontrar el otro producto para comparar.
```

### 3. Producto que No Coincide Exactamente — **Implementado** (≈ líneas 880-920)

```
⚠️ Nota: El producto encontrado puede no coincidir exactamente con la búsqueda. 
Asegúrate de mencionar el nombre completo.
```

---

## 🔄 Manejo de Fallbacks

**Estado:** Implementado (≈ líneas 1100-1250). Se activa cuando la segunda llamada falla o devuelve un mensaje vacío.

### Fallback con Productos Encontrados

```typescript
if (functionResult.products && functionResult.products.length > 0) {
  const products = functionResult.products.slice(0, 5);
  const productList = products.map((p: any, i: number) => 
    `${i + 1}. **${p.name}** - ${p.price || 'Precio no disponible'}`
  ).join('\n');
  
  const fallbackMessage = `He encontrado ${functionResult.products.length} producto(s) relacionado(s) con tu búsqueda:\n\n${productList}`;
  
  if (functionResult.products.length > 5) {
    fallbackMessage += `\n\nY ${functionResult.products.length - 5} producto(s) más disponible(s).`;
  }
}
```

### Fallback para Producto Único

```typescript
if (functionResult.product && functionResult.found) {
  const p = functionResult.product;
  fallbackMessage = `He encontrado el siguiente producto:\n\n**${p.name}**\n💰 Precio: ${p.price || 'No disponible'}\n📝 ${p.description || 'Sin descripción'}\n🔗 ${p.product_url || 'URL no disponible'}`;
}
```

---

## ⏱ Seguimiento de rendimiento

- **Estado:** Implementado.
- `console.time('openai_call_1')` mide la primera llamada a la LLM.
- `console.time('openai_call_2')` mide la segunda llamada (cuando existe).

Estos logs permiten validar la mejora de latencia después de las optimizaciones.

---

## 📋 Resumen de Instrucciones que Aplican a la Respuesta

**Estado:** Implementado. Estas reglas se inyectan siempre en el contexto o en las respuestas rápidas.

### Siempre Aplican:
1. ✅ Presentar productos con estructura clara: Nombre, Precio, Categoría, Descripción, URL
2. ✅ Agrupar productos: RECOMENDADO, ALTERNATIVAS, PUEDE INTERESARTE
3. ✅ SIEMPRE mencionar precio si está disponible
4. ✅ Ser específico: "He encontrado X productos relacionados con [término]"
5. ✅ Sugerir alternativas si no se encuentra exactamente

### Según Intención:
- **buy**: Destacar precio, disponibilidad, facilitar compra
- **info**: Descripciones detalladas, características técnicas
- **compare**: Comparación detallada, diferencias, recomendaciones

### Según Número de Resultados:
- **Múltiples**: Presentar más relevantes primero
- **Uno solo**: Presentar con todos los detalles
- **Sin resultados**: Ser empático, sugerir alternativas, preguntar por más detalles

### Para Comparaciones:
- NO solo listar productos
- Explicar DIFERENCIAS
- Comparar precio, características, uso
- Dar recomendaciones según caso de uso

---

## 🔍 Ubicaciones en el Código

Las líneas cambian con frecuencia; usa estos rangos de referencia:

- **System Prompt base:** ≈ línea 90
- **Instrucciones adicionales y detección de intención:** ≈ líneas 390-450
- **Decisión de respuesta rápida/estructurada:** ≈ líneas 650-760
- **Contexto enriquecido:** ≈ líneas 750-1050
- **Fallbacks y guardado en analytics:** ≈ líneas 1100-1250
- **Formato de productos (`formatProductsForPrompt`):** ≈ líneas 2230-2310

> **Pendiente:** No hay desarrollos planificados sin implementar. Cualquier cambio futuro se documentará aquí con el estado "Pendiente" hasta que esté en producción.

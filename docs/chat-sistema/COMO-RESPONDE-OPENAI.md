# 📝 Documentación: Cómo Responde OpenAI en el Sistema de Chat

**Última actualización:** 2025-11-07  
**Archivo principal:** `api/chat.ts`

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

### Proceso Completo

```
1. Usuario envía mensaje
   ↓
2. Sistema detecta intención y tipo de búsqueda
   ↓
3. Primera llamada a OpenAI:
   - System Prompt base (desde Supabase)
   - Instrucciones adicionales según tipo de consulta
   - Mensaje del usuario con contexto extraído
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
7. Segunda llamada a OpenAI:
   - System Prompt + Contexto Enriquecido
   - Historial de conversación
   - Resultado de la función ejecutada
   ↓
8. OpenAI genera respuesta final usando TODAS las instrucciones
   ↓
9. Sistema procesa y formatea respuesta final
```

> **Nota:** solo se envían los dos últimos mensajes relevantes del historial cuando el mensaje actual parece ser una continuación (`más barato`, `ese`, `otra opción`, etc.). Esto reduce tokens sin perder contexto útil.

---

## 🎯 Instrucciones del System Prompt

### Prompt Base (desde Supabase)

El prompt base se carga desde la tabla `system_prompts` en Supabase. Este prompt define el rol y comportamiento general del asistente.

**Ubicación en código:** Líneas 96-116 de `api/chat.ts`

### Instrucciones Adicionales según Tipo de Consulta

#### 1. Para Preguntas sobre Productos (NO comparación)

**Ubicación:** Líneas 406-412

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

**Ubicación:** Líneas 403-405

```typescript
if (isComparisonQuery) {
  enhancedSystemPrompt += `
⚠️ ATENCIÓN: El usuario quiere COMPARAR productos específicos. 
DEBES usar la función compare_products con los nombres de los productos mencionados. 
Extrae los nombres de los productos del mensaje y úsalos en product_names.`;
}
```

---

## 📝 Contexto Enriquecido para OpenAI

Después de ejecutar una función, el sistema prepara un contexto enriquecido que se añade al system prompt antes de la segunda llamada a OpenAI.

**Ubicación:** Líneas 603-800 de `api/chat.ts`

### Estructura del Contexto Enriquecido

El contexto enriquecido incluye:

1. **Instrucciones críticas generales** (si no es comparación)
2. **Instrucciones específicas por intención** (buy, info, compare)
3. **Instrucciones según número de resultados**
4. **Productos encontrados formateados**
5. **Sugerencias** (si no hay resultados)

> **Optimización aplicada:** el contexto completo se reduce a un máximo de ~1500 caracteres y se limpia con `promptReducer()` para eliminar líneas duplicadas antes de la segunda llamada a OpenAI.

---

## 🎨 Instrucciones Específicas por Tipo de Función

### 1. Para `compare_products` (Comparación)

**Ubicación:** Líneas 607-625

```
📊 INSTRUCCIONES PARA COMPARAR:

• Explica las diferencias clave entre los productos (precio, uso, características técnicas).
• Ofrece un resumen inicial y luego una comparación punto por punto.
• Cierra con una recomendación clara de cuándo elegir cada opción.
• Evita repetir especificaciones sin contexto; interpreta qué implican para el usuario.
```

### 2. Para Otras Funciones (search_products, etc.)

**Ubicación:** Líneas 627-648

```
📋 INSTRUCCIONES PRINCIPALES:

• Usa la estructura fija: Nombre en negrita, Precio, Categoría (si aplica), Descripción corta (1 frase) y Enlace.
• Ordena la respuesta en bloques: 🏆 RECOMENDADO (1 producto), 🔁 ALTERNATIVAS (siguientes 2), 💡 PUEDE INTERESARTE (resto en resumen).
• Presenta siempre el precio disponible y abre con “He encontrado X productos relacionados con [término]”.
• Si el producto no coincide exactamente, ofrece alternativas dentro de la misma categoría.
```

---

## 🎯 Instrucciones según Intención del Usuario

### Intención: `buy` (Comprar)

**Ubicación:** Líneas 636-641

```
⚠️ INTENCIÓN DETECTADA: El usuario quiere COMPRAR
• Destaca el precio y sugiere usar el enlace para completar la compra.
```

### Intención: `info` (Información)

**Ubicación:** Líneas 642-647

```
⚠️ INTENCIÓN DETECTADA: El usuario busca INFORMACIÓN
• Incluye características técnicas y explica para qué sirve cada producto.
```

---

## 📊 Instrucciones según Número de Resultados

### Múltiples Productos (2+)

**Ubicación:** Líneas 664-665

```
⚠️ IMPORTANTE: Has encontrado múltiples productos (ya ordenados por relevancia). 
Presenta los más relevantes primero.
```

### Un Solo Producto

**Ubicación:** Líneas 666-676

```
✅ Has encontrado un producto específico. Preséntalo con todos sus detalles.

⚠️ Nota: El producto encontrado puede no coincidir exactamente con la búsqueda. 
Asegúrate de mencionar el nombre completo.
```

### Sin Resultados (con categoría detectada)

**Ubicación:** Líneas 685-697

```
⚠️ No hay coincidencias exactas en la categoría "[CATEGORÍA]". Construye una respuesta breve así:
• Empatiza y ofrece ayuda inmediata.
• Pregunta qué tipo de [categoría] necesita (material, tamaño, uso) para afinar la búsqueda.
• Propón palabras clave o subcategorías alternativas usando las sugerencias disponibles.
• Invita al usuario a dar más detalles para continuar la búsqueda.
```

### Sin Resultados (sin categoría)

**Ubicación:** Líneas 699-713

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

Los productos se formatean antes de enviarse a OpenAI usando la función `formatProductsForPrompt()`.

**Ubicación:** Líneas 1796-1910 de `api/chat.ts`

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

### Respuesta rápida sin segunda llamada

Cuando `search_products` devuelve un único producto con `relevanceScore ≥ 320` y la intención no es `compare`, el sistema genera una respuesta directa sin realizar la segunda llamada a OpenAI. El contenido se construye con `buildQuickResponse()` y se envía inmediatamente al frontend junto con el producto destacado.

**Ventaja:** reduce la latencia en búsquedas muy precisas y mantiene los mismos datos en analytics (se guarda como `quick_response: true`).

### 1. Comparación con Productos Encontrados

**Ubicación:** Líneas 652-663

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

### 2. Producto que No Coincide Exactamente

**Ubicación:** Líneas 670-675

```
⚠️ Nota: El producto encontrado puede no coincidir exactamente con la búsqueda. 
Asegúrate de mencionar el nombre completo.
```

---

## 🔄 Manejo de Fallbacks

Si OpenAI no genera respuesta o genera respuesta vacía, el sistema usa fallbacks.

**Ubicación:** Líneas 959-1006 de `api/chat.ts`

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

- `console.time('openai_call_1')` mide la primera llamada a la LLM.
- `console.time('openai_call_2')` mide la segunda llamada (cuando existe).

Estos logs permiten validar la mejora de latencia después de las optimizaciones.

---

## 📋 Resumen de Instrucciones que Aplican a la Respuesta

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

- **System Prompt base**: Líneas 96-116
- **Instrucciones adicionales**: Líneas 400-413
- **Contexto enriquecido**: Líneas 603-800
- **Formato de productos**: Líneas 1796-1910
- **Fallbacks**: Líneas 959-1006

---

**Nota:** Este documento debe actualizarse cada vez que se modifiquen las instrucciones que recibe OpenAI para generar respuestas.

# Solución: Sistema no encuentra productos en preguntas

## Problema Identificado

Cuando el usuario pregunta: **"el Plato Volcanic Terra - 3 uds sirve para microondas?"**

El sistema respondía: **"No encontré información sobre si el Plato Volcanic Terra - 3 uds es apto para microondas..."**

Aunque la descripción del producto SÍ contiene: **"Estas vajillas son aptas para microondas, horno, salamandra..."**

## Causa del Problema

El sistema estaba buscando productos usando **toda la pregunta** como término de búsqueda:

```typescript
// ANTES (INCORRECTO)
const normalizedSearch = message.toLowerCase().trim(); // "el plato volcanic terra - 3 uds sirve para microondas?"
const { data: exactResults } = await supabase
  .from('products')
  .select('...')
  .ilike('name', `%${normalizedSearch}%`) // Busca: "%el plato volcanic terra - 3 uds sirve para microondas?%"
```

Esto no encuentra el producto porque el nombre en la base de datos es **"Plato Volcanic Terra - 3 uds"**, no toda la pregunta.

## Solución Implementada

### 1. Extracción Inteligente del Nombre del Producto

Ahora el sistema extrae el nombre del producto de la pregunta antes de buscar:

```typescript
// Extraer nombre del producto de la pregunta
let productNameToSearch = normalizedSearch;

// Método 1: Buscar nombres con mayúsculas (ej: "Plato Volcanic Terra")
const productNameMatch = message.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/);
if (productNameMatch) {
  productNameToSearch = productNameMatch[1].toLowerCase(); // "plato volcanic terra"
}

// Método 2: Filtrar palabras comunes de preguntas
else {
  const questionWords = ['el', 'la', 'sirve', 'para', 'microondas', 'apto', ...];
  const words = normalizedSearch.split(/\s+/)
    .filter(w => w.length > 2 && !questionWords.includes(w));
  productNameToSearch = words.slice(0, 4).join(' '); // "plato volcanic terra uds"
}
```

### 2. Logging Mejorado

Se añadió logging detallado para debugging:

```typescript
console.log('[chat-rag] Extracted product name from question:', productNameToSearch);
console.log(`[chat-rag] Found product: ${p.name} (ID: ${p.id}), description length: ${p.description?.length || 0}`);
console.log(`[chat-rag] Added description for ${product.name}: ${cleanDescription.substring(0, 100)}...`);
```

### 3. Validación de Descripción

Se asegura que la descripción se incluye correctamente:

```typescript
if (product.description) {
  const cleanDescription = product.description.replace(/<[^>]*>/g, '').trim();
  if (cleanDescription.length > 0) {
    productChunk += `. ${cleanDescription}`;
    console.log(`[chat-rag] Added description for ${product.name}: ${cleanDescription.substring(0, 100)}...`);
  }
}
```

## Ejemplo de Funcionamiento

**Pregunta del usuario:**
```
"el Plato Volcanic Terra - 3 uds sirve para microondas?"
```

**Proceso:**
1. Extrae: `"plato volcanic terra"` (de las palabras con mayúsculas)
2. Busca productos con: `.ilike('name', '%plato volcanic terra%')`
3. Encuentra: `"Plato Volcanic Terra - 3 uds"`
4. Incluye la descripción completa en el contexto
5. OpenAI genera respuesta usando la descripción que dice "aptas para microondas"

**Resultado esperado:**
```
"Sí, el Plato Volcanic Terra - 3 uds es apto para microondas. 
Según la descripción del producto, estas vajillas son aptas para 
microondas, horno, salamandra, grill y lavavajillas..."
```

## Archivos Modificados

- `api/chat-rag.ts`: 
  - Añadida extracción inteligente del nombre del producto
  - Mejorado logging para debugging
  - Validación mejorada de descripciones

## Estado

✅ **Desplegado en producción** - Los cambios ya están activos.

## Próximos Pasos

1. **Probar con diferentes formatos de preguntas** para asegurar que la extracción funciona bien
2. **Monitorear los logs** para ver qué nombres se están extrayendo
3. **Considerar usar NLP más avanzado** si hay casos edge que no se cubren


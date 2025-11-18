# De dónde sale la respuesta del chat RAG

## Origen de la información

La respuesta que ves en el chat viene del campo `description` de la tabla `products` en Supabase.

## Flujo completo:

### 1. **Origen inicial: PrestaShop**
- Los productos se obtienen de PrestaShop usando la API
- Se extrae el campo `description_short` de cada producto
- Este campo contiene la descripción corta del producto en PrestaShop

### 2. **Almacenamiento en Supabase**
- El campo `description_short` se guarda como `description` en la tabla `products`
- Se limpia de etiquetas HTML pero se mantiene el contenido de texto

### 3. **Indexación RAG**
Cuando se indexan productos para RAG (`/api/index-products-rag`):
- Se toma el campo `description` de la tabla `products`
- Se divide en chunks inteligentes usando `chunkProduct()` en `api/utils/chunking.ts`
- Cada chunk se convierte en un embedding vectorial
- Los embeddings se guardan en la tabla `product_embeddings`

### 4. **Búsqueda y respuesta**
Cuando el usuario pregunta algo (`/api/chat-rag`):

**Paso 1: Búsqueda exacta por nombre** (líneas 137-198)
```typescript
// Busca productos por nombre
const { data: exactResults } = await supabase
  .from('products')
  .select('id, name, description, category, subcategory, ...')
  .ilike('name', `%${searchTerm}%`);

// Construye chunks con nombre + categoría + descripción
let productChunk = product.name || '';
if (product.category) {
  productChunk += ` - ${product.category}`;
}
if (product.description) {
  productChunk += `. ${product.description}`;  // ← AQUÍ se usa la descripción
}
chunksText.push(productChunk.trim());
```

**Paso 2: Búsqueda semántica** (líneas 200-224)
```typescript
// Genera embedding de la pregunta
const queryEmbedding = await generateEmbedding(message);

// Busca chunks similares en product_embeddings
const { data: similarChunks } = await supabase.rpc(
  'search_similar_chunks',
  {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: 0.5,
    match_count: 10,
  }
);

// Los chunks contienen el contenido original (incluyendo descripciones)
similarChunks.forEach((chunk: any) => {
  if (chunk.content && !chunksText.includes(chunk.content)) {
    chunksText.push(chunk.content);  // ← AQUÍ se añaden los chunks con descripciones
  }
});
```

**Paso 3: Generación de respuesta con OpenAI** (líneas 336-348)
```typescript
// Se envía todo el contexto (chunks con descripciones) a OpenAI
const completion = await openai.chat.completions.create({
  model: 'gpt-3.5-turbo',
  messages: [
    { role: 'system', content: systemPrompt },
    {
      role: 'user',
      content: `Contexto del catálogo:\n${contextText}\n\nPregunta del usuario: ${message}`,
      // contextText contiene todos los chunks con las descripciones
    },
  ],
});
```

## ¿De dónde viene la descripción detallada?

La descripción que ves en la respuesta viene directamente del campo `description` de la tabla `products` en Supabase, que a su vez viene de `description_short` de PrestaShop.

Si la descripción es muy detallada, significa que:
1. **PrestaShop tiene una descripción completa** en `description_short` para ese producto
2. **O hay un proceso de sincronización** que actualiza las descripciones con contenido más completo

## Verificar el origen exacto

Para verificar de dónde viene exactamente la descripción de un producto específico:

1. **Consulta directa en Supabase:**
```sql
SELECT id, name, description 
FROM products 
WHERE name ILIKE '%plato volcanic%' 
LIMIT 5;
```

2. **Ver los chunks indexados:**
```sql
SELECT product_id, content, metadata 
FROM product_embeddings 
WHERE product_id = [ID_DEL_PRODUCTO]
ORDER BY chunk_index;
```

3. **Verificar en PrestaShop:**
   - Accede a la API de PrestaShop para ese producto
   - Revisa el campo `description_short`

## Nota importante

El sistema RAG **NO está usando** actualmente la tabla `web_content_index` (que contiene contenido scrapeado de las páginas web). Solo usa:
- La descripción de la tabla `products`
- Los chunks indexados en `product_embeddings` (que se generaron a partir de las descripciones)

Si quieres que el sistema use también el contenido completo de las páginas web, habría que modificar `api/chat-rag.ts` para consultar también `web_content_index`.


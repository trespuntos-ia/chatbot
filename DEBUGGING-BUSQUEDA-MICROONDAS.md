# Debugging: ¿Por qué no encuentra información sobre microondas?

## 🔍 Verificaciones Necesarias

### 1. Verificar que el Producto Está Indexado

**Paso 1:** Verifica que el producto "Plato Volcanic Terra" esté indexado en la base de datos.

**Consulta SQL en Supabase:**
```sql
-- Verificar si el producto está indexado
SELECT DISTINCT product_id, COUNT(*) as chunk_count
FROM product_embeddings
WHERE product_id IN (
  SELECT id FROM products WHERE name ILIKE '%volcanic terra%'
)
GROUP BY product_id;
```

**Resultado esperado:**
- Debe mostrar el `product_id` del producto
- Debe mostrar que tiene varios chunks (idealmente 5-10 chunks)

---

### 2. Verificar que los Chunks Contienen "microondas"

**Paso 2:** Verifica si algún chunk indexado contiene la palabra "microondas".

**Consulta SQL en Supabase:**
```sql
-- Buscar chunks que contengan "microondas" para el producto Volcanic Terra
SELECT 
  pe.id,
  pe.product_id,
  p.name as product_name,
  pe.content,
  pe.chunk_index
FROM product_embeddings pe
JOIN products p ON pe.product_id = p.id
WHERE p.name ILIKE '%volcanic terra%'
  AND pe.content ILIKE '%microondas%'
ORDER BY pe.chunk_index;
```

**Resultado esperado:**
- Si hay resultados: Los chunks SÍ contienen "microondas" → El problema está en la recuperación o en GPT-4o
- Si NO hay resultados: Los chunks NO contienen "microondas" → El producto necesita ser re-indexado o la información no está en la descripción

---

### 3. Verificar la Descripción del Producto

**Paso 3:** Verifica qué información tiene realmente el producto en la base de datos.

**Consulta SQL en Supabase:**
```sql
-- Ver la descripción completa del producto
SELECT 
  id,
  name,
  description,
  category,
  subcategory
FROM products
WHERE name ILIKE '%volcanic terra%';
```

**Verifica:**
- ¿La descripción contiene la palabra "microondas"?
- ¿La descripción contiene "apto para microondas"?
- ¿La descripción contiene información sobre características de uso?

---

### 4. Verificar los Logs del Servidor

**Paso 4:** Revisa los logs de Vercel después de hacer la pregunta.

**Busca en los logs:**
```
[chat-rag] Found semantic chunks: X
[chat-rag] ✅ Added semantic chunk for product Y
[chat-rag] ⚠️ Chunk contains relevant keywords from query!
[chat-rag] 📋 Context summary:
```

**Qué verificar:**
1. ¿Se encontraron chunks semánticos? (`Found semantic chunks: X`)
2. ¿Se añadieron chunks al contexto? (`Added semantic chunk`)
3. ¿Algún chunk tiene palabras clave relevantes? (`HAS KEYWORDS`)
4. ¿Cuántos chunks hay en total? (`Total products found: X, chunks: Y`)

---

### 5. Verificar el Contexto Enviado a GPT-4o

**Paso 5:** Revisa el preview del contexto en los logs.

**Busca en los logs:**
```
[chat-rag] Context preview (first 2000 chars): ...
```

**Verifica:**
- ¿El contexto incluye la palabra "microondas"?
- ¿El contexto incluye información sobre el producto Volcanic Terra?
- ¿Hay múltiples chunks del mismo producto?

---

## 🛠️ Soluciones Según el Problema

### Problema 1: El Producto NO Está Indexado

**Solución:**
1. Ve a la página de indexación
2. Indexa el producto "Plato Volcanic Terra" manualmente
3. O ejecuta el indexador automático

---

### Problema 2: El Producto Está Indexado pero los Chunks NO Contienen "microondas"

**Causa:** La descripción del producto en la base de datos no contiene información sobre microondas.

**Soluciones:**
1. **Actualizar la descripción del producto** en PrestaShop/Supabase para incluir información sobre microondas
2. **Añadir un documento** asociado al producto con información sobre características de uso
3. **Re-indexar el producto** después de actualizar la información

---

### Problema 3: Los Chunks SÍ Contienen "microondas" pero No se Recuperan

**Causa:** La búsqueda semántica no está encontrando los chunks relevantes.

**Soluciones:**
1. **Reducir el threshold** aún más (de 0.4 a 0.35)
2. **Aumentar el match_count** (de 15 a 20)
3. **Verificar que el embedding de la query** es similar al embedding del chunk

**Consulta para verificar similitud:**
```sql
-- Ver la similitud entre la query y los chunks
SELECT 
  pe.content,
  pe.product_id,
  1 - (pe.embedding <=> '[EMBEDDING_DE_LA_QUERY]') as similarity
FROM product_embeddings pe
WHERE pe.product_id IN (
  SELECT id FROM products WHERE name ILIKE '%volcanic terra%'
)
ORDER BY similarity DESC
LIMIT 10;
```

---

### Problema 4: Los Chunks se Recuperan pero GPT-4o No los Encuentra

**Causa:** GPT-4o no está buscando activamente en todos los chunks.

**Soluciones:**
1. **Verificar que el prompt** incluye instrucciones explícitas para buscar en todos los chunks
2. **Aumentar max_tokens** si el contexto es muy largo
3. **Verificar que el contexto** realmente incluye los chunks con "microondas"

---

## 📋 Checklist de Debugging

Marca cada verificación:

- [ ] **Verificación 1:** Producto está indexado (tiene chunks en `product_embeddings`)
- [ ] **Verificación 2:** Al menos un chunk contiene "microondas"
- [ ] **Verificación 3:** La descripción del producto contiene información sobre microondas
- [ ] **Verificación 4:** Los logs muestran que se encontraron chunks semánticos
- [ ] **Verificación 5:** Los logs muestran que se añadieron chunks al contexto
- [ ] **Verificación 6:** El contexto preview incluye la palabra "microondas"
- [ ] **Verificación 7:** GPT-4o recibe el contexto completo con todos los chunks

---

## 🎯 Próximos Pasos

1. **Ejecuta las verificaciones** en orden
2. **Identifica el problema** específico
3. **Aplica la solución** correspondiente
4. **Vuelve a probar** la pregunta
5. **Revisa los logs** para confirmar que funciona

---

## 💡 Nota Importante

Si después de todas las verificaciones el problema persiste, puede ser que:
- La información sobre microondas simplemente **no existe** en la descripción del producto
- Necesitas **actualizar la información del producto** en PrestaShop/Supabase
- O **añadir un documento** con información detallada sobre características de uso


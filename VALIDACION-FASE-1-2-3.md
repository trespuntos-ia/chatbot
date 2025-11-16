# 🧪 Validación Fases 1, 2 y 3 - Instrucciones

## ✅ Lo que hemos implementado hasta ahora

1. **Fase 1**: Migraciones SQL para pgvector y tabla de embeddings
2. **Fase 2**: Utilidades de embeddings, chunking y endpoint de indexación
3. **Fase 3**: Función de retrieval y endpoint de prueba

---

## 📋 Paso 1: Configurar Supabase (HACER PRIMERO)

### 1.1 Habilitar pgvector

1. Ve a tu **Supabase Dashboard**
2. Abre **SQL Editor**
3. Copia y pega el contenido de `supabase/migrations/001_enable_pgvector.sql`
4. Ejecuta el script
5. Deberías ver un mensaje de éxito

### 1.2 Crear tabla de embeddings

1. En el mismo **SQL Editor**
2. Copia y pega el contenido de `supabase/migrations/002_create_embeddings_table.sql`
3. Ejecuta el script
4. Verifica que la tabla se creó: ve a **Table Editor** → deberías ver `product_embeddings`

### 1.3 Crear función de búsqueda

1. En el **SQL Editor**
2. Copia y pega el contenido de `supabase/migrations/003_create_similarity_search_function.sql`
3. Ejecuta el script
4. Verifica que la función existe: en SQL Editor, ejecuta:
   ```sql
   SELECT proname FROM pg_proc WHERE proname = 'search_similar_chunks';
   ```
   Deberías ver `search_similar_chunks` en los resultados

---

## 📋 Paso 2: Indexar Productos (PRIMERA VALIDACIÓN)

### 2.1 Verificar que tienes productos en la base de datos

En Supabase SQL Editor, ejecuta:
```sql
SELECT COUNT(*) FROM products;
```

Si tienes productos, continúa. Si no, primero necesitas importar productos.

### 2.2 Indexar 10 productos de prueba

**Opción A: Desde terminal (si tienes el proyecto corriendo localmente)**

```bash
curl -X POST http://localhost:3000/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

**Opción B: Desde el navegador (si está desplegado en Vercel)**

Ve a: `https://tu-proyecto.vercel.app/api/index-products-rag`

O usa Postman/Insomnia:
- Method: POST
- URL: `https://tu-proyecto.vercel.app/api/index-products-rag`
- Body (JSON):
```json
{
  "limit": 10
}
```

### 2.3 Verificar que los embeddings se guardaron

En Supabase SQL Editor, ejecuta:
```sql
SELECT COUNT(*) FROM product_embeddings;
```

Deberías ver un número > 0 (probablemente más que 10 porque cada producto puede tener múltiples chunks).

Ver detalles:
```sql
SELECT 
  pe.id,
  pe.product_id,
  p.name as product_name,
  pe.chunk_index,
  pe.metadata->>'source' as source,
  LEFT(pe.content, 50) as content_preview
FROM product_embeddings pe
JOIN products p ON pe.product_id = p.id
LIMIT 20;
```

---

## 📋 Paso 3: Probar Búsqueda Semántica (SEGUNDA VALIDACIÓN)

### 3.1 Probar con una query simple

**Ejemplo 1: Búsqueda por concepto**

```bash
curl -X POST http://localhost:3000/api/test-rag-retrieval \
  -H "Content-Type: application/json" \
  -d '{"query": "ahumador portátil", "limit": 5}'
```

**O desde navegador/Postman:**
- Method: POST
- URL: `https://tu-proyecto.vercel.app/api/test-rag-retrieval`
- Body (JSON):
```json
{
  "query": "ahumador portátil",
  "limit": 5
}
```

### 3.2 Qué esperar en la respuesta

Deberías recibir un JSON con:
```json
{
  "success": true,
  "query": "ahumador portátil",
  "chunks": [
    {
      "id": 123,
      "product_id": 45,
      "content": "Ahumador portátil para showcooking...",
      "similarity": 0.85,
      "metadata": {...}
    },
    ...
  ],
  "products": [
    {
      "id": 45,
      "name": "Ahumador Portátil XYZ",
      ...
    },
    ...
  ],
  "count": 5
}
```

### 3.3 Más ejemplos para probar

**Ejemplo 2: Búsqueda por sinónimo**
```json
{
  "query": "máquina para hacer hielo",
  "limit": 5
}
```

**Ejemplo 3: Búsqueda conceptual**
```json
{
  "query": "herramientas para trabajar con nitrógeno",
  "limit": 5
}
```

**Ejemplo 4: Búsqueda en español coloquial**
```json
{
  "query": "cosas para cocinar al vacío",
  "limit": 5
}
```

---

## ✅ Criterios de Éxito

### Validación Fase 1 ✅
- [ ] Extensión pgvector habilitada en Supabase
- [ ] Tabla `product_embeddings` creada
- [ ] Función `search_similar_chunks` creada

### Validación Fase 2 ✅
- [ ] Endpoint `/api/index-products-rag` funciona
- [ ] Se pueden indexar productos
- [ ] Los embeddings se guardan en la tabla
- [ ] Cada producto puede tener múltiples chunks

### Validación Fase 3 ✅
- [ ] Endpoint `/api/test-rag-retrieval` funciona
- [ ] Encuentra productos relevantes aunque no coincida texto exacto
- [ ] Retorna similitud (score) para cada resultado
- [ ] Los productos retornados son relevantes a la búsqueda

---

## 🐛 Solución de Problemas

### Error: "extension vector does not exist"
- Asegúrate de ejecutar `001_enable_pgvector.sql` primero
- Verifica que tienes permisos de administrador en Supabase

### Error: "relation product_embeddings does not exist"
- Ejecuta `002_create_embeddings_table.sql`
- Verifica que estás en la base de datos correcta

### Error: "function search_similar_chunks does not exist"
- Ejecuta `003_create_similarity_search_function.sql`
- Verifica la sintaxis del SQL

### Error: "Supabase configuration missing"
- Verifica que tienes `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en variables de entorno
- Para indexación necesitas `SERVICE_ROLE_KEY`, no `ANON_KEY`

### No encuentra productos relevantes
- Asegúrate de haber indexado productos primero
- Prueba reducir el `threshold` (por defecto 0.7, prueba 0.5)
- Verifica que los productos indexados tienen contenido relevante

### Embeddings no se generan
- Verifica que tienes `OPENAI_API_KEY` configurada
- Verifica que tienes créditos en OpenAI
- Revisa los logs del servidor para ver errores específicos

---

## 📊 Ejemplo de Respuesta Exitosa

Cuando pruebes con `"query": "ahumador portátil"`, deberías ver algo como:

```json
{
  "success": true,
  "query": "ahumador portátil",
  "chunks": [
    {
      "id": 1,
      "product_id": 123,
      "content": "Ahumador Portátil Profesional para Showcooking",
      "similarity": 0.92,
      "metadata": {
        "product_id": 123,
        "product_name": "Ahumador Portátil XYZ",
        "chunk_index": 0,
        "source": "name"
      }
    },
    {
      "id": 2,
      "product_id": 123,
      "content": "Ideal para showcooking en sala, fácil de transportar...",
      "similarity": 0.88,
      "metadata": {
        "product_id": 123,
        "product_name": "Ahumador Portátil XYZ",
        "chunk_index": 1,
        "source": "description"
      }
    }
  ],
  "products": [
    {
      "id": 123,
      "name": "Ahumador Portátil XYZ",
      "description": "Ideal para showcooking...",
      "price": "299.99",
      ...
    }
  ],
  "count": 2
}
```

---

## 🎯 Siguiente Paso

Una vez que hayas validado estas 3 fases exitosamente, continuaremos con:
- **Fase 4**: Integración con LangChain
- **Fase 5**: Endpoint completo del chat con RAG
- **Fase 6**: Testing y optimización

---

## 💡 Tips

1. **Empieza con pocos productos**: Indexa solo 10 productos primero para probar rápido
2. **Prueba diferentes queries**: No solo busques nombres exactos, prueba conceptos
3. **Revisa los scores de similitud**: Deberían ser > 0.7 para resultados relevantes
4. **Compara con búsqueda anterior**: Prueba la misma query en el chat actual y en el nuevo sistema


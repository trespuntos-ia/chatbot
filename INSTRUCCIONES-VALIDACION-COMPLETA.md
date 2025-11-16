# 🧪 Instrucciones de Validación Completa - Sistema RAG

## ✅ Estado de Implementación

Hemos completado todas las fases de implementación:
- ✅ Fase 0: Backup y configuración
- ✅ Fase 1: Infraestructura Base (pgvector, tabla embeddings)
- ✅ Fase 2: Pipeline de Indexación
- ✅ Fase 3: RAG Retrieval Básico
- ✅ Fase 4: Integración LangChain
- ✅ Fase 5: Endpoint Chat RAG Completo

---

## 📋 Validación Paso a Paso

### Paso 1: Configurar Supabase (HACER PRIMERO)

#### 1.1 Habilitar pgvector
1. Ve a **Supabase Dashboard** → **SQL Editor**
2. Copia y ejecuta el contenido de `supabase/migrations/001_enable_pgvector.sql`
3. Verifica: Deberías ver un mensaje de éxito

#### 1.2 Crear tabla de embeddings
1. En **SQL Editor**, ejecuta `supabase/migrations/002_create_embeddings_table.sql`
2. Verifica: Ve a **Table Editor** → deberías ver `product_embeddings`

#### 1.3 Crear función de búsqueda
1. En **SQL Editor**, ejecuta `supabase/migrations/003_create_similarity_search_function.sql`
2. Verifica: Ejecuta `SELECT proname FROM pg_proc WHERE proname = 'search_similar_chunks';`

---

### Paso 2: Indexar Productos

#### 2.1 Indexar productos de prueba

**Desde terminal (local):**
```bash
curl -X POST http://localhost:3000/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**Desde navegador/Postman (producción):**
- Method: POST
- URL: `https://tu-proyecto.vercel.app/api/index-products-rag`
- Body:
```json
{
  "limit": 20
}
```

#### 2.2 Verificar indexación

En Supabase SQL Editor:
```sql
SELECT COUNT(*) FROM product_embeddings;
```

Deberías ver un número > 0.

---

### Paso 3: Probar Búsqueda Semántica (Endpoint de Prueba)

#### 3.1 Probar retrieval básico

**Ejemplo 1:**
```bash
curl -X POST http://localhost:3000/api/test-rag-retrieval \
  -H "Content-Type: application/json" \
  -d '{"query": "ahumador portátil", "limit": 5}'
```

**Ejemplo 2:**
```json
{
  "query": "máquina para hacer hielo",
  "limit": 5
}
```

**Ejemplo 3:**
```json
{
  "query": "herramientas para trabajar con nitrógeno",
  "limit": 5
}
```

#### 3.2 Qué esperar

Deberías recibir productos relevantes aunque no coincida el texto exacto.

---

### Paso 4: Probar Chat Completo con RAG (VALIDACIÓN PRINCIPAL)

#### 4.1 Probar endpoint completo

**Ejemplo 1: Pregunta simple**
```bash
curl -X POST http://localhost:3000/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message": "Busco un ahumador portátil"}'
```

**Ejemplo 2: Pregunta conceptual**
```json
{
  "message": "¿Tenéis herramientas para trabajar con nitrógeno líquido?"
}
```

**Ejemplo 3: Pregunta en lenguaje natural**
```json
{
  "message": "Necesito algo para cocinar al vacío, ¿qué me recomiendas?"
}
```

**Ejemplo 4: Pregunta sobre categoría**
```json
{
  "message": "Muéstrame productos de destilación"
}
```

#### 4.2 Qué esperar en la respuesta

```json
{
  "success": true,
  "message": "He encontrado varios productos relacionados con ahumadores portátiles...",
  "conversation_history": [
    {
      "role": "user",
      "content": "Busco un ahumador portátil"
    },
    {
      "role": "assistant",
      "content": "He encontrado varios productos relacionados..."
    }
  ],
  "products": [
    {
      "id": 123,
      "name": "Ahumador Portátil XYZ",
      "price": "299.99",
      ...
    }
  ],
  "sources": ["products_db"],
  "timings": {
    "total_ms": 2500,
    "steps": [...]
  }
}
```

---

## 🎯 Ejemplos para Probar en el Chat Real

Una vez que hayas configurado todo y el sistema esté funcionando, aquí tienes ejemplos específicos para probar:

### Ejemplo 1: Búsqueda por Nombre Exacto
**Query:** `"ahumador portátil"`

**Qué validar:**
- ✅ Encuentra productos con "ahumador" y "portátil" en el nombre
- ✅ Respuesta es clara y útil
- ✅ Incluye información del producto si está disponible

### Ejemplo 2: Búsqueda por Concepto
**Query:** `"cosas para cocinar al vacío"`

**Qué validar:**
- ✅ Encuentra productos relacionados aunque no diga "vacío" exactamente
- ✅ Entiende sinónimos y conceptos relacionados
- ✅ Respuesta es contextual y útil

### Ejemplo 3: Búsqueda por Uso
**Query:** `"herramientas para showcooking en sala"`

**Qué validar:**
- ✅ Encuentra productos relevantes para showcooking
- ✅ Filtra por contexto (portátil, fácil de transportar, etc.)
- ✅ Respuesta es específica al contexto

### Ejemplo 4: Búsqueda por Característica
**Query:** `"productos que funcionan con hielo seco"`

**Qué validar:**
- ✅ Encuentra productos relacionados con hielo seco
- ✅ Respuesta menciona características específicas
- ✅ Es útil aunque no haya coincidencia exacta de texto

### Ejemplo 5: Búsqueda en Español Coloquial
**Query:** `"algo para infusionar aceites"`

**Qué validar:**
- ✅ Entiende lenguaje coloquial
- ✅ Encuentra productos de infusión aunque no use términos técnicos
- ✅ Respuesta es natural y conversacional

---

## ✅ Criterios de Éxito

### Validación Técnica ✅
- [ ] Endpoint `/api/index-products-rag` funciona
- [ ] Endpoint `/api/test-rag-retrieval` funciona
- [ ] Endpoint `/api/chat-rag` funciona
- [ ] Los embeddings se generan correctamente
- [ ] La búsqueda vectorial encuentra productos relevantes
- [ ] LangChain genera respuestas contextuales

### Validación Funcional ✅
- [ ] Encuentra productos aunque no coincida texto exacto
- [ ] Entiende sinónimos y conceptos relacionados
- [ ] Respuestas son claras y útiles
- [ ] Tiempo de respuesta < 5 segundos
- [ ] Respuestas incluyen información relevante de productos

### Comparación con Sistema Anterior ✅
- [ ] RAG encuentra más productos relevantes que búsqueda exacta
- [ ] Respuestas son más contextuales y útiles
- [ ] Entiende mejor el lenguaje natural

---

## 🐛 Solución de Problemas

### Error: "SupabaseVectorStore.fromExistingIndex failed"
- Verifica que la tabla `product_embeddings` existe
- Verifica que tienes embeddings indexados
- Verifica que la función `search_similar_chunks` existe

### Error: "OpenAI API error"
- Verifica que `OPENAI_API_KEY` está configurada
- Verifica que tienes créditos en OpenAI
- Revisa los logs para ver el error específico

### No encuentra productos relevantes
- Asegúrate de haber indexado suficientes productos
- Prueba reducir el threshold en la búsqueda
- Verifica que los productos tienen contenido descriptivo

### Respuestas muy genéricas
- Aumenta el número de chunks recuperados (k en retriever)
- Ajusta el prompt del sistema
- Verifica que los embeddings son de buena calidad

---

## 📊 Métricas a Observar

1. **Tiempo de respuesta**: Debería ser < 5 segundos
2. **Relevancia**: Productos encontrados deberían ser relevantes
3. **Calidad de respuestas**: Deberían ser contextuales y útiles
4. **Cobertura**: Debería encontrar productos que el sistema anterior no encontraba

---

## 🎯 Próximos Pasos Después de Validar

Una vez validado exitosamente:

1. **Indexar todos los productos**: Cambiar `limit` a `null` para indexar todo
2. **Integrar con frontend**: Modificar el frontend para usar `/api/chat-rag`
3. **Optimizar**: Ajustar parámetros según resultados
4. **Monitorear**: Implementar analytics para medir mejoras

---

## 💡 Tips para Validación

1. **Empieza con pocos productos**: Indexa 20-30 productos primero
2. **Prueba diferentes tipos de queries**: Exactas, conceptuales, coloquiales
3. **Compara con sistema anterior**: Prueba las mismas queries en ambos sistemas
4. **Revisa los logs**: Si algo falla, revisa los logs del servidor
5. **Ajusta parámetros**: Si no funciona bien, ajusta threshold, k, etc.

---

## 📝 Notas Importantes

- El sistema RAG está en `/api/chat-rag`
- El sistema anterior sigue en `/api/chat` (no se ha modificado)
- Puedes usar ambos sistemas en paralelo durante la validación
- Una vez validado, puedes migrar el frontend a usar `/api/chat-rag`


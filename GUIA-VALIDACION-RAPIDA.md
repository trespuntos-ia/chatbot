# 🧪 Guía de Validación Rápida - Sistema RAG

## ✅ Estado Actual

El dashboard ya carga correctamente. Ahora vamos a validar que el sistema RAG funciona.

---

## 🎯 Validación en 3 Pasos

### **Paso 1: Indexar Productos** (5 minutos)

**Desde terminal:**
```bash
curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**O desde Postman/navegador:**
- URL: `https://tu-proyecto.vercel.app/api/index-products-rag`
- Method: POST
- Body:
```json
{
  "limit": 20
}
```

**✅ Qué esperar:**
```json
{
  "success": true,
  "message": "Indexados 20 productos",
  "indexed": 20,
  "total": 20
}
```

**Verificar en Supabase:**
```sql
SELECT COUNT(*) FROM product_embeddings;
-- Deberías ver un número > 0
```

---

### **Paso 2: Probar Búsqueda Semántica** (2 minutos)

**Ejemplo 1:**
```bash
curl -X POST https://tu-proyecto.vercel.app/api/test-rag-retrieval \
  -H "Content-Type: application/json" \
  -d '{"query": "ahumador portátil", "limit": 5}'
```

**✅ Qué esperar:**
- Encuentra productos relevantes
- Scores de similitud > 0.7
- Productos relacionados aunque no coincida texto exacto

---

### **Paso 3: Probar Chat Completo** (VALIDACIÓN PRINCIPAL) (3 minutos)

**Ejemplo 1:**
```bash
curl -X POST https://tu-proyecto.vercel.app/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message": "Busco un ahumador portátil"}'
```

**Ejemplo 2:**
```json
{
  "message": "¿Tenéis herramientas para trabajar con nitrógeno líquido?"
}
```

**Ejemplo 3:**
```json
{
  "message": "Necesito algo para cocinar al vacío"
}
```

**✅ Qué esperar:**
- Respuesta contextual y útil
- Encuentra productos relevantes
- Tiempo < 5 segundos
- Incluye información de productos

---

## 📊 Comparación Rápida

### **Sistema Anterior:**
- Busca texto exacto
- No entiende sinónimos
- Respuestas limitadas

### **Sistema Nuevo (RAG):**
- Entiende intención
- Encuentra productos relevantes aunque no coincida texto
- Respuestas contextuales

---

## ✅ Checklist Rápido

- [ ] Productos indexados (Paso 1)
- [ ] Búsqueda semántica funciona (Paso 2)
- [ ] Chat RAG funciona (Paso 3)
- [ ] Respuestas son mejores que sistema anterior

---

## 🎯 Listo para Validar

Ejecuta los 3 pasos arriba y verifica que todo funciona. Si algo falla, revisa los logs o comparte el error específico.


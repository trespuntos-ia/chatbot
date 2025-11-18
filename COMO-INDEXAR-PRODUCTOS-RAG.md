# 📦 Cómo Indexar Productos para el Sistema RAG

## ✅ SÍ, Necesitas Indexar Productos

El sistema RAG necesita productos indexados en la tabla `product_embeddings` para poder buscar y responder preguntas.

---

## 🚀 Cómo Indexar Productos

### **Opción 1: Desde Terminal (Recomendado)**

```bash
curl -X POST https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**Para indexar TODOS los productos:**
```bash
curl -X POST https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### **Opción 2: Desde Postman o Navegador**

**URL:** `https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/index-products-rag`

**Method:** POST

**Body (JSON):**
```json
{
  "limit": 20
}
```

O para indexar todo:
```json
{
  "force": true
}
```

---

## ✅ Verificar que Funcionó

### **1. Verificar en Supabase:**

Ve a Supabase SQL Editor y ejecuta:

```sql
SELECT COUNT(*) FROM product_embeddings;
```

**Deberías ver un número > 0** (probablemente más que el número de productos porque cada producto puede tener múltiples chunks)

### **2. Verificar con el Endpoint:**

```bash
curl https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/test-rag-retrieval \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "ahumador", "limit": 1}'
```

**Debería retornar:** `{"success": true, ...}`

---

## 📊 Qué Hace el Proceso de Indexación

1. **Obtiene productos** de la tabla `products` en Supabase
2. **Divide cada producto** en chunks (fragmentos de texto)
3. **Genera embeddings** usando OpenAI `text-embedding-3-small`
4. **Guarda los embeddings** en la tabla `product_embeddings`

**Cada producto puede generar múltiples chunks**, por eso verás más registros en `product_embeddings` que productos.

---

## ⚠️ Importante

- **Primera vez:** Indexa al menos 20 productos para probar
- **Producción:** Indexa todos los productos (sin `limit`)
- **Tiempo:** Indexar 20 productos toma ~30-60 segundos
- **Costo:** Cada embedding cuesta ~$0.00002 (muy barato)

---

## 🔄 Re-indexar Productos

Si actualizas productos en la base de datos, puedes re-indexar:

```bash
curl -X POST https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

Esto eliminará los embeddings antiguos y creará nuevos.

---

## ✅ Después de Indexar

Una vez indexados los productos:

1. **Recarga el dashboard** (F5)
2. **Prueba el chat** con una pregunta como:
   - "Busco un ahumador portátil"
   - "¿Tenéis herramientas para trabajar con nitrógeno líquido?"

**Debería encontrar productos relevantes** 🎉

---

## 🐛 Si No Funciona

### **Error: "No products found"**
**Causa:** No hay productos en la tabla `products`  
**Solución:** Primero sincroniza productos desde PrestaShop

### **Error: "OpenAI API error"**
**Causa:** Problema con la API key de OpenAI  
**Solución:** Verifica `OPENAI_API_KEY` en Vercel

### **Error: "Supabase connection failed"**
**Causa:** Problema con Supabase  
**Solución:** Verifica `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Vercel

---

## 📝 Resumen

1. **Ejecuta el comando** para indexar productos (arriba)
2. **Espera** a que termine (~30-60 segundos para 20 productos)
3. **Verifica** que funcionó (ver arriba)
4. **Prueba el chat** - debería funcionar ahora

**¡Listo para indexar!** 🚀


# ✅ TODO: Pasos para Probar el Sistema RAG

## 🎯 Lo que he hecho

- ✅ **Activado RAG por defecto** en el código
- ✅ **Ajustado formato** de respuesta para compatibilidad
- ✅ **Todo configurado** y listo

---

## 📋 Lo que TÚ debes hacer (2 pasos)

### **Paso 1: Indexar Productos** (OBLIGATORIO - 2 minutos)

**Ejecuta esto desde terminal o Postman:**

```bash
curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**O desde navegador/Postman:**
- URL: `https://tu-proyecto.vercel.app/api/index-products-rag`
- Method: POST
- Body: `{"limit": 20}`

**✅ Verificar:**
- Deberías recibir: `{"success": true, "indexed": 20}`
- En Supabase SQL Editor: `SELECT COUNT(*) FROM product_embeddings;` debería ser > 0

---

### **Paso 2: Probar el Chat** (1 minuto)

1. **Recarga el dashboard** (F5 o Ctrl+R)
2. **Abre el chat** ChefCopilot
3. **Prueba esta pregunta:**
   ```
   ¿Tenéis herramientas para trabajar con nitrógeno líquido?
   ```

**✅ Qué debería pasar:**
- ✅ Encuentra productos relevantes
- ✅ Respuesta contextual y útil
- ✅ NO dice "No encontré coincidencias exactas"

---

## 🎯 Comparación

### **Antes (Búsqueda Exacta):**
- "nitrógeno líquido" → ❌ "No encontré coincidencias exactas"

### **Ahora (RAG):**
- "nitrógeno líquido" → ✅ Encuentra productos relacionados

---

## ✅ Checklist

- [ ] Ejecuté el Paso 1 (indexar productos)
- [ ] Recargué el dashboard
- [ ] Probé el chat con la pregunta de nitrógeno
- [ ] Funciona mejor que antes

---

## 🐛 Si No Funciona

**Error: "No encontré coincidencias"**
→ No has indexado productos. Ejecuta el Paso 1.

**Error: "RAG chat failed"**
→ Revisa variables de entorno en Vercel (OPENAI_API_KEY, SUPABASE_URL, etc.)

**Sigue usando búsqueda exacta**
→ Verifica que el código está actualizado y redespliega en Vercel

---

## 🚀 Después de Validar

Si funciona bien:
1. Indexa todos los productos (sin `limit`)
2. Monitorea resultados
3. Ajusta parámetros si es necesario

---

**¡Listo para probar!** Ejecuta los 2 pasos y verás la diferencia. 🎉


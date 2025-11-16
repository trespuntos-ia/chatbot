# 🔧 Solución: Error 500 en /api/chat-rag

## ❌ Problema

El endpoint `/api/chat-rag` está fallando con:
- `FUNCTION_INVOCATION_FAILED`
- Error 522 de Supabase (Connection timed out)
- Error 500 en varios endpoints

---

## ✅ Soluciones Implementadas

### **1. Verificación de Productos Indexados**

Ahora el endpoint verifica si hay productos indexados antes de intentar usar RAG:

- Si **NO hay productos indexados**: Retorna un mensaje claro pidiendo indexar productos primero
- Si **hay productos**: Continúa con el flujo RAG normal

### **2. Manejo de Timeouts**

Se agregaron timeouts para evitar que las funciones se cuelguen:

- **Crear RAG Chain**: 10 segundos máximo
- **Ejecutar consulta**: 30 segundos máximo
- **Obtener productos**: 5 segundos máximo

### **3. Mejor Manejo de Errores**

- Errores más descriptivos
- Fallbacks cuando Supabase no está disponible
- Logs mejorados para debugging

---

## 📋 Pasos para Solucionar

### **Paso 1: Verificar Variables de Entorno**

En Vercel Dashboard → Settings → Environment Variables, verifica:

- ✅ `OPENAI_API_KEY`
- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

### **Paso 2: Indexar Productos** (OBLIGATORIO)

El sistema RAG necesita productos indexados para funcionar:

```bash
curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

**Verificar que funcionó:**
```sql
SELECT COUNT(*) FROM product_embeddings;
-- Debería ser > 0
```

### **Paso 3: Verificar Conexión a Supabase**

Si Supabase sigue dando timeout (Error 522):

1. **Verifica que Supabase esté activo:**
   - Ve a Supabase Dashboard
   - Verifica que el proyecto esté activo
   - Revisa si hay problemas de infraestructura

2. **Verifica las URLs:**
   - `SUPABASE_URL` debe ser correcta
   - No debe tener trailing slash
   - Debe ser la URL pública (no la interna)

3. **Verifica las políticas RLS:**
   - Las tablas deben tener políticas que permitan lectura
   - `product_embeddings` debe ser accesible

---

## 🐛 Errores Comunes y Soluciones

### **Error: "Lo siento, el sistema de búsqueda semántica aún no está disponible"**

**Causa:** No hay productos indexados  
**Solución:** Ejecuta el Paso 2 (indexar productos)

### **Error: "Timeout creating RAG chain"**

**Causa:** Supabase no responde o está muy lento  
**Solución:**
- Verifica que Supabase esté activo
- Verifica la conexión a internet
- Revisa los logs de Supabase

### **Error: "Supabase connection failed"**

**Causa:** Variables de entorno incorrectas o Supabase inaccesible  
**Solución:**
- Verifica variables de entorno en Vercel
- Verifica que Supabase esté activo
- Prueba la conexión manualmente

### **Error 522 de Supabase**

**Causa:** Timeout de conexión entre Cloudflare y Supabase  
**Solución:**
- Espera unos minutos y vuelve a intentar
- Verifica que Supabase no esté en mantenimiento
- Contacta con soporte de Supabase si persiste

---

## 🔍 Verificar que Funciona

### **1. Verificar que hay productos indexados:**

```bash
curl https://tu-proyecto.vercel.app/api/test-rag-retrieval \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"query": "test", "limit": 1}'
```

**Debería retornar:** `{"success": true, ...}`

### **2. Probar el chat:**

```bash
curl https://tu-proyecto.vercel.app/api/chat-rag \
  -X POST \
  -H "Content-Type: application/json" \
  -d '{"message": "Busco un ahumador"}'
```

**Debería retornar:** `{"success": true, "message": "...", ...}`

---

## 📊 Mejoras Implementadas

| Antes | Ahora |
|------|-------|
| ❌ Falla silenciosamente | ✅ Mensajes de error claros |
| ❌ Sin verificación de productos | ✅ Verifica antes de usar RAG |
| ❌ Sin timeouts | ✅ Timeouts en todas las operaciones |
| ❌ Errores crípticos | ✅ Errores descriptivos |

---

## ✅ Checklist de Verificación

- [ ] Variables de entorno configuradas en Vercel
- [ ] Productos indexados (al menos 20)
- [ ] Supabase accesible y funcionando
- [ ] Endpoint `/api/chat-rag` responde correctamente
- [ ] Chat funciona en el frontend

---

## 🚀 Próximos Pasos

Una vez solucionado:

1. **Indexa más productos** (sin `limit` para indexar todo)
2. **Monitorea los logs** de Vercel para detectar problemas
3. **Ajusta timeouts** si es necesario según tus necesidades

---

## 💡 Notas

- Los timeouts son conservadores para evitar que las funciones se cuelguen
- Si necesitas más tiempo, puedes ajustar los valores en el código
- El sistema ahora es más resiliente a fallos de conexión

**¡El código está actualizado y listo para redesplegar!** 🚀


# 🔄 Cómo Cambiar el Chat para Usar RAG

## 🎯 Opción 1: Cambiar Temporalmente en el Código (RÁPIDO)

He modificado `src/services/chatService.ts` para que puedas alternar fácilmente.

**Para usar RAG:**
1. Abre `src/services/chatService.ts`
2. Cambia esta línea:
   ```typescript
   const USE_RAG_CHAT = false; // Cambiar a true
   ```
   Por:
   ```typescript
   const USE_RAG_CHAT = true; // Usar RAG
   ```

3. Guarda y recarga el dashboard
4. Prueba el chat de nuevo

**Para volver al sistema anterior:**
- Cambia `true` a `false`

---

## 🎯 Opción 2: Usar Variable de Entorno (RECOMENDADO)

### En Desarrollo Local:

1. Crea o edita `.env.local` en la raíz del proyecto:
   ```env
   VITE_USE_RAG_CHAT=true
   ```

2. Reinicia el servidor de desarrollo:
   ```bash
   vercel dev
   ```

### En Vercel (Producción):

1. Ve a Vercel Dashboard → Settings → Environment Variables
2. Agrega:
   ```
   VITE_USE_RAG_CHAT = true
   ```
3. Redespliega el proyecto

---

## 🎯 Opción 3: Crear Endpoint Híbrido (MEJOR SOLUCIÓN)

Crear un endpoint que intente RAG primero y si falla, use búsqueda exacta como fallback.

¿Quieres que implemente esta opción?

---

## ✅ Verificación Rápida

Después de cambiar a RAG:

1. **Indexa productos primero:**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
     -H "Content-Type: application/json" \
     -d '{"limit": 20}'
   ```

2. **Prueba el chat con la misma pregunta:**
   - Query: `"¿Tenéis herramientas para trabajar con nitrógeno líquido?"`
   - **Debería encontrar productos relevantes** aunque no coincida texto exacto

---

## 🔍 Comparación

### Sistema Actual (Búsqueda Exacta):
- ❌ "nitrógeno líquido" → No encuentra nada (requiere coincidencia exacta)

### Sistema RAG:
- ✅ "nitrógeno líquido" → Encuentra productos relacionados con nitrógeno, herramientas de cocina molecular, etc.

---

## 💡 Recomendación

**Para probar rápido:**
1. Cambia `USE_RAG_CHAT = true` en `chatService.ts`
2. Indexa productos: `{"limit": 20}`
3. Prueba el chat

**Para producción:**
- Usa variable de entorno `VITE_USE_RAG_CHAT=true`
- Indexa todos los productos
- Monitorea resultados


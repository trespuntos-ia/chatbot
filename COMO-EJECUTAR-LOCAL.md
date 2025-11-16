# 🚀 Cómo Ejecutar el Proyecto Localmente

## ❌ Problema

Si intentas hacer `curl` a `http://localhost:3000/api/...` y obtienes "Failed to connect", es porque el servidor de desarrollo no está corriendo correctamente.

## ✅ Solución: Usar Vercel CLI

Este proyecto usa **Vercel Functions** para los endpoints de API. Para ejecutarlos localmente necesitas usar `vercel dev`.

---

## 📋 Pasos para Ejecutar

### Paso 1: Instalar Vercel CLI (si no lo tienes)

```bash
npm i -g vercel
```

### Paso 2: Navegar al directorio del proyecto

```bash
cd /Users/jordi/Documents/GitHub/chatbot2
```

### Paso 3: Iniciar el servidor de desarrollo

```bash
vercel dev
```

La primera vez te pedirá:
- ¿Set up and deploy? → **N** (No)
- ¿Link to existing project? → **N** (si es la primera vez)
- ¿What's your project's name? → Presiona Enter (usa el nombre por defecto)
- ¿In which directory is your code located? → Presiona Enter (usa `./`)

### Paso 4: El servidor estará disponible en

- **Frontend**: `http://localhost:3000`
- **API Endpoints**: `http://localhost:3000/api/...`

---

## 🧪 Probar el Endpoint de Indexación

Una vez que `vercel dev` esté corriendo, en otra terminal:

```bash
curl -X POST http://localhost:3000/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 20}'
```

---

## 🔄 Alternativa: Solo Frontend (sin API)

Si solo quieres ejecutar el frontend sin los endpoints de API:

```bash
npm run dev
```

Esto iniciará Vite en `http://localhost:5173`, pero **NO** tendrás acceso a los endpoints `/api/...`.

---

## 📝 Variables de Entorno

Asegúrate de tener un archivo `.env.local` en la raíz del proyecto con:

```env
OPENAI_API_KEY=sk-...
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

`vercel dev` cargará automáticamente las variables de `.env.local`.

---

## ✅ Verificación Rápida

1. **Inicia el servidor:**
   ```bash
   vercel dev
   ```

2. **En otra terminal, prueba:**
   ```bash
   curl http://localhost:3000/api/test-rag-retrieval
   ```

   Deberías recibir una respuesta (aunque sea un error de método, significa que el servidor está funcionando).

---

## 🐛 Solución de Problemas

### Error: "vercel: command not found"
- Instala Vercel CLI: `npm i -g vercel`

### Error: "Port 3000 already in use"
- Cambia el puerto: `vercel dev --listen 3001`
- O mata el proceso que usa el puerto 3000

### Los endpoints no funcionan
- Asegúrate de usar `vercel dev`, no `npm run dev`
- Verifica que estás en el directorio correcto del proyecto
- Revisa que las variables de entorno estén configuradas

---

## 💡 Resumen

**Para endpoints de API funcionando localmente:**
```bash
vercel dev
```

**Solo frontend (sin API):**
```bash
npm run dev
```

**Recomendación:** Usa `vercel dev` para tener todo funcionando completo.


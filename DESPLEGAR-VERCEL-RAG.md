# 🚀 Guía para Desplegar en Vercel

## 📋 Pasos para Desplegar

### Paso 1: Configurar Variables de Entorno en Vercel

**IMPORTANTE:** Antes de desplegar, configura las variables de entorno en Vercel.

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Ve a **Settings** → **Environment Variables**
4. Agrega las siguientes variables:

```
OPENAI_API_KEY = sk-... (tu clave de OpenAI)
SUPABASE_URL = https://... (tu URL de Supabase)
SUPABASE_ANON_KEY = eyJ... (tu clave anónima de Supabase)
SUPABASE_SERVICE_ROLE_KEY = eyJ... (tu clave de servicio de Supabase - para indexación)
```

**Asegúrate de seleccionar:**
- ✅ Production
- ✅ Preview
- ✅ Development

### Paso 2: Desplegar desde GitHub (Recomendado)

Si tu proyecto ya está conectado a GitHub:

1. Haz commit y push de tus cambios:
   ```bash
   git add .
   git commit -m "Implementación RAG completa"
   git push origin main
   ```

2. Vercel automáticamente detectará el push y desplegará

### Paso 3: Desplegar Manualmente desde Terminal

Si prefieres desplegar manualmente:

```bash
# Desde la raíz del proyecto
vercel --prod
```

La primera vez te pedirá:
- ¿Set up and deploy? → **Y** (Yes)
- ¿Link to existing project? → **Y** (si ya tienes proyecto) o **N** (si es nuevo)
- ¿What's your project's name? → Presiona Enter o escribe un nombre
- ¿In which directory is your code located? → Presiona Enter (usa `./`)

---

## ✅ Verificar Despliegue

### 1. Verificar que el Frontend Funciona

Abre tu URL de Vercel (ej: `https://tu-proyecto.vercel.app`)

Deberías ver tu aplicación funcionando.

### 2. Verificar que los Endpoints de API Funcionan

**Probar endpoint de indexación:**
```bash
curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'
```

**Probar endpoint de chat RAG:**
```bash
curl -X POST https://tu-proyecto.vercel.app/api/chat-rag \
  -H "Content-Type: application/json" \
  -d '{"message": "Busco un ahumador portátil"}'
```

---

## 🔧 Configuración de Vercel

Tu `vercel.json` ya está configurado correctamente:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/$1"
    },
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

Esto asegura que:
- ✅ Los endpoints `/api/*` funcionen correctamente
- ✅ El frontend se sirva desde `index.html`
- ✅ El build use Vite correctamente

---

## 📝 Checklist Pre-Despliegue

Antes de desplegar, verifica:

- [ ] Variables de entorno configuradas en Vercel
- [ ] `vercel.json` está en la raíz del proyecto
- [ ] Todas las dependencias están en `package.json`
- [ ] Las migraciones SQL están ejecutadas en Supabase
- [ ] El código está commiteado y pusheado (si usas GitHub)

---

## 🐛 Solución de Problemas

### Error: "Environment variable not found"
- Ve a Vercel → Settings → Environment Variables
- Verifica que todas las variables estén configuradas
- Asegúrate de seleccionar Production, Preview y Development

### Error: "Build failed"
- Revisa los logs de build en Vercel
- Verifica que `npm run build` funciona localmente
- Asegúrate de que todas las dependencias estén instaladas

### Error: "API endpoint not found"
- Verifica que `vercel.json` tiene el rewrite correcto para `/api/*`
- Asegúrate de que los archivos en `api/` tienen la extensión `.ts`
- Revisa los logs de función en Vercel

### Los endpoints funcionan pero dan error 500
- Revisa los logs de función en Vercel Dashboard
- Verifica que las variables de entorno están correctas
- Asegúrate de que Supabase está configurado correctamente

---

## 🎯 Después del Despliegue

Una vez desplegado:

1. **Indexar productos:**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/index-products-rag \
     -H "Content-Type: application/json" \
     -d '{"limit": 20}'
   ```

2. **Probar el chat RAG:**
   ```bash
   curl -X POST https://tu-proyecto.vercel.app/api/chat-rag \
     -H "Content-Type: application/json" \
     -d '{"message": "Busco un ahumador portátil"}'
   ```

3. **Verificar en el navegador:**
   - Abre tu URL de Vercel
   - Prueba el chat desde la interfaz

---

## 💡 Tips

1. **Usa GitHub Integration**: Es más fácil y automático
2. **Configura Variables de Entorno Primero**: Evita errores después del despliegue
3. **Revisa los Logs**: Si algo falla, los logs en Vercel son muy útiles
4. **Despliega a Preview Primero**: Prueba en preview antes de production

---

## 📚 Recursos

- [Documentación de Vercel](https://vercel.com/docs)
- [Vercel Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [Vercel Functions](https://vercel.com/docs/concepts/functions)

---

## ✅ Listo para Desplegar

Una vez que hayas configurado las variables de entorno, puedes desplegar:

```bash
# Opción 1: Desde GitHub (automático al hacer push)
git add .
git commit -m "Implementación RAG completa"
git push origin main

# Opción 2: Manualmente
vercel --prod
```

¡Buena suerte con el despliegue! 🚀


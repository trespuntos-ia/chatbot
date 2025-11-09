# 🔧 Solución al Error 405 (Method Not Allowed)

## 🐛 Problema Identificado

El error **HTTP 405** ocurre porque el `vercel.json` tenía un rewrite que redirigía **todas** las rutas (incluyendo `/api/*`) a `/index.html`, lo que impedía que las funciones serverless funcionaran correctamente.

## ✅ Solución Aplicada

He actualizado el `vercel.json` para que las rutas `/api/*` **no se redirijan** al frontend. Ahora las funciones serverless tienen prioridad.

## 🚀 Próximos Pasos

### 1. Redesplegar en Vercel

**Opción A: Desde Vercel Dashboard**
1. Ve a https://vercel.com/dashboard
2. Encuentra tu proyecto
3. Haz clic en "Redeploy" o haz un nuevo commit/push

**Opción B: Desde Terminal**
```bash
# Si tienes Vercel CLI instalado
vercel --prod
```

**Opción C: Hacer un commit y push**
```bash
git add vercel.json
git commit -m "Fix: API routes configuration"
git push
```

### 2. Esperar a que Vercel redespliegue

Espera 1-2 minutos a que Vercel termine el despliegue.

### 3. Probar de nuevo

```bash
bash scripts/index-product-facil.sh
```

O directamente:

```bash
curl -X POST https://chatbot-v2-murex.vercel.app/api/index-web-content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
    "content_type": "product_page"
  }'
```

### 4. Verificar que Funciona

Deberías ver una respuesta como:

```json
{
  "success": true,
  "message": "Content indexed successfully",
  "content": {
    "id": "...",
    "title": "...",
    ...
  }
}
```

## ⚠️ Si Aún No Funciona

### Verificar que las Tablas Existan

1. Ve a Supabase Dashboard → SQL Editor
2. Ejecuta el archivo `supabase-web-content-schema.sql`
3. Verifica que las tablas se crearon:
   - `web_content_index`
   - `web_content_sources`

### Verificar Variables de Entorno

1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Asegúrate de tener:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` o `SUPABASE_ANON_KEY`
3. Si las agregaste, redespliega el proyecto

### Verificar Logs de Vercel

1. Ve a Vercel Dashboard → Tu Proyecto → Deployments
2. Haz clic en el último deployment
3. Ve a "Functions" → `/api/index-web-content`
4. Revisa los logs para ver errores específicos

## 📝 Resumen

**Cambio realizado:**
- ✅ Actualizado `vercel.json` para que `/api/*` no se redirija al frontend

**Acción requerida:**
- 🔄 Redesplegar en Vercel (commit + push, o desde dashboard)

**Después del redespliegue:**
- ✅ Probar de nuevo con el script o curl
- ✅ Debería funcionar correctamente

---

¿Necesitas ayuda con el redespliegue? Avísame y te guío paso a paso.








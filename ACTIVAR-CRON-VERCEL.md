# 🔧 Cómo Activar el Cron Job en Vercel (Plan de Pago)

## ✅ Verificación de Configuración

El cron está configurado en `vercel.json`:
```json
{
  "path": "/api/index-products-rag-auto",
  "schedule": "*/5 * * * *"  // Cada 5 minutos
}
```

## 📋 Pasos para Activar el Cron en Vercel Dashboard

### 1. Ve al Dashboard de Vercel
1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2
2. Click en **"Settings"** (Configuración)
3. Busca la sección **"Cron Jobs"** en el menú lateral

### 2. Verifica que el Cron Esté Listado
Deberías ver:
- **Path**: `/api/index-products-rag-auto`
- **Schedule**: `*/5 * * * *` (cada 5 minutos)
- **Status**: Debe estar **"Enabled"** o **"Active"**

### 3. Si No Aparece el Cron
Si el cron no aparece en la lista:
1. Haz un nuevo deploy (el cron se crea automáticamente desde `vercel.json`)
2. O crea el cron manualmente:
   - Click en **"Add Cron Job"**
   - **Path**: `/api/index-products-rag-auto`
   - **Schedule**: `*/5 * * * *`
   - **Save**

### 4. Verificar que Funciona
1. Ve a **"Logs"** en el dashboard
2. Busca ejecuciones de `/api/index-products-rag-auto`
3. Deberías ver logs cada 5 minutos con:
   ```
   [index-products-rag-auto] Starting automatic indexing... Source: Vercel Cron
   ```

## 🧪 Probar Manualmente (Mientras Esperas)

Mientras verificas el cron, puedes probar manualmente:

```bash
curl "https://chatbot-v2-jz7bbddy1-tres-puntos-projects.vercel.app/api/index-products-rag-auto?manual=true"
```

O desde el dashboard, haz clic en el botón "Indexar Productos" que ahora usa el endpoint automático.

## ⚠️ Problemas Comunes

### El Cron No Se Ejecuta
1. **Verifica que esté habilitado** en Settings → Cron Jobs
2. **Verifica los logs** para ver si hay errores
3. **Espera 5 minutos** después del último deploy para la primera ejecución
4. **Verifica que el endpoint responda** con `?manual=true`

### El Cron Se Ejecuta Pero Falla
1. Revisa los logs en Vercel Dashboard → Logs
2. Busca errores relacionados con:
   - Supabase connection
   - OpenAI API limits
   - Timeout errors

## 📊 Monitoreo

### Ver Ejecuciones del Cron
1. Ve a Vercel Dashboard → Logs
2. Filtra por `/api/index-products-rag-auto`
3. Deberías ver ejecuciones cada 5 minutos

### Ver Progreso en el Dashboard
El dashboard se actualiza automáticamente cada 30 segundos y muestra:
- **Chunks**: Total de chunks indexados
- **Productos**: Productos únicos indexados

## 🎯 Estado Esperado

Cuando el cron funciona correctamente:
- ✅ Se ejecuta cada 5 minutos automáticamente
- ✅ Indexa 150 productos por ejecución
- ✅ Genera ~750-1500 chunks por ejecución
- ✅ Completa la indexación en ~40 minutos (8 ejecuciones)
- ✅ Los números aumentan en el dashboard automáticamente


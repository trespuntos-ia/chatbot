# ⚡ Configuración Rápida - Supabase en Vercel

## 📋 Credenciales de Supabase

Ya tienes las credenciales. Solo necesitas agregarlas en Vercel:

### Variables de Entorno

**1. SUPABASE_URL**
```
https://nfazwtpxrzadzrumqtnz.supabase.co
```

**2. SUPABASE_ANON_KEY**
```
eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYXp3dHB4cnphZHpydW1xdG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMDMzMDIsImV4cCI6MjA3Nzc3OTMwMn0.-__93vI6VxJ6tmCqL1WpT2mJeUvLyB3DzbGiUgEcud8
```

## 🚀 Pasos Rápidos

### 1. Ir a Vercel
👉 https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables

### 2. Agregar Variable 1
- Click en **"Add New"**
- **Name**: `SUPABASE_URL`
- **Value**: `https://nfazwtpxrzadzrumqtnz.supabase.co`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### 3. Agregar Variable 2
- Click en **"Add New"** (otra vez)
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5mYXp3dHB4cnphZHpydW1xdG56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIyMDMzMDIsImV4cCI6MjA3Nzc3OTMwMn0.-__93vI6VxJ6tmCqL1WpT2mJeUvLyB3DzbGiUgEcud8`
- **Environment**: ✅ Production, ✅ Preview, ✅ Development
- Click **Save**

### 4. Redesplegar
**Opción A: Desde Vercel Dashboard**
1. Ve a **Deployments**
2. Click en los tres puntos (⋯) del último deployment
3. Selecciona **Redeploy**

**Opción B: Desde Terminal**
```bash
cd /Users/jordi/Documents/GitHub/chatbot2
vercel --prod
```

## ✅ Verificar

Después de redesplegar (espera 1-2 minutos):

1. Ve a: https://chatbot-v2-murex.vercel.app/
2. Click en la pestaña **Productos**
3. Deberías ver los productos guardados en Supabase

## 🔍 Verificar en Supabase

1. Ve a: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
2. Ve a **Table Editor** → Tabla `products`
3. Deberías ver todos los productos guardados

## ⚠️ Si Aún No Funciona

1. **Verifica que las variables estén guardadas:**
   - Ve a Vercel → Settings → Environment Variables
   - Deberías ver ambas variables listadas

2. **Verifica que hayas hecho redeploy:**
   - Las variables solo se aplican a nuevos deployments
   - Asegúrate de haber hecho redeploy después de agregar las variables

3. **Verifica los logs:**
   - Ve a Vercel → Deployments → Último deployment → Logs
   - Busca errores relacionados con Supabase

## 📝 Notas

- ⚠️ **IMPORTANTE**: Después de agregar variables, SIEMPRE debes hacer redeploy
- Las variables se aplican solo a nuevos deployments
- Selecciona todos los ambientes (Production, Preview, Development)


# 🔧 Configuración de Variables de Entorno en Vercel

Este documento explica cómo configurar las variables de entorno de Supabase en Vercel para que la aplicación funcione correctamente.

## 📋 Variables Requeridas

Necesitas configurar estas dos variables de entorno en Vercel:

1. **`SUPABASE_URL`** - URL de tu proyecto de Supabase
2. **`SUPABASE_ANON_KEY`** - Clave pública anónima de Supabase

## 🚀 Pasos para Configurar

### Paso 1: Obtener las Credenciales de Supabase

Si ya tienes un proyecto en Supabase, obtén las credenciales:

1. Ve a https://supabase.com
2. Inicia sesión en tu cuenta
3. Selecciona tu proyecto
4. Ve a **Settings** → **API**
5. Copia estos valores:
   - **Project URL** → Esta es tu `SUPABASE_URL`
   - **anon public** key → Esta es tu `SUPABASE_ANON_KEY`

**Ejemplo de valores:**
- `SUPABASE_URL`: `https://nfazwtpxrzadzrumqtnz.supabase.co`
- `SUPABASE_ANON_KEY`: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### Paso 2: Configurar en Vercel

1. Ve al dashboard de Vercel: https://vercel.com/tres-puntos-projects/chatbot-v2
2. Haz clic en **Settings** (en el menú superior)
3. En el menú lateral, haz clic en **Environment Variables**
4. Agrega las dos variables:

#### Variable 1: SUPABASE_URL
- **Name**: `SUPABASE_URL`
- **Value**: Pega tu Project URL de Supabase
- **Environment**: ✅ Production, ✅ Preview, ✅ Development (selecciona todos)
- Haz clic en **Save**

#### Variable 2: SUPABASE_ANON_KEY
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: Pega tu anon public key de Supabase
- **Environment**: ✅ Production, ✅ Preview, ✅ Development (selecciona todos)
- Haz clic en **Save**

### Paso 3: Redesplegar la Aplicación

Después de agregar las variables, necesitas redesplegar:

**Opción A: Desde Vercel Dashboard**
1. Ve a la pestaña **Deployments**
2. Encuentra el último deployment
3. Haz clic en los tres puntos (⋯) → **Redeploy**

**Opción B: Desde Terminal**
```bash
cd /Users/jordi/Documents/GitHub/chatbot2
vercel --prod
```

## ✅ Verificación

Después de redesplegar:

1. Ve a tu aplicación: https://chatbot-v2-murex.vercel.app/
2. Ve a la pestaña **Productos** del dashboard
3. Deberías poder ver los productos guardados en Supabase
4. Si aún ves el mensaje de error, espera 1-2 minutos y recarga la página

## 🔍 Verificar que las Variables Están Configuradas

Puedes verificar que las variables están configuradas correctamente:

1. En Vercel, ve a **Settings** → **Environment Variables**
2. Deberías ver ambas variables listadas
3. Si faltan, agrégalas siguiendo el Paso 2

## ⚠️ Solución de Problemas

### Error: "Supabase configuration missing"
- **Causa**: Las variables no están configuradas en Vercel
- **Solución**: Sigue los pasos anteriores para agregar las variables

### Error: "Error fetching products"
- **Causa**: Las variables están mal configuradas o la tabla no existe
- **Solución**: 
  1. Verifica que las variables tienen los valores correctos
  2. Asegúrate de haber ejecutado el script `supabase-schema.sql` en Supabase
  3. Verifica en Supabase que la tabla `products` existe

### Las variables están configuradas pero no funcionan
- **Causa**: El deployment no se actualizó con las nuevas variables
- **Solución**: Haz un redeploy completo (ver Paso 3)

## 📝 Notas Importantes

- ⚠️ **IMPORTANTE**: Después de agregar/modificar variables de entorno, SIEMPRE debes redesplegar
- Las variables de entorno se aplican solo a nuevos deployments
- Asegúrate de seleccionar todos los ambientes (Production, Preview, Development)
- Las variables son sensibles - no las compartas públicamente

## 🆘 ¿Necesitas Ayuda?

Si sigues teniendo problemas:

1. Verifica los logs de Vercel:
   - Ve a **Deployments** → Selecciona el último deployment → **Logs**
   - Busca errores relacionados con Supabase

2. Verifica en Supabase:
   - Ve a **Table Editor** → Verifica que la tabla `products` existe
   - Ve a **Settings** → **API** → Verifica que las credenciales son correctas

3. Contacta al equipo si el problema persiste


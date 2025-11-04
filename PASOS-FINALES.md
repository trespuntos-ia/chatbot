# 🎯 Pasos Finales para Completar la Configuración

## ✅ Paso 1: Proyecto Creado
- [x] Proyecto "Chatbot" creado en Supabase
- [x] Contraseña guardada

## 📋 Paso 2: Obtener Credenciales (2 minutos)

1. Ve a tu proyecto en Supabase
2. En el menú lateral, ve a **Settings** → **API**
3. Encontrarás dos valores importantes:

   **a) Project URL:**
   - Busca "Project URL" o "API URL"
   - Se ve así: `https://xxxxxxxxxxxxx.supabase.co`
   - Copia este valor completo

   **b) anon public key:**
   - Busca "Project API keys"
   - Encuentra la que dice "anon" o "public"
   - Copia esta clave (es una cadena larga)

## 🗄️ Paso 3: Crear la Tabla (3 minutos)

1. En Supabase, ve a **SQL Editor** (menú lateral)
2. Click en **"New query"** (botón verde)
3. Abre el archivo `supabase-schema.sql` de este proyecto
4. **Copia TODO el contenido** del archivo
5. Pégalo en el editor SQL de Supabase
6. Click en **"Run"** (o presiona Cmd/Ctrl + Enter)
7. Deberías ver un mensaje de éxito ✅

## ⚙️ Paso 4: Configurar Vercel (2 opciones)

### Opción A: Automático (Recomendado)

Ejecuta este comando y sigue las instrucciones:

```bash
cd /Users/jordi/Documents/GitHub/chatbot2
./configure-vercel-env.sh
```

Te pedirá las credenciales y configurará todo automáticamente.

### Opción B: Manual

1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
2. Click en **"Add New"**
3. Agrega estas dos variables:

   **Variable 1:**
   - Name: `SUPABASE_URL`
   - Value: (tu Project URL)
   - Environment: ✅ Production, ✅ Preview, ✅ Development

   **Variable 2:**
   - Name: `SUPABASE_ANON_KEY`
   - Value: (tu anon public key)
   - Environment: ✅ Production, ✅ Preview, ✅ Development

4. Guarda los cambios

## 🚀 Paso 5: Redesplegar

Si usaste la Opción B (manual), ejecuta:

```bash
cd /Users/jordi/Documents/GitHub/chatbot2
vercel --prod
```

O desde el dashboard de Vercel, haz click en **"Redeploy"**

## ✅ Verificación

1. Ve a: https://chatbot-v2-murex.vercel.app/
2. Conecta con PrestaShop y carga productos
3. Click en **"Guardar en Base de Datos"**
4. Deberías ver: "¡Éxito! Se guardaron X productos en la base de datos"

## 🔍 Verificar en Supabase

1. Ve a tu proyecto en Supabase
2. Ve a **Table Editor** (menú lateral)
3. Deberías ver la tabla `products`
4. Los productos guardados aparecerán ahí

## 📝 Notas

- La contraseña de la base de datos que me diste es para acceso directo a PostgreSQL
- Para la aplicación usamos el `anon public key` que es más seguro
- Los productos se actualizan automáticamente si ya existen (por SKU)

---

**¿Necesitas ayuda?** Comparte tu SUPABASE_URL y SUPABASE_ANON_KEY y puedo configurarlo por ti.


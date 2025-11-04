# 🚀 Configuración Rápida de Supabase

## Opción 1: Configuración Manual (Recomendado)

### Paso 1: Crear proyecto en Supabase
1. Ve a https://supabase.com
2. Inicia sesión o crea cuenta
3. Click en "New Project"
4. Completa:
   - **Name**: `prestashop-products` (o el que prefieras)
   - **Database Password**: (guarda esta contraseña)
   - **Region**: Elige la más cercana
5. Espera 2-3 minutos a que se cree el proyecto

### Paso 2: Obtener credenciales
1. En tu proyecto, ve a **Settings** → **API**
2. Copia estos valores:
   - **Project URL** (ejemplo: `https://xxxxx.supabase.co`)
   - **anon public** key (una cadena larga)

### Paso 3: Crear la tabla
1. En Supabase, ve a **SQL Editor** (menú lateral)
2. Click en "New query"
3. Abre el archivo `supabase-schema.sql` de este proyecto
4. Copia TODO el contenido
5. Pégalo en el editor SQL
6. Click en "Run" (o presiona Cmd/Ctrl + Enter)

### Paso 4: Configurar Vercel
1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
2. Click en "Add New"
3. Agrega estas dos variables:

**Variable 1:**
- **Name**: `SUPABASE_URL`
- **Value**: (tu Project URL de Supabase)
- **Environment**: Production, Preview, Development (selecciona todos)

**Variable 2:**
- **Name**: `SUPABASE_ANON_KEY`
- **Value**: (tu anon public key de Supabase)
- **Environment**: Production, Preview, Development (selecciona todos)

4. Guarda los cambios

### Paso 5: Redesplegar
Desde terminal:
```bash
cd /Users/jordi/Documents/GitHub/chatbot2
vercel --prod
```

O desde el dashboard de Vercel, click en "Redeploy"

## Opción 2: Usando Supabase CLI (Avanzado)

Si prefieres usar la CLI:

```bash
# Instalar Supabase CLI (si no está instalado)
npm install -g supabase

# Login
supabase login

# Link tu proyecto
supabase link --project-ref tu-project-ref

# Ejecutar el schema
supabase db push
```

## ✅ Verificación

Una vez configurado:

1. Ve a tu aplicación: https://chatbot-v2-murex.vercel.app/
2. Carga productos desde PrestaShop
3. Click en "Guardar en Base de Datos"
4. Deberías ver un mensaje de éxito

## 🔍 Verificar en Supabase

1. Ve a tu proyecto en Supabase
2. Ve a **Table Editor**
3. Deberías ver la tabla `products`
4. Los productos guardados aparecerán ahí

## 📝 Notas

- Los productos se actualizan automáticamente si ya existen (por SKU)
- La tabla tiene índices para búsquedas rápidas
- Las políticas RLS están configuradas para permitir lectura/escritura pública
- Puedes ajustar las políticas de seguridad después según tus necesidades


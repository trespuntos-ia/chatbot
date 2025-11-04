# 📋 Instrucciones Paso a Paso - Configuración del Historial de Actualizaciones

Sigue estos pasos en orden para configurar el sistema de sincronización automática de productos.

## ✅ Paso 1: Crear las Tablas en Supabase

1. Ve a tu proyecto en [Supabase](https://supabase.com)
2. Abre el **SQL Editor** (menú lateral izquierdo)
3. Haz clic en **New Query**
4. Abre el archivo `supabase-sync-history-schema.sql` que está en la raíz del proyecto
5. Copia **TODO el contenido** del archivo
6. Pégalo en el editor SQL de Supabase
7. Haz clic en **Run** (o presiona `Ctrl/Cmd + Enter`)
8. Verifica que aparezca el mensaje "Success. No rows returned"

**¿Qué se creó?**
- Tabla `prestashop_connections`: Para guardar las credenciales de PrestaShop
- Tabla `product_sync_history`: Para guardar el historial de sincronizaciones
- Índices y políticas de seguridad (RLS)

---

## ✅ Paso 2: Configurar Variables de Entorno en Vercel

1. Ve a tu proyecto en [Vercel](https://vercel.com)
2. Ve a **Settings** → **Environment Variables**
3. Añade una nueva variable:
   - **Name**: `CRON_SECRET`
   - **Value**: Genera un token secreto (puedes usar: https://www.random.org/strings/?num=1&len=32&digits=on&upperalpha=on&loweralpha=on&unique=on&format=html&rnd=new)
     - O ejecuta en terminal: `openssl rand -hex 32`
   - **Environments**: Marca todas (Production, Preview, Development)
4. Haz clic en **Save**
5. **IMPORTANTE**: Si ya tienes el proyecto desplegado, necesitas hacer un nuevo deploy para que la variable tome efecto

**⚠️ Nota**: Guarda este token en un lugar seguro, lo necesitarás para pruebas manuales.

---

## ✅ Paso 3: Configurar una Conexión de PrestaShop

1. Despliega los cambios en Vercel (si aún no lo has hecho)
2. Ve a tu aplicación desplegada (o ejecútala localmente con `npm run dev`)
3. Inicia sesión o accede al Dashboard
4. Ve a la pestaña **"Conexiones"**
5. Completa el formulario con:
   - **URL API PrestaShop**: `https://tu-tienda.com/shop/api/`
   - **API Key**: Tu API key de PrestaShop
   - **URL Base** (opcional): `https://tu-tienda.com/shop/`
   - **Código de Idioma**: `1` (por defecto)
   - **Slug de Idioma**: `es` (por defecto)
6. Haz clic en **"Conectar"** o el botón de autenticación
7. La conexión se guardará automáticamente en Supabase

**✅ Verificación**: 
- Ve a Supabase → Table Editor → `prestashop_connections`
- Deberías ver tu conexión con `is_active = true`

---

## ✅ Paso 4: Configurar el Cron Job en Vercel

El archivo `vercel.json` ya está configurado con el cron job. Solo necesitas verificar:

1. Ve a Vercel → Tu Proyecto → **Settings** → **Cron Jobs**
2. Deberías ver un cron job configurado:
   - **Path**: `/api/sync-products-cron`
   - **Schedule**: `50 23 * * *` (23:50 todos los días, hora UTC)
3. Si no aparece, el cron se creará automáticamente en el próximo deploy

**⚠️ Nota sobre la hora**:
- El cron usa hora UTC (Coordinated Universal Time)
- `23:50 UTC` = `00:50 CET` (madrugada en España)
- Si quieres cambiar la hora, edita `vercel.json` y cambia `"50 23 * * *"` por la hora que prefieras
- Formato cron: `minuto hora día mes día-semana`
- Ejemplo para 23:50 hora local (ajusta según tu zona): `"50 22 * * *"` (para UTC-1)

---

## ✅ Paso 5: Probar la Sincronización Manualmente

Antes de esperar al cron automático, puedes probar manualmente:

1. Obtén tu `CRON_SECRET` de las variables de entorno de Vercel
2. Abre tu navegador o usa curl:

**Opción A - Navegador:**
\`\`\`
https://tu-dominio.vercel.app/api/sync-products-cron?manual=true&token=TU_CRON_SECRET
\`\`\`

**Opción B - Terminal (curl):**
\`\`\`bash
curl -X GET "https://tu-dominio.vercel.app/api/sync-products-cron?manual=true&token=TU_CRON_SECRET"
\`\`\`

**✅ Verificación**:
- Si funciona, deberías ver un JSON con `"success": true`
- Ve a la pestaña **"Historial"** en el Dashboard
- Deberías ver una nueva entrada con la sincronización

---

## ✅ Paso 6: Ver el Historial

1. Ve al Dashboard de tu aplicación
2. Haz clic en la pestaña **"Historial"** (icono de reloj)
3. Verás todas las sincronizaciones realizadas con:
   - **Estado**: Completado, Fallido, o En Proceso
   - **Estadísticas**: Productos escaneados, nuevos, importados, errores
   - **Log detallado**: Haz clic en "Ver Detalles" para ver el log completo
   - **Errores**: Si hay errores, se mostrarán en rojo

---

## 🔧 Solución de Problemas

### ❌ Error: "No active PrestaShop connection found"

**Solución**:
1. Ve a la pestaña "Conexiones" en el Dashboard
2. Configura y guarda una conexión
3. Verifica en Supabase que la conexión tenga `is_active = true`

### ❌ Error: "Supabase configuration missing"

**Solución**:
1. Verifica que tengas las variables `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Vercel
2. Si faltan, añádelas en Settings → Environment Variables

### ❌ El cron no se ejecuta

**Solución**:
1. Verifica en Vercel → Settings → Cron Jobs que el cron esté configurado
2. Revisa los logs de Vercel para ver errores
3. Asegúrate de tener un deploy reciente (el cron se configura en el deploy)

### ❌ Error de permisos en Supabase

**Solución**:
1. Ve a Supabase → Authentication → Policies
2. Verifica que las tablas `prestashop_connections` y `product_sync_history` tengan políticas que permitan SELECT, INSERT, UPDATE
3. Si faltan, ejecuta de nuevo el SQL del Paso 1 (las políticas se crean automáticamente)

---

## 🎉 ¡Listo!

Una vez completados estos pasos:
- ✅ La sincronización se ejecutará automáticamente cada noche
- ✅ Podrás ver todo el historial en el Dashboard
- ✅ Los productos nuevos se importarán automáticamente

**Próxima sincronización automática**: Mañana a las 23:50 UTC (o la hora que configuraste)

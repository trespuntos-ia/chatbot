# 🔧 Solución al Error 500 al Guardar Productos

## Problema
El error 500 "Error saving products to database" generalmente ocurre por:

1. **La tabla no existe** (más común)
2. **Problemas de permisos RLS** en Supabase
3. **Variables de entorno no configuradas**

## ✅ Solución Paso a Paso

### 1. Verificar que la tabla existe

**En Supabase:**
1. Ve a tu proyecto: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
2. Ve a **Table Editor** (menú lateral)
3. ¿Ves la tabla `products`?
   - ✅ **SÍ**: Continúa al paso 2
   - ❌ **NO**: Necesitas ejecutar el SQL

### 2. Si la tabla NO existe - Ejecutar SQL

1. Ve a **SQL Editor** en Supabase
2. Click en **"New query"**
3. Abre el archivo `supabase-schema.sql` de este proyecto
4. **Copia TODO el contenido**
5. Pégalo en el editor SQL
6. Click en **"Run"** (o Cmd/Ctrl + Enter)
7. Deberías ver: "Success. No rows returned"

### 3. Verificar Políticas RLS

1. En Supabase, ve a **Authentication** → **Policies**
2. Busca la tabla `products`
3. Deberías tener estas políticas:
   - "Allow public read access" (SELECT)
   - "Allow public insert access" (INSERT)
   - "Allow public update access" (UPDATE)

Si no existen, ejecuta estas líneas en SQL Editor:

```sql
CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON products
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON products
  FOR UPDATE USING (true);
```

### 4. Verificar Variables de Entorno en Vercel

1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
2. Verifica que existan:
   - `SUPABASE_URL` = `https://nfazwtpxrzadzrumqtnz.supabase.co`
   - `SUPABASE_ANON_KEY` = (tu anon key)

### 5. Probar de Nuevo

1. Ve a: https://chatbot-v2-murex.vercel.app/
2. Carga productos
3. Click en "Guardar en Base de Datos"
4. Ahora deberías ver un mensaje más específico si hay error

## 🔍 Mensajes de Error Mejorados

Ahora el sistema te dirá exactamente qué está mal:

- **"Tabla no encontrada"** → Ejecuta el SQL
- **"Problema de permisos"** → Verifica las políticas RLS
- **Código específico** → Te indicará el problema exacto

## 📝 Verificación Rápida

Ejecuta esta query en SQL Editor de Supabase para verificar:

```sql
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'products';
```

Deberías ver todas las columnas de la tabla.


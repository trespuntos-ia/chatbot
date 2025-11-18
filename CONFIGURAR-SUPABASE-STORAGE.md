# Configuración de Supabase Storage para Documentos

## Problema Resuelto

El error 520 de Cloudflare ocurría porque los archivos grandes se estaban almacenando directamente en la base de datos como BYTEA, causando timeouts. La solución es usar **Supabase Storage** para almacenar los archivos y solo guardar la URL en la base de datos.

## Pasos para Configurar

### 1. Crear o Verificar el Bucket de Storage

**Si ves "Create a file bucket" en la pantalla:**

1. Haz clic en el botón **"+ New bucket"** (verde)
2. Configura el bucket:
   - **Name**: `documents` (exactamente así, en minúsculas)
   - **Public bucket**: ✅ **Marca esta opción** (muy importante para acceso público)
   - Haz clic en **Create bucket**

**Si ya tienes buckets creados:**

1. Busca el bucket `documents` en la lista
2. Si no existe, créalo siguiendo los pasos de arriba
3. Si existe, verifica que sea **público** (debería tener un icono de "globo" o estar marcado como público)
   - Si no es público, haz clic en el bucket → **Settings** → marca "Public bucket"

### 2. Verificar/Configurar Políticas de Storage

**IMPORTANTE**: Las políticas de Storage NO se configuran en el Table Editor. Siguen estos pasos:

1. En Supabase Dashboard, ve a **Storage** (en el menú lateral izquierdo, NO a "Table Editor")
2. Haz clic en el bucket `documents`
3. Ve a la pestaña **Policies** (en la parte superior del bucket)
4. Verifica que existan las siguientes políticas (si no existen, créalas usando el SQL Editor):

#### Cómo crear las políticas:

**Opción A: Desde la interfaz de Storage**
1. En la pestaña **Policies** del bucket `documents`
2. Haz clic en **New Policy**
3. Selecciona el tipo de política (SELECT, INSERT, DELETE)
4. Configura los permisos según corresponda

**Opción B: Desde el SQL Editor** (más rápido)
1. Ve a **SQL Editor** en Supabase Dashboard
2. Ejecuta estas consultas una por una:

```sql
-- Primero eliminar políticas existentes (si las hay)
DROP POLICY IF EXISTS "Allow public read access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public insert access" ON storage.objects;
DROP POLICY IF EXISTS "Allow public delete access" ON storage.objects;

-- Luego crear las políticas nuevas

-- Política de Lectura (SELECT)
CREATE POLICY "Allow public read access"
ON storage.objects FOR SELECT
USING (bucket_id = 'documents');

-- Política de Escritura (INSERT)
CREATE POLICY "Allow public insert access"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'documents');

-- Política de Eliminación (DELETE)
CREATE POLICY "Allow public delete access"
ON storage.objects FOR DELETE
USING (bucket_id = 'documents');
```

**Nota**: 
- Las políticas de Storage son diferentes a las políticas RLS de las tablas
- Si ya tienes políticas configuradas, verifica que permitan acceso público o que funcionen con tu configuración actual
- Puedes verificar las políticas existentes en Storage → documents → Policies

### 3. Ejecutar la Migración de Base de Datos

Ejecuta la migración que agrega la columna `file_url`:

```bash
# Si usas Supabase CLI
supabase db push

# O ejecuta manualmente en el SQL Editor de Supabase:
```

El archivo está en: `supabase/migrations/005_add_file_url_to_documents.sql`

### 4. Configurar Variables de Entorno en Vercel (Opcional)

Si quieres usar la Service Role Key para Storage (recomendado para producción):

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **Environment Variables**
3. Agrega:
   - `SUPABASE_SERVICE_ROLE_KEY`: Tu Service Role Key de Supabase
     - Puedes encontrarla en: Supabase Dashboard → Settings → API → `service_role` key

**Nota**: El código funciona sin esta variable, pero usar la Service Role Key es más seguro y confiable para producción.

## Cómo Funciona Ahora

1. **Intento de Storage**: El código intenta subir el archivo a Supabase Storage primero
2. **Fallback a Base de Datos**: Si Storage falla o no está configurado, usa el método anterior (BYTEA)
3. **Almacenamiento**: 
   - Si Storage funciona: Guarda la URL en `file_url`
   - Si Storage falla: Guarda el contenido binario en `file_content` (método anterior)

## Ventajas de Usar Storage

- ✅ **Sin timeouts**: Los archivos grandes no causan problemas de conexión
- ✅ **Mejor rendimiento**: La base de datos no se llena con archivos binarios
- ✅ **Escalabilidad**: Storage está optimizado para archivos
- ✅ **URLs públicas**: Fácil acceso a los archivos desde cualquier lugar

## Verificación

Después de configurar:

1. Intenta subir un documento desde la interfaz
2. Revisa los logs en Vercel para ver si se está usando Storage
3. Verifica en Supabase Storage que el archivo se haya subido correctamente
4. Verifica en la base de datos que `file_url` tenga un valor

## Solución de Problemas

### Error: "Bucket not found"
- Verifica que el bucket se llame exactamente `documents`
- Verifica que las políticas estén configuradas correctamente

### Error: "Permission denied"
- Verifica que las políticas de Storage estén creadas
- Verifica que el bucket sea público o que las políticas permitan acceso

### Sigue usando BYTEA (fallback)
- Esto es normal si Storage no está configurado
- El código funcionará, pero puede tener problemas con archivos muy grandes
- Configura Storage para mejor rendimiento


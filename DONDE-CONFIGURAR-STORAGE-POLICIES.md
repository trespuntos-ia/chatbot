# Dónde Configurar las Políticas de Storage

## ❌ NO es en el Table Editor

El **Table Editor** es para ver y editar datos de las **tablas de base de datos** (como `documents`, `products`, etc.). Las políticas que ves ahí (RLS policies) son para controlar acceso a las tablas, NO para Storage.

## ✅ Es en la sección Storage

Las políticas de Storage se configuran en una sección completamente diferente:

### Pasos Visuales:

1. **Abre Supabase Dashboard**
   - Ve a https://app.supabase.com
   - Selecciona tu proyecto

2. **Ve a Storage** (menú lateral izquierdo)
   - Busca el icono de "Storage" o "Almacenamiento"
   - NO vayas a "Table Editor"

3. **Selecciona el bucket `documents`**
   - Verás una lista de buckets
   - Haz clic en `documents`

4. **Ve a la pestaña "Policies"**
   - En la parte superior del bucket verás pestañas como: "Files", "Policies", "Settings"
   - Haz clic en **"Policies"**

5. **Crea o verifica las políticas**
   - Verás las políticas existentes (si las hay)
   - Puedes crear nuevas desde aquí o usar el SQL Editor

## Diferencia entre Storage Policies y RLS Policies

| Tipo | Dónde se configura | Para qué sirve |
|------|-------------------|----------------|
| **RLS Policies** (Table Editor) | Table Editor → Tabla → RLS policies | Controla acceso a filas de tablas (SELECT, INSERT, UPDATE, DELETE en tablas) |
| **Storage Policies** | Storage → Bucket → Policies | Controla acceso a archivos en Storage (subir, leer, eliminar archivos) |

## Método Recomendado: SQL Editor

La forma más rápida es usar el **SQL Editor**:

1. Ve a **SQL Editor** en Supabase Dashboard
2. Ejecuta las consultas SQL que están en `CONFIGURAR-SUPABASE-STORAGE.md`
3. Las políticas se crearán automáticamente

## Verificación

Para verificar que las políticas están creadas:

1. Ve a **Storage** → `documents` → **Policies**
2. Deberías ver 3 políticas:
   - "Allow public read access" (SELECT)
   - "Allow public insert access" (INSERT)
   - "Allow public delete access" (DELETE)

Si no las ves, créalas usando el SQL Editor.


# 🔧 Instrucciones para Agregar Política DELETE en Supabase

## ❌ Error Común

Si ves un error como:
```
ERROR: 42601: syntax error at or near "import"
```

Esto significa que estás intentando ejecutar un archivo TypeScript en Supabase. Supabase solo ejecuta SQL, no TypeScript.

## ✅ Solución Correcta

### Paso 1: Ir a Supabase SQL Editor

1. Ve a: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
2. Haz clic en **SQL Editor** (en el menú lateral izquierdo)
3. Haz clic en **New query**

### Paso 2: Copiar y Pegar SOLO este código SQL

**NO copies código TypeScript**. Solo copia esto:

```sql
-- Agregar política DELETE a la tabla products
CREATE POLICY "Allow public delete access" ON products
  FOR DELETE USING (true);
```

### Paso 3: Ejecutar

1. Pega el código SQL en el editor
2. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)
3. Deberías ver un mensaje de éxito

## ✅ Verificar que Funciona

Después de ejecutar el SQL:

1. Ve a la aplicación
2. Haz clic en "Limpiar Base de Datos"
3. Debería eliminar todos los productos
4. Verifica en la pestaña "Productos" que ya no aparecen

## 📝 Nota

- El archivo `api/clear-products.ts` es código TypeScript para Vercel, **NO lo ejecutes en Supabase**
- Solo ejecuta código SQL en Supabase SQL Editor
- El archivo `supabase-add-delete-policy.sql` contiene el SQL correcto


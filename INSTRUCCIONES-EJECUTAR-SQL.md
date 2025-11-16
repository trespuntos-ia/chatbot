# 📝 Instrucciones para Ejecutar el SQL y Añadir la Columna

## 🚨 Error Actual

Estás viendo este error porque la columna `has_web_content` aún no existe en la tabla `products`.

## ✅ Solución: Ejecutar el SQL

### Paso 1: Abrir Supabase SQL Editor

1. Ve a tu proyecto en Supabase Dashboard
2. Haz clic en **"SQL Editor"** en el menú lateral
3. Haz clic en **"New query"** o **"+"**

### Paso 2: Copiar y Pegar el SQL

1. Abre el archivo `supabase-add-web-content-flag.sql` en tu editor
2. Copia **TODO** el contenido del archivo
3. Pégalo en el SQL Editor de Supabase

### Paso 3: Ejecutar

1. Haz clic en **"Run"** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)
2. Espera a que termine (debería tardar unos segundos)

### Paso 4: Verificar

Ejecuta esta query para verificar:

```sql
SELECT 
    COUNT(*) as total_productos,
    COUNT(*) FILTER (WHERE has_web_content = true) as con_contenido_web,
    COUNT(*) FILTER (WHERE has_web_content = false OR has_web_content IS NULL) as sin_contenido_web
FROM products;
```

Deberías ver algo como:
```
total_productos | con_contenido_web | sin_contenido_web
----------------|-------------------|-------------------
    1200        |       1063        |        137
```

## 🔧 Solución Temporal (Ya Aplicada)

He actualizado la API para que funcione **con o sin** la columna. Si la columna no existe, calculará dinámicamente si hay contenido web. Pero es más eficiente tener la columna.

## 📋 Contenido del SQL (para referencia)

El SQL hace lo siguiente:

1. ✅ Añade la columna `has_web_content BOOLEAN DEFAULT false`
2. ✅ Crea un índice para búsquedas rápidas
3. ✅ Actualiza productos existentes que ya tienen contenido web
4. ✅ Crea un trigger automático que actualiza el flag cuando se indexa contenido
5. ✅ Muestra estadísticas al final

## ⚠️ Si Tienes Problemas

### Error: "relation products does not exist"
- Ejecuta primero `supabase-schema.sql` para crear la tabla

### Error: "relation web_content_index does not exist"
- Ejecuta primero `supabase-web-content-schema.sql` para crear la tabla de contenido web

### Error: "permission denied"
- Verifica que tengas permisos de administrador en Supabase
- O usa el Service Key en lugar del Anon Key

## 🎯 Después de Ejecutar

Una vez ejecutado el SQL:

1. ✅ La API funcionará correctamente
2. ✅ El campo `has_web_content` estará disponible en todos los productos
3. ✅ Se actualizará automáticamente cuando se indexe contenido web
4. ✅ Podrás filtrar productos con/sin contenido web

---

**¿Necesitas ayuda?** Si tienes problemas al ejecutar el SQL, comparte el error que ves.











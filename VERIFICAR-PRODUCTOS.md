# ✅ Cómo Verificar que los Productos se Guardaron en Supabase

## Opción 1: Desde Table Editor (Más Fácil)

1. Ve a tu proyecto en Supabase:
   https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz

2. En el menú lateral, click en **"Table Editor"**

3. Selecciona la tabla **"products"**

4. Deberías ver todos los productos guardados con:
   - id
   - name
   - price
   - category
   - description
   - sku
   - image_url
   - product_url
   - created_at
   - updated_at

5. Puedes:
   - Ver el total de registros en la parte superior
   - Buscar productos específicos
   - Filtrar por categoría
   - Ver detalles de cada producto

## Opción 2: Desde SQL Editor (Más Detallado)

1. Ve a **SQL Editor** en Supabase

2. Ejecuta esta query para ver el total:

```sql
SELECT COUNT(*) as total_productos FROM products;
```

3. Para ver los primeros 10 productos:

```sql
SELECT 
  id,
  name,
  price,
  category,
  sku,
  created_at
FROM products
ORDER BY created_at DESC
LIMIT 10;
```

4. Para buscar un producto específico:

```sql
SELECT * FROM products 
WHERE name ILIKE '%nombre_producto%';
```

5. Para ver productos por categoría:

```sql
SELECT category, COUNT(*) as cantidad
FROM products
GROUP BY category
ORDER BY cantidad DESC;
```

6. Para ver los últimos productos guardados:

```sql
SELECT 
  name,
  price,
  category,
  sku,
  created_at,
  updated_at
FROM products
ORDER BY updated_at DESC
LIMIT 20;
```

## Opción 3: Desde la Aplicación (Próximamente)

Podríamos agregar una función para ver los productos guardados directamente desde la app.

## 📊 Estadísticas Rápidas

Ejecuta esta query para ver un resumen:

```sql
SELECT 
  COUNT(*) as total_productos,
  COUNT(DISTINCT category) as total_categorias,
  COUNT(DISTINCT sku) as productos_unicos,
  MIN(created_at) as primer_producto,
  MAX(updated_at) as ultima_actualizacion
FROM products;
```

## 🔍 Verificar un Producto Específico

Si quieres verificar un producto que acabas de guardar:

```sql
SELECT * FROM products 
WHERE sku = 'TU_SKU_AQUI'
ORDER BY updated_at DESC
LIMIT 1;
```

## ⚠️ Si no ves productos

1. Verifica que la tabla existe:
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_name = 'products';
```

2. Verifica que las políticas RLS están activas:
```sql
SELECT * FROM pg_policies 
WHERE tablename = 'products';
```

3. Revisa los logs en Vercel para ver si hubo errores


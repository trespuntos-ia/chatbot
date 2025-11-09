# 📋 Cómo Usar la Columna `has_web_content`

## ✅ ¿Qué hace esta columna?

La columna `has_web_content` en la tabla `products` indica si un producto tiene contenido web indexado disponible (información adicional de la página web del producto).

## 🚀 Pasos para Implementar

### 1. Ejecutar el SQL en Supabase

```sql
-- Ejecuta el archivo supabase-add-web-content-flag.sql en Supabase SQL Editor
```

Esto:
- ✅ Añade la columna `has_web_content` a la tabla `products`
- ✅ Crea un índice para búsquedas rápidas
- ✅ Actualiza productos existentes que ya tienen contenido web
- ✅ Crea un trigger automático que actualiza el flag cuando se indexa contenido web

### 2. Verificar que Funcionó

```sql
-- Ver estadísticas
SELECT 
    COUNT(*) as total_productos,
    COUNT(*) FILTER (WHERE has_web_content = true) as con_contenido_web,
    COUNT(*) FILTER (WHERE has_web_content = false OR has_web_content IS NULL) as sin_contenido_web
FROM products;

-- Ver algunos productos con contenido web
SELECT id, name, has_web_content, product_url
FROM products
WHERE has_web_content = true
LIMIT 10;

-- Ver productos sin contenido web
SELECT id, name, has_web_content, product_url
FROM products
WHERE has_web_content = false OR has_web_content IS NULL
LIMIT 10;
```

### 3. La API ya está actualizada

La API `GET /api/get-products` ya incluye el campo `has_web_content` en los resultados.

## 📊 Uso en el Frontend

### Ejemplo: Mostrar un badge/indicador

```typescript
// En tu componente de productos
interface Product {
  id: number;
  name: string;
  price: string;
  has_web_content?: boolean; // Nuevo campo
  // ... otros campos
}

// En el render
{product.has_web_content && (
  <span className="badge badge-info">
    📚 Info adicional disponible
  </span>
)}
```

### Ejemplo: Filtrar productos con contenido web

```typescript
// Filtrar solo productos con contenido web
const productsWithWebContent = products.filter(p => p.has_web_content);

// O en la query de Supabase
const { data } = await supabase
  .from('products')
  .select('*')
  .eq('has_web_content', true);
```

## 🔄 Actualización Automática

El flag se actualiza automáticamente gracias al trigger:

- ✅ **Cuando se indexa contenido web** → `has_web_content = true`
- ✅ **Cuando se elimina contenido web** → `has_web_content = false` (si no hay más contenido)
- ✅ **Cuando se desactiva contenido web** → `has_web_content = false` (si no hay más activo)

## 📝 Consultas Útiles

### Ver productos con contenido web

```sql
SELECT 
    p.id,
    p.name,
    p.price,
    p.has_web_content,
    wci.title as web_title,
    wci.last_scraped_at
FROM products p
INNER JOIN web_content_index wci ON wci.product_id = p.id
WHERE p.has_web_content = true
ORDER BY wci.last_scraped_at DESC
LIMIT 20;
```

### Ver productos que necesitan indexación

```sql
SELECT 
    p.id,
    p.name,
    p.product_url
FROM products p
WHERE (p.has_web_content = false OR p.has_web_content IS NULL)
AND p.product_url IS NOT NULL
AND p.product_url != ''
LIMIT 50;
```

### Actualizar manualmente todos los flags

```sql
-- Si necesitas actualizar todos los flags manualmente
UPDATE products p
SET has_web_content = EXISTS (
    SELECT 1 
    FROM web_content_index wci 
    WHERE wci.product_id = p.id 
    AND wci.status = 'active'
);
```

## 🎯 Beneficios

1. **Fácil identificación**: Sabes rápidamente qué productos tienen información adicional
2. **Filtrado eficiente**: Puedes filtrar productos con/sin contenido web
3. **Actualización automática**: No necesitas mantener el flag manualmente
4. **Mejor UX**: Puedes mostrar badges/indicadores en el frontend

---

**¡Listo!** Después de ejecutar el SQL, la columna estará disponible y funcionando automáticamente.








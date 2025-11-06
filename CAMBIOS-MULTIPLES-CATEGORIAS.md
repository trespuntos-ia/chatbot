# 🔄 Cambios Implementados: Múltiples Categorías por Producto

## 📋 Resumen

Se ha modificado el sistema de sincronización para que cada producto pueda tener **múltiples categorías** en lugar de solo una. Esto permite una mejor indexación y búsqueda de productos.

## 🎯 Problema Resuelto

**Antes:**
- Solo se guardaba la categoría principal (primera categoría encontrada)
- Se perdía información de categorías adicionales
- Los productos con múltiples categorías no se indexaban correctamente

**Ahora:**
- Se obtienen y procesan **TODAS** las categorías asociadas a cada producto
- Se guardan todas las categorías en formato JSON estructurado
- Se mantiene compatibilidad con la categoría principal para búsquedas existentes

## 📝 Cambios Realizados

### 1. Base de Datos - Nueva Columna `all_categories`

**Archivo:** `supabase-add-all-categories.sql`

Se agregó una nueva columna JSONB para almacenar todas las categorías:

```sql
ALTER TABLE products ADD COLUMN all_categories JSONB DEFAULT '[]'::jsonb;
```

**Estructura de datos:**
```json
[
  {
    "category": "Alimentación",
    "subcategory": "Aceites",
    "subsubcategory": "Ecológicos",
    "hierarchy": ["Alimentación", "Aceites", "Ecológicos"],
    "category_id": 123,
    "is_primary": true
  },
  {
    "category": "Productos Orgánicos",
    "subcategory": "Certificados",
    "subsubcategory": null,
    "hierarchy": ["Productos Orgánicos", "Certificados"],
    "category_id": 456,
    "is_primary": false
  }
]
```

### 2. Función `mapProduct` - Procesamiento de Múltiples Categorías

**Archivo:** `api/sync-products-cron.ts`

**Cambios principales:**

1. **Nueva función `extractAllCategoryIds`**: Extrae TODAS las categorías del producto (por defecto + asociaciones)
2. **Nueva función `processCategoryFull`**: Procesa cada categoría completa con su jerarquía
3. **Procesamiento paralelo**: Todas las categorías se procesan en paralelo usando `Promise.all()` para mayor eficiencia
4. **Almacenamiento estructurado**: Cada categoría incluye:
   - `category`: Nivel 1 (categoría principal)
   - `subcategory`: Nivel 2 (subcategoría)
   - `subsubcategory`: Nivel 3 (sub-subcategoría)
   - `hierarchy`: Array completo de la jerarquía
   - `category_id`: ID de la categoría en PrestaShop
   - `is_primary`: Si es la categoría principal

### 3. Extracción de Categorías desde PrestaShop

**Mejoras en la extracción:**

- Se obtienen categorías de `id_category_default` (categoría por defecto)
- Se obtienen categorías de `associations.categories` (todas las asociaciones)
- Se manejan múltiples formatos de respuesta de PrestaShop:
  - `{ categories: [{ id: "2" }, { id: "3" }] }`
  - `{ categories: { category: [{ id: "2" }, { id: "3" }] } }`
  - `{ categories: { category: { id: "2" } } }`
- Se excluyen categorías inválidas (ID 1, ID 0, "Inicio")
- Se eliminan duplicados

### 4. Precarga de Categorías

**Optimización:**
- Se extraen todos los IDs de categorías únicos antes de procesar productos
- Se precargan todas las categorías con su jerarquía completa
- Se usa cache para evitar consultas duplicadas a la API

### 5. Guardado en Base de Datos

**Actualizaciones:**
- Se guarda `all_categories` como JSONB en todos los productos
- Se mantiene `category` y `subcategory` para compatibilidad
- Se compara `all_categories` para detectar cambios en productos existentes
- Se actualiza `all_categories` cuando cambian las categorías

## 🔧 Archivos Modificados

1. **`api/sync-products-cron.ts`**
   - Función `mapProduct`: Procesa múltiples categorías
   - Función `extractAllCategoryIds`: Extrae todas las categorías
   - Función `processCategoryFull`: Procesa categoría completa
   - Guardado de productos: Incluye `all_categories`
   - Comparación de productos: Compara `all_categories`

2. **`supabase-add-all-categories.sql`** (NUEVO)
   - Script SQL para agregar columna `all_categories`
   - Índice GIN para búsquedas eficientes
   - Migración de datos existentes

## 📊 Ejemplo de Datos

**Producto con múltiples categorías:**

```json
{
  "name": "Aceite de Oliva Ecológico",
  "sku": "ACE-001",
  "category": "Alimentación",  // Categoría principal (compatibilidad)
  "subcategory": "Aceites > Ecológicos",  // Subcategoría principal (compatibilidad)
  "all_categories": [
    {
      "category": "Alimentación",
      "subcategory": "Aceites",
      "subsubcategory": "Ecológicos",
      "hierarchy": ["Alimentación", "Aceites", "Ecológicos"],
      "category_id": 15,
      "is_primary": true
    },
    {
      "category": "Productos Orgánicos",
      "subcategory": "Certificados",
      "subsubcategory": null,
      "hierarchy": ["Productos Orgánicos", "Certificados"],
      "category_id": 42,
      "is_primary": false
    },
    {
      "category": "Sin Gluten",
      "subcategory": null,
      "subsubcategory": null,
      "hierarchy": ["Sin Gluten"],
      "category_id": 78,
      "is_primary": false
    }
  ]
}
```

## ✅ Beneficios

1. **Mejor indexación**: Los productos aparecen en todas sus categorías
2. **Búsquedas más precisas**: Se puede buscar por cualquier categoría asociada
3. **Información completa**: No se pierde información de categorías
4. **Compatibilidad**: Se mantiene `category` y `subcategory` para código existente
5. **Eficiencia**: Procesamiento paralelo de categorías

## 🚀 Próximos Pasos

1. **Ejecutar el script SQL** en Supabase:
   ```sql
   -- Ejecutar supabase-add-all-categories.sql
   ```

2. **Ejecutar sincronización completa**:
   - Los productos nuevos se guardarán con todas sus categorías
   - Los productos existentes se actualizarán en la próxima sincronización

3. **Actualizar APIs de búsqueda** (opcional):
   - Usar `all_categories` para búsquedas más flexibles
   - Filtrar por cualquier categoría asociada

## 📝 Notas Técnicas

- **Formato JSONB**: Permite búsquedas eficientes con índices GIN
- **Procesamiento paralelo**: Usa `Promise.all()` para procesar múltiples categorías simultáneamente
- **Cache de categorías**: Evita consultas duplicadas a la API de PrestaShop
- **Compatibilidad**: Se mantiene `category` y `subcategory` para no romper código existente

## 🔍 Consultas Útiles

**Obtener productos por cualquier categoría:**
```sql
SELECT * FROM products 
WHERE all_categories @> '[{"category": "Alimentación"}]'::jsonb;
```

**Contar productos por categoría:**
```sql
SELECT 
  cat->>'category' as category,
  COUNT(*) as count
FROM products,
  jsonb_array_elements(all_categories) as cat
GROUP BY cat->>'category'
ORDER BY count DESC;
```

**Obtener todas las categorías únicas:**
```sql
SELECT DISTINCT cat->>'category' as category
FROM products,
  jsonb_array_elements(all_categories) as cat
WHERE cat->>'category' IS NOT NULL
ORDER BY category;
```



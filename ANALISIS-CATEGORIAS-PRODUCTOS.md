# 📊 Análisis de Categorías de Productos - Problemas y Mejoras

## 🔍 Problemas Identificados

### 1. **Solo se muestran 5 categorías principales**

**Problema actual:**
- La API solo está devolviendo las categorías del **nivel 1** (categorías principales)
- Las subcategorías (nivel 2 y 3) no se están contando como categorías independientes
- En `api/chat.ts` línea 1566-1605, la función `getProductCategories` solo agrega a un Set las categorías principales

**Código problemático:**
```typescript
// api/chat.ts línea 1575-1589
const categories = new Set<string>();
(data || []).forEach((product: any) => {
  if (product.category) {
    categories.add(product.category); // Solo agrega nivel 1
    // Las subcategorías se ignoran como categorías independientes
  }
});
```

### 2. **Estructura de jerarquía limitada**

**En `api/sync-products-cron.ts` líneas 221-234:**
- Cuando hay 3 niveles, se guarda:
  - `category` = nivel 1 (ej: "Alimentación")
  - `subcategory` = "nivel2 > nivel3" (ej: "Aceites > Ecológicos")
- Esto hace que las subcategorías de nivel 2 y 3 se combinen, perdiendo la posibilidad de filtrar por nivel 2 solo

**Ejemplo del problema:**
```
Producto 1:
  category: "Alimentación"
  subcategory: "Aceites > Ecológicos"

Producto 2:
  category: "Alimentación"
  subcategory: "Aceites > Virgen Extra"

// No puedes filtrar solo por "Aceites" (nivel 2)
// Solo puedes filtrar por "Alimentación" (nivel 1) o por subcategorías completas
```

### 3. **Filtrado limitado en `get-products.ts`**

**En `api/get-products.ts` línea 62-65:**
- Solo permite filtrar por `category` (nivel 1)
- No permite filtrar por subcategorías directamente
- No permite buscar por cualquier nivel de la jerarquía

```typescript
// Solo filtra por category principal
if (category && typeof category === 'string') {
  query = query.ilike('category', `%${category}%`);
}
// ❌ No filtra por subcategory
```

### 4. **Pérdida de información de jerarquía**

**Problema:**
- La jerarquía completa se construye en `sync-products-cron.ts` pero solo se guarda nivel 1 y nivel 2+3 combinado
- No se guarda información de nivel 2 por separado
- No se puede reconstruir la jerarquía completa después de guardar

## ✅ Mejoras Propuestas

### Mejora 1: Guardar jerarquía completa en columnas separadas

**Opción A: Agregar columnas adicionales**
```sql
ALTER TABLE products ADD COLUMN category_level_1 TEXT; -- Nivel 1: "Alimentación"
ALTER TABLE products ADD COLUMN category_level_2 TEXT; -- Nivel 2: "Aceites"
ALTER TABLE products ADD COLUMN category_level_3 TEXT; -- Nivel 3: "Ecológicos"
```

**Opción B: Guardar jerarquía completa en JSON**
```sql
ALTER TABLE products ADD COLUMN category_hierarchy JSONB;
-- Ejemplo: ["Alimentación", "Aceites", "Ecológicos"]
```

**Recomendación:** Opción A (columnas separadas) porque:
- Más fácil de indexar y filtrar
- Más eficiente para queries
- Compatible con filtros existentes

### Mejora 2: Actualizar `sync-products-cron.ts` para guardar todos los niveles

**Modificar función `processCategory` (líneas 212-235):**

```typescript
const processCategory = async (categoryId: number): Promise<{
  category: string;
  category_level_1: string;
  category_level_2: string | null;
  category_level_3: string | null;
  subcategory: string | null;
}> => {
  const categoryInfo = await getCategoryInfo(categoryId, categoryCache, config);
  const hierarchy = categoryInfo.hierarchy || [];
  
  // Extraer niveles
  const level1 = hierarchy[0] || '';
  const level2 = hierarchy[1] || null;
  const level3 = hierarchy[2] || null;
  
  // Mantener category para compatibilidad (nivel 1)
  // Mantener subcategory para compatibilidad (nivel 2 > nivel 3 si existe)
  const subcategory = level2 && level3 
    ? `${level2} > ${level3}` 
    : level2 || null;
  
  return {
    category: level1, // Mantener para compatibilidad
    category_level_1: level1,
    category_level_2: level2,
    category_level_3: level3,
    subcategory: subcategory
  };
};
```

### Mejora 3: Mejorar `getProductCategories` para incluir todos los niveles

**Actualizar función en `api/chat.ts` línea 1566:**

```typescript
async function getProductCategories(supabase: any, params: any) {
  const { data, error } = await supabase
    .from('products')
    .select('category, category_level_1, category_level_2, category_level_3, subcategory');
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  const allCategories = new Set<string>();
  const categoriesByLevel = {
    level1: new Set<string>(),
    level2: new Set<string>(),
    level3: new Set<string>()
  };
  const hierarchy: { [key: string]: { [key: string]: string[] } } = {};
  
  (data || []).forEach((product: any) => {
    // Nivel 1 (categorías principales)
    if (product.category_level_1 || product.category) {
      const cat1 = product.category_level_1 || product.category;
      allCategories.add(cat1);
      categoriesByLevel.level1.add(cat1);
      
      if (!hierarchy[cat1]) {
        hierarchy[cat1] = {};
      }
      
      // Nivel 2 (subcategorías)
      if (product.category_level_2) {
        allCategories.add(product.category_level_2);
        categoriesByLevel.level2.add(product.category_level_2);
        
        if (!hierarchy[cat1][product.category_level_2]) {
          hierarchy[cat1][product.category_level_2] = [];
        }
        
        // Nivel 3 (sub-subcategorías)
        if (product.category_level_3) {
          allCategories.add(product.category_level_3);
          categoriesByLevel.level3.add(product.category_level_3);
          hierarchy[cat1][product.category_level_2].push(product.category_level_3);
        }
      }
    }
  });
  
  const result: any = {
    // Todas las categorías (todos los niveles)
    all_categories: Array.from(allCategories).sort(),
    total_all: allCategories.size,
    
    // Categorías por nivel
    categories_level_1: Array.from(categoriesByLevel.level1).sort(),
    categories_level_2: Array.from(categoriesByLevel.level2).sort(),
    categories_level_3: Array.from(categoriesByLevel.level3).sort(),
    
    // Jerarquía completa
    hierarchy: hierarchy,
    
    // Compatibilidad (solo nivel 1)
    categories: Array.from(categoriesByLevel.level1).sort(),
    total: categoriesByLevel.level1.size
  };
  
  return result;
}
```

### Mejora 4: Mejorar filtrado en `get-products.ts`

**Actualizar para permitir filtrar por cualquier nivel:**

```typescript
// api/get-products.ts
const { 
  limit = '50', 
  offset = '0', 
  category,           // Filtro por nivel 1 (compatibilidad)
  category_level_1,   // Filtro por nivel 1
  category_level_2,   // Filtro por nivel 2
  category_level_3,   // Filtro por nivel 3
  subcategory,        // Filtro por subcategoría (compatibilidad)
  search 
} = req.query;

// Construir filtros
if (category && typeof category === 'string') {
  // Compatibilidad: buscar en category_level_1 o category
  query = query.or(`category_level_1.ilike.%${category}%,category.ilike.%${category}%`);
}

if (category_level_1 && typeof category_level_1 === 'string') {
  query = query.ilike('category_level_1', `%${category_level_1}%`);
}

if (category_level_2 && typeof category_level_2 === 'string') {
  query = query.ilike('category_level_2', `%${category_level_2}%`);
}

if (category_level_3 && typeof category_level_3 === 'string') {
  query = query.ilike('category_level_3', `%${category_level_3}%`);
}

if (subcategory && typeof subcategory === 'string') {
  query = query.ilike('subcategory', `%${subcategory}%`);
}
```

### Mejora 5: Crear endpoint para obtener categorías jerárquicas

**Nuevo archivo: `api/get-categories.ts`**

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { include_hierarchy = 'true' } = req.query;

    // Obtener todas las categorías únicas
    const { data, error } = await supabase
      .from('products')
      .select('category_level_1, category_level_2, category_level_3, category, subcategory')
      .not('category_level_1', 'is', null);

    if (error) {
      throw error;
    }

    const allCategories = new Set<string>();
    const level1 = new Set<string>();
    const level2 = new Set<string>();
    const level3 = new Set<string>();
    const hierarchy: any = {};

    (data || []).forEach((p: any) => {
      const cat1 = p.category_level_1 || p.category;
      if (cat1) {
        allCategories.add(cat1);
        level1.add(cat1);
        
        if (!hierarchy[cat1]) {
          hierarchy[cat1] = {};
        }
        
        if (p.category_level_2) {
          allCategories.add(p.category_level_2);
          level2.add(p.category_level_2);
          
          if (!hierarchy[cat1][p.category_level_2]) {
            hierarchy[cat1][p.category_level_2] = [];
          }
          
          if (p.category_level_3) {
            allCategories.add(p.category_level_3);
            level3.add(p.category_level_3);
            hierarchy[cat1][p.category_level_2].push(p.category_level_3);
          }
        }
      }
    });

    const result: any = {
      success: true,
      all_categories: Array.from(allCategories).sort(),
      total_all: allCategories.size,
      level_1: Array.from(level1).sort(),
      level_2: Array.from(level2).sort(),
      level_3: Array.from(level3).sort(),
      counts: {
        level_1: level1.size,
        level_2: level2.size,
        level_3: level3.size,
        total: allCategories.size
      }
    };

    if (include_hierarchy === 'true') {
      result.hierarchy = hierarchy;
    }

    res.status(200).json(result);
  } catch (error) {
    console.error('Get categories error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
```

## 📋 Plan de Implementación

### Fase 1: Migración de Base de Datos
1. ✅ Crear script SQL para agregar columnas `category_level_1`, `category_level_2`, `category_level_3`
2. ✅ Migrar datos existentes desde `category` y `subcategory` a las nuevas columnas
3. ✅ Crear índices para las nuevas columnas

### Fase 2: Actualizar Sincronización
1. ✅ Modificar `api/sync-products-cron.ts` para guardar todos los niveles
2. ✅ Mantener compatibilidad con campos antiguos (`category`, `subcategory`)

### Fase 3: Actualizar APIs
1. ✅ Actualizar `api/get-products.ts` para filtrar por cualquier nivel
2. ✅ Actualizar `api/chat.ts` función `getProductCategories`
3. ✅ Crear nuevo endpoint `api/get-categories.ts`

### Fase 4: Testing
1. ✅ Probar sincronización con nuevos campos
2. ✅ Probar filtrado por diferentes niveles
3. ✅ Verificar que se obtienen todas las categorías correctamente

## 🎯 Resultado Esperado

Después de implementar estas mejoras:

1. **Todas las categorías visibles**: Se mostrarán todas las categorías de todos los niveles, no solo las 5 principales
2. **Filtrado flexible**: Se podrá filtrar por nivel 1, 2 o 3
3. **Jerarquía completa**: Se mantendrá la información completa de la jerarquía
4. **Compatibilidad**: Se mantendrá compatibilidad con código existente

## 📝 Notas Adicionales

- La columna `category` y `subcategory` se mantendrán para compatibilidad
- Los productos nuevos se guardarán con todos los niveles
- Se recomienda ejecutar una sincronización completa después de la migración



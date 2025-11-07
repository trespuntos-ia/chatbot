# Recomendaciones de Funciones para Mejorar el Chatbot

## Funciones Actuales
- `search_products`: Busca productos en la base de datos
- `get_product_by_sku`: Obtiene un producto específico por SKU

---

## Funciones Recomendadas para Implementar

### 1. **`search_products_by_category`** ⭐ Alta Prioridad
**Descripción**: Busca productos filtrados por categoría con búsqueda de texto opcional.

**Por qué es útil**:
- Permite búsquedas más específicas cuando el usuario menciona una categoría
- Reduce resultados irrelevantes
- Mejora la precisión cuando el usuario pregunta "productos de cocina" o "herramientas de corte"

**Ejemplo de uso**:
```typescript
{
  name: 'search_products_by_category',
  description: 'Busca productos en una categoría específica. Útil cuando el usuario menciona una categoría (ej: "productos de cocina", "herramientas").',
  parameters: {
    query: 'string (opcional) - Texto de búsqueda',
    category: 'string (requerido) - Nombre de la categoría',
    limit: 'number (opcional) - Máximo de resultados'
  }
}
```

---

### 2. **`get_similar_products`** ⭐⭐ Alta Prioridad
**Descripción**: Obtiene productos similares basándose en un producto específico.

**Por qué es útil**:
- Cuando el usuario pregunta "¿qué otros productos similares tienes?"
- Permite hacer recomendaciones de productos relacionados
- Mejora la experiencia de descubrimiento

**Ejemplo de uso**:
```typescript
{
  name: 'get_similar_products',
  description: 'Obtiene productos similares a uno específico. Útil cuando el usuario pregunta por productos relacionados, alternativas o similares.',
  parameters: {
    product_id: 'string (requerido) - ID del producto de referencia',
    product_name: 'string (opcional) - Nombre del producto para buscar primero',
    limit: 'number (opcional) - Máximo de productos similares'
  }
}
```

**Lógica de implementación**:
- Buscar por misma categoría/subcategoría
- Buscar palabras clave similares en el nombre
- Ordenar por relevancia

---

### 3. **`get_product_categories`** ⭐ Media Prioridad
**Descripción**: Obtiene la lista de categorías disponibles.

**Por qué es útil**:
- Cuando el usuario pregunta "¿qué categorías tienes?"
- Ayuda a navegar cuando no sabe qué buscar
- Permite hacer búsquedas más específicas después

**Ejemplo de uso**:
```typescript
{
  name: 'get_product_categories',
  description: 'Obtiene todas las categorías de productos disponibles. Útil cuando el usuario pregunta qué categorías o tipos de productos hay disponibles.',
  parameters: {
    include_subcategories: 'boolean (opcional) - Incluir subcategorías'
  }
}
```

---

### 4. **`compare_products`** ⭐⭐ Alta Prioridad
**Descripción**: Compara características de múltiples productos.

**Por qué es útil**:
- Cuando el usuario pregunta "¿cuál es la diferencia entre X e Y?"
- Permite hacer recomendaciones informadas
- Mejora la capacidad de decisión del usuario

**Ejemplo de uso**:
```typescript
{
  name: 'compare_products',
  description: 'Compara características, precios y especificaciones de múltiples productos. Útil cuando el usuario quiere comparar productos o elegir entre opciones.',
  parameters: {
    product_names: 'array[string] (requerido) - Nombres de productos a comparar',
    product_ids: 'array[string] (opcional) - IDs de productos si se conocen'
  }
}
```

---

### 5. **`search_documents`** ⭐⭐ Alta Prioridad (Ya existe, verificar)
**Descripción**: Busca en documentos/catálogos subidos.

**Por qué es útil**:
- Respuestas basadas en documentación técnica
- Información más detallada que la descripción del producto
- Manuales, especificaciones, etc.

**Nota**: Verificar si ya está implementada en `search-documents.ts`

---

### 6. **`get_product_recommendations`** ⭐⭐ Alta Prioridad
**Descripción**: Obtiene recomendaciones de productos basadas en un criterio.

**Por qué es útil**:
- "¿Qué me recomiendas para cocinar pasta?"
- "¿Cuál es el mejor producto para..."
- Personaliza respuestas según el uso

**Ejemplo de uso**:
```typescript
{
  name: 'get_product_recommendations',
  description: 'Obtiene recomendaciones de productos basadas en un uso específico, necesidad o criterio. Útil cuando el usuario pregunta "¿qué me recomiendas para...?" o "¿cuál es el mejor producto para...?".',
  parameters: {
    use_case: 'string (requerido) - Para qué se necesita el producto',
    category: 'string (opcional) - Filtrar por categoría',
    budget_range: 'string (opcional) - Rango de precio (ej: "bajo", "medio", "alto")',
    limit: 'number (opcional) - Máximo de recomendaciones'
  }
}
```

---

### 7. **`get_product_specifications`** ⭐ Media Prioridad
**Descripción**: Obtiene especificaciones técnicas detalladas de un producto.

**Por qué es útil**:
- Respuestas más técnicas y precisas
- Cuando el usuario pregunta por dimensiones, materiales, etc.
- Información que puede no estar en la descripción corta

**Ejemplo de uso**:
```typescript
{
  name: 'get_product_specifications',
  description: 'Obtiene especificaciones técnicas detalladas de un producto. Útil cuando el usuario pregunta por dimensiones, materiales, características técnicas, peso, etc.',
  parameters: {
    product_id: 'string (opcional) - ID del producto',
    product_name: 'string (opcional) - Nombre del producto para buscar primero'
  }
}
```

---

### 8. **`get_products_by_price_range`** ⭐ Media Prioridad
**Descripción**: Busca productos dentro de un rango de precios.

**Por qué es útil**:
- "Productos económicos"
- "Productos entre 50-100 euros"
- Filtrado por presupuesto

**Ejemplo de uso**:
```typescript
{
  name: 'get_products_by_price_range',
  description: 'Busca productos dentro de un rango de precios específico. Útil cuando el usuario menciona un presupuesto o rango de precio.',
  parameters: {
    min_price: 'number (opcional) - Precio mínimo',
    max_price: 'number (opcional) - Precio máximo',
    category: 'string (opcional) - Filtrar por categoría',
    query: 'string (opcional) - Texto de búsqueda adicional'
  }
}
```

---

### 9. **`get_popular_products`** ⭐ Baja Prioridad
**Descripción**: Obtiene los productos más populares o vendidos.

**Por qué es útil**:
- "¿Cuáles son tus productos más vendidos?"
- "¿Qué productos recomiendas?"
- Ayuda cuando el usuario no sabe qué buscar

**Ejemplo de uso**:
```typescript
{
  name: 'get_popular_products',
  description: 'Obtiene los productos más populares o mejor valorados. Útil cuando el usuario pregunta por productos destacados, más vendidos o mejor valorados.',
  parameters: {
    category: 'string (opcional) - Filtrar por categoría',
    limit: 'number (opcional) - Máximo de productos'
  }
}
```

---

### 10. **`clarify_search_intent`** ⭐⭐ Alta Prioridad (Función de análisis)
**Descripción**: Analiza la intención del usuario y sugiere búsquedas alternativas.

**Por qué es útil**:
- Cuando no se encuentra nada, sugiere búsquedas similares
- Corrige errores ortográficos
- Expande términos (ej: "cocina" → incluye "utensilios", "herramientas de cocina")

**Ejemplo de uso**:
```typescript
{
  name: 'clarify_search_intent',
  description: 'Analiza la intención de búsqueda del usuario y sugiere términos de búsqueda alternativos o relacionados. Útil cuando no se encuentran resultados o cuando se quiere mejorar la búsqueda.',
  parameters: {
    original_query: 'string (requerido) - Término de búsqueda original',
    failed_search: 'boolean (opcional) - Si la búsqueda anterior falló'
  }
}
```

---

## Mejoras Adicionales (No son funciones, pero mejoran respuestas)

### 1. **Sistema de Scoring/Relevancia**
- Puntuación de relevancia basada en:
  - Coincidencia exacta de palabras
  - Coincidencia parcial
  - Coincidencia en nombre vs descripción
  - Ordenar por relevancia, no solo por nombre

### 2. **Búsqueda Fonética/Similaridad**
- Usar algoritmos de distancia de Levenshtein
- Detectar errores ortográficos comunes
- Búsqueda fonética para español

### 3. **Cache de Búsquedas Comunes**
- Cachear resultados de búsquedas frecuentes
- Mejorar velocidad de respuesta

### 4. **Análisis de Sinónimos**
- Expandir automáticamente sinónimos
- "sartén" → buscar también "frying pan", "pan", "cacerola"

### 5. **Contexto de Conversación Mejorado**
- Recordar productos mencionados anteriormente
- Usar pronombres ("ese producto", "el anterior")
- Referencias cruzadas en la conversación

---

## Priorización Recomendada

### Fase 1 (Implementar Primero):
1. ✅ `search_products` (ya mejorado con búsqueda flexible)
2. `get_similar_products` - Muy útil para recomendaciones
3. `get_product_recommendations` - Mejora significativamente la experiencia
4. `compare_products` - Muy solicitado por usuarios

### Fase 2 (Mejoras Importantes):
5. `search_products_by_category` - Refina búsquedas
6. `get_product_categories` - Ayuda a navegar
7. `clarify_search_intent` - Mejora cuando no hay resultados

### Fase 3 (Funciones Adicionales):
8. `get_products_by_price_range` - Filtrado por presupuesto
9. `get_product_specifications` - Detalles técnicos
10. `get_popular_products` - Productos destacados

---

## Ejemplo de Implementación

### `get_similar_products` - Código de ejemplo:

```typescript
async function getSimilarProducts(supabase: any, params: any) {
  // Primero buscar el producto de referencia
  let referenceProduct = null;
  
  if (params.product_id) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.product_id)
      .single();
    referenceProduct = data;
  } else if (params.product_name) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${params.product_name}%`)
      .limit(1)
      .single();
    referenceProduct = data;
  }
  
  if (!referenceProduct) {
    return { products: [], message: 'Producto de referencia no encontrado' };
  }
  
  // Buscar productos similares
  const limit = params.limit || 5;
  
  // Extraer palabras clave del nombre del producto
  const keywords = referenceProduct.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w: string) => w.length > 3); // Palabras de más de 3 letras
  
  // Construir búsqueda
  let query = supabase
    .from('products')
    .select('*')
    .neq('id', referenceProduct.id); // Excluir el producto de referencia
  
  // Filtrar por misma categoría si existe
  if (referenceProduct.category) {
    query = query.eq('category', referenceProduct.category);
  }
  
  // Buscar por palabras clave similares
  if (keywords.length > 0) {
    const conditions = keywords.map((keyword: string) => 
      `name.ilike.%${keyword}%,description.ilike.%${keyword}%`
    ).join(',');
    query = query.or(conditions);
  }
  
  query = query.limit(limit);
  
  const { data: similarProducts, error } = await query;
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  return {
    reference_product: referenceProduct,
    products: similarProducts || [],
    total: similarProducts?.length || 0
  };
}
```

---

## Notas Finales

- Todas las funciones deben incluir manejo de errores robusto
- Considerar límites de tiempo para evitar timeouts
- Implementar cache donde sea apropiado
- Documentar bien cada función para OpenAI
- Probar cada función con casos de uso reales


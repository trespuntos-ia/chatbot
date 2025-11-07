# 📋 INSTRUCCIONES EXACTAS QUE SE ENVÍAN A OPENAI

## 1. SYSTEM PROMPT (desde Supabase)

El system prompt se carga desde la tabla `system_prompts` donde `is_active = true`.

**Puedes verlo y editarlo en:** Dashboard → Pestaña "Configuración AI"

El prompt actual por defecto incluye:
- Reglas para búsqueda de productos
- Formato de respuestas
- Instrucciones de validación
- Variables dinámicas: {{language}}, {{store_platform}}

## 2. DESCRIPCIONES DE FUNCIONES (Tools)

Estas son las descripciones que OpenAI lee para entender qué funciones puede usar:

### Función: search_products
```typescript
{
  name: 'search_products',
  description: 'Busca productos en la base de datos. IMPORTANTE: Usa esta función SIEMPRE antes de afirmar que tienes un producto. Si el usuario pregunta por un producto específico, busca primero con esta función. Si hay múltiples resultados similares, presenta las opciones al usuario y pregunta cuál es el correcto. Si no hay coincidencia exacta, pregunta por más detalles.',
  parameters: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Texto de búsqueda para buscar en nombre, descripción o SKU. Si está vacío, devuelve todos los productos (con límite).'
      },
      category: {
        type: 'string',
        description: 'Filtrar por categoría principal. Ejemplos: "Electrónica", "Ropa", "Hogar". Si no se especifica, no se filtra por categoría.'
      },
      subcategory: {
        type: 'string',
        description: 'Filtrar por subcategoría específica. Si no se especifica, no se filtra por subcategoría.'
      },
      limit: {
        type: 'number',
        description: 'Número máximo de resultados a devolver. Por defecto: 20. Máximo recomendado: 50.'
      },
      offset: {
        type: 'number',
        description: 'Número de resultados a saltar (para paginación). Por defecto: 0.'
      },
      sort_by: {
        type: 'string',
        enum: ['name', 'price_asc', 'price_desc', 'date_add', 'created_at'],
        description: 'Orden de los resultados. "name": alfabético, "price_asc": precio menor a mayor, "price_desc": precio mayor a menor, "date_add": más recientes primero, "created_at": más recientes en Supabase.'
      }
    },
    required: []
  }
}
```

### Función: get_product_by_sku
```typescript
{
  name: 'get_product_by_sku',
  description: 'Obtiene un producto específico por su SKU. IMPORTANTE: Usa esta función cuando el usuario proporcione un SKU específico. Si no encuentras el producto con ese SKU exacto, informa al usuario que ese SKU no existe en lugar de afirmar que sí lo tienes.',
  parameters: {
    type: 'object',
    properties: {
      sku: {
        type: 'string',
        description: 'SKU del producto (código único). Puede ser exacto o parcial. Si es parcial, se buscarán productos que contengan ese texto en el SKU.'
      }
    },
    required: ['sku']
  }
}
```

## 3. CONTEXTO ENRIQUECIDO (añadido dinámicamente)

Cuando hay múltiples productos o dudas, se añade automáticamente:

```
⚠️ IMPORTANTE: Has encontrado múltiples productos. NO asumas cuál es el correcto. Debes:
1. Listar todos los productos encontrados con sus nombres completos
2. Preguntar al usuario cuál de estos productos es el que busca
3. NO afirmes que tienes un producto específico sin confirmar primero
```

O si el producto no coincide exactamente:
```
⚠️ IMPORTANTE: El producto encontrado no coincide exactamente con la búsqueda. Debes preguntar al usuario si este es el producto que busca antes de confirmar.
```

## 4. CONFIGURACIÓN DE OPENAI

```typescript
{
  model: 'gpt-3.5-turbo' (o el que el usuario configure),
  temperature: 0.7 (o el que el usuario configure),
  max_tokens: 1500 (o el que el usuario configure),
  tool_choice: 'auto' // OpenAI decide si usar funciones o no
}
```


# 🚀 PROPUESTA COMPLETA: Mejora de Respuestas OpenAI con Supabase

## 📋 ÍNDICE
1. [System Prompt Optimizado](#1-system-prompt-optimizado)
2. [Function Calling Inteligente](#2-function-calling-inteligente)
3. [Preprocesamiento de Consultas](#3-preprocesamiento-de-consultas)
4. [Post-procesamiento de Respuestas](#4-post-procesamiento-de-respuestas)
5. [Contexto Enriquecido](#5-contexto-enriquecido)
6. [Validación y Seguridad](#6-validación-y-seguridad)
7. [Mejoras de Performance](#7-mejoras-de-performance)
8. [Implementación Técnica](#8-implementación-técnica)

---

## 1. SYSTEM PROMPT OPTIMIZADO

### 🎯 Objetivo
Crear un prompt del sistema que guíe a OpenAI para:
- Entender el contexto del negocio
- Usar las funciones correctamente
- Generar respuestas precisas y útiles
- Manejar casos edge

### 📝 Estructura del Prompt

```typescript
const SYSTEM_PROMPT = `
Eres un asistente experto en productos de PrestaShop. Tu trabajo es ayudar a los usuarios a encontrar información sobre productos en la base de datos.

## CONTEXTO DEL NEGOCIO
- Base de datos: Supabase (PostgreSQL)
- Tabla principal: products
- Idioma: Español (con soporte para otros idiomas)
- Tipo de consultas: Búsqueda de productos, categorías, precios, SKUs

## ESTRUCTURA DE LA BASE DE DATOS

Tabla: products
- id (BIGINT): Identificador único
- name (TEXT): Nombre del producto (índice full-text español)
- price (TEXT): Precio del producto (formato: "XX.XX EUR")
- category (TEXT): Categoría principal (índice)
- subcategory (TEXT): Subcategoría específica (índice)
- description (TEXT): Descripción completa (índice full-text español)
- sku (TEXT, UNIQUE): Código SKU único del producto (índice)
- image_url (TEXT): URL de la imagen del producto
- product_url (TEXT): URL del producto en PrestaShop
- date_add (TIMESTAMP): Fecha de creación en PrestaShop
- created_at (TIMESTAMP): Fecha de creación en Supabase
- updated_at (TIMESTAMP): Fecha de última actualización

## CAPACIDADES DE BÚSQUEDA DISPONIBLES

1. **Búsqueda por texto completo**: Usa full-text search en name y description
2. **Búsqueda por SKU**: Búsqueda exacta o parcial
3. **Búsqueda por categoría**: Filtrado por category o subcategory
4. **Búsqueda por precio**: Filtrado por rango de precios
5. **Búsqueda combinada**: Múltiples criterios simultáneos

## REGLAS DE USO

1. **SIEMPRE usa las funciones disponibles** cuando el usuario pregunte sobre productos
2. **NUNCA inventes datos** - Si no encuentras información, dilo claramente
3. **Formatea precios** correctamente mostrando la moneda
4. **Menciona el SKU** cuando sea relevante
5. **Proporciona enlaces** cuando el usuario quiera ver el producto
6. **Sé conciso pero completo** - No repitas información innecesaria
7. **Si no hay resultados**, sugiere búsquedas alternativas o términos relacionados

## EJEMPLOS DE RESPUESTAS

Usuario: "Busca productos de electrónica"
→ Debes llamar a search_products con category="electrónica"
→ Si encuentras resultados, lista los productos con nombre, precio y SKU
→ Si no hay resultados, sugiere categorías similares

Usuario: "¿Cuál es el precio del producto con SKU ABC123?"
→ Debes llamar a get_product_by_sku con sku="ABC123"
→ Si existe, muestra el precio formateado
→ Si no existe, informa que no se encontró

Usuario: "Muéstrame los productos más recientes"
→ Debes llamar a get_recent_products
→ Lista los productos ordenados por fecha

## FORMATO DE RESPUESTAS

- **Listas de productos**: Usa formato tabla o lista con nombre, precio, SKU
- **Producto único**: Muestra todos los detalles relevantes
- **Sin resultados**: Sé empático y sugiere alternativas
- **Errores**: Explica el problema de forma clara

## IDIOMA

- Responde en el mismo idioma que el usuario
- Si no especifica idioma, usa español por defecto
- Los datos de la base de datos pueden estar en diferentes idiomas
`;
```

### ✅ Ventajas
- **Contexto claro**: OpenAI entiende qué datos tiene disponibles
- **Instrucciones específicas**: Sabe cuándo y cómo usar las funciones
- **Ejemplos concretos**: Guía sobre cómo responder
- **Manejo de errores**: Qué hacer cuando no hay resultados

---

## 2. FUNCTION CALLING INTELIGENTE

### 🎯 Objetivo
Diseñar funciones que OpenAI pueda usar de forma eficiente y precisa.

### 📝 Funciones Propuestas

#### 2.1. Búsqueda General de Productos
```typescript
{
  name: "search_products",
  description: "Busca productos en la base de datos usando múltiples criterios. Usa esta función cuando el usuario pregunte por productos, categorías, nombres, descripciones o cualquier búsqueda general.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Texto de búsqueda para buscar en nombre, descripción o SKU. Usa términos específicos o palabras clave. Si está vacío, devuelve todos los productos (con límite)."
      },
      category: {
        type: "string",
        description: "Filtrar por categoría principal. Ejemplos: 'Electrónica', 'Ropa', 'Hogar'. Si no se especifica, no se filtra por categoría."
      },
      subcategory: {
        type: "string",
        description: "Filtrar por subcategoría específica. Ejemplos: 'Smartphones', 'Camisetas', 'Muebles'. Si no se especifica, no se filtra por subcategoría."
      },
      min_price: {
        type: "number",
        description: "Precio mínimo en formato numérico (sin moneda). Ejemplo: 10.50 para '10.50 EUR'. Si no se especifica, no hay límite mínimo."
      },
      max_price: {
        type: "number",
        description: "Precio máximo en formato numérico (sin moneda). Ejemplo: 100.00 para '100.00 EUR'. Si no se especifica, no hay límite máximo."
      },
      limit: {
        type: "number",
        description: "Número máximo de resultados a devolver. Por defecto: 20. Máximo recomendado: 50 para evitar respuestas muy largas."
      },
      offset: {
        type: "number",
        description: "Número de resultados a saltar (para paginación). Por defecto: 0."
      },
      sort_by: {
        type: "string",
        enum: ["name", "price_asc", "price_desc", "date_add", "created_at"],
        description: "Orden de los resultados. 'name': alfabético, 'price_asc': precio menor a mayor, 'price_desc': precio mayor a menor, 'date_add': más recientes primero, 'created_at': más recientes en Supabase."
      }
    },
    required: []
  }
}
```

#### 2.2. Búsqueda por SKU
```typescript
{
  name: "get_product_by_sku",
  description: "Obtiene un producto específico por su SKU. Usa esta función cuando el usuario mencione un SKU específico o código de producto.",
  parameters: {
    type: "object",
    properties: {
      sku: {
        type: "string",
        description: "SKU del producto (código único). Puede ser exacto o parcial. Si es parcial, se buscarán productos que contengan ese texto en el SKU."
      }
    },
    required: ["sku"]
  }
}
```

#### 2.3. Productos Recientes
```typescript
{
  name: "get_recent_products",
  description: "Obtiene los productos más recientes añadidos a la base de datos. Usa esta función cuando el usuario pregunte por productos nuevos, recientes o últimas incorporaciones.",
  parameters: {
    type: "object",
    properties: {
      limit: {
        type: "number",
        description: "Número de productos recientes a devolver. Por defecto: 10. Máximo recomendado: 20."
      },
      days: {
        type: "number",
        description: "Número de días hacia atrás para considerar 'reciente'. Por defecto: 30 días."
      }
    },
    required: []
  }
}
```

#### 2.4. Estadísticas de Categorías
```typescript
{
  name: "get_category_stats",
  description: "Obtiene estadísticas sobre categorías: número de productos por categoría, precios promedio, etc. Usa esta función cuando el usuario pregunte por estadísticas, conteos, promedios o resúmenes de categorías.",
  parameters: {
    type: "object",
    properties: {
      category: {
        type: "string",
        description: "Categoría específica para obtener estadísticas. Si no se especifica, devuelve estadísticas de todas las categorías."
      },
      include_subcategories: {
        type: "boolean",
        description: "Si es true, incluye subcategorías en las estadísticas. Por defecto: false."
      }
    },
    required: []
  }
}
```

#### 2.5. Búsqueda de Texto Completo Avanzada
```typescript
{
  name: "advanced_text_search",
  description: "Búsqueda avanzada de texto completo en nombres y descripciones usando PostgreSQL full-text search. Usa esta función cuando el usuario haga búsquedas complejas o necesite encontrar productos por palabras clave específicas en el texto.",
  parameters: {
    type: "object",
    properties: {
      search_terms: {
        type: "array",
        items: { type: "string" },
        description: "Array de términos de búsqueda. Se buscarán en nombre y descripción. Ejemplo: ['smartphone', 'pantalla', '5G'] buscará productos que contengan alguna de estas palabras."
      },
      match_all: {
        type: "boolean",
        description: "Si es true, todos los términos deben estar presentes (AND). Si es false, cualquiera de los términos es suficiente (OR). Por defecto: false."
      },
      limit: {
        type: "number",
        description: "Número máximo de resultados. Por defecto: 20."
      }
    },
    required: ["search_terms"]
  }
}
```

### ✅ Ventajas
- **Funciones específicas**: Cada función tiene un propósito claro
- **Descripciones detalladas**: OpenAI sabe cuándo usar cada función
- **Parámetros flexibles**: Permite búsquedas simples y complejas
- **Paginación**: Soporta grandes volúmenes de datos

---

## 3. PREPROCESAMIENTO DE CONSULTAS

### 🎯 Objetivo
Mejorar las consultas antes de enviarlas a OpenAI para:
- Normalizar el lenguaje
- Extraer intención
- Corregir errores comunes
- Expandir términos

### 📝 Implementación

```typescript
interface QueryPreprocessor {
  // Normaliza el texto (lowercase, trim, etc.)
  normalizeText(query: string): string;
  
  // Extrae entidades (SKUs, precios, categorías)
  extractEntities(query: string): {
    skus: string[];
    prices: { min?: number; max?: number };
    categories: string[];
  };
  
  // Corrige errores comunes
  correctSpelling(query: string): string;
  
  // Expande términos (sinónimos, abreviaciones)
  expandTerms(query: string): string[];
  
  // Detecta intención del usuario
  detectIntent(query: string): 'search' | 'get_by_sku' | 'stats' | 'recent' | 'compare';
}
```

### Ejemplo de Uso

```typescript
// Usuario escribe: "busca productos de electronica"
// Preprocesador:
// 1. Normaliza: "busca productos de electronica"
// 2. Detecta intención: 'search'
// 3. Extrae categoría: "electronica"
// 4. Corrige: "electrónica" (si hay diccionario)
// 5. Expande: ["electrónica", "electronicos", "electronics"]
// 6. Envía a OpenAI con contexto enriquecido
```

### ✅ Ventajas
- **Mejor precisión**: Correcciones antes de buscar
- **Búsquedas más robustas**: Maneja variaciones
- **Detección de intención**: Usa la función correcta
- **Mejor experiencia**: El usuario no necesita ser exacto

---

## 4. POST-PROCESAMIENTO DE RESPUESTAS

### 🎯 Objetivo
Mejorar las respuestas de OpenAI antes de mostrarlas al usuario:
- Formatear datos correctamente
- Añadir enlaces e imágenes
- Validar información
- Enriquecer con contexto

### 📝 Implementación

```typescript
interface ResponsePostprocessor {
  // Formatea precios consistentemente
  formatPrices(products: Product[]): Product[];
  
  // Añade enlaces a productos
  addProductLinks(products: Product[]): Product[];
  
  // Enriquece con imágenes
  enhanceWithImages(products: Product[]): Product[];
  
  // Valida que la respuesta sea coherente
  validateResponse(response: string, data: any): boolean;
  
  // Añade sugerencias si no hay resultados
  addSuggestions(response: string, query: string): string;
  
  // Formatea la respuesta para mejor legibilidad
  formatForDisplay(response: string): string;
}
```

### Ejemplo

```typescript
// OpenAI responde: "Encontré 3 productos de electrónica"
// Post-procesador:
// 1. Valida que los datos coincidan con la respuesta
// 2. Formatea precios: "10.50 EUR" → "10,50 €"
// 3. Añade enlaces: "Ver producto" → <a href="...">Ver producto</a>
// 4. Añade imágenes si están disponibles
// 5. Formatea para markdown/HTML
// 6. Muestra al usuario una respuesta rica y formateada
```

### ✅ Ventajas
- **Respuestas consistentes**: Formato uniforme
- **Información completa**: Enlaces, imágenes, detalles
- **Validación**: Verifica coherencia
- **Mejor UX**: Respuestas más útiles y visuales

---

## 5. CONTEXTO ENRIQUECIDO

### 🎯 Objetivo
Proporcionar contexto adicional a OpenAI para mejorar sus respuestas:
- Estadísticas generales
- Categorías disponibles
- Patrones de búsqueda
- Historial de conversación

### 📝 Estrategias

#### 5.1. Contexto Inicial
```typescript
// Al iniciar la conversación, obtener:
const initialContext = {
  totalProducts: await getTotalProducts(),
  categories: await getAvailableCategories(),
  recentActivity: await getRecentActivity(),
  popularSearches: await getPopularSearches()
};

// Incluir en el primer mensaje del sistema
const enhancedSystemPrompt = `${SYSTEM_PROMPT}

## CONTEXTO ACTUAL DE LA BASE DE DATOS
- Total de productos: ${initialContext.totalProducts}
- Categorías disponibles: ${initialContext.categories.join(', ')}
- Última actualización: ${initialContext.recentActivity}
`;
```

#### 5.2. Historial de Conversación
```typescript
// Mantener contexto de la conversación
const conversationHistory = [
  { role: 'user', content: 'Busca productos de electrónica' },
  { role: 'assistant', content: 'Encontré 15 productos...', function_calls: [...] },
  { role: 'user', content: '¿Cuál es el más barato?' }
];

// OpenAI puede usar el contexto previo para:
// - Entender que "el más barato" se refiere a los 15 productos encontrados
// - No necesita hacer otra búsqueda
// - Puede filtrar los resultados anteriores
```

#### 5.3. Sugerencias Inteligentes
```typescript
// Cuando no hay resultados, sugerir:
const suggestions = {
  similarCategories: await findSimilarCategories(query),
  popularProducts: await getPopularProducts(),
  relatedSearches: await getRelatedSearches(query)
};

// OpenAI puede usar estas sugerencias para:
// - Ofrecer alternativas útiles
// - Corregir errores del usuario
// - Guiar hacia búsquedas exitosas
```

### ✅ Ventajas
- **Respuestas más precisas**: Más información disponible
- **Mejor contexto**: Entiende referencias anteriores
- **Sugerencias útiles**: Ayuda cuando no hay resultados
- **Conversación natural**: Mantiene el hilo de la conversación

---

## 6. VALIDACIÓN Y SEGURIDAD

### 🎯 Objetivo
Asegurar que las consultas sean seguras y válidas:
- Prevenir SQL injection
- Validar parámetros
- Limitar resultados
- Rate limiting

### 📝 Implementación

```typescript
interface QueryValidator {
  // Valida y sanitiza parámetros de búsqueda
  validateSearchParams(params: any): {
    valid: boolean;
    sanitized: any;
    errors: string[];
  };
  
  // Previene SQL injection
  sanitizeQuery(query: string): string;
  
  // Limita el número de resultados
  enforceLimits(params: any, defaults: Limits): any;
  
  // Valida que los tipos sean correctos
  validateTypes(params: any): boolean;
}

interface Limits {
  maxResults: number;      // Ej: 50
  maxQueryLength: number;   // Ej: 500 caracteres
  maxPrice: number;         // Ej: 1000000
  timeout: number;          // Ej: 10 segundos
}
```

### Ejemplo

```typescript
// Usuario intenta: "'; DROP TABLE products; --"
// Validator:
// 1. Detecta caracteres peligrosos
// 2. Sanitiza: elimina o escapa caracteres especiales
// 3. Valida: verifica que sea una consulta válida
// 4. Rechaza si es peligroso
// 5. Registra intento de inyección (para monitoreo)
```

### ✅ Ventajas
- **Seguridad**: Previene ataques
- **Estabilidad**: Evita consultas que rompan el sistema
- **Performance**: Limita recursos consumidos
- **Confiabilidad**: Valida datos antes de procesar

---

## 7. MEJORAS DE PERFORMANCE

### 🎯 Objetivo
Optimizar para respuestas rápidas y eficientes:
- Caché de consultas frecuentes
- Búsquedas optimizadas
- Límites inteligentes
- Paralelización

### 📝 Estrategias

#### 7.1. Caché Inteligente
```typescript
interface CacheStrategy {
  // Cachea resultados de búsquedas comunes
  cacheKey(query: string, params: any): string;
  
  // TTL (Time To Live) basado en frecuencia de actualización
  getTTL(query: string): number;
  
  // Invalida cache cuando se actualizan datos
  invalidateCache(trigger: 'insert' | 'update' | 'delete');
}
```

#### 7.2. Consultas Optimizadas
```typescript
// Usar índices de Supabase
// - Búsquedas full-text en español
// - Índices en SKU, categoría, fecha
// - Consultas con LIMIT y OFFSET apropiados

// Ejemplo de consulta optimizada:
const optimizedQuery = `
  SELECT * FROM products
  WHERE to_tsvector('spanish', name || ' ' || description) @@ to_tsquery('spanish', $1)
  AND category ILIKE $2
  ORDER BY date_add DESC
  LIMIT $3 OFFSET $4
`;
```

#### 7.3. Límites Inteligentes
```typescript
// Ajustar límites según el tipo de consulta
const smartLimits = {
  search: 20,           // Búsquedas generales: pocos resultados
  sku_lookup: 1,        // Búsqueda por SKU: un resultado
  category_browse: 50,  // Navegación por categoría: más resultados
  stats: 100            // Estadísticas: todos los necesarios
};
```

### ✅ Ventajas
- **Respuestas rápidas**: Caché y optimización
- **Menor costo**: Menos llamadas a OpenAI y Supabase
- **Mejor UX**: Respuestas instantáneas
- **Escalabilidad**: Maneja más usuarios

---

## 8. IMPLEMENTACIÓN TÉCNICA

### 📁 Estructura de Archivos

```
api/
  ├── chat.ts                    # Endpoint principal del chat
  ├── query-products.ts          # Consultas a Supabase
  ├── validate-query.ts          # Validación de consultas
  └── cache.ts                   # Sistema de caché

src/
  ├── components/
  │   ├── ChatConfig.tsx         # Configuración de OpenAI
  │   ├── Chat.tsx               # Componente del chat
  │   └── MessageList.tsx        # Lista de mensajes
  ├── services/
  │   ├── openaiService.ts       # Servicio de OpenAI
  │   ├── queryPreprocessor.ts   # Preprocesamiento
  │   └── responsePostprocessor.ts # Post-procesamiento
  └── types.ts                   # Tipos TypeScript
```

### 🔧 Tecnologías Necesarias

```json
{
  "dependencies": {
    "openai": "^4.0.0",           // SDK de OpenAI
    "@supabase/supabase-js": "^2.78.0",  // Ya existe
    "zod": "^3.22.0",             // Validación de esquemas
    "node-cache": "^5.1.2"        // Caché en memoria
  }
}
```

### 🔐 Variables de Entorno

```env
OPENAI_API_KEY=sk-...              # API Key de OpenAI
SUPABASE_URL=https://...           # Ya existe
SUPABASE_ANON_KEY=...              # Ya existe
OPENAI_DEFAULT_MODEL=gpt-4         # Modelo por defecto
OPENAI_DEFAULT_TEMPERATURE=0.7     # Temperatura por defecto
OPENAI_MAX_TOKENS=2000             # Máximo de tokens
CACHE_TTL=300                      # TTL del caché (5 min)
```

---

## 🎯 RESUMEN DE MEJORAS

### 1. **System Prompt Optimizado** ✅
- Contexto completo del negocio
- Instrucciones claras
- Ejemplos concretos
- Manejo de errores

### 2. **Function Calling Inteligente** ✅
- 5 funciones especializadas
- Descripciones detalladas
- Parámetros flexibles
- Casos de uso claros

### 3. **Preprocesamiento** ✅
- Normalización de texto
- Extracción de entidades
- Corrección ortográfica
- Detección de intención

### 4. **Post-procesamiento** ✅
- Formateo de datos
- Enriquecimiento con enlaces/imágenes
- Validación de respuestas
- Sugerencias inteligentes

### 5. **Contexto Enriquecido** ✅
- Estadísticas iniciales
- Historial de conversación
- Sugerencias cuando no hay resultados
- Contexto dinámico

### 6. **Validación y Seguridad** ✅
- Prevención de SQL injection
- Validación de parámetros
- Límites de recursos
- Rate limiting

### 7. **Performance** ✅
- Caché inteligente
- Consultas optimizadas
- Límites adaptativos
- Paralelización

---

## 📊 MÉTRICAS DE ÉXITO

### Antes vs Después

| Métrica | Antes | Después (Esperado) |
|---------|-------|-------------------|
| Precisión de respuestas | 60% | 90%+ |
| Tiempo de respuesta | 3-5s | 1-2s |
| Tasa de resultados útiles | 70% | 95%+ |
| Manejo de errores | Básico | Completo |
| Experiencia de usuario | Regular | Excelente |

---

## 🚀 PRÓXIMOS PASOS

1. **Implementar System Prompt** (1-2 horas)
2. **Crear Function Calling** (2-3 horas)
3. **Desarrollar Pre/Post-procesamiento** (3-4 horas)
4. **Añadir Contexto Enriquecido** (2-3 horas)
5. **Implementar Validación** (2 horas)
6. **Optimizar Performance** (2-3 horas)
7. **Testing y Ajustes** (3-4 horas)

**Total estimado: 15-21 horas**

---

## 💡 NOTAS FINALES

Esta propuesta implementa las mejores prácticas de:
- **OpenAI Function Calling**: Uso correcto de tools
- **RAG (Retrieval Augmented Generation)**: Consultas a base de datos
- **Prompt Engineering**: System prompts optimizados
- **Data Processing**: Pre/post procesamiento
- **Security**: Validación y sanitización

El resultado será un sistema que:
- ✅ Entiende preguntas naturales
- ✅ Consulta la base de datos correctamente
- ✅ Genera respuestas precisas y útiles
- ✅ Maneja errores elegantemente
- ✅ Ofrece una excelente experiencia de usuario


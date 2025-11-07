# 💻 EJEMPLOS PRÁCTICOS: Implementación OpenAI

## 📋 ÍNDICE
1. [Ejemplos de Conversaciones](#ejemplos-de-conversaciones)
2. [Flujo Completo de una Consulta](#flujo-completo-de-una-consulta)
3. [Código de Implementación](#código-de-implementación)
4. [Casos de Uso Reales](#casos-de-uso-reales)

---

## 🗣️ EJEMPLOS DE CONVERSACIONES

### Ejemplo 1: Búsqueda Simple

**Usuario:** "Busca productos de electrónica"

**Flujo:**
1. **Preprocesamiento:**
   ```typescript
   {
     intent: 'search',
     category: 'electrónica',
     normalized: 'busca productos de electronica'
   }
   ```

2. **OpenAI Function Call:**
   ```json
   {
     "name": "search_products",
     "arguments": {
       "category": "electrónica",
       "limit": 20,
       "sort_by": "date_add"
     }
   }
   ```

3. **Consulta a Supabase:**
   ```sql
   SELECT * FROM products
   WHERE category ILIKE '%electrónica%'
   ORDER BY date_add DESC
   LIMIT 20
   ```

4. **Resultado:**
   ```json
   {
     "products": [
       {
         "id": 1,
         "name": "Smartphone Samsung Galaxy",
         "price": "599.99 EUR",
         "category": "electrónica",
         "sku": "SM-GAL-001"
       },
       // ... más productos
     ],
     "total": 15
   }
   ```

5. **OpenAI Genera Respuesta:**
   ```
   Encontré 15 productos de electrónica:

   1. **Smartphone Samsung Galaxy** - 599,99 €
      SKU: SM-GAL-001
      [Ver producto](https://...)

   2. **Auriculares Bluetooth Sony** - 89,99 €
      SKU: SNY-BT-002
      [Ver producto](https://...)

   ...

   ¿Te interesa algún producto en particular?
   ```

---

### Ejemplo 2: Búsqueda por SKU

**Usuario:** "¿Cuánto cuesta el producto ABC123?"

**Flujo:**
1. **Preprocesamiento:**
   ```typescript
   {
     intent: 'get_by_sku',
     skus: ['ABC123'],
     normalized: 'cuanto cuesta el producto abc123'
   }
   ```

2. **OpenAI Function Call:**
   ```json
   {
     "name": "get_product_by_sku",
     "arguments": {
       "sku": "ABC123"
     }
   }
   ```

3. **Consulta a Supabase:**
   ```sql
   SELECT * FROM products
   WHERE sku ILIKE '%ABC123%'
   LIMIT 1
   ```

4. **Resultado:**
   ```json
   {
     "product": {
       "id": 42,
       "name": "Tablet iPad Pro",
       "price": "999.99 EUR",
       "category": "electrónica",
       "subcategory": "Tablets",
       "sku": "ABC123",
       "description": "Tablet iPad Pro 12.9 pulgadas...",
       "image_url": "https://...",
       "product_url": "https://..."
     }
   }
   ```

5. **OpenAI Genera Respuesta:**
   ```
   El producto con SKU **ABC123** es:

   **Tablet iPad Pro**
   Precio: **999,99 €**
   Categoría: Electrónica > Tablets

   Descripción: Tablet iPad Pro 12.9 pulgadas...

   [Ver producto completo](https://...)
   [Ver imagen](https://...)
   ```

---

### Ejemplo 3: Búsqueda sin Resultados

**Usuario:** "Busca productos de aviones de combate"

**Flujo:**
1. **Preprocesamiento:**
   ```typescript
   {
     intent: 'search',
     category: 'aviones de combate',
     normalized: 'busca productos de aviones de combate'
   }
   ```

2. **OpenAI Function Call:**
   ```json
   {
     "name": "search_products",
     "arguments": {
       "category": "aviones de combate",
       "limit": 20
     }
   }
   ```

3. **Consulta a Supabase:**
   ```sql
   SELECT * FROM products
   WHERE category ILIKE '%aviones de combate%'
   LIMIT 20
   ```

4. **Resultado:**
   ```json
   {
     "products": [],
     "total": 0
   }
   ```

5. **Post-procesamiento: Sugerencias**
   ```typescript
   const suggestions = {
     similarCategories: ['Juguetes', 'Modelos a escala'],
     popularProducts: await getPopularProducts(),
     relatedSearches: ['aviones', 'modelos', 'juguetes']
   }
   ```

6. **OpenAI Genera Respuesta:**
   ```
   No encontré productos de "aviones de combate" en la base de datos.

   Sin embargo, puedo ayudarte con:
   - **Categorías similares**: Juguetes, Modelos a escala
   - **Búsquedas relacionadas**: aviones, modelos, juguetes

   ¿Te gustaría buscar en alguna de estas categorías?
   ```

---

### Ejemplo 4: Búsqueda con Precio

**Usuario:** "Muéstrame productos entre 50 y 200 euros"

**Flujo:**
1. **Preprocesamiento:**
   ```typescript
   {
     intent: 'search',
     prices: { min: 50, max: 200 },
     normalized: 'muestrame productos entre 50 y 200 euros'
   }
   ```

2. **OpenAI Function Call:**
   ```json
   {
     "name": "search_products",
     "arguments": {
       "min_price": 50,
       "max_price": 200,
       "limit": 20,
       "sort_by": "price_asc"
     }
   }
   ```

3. **Consulta a Supabase:**
   ```sql
   SELECT * FROM products
   WHERE CAST(REPLACE(REPLACE(price, ' EUR', ''), ',', '.') AS NUMERIC) 
         BETWEEN 50 AND 200
   ORDER BY CAST(REPLACE(REPLACE(price, ' EUR', ''), ',', '.') AS NUMERIC) ASC
   LIMIT 20
   ```

4. **Resultado:** (lista de productos)

5. **OpenAI Genera Respuesta:**
   ```
   Encontré productos entre 50€ y 200€, ordenados de menor a mayor precio:

   1. **Producto A** - 52,99 €
   2. **Producto B** - 75,50 €
   3. **Producto C** - 89,99 €
   ...
   ```

---

### Ejemplo 5: Conversación con Contexto

**Usuario:** "Busca productos de ropa"
**Sistema:** "Encontré 30 productos de ropa..."
**Usuario:** "¿Cuál es el más barato?"

**Flujo:**
1. **Contexto de Conversación:**
   ```typescript
   const conversationHistory = [
     {
       role: 'user',
       content: 'Busca productos de ropa'
     },
     {
       role: 'assistant',
       content: 'Encontré 30 productos de ropa...',
       function_calls: [{
         name: 'search_products',
         arguments: { category: 'ropa', limit: 30 }
       }],
       function_results: {
         products: [/* 30 productos */]
       }
     },
     {
       role: 'user',
       content: '¿Cuál es el más barato?'
     }
   ]
   ```

2. **OpenAI Entiende el Contexto:**
   - No necesita hacer otra búsqueda
   - Usa los 30 productos ya obtenidos
   - Ordena por precio y devuelve el más barato

3. **OpenAI Genera Respuesta:**
   ```
   De los productos de ropa que encontré, el más barato es:

   **Camiseta Básica** - 9,99 €
   SKU: CAM-001
   Categoría: Ropa > Camisetas

   [Ver producto](https://...)
   ```

---

## 🔄 FLUJO COMPLETO DE UNA CONSULTA

```
┌─────────────────────────────────────────────────────────┐
│ 1. Usuario escribe pregunta                            │
│    "Busca productos de electrónica"                    │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 2. PREPROCESAMIENTO                                     │
│    - Normalizar texto                                   │
│    - Extraer entidades (categoría: "electrónica")      │
│    - Detectar intención (search)                       │
│    - Corregir errores                                   │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 3. VALIDACIÓN                                           │
│    - Validar parámetros                                 │
│    - Sanitizar consulta                                 │
│    - Verificar límites                                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 4. ENVIAR A OPENAI                                      │
│    - System Prompt (con contexto)                      │
│    - User Message (pregunta procesada)                  │
│    - Function Definitions (tools disponibles)           │
│    - Conversation History (si existe)                  │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 5. OPENAI DECIDE                                        │
│    ┌─────────────────────────────────────┐            │
│    │ ¿Necesita consultar BD?             │            │
│    │  - SÍ → Llama a función             │            │
│    │  - NO → Responde directamente        │            │
│    └─────────────────────────────────────┘            │
└─────────────────┬───────────────────────────────────────┘
                  │
        ┌─────────┴─────────┐
        │                   │
        ▼                   ▼
┌───────────────┐  ┌──────────────────────┐
│ 6A. FUNCTION  │  │ 6B. RESPUESTA        │
│    CALL       │  │    DIRECTA           │
└───────┬───────┘  └──────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────┐
│ 7. EJECUTAR FUNCIÓN                                     │
│    - Parsear argumentos de OpenAI                       │
│    - Construir consulta SQL                             │
│    - Ejecutar en Supabase                               │
│    - Procesar resultados                                │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 8. DEVOLVER RESULTADOS A OPENAI                         │
│    {                                                     │
│      "products": [...],                                 │
│      "total": 15                                        │
│    }                                                     │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 9. OPENAI GENERA RESPUESTA                              │
│    - Usa los datos de la BD                             │
│    - Formatea la respuesta                              │
│    - Añade contexto útil                               │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 10. POST-PROCESAMIENTO                                  │
│     - Formatear precios                                 │
│     - Añadir enlaces                                    │
│     - Validar coherencia                                │
│     - Enriquecer con imágenes                           │
└─────────────────┬───────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────────────────────┐
│ 11. MOSTRAR AL USUARIO                                  │
│     "Encontré 15 productos de electrónica..."          │
└─────────────────────────────────────────────────────────┘
```

---

## 💻 CÓDIGO DE IMPLEMENTACIÓN

### Estructura del Endpoint de Chat

```typescript
// api/chat.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
import { queryPreprocessor } from '../src/services/queryPreprocessor';
import { responsePostprocessor } from '../src/services/responsePostprocessor';
import { validateQuery } from '../src/services/validateQuery';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// System Prompt (ver PROPUESTA-MEJORA-OPENAI.md)
const SYSTEM_PROMPT = `...`;

// Function Definitions
const FUNCTIONS = [
  {
    name: "search_products",
    description: "Busca productos en la base de datos...",
    parameters: { /* ... */ }
  },
  // ... más funciones
];

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { 
      message,           // Mensaje del usuario
      conversationHistory = [],  // Historial de conversación
      config = {}        // Configuración de OpenAI (modelo, temperatura, etc.)
    } = req.body;

    // 1. PREPROCESAMIENTO
    const processed = queryPreprocessor.preprocess(message);
    
    // 2. VALIDACIÓN
    const validation = validateQuery(processed);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors });
      return;
    }

    // 3. PREPARAR MENSAJES PARA OPENAI
    const messages = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...conversationHistory,
      { role: 'user', content: processed.normalized }
    ];

    // 4. LLAMAR A OPENAI
    const completion = await openai.chat.completions.create({
      model: config.model || 'gpt-4',
      temperature: config.temperature || 0.7,
      max_tokens: config.max_tokens || 2000,
      messages: messages as any,
      tools: FUNCTIONS.map(f => ({
        type: 'function',
        function: f
      })),
      tool_choice: 'auto', // OpenAI decide cuándo usar funciones
    });

    const responseMessage = completion.choices[0].message;

    // 5. SI OPENAI LLAMÓ A UNA FUNCIÓN
    if (responseMessage.tool_calls) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      // Ejecutar función
      let functionResult;
      switch (functionName) {
        case 'search_products':
          functionResult = await searchProducts(functionArgs);
          break;
        case 'get_product_by_sku':
          functionResult = await getProductBySku(functionArgs);
          break;
        // ... más casos
      }

      // 6. ENVIAR RESULTADOS DE VUELTA A OPENAI
      const secondCompletion = await openai.chat.completions.create({
        model: config.model || 'gpt-4',
        temperature: config.temperature || 0.7,
        messages: [
          ...messages,
          responseMessage,
          {
            role: 'tool',
            tool_call_id: toolCall.id,
            content: JSON.stringify(functionResult)
          }
        ] as any,
        tools: FUNCTIONS.map(f => ({
          type: 'function',
          function: f
        })),
      });

      const finalMessage = secondCompletion.choices[0].message.content;

      // 7. POST-PROCESAMIENTO
      const finalResponse = responsePostprocessor.process(
        finalMessage,
        functionResult
      );

      res.status(200).json({
        success: true,
        message: finalResponse,
        function_called: functionName,
        data: functionResult
      });
    } else {
      // 8. RESPUESTA DIRECTA (sin función)
      const response = responsePostprocessor.process(
        responseMessage.content || ''
      );

      res.status(200).json({
        success: true,
        message: response
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Error processing chat request',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Funciones de consulta a Supabase
async function searchProducts(params: any) {
  let query = supabase.from('products').select('*');

  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%,sku.ilike.%${params.query}%`);
  }

  if (params.category) {
    query = query.ilike('category', `%${params.category}%`);
  }

  if (params.subcategory) {
    query = query.ilike('subcategory', `%${params.subcategory}%`);
  }

  // Ordenar
  if (params.sort_by === 'price_asc') {
    // Necesitaríamos una función para ordenar por precio numérico
  } else if (params.sort_by === 'date_add') {
    query = query.order('date_add', { ascending: false });
  }

  // Límite
  const limit = Math.min(params.limit || 20, 50);
  query = query.limit(limit);

  if (params.offset) {
    query = query.range(params.offset, params.offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) throw error;

  return {
    products: data || [],
    total: data?.length || 0
  };
}

async function getProductBySku(params: any) {
  const { data, error } = await supabase
    .from('products')
    .select('*')
    .ilike('sku', `%${params.sku}%`)
    .limit(1)
    .single();

  if (error) throw error;

  return { product: data };
}
```

---

## 🎯 CASOS DE USO REALES

### Caso 1: E-commerce Assistant
- Usuario busca productos
- Compara precios
- Encuentra productos similares
- Obtiene recomendaciones

### Caso 2: Inventory Management
- Consulta stock por SKU
- Estadísticas de categorías
- Productos recientes
- Análisis de precios

### Caso 3: Customer Support
- Búsqueda rápida de productos
- Información detallada
- Sugerencias cuando no hay resultados
- Respuestas en lenguaje natural

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Instalar dependencias (openai, zod, node-cache)
- [ ] Crear endpoint `/api/chat`
- [ ] Implementar System Prompt
- [ ] Definir Functions (5 funciones)
- [ ] Crear queryPreprocessor
- [ ] Crear responsePostprocessor
- [ ] Crear validateQuery
- [ ] Implementar funciones de consulta a Supabase
- [ ] Crear componente ChatConfig
- [ ] Crear componente Chat
- [ ] Añadir pestaña "Chat" al Dashboard
- [ ] Configurar variables de entorno
- [ ] Testing y ajustes

---

## 🚀 PRÓXIMOS PASOS

1. Revisar esta propuesta
2. Aprobar o sugerir cambios
3. Comenzar implementación
4. Testing iterativo
5. Deploy y monitoreo


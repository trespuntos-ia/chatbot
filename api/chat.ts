import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';
// Scraping desactivado temporalmente para evitar FUNCTION_INVOCATION_FAILED
// import { scrapeProductPage } from './utils/productScraper';

// Función para procesar prompt con variables
function processPrompt(prompt: any): string {
  let processedPrompt = prompt.prompt;
  
  if (prompt.prompt_variables && prompt.prompt_variables.length > 0) {
    prompt.prompt_variables.forEach((variable: any) => {
      const regex = new RegExp(`\\{\\{${variable.variable_name}\\}\\}`, 'g');
      processedPrompt = processedPrompt.replace(regex, variable.variable_value || '');
    });
  }
  
  return processedPrompt;
}

const FUNCTION_LABELS: Record<string, string> = {
  search_products: 'Búsqueda de productos (Supabase)',
  get_product_by_sku: 'Consulta por SKU (Supabase)',
  get_similar_products: 'Productos similares (Supabase)',
  get_product_recommendations: 'Recomendaciones de productos (Supabase)',
  compare_products: 'Comparación de productos (Supabase)',
  search_products_by_category: 'Búsqueda por categoría (Supabase)',
  get_product_categories: 'Listado de categorías (Supabase)',
  clarify_search_intent: 'Sugerencias de búsqueda (Supabase)',
  get_products_by_price_range: 'Búsqueda por precio (Supabase)',
  get_product_specifications: 'Especificaciones de producto (Supabase)',
  get_popular_products: 'Productos destacados (Supabase)',
  search_web_content: 'Contenido web indexado',
};

function getFunctionLabel(functionName: string): string {
  return FUNCTION_LABELS[functionName] || `Función ${functionName}`;
}

const SEMANTIC_UNDERSTANDING_DEFAULT_MODEL =
  process.env.OPENAI_COMPREHENSION_MODEL || 'gpt-4o-mini';

type SemanticUnderstanding = {
  product_focus?: boolean;
  intent?: 'buy' | 'compare' | 'info' | 'search' | 'support' | 'other';
  confidence?: number;
  categories?: string[];
  search_terms?: string[];
  summary?: string;
};

type IntentResult = {
  intent: 'buy' | 'compare' | 'info' | 'search';
  urgency: 'high' | 'medium' | 'low';
  source?: 'heuristic' | 'semantic' | 'merged';
  confidence?: number;
};

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Verificar variables de entorno
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!openaiApiKey) {
      res.status(500).json({
        error: 'OpenAI API key missing',
        details: 'Please configure OPENAI_API_KEY in Vercel environment variables'
      });
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing',
        details: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables'
      });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Capturar tiempo de inicio para medir tiempo de respuesta
    const startTime = Date.now();
    const timingSteps: { name: string; duration_ms: number }[] = [];
    const recordStep = (name: string, start: number) => {
      const duration = Date.now() - start;
      timingSteps.push({
        name,
        duration_ms: duration < 0 ? 0 : duration,
      });
    };
    const buildTimings = () => ({
      total_ms: Date.now() - startTime,
      steps: timingSteps.map(step => ({ ...step })),
    });

    // Obtener datos de la request
    const {
      message,
      conversationHistory = [],
      config = {},
      sessionId
    } = req.body;

    // Log para debugging
    console.log('[Chat API] Request recibida:', {
      hasMessage: !!message,
      messageLength: message?.length || 0,
      sessionId: sessionId || 'NO ENVIADO',
      conversationHistoryLength: conversationHistory?.length || 0
    });

    if (!message || typeof message !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid message',
        details: 'The message field is required and must be a string'
      });
      return;
    }

    // 1. Cargar el prompt activo desde Supabase
    const promptFetchStart = Date.now();
    const { data: activePrompts, error: promptError } = await supabase
      .from('system_prompts')
      .select('*, prompt_variables(*)')
      .eq('is_active', true)
      .limit(1)
      .single();
    recordStep('Carga de prompt (Supabase)', promptFetchStart);

    if (promptError || !activePrompts) {
      res.status(500).json({
        error: 'No active prompt found',
        details: 'Please activate a prompt in the Configuration AI section'
      });
      return;
    }

    // 2. Procesar el prompt con las variables
    const systemPrompt = processPrompt({
      ...activePrompts,
      variables: activePrompts.prompt_variables || []
    });

    // 3. Limitar historial de conversación (incluir solo si es continuación relevante)
    const limitedHistory = getRelevantHistory(message, conversationHistory);

    // 4. Definir funciones disponibles para Function Calling
    const functions = [
      {
        name: 'search_products',
        description: 'OBLIGATORIO: Debes usar esta función SIEMPRE que el usuario pregunte por productos, mencione un producto, o pregunte si tienes algo. NUNCA respondas sobre disponibilidad de productos sin usar esta función primero. La búsqueda es flexible y encuentra variaciones de palabras (ej: "cierre" encuentra "cierra", "pajitas" encuentra "pajita", "cartón" encuentra "carton"). Si el usuario pregunta "¿tienes X?" o "busca X" o "productos de X", DEBES llamar a esta función con query=X. Si no encuentras resultados, entonces puedes decir que no hay productos. Pero NUNCA digas que no hay productos sin haber buscado primero con esta función.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Texto de búsqueda para buscar en nombre, descripción o SKU. Puedes usar palabras clave del producto (ej: "cierre latas" encontrará "Cierra latas Pet"). La búsqueda es flexible y encuentra variaciones de palabras automáticamente. Si está vacío, devuelve todos los productos (con límite).'
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
      },
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
      },
      {
        name: 'get_similar_products',
        description: 'Obtiene productos similares a uno específico. Útil cuando el usuario pregunta por productos relacionados, alternativas o similares. También puedes usarla cuando el usuario dice "qué otros productos similares tienes" o "productos relacionados".',
        parameters: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'ID del producto de referencia (si se conoce).'
            },
            product_name: {
              type: 'string',
              description: 'Nombre del producto de referencia para buscar primero si no se conoce el ID.'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de productos similares a devolver. Por defecto: 5.'
            }
          },
          required: []
        }
      },
      {
        name: 'get_product_recommendations',
        description: 'Obtiene recomendaciones de productos basadas en un uso específico, necesidad o criterio. Útil cuando el usuario pregunta "¿qué me recomiendas para...?" o "¿cuál es el mejor producto para...?" o menciona un caso de uso específico.',
        parameters: {
          type: 'object',
          properties: {
            use_case: {
              type: 'string',
              description: 'Para qué se necesita el producto (ej: "cocinar pasta", "cortar verduras", "sellado de latas").'
            },
            category: {
              type: 'string',
              description: 'Filtrar por categoría si el usuario la menciona (opcional).'
            },
            budget_range: {
              type: 'string',
              enum: ['bajo', 'economico', 'medio', 'alto', 'premium'],
              description: 'Rango de presupuesto: "bajo"/"economico" (<50€), "medio" (50-200€), "alto"/"premium" (>200€).'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de recomendaciones. Por defecto: 5.'
            }
          },
          required: ['use_case']
        }
      },
      {
        name: 'compare_products',
        description: 'Compara características, precios y especificaciones de múltiples productos. Útil cuando el usuario quiere comparar productos o elegir entre opciones. Ejemplo: "¿cuál es la diferencia entre X e Y?" o "compara estos productos".',
        parameters: {
          type: 'object',
          properties: {
            product_names: {
              type: 'array',
              items: { type: 'string' },
              description: 'Nombres de productos a comparar.'
            },
            product_ids: {
              type: 'array',
              items: { type: 'string' },
              description: 'IDs de productos a comparar (si se conocen).'
            }
          },
          required: []
        }
      },
      {
        name: 'search_products_by_category',
        description: 'Busca productos filtrados por categoría con búsqueda de texto opcional. Útil cuando el usuario menciona una categoría específica (ej: "productos de cocina", "herramientas de corte"). Permite búsquedas más específicas dentro de una categoría.',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Nombre de la categoría (ej: "Cocina", "Herramientas", "Hogar").'
            },
            query: {
              type: 'string',
              description: 'Texto de búsqueda adicional para filtrar dentro de la categoría (opcional).'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados. Por defecto: 15.'
            },
            offset: {
              type: 'number',
              description: 'Número de resultados a saltar (para paginación).'
            }
          },
          required: ['category']
        }
      },
      {
        name: 'get_product_categories',
        description: 'Obtiene todas las categorías de productos disponibles. Útil cuando el usuario pregunta qué categorías o tipos de productos hay disponibles, o cuando necesita navegar por categorías.',
        parameters: {
          type: 'object',
          properties: {
            include_subcategories: {
              type: 'boolean',
              description: 'Si incluir subcategorías en la respuesta. Por defecto: false.'
            }
          },
          required: []
        }
      },
      {
        name: 'clarify_search_intent',
        description: 'Analiza la intención de búsqueda del usuario y sugiere términos de búsqueda alternativos o relacionados. Útil cuando no se encuentran resultados o cuando se quiere mejorar la búsqueda. Esta función genera sugerencias inteligentes basadas en variaciones de palabras.',
        parameters: {
          type: 'object',
          properties: {
            original_query: {
              type: 'string',
              description: 'Término de búsqueda original que no produjo resultados.'
            },
            failed_search: {
              type: 'boolean',
              description: 'Si la búsqueda anterior falló (por defecto: true).'
            }
          },
          required: ['original_query']
        }
      },
      {
        name: 'get_products_by_price_range',
        description: 'Busca productos dentro de un rango de precios específico. Útil cuando el usuario menciona un presupuesto o rango de precio (ej: "productos entre 50-100 euros", "productos económicos").',
        parameters: {
          type: 'object',
          properties: {
            min_price: {
              type: 'number',
              description: 'Precio mínimo en euros.'
            },
            max_price: {
              type: 'number',
              description: 'Precio máximo en euros.'
            },
            category: {
              type: 'string',
              description: 'Filtrar por categoría (opcional).'
            },
            query: {
              type: 'string',
              description: 'Texto de búsqueda adicional (opcional).'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados. Por defecto: 15.'
            }
          },
          required: []
        }
      },
      {
        name: 'get_product_specifications',
        description: 'Obtiene especificaciones técnicas detalladas de un producto. Útil cuando el usuario pregunta por dimensiones, materiales, características técnicas, peso, o cualquier detalle específico del producto.',
        parameters: {
          type: 'object',
          properties: {
            product_id: {
              type: 'string',
              description: 'ID del producto (si se conoce).'
            },
            product_name: {
              type: 'string',
              description: 'Nombre del producto para buscar primero si no se conoce el ID.'
            }
          },
          required: []
        }
      },
      {
        name: 'get_popular_products',
        description: 'Obtiene los productos más populares o mejor valorados. Útil cuando el usuario pregunta por productos destacados, más vendidos, mejor valorados, o simplemente "qué productos recomiendas".',
        parameters: {
          type: 'object',
          properties: {
            category: {
              type: 'string',
              description: 'Filtrar por categoría (opcional).'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de productos. Por defecto: 10.'
            }
          },
          required: []
        }
      },
      {
        name: 'search_web_content',
        description: 'Busca información detallada sobre productos en el contenido web indexado. IMPORTANTE: Usa esta función cuando el usuario pregunta por detalles específicos de un producto (características, especificaciones técnicas, instrucciones de uso, etc.) o cuando quieres información más completa que la disponible en la base de datos básica. Esta función busca en contenido web previamente indexado de páginas de productos, que incluye descripciones completas, características, especificaciones técnicas y otra información detallada.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Texto de búsqueda. Puede ser el nombre del producto, características, o términos relacionados. Ejemplos: "Aromatic Rellenable", "características", "especificaciones", "cómo usar", etc.'
            },
            product_id: {
              type: 'string',
              description: 'ID del producto si se conoce (opcional). Si se proporciona, busca contenido específico de ese producto.'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de resultados. Por defecto: 5.'
            }
          },
          required: ['query']
        }
      }
    ];

    // 5. Comprensión semántica previa (opcional con modelo ligero)
    const enableSemanticUnderstanding = false;
    let semanticUnderstanding: SemanticUnderstanding | null = null;

    // 6. Detectar intención del usuario usando heurísticas simples
    const userIntent = detectUserIntent(message);
    const isComparisonQuery = userIntent.intent === 'compare';

    // 7. Detectar término de búsqueda con heurísticas simples
    const detectedCategory = null;
    const heuristicSearchTerm = extractSearchTermFromMessage(message);
    const searchTermForInstructions = heuristicSearchTerm;

    // 8. Detectar si el mensaje es sobre productos para forzar búsqueda
    // PERO solo si NO es una pregunta de comparación
    const semanticProductFocus = false;
    const isProductQuery =
      detectProductQuery(message) && !isComparisonQuery;

    // 9. Preparar mensajes para OpenAI (con historial limitado)
    // Añadir instrucción adicional al system prompt si es una pregunta sobre productos
    let enhancedSystemPrompt = systemPrompt;
    if (isComparisonQuery) {
      // Para preguntas de comparación, instruir a usar compare_products
      enhancedSystemPrompt += '\n\n⚠️ ATENCIÓN: El usuario quiere COMPARAR productos específicos. DEBES usar la función compare_products con los nombres de los productos mencionados. Extrae los nombres de los productos del mensaje y úsalos en product_names.';
    } else if (isProductQuery) {
      if (detectedCategory) {
        // Si se detectó una categoría, priorizar search_products_by_category
        enhancedSystemPrompt += `\n\n⚠️ ATENCIÓN: El usuario está preguntando sobre productos en la categoría "${detectedCategory}". DEBES usar la función search_products_by_category con category="${detectedCategory}" ANTES de responder. También puedes usar search_products con query para buscar términos específicos dentro de esa categoría. NO respondas directamente sin buscar en la base de datos.`;
      } else {
        enhancedSystemPrompt += '\n\n⚠️ ATENCIÓN: El usuario está preguntando sobre productos. DEBES usar la función search_products ANTES de responder. NO respondas directamente sin buscar en la base de datos.';
      }
    }
    
    const messages: any[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...limitedHistory,
      { role: 'user', content: message }
    ];

    // 8. Configuración de OpenAI (OPTIMIZADO PARA VELOCIDAD)
    const model = config.model || 'gpt-3.5-turbo'; // Por defecto más rápido
    const temperature = config.temperature !== undefined ? config.temperature : 0.6;
    const maxTokens = config.max_tokens || 600; // Reducido para acelerar la generación

    // 9. Llamar a OpenAI (con timeout para evitar errores de Vercel)
    // Si es una pregunta sobre productos, forzar el uso de herramientas
    let completion;
    let openaiCall1Start = 0;
    try {
      // Si es una pregunta sobre productos, forzar búsqueda
      let toolChoice: any = 'auto';
      if (isProductQuery) {
        if (searchTermForInstructions && searchTermForInstructions !== message.trim()) {
          messages[messages.length - 1] = {
            role: 'user',
            content: `${message}

[IMPORTANTE: Busca productos relacionados con "${searchTermForInstructions}" usando la función search_products antes de responder.]`
          };
        }

        toolChoice = {
          type: 'function' as const,
          function: {
            name: 'search_products'
          }
        };
      }
      
      openaiCall1Start = Date.now();
      console.time('openai_call_1');
      completion = await Promise.race([
        openai.chat.completions.create({
          model,
          temperature,
          max_tokens: maxTokens,
          messages,
          tools: functions.map(f => ({
            type: 'function' as const,
            function: f
          })),
          tool_choice: toolChoice
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('OpenAI request timeout')), 15000) // Reducido a 15s para mayor velocidad
        )
      ]) as any;
      console.timeEnd('openai_call_1');
      recordStep('Consulta a OpenAI (1)', openaiCall1Start);
    } catch (openaiError) {
      if (openaiCall1Start) {
        recordStep('Consulta a OpenAI (1) - error', openaiCall1Start);
      }
      console.error('OpenAI API error:', openaiError);
      res.status(500).json({
        success: false,
        error: 'Error al comunicarse con OpenAI',
        message: openaiError instanceof Error ? openaiError.message : 'Timeout o error desconocido',
        details: 'Por favor, intenta de nuevo en un momento'
      });
      return;
    }

    // Validar que completion tiene la estructura esperada
    if (!completion || !completion.choices || !completion.choices[0] || !completion.choices[0].message) {
      console.error('OpenAI completion invalid structure:', completion);
      res.status(500).json({
        success: false,
        error: 'Respuesta inválida de OpenAI',
        details: 'La respuesta de OpenAI no tiene la estructura esperada',
        completion: completion ? 'exists but invalid structure' : 'null'
      });
      return;
    }

    const responseMessage = completion.choices[0].message;
    
    // Capturar tokens de la primera llamada
    let firstCallTokens = 0;
    let totalTokens = 0;
    if (completion.usage) {
      firstCallTokens = completion.usage.total_tokens || 0;
      console.log('[Tokens] Primera llamada:', {
        prompt_tokens: completion.usage.prompt_tokens || 0,
        completion_tokens: completion.usage.completion_tokens || 0,
        total_tokens: firstCallTokens
      });
    }

    // 8. Si OpenAI llamó a una función
    if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
      const toolCall = responseMessage.tool_calls[0];
      const functionName = toolCall.function.name;
      let functionArgs: any;

      try {
        functionArgs = JSON.parse(toolCall.function.arguments);
      } catch (e) {
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            error: 'Invalid function arguments',
            details: 'Failed to parse function arguments from OpenAI',
            message: 'Error al procesar la solicitud de OpenAI'
          });
        }
        return;
      }

      // Ejecutar la función
      let functionResult: any;
      const functionExecutionStart = Date.now();

      switch (functionName) {
        case 'search_products':
          functionResult = await searchProducts(supabase, functionArgs);
          break;
        case 'get_product_by_sku':
          functionResult = await getProductBySku(supabase, functionArgs);
          break;
        case 'get_similar_products':
          functionResult = await getSimilarProducts(supabase, functionArgs);
          break;
        case 'get_product_recommendations':
          functionResult = await getProductRecommendations(supabase, functionArgs);
          break;
        case 'compare_products':
          functionResult = await compareProducts(supabase, functionArgs);
          break;
        case 'search_products_by_category':
          functionResult = await searchProductsByCategory(supabase, functionArgs);
          break;
        case 'get_product_categories':
          functionResult = await getProductCategories(supabase, functionArgs);
          break;
        case 'clarify_search_intent':
          functionResult = await clarifySearchIntent(supabase, functionArgs);
          break;
        case 'get_products_by_price_range':
          functionResult = await getProductsByPriceRange(supabase, functionArgs);
          break;
        case 'get_product_specifications':
          functionResult = await getProductSpecifications(supabase, functionArgs);
          break;
        case 'get_popular_products':
          functionResult = await getPopularProducts(supabase, functionArgs);
          break;
        case 'search_web_content':
          functionResult = await searchWebContent(supabase, functionArgs, req);
          break;
        default:
          res.status(500).json({
            success: false,
            error: 'Unknown function',
            details: `Function ${functionName} is not implemented`
          });
          return;
      }

      recordStep(getFunctionLabel(functionName), functionExecutionStart);

      // Detectar intención del usuario (ya la tenemos, pero recalcular por si cambió)
      const userIntent = detectUserIntent(message);
      
      // Si no hay resultados, intentar generar alternativas automáticas
      if (
        functionName === 'search_products' &&
        (!functionResult.products || functionResult.products.length === 0)
      ) {
        console.log('No se encontraron productos para la búsqueda realizada.');
      }

      const searchTermForResult = heuristicSearchTerm;

      if (shouldUseQuickResponse(functionName, functionResult, userIntent)) {
        const product = functionResult.products[0];
        const quickMessage = buildQuickResponse(
          product,
          searchTermForResult,
          userIntent
        );

        totalTokens = firstCallTokens || 0;

        const responseTime = Date.now() - startTime;
        const saveAnalyticsStart = Date.now();
        const conversationId = await saveConversationToAnalytics(
          supabase,
          sessionId || 'default',
          message,
          quickMessage,
          functionName,
          functionResult.products,
          functionArgs?.category || functionArgs?.subcategory,
          model,
          responseTime,
          totalTokens
        );
        recordStep('Guardar analytics (Supabase)', saveAnalyticsStart);

        const finalTimings = buildTimings();
        const assistantMessage = {
          role: 'assistant',
          content: quickMessage,
          function_calls: [toolCall],
          products: functionResult.products,
          sources: ['products_db'],
          quick_response: true,
          response_timings: finalTimings
        };

        res.status(200).json({
          success: true,
          message: quickMessage,
          function_called: functionName,
          function_result: functionResult,
          conversation_id: conversationId,
          conversation_history: [
            ...conversationHistory,
            { role: 'user', content: message },
            assistantMessage
          ],
          timings: finalTimings
        });
        return;
      }

      if (shouldUseStructuredResponse(functionName, functionResult, userIntent)) {
        const structuredMessage = buildStructuredResponse(
          functionResult.products,
          searchTermForResult,
          userIntent,
          functionArgs?.category || functionArgs?.subcategory || detectedCategory,
          functionResult.total
        );

        totalTokens = firstCallTokens || 0;

        const responseTime = Date.now() - startTime;
        const saveAnalyticsStart = Date.now();
        const conversationId = await saveConversationToAnalytics(
          supabase,
          sessionId || 'default',
          message,
          structuredMessage,
          functionName,
          functionResult.products,
          functionArgs?.category || functionArgs?.subcategory,
          model,
          responseTime,
          totalTokens
        );
        recordStep('Guardar analytics (Supabase)', saveAnalyticsStart);

        const finalTimings = buildTimings();
        const assistantMessage = {
          role: 'assistant',
          content: structuredMessage,
          function_calls: [toolCall],
          products: functionResult.products,
          sources: ['products_db'],
          structured_response: true,
          response_timings: finalTimings
        };

        res.status(200).json({
          success: true,
          message: structuredMessage,
          function_called: functionName,
          function_result: functionResult,
          conversation_id: conversationId,
          conversation_history: [
            ...conversationHistory,
            { role: 'user', content: message },
            assistantMessage
          ],
          timings: finalTimings
        });
        return;
      }

      // Pasar userIntent a searchProducts si es search_products
      if (functionName === 'search_products' && functionArgs) {
        functionArgs.userIntent = userIntent;
      }

      // Preparar contexto básico para la segunda llamada
      let enrichedContext = '';

      if (functionName === 'compare_products') {
        enrichedContext += '\n\n📊 INSTRUCCIONES BÁSICAS PARA COMPARAR:\n';
        enrichedContext += '• Resume primero las diferencias clave (precio, uso, características).\n';
        enrichedContext += '• Después compara punto por punto aquello que ayude a la decisión.\n';
        enrichedContext += '• Cierra con una recomendación clara explicando cuándo elegir cada opción.\n';
      } else {
        enrichedContext += '\n\n📋 INSTRUCCIONES BÁSICAS PARA PRODUCTOS:\n';
        enrichedContext += '• Empieza con "He encontrado X productos relacionados con [término]".\n';
        enrichedContext += '• Para cada producto, indica nombre, precio (si existe) y una frase breve de valor.\n';
        enrichedContext += '• Invita al usuario a pedir más detalles o concretar su necesidad.\n';
      }

      if (functionResult?.products && Array.isArray(functionResult.products) && functionResult.products.length > 0) {
        enrichedContext += '\n\n🗂️ PRODUCTOS DISPONIBLES:\n';
        functionResult.products.slice(0, 5).forEach((product: any, index: number) => {
          const priceInfo = product.price ? ` - ${product.price}` : '';
          enrichedContext += `${index + 1}. ${product.name}${priceInfo}\n`;
        });
        if (functionResult.products.length > 5) {
          enrichedContext += `... y ${functionResult.products.length - 5} producto(s) más.\n`;
        }
      } else if (functionName === 'compare_products') {
        enrichedContext += '\n\n⚠️ No se encontraron productos suficientes para comparar. Explica la situación y solicita referencias concretas.';
      } else {
        enrichedContext += '\n\n⚠️ No se encontraron productos. Muestra empatía y pide al usuario más detalles para volver a intentarlo.';
      }

      const systemPromptWithContext = systemPrompt + enrichedContext;

      console.log(`Function ${functionName} executed successfully. Result size:`,
        JSON.stringify(functionResult).length, 'bytes');

      // Inicializar totalTokens con los tokens de la primera llamada (asegurar que esté definido)
      totalTokens = firstCallTokens || 0;

      const messagesWithContext = [
        { role: 'system', content: systemPromptWithContext },
        ...limitedHistory,
        { role: 'user', content: message },
        responseMessage,
        {
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(functionResult)
        }
      ];

      console.log(`Sending to OpenAI: ${messagesWithContext.length} messages, function result:`,
        functionResult.products ? `${functionResult.products.length} products` : 'other data');

      // Segunda llamada a OpenAI también con timeout
      let secondCompletion: any = null;
      let secondCallTokens = 0;
      
      let openaiCall2Start = 0;
      try {
        console.log('Calling OpenAI second completion (context simplificado).');
        openaiCall2Start = Date.now();
        console.time('openai_call_2');
        secondCompletion = await Promise.race([
          openai.chat.completions.create({
            model,
            temperature,
            max_tokens: maxTokens,
            messages: messagesWithContext as any,
            tools: functions.map(f => ({
              type: 'function' as const,
              function: f
            })),
            tool_choice: 'auto'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI request timeout')), 20000) // Reducido a 20s para mayor velocidad
          )
        ]) as any;
        console.timeEnd('openai_call_2');
        recordStep('Consulta a OpenAI (2)', openaiCall2Start);
        
        // Capturar tokens de la segunda llamada
        if (secondCompletion?.usage) {
          secondCallTokens = secondCompletion.usage.total_tokens || 0;
          console.log('[Tokens] Segunda llamada:', {
            prompt_tokens: secondCompletion.usage.prompt_tokens || 0,
            completion_tokens: secondCompletion.usage.completion_tokens || 0,
            total_tokens: secondCallTokens
          });
        }
        
        totalTokens = (firstCallTokens || 0) + secondCallTokens;
        console.log('[Tokens] Total para esta conversación:', totalTokens);
        
        console.log('OpenAI second completion received:', {
          hasContent: !!secondCompletion?.choices?.[0]?.message?.content,
          contentLength: secondCompletion?.choices?.[0]?.message?.content?.length || 0
        });
      } catch (openaiError) {
        if (openaiCall2Start) {
          recordStep('Consulta a OpenAI (2) - error', openaiCall2Start);
        }
        console.error('OpenAI second completion error:', openaiError);
        // Asegurar que totalTokens esté definido incluso si falla
        totalTokens = firstCallTokens || 0;
        
        // Si falla, intentar generar una respuesta básica con los datos
        if (functionResult.products && functionResult.products.length > 0) {
          const products = functionResult.products.slice(0, 5);
          const productList = products.map((p: any, idx: number) => {
            return `${idx + 1}. **${p.name}**${p.price ? ` - ${p.price}` : ''}${p.category ? ` (${p.category})` : ''}`;
          }).join('\n');
          
          const fallbackMessage = `He encontrado ${functionResult.products.length} producto(s) relacionado(s) con tu búsqueda:\n\n${productList}${functionResult.products.length > 5 ? `\n\nY ${functionResult.products.length - 5} producto(s) más disponible(s).` : ''}\n\n¿Te gustaría más información sobre alguno de estos productos?`;

          const finalTimings = buildTimings();

          res.status(200).json({
            success: true,
            message: fallbackMessage,
            function_called: functionName,
            function_result: functionResult,
            fallback: true,
            conversation_history: [
              ...conversationHistory,
              { role: 'user', content: message },
              {
                role: 'assistant',
                content: fallbackMessage,
                function_calls: [toolCall],
                sources: ['products_db'],
                response_timings: finalTimings
              }
            ],
            timings: finalTimings
          });
          return;
        }
        
        // Si no hay productos, generar mensaje de error más útil
        const errorFallbackMessage = 'He consultado la base de datos pero no encontré resultados específicos. ¿Podrías ser más específico en tu búsqueda? Por ejemplo, menciona la categoría o características que buscas.';

        const finalTimings = buildTimings();

        res.status(200).json({
          success: true,
          message: errorFallbackMessage,
          function_called: functionName,
          function_result: functionResult,
          fallback: true,
          conversation_history: [
            ...conversationHistory,
            { role: 'user', content: message },
            {
              role: 'assistant',
              content: errorFallbackMessage,
              function_calls: [toolCall],
              sources: ['products_db'],
              response_timings: finalTimings
            }
          ],
          timings: finalTimings
        });
        return;
      }

      // Validar que la respuesta existe y tiene contenido
      if (!secondCompletion || !secondCompletion.choices || !secondCompletion.choices[0]) {
        console.error('OpenAI second completion invalid structure:', secondCompletion);
        // Respuesta de fallback
        if (functionResult.products && functionResult.products.length > 0) {
          const productNames = functionResult.products.slice(0, 5).map((p: any) => p.name).join(', ');
          const fallbackMessage = `Encontré ${functionResult.products.length} producto(s): ${productNames}${functionResult.products.length > 5 ? ' y más...' : ''}. ¿Te gustaría más información sobre alguno de estos productos?`;
          
          const finalTimings = buildTimings();

          res.status(200).json({
            success: true,
            message: fallbackMessage,
            function_called: functionName,
            function_result: functionResult,
            fallback: true,
            conversation_history: [
              ...conversationHistory,
              { role: 'user', content: message },
              {
                role: 'assistant',
                content: fallbackMessage,
                function_calls: [toolCall],
                sources: ['products_db'],
                response_timings: finalTimings
              }
            ],
            timings: finalTimings
          });
          return;
        }
        
        // En lugar de error 500, devolver fallback útil
        const errorFallbackMessage = functionResult.products && functionResult.products.length > 0
          ? `He encontrado ${functionResult.products.length} producto(s) pero hubo un problema al generar la respuesta. Por favor, intenta de nuevo.`
          : 'He consultado la base de datos pero no encontré resultados específicos. ¿Podrías ser más específico en tu búsqueda?';
        
        const finalTimings = buildTimings();

        res.status(200).json({
          success: true,
          message: errorFallbackMessage,
          function_called: functionName,
          function_result: functionResult,
          fallback: true,
          conversation_history: [
            ...conversationHistory,
            { role: 'user', content: message },
            {
              role: 'assistant',
              content: errorFallbackMessage,
              function_calls: [toolCall],
              sources: ['products_db'],
              response_timings: finalTimings
            }
          ],
          timings: finalTimings
        });
        return;
      }

      const finalMessage = secondCompletion.choices[0].message?.content || '';
      
      // Si el mensaje está vacío, generar uno de fallback MEJORADO
      if (!finalMessage || finalMessage.trim().length === 0) {
        console.warn('OpenAI returned empty message, using fallback');
        
        // Generar mensaje de fallback más completo
        let fallbackMessage = '';
        
        if (functionResult.products && functionResult.products.length > 0) {
          const products = functionResult.products.slice(0, 5);
          const productList = products.map((p: any, idx: number) => {
            return `${idx + 1}. **${p.name}**${p.price ? ` - ${p.price}` : ''}${p.category ? ` (${p.category})` : ''}`;
          }).join('\n');
          
          fallbackMessage = `He encontrado ${functionResult.products.length} producto(s) relacionado(s) con tu búsqueda:\n\n${productList}`;
          
          if (functionResult.products.length > 5) {
            fallbackMessage += `\n\nY ${functionResult.products.length - 5} producto(s) más disponible(s).`;
          }
          
          fallbackMessage += '\n\n¿Te gustaría más información sobre alguno de estos productos?';
        } else if (functionResult.product && functionResult.found) {
          const p = functionResult.product;
          fallbackMessage = `He encontrado el siguiente producto:\n\n**${p.name}**${p.price ? ` - ${p.price}` : ''}${p.category ? `\nCategoría: ${p.category}` : ''}${p.description ? `\n\n${p.description.substring(0, 200)}...` : ''}`;
        } else {
          // Si no hay productos, generar mensaje genérico útil
          fallbackMessage = 'He consultado la base de datos pero no encontré resultados específicos para tu búsqueda. ¿Podrías ser más específico? Por ejemplo, menciona la categoría o características que buscas.';
        }
        
        // Asegurar que el mensaje no esté vacío
        if (!fallbackMessage || fallbackMessage.trim().length === 0) {
          fallbackMessage = 'He procesado tu consulta. ¿Hay algo más específico que te gustaría saber?';
        }

        const finalTimings = buildTimings();

        res.status(200).json({
          success: true,
          message: fallbackMessage,
          function_called: functionName,
          function_result: functionResult,
          fallback: true,
          conversation_history: [
            ...conversationHistory,
            { role: 'user', content: message },
            {
              role: 'assistant',
              content: fallbackMessage,
              function_calls: [toolCall],
              sources: ['products_db'],
              response_timings: finalTimings
            }
          ],
          timings: finalTimings
        });
        return;
      }

      // Determinar fuentes de información
      const sources: string[] = [];
      const productFunctions = [
        'search_products',
        'get_product_by_sku',
        'get_similar_products',
        'get_product_recommendations',
        'compare_products',
        'search_products_by_category',
        'get_product_categories',
        'get_products_by_price_range',
        'get_product_specifications',
        'get_popular_products'
      ];
      
      if (productFunctions.includes(functionName)) {
        sources.push('products_db');
      } else if (functionName === 'search_documents' || functionName === 'clarify_search_intent') {
        sources.push('products_db'); // clarify_search_intent también puede usar productos
      } else if (functionName === 'search_web_documentation' || functionName === 'search_web_content') {
        sources.push('web');
      }

      // Asegurar que finalMessage no esté vacío antes de crear el mensaje
      const safeFinalMessage = finalMessage && finalMessage.trim().length > 0 
        ? finalMessage 
        : (functionResult.products && functionResult.products.length > 0
          ? `He encontrado ${functionResult.products.length} producto(s). ¿Te gustaría más información?`
          : 'He procesado tu consulta. ¿Hay algo más específico que te gustaría saber?');

      // Preparar mensaje del asistente con productos y fuentes
      const assistantMessage: any = {
        role: 'assistant',
        content: safeFinalMessage,
        function_calls: [toolCall],
        sources: sources.length > 0 ? sources : ['general']
      };

      // Guardar conversación en analytics
      const responseTime = Date.now() - startTime;
      const saveAnalyticsStart = Date.now();
      const conversationId = await saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        safeFinalMessage, // Usar safeFinalMessage en lugar de finalMessage
        functionName,
        functionResult.products || (functionResult.product ? [functionResult.product] : undefined),
        functionArgs.category || functionArgs.subcategory,
        model,
        responseTime,
        totalTokens // Pasar tokens totales
      );
      recordStep('Guardar analytics (Supabase)', saveAnalyticsStart);

      // Asegurar que el mensaje en la respuesta también esté presente
      // Usar nombre diferente para evitar conflicto con responseMessage de la línea 474
      const finalResponseMessage = safeFinalMessage || finalMessage || 'He procesado tu consulta.';

      const finalTimings = buildTimings();
      assistantMessage.response_timings = finalTimings;

      res.status(200).json({
        success: true,
        message: finalResponseMessage,
        function_called: functionName,
        function_result: functionResult,
        conversation_id: conversationId,
        conversation_history: [
          ...conversationHistory,
          { role: 'user', content: message },
          assistantMessage
        ],
        timings: finalTimings
      });
    } else {
      // 10. Respuesta directa (sin función)
      const response = responseMessage.content || '';

      // Si no hay función, es información general
      const assistantMessage: any = {
        role: 'assistant',
        content: response,
        sources: ['general']
      };

      // Guardar conversación en analytics
      const responseTime = Date.now() - startTime;
      const saveAnalyticsStart = Date.now();
      const conversationId = await saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        response,
        undefined, // No hay función
        undefined, // No hay productos
        undefined, // No hay categoría
        model,
        responseTime,
        firstCallTokens // Solo primera llamada cuando no hay función
      );
      recordStep('Guardar analytics (Supabase)', saveAnalyticsStart);

      const finalTimings = buildTimings();
      assistantMessage.response_timings = finalTimings;

      res.status(200).json({
        success: true,
        message: response,
        conversation_id: conversationId,
        conversation_history: [
          ...conversationHistory,
          { role: 'user', content: message },
          assistantMessage
        ],
        timings: finalTimings
      });
    }
  } catch (error) {
    console.error('Chat API error:', error);
    
    // Asegurar que siempre devolvemos JSON, incluso en caso de error
    // Verificar que la respuesta no se haya enviado ya
    if (!res.headersSent) {
      try {
        const errorMessage = error instanceof Error 
          ? error.message 
          : typeof error === 'string' 
          ? error 
          : 'Unknown error';
        
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          message: errorMessage,
          details: 'Ha ocurrido un error al procesar tu solicitud. Por favor, intenta de nuevo.'
        });
      } catch (jsonError) {
        // Si falla al escribir JSON, intentar enviar un error básico
        console.error('Failed to send JSON error response:', jsonError);
        if (!res.headersSent) {
          try {
            res.status(500).send(JSON.stringify({
              success: false,
              error: 'Internal server error',
              message: 'Failed to process request'
            }));
          } catch (sendError) {
            // Último recurso: solo loguear
            console.error('Failed to send any response:', sendError);
          }
        }
      }
    } else {
      // Si ya se envió una respuesta, solo loguear
      console.error('Response already sent, cannot send error response');
    }
  }
}

// Scraping desactivado temporalmente para evitar FUNCTION_INVOCATION_FAILED
// TODO: Reactivar cuando se implemente scraping asíncrono o con mejor manejo de errores
/*
// Función para enriquecer productos con información de la web
async function enrichProductsWithWebData(products: any[]): Promise<void> {
  // Procesar solo los primeros 3 productos para no ralentizar demasiado
  const productsToEnrich = products.slice(0, 3);
  
  // Usar Promise.allSettled para que un error no rompa todo
  const results = await Promise.allSettled(
    productsToEnrich.map(async (product: any) => {
      if (product.product_url) {
        try {
          const webData = await scrapeProductPage(product.product_url);
          if (!webData.error) {
            product.webData = webData;
          }
        } catch (error) {
          // Silenciar errores de scraping para no romper el flujo
          console.error(`Error scraping ${product.product_url}:`, error);
          // No lanzar el error, solo loguearlo
        }
      }
    })
  );
  
  // Log de resultados para debugging
  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      console.error(`Failed to enrich product ${index}:`, result.reason);
    }
  });
}
*/

// Función para normalizar texto (eliminar acentos, convertir a minúsculas)
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Eliminar acentos
    .trim();
}

// Función para detectar si el mensaje es una pregunta sobre productos
function detectProductQuery(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave que indican pregunta sobre productos
  const productKeywords = [
    'tienes', 'tiene', 'tienen', 'dispones', 'dispone', 'tengo', 'tener',
    'busca', 'buscar', 'buscas', 'búsqueda', 'busqueda',
    'producto', 'productos', 'artículo', 'artículos', 'articulo', 'articulos',
    'hay', 'existe', 'existen', 'disponible', 'disponibles',
    'muestra', 'muéstrame', 'muestrame', 'muestra me',
    'encuentra', 'encontrar', 'encuentras',
    'pajitas', 'pajita', 'cartón', 'carton', 'straw', 'straws',
    'precio', 'cuánto', 'cuanto', 'cuesta', 'cuestan'
  ];
  
  // Patrones de preguntas sobre productos
  const productPatterns = [
    /tienes\s+\w+/i,
    /busca\s+\w+/i,
    /productos?\s+de\s+\w+/i,
    /artículos?\s+de\s+\w+/i,
    /hay\s+\w+/i,
    /existe\s+\w+/i,
    /muestra\s+\w+/i,
    /muéstrame\s+\w+/i,
    /encuentra\s+\w+/i,
    /precio\s+de\s+\w+/i,
    /cuánto\s+cuesta/i,
    /cuanto\s+cuesta/i
  ];
  
  // Verificar palabras clave
  if (productKeywords.some(keyword => lowerMessage.includes(keyword))) {
    return true;
  }
  
  // Verificar patrones
  if (productPatterns.some(pattern => pattern.test(message))) {
    return true;
  }
  
  return false;
}

// Función para extraer el término de búsqueda del mensaje
const SEARCH_TERM_OVERRIDES: { pattern: RegExp; term: string }[] = [
  {
    pattern: /pistola\s+super\s+aladin.*kit.*ahumar/i,
    term: 'Aladin Station'
  },
  {
    pattern: /super\s+aladin\s+station/i,
    term: 'Aladin Station'
  },
  {
    pattern: /sif[oó]n\s+i?si\s+gourmet\s+whip.*(un\s+litro|1\s*l|1\s+litro)?/i,
    term: 'iSi Gourmet Whip 1L'
  }
];

const STRICT_MATCH_TERMS = new Set([
  'aladin station',
  'isi gourmet whip 1l'
]);

function extractSearchTermFromMessage(message: string): string {

  for (const override of SEARCH_TERM_OVERRIDES) {
    if (override.pattern.test(message)) {
      return override.term;
    }
  }
  
  // Patrones para extraer términos de búsqueda
  const patterns = [
    /tienes\s+(.+?)(?:\?|$)/i,
    /busca\s+(.+?)(?:\?|$)/i,
    /productos?\s+de\s+(.+?)(?:\?|$)/i,
    /artículos?\s+de\s+(.+?)(?:\?|$)/i,
    /hay\s+(.+?)(?:\?|$)/i,
    /existe\s+(.+?)(?:\?|$)/i,
    /muestra\s+(.+?)(?:\?|$)/i,
    /muéstrame\s+(.+?)(?:\?|$)/i,
    /muestrame\s+(.+?)(?:\?|$)/i,
    /encuentra\s+(.+?)(?:\?|$)/i,
    /precio\s+de\s+(.+?)(?:\?|$)/i
  ];
  
  // Intentar extraer con patrones
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      let term = match[1].trim();
      // Limpiar el término (quitar signos de interrogación, puntos, etc.)
      term = term.replace(/[?¿!¡.,;:]+$/, '').trim();
      if (term.length > 0) {
        return term;
      }
    }
  }
  
  // Si no se encontró con patrones, intentar extraer palabras clave
  // Eliminar palabras comunes y dejar solo las relevantes
  const words = message.split(/\s+/).filter(word => {
    const lowerWord = word.toLowerCase().replace(/[?¿!¡.,;:]/g, '');
    // Incluir todas las palabras de 3+ letras (incluyendo palabras como "WOW")
    // Solo excluir palabras de acción muy comunes
    return lowerWord.length >= 3 && 
           !['tienes', 'tiene', 'tienen', 'busca', 'buscar', 'hay', 'existe', 
             'muestra', 'muestrame', 'muéstrame', 'encuentra', 'producto', 
             'productos', 'artículo', 'artículos', 'precio', 'cuánto', 'cuanto', 'busco'].includes(lowerWord);
  });
  
  if (words.length > 0) {
    return words.join(' ');
  }
  
  // Si todo falla, devolver el mensaje completo sin signos de interrogación (limpiando palabras muy comunes)
  const cleanedMessage = message
    .replace(/[?¿!¡]/g, '')
    .replace(/\b(busco|busca|tienes|tiene|hay|existe|muestra|muestrame|muéstrame|encuentra|producto|productos|artículo|artículos|precio|cuánto|cuanto)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  
  return cleanedMessage || message.replace(/[?¿!¡]/g, '').trim();
}

// Función para detectar categorías comunes en el mensaje
const QUICK_RESPONSE_SCORE_THRESHOLD = 220;

function detectCategoryInMessage(message: string): string | null {
  const lowerMessage = message.toLowerCase();
  
  // Mapa de palabras clave de categorías comunes (palabra clave -> categoría)
  const categoryKeywords: { [key: string]: string } = {
    // Vajilla y platos
    'plato': 'Vajilla',
    'platos': 'Vajilla',
    'vajilla': 'Vajilla',
    'copa': 'Vajilla',
    'copas': 'Vajilla',
    'vaso': 'Vajilla',
    'vasos': 'Vajilla',
    'cubierto': 'Vajilla',
    'cubiertos': 'Vajilla',
    'cuchillo': 'Vajilla',
    'cuchillos': 'Vajilla',
    'tenedor': 'Vajilla',
    'tenedores': 'Vajilla',
    'cuchara': 'Vajilla',
    'cucharas': 'Vajilla',
    'servilleta': 'Vajilla',
    'servilletas': 'Vajilla',
    'tapa': 'Vajilla',
    'tapas': 'Vajilla',
    'presentación': 'Vajilla',
    'presentacion': 'Vajilla',
    'presentaciones': 'Vajilla',
    'bandeja': 'Vajilla',
    'bandejas': 'Vajilla',
    'fuente': 'Vajilla',
    'fuentes': 'Vajilla',
    'platillo': 'Vajilla',
    'platillos': 'Vajilla',
    
    // Herramientas
    'herramienta': 'Herramientas',
    'herramientas': 'Herramientas',
    'utensilio': 'Utensilios',
    'utensilios': 'Utensilios',
    'cuchillo de cocina': 'Herramientas',
    'tijeras': 'Herramientas',
    'pelador': 'Herramientas',
    'rallador': 'Herramientas',
    
    // Equipamiento
    'equipamiento': 'Equipamiento',
    'equipo': 'Equipamiento',
    'máquina': 'Equipamiento',
    'maquina': 'Equipamiento',
    'aparato': 'Equipamiento',
    'aparatos': 'Equipamiento',
    
    // Cocina
    'sartén': 'Cocina',
    'sarten': 'Cocina',
    'sartenes': 'Cocina',
    'olla': 'Cocina',
    'ollas': 'Cocina',
    'cacerola': 'Cocina',
    'cacerolas': 'Cocina',
    'plancha': 'Cocina',
    'planchas': 'Cocina',
    
    // Postres y repostería
    'postre': 'Repostería',
    'postres': 'Repostería',
    'repostería': 'Repostería',
    'reposteria': 'Repostería',
    'dulce': 'Repostería',
    'dulces': 'Repostería',
    'pastelero': 'Pastelería',
    'pastelera': 'Pastelería',
    'pastelería': 'Pastelería',
    'pasteleria': 'Pastelería',
    'repostero': 'Pastelería',
    'repostera': 'Pastelería',
    'pastel': 'Pastelería',
    'pasteles': 'Pastelería',
    'cupcake': 'Pastelería',
    'cupcakes': 'Pastelería',
    'tarta': 'Pastelería',
    'tartas': 'Pastelería',
    'bizcocho': 'Pastelería',
    'bizcochos': 'Pastelería',
    'bombón': 'Chocolate',
    'bombon': 'Chocolate',
    'bombones': 'Chocolate',
    'chocolate': 'Chocolate',
    'chocolates': 'Chocolate',
    'chocolatero': 'Chocolate',
    'chocolatera': 'Chocolate',
    'cacao': 'Chocolate',
    'ganache': 'Chocolate',
    'atemperar': 'Chocolate',
    'templar': 'Chocolate',
    'refinar': 'Maquinaria',
    'refinador': 'Maquinaria',
    'refinadora': 'Maquinaria',
    'refinadoras': 'Maquinaria',
    'molino': 'Maquinaria',
    'molinos': 'Maquinaria',
    
    // Bebidas
    'bebida': 'Bebidas',
    'bebidas': 'Bebidas',
    'coctel': 'Bebidas',
    'cóctel': 'Bebidas',
    'cocktail': 'Bebidas',
    'cerveza': 'Bebidas',
    'vino': 'Bebidas',
    
    // Textil
    'textil': 'Textil',
    'textiles': 'Textil',
    'tela': 'Textil',
    'telas': 'Textil',
    'ropa': 'Textil',
    'mantel': 'Textil',
    'manteles': 'Textil',
    'delantal': 'Textil',
    'delantales': 'Textil',
    
    // Limpieza
    'limpieza': 'Limpieza',
    'limpiar': 'Limpieza',
    'detergente': 'Limpieza',
    'detergentes': 'Limpieza',
    'desinfectante': 'Limpieza',
    
    // Almacenamiento
    'almacenamiento': 'Almacenamiento',
    'contenedor': 'Almacenamiento',
    'contenedores': 'Almacenamiento',
    'recipiente': 'Almacenamiento',
    'recipientes': 'Almacenamiento',
    'tupper': 'Almacenamiento',
    'tapper': 'Almacenamiento',
    
    // Decoración
    'decoración': 'Decoración',
    'decoracion': 'Decoración',
    'decorativo': 'Decoración',
    'decorativos': 'Decoración',
    'centro de mesa': 'Decoración',
    'centro de mesas': 'Decoración',
  };
  
  // Buscar palabras clave de categorías
  for (const [keyword, category] of Object.entries(categoryKeywords)) {
    // Buscar como palabra completa (con límites de palabra)
    const regex = new RegExp(`\\b${keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(lowerMessage)) {
      return category;
    }
  }
  
  return null;
}

async function analyzeMessageUnderstanding(
  openai: OpenAI,
  message: string,
  options: { model?: string | null; timeoutMs?: number } = {}
): Promise<SemanticUnderstanding | null> {
  const model = options.model || SEMANTIC_UNDERSTANDING_DEFAULT_MODEL;
  if (!model) {
    return null;
  }

  const timeoutMs = options.timeoutMs ?? 5000;

  const systemPrompt =
    'Eres un asistente que clasifica mensajes de clientes para un chatbot de productos gastronómicos. ' +
    'Debes analizar TODO el mensaje tal como está escrito. ' +
    'Responde SIEMPRE con un JSON válido usando este esquema: ' +
    '{"product_focus": boolean, "intent": "buy"|"compare"|"info"|"search"|"support"|"other", "confidence": number between 0 and 1, ' +
    '"categories": string[] (máximo 3 elementos, puede ser []), "search_terms": string[] (máximo 3 términos clave relevantes ordenados por importancia), ' +
    '"summary": string corta explicando de qué trata el mensaje}. ' +
    'El campo "product_focus" debe ser true solo si el usuario está claramente interesado en productos específicos o categorías del catálogo. ' +
    'Si no estás seguro, deja "product_focus": false y un confidence bajo. ' +
    'Los valores deben ir sin comentarios adicionales.';

  try {
    const completionPromise = openai.chat.completions.create({
      model,
      temperature: 0,
      max_tokens: 300,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ]
    });

    const completion = (await Promise.race([
      completionPromise,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Semantic understanding timeout')), timeoutMs)
      )
    ])) as Awaited<typeof completionPromise>;

    const rawContent = completion.choices?.[0]?.message?.content?.trim();
    if (!rawContent) {
      return null;
    }

    const sanitizedContent = rawContent.replace(/```json|```/gi, '').trim();
    let parsed: any;
    try {
      parsed = JSON.parse(sanitizedContent);
    } catch (parseError) {
      console.warn('Failed to parse semantic understanding JSON:', sanitizedContent);
      return null;
    }

    const result: SemanticUnderstanding = {};

    if (typeof parsed.product_focus === 'boolean') {
      result.product_focus = parsed.product_focus;
    } else if (typeof parsed.productFocus === 'boolean') {
      result.product_focus = parsed.productFocus;
    }

    const intentCandidate = parsed.intent || parsed.primary_intent || parsed.intent_label;
    if (typeof intentCandidate === 'string') {
      result.intent = intentCandidate.trim().toLowerCase();
    }

    if (typeof parsed.confidence === 'number') {
      result.confidence = Math.max(0, Math.min(1, parsed.confidence));
    } else if (typeof parsed.intent_confidence === 'number') {
      result.confidence = Math.max(0, Math.min(1, parsed.intent_confidence));
    }

    if (Array.isArray(parsed.categories)) {
      result.categories = parsed.categories
        .filter((cat: unknown) => typeof cat === 'string')
        .map((cat: string) => cat.trim())
        .filter((cat: string) => cat.length > 0)
        .slice(0, 3);
    }

    if (Array.isArray(parsed.search_terms || parsed.searchTerms)) {
      const rawTerms = parsed.search_terms || parsed.searchTerms;
      result.search_terms = rawTerms
        .filter((term: unknown) => typeof term === 'string')
        .map((term: string) => term.trim())
        .filter((term: string) => term.length > 0)
        .slice(0, 3);
    }

    if (typeof parsed.summary === 'string') {
      result.summary = parsed.summary.trim();
    }

    return result;
  } catch (error) {
    console.warn('Semantic understanding request failed:', error);
    return null;
  }
}

function normalizeSemanticIntent(intent?: string | null): IntentResult['intent'] | undefined {
  if (!intent || typeof intent !== 'string') {
    return undefined;
  }

  const normalized = intent.trim().toLowerCase();

  if (['buy', 'purchase', 'comprar', 'venta', 'purchase_intent'].includes(normalized)) {
    return 'buy';
  }
  if (['compare', 'comparison', 'comparar', 'comparacion', 'comparación'].includes(normalized)) {
    return 'compare';
  }
  if (['info', 'informacion', 'información', 'information', 'learn', 'details'].includes(normalized)) {
    return 'info';
  }
  if (['search', 'buscar', 'explore', 'browse', 'general'].includes(normalized)) {
    return 'search';
  }

  return undefined;
}

function deriveUrgencyFromIntent(intent: IntentResult['intent']): IntentResult['urgency'] {
  switch (intent) {
    case 'buy':
      return 'high';
    case 'info':
      return 'low';
    default:
      return 'medium';
  }
}

function mergeIntentSignals(
  heuristicIntent: IntentResult,
  semanticIntent: IntentResult['intent'] | undefined,
  semanticConfidence?: number | null
): IntentResult {
  if (!semanticIntent) {
    return { ...heuristicIntent, source: heuristicIntent.source ?? 'heuristic' };
  }

  const confidence = typeof semanticConfidence === 'number'
    ? Math.max(0, Math.min(1, semanticConfidence))
    : undefined;

  if (!confidence || confidence < 0.45) {
    return { ...heuristicIntent, source: heuristicIntent.source ?? 'heuristic' };
  }

  const baseUrgency = deriveUrgencyFromIntent(semanticIntent);

  if (semanticIntent === heuristicIntent.intent) {
    return {
      ...heuristicIntent,
      source: confidence >= 0.7 ? 'semantic' : (heuristicIntent.source ?? 'heuristic'),
      confidence: confidence
    };
  }

  if (confidence >= 0.75) {
    return {
      intent: semanticIntent,
      urgency: baseUrgency,
      source: 'semantic',
      confidence
    };
  }

  if (heuristicIntent.intent === 'search' && semanticIntent !== 'search' && confidence >= 0.55) {
    return {
      intent: semanticIntent,
      urgency: baseUrgency,
      source: 'merged',
      confidence
    };
  }

  return { ...heuristicIntent, source: heuristicIntent.source ? heuristicIntent.source : 'heuristic', confidence };
}

function selectSemanticCategory(semanticUnderstanding: SemanticUnderstanding | null): string | null {
  if (!semanticUnderstanding || !semanticUnderstanding.categories || semanticUnderstanding.categories.length === 0) {
    return null;
  }

  const category = semanticUnderstanding.categories.find(cat => typeof cat === 'string' && cat.trim().length > 0);
  if (!category) {
    return null;
  }

  return formatCategoryName(category);
}

function formatCategoryName(category: string): string {
  const trimmed = category.trim();
  if (!trimmed) {
    return trimmed;
  }

  return trimmed
    .split(/\s+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function selectSearchTermCandidate(
  primaryCandidate?: string | null,
  semanticTerms: string[] = [],
  additionalCandidates: Array<string | null | undefined> = []
): string | undefined {
  const candidateSet = new Set<string>();

  const pushCandidate = (term?: string | null) => {
    const cleaned = cleanSearchTermCandidate(term);
    if (cleaned) {
      candidateSet.add(cleaned);
    }
  };

  pushCandidate(primaryCandidate);
  semanticTerms.forEach(term => pushCandidate(term));
  additionalCandidates.forEach(item => pushCandidate(item ?? undefined));

  if (candidateSet.size === 0) {
    return undefined;
  }

  const sortedCandidates = Array.from(candidateSet)
    .map(term => ({ term, score: scoreSearchTerm(term) }))
    .sort((a, b) => b.score - a.score);

  return sortedCandidates[0]?.term;
}

function cleanSearchTermCandidate(term?: string | null): string | undefined {
  if (!term || typeof term !== 'string') {
    return undefined;
  }

  const sanitized = term
    .replace(/[\n\r]+/g, ' ')
    .replace(/[\[\](){}"“"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  if (!sanitized) {
    return undefined;
  }

  const wordCount = sanitized.split(/\s+/).length;
  if (wordCount > 12) {
    return sanitized.split(/\s+/).slice(0, 12).join(' ');
  }

  if (sanitized.length > 120) {
    return sanitized.slice(0, 120).trim();
  }

  if (sanitized.length < 3 && !/\d/.test(sanitized)) {
    return undefined;
  }

  return sanitized;
}

function scoreSearchTerm(term: string): number {
  const wordCount = term.split(/\s+/).length;
  const lengthScore = Math.min(term.length, 120);
  const uniqueChars = new Set(term.replace(/\s+/g, '').toLowerCase()).size;

  let score = wordCount * 10 + lengthScore + uniqueChars;

  if (/\d/.test(term)) {
    score += 15;
  }
  if (term.includes('-')) {
    score += 5;
  }
  if (wordCount > 1) {
    score += 5;
  }

  return score;
}

function buildCategorySearchQuery(searchTerm: string, category: string): string | undefined {
  if (!searchTerm || searchTerm.trim().length === 0) {
    return undefined;
  }

  const categoryWords = normalizeText(category).split(/\s+/).filter(Boolean);
  const categorySet = new Set(categoryWords);

  const words = searchTerm.split(/\s+/).map(w => w.trim()).filter(Boolean);
  const cleanedWords: string[] = [];

  words.forEach(word => {
    const normalized = normalizeText(word);
    if (!normalized) return;
    if (SEARCH_STOP_WORDS.has(normalized)) return;
    if (CATEGORY_STOP_WORDS.has(normalized)) return;
    if (categorySet.has(normalized)) return;
    if (['de', 'la', 'el', 'los', 'las', 'un', 'una', 'del', 'con', 'por', 'para', 'y'].includes(normalized)) return;

    cleanedWords.push(normalized);

    if (normalized === 'refinar') {
      cleanedWords.push('refinadora', 'refinador');
    }
    if (normalized === 'maquina' || normalized === 'máquina') {
      cleanedWords.push('maquinaria');
    }
  });

  const unique = [...new Set(cleanedWords)].filter(Boolean);
  if (unique.length === 0) {
    return undefined;
  }

  return unique.join(' ');
}

function getRelevantHistory(message: string, history: ChatMessage[]): ChatMessage[] {
  if (!history || history.length === 0) {
    return [];
  }

  const trimmedMessage = message.toLowerCase().trim();
  const followUpKeywords = [
    'más barato',
    'mas barato',
    'más caro',
    'mas caro',
    'ese',
    'esa',
    'anterior',
    'otra opción',
    'otra opcion',
    'alternativa',
    'compar',
    'sirve',
    'funciona',
    'lo mismo',
    'qué tal',
    'que tal',
    'otro',
    'diferente'
  ];

  const isShortFollowUp = trimmedMessage.length <= 60 && followUpKeywords.some(keyword => trimmedMessage.includes(keyword));

  if (!isShortFollowUp) {
    return [];
  }

  return history.slice(-2);
}

function promptReducer(text: string): string {
  if (!text) {
    return text;
  }

  const seen = new Set<string>();
  const filteredLines = text
    .split('\n')
    .map(line => line.replace(/\s+/g, ' ').trimEnd())
    .filter((line, index, arr) => {
      const normalized = line.trim().toLowerCase();
      if (!normalized) {
        // Permitir líneas en blanco simples pero evitar múltiples consecutivas
        const prev = arr[index - 1];
        return prev && prev.trim().length > 0;
      }
      if (seen.has(normalized)) {
        return false;
      }
      seen.add(normalized);
      return true;
    });

  return filteredLines.join('\n').replace(/\n{3,}/g, '\n\n');
}

function buildQuickResponse(product: any, searchTerm: string | undefined, userIntent?: { intent: string }): string {
  return 'Quick responses deshabilitadas en V2 simplificado.';
}

function shouldUseQuickResponse(functionName: string, functionResult: any, userIntent: { intent: string }): boolean {
  return false;
}

function shouldUseStructuredResponse(functionName: string, functionResult: any, userIntent: { intent: string }): boolean {
  return false;
}

function buildStructuredResponse(
  products: any[],
  searchTerm: string | undefined,
  userIntent: { intent: string },
  category?: string,
  total?: number
): string {
  return 'Structured responses deshabilitadas en V2 simplificado.';
}

// Función para detectar intención del usuario
function detectUserIntent(message: string): IntentResult {
  const lowerMessage = message.toLowerCase();
  
  // Palabras clave de compra
  const buyKeywords = [
    'comprar', 'precio', 'cuánto cuesta', 'cuanto cuesta', 'disponible', 'stock',
    'vender', 'venta', 'comprar ahora', 'añadir al carrito', 'carrito',
    'pago', 'comprar', 'adquirir', 'coste', 'costo'
  ];
  
  // Palabras clave de comparación
  const compareKeywords = [
    'comparar', 'diferencia', 'cuál es mejor', 'cual es mejor', 'vs', 'versus',
    'mejor', 'diferencias', 'comparación', 'comparativa', 'elegir entre',
    'cuál elegir', 'cual elegir', 'recomendación entre'
  ];
  
  // Palabras clave de información
  const infoKeywords = [
    'qué es', 'que es', 'para qué sirve', 'para que sirve', 'cómo funciona', 'como funciona',
    'características', 'caracteristicas', 'especificaciones', 'detalles', 'información',
    'info', 'descripción', 'descripcion', 'qué hace', 'que hace'
  ];
  
  // Detectar intención
  if (buyKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'buy', urgency: 'high', source: 'heuristic' };
  }
  if (compareKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'compare', urgency: 'medium', source: 'heuristic' };
  }
  if (infoKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'info', urgency: 'low', source: 'heuristic' };
  }
  
  return { intent: 'search', urgency: 'medium', source: 'heuristic' };
}

// Función para generar sugerencias de búsqueda cuando no hay resultados
async function generateSearchSuggestions(supabase: any, originalQuery: string): Promise<string[]> {
  try {
    const suggestions: string[] = [];
    const words = originalQuery.split(/\s+/).filter(w => w.length > 2);
    
    // Generar variaciones de palabras
    words.forEach(word => {
      const variations = generateWordVariations(word);
      variations.forEach(variation => {
        if (variation !== word && variation.length > 2) {
          const newQuery = originalQuery.replace(word, variation);
          if (newQuery !== originalQuery && !suggestions.includes(newQuery)) {
            suggestions.push(newQuery);
          }
        }
      });
    });
    
    // Buscar categorías similares
    const { data: categories } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null)
      .limit(50);
    
    if (categories && categories.length > 0) {
      const uniqueCategories = [...new Set(categories.map((c: any) => c.category))];
      const normalizedQuery = normalizeText(originalQuery);
      
      // Buscar categorías que contengan palabras de la búsqueda
      uniqueCategories.forEach((cat: string) => {
        const normalizedCat = normalizeText(cat);
        if (normalizedCat.includes(normalizedQuery) || normalizedQuery.includes(normalizedCat.split(' ')[0])) {
          if (!suggestions.includes(cat)) {
            suggestions.push(cat);
          }
        }
      });
    }
    
    // Si no hay suficientes sugerencias, crear búsquedas más amplias
    if (suggestions.length < 3 && words.length > 1) {
      words.forEach((_, index) => {
        const shorterQuery = words.filter((_, i) => i !== index).join(' ');
        if (shorterQuery.length > 0 && !suggestions.includes(shorterQuery)) {
          suggestions.push(shorterQuery);
        }
      });
    }
    
    return suggestions.slice(0, 5);
  } catch (error) {
    console.error('Error generating search suggestions:', error);
    return [];
  }
}

// Tabla de sinónimos técnicos y equivalencias
const TECHNICAL_SYNONYMS: { [key: string]: string[] } = {
  'cierre': ['cierra', 'cerrar', 'sellador', 'sella', 'sellado'],
  'cierra': ['cierre', 'cerrar', 'sellador', 'sella', 'sellado'],
  'cerrar': ['cierre', 'cierra', 'sellador', 'sella', 'sellado'],
  'sellador': ['cierre', 'cierra', 'cerrar', 'sella', 'sellado'],
  'sella': ['cierre', 'cierra', 'cerrar', 'sellador', 'sellado'],
  'sellado': ['cierre', 'cierra', 'cerrar', 'sellador', 'sella'],
  'abre': ['abrir', 'abridor', 'abre'],
  'abrir': ['abre', 'abridor', 'abrir'],
  'abridor': ['abre', 'abrir', 'abridor'],
  'cortador': ['corta', 'cortar', 'cortador'],
  'corta': ['cortador', 'cortar', 'corta'],
  'cortar': ['cortador', 'corta', 'cortar'],
  'pelador': ['pela', 'pelar', 'pelador'],
  'pela': ['pelador', 'pelar', 'pela'],
  'pelar': ['pelador', 'pela', 'pelar'],
  'rallador': ['ralla', 'rallar', 'rallador'],
  'ralla': ['rallador', 'rallar', 'ralla'],
  'rallar': ['rallador', 'ralla', 'rallar'],
  'pajita': ['pajitas', 'straw', 'straws', 'caña', 'cañas'],
  'pajitas': ['pajita', 'straw', 'straws', 'caña', 'cañas'],
  'cartón': ['carton', 'cardboard', 'papel', 'papel cartón'],
  'carton': ['cartón', 'cardboard', 'papel', 'papel cartón'],
  'plato': ['platos', 'plate', 'plates', 'fuente', 'fuentes'],
  'platos': ['plato', 'plate', 'plates', 'fuente', 'fuentes'],
  'vaso': ['vasos', 'cup', 'cups', 'taza', 'tazas'],
  'vasos': ['vaso', 'cup', 'cups', 'taza', 'tazas'],
};

// Función para verificar sinónimos técnicos
function checkTechnicalSynonyms(word: string, productText: string): boolean {
  const normalizedWord = normalizeText(word);
  const normalizedProductText = normalizeText(productText);
  
  // Verificar si la palabra es un sinónimo conocido
  if (TECHNICAL_SYNONYMS[normalizedWord]) {
    const synonyms = TECHNICAL_SYNONYMS[normalizedWord];
    return synonyms.some(synonym => normalizedProductText.includes(synonym));
  }
  
  // Verificar si alguna palabra en el texto del producto es sinónimo de la palabra buscada
  for (const [key, synonyms] of Object.entries(TECHNICAL_SYNONYMS)) {
    if (synonyms.includes(normalizedWord) && normalizedProductText.includes(key)) {
      return true;
    }
  }
  
  return false;
}

// Función para calcular densidad de coincidencia (porcentaje de palabras que coinciden)
function calculateMatchDensity(searchWords: string[], productText: string): number {
  if (searchWords.length === 0) return 0;
  
  let matchingWords = 0;
  searchWords.forEach(word => {
    if (productText.includes(word) || checkTechnicalSynonyms(word, productText)) {
      matchingWords++;
    }
  });
  
  return matchingWords / searchWords.length;
}

// Función para calcular score de relevancia de un producto (MEJORADA - FASE 1)
function calculateRelevanceScore(
  product: any, 
  searchTerm: string, 
  userIntent?: { intent: string; urgency: string },
  searchCategory?: string
): number {
  if (!searchTerm) return 0;
  
  let score = 0;
  const normalizedSearch = normalizeText(searchTerm);
  const productName = normalizeText(product.name || '');
  const description = normalizeText(product.description || '');
  const category = normalizeText(product.category || '');
  const subcategory = normalizeText(product.subcategory || '');
  
  // Dividir término de búsqueda en palabras
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 2);
  
  // 1. Coincidencia exacta en nombre (máximo peso)
  if (productName === normalizedSearch) {
    score += 200;
  } else if (productName.includes(normalizedSearch)) {
    score += 100;
    // Bonus por posición en nombre (más relevante si está al inicio)
    const index = productName.indexOf(normalizedSearch);
    if (index !== -1) {
      if (index < 5) {
        score += 50; // Al inicio
      } else if (index < 15) {
        score += 25; // En la primera mitad
      }
    }
  }
  
  // 2. Coincidencia de palabras individuales con bonus por posición
  searchWords.forEach(word => {
    // En nombre
    if (productName.includes(word)) {
      score += 30;
      const index = productName.indexOf(word);
      if (index !== -1 && index < 10) {
        score += 15; // Bonus por posición temprana
      }
    }
    // En descripción
    if (description.includes(word)) {
      score += 10;
    }
    // En categoría (más peso)
    if (category.includes(word)) {
      score += 20;
    }
    // En subcategoría
    if (subcategory.includes(word)) {
      score += 15;
    }
  });
  
  // 3. Bonus por sinónimos técnicos
  searchWords.forEach(word => {
    if (checkTechnicalSynonyms(word, productName)) {
      score += 25; // Bonus por sinónimo en nombre
    }
    if (checkTechnicalSynonyms(word, description)) {
      score += 8; // Bonus por sinónimo en descripción
    }
    if (checkTechnicalSynonyms(word, category)) {
      score += 15; // Bonus por sinónimo en categoría
    }
  });
  
  // 4. Bonus por intención + categoría
  if (userIntent && searchCategory) {
    const normalizedSearchCategory = normalizeText(searchCategory);
    if (category.includes(normalizedSearchCategory) || normalizedSearchCategory.includes(category)) {
      if (userIntent.intent === 'buy') {
        score += 30; // Bonus alto para intención de compra con categoría coincidente
      } else if (userIntent.intent === 'compare') {
        score += 20; // Bonus medio para comparación
      } else {
        score += 15; // Bonus base para otras intenciones
      }
    }
  }
  
  // 5. Coincidencia en SKU (si contiene)
  if (product.sku && normalizeText(product.sku).includes(normalizedSearch)) {
    score += 40;
  }
  
  // 6. Penalización por baja densidad de coincidencia
  const allProductText = `${productName} ${description} ${category} ${subcategory}`;
  const matchDensity = calculateMatchDensity(searchWords, allProductText);
  
  if (matchDensity < 0.3) {
    // Si menos del 30% de las palabras coinciden, penalizar
    score = Math.floor(score * 0.5); // Reducir score a la mitad
  } else if (matchDensity < 0.5) {
    // Si menos del 50% pero más del 30%, penalizar ligeramente
    score = Math.floor(score * 0.75); // Reducir score al 75%
  } else if (matchDensity >= 0.8) {
    // Si más del 80% de las palabras coinciden, bonus
    score = Math.floor(score * 1.1); // Aumentar score un 10%
  }
  
  return Math.max(0, score); // Asegurar que el score no sea negativo
}

// Función para formatear productos para el prompt de OpenAI (MEJORADA - FASE 1)
function formatProductsForPrompt(products: any[], limit: number = 5): string {
  if (!products || products.length === 0) {
    return 'No se encontraron productos.';
  }
  
  const detailedLimit = Math.min(limit, 3);
  const detailedProducts = products.slice(0, detailedLimit);
  const summarizedProducts = products.slice(detailedLimit, Math.min(products.length, detailedLimit + 2));
  const remainingCount = Math.max(products.length - detailedProducts.length - summarizedProducts.length, 0);

  const lines: string[] = [];

  if (detailedProducts.length > 0) {
    const primary = detailedProducts[0];
    const description = (primary.description || '').trim();
    const descriptionPreview = description.length > 120
      ? `${description.substring(0, 120)}...`
      : (description || 'Sin descripción disponible');

    lines.push('🏆 **RECOMENDADO**', '');
    lines.push(`**${primary.name}**`);
    lines.push(`💰 Precio: ${primary.price || 'No disponible'}`);
    if (primary.category) {
      lines.push(`📦 Categoría: ${primary.category}`);
    }
    if (primary.sku) {
      lines.push(`🏷️ SKU: ${primary.sku}`);
    }
    lines.push(`📝 ${descriptionPreview}`);
    if (primary.product_url) {
      lines.push(`🔗 URL: ${primary.product_url}`);
    }
    lines.push('');
  }

  if (detailedProducts.length > 1) {
    lines.push('🔁 **ALTERNATIVAS**', '');
    detailedProducts.slice(1).forEach((product: any, index: number) => {
      const description = (product.description || '').trim();
      const preview = description.length > 90
        ? `${description.substring(0, 90)}...`
        : (description || 'Sin descripción disponible');

      lines.push(`${index + 1}. **${product.name}**`);
      lines.push(`   💰 Precio: ${product.price || 'No disponible'}`);
      if (product.category) {
        lines.push(`   📦 Categoría: ${product.category}`);
      }
      lines.push(`   📝 ${preview}`);
      if (product.product_url) {
        lines.push(`   🔗 URL: ${product.product_url}`);
      }
      lines.push('');
    });
  }

  if (summarizedProducts.length > 0) {
    lines.push('💡 **OTRAS OPCIONES (resumen)**');
    summarizedProducts.forEach((product: any) => {
      const priceInfo = product.price ? ` (${product.price})` : '';
      lines.push(`• ${product.name}${priceInfo}`);
    });
    lines.push('');
  }

  if (remainingCount > 0) {
    lines.push(`(Existen ${remainingCount} productos adicionales disponibles.)`);
  }

  return lines
    .filter((line, index, arr) => !(line === '' && arr[index + 1] === ''))
    .join('\n')
    .trim();
}

// Función para generar variaciones de palabras comunes
function generateWordVariations(word: string): string[] {
  const variations = [word];
  const normalized = normalizeText(word);
  
  // Variaciones comunes en español
  const commonVariations: { [key: string]: string[] } = {
    'ahumador': ['ahumadores', 'ahumar', 'smoker', 'smoking', 'pistola', 'aladin', 'super aladin'],
    'ahumadores': ['ahumador', 'ahumar', 'smoker', 'smoking', 'pistola', 'aladin', 'super aladin'],
    'ahumar': ['ahumador', 'ahumadores', 'smoker', 'smoking', 'pistola', 'aladin', 'super aladin'],
    'smoker': ['ahumador', 'ahumadores', 'ahumar', 'smoking', 'pistola', 'aladin', 'super aladin'],
    'smoking': ['ahumador', 'ahumadores', 'ahumar', 'smoker', 'pistola', 'aladin', 'super aladin'],
    'pistola': ['ahumador', 'ahumadores', 'ahumar', 'smoker', 'smoking', 'aladin', 'super aladin'],
    'aladin': ['super aladin', 'ahumador', 'ahumadores', 'pistola', 'smoker', 'smoking'],
    'super aladin': ['aladin', 'ahumador', 'pistola', 'smoker', 'smoking'],
    'portatil': ['portátil', 'portable', 'portatiles', 'portátiles'],
    'portátiles': ['portatil', 'portable'],
    'portátil': ['portatil', 'portable', 'portátiles'],
    'portable': ['portatil', 'portátil'],
    'cierre': ['cierra', 'cerrar', 'cierre'],
    'cierra': ['cierre', 'cerrar', 'cierra'],
    'cerrar': ['cierre', 'cierra', 'cerrar'],
    'abre': ['abrir', 'abridor', 'abre'],
    'abrir': ['abre', 'abridor', 'abrir'],
    'abridor': ['abre', 'abrir', 'abridor'],
    'sellador': ['sella', 'sellado', 'sellador'],
    'sella': ['sellador', 'sellado', 'sella'],
    'sellado': ['sellador', 'sella', 'sellado'],
    'cortador': ['corta', 'cortar', 'cortador'],
    'corta': ['cortador', 'cortar', 'corta'],
    'cortar': ['cortador', 'corta', 'cortar'],
    'pelador': ['pela', 'pelar', 'pelador'],
    'pela': ['pelador', 'pelar', 'pela'],
    'pelar': ['pelador', 'pela', 'pelar'],
    'rallador': ['ralla', 'rallar', 'rallador'],
    'ralla': ['rallador', 'rallar', 'ralla'],
    'rallar': ['rallador', 'ralla', 'rallar'],
  };
  
  // Buscar variaciones conocidas
  if (commonVariations[normalized]) {
    variations.push(...commonVariations[normalized]);
  } else {
    // Detección automática de variaciones para verbos comunes
    // Si la palabra termina en "dor" o "ador", buscar variaciones del verbo
    if (normalized.endsWith('dor') || normalized.endsWith('ador')) {
      const verbBase = normalized.replace(/dor$|ador$/, '');
      if (verbBase.length > 2) {
        // Intentar formas comunes del verbo
        variations.push(verbBase + 'ar', verbBase + 'a', verbBase + 'ado');
      }
    }
    // Si la palabra termina en "ar", buscar sustantivos relacionados
    else if (normalized.endsWith('ar') && normalized.length > 4) {
      const base = normalized.slice(0, -2);
      variations.push(base + 'ador', base + 'adora', base + 'ado', base + 'acion');
    }
    // Si la palabra termina en "a" y es corta, podría ser forma del verbo
    else if (normalized.endsWith('a') && normalized.length <= 6) {
      const base = normalized.slice(0, -1);
      variations.push(base + 'ar', base + 'dor', base + 'ado');
    }
  }
  
  // Eliminar duplicados y mantener solo variaciones únicas
  return [...new Set(variations)];
}

const SEARCH_STOP_WORDS = new Set([
  'soy', 'estoy', 'somos', 'eres', 'busco', 'buscar', 'buscas', 'necesito', 'necesitamos',
  'necesitas', 'quiero', 'quieres', 'quisiera', 'hola', 'buenas', 'gracias', 'ayuda',
  'ayudame', 'ayúdame', 'ayudar', 'podria', 'podría', 'podrias', 'podrías', 'puedo',
  'puedes', 'dime', 'dame', 'indica', 'indícame', 'enseñame', 'enséñame', 'saludos'
]);

const CATEGORY_STOP_WORDS = new Set([
  'pastelero', 'pastelera', 'pastelería', 'pasteleria', 'repostero', 'repostera',
  'repostería', 'reposteria'
]);

// Función para buscar productos (optimizada con búsqueda flexible)
async function searchProducts(supabase: any, params: any) {
  // Seleccionar solo campos necesarios (incluyendo imagen)
  let query = supabase
    .from('products')
    .select('id, name, price, category, subcategory, sku, description, image_url, product_url, date_add', { count: 'exact' });

  // Búsqueda por texto (mejorada con búsqueda flexible por palabras)
  if (params.query && typeof params.query === 'string') {
    const searchTerm = params.query.trim();
    if (searchTerm.length > 0) {
      // Dividir en palabras individuales
      const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      // Construir condiciones de búsqueda para cada palabra
      const conditions: string[] = [];
      
      words.forEach(word => {
        const normalizedWord = word.toLowerCase().trim();
        
        // Filtrar palabras muy cortas que no son relevantes para la búsqueda
        // PERO incluir palabras de 3 letras que pueden ser importantes (ej: "WOW")
        if (normalizedWord.length <= 2 && !['de', 'la', 'el'].includes(normalizedWord)) {
          return; // Saltar artículos y preposiciones muy cortas
        }
        
        if (SEARCH_STOP_WORDS.has(normalizedWord)) {
          return;
        }

        // No filtrar palabras de 3+ letras, incluso si son comunes, ya que pueden ser parte de nombres de productos
        // (ej: "WOW", "PRO", "MAX", etc.)
        
        // Generar variaciones de la palabra
        const variations = generateWordVariations(word);
        const uniqueVariations = [...new Set(variations)];
        
        // Para cada variación, buscar en cada campo
        uniqueVariations.forEach(variation => {
          // Buscar en nombre (con variaciones)
          conditions.push(`name.ilike.%${variation}%`);
          // Buscar en descripción
          conditions.push(`description.ilike.%${variation}%`);
          // Buscar en SKU
          conditions.push(`sku.ilike.%${variation}%`);
        });
      });
      
      // También buscar la frase completa sin variaciones (para coincidencias exactas)
      if (searchTerm.length > 3) {
        conditions.push(`name.ilike.%${searchTerm}%`);
        conditions.push(`description.ilike.%${searchTerm}%`);
        conditions.push(`sku.ilike.%${searchTerm}%`);
      }
        
      if (conditions.length > 0) {
        // Usar OR para buscar cualquiera de las condiciones
        // El filtrado en memoria se encargará de refinar los resultados
          query = query.or(conditions.join(','));
      }
    }
  }

  // Filtrar por categoría (usa índice)
  if (params.category && typeof params.category === 'string') {
    query = query.ilike('category', `%${params.category}%`);
  }

  // Filtrar por subcategoría (usa índice)
  if (params.subcategory && typeof params.subcategory === 'string') {
    query = query.ilike('subcategory', `%${params.subcategory}%`);
  }

  // Ordenar (usa índices cuando es posible)
  if (params.sort_by === 'date_add') {
    query = query.order('date_add', { ascending: false });
  } else if (params.sort_by === 'created_at') {
    query = query.order('created_at', { ascending: false });
  } else if (params.sort_by === 'name') {
    query = query.order('name', { ascending: true });
  }

  // Límite optimizado para velocidad (OPTIMIZADO)
  const baseLimit = params.limit || 15;
  const maxLimit = 30; // Reducido de 50 a 30 para mayor velocidad
  const searchTerm = params.query && typeof params.query === 'string' ? params.query.trim() : '';
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
  const hasMultipleWords = words.length > 1;
  const limit = Math.min(hasMultipleWords ? baseLimit * 2 : baseLimit, maxLimit); // Reducido de *3 a *2 para mayor velocidad
  query = query.limit(limit);

  // Offset
  if (params.offset) {
    query = query.range(params.offset, params.offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Filtrar resultados en memoria si hay múltiples palabras de búsqueda
  const originalData = data || [];
  let sortedData = originalData.slice();
  if (params.query && typeof params.query === 'string') {
    const searchTerm = params.query.trim();
    if (searchTerm.length > 0) {
      const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      // Si hay múltiples palabras, filtrar de forma más flexible
      if (words.length > 1) {
        // Filtrar palabras muy cortas (artículos, preposiciones) que no son relevantes
        // PERO mantener palabras de 3+ letras incluso si son comunes, ya que pueden ser parte de nombres de productos
        const relevantWords = words.filter(w => {
          const normalized = w.toLowerCase().trim();
          if (SEARCH_STOP_WORDS.has(normalized)) {
            return false;
          }
          if (CATEGORY_STOP_WORDS.has(normalized)) {
            return false;
          }
          // Incluir todas las palabras de 3+ letras
          if (normalized.length >= 3) {
            // Solo excluir preposiciones muy comunes
            return !['una', 'del', 'con', 'por', 'para'].includes(normalized);
          }
          return false;
        });
        
        // Si después de filtrar solo queda una palabra relevante, no aplicar filtro estricto
        if (relevantWords.length <= 1) {
          // No filtrar estrictamente, dejar que el scoring de relevancia ordene
        } else {
          // Filtrar para asegurar que al menos las palabras relevantes aparezcan
          // Usar un enfoque más flexible: al menos el 70% de las palabras relevantes deben aparecer
          const optionalWords = new Set(['hacer', 'elaborar', 'preparar', 'crear', 'busco', 'buscar', 'necesito', 'soy', 'estoy', 'quiero', 'quisiera']);
          const requiredWords = relevantWords.filter(word => {
            const normalizedWord = normalizeText(word);
            return !optionalWords.has(normalizedWord);
          });

          const minWordsRequired = requiredWords.length > 0
            ? Math.max(1, Math.min(requiredWords.length, Math.ceil(requiredWords.length * 0.5)))
            : Math.max(1, Math.ceil(relevantWords.length * 0.5));
          
        sortedData = sortedData.filter((product: any) => {
          // Combinar todos los campos de texto donde buscar
          const searchableText = [
            product.name || '',
            product.description || '',
            product.sku || '',
            product.category || '',
            product.subcategory || ''
          ].join(' ').toLowerCase();
          
          // Normalizar el texto de búsqueda
          const normalizedSearchText = normalizeText(searchableText);
          
            // Contar cuántas palabras relevantes aparecen
            let matchingRequiredWords = 0;
            let matchingOptionalWords = 0;
            relevantWords.forEach(word => {
              const normalizedWord = normalizeText(word);
            const variations = generateWordVariations(word);
            const normalizedVariations = variations.map(v => normalizeText(v));
              const hasMatch = normalizedVariations.some(variation => 
              normalizedSearchText.includes(variation)
            );
              if (!hasMatch) {
                return;
              }

              if (optionalWords.has(normalizedWord)) {
                matchingOptionalWords++;
              } else {
                matchingRequiredWords++;
              }
            });
            
            // También verificar la frase completa (para casos como "pajitas de cartón")
            const normalizedSearchTerm = normalizeText(searchTerm);
            if (normalizedSearchText.includes(normalizedSearchTerm)) {
              return true; // Si la frase completa aparece, incluir el producto
            }
            
            // Incluir si al menos el mínimo requerido de palabras aparece
            if (requiredWords.length > 0) {
              return matchingRequiredWords >= minWordsRequired;
            }
            // Si todas eran opcionales, bastará con tener coincidencias
            return matchingOptionalWords > 0;
          });
        }
      }
    }
  }

  // Si el filtrado en memoria eliminó todos los resultados pero la búsqueda original devolvió datos,
  // utilizar los datos originales para no perder posibles coincidencias parciales.
  if (sortedData.length === 0 && originalData.length > 0) {
    console.warn('[searchProducts] No results after in-memory filtering, falling back to raw data');
    sortedData = originalData.slice();
  }

  // Calcular scores de relevancia y ordenar si hay término de búsqueda
  if (params.query && typeof params.query === 'string' && sortedData.length > 0) {
    // Obtener userIntent y searchCategory de params si están disponibles
    const userIntent = params.userIntent;
    const searchCategory = params.category || params.subcategory;
    
    sortedData = sortedData
      .map((product: any) => ({
        ...product,
        relevanceScore: calculateRelevanceScore(product, params.query, userIntent, searchCategory)
      }))
      .sort((a: any, b: any) => {
        // Primero por relevancia si hay búsqueda
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
        // Si no hay término de búsqueda o mismo score, usar orden original
        return 0;
      });
  }

  // Ordenar por precio si es necesario (hay que hacerlo localmente)
  if (params.sort_by === 'price_asc' || params.sort_by === 'price_desc') {
    sortedData = sortedData.sort((a: any, b: any) => {
      // Si hay scores de relevancia, mantenerlos como prioridad
      if (a.relevanceScore !== undefined && b.relevanceScore !== undefined) {
        if (a.relevanceScore !== b.relevanceScore) {
          return b.relevanceScore - a.relevanceScore;
        }
      }
      const priceA = parseFloat(a.price?.replace(/[^\d.,]/g, '').replace(',', '.') || '0');
      const priceB = parseFloat(b.price?.replace(/[^\d.,]/g, '').replace(',', '.') || '0');
      return params.sort_by === 'price_asc' ? priceA - priceB : priceB - priceA;
    });
  }

  // Mapear image_url a image para compatibilidad con el frontend
  const mappedProducts = sortedData.map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));

  if (searchTerm) {
    const normalizedQuery = normalizeText(searchTerm);
    if (STRICT_MATCH_TERMS.has(normalizedQuery)) {
      const strictMatches = mappedProducts.filter((product: any) => {
        const normalizedName = normalizeText(product.name || '');
        return normalizedName.includes(normalizedQuery);
      });
      if (strictMatches.length > 0) {
        return {
          products: strictMatches,
          total: strictMatches.length,
          limit: strictMatches.length,
          offset: 0
        };
      }
    }
  }

  return {
    products: mappedProducts,
    total: count || sortedData.length,
    limit,
    offset: params.offset || 0
  };
}

// Función para obtener producto por SKU (optimizada)
async function getProductBySku(supabase: any, params: any) {
  // Seleccionar solo campos necesarios
  const { data, error } = await supabase
    .from('products')
    .select('id, name, price, category, subcategory, sku, description, product_url, image_url, date_add')
    .ilike('sku', `%${params.sku}%`)
    .limit(1)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      return { product: null, found: false };
    }
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Mapear image_url a image para compatibilidad
  const mappedProduct = data ? {
    ...data,
    image: data.image_url || data.image || ''
  } : null;

  return {
    product: mappedProduct,
    found: !!data
  };
}

// Función para obtener productos similares
async function getSimilarProducts(supabase: any, params: any) {
  let referenceProduct = null;
  
  // Buscar producto de referencia
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
    return { 
      products: [], 
      reference_product: null,
      message: 'Producto de referencia no encontrado' 
    };
  }
  
  const limit = params.limit || 5;
  
  // Extraer palabras clave del nombre
  const keywords = referenceProduct.name
    .toLowerCase()
    .split(/\s+/)
    .filter((w: string) => w.length > 3);
  
  let query = supabase
    .from('products')
    .select('*')
    .neq('id', referenceProduct.id);
  
  // Filtrar por misma categoría si existe
  if (referenceProduct.category) {
    query = query.ilike('category', `%${referenceProduct.category}%`);
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
  
  const mappedProducts = (similarProducts || []).map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    reference_product: {
      ...referenceProduct,
      image: referenceProduct.image_url || referenceProduct.image || ''
    },
    products: mappedProducts,
    total: mappedProducts.length
  };
}

// Función para obtener recomendaciones de productos
async function getProductRecommendations(supabase: any, params: any) {
  const useCase = params.use_case?.toLowerCase() || '';
  const limit = params.limit || 5;
  
  let query = supabase
    .from('products')
    .select('*');
  
  // Filtrar por categoría si se proporciona
  if (params.category) {
    query = query.ilike('category', `%${params.category}%`);
  }
  
  // Filtrar por presupuesto si se proporciona
  if (params.budget_range) {
    const budget = params.budget_range.toLowerCase();
    if (budget === 'bajo' || budget === 'economico') {
      // Productos con precio menor a 50 (ajustar según necesidad)
      query = query.lt('price', '50');
    } else if (budget === 'medio') {
      query = query.gte('price', '50').lte('price', '200');
    } else if (budget === 'alto' || budget === 'premium') {
      query = query.gt('price', '200');
    }
  }
  
  // Buscar productos que coincidan con el caso de uso
  if (useCase) {
    query = query.or(`name.ilike.%${useCase}%,description.ilike.%${useCase}%,category.ilike.%${useCase}%`);
  }
  
  query = query.limit(limit);
  
  const { data, error } = await query;
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  const mappedProducts = (data || []).map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    products: mappedProducts,
    total: mappedProducts.length,
    use_case: useCase
  };
}

// Función para comparar productos
async function compareProducts(supabase: any, params: any) {
  const productNames = params.product_names || [];
  const productIds = params.product_ids || [];
  
  if (productNames.length === 0 && productIds.length === 0) {
    return { 
      products: [], 
      message: 'No se proporcionaron productos para comparar' 
    };
  }
  
  const products: any[] = [];
  
  // Buscar por IDs primero
  if (productIds.length > 0) {
    for (const id of productIds) {
      const { data } = await supabase
        .from('products')
        .select('*')
        .eq('id', id)
        .single();
      if (data) products.push(data);
    }
  }
  
  // Buscar por nombres
  if (productNames.length > 0) {
    for (const name of productNames) {
      // Evitar duplicados si ya se encontró por ID
      if (products.some(p => p.name.toLowerCase().includes(name.toLowerCase()))) {
        continue;
      }
      
      const { data } = await supabase
        .from('products')
        .select('*')
        .ilike('name', `%${name}%`)
        .limit(1)
        .single();
      if (data) products.push(data);
    }
  }
  
  const mappedProducts = products.map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    products: mappedProducts,
    total: mappedProducts.length,
    comparison_fields: ['name', 'price', 'category', 'description', 'sku']
  };
}

// Función para buscar productos por categoría
async function searchProductsByCategory(supabase: any, params: any) {
  if (!params.category) {
    return { 
      products: [], 
      message: 'Categoría requerida' 
    };
  }
  
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' })
    .ilike('category', `%${params.category}%`);
  
  // Búsqueda de texto adicional si se proporciona
  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
  }
  
  const limit = params.limit || 15;
  query = query.limit(limit);
  
  if (params.offset) {
    query = query.range(params.offset, params.offset + limit - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  const mappedProducts = (data || []).map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    products: mappedProducts,
    total: count || mappedProducts.length,
    category: params.category
  };
}

// Función para obtener categorías de productos
async function getProductCategories(supabase: any, params: any) {
  // Usar una consulta más eficiente que obtenga todas las categorías únicas
  // Ahora leemos de all_categories (JSONB) que contiene TODAS las categorías de cada producto
  const categories = new Set<string>();
  const subcategories = new Map<string, Set<string>>();
  const allCategoriesDetailed = new Map<string, {
    count: number;
    subcategories: Set<string>;
    hierarchies: Set<string>;
  }>();
  
  // Obtener datos en lotes para evitar límites de Supabase (por defecto 1000 filas)
  let offset = 0;
  const batchSize = 1000;
  let hasMore = true;
  let totalProcessed = 0;
  
  while (hasMore) {
    const { data, error } = await supabase
      .from('products')
      .select('category, subcategory, all_categories')
      .or('category.not.is.null,all_categories.not.is.null')
      .range(offset, offset + batchSize - 1)
      .order('category', { ascending: true });
    
    if (error) {
      console.error('Error fetching categories batch:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!data || data.length === 0) {
      hasMore = false;
      break;
    }
    
    // Procesar lote de productos
    data.forEach((product: any) => {
      // 1. Procesar categoría principal (compatibilidad)
      const category = product.category?.trim();
      if (category && category.length > 0) {
        categories.add(category);
        
        if (!allCategoriesDetailed.has(category)) {
          allCategoriesDetailed.set(category, {
            count: 0,
            subcategories: new Set(),
            hierarchies: new Set()
          });
        }
        allCategoriesDetailed.get(category)!.count++;
        
        if (params.include_subcategories && product.subcategory) {
          const subcategory = product.subcategory?.trim();
          if (subcategory && subcategory.length > 0) {
            if (!subcategories.has(category)) {
              subcategories.set(category, new Set());
            }
            subcategories.get(category)!.add(subcategory);
            allCategoriesDetailed.get(category)!.subcategories.add(subcategory);
          }
        }
      }
      
      // 2. Procesar all_categories (JSONB) - TODAS las categorías del producto
      if (product.all_categories && Array.isArray(product.all_categories)) {
        product.all_categories.forEach((catInfo: any) => {
          if (catInfo && catInfo.category) {
            const catName = catInfo.category?.trim();
            if (catName && catName.length > 0) {
              categories.add(catName);
              
              if (!allCategoriesDetailed.has(catName)) {
                allCategoriesDetailed.set(catName, {
                  count: 0,
                  subcategories: new Set(),
                  hierarchies: new Set()
                });
              }
              allCategoriesDetailed.get(catName)!.count++;
              
              // Agregar subcategoría si existe
              if (catInfo.subcategory) {
                const subcat = catInfo.subcategory?.trim();
                if (subcat && subcat.length > 0) {
                  if (!subcategories.has(catName)) {
                    subcategories.set(catName, new Set());
                  }
                  subcategories.get(catName)!.add(subcat);
                  allCategoriesDetailed.get(catName)!.subcategories.add(subcat);
                }
              }
              
              // Agregar jerarquía completa si existe
              if (catInfo.hierarchy && Array.isArray(catInfo.hierarchy)) {
                const hierarchyStr = catInfo.hierarchy.join(' > ');
                allCategoriesDetailed.get(catName)!.hierarchies.add(hierarchyStr);
              }
            }
          }
        });
      }
    });
    
    totalProcessed += data.length;
    
    // Si obtuvimos menos de batchSize, significa que no hay más datos
    if (data.length < batchSize) {
      hasMore = false;
    } else {
      offset += batchSize;
    }
    
    // Límite de seguridad para evitar bucles infinitos
    if (totalProcessed > 100000) {
      console.warn(`Reached safety limit of ${totalProcessed} products processed for categories`);
      break;
    }
  }
  
  console.log(`Processed ${totalProcessed} products to extract ${categories.size} unique categories`);
  console.log(`Categories found: ${Array.from(categories).join(', ')}`);
  
  const result: any = {
    categories: Array.from(categories).sort(),
    total: categories.size
  };
  
  if (params.include_subcategories) {
    const subcatsMap: any = {};
    subcategories.forEach((subs, cat) => {
      subcatsMap[cat] = Array.from(subs).sort();
    });
    result.subcategories = subcatsMap;
  }
  
  // Agregar información detallada si se solicita
  if (params.include_details) {
    const detailed: any = {};
    allCategoriesDetailed.forEach((details, catName) => {
      detailed[catName] = {
        count: details.count,
        subcategories: Array.from(details.subcategories).sort(),
        hierarchies: Array.from(details.hierarchies).sort()
      };
    });
    result.detailed = detailed;
  }
  
  return result;
}

// Función para aclarar intención de búsqueda
async function clarifySearchIntent(supabase: any, params: any) {
  const originalQuery = params.original_query || '';
  
  if (!originalQuery) {
    return {
      suggestions: [],
      message: 'No se proporcionó término de búsqueda'
    };
  }
  
  // Intentar búsqueda con el término original
  const searchResult = await searchProducts(supabase, { query: originalQuery, limit: 5 });
  
  if (searchResult.products && searchResult.products.length > 0) {
    return {
      original_query: originalQuery,
      found_results: true,
      suggestions: [originalQuery],
      alternative_queries: [],
      message: 'Búsqueda exitosa'
    };
  }
  
  // Si no hay resultados, generar sugerencias
  const words = originalQuery.split(/\s+/).filter(w => w.length > 0);
  const suggestions: string[] = [];
  
  // Sugerir variaciones de cada palabra
  words.forEach(word => {
    const variations = generateWordVariations(word);
    variations.forEach(variation => {
      if (variation !== word) {
        suggestions.push(originalQuery.replace(word, variation));
      }
    });
  });
  
  // Sugerir búsquedas más amplias (remover palabras)
  if (words.length > 1) {
    words.forEach((_, index) => {
      const shorterQuery = words.filter((_, i) => i !== index).join(' ');
      if (shorterQuery.length > 0) {
        suggestions.push(shorterQuery);
      }
    });
  }
  
  return {
    original_query: originalQuery,
    found_results: false,
    suggestions: [...new Set(suggestions)].slice(0, 5),
    alternative_queries: suggestions.slice(0, 3),
    message: 'No se encontraron resultados. Aquí hay algunas sugerencias de búsqueda.'
  };
}

// Función para buscar productos por rango de precio
async function getProductsByPriceRange(supabase: any, params: any) {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });
  
  // Filtrar por rango de precio
  if (params.min_price !== undefined) {
    query = query.gte('price', params.min_price.toString());
  }
  if (params.max_price !== undefined) {
    query = query.lte('price', params.max_price.toString());
  }
  
  // Filtrar por categoría si se proporciona
  if (params.category) {
    query = query.ilike('category', `%${params.category}%`);
  }
  
  // Búsqueda de texto adicional si se proporciona
  if (params.query) {
    query = query.or(`name.ilike.%${params.query}%,description.ilike.%${params.query}%`);
  }
  
  const limit = params.limit || 15;
  query = query.limit(limit);
  
  if (params.offset) {
    query = query.range(params.offset, params.offset + limit - 1);
  }
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  // Ordenar por precio
  const sortedData = (data || []).sort((a: any, b: any) => {
    const priceA = parseFloat(a.price?.replace(/[^\d.,]/g, '').replace(',', '.') || '0');
    const priceB = parseFloat(b.price?.replace(/[^\d.,]/g, '').replace(',', '.') || '0');
    return priceA - priceB;
  });
  
  const mappedProducts = sortedData.map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    products: mappedProducts,
    total: count || mappedProducts.length,
    price_range: {
      min: params.min_price,
      max: params.max_price
    }
  };
}

// Función para obtener especificaciones de producto
async function getProductSpecifications(supabase: any, params: any) {
  let product = null;
  
  if (params.product_id) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .eq('id', params.product_id)
      .single();
    product = data;
  } else if (params.product_name) {
    const { data } = await supabase
      .from('products')
      .select('*')
      .ilike('name', `%${params.product_name}%`)
      .limit(1)
      .single();
    product = data;
  }
  
  if (!product) {
    return {
      product: null,
      specifications: {},
      message: 'Producto no encontrado'
    };
  }
  
  // Extraer especificaciones de la descripción
  const specifications: any = {
    nombre: product.name,
    precio: product.price,
    categoria: product.category,
    subcategoria: product.subcategory,
    sku: product.sku,
    descripcion: product.description
  };
  
  return {
    product: {
      ...product,
      image: product.image_url || product.image || ''
    },
    specifications,
    message: 'Especificaciones obtenidas correctamente'
  };
}

// Función para obtener productos populares
async function getPopularProducts(supabase: any, params: any) {
  let query = supabase
    .from('products')
    .select('*', { count: 'exact' });
  
  // Filtrar por categoría si se proporciona
  if (params.category) {
    query = query.ilike('category', `%${params.category}%`);
  }
  
  // Ordenar por fecha de creación (productos más recientes primero)
  // En una implementación real, esto podría usar un campo de popularidad/ventas
  query = query.order('created_at', { ascending: false });
  
  const limit = params.limit || 10;
  query = query.limit(limit);
  
  const { data, error, count } = await query;
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  const mappedProducts = (data || []).map((product: any) => ({
    ...product,
    image: product.image_url || product.image || ''
  }));
  
  return {
    products: mappedProducts,
    total: count || mappedProducts.length,
    category: params.category || 'todas'
  };
}

// Función para guardar conversación en analytics
async function saveConversationToAnalytics(
  supabase: any,
  sessionId: string,
  userMessage: string,
  botResponse: string,
  functionCalled?: string,
  productsConsulted?: any[],
  categoryConsulted?: string,
  modelUsed?: string,
  responseTimeMs?: number,
  tokensUsed?: number
): Promise<string | null> {
  try {
    console.log('[Analytics] Intentando guardar conversación:', {
      sessionId: sessionId || 'default',
      userMessageLength: userMessage?.length || 0,
      botResponseLength: botResponse?.length || 0,
      functionCalled,
      productsCount: productsConsulted?.length || 0
    });

    // Extraer productos consultados si hay función de productos
    let productsData: any[] = [];
    if (productsConsulted && Array.isArray(productsConsulted)) {
      productsData = productsConsulted.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price
      }));
    }

    // Extraer categoría si hay productos
    let detectedCategory = categoryConsulted;
    if (!detectedCategory && productsData.length > 0) {
      detectedCategory = productsData[0]?.category;
    }

    const insertData = {
      session_id: sessionId || 'default',
      user_message: userMessage,
      bot_response: botResponse,
      function_called: functionCalled || null,
      products_consulted: productsData.length > 0 ? productsData : null,
      category_consulted: detectedCategory || null,
      model_used: modelUsed || 'gpt-3.5-turbo',
      response_time_ms: responseTimeMs || null,
      tokens_used: tokensUsed || null,
    };

    const { data, error } = await supabase
      .from('chat_conversations')
      .insert(insertData)
      .select();

    if (error) {
      console.error('[Analytics] Error guardando conversación:', {
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
        sessionId: sessionId || 'default'
      });
      return null;
    } else {
      console.log('[Analytics] Conversación guardada exitosamente:', {
        id: data?.[0]?.id,
        sessionId: sessionId || 'default',
        createdAt: data?.[0]?.created_at
      });
      return data?.[0]?.id || null;
    }
  } catch (error) {
    console.error('[Analytics] Error en saveConversationToAnalytics:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      sessionId: sessionId || 'default'
    });
    return null;
  }
}

// Función para buscar contenido web indexado
async function searchWebContent(supabase: any, params: any, req: any) {
  try {
    const query = params.query || '';
    const limit = params.limit || 5;
    const productId = params.product_id;

    if (!query || query.trim().length === 0) {
      return {
        results: [],
        total: 0,
        message: 'Query parameter is required'
      };
    }

    // Construir consulta
    let dbQuery = supabase
      .from('web_content_index')
      .select('id, url, title, content, metadata, content_type, source, product_id, last_updated_at')
      .eq('status', 'active')
      .or(`title.ilike.%${query}%,content.ilike.%${query}%`)
      .limit(limit);

    // Filtrar por producto si se especifica
    if (productId) {
      dbQuery = dbQuery.eq('product_id', productId);
    }

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Error searching web content:', error);
      return {
        results: [],
        total: 0,
        error: error.message
      };
    }

    // Ordenar por relevancia
    const sorted = (data || []).sort((a: any, b: any) => {
      const aScore = calculateWebContentRelevance(a, query);
      const bScore = calculateWebContentRelevance(b, query);
      return bScore - aScore;
    });

    // Formatear resultados
    const results = sorted.map((item: any) => ({
      id: item.id,
      url: item.url,
      title: item.title,
      snippet: extractSnippetFromContent(item.content, query, 300),
      metadata: item.metadata || {},
      content_type: item.content_type,
      source: item.source,
      product_id: item.product_id,
      last_updated_at: item.last_updated_at
    }));

    return {
      results,
      total: results.length,
      query
    };
  } catch (error) {
    console.error('Error in searchWebContent:', error);
    return {
      results: [],
      total: 0,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// Función auxiliar para calcular relevancia del contenido web
function calculateWebContentRelevance(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  const contentLower = (item.content || '').toLowerCase();

  let score = 0;

  // Título tiene más peso
  if (titleLower.includes(queryLower)) {
    score += 10;
    if (titleLower.startsWith(queryLower)) {
      score += 5;
    }
  }

  // Contenido
  if (contentLower.includes(queryLower)) {
    score += 1;
    const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(occurrences, 5);
  }

  // Metadata
  if (item.metadata) {
    const metadataStr = JSON.stringify(item.metadata).toLowerCase();
    if (metadataStr.includes(queryLower)) {
      score += 2;
    }
  }

  return score;
}

// Función auxiliar para extraer snippet del contenido
function extractSnippetFromContent(content: string, query: string, maxLength: number): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const index = contentLower.indexOf(queryLower);

  if (index === -1) {
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  const start = Math.max(0, index - 100);
  const end = Math.min(content.length, index + query.length + 100);
  
  let snippet = content.substring(start, end);
  
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  return snippet;
}


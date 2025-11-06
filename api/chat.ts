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
    const { data: activePrompts, error: promptError } = await supabase
      .from('system_prompts')
      .select('*, prompt_variables(*)')
      .eq('is_active', true)
      .limit(1)
      .single();

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

    // 3. Limitar historial de conversación (últimos 10 mensajes para evitar tokens innecesarios)
    const limitedHistory = conversationHistory.slice(-10);

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

    // 5. Detectar si el mensaje es sobre productos para forzar búsqueda
    const isProductQuery = detectProductQuery(message);
    
    // 6. Preparar mensajes para OpenAI (con historial limitado)
    // Añadir instrucción adicional al system prompt si es una pregunta sobre productos
    let enhancedSystemPrompt = systemPrompt;
    if (isProductQuery) {
      enhancedSystemPrompt += '\n\n⚠️ ATENCIÓN: El usuario está preguntando sobre productos. DEBES usar la función search_products ANTES de responder. NO respondas directamente sin buscar en la base de datos.';
    }
    
    const messages: any[] = [
      { role: 'system', content: enhancedSystemPrompt },
      ...limitedHistory,
      { role: 'user', content: message }
    ];

    // 7. Configuración de OpenAI
    const model = config.model || 'gpt-3.5-turbo'; // Por defecto más rápido
    const temperature = config.temperature !== undefined ? config.temperature : 0.7;
    const maxTokens = config.max_tokens || 1500; // Reducido para respuestas más rápidas

    // 8. Llamar a OpenAI (con timeout para evitar errores de Vercel)
    // Si es una pregunta sobre productos, forzar el uso de herramientas
    let completion;
    try {
      // Si es una pregunta sobre productos, forzar búsqueda
      let toolChoice: any = 'auto';
      if (isProductQuery) {
        // Extraer término de búsqueda del mensaje para añadirlo como contexto
        const searchTerm = extractSearchTermFromMessage(message);
        // Añadir el término de búsqueda al mensaje del usuario para que OpenAI lo use
        if (searchTerm && searchTerm !== message.trim()) {
          messages[messages.length - 1] = {
            role: 'user',
            content: `${message}\n\n[IMPORTANTE: Busca productos relacionados con "${searchTerm}" usando la función search_products]`
          };
        }
        // Forzar el uso de search_products
        toolChoice = { 
          type: 'function' as const, 
          function: { 
            name: 'search_products'
          } 
        };
      }
      
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
          setTimeout(() => reject(new Error('OpenAI request timeout')), 25000)
        )
      ]) as any;
    } catch (openaiError) {
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

      // Detectar intención del usuario
      const userIntent = detectUserIntent(message);
      
      // Pasar userIntent a searchProducts si es search_products
      if (functionName === 'search_products' && functionArgs) {
        functionArgs.userIntent = userIntent;
      }
      
      // Preparar contexto enriquecido con instrucciones de validación
      let enrichedContext = '';
      
      // INSTRUCCIONES MEJORADAS PARA OPENAI (FASE 1 - FORMATO ENRIQUECIDO)
      enrichedContext += '\n\n📋 INSTRUCCIONES CRÍTICAS PARA RESPONDER:\n';
      enrichedContext += '1. SIEMPRE presenta productos con esta estructura clara y profesional:\n';
      enrichedContext += '   - **Nombre completo del producto** (en negrita)\n';
      enrichedContext += '   - 💰 Precio: [precio] (SIEMPRE lo mencionas si está disponible)\n';
      enrichedContext += '   - 📦 Categoría: [categoría] (si está disponible)\n';
      enrichedContext += '   - 📝 Descripción breve (1-2 líneas destacando características principales)\n';
      enrichedContext += '   - 🔗 [Ver producto](URL) (si está disponible)\n\n';
      enrichedContext += '2. Cuando haya múltiples productos, AGRÚPALOS de esta forma:\n';
      enrichedContext += '   - 🏆 **RECOMENDADO**: El producto más relevante (el primero de la lista)\n';
      enrichedContext += '   - 🔁 **ALTERNATIVAS**: Los siguientes 2-3 productos similares\n';
      enrichedContext += '   - 💡 **PUEDE INTERESARTE**: Productos adicionales relacionados\n';
      enrichedContext += '   - Usa formato de lista numerada (1., 2., 3.) o con viñetas (•)\n';
      enrichedContext += '   - Incluye precio y link para cada uno\n';
      enrichedContext += '   - Si hay más productos, menciona "y X más productos disponibles"\n';
      enrichedContext += '   - Comienza con: "He encontrado X productos relacionados con [término de búsqueda]:"\n\n';
      enrichedContext += '3. SIEMPRE menciona el precio si está disponible en el producto\n\n';
      enrichedContext += '4. Si un producto tiene categoría, menciónala brevemente para contexto\n\n';
      enrichedContext += '5. Sé específico y detallado, NO uses respuestas genéricas como "tengo productos" o "aquí tienes algunos productos"\n';
      enrichedContext += '   - En su lugar, di: "He encontrado [número] productos que coinciden con tu búsqueda"\n';
      enrichedContext += '   - Menciona características específicas de cada producto\n';
      enrichedContext += '   - Añade un resumen breve del conjunto de productos al final\n\n';
      enrichedContext += '6. Si el usuario pregunta por algo específico y lo encontraste, confirma claramente que sí lo tienes\n';
      enrichedContext += '   - Ejemplo: "Sí, tenemos [nombre del producto]. Aquí están los detalles:"\n\n';
      enrichedContext += '7. Si no encuentras exactamente lo que busca, sugiere alternativas similares de los resultados\n';
      enrichedContext += '   - Di: "No encontré exactamente [término], pero tengo estos productos similares que podrían interesarte:"\n\n';
      
      // Añadir instrucciones según la intención detectada
      if (userIntent.intent === 'buy') {
        enrichedContext += '8. ⚠️ INTENCIÓN DETECTADA: El usuario quiere COMPRAR\n';
        enrichedContext += '   - Destaca el precio de forma prominente\n';
        enrichedContext += '   - Menciona disponibilidad si es relevante\n';
        enrichedContext += '   - Facilita el acceso al link de compra\n';
        enrichedContext += '   - Puedes mencionar: "Para comprar este producto, haz clic en el enlace"\n\n';
      } else if (userIntent.intent === 'compare') {
        enrichedContext += '8. ⚠️ INTENCIÓN DETECTADA: El usuario quiere COMPARAR productos\n';
        enrichedContext += '   - Presenta los productos en formato comparativo\n';
        enrichedContext += '   - Destaca diferencias clave (precio, características, categoría)\n';
        enrichedContext += '   - Usa formato tabla o lista con columnas claras\n';
        enrichedContext += '   - Puedes sugerir: "Para ayudarte a decidir, aquí están las diferencias principales:"\n\n';
      } else if (userIntent.intent === 'info') {
        enrichedContext += '8. ⚠️ INTENCIÓN DETECTADA: El usuario busca INFORMACIÓN\n';
        enrichedContext += '   - Proporciona descripciones más detalladas\n';
        enrichedContext += '   - Menciona características técnicas si están disponibles\n';
        enrichedContext += '   - Explica para qué sirve cada producto\n';
        enrichedContext += '   - Puedes usar: "Este producto es ideal para..." o "Características principales:"\n\n';
      }
      
      // Añadir instrucciones específicas según el caso
      if (functionResult.products && functionResult.products.length > 1) {
        enrichedContext += '\n⚠️ IMPORTANTE: Has encontrado múltiples productos (ya ordenados por relevancia). Presenta los más relevantes primero.\n';
      } else if (functionResult.products && functionResult.products.length === 1) {
        const product = functionResult.products[0];
        enrichedContext += '\n✅ Has encontrado un producto específico. Preséntalo con todos sus detalles.\n';
        // Verificar si el nombre coincide exactamente con la búsqueda
        if (functionArgs.query && typeof functionArgs.query === 'string') {
          const searchTerm = functionArgs.query.toLowerCase().trim();
          const productName = product.name.toLowerCase();
          if (!productName.includes(searchTerm) && !searchTerm.includes(productName.split(' ')[0])) {
            enrichedContext += '⚠️ Nota: El producto encontrado puede no coincidir exactamente con la búsqueda. Asegúrate de mencionar el nombre completo.\n';
          }
        }
        
        // Buscar contenido web adicional para el producto encontrado (solo si no hay múltiples productos)
        // Esto se hace después de la primera respuesta para no bloquear
        // Por ahora, el contenido web se busca directamente en la función search_web_content
      } else if (functionResult.products && functionResult.products.length === 0) {
        // FASE 1 - MEJOR FALLBACK (SIN RESULTADOS)
        enrichedContext += '\n⚠️ No se encontraron productos. Debes:\n';
        enrichedContext += '   1. Ser EMPÁTICO y profesional:\n';
        enrichedContext += '      - "Lo siento, no encontré productos que coincidan exactamente con tu búsqueda de \'[término]\'."\n';
        enrichedContext += '      - "Entiendo que puede ser frustrante. Déjame ayudarte a encontrar alternativas."\n';
        enrichedContext += '   2. Buscar productos similares automáticamente:\n';
        enrichedContext += '      - Intenta buscar productos relacionados por categoría\n';
        enrichedContext += '      - Busca variaciones del término de búsqueda\n';
        enrichedContext += '   3. Sugerir términos alternativos o variaciones\n';
        enrichedContext += '   4. Preguntar por más detalles de forma amigable:\n';
        enrichedContext += '      - "¿Podrías ser más específico? Por ejemplo, menciona la categoría o características que buscas"\n';
        enrichedContext += '      - "¿Hay alguna categoría específica en la que te gustaría que busque?"\n';
        enrichedContext += '   5. Ofrecer ayuda proactiva:\n';
        enrichedContext += '      - "¿Te gustaría que busque productos similares o en otra categoría?"\n';
        enrichedContext += '      - "Puedo ayudarte a explorar nuestras categorías disponibles"\n';
        
        // Generar sugerencias automáticas mejoradas
        if (functionArgs.query && typeof functionArgs.query === 'string') {
          const suggestions = await generateSearchSuggestions(supabase, functionArgs.query);
          if (suggestions.length > 0) {
            enrichedContext += '\n💡 SUGERENCIAS DE BÚSQUEDA ALTERNATIVAS:\n';
            suggestions.slice(0, 5).forEach((suggestion, idx) => {
              enrichedContext += `   ${idx + 1}. "${suggestion}"\n`;
            });
            enrichedContext += '\nPuedes sugerir al usuario que pruebe con estos términos de forma amigable.\n';
          }
          
          // Buscar productos similares por categorías relacionadas
          enrichedContext += '\n🔍 BÚSQUEDA AUTOMÁTICA DE PRODUCTOS SIMILARES:\n';
          enrichedContext += 'Intenta buscar productos en categorías relacionadas o con términos similares.\n';
          
          // Buscar categorías relacionadas
          try {
            const { data: categories } = await supabase
              .from('products')
              .select('category')
              .not('category', 'is', null)
              .limit(20);
            
            if (categories && categories.length > 0) {
              const uniqueCategories = [...new Set(categories.map((c: any) => c.category))];
              const normalizedQuery = normalizeText(functionArgs.query);
              
              // Buscar categorías que contengan palabras de la búsqueda
              const relatedCategories = uniqueCategories.filter((cat: string) => {
                const normalizedCat = normalizeText(cat);
                return normalizedCat.includes(normalizedQuery) || 
                       normalizedQuery.split(' ').some(word => normalizedCat.includes(word));
              });
              
              if (relatedCategories.length > 0) {
                enrichedContext += `\nCategorías relacionadas encontradas: ${relatedCategories.slice(0, 3).join(', ')}\n`;
                enrichedContext += 'Puedes sugerir al usuario que busque en estas categorías.\n';
              }
            }
          } catch (error) {
            console.error('Error buscando categorías relacionadas:', error);
          }
        }
        
        // Instrucción para generar respuesta con OpenAI cuando no hay resultados
        enrichedContext += '\n\n⚠️ IMPORTANTE: Como no hay resultados, genera una respuesta empática y útil usando OpenAI.\n';
        enrichedContext += 'No uses respuestas genéricas. Sé específico y ofrece alternativas concretas.\n';
      }
      
      // Formatear productos para mejor presentación
      if (functionResult.products && functionResult.products.length > 0) {
        enrichedContext += '\n\n📦 PRODUCTOS ENCONTRADOS (formateados para mejor presentación):\n';
        enrichedContext += formatProductsForPrompt(functionResult.products, 5);
        enrichedContext += '\n\nUsa esta información formateada para crear una respuesta clara y estructurada.\n';
      }
      
      // Scraping desactivado temporalmente - comentado para evitar FUNCTION_INVOCATION_FAILED
      // TODO: Reactivar cuando se implemente scraping asíncrono o con mejor manejo de errores
      /*
      if (functionResult.products && functionResult.products.length > 0) {
        const productsWithWebData = functionResult.products.filter((p: any) => p.webData);
        if (productsWithWebData.length > 0) {
          enrichedContext += '\n\nINFORMACIÓN ADICIONAL OBTENIDA DE LA WEB:\n';
          productsWithWebData.forEach((product: any, idx: number) => {
            enrichedContext += `\nProducto ${idx + 1}: ${product.name}\n`;
            if (product.webData?.description) {
              enrichedContext += `- Descripción completa: ${product.webData.description}\n`;
            }
            if (product.webData?.features && product.webData.features.length > 0) {
              enrichedContext += `- Características: ${product.webData.features.join(', ')}\n`;
            }
            if (product.webData?.specifications) {
              const specs = Object.entries(product.webData.specifications)
                .slice(0, 5)
                .map(([key, value]) => `${key}: ${value}`)
                .join(', ');
              if (specs) {
                enrichedContext += `- Especificaciones: ${specs}\n`;
              }
            }
            if (product.webData?.availableColors && product.webData.availableColors.length > 0) {
              enrichedContext += `- Colores disponibles: ${product.webData.availableColors.join(', ')}\n`;
            }
          });
        }
      } else if (functionResult.product && functionResult.product.webData) {
        const product = functionResult.product;
        enrichedContext += '\n\nINFORMACIÓN ADICIONAL OBTENIDA DE LA WEB:\n';
        if (product.webData.description) {
          enrichedContext += `- Descripción completa: ${product.webData.description}\n`;
        }
        if (product.webData.features && product.webData.features.length > 0) {
          enrichedContext += `- Características: ${product.webData.features.join(', ')}\n`;
        }
        if (product.webData.specifications) {
          const specs = Object.entries(product.webData.specifications)
            .slice(0, 5)
            .map(([key, value]) => `${key}: ${value}`)
            .join(', ');
          if (specs) {
            enrichedContext += `- Especificaciones: ${specs}\n`;
          }
        }
        if (product.webData.availableColors && product.webData.availableColors.length > 0) {
          enrichedContext += `- Colores disponibles: ${product.webData.availableColors.join(', ')}\n`;
        }
      }
      */

      // 9. Enviar resultados de vuelta a OpenAI con contexto enriquecido
      // Limitar el tamaño del contexto enriquecido para evitar problemas
      const maxContextLength = 3000; // Limitar a 3000 caracteres
      const limitedEnrichedContext = enrichedContext.length > maxContextLength 
        ? enrichedContext.substring(0, maxContextLength) + '\n\n[Contexto truncado para evitar exceder límites]'
        : enrichedContext;
      
      const systemPromptWithContext = systemPrompt + limitedEnrichedContext;
      
      // Log para debugging
      console.log(`Function ${functionName} executed successfully. Result size:`, 
        JSON.stringify(functionResult).length, 'bytes');
      console.log(`Enriched context length: ${enrichedContext.length} chars (limited to ${limitedEnrichedContext.length})`);
      
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
      let secondCompletion;
      try {
        // Limitar el tamaño de functionResult para evitar problemas de tokens
        let limitedFunctionResult = functionResult;
        if (functionResult.products && Array.isArray(functionResult.products)) {
          // Limitar a máximo 10 productos para no exceder tokens
          limitedFunctionResult = {
            ...functionResult,
            products: functionResult.products.slice(0, 10),
            total: functionResult.products.length,
            limited: functionResult.products.length > 10
          };
        }
        
        // Limitar tamaño del JSON stringificado
        const functionResultStr = JSON.stringify(limitedFunctionResult);
        if (functionResultStr.length > 5000) {
          // Si es muy grande, crear una versión resumida
          limitedFunctionResult = {
            ...functionResult,
            products: functionResult.products ? functionResult.products.slice(0, 5).map((p: any) => ({
              id: p.id,
              name: p.name,
              price: p.price,
              category: p.category,
              sku: p.sku
            })) : undefined,
            summary: 'Resultados limitados para mostrar. Total encontrado: ' + (functionResult.total || functionResult.products?.length || 0)
          };
        }
        
        // Preparar mensajes finales con resultado limitado
        const finalMessages = messagesWithContext.map((msg: any) => {
          // Asegurar que el mensaje de tool tenga el resultado limitado
          if (msg.role === 'tool') {
            return {
              ...msg,
              content: JSON.stringify(limitedFunctionResult)
            };
          }
          return msg;
        });
        
        // Calcular tamaño total de mensajes para logging
        const totalMessagesSize = JSON.stringify(finalMessages).length;
        console.log(`Calling OpenAI second completion. Total messages size: ${totalMessagesSize} bytes`);
        
        secondCompletion = await Promise.race([
          openai.chat.completions.create({
            model,
            temperature,
            max_tokens: maxTokens,
            messages: finalMessages as any,
            tools: functions.map(f => ({
              type: 'function' as const,
              function: f
            })),
            tool_choice: 'auto'
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('OpenAI request timeout')), 30000)
          )
        ]) as any;
        
        console.log('OpenAI second completion received:', {
          hasContent: !!secondCompletion?.choices?.[0]?.message?.content,
          contentLength: secondCompletion?.choices?.[0]?.message?.content?.length || 0
        });
      } catch (openaiError) {
        console.error('OpenAI second completion error:', openaiError);
        // Si falla, intentar generar una respuesta básica con los datos
        if (functionResult.products && functionResult.products.length > 0) {
          const productNames = functionResult.products.slice(0, 5).map((p: any) => p.name).join(', ');
          const fallbackMessage = `Encontré ${functionResult.products.length} producto(s). ${productNames}${functionResult.products.length > 5 ? ' y más...' : ''}. ¿Te gustaría más información sobre alguno de estos productos?`;
          
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
                sources: ['products_db']
              }
            ]
          });
          return;
        }
        
        res.status(500).json({
          success: false,
          error: 'Error al generar respuesta final',
          message: openaiError instanceof Error ? openaiError.message : 'Timeout o error desconocido',
          details: 'Por favor, intenta de nuevo en un momento'
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
                sources: ['products_db']
              }
            ]
          });
          return;
        }
        
        res.status(500).json({
          success: false,
          error: 'Respuesta inválida de OpenAI',
          details: 'La respuesta de OpenAI no tiene la estructura esperada'
        });
        return;
      }

      const finalMessage = secondCompletion.choices[0].message?.content || '';
      
      // Si el mensaje está vacío, generar uno de fallback
      if (!finalMessage || finalMessage.trim().length === 0) {
        console.warn('OpenAI returned empty message, using fallback');
        if (functionResult.products && functionResult.products.length > 0) {
          const productNames = functionResult.products.slice(0, 5).map((p: any) => p.name).join(', ');
          const fallbackMessage = `Encontré ${functionResult.products.length} producto(s): ${productNames}${functionResult.products.length > 5 ? ' y más...' : ''}. ¿Te gustaría más información sobre alguno de estos productos?`;
          
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
                sources: ['products_db']
              }
            ]
          });
          return;
        }
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

      // Preparar mensaje del asistente con productos y fuentes
      const assistantMessage: any = {
        role: 'assistant',
        content: finalMessage,
        function_calls: [toolCall],
        sources: sources.length > 0 ? sources : ['general']
      };

      // Guardar conversación en analytics
      const responseTime = Date.now() - startTime;
      const conversationId = await saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        finalMessage,
        functionName,
        functionResult.products || (functionResult.product ? [functionResult.product] : undefined),
        functionArgs.category || functionArgs.subcategory,
        model,
        responseTime
      );

      res.status(200).json({
        success: true,
        message: finalMessage,
        function_called: functionName,
        function_result: functionResult,
        conversation_id: conversationId,
        conversation_history: [
          ...conversationHistory,
          { role: 'user', content: message },
          assistantMessage
        ]
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
      const conversationId = await saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        response,
        undefined, // No hay función
        undefined, // No hay productos
        undefined, // No hay categoría
        model,
        responseTime
      );

      res.status(200).json({
        success: true,
        message: response,
        conversation_id: conversationId,
        conversation_history: [
          ...conversationHistory,
          { role: 'user', content: message },
          assistantMessage
        ]
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
function extractSearchTermFromMessage(message: string): string {
  const lowerMessage = message.toLowerCase().trim();
  
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
    return lowerWord.length > 2 && 
           !['tienes', 'tiene', 'tienen', 'busca', 'buscar', 'hay', 'existe', 
             'muestra', 'muestrame', 'muéstrame', 'encuentra', 'producto', 
             'productos', 'artículo', 'artículos', 'precio', 'cuánto', 'cuanto'].includes(lowerWord);
  });
  
  if (words.length > 0) {
    return words.join(' ');
  }
  
  // Si todo falla, devolver el mensaje completo sin signos de interrogación
  return message.replace(/[?¿!¡]/g, '').trim();
}

// Función para detectar intención del usuario
function detectUserIntent(message: string): {
  intent: 'buy' | 'compare' | 'info' | 'search';
  urgency: 'high' | 'medium' | 'low';
} {
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
    return { intent: 'buy', urgency: 'high' };
  }
  if (compareKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'compare', urgency: 'medium' };
  }
  if (infoKeywords.some(k => lowerMessage.includes(k))) {
    return { intent: 'info', urgency: 'low' };
  }
  
  return { intent: 'search', urgency: 'medium' };
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
  
  const limited = products.slice(0, limit);
  
  // FASE 1: Agrupación enriquecida
  let formatted = '';
  
  if (limited.length === 1) {
    // Un solo producto: presentarlo como recomendado
    const p = limited[0];
    const description = (p.description || '').trim();
    const descriptionPreview = description.length > 200 
      ? description.substring(0, 200) + '...' 
      : description || 'Sin descripción disponible';
    
    formatted += `🏆 **RECOMENDADO**\n\n`;
    formatted += `**${p.name}**\n`;
    formatted += `💰 Precio: ${p.price || 'No disponible'}\n`;
    if (p.category) {
      formatted += `📦 Categoría: ${p.category}\n`;
    }
    if (p.sku) {
      formatted += `🏷️ SKU: ${p.sku}\n`;
    }
    formatted += `📝 ${descriptionPreview}\n`;
    if (p.product_url) {
      formatted += `🔗 URL: ${p.product_url}`;
    }
  } else {
    // Múltiples productos: agrupar
    const recommended = limited[0];
    const alternatives = limited.slice(1, Math.min(4, limited.length));
    const additional = limited.slice(4);
    
    // 🏆 RECOMENDADO
    if (recommended) {
      const description = (recommended.description || '').trim();
      const descriptionPreview = description.length > 200 
        ? description.substring(0, 200) + '...' 
        : description || 'Sin descripción disponible';
      
      formatted += `🏆 **RECOMENDADO**\n\n`;
      formatted += `**${recommended.name}**\n`;
      formatted += `💰 Precio: ${recommended.price || 'No disponible'}\n`;
      if (recommended.category) {
        formatted += `📦 Categoría: ${recommended.category}\n`;
      }
      if (recommended.sku) {
        formatted += `🏷️ SKU: ${recommended.sku}\n`;
      }
      formatted += `📝 ${descriptionPreview}\n`;
      if (recommended.product_url) {
        formatted += `🔗 URL: ${recommended.product_url}`;
      }
      formatted += '\n\n';
    }
    
    // 🔁 ALTERNATIVAS
    if (alternatives.length > 0) {
      formatted += `🔁 **ALTERNATIVAS**\n\n`;
      alternatives.forEach((p, i) => {
        const description = (p.description || '').trim();
        const descriptionPreview = description.length > 150 
          ? description.substring(0, 150) + '...' 
          : description || 'Sin descripción disponible';
        
        formatted += `${i + 1}. **${p.name}**\n`;
        formatted += `   💰 Precio: ${p.price || 'No disponible'}\n`;
        if (p.category) {
          formatted += `   📦 Categoría: ${p.category}\n`;
        }
        formatted += `   📝 ${descriptionPreview}\n`;
        if (p.product_url) {
          formatted += `   🔗 URL: ${p.product_url}`;
        }
        formatted += '\n\n';
      });
    }
    
    // 💡 PUEDE INTERESARTE
    if (additional.length > 0) {
      formatted += `💡 **PUEDE INTERESARTE**\n\n`;
      additional.forEach((p, i) => {
        const description = (p.description || '').trim();
        const descriptionPreview = description.length > 100 
          ? description.substring(0, 100) + '...' 
          : description || 'Sin descripción disponible';
        
        formatted += `${i + 1}. **${p.name}**\n`;
        formatted += `   💰 Precio: ${p.price || 'No disponible'}\n`;
        if (p.category) {
          formatted += `   📦 Categoría: ${p.category}\n`;
        }
        formatted += `   📝 ${descriptionPreview}\n`;
        if (p.product_url) {
          formatted += `   🔗 URL: ${p.product_url}`;
        }
        formatted += '\n\n';
      });
    }
    
    // Resumen del conjunto de productos
    formatted += `\n📊 **RESUMEN**: Se encontraron ${products.length} producto(s) relacionado(s). `;
    if (products.length > limit) {
      formatted += `Mostrando los ${limit} más relevantes. `;
    }
    formatted += `Los productos están ordenados por relevancia, siendo el primero el más recomendado.\n`;
  }
  
  return formatted;
}

// Función para generar variaciones de palabras comunes
function generateWordVariations(word: string): string[] {
  const variations = [word];
  const normalized = normalizeText(word);
  
  // Variaciones comunes en español
  const commonVariations: { [key: string]: string[] } = {
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
      variations.push(base + 'dor', base + 'a', base + 'ado');
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
        // Filtrar palabras muy cortas que no son relevantes para la búsqueda
        if (word.length <= 2 && !['de', 'la', 'el'].includes(word.toLowerCase())) {
          return; // Saltar artículos y preposiciones muy cortas
        }
        
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

  // Límite aumentado para búsquedas con múltiples palabras
  // Esto ayuda a capturar más resultados antes del filtrado en memoria
  const baseLimit = params.limit || 15;
  const maxLimit = 50; // Aumentado de 30 a 50 para búsquedas complejas
  const searchTerm = params.query && typeof params.query === 'string' ? params.query.trim() : '';
  const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
  const hasMultipleWords = words.length > 1;
  const limit = Math.min(hasMultipleWords ? baseLimit * 3 : baseLimit, maxLimit); // Más resultados si hay múltiples palabras
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
  let sortedData = data || [];
  if (params.query && typeof params.query === 'string') {
    const searchTerm = params.query.trim();
    if (searchTerm.length > 0) {
      const words = searchTerm.split(/\s+/).filter(w => w.length > 0);
      
      // Si hay múltiples palabras, filtrar de forma más flexible
      if (words.length > 1) {
        // Filtrar palabras muy cortas (artículos, preposiciones) que no son relevantes
        const relevantWords = words.filter(w => w.length > 2 && !['de', 'la', 'el', 'los', 'las', 'un', 'una', 'del', 'con', 'por', 'para'].includes(w.toLowerCase()));
        
        // Si después de filtrar solo queda una palabra relevante, no aplicar filtro estricto
        if (relevantWords.length <= 1) {
          // No filtrar estrictamente, dejar que el scoring de relevancia ordene
        } else {
          // Filtrar para asegurar que al menos las palabras relevantes aparezcan
          // Usar un enfoque más flexible: al menos el 70% de las palabras relevantes deben aparecer
          const minWordsRequired = Math.ceil(relevantWords.length * 0.7);
          
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
            let matchingWords = 0;
            relevantWords.forEach(word => {
              const variations = generateWordVariations(word);
              const normalizedVariations = variations.map(v => normalizeText(v));
              
              // Verificar si alguna variación aparece en el texto
              if (normalizedVariations.some(variation => 
                normalizedSearchText.includes(variation)
              )) {
                matchingWords++;
              }
            });
            
            // También verificar la frase completa (para casos como "pajitas de cartón")
            const normalizedSearchTerm = normalizeText(searchTerm);
            if (normalizedSearchText.includes(normalizedSearchTerm)) {
              return true; // Si la frase completa aparece, incluir el producto
            }
            
            // Incluir si al menos el mínimo requerido de palabras aparece
            return matchingWords >= minWordsRequired;
          });
        }
      }
    }
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
  responseTimeMs?: number
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


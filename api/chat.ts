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
        description: 'Busca productos en la base de datos. IMPORTANTE: Usa esta función SIEMPRE antes de afirmar que tienes un producto. La búsqueda es flexible y encuentra variaciones de palabras (ej: "cierre" encuentra "cierra", "abre" encuentra "abridor"). Si el usuario pregunta por un producto específico, busca primero con esta función usando palabras clave del producto. Si hay múltiples resultados similares, presenta las opciones al usuario y pregunta cuál es el correcto. Si no hay coincidencia, intenta buscar con diferentes palabras clave o pregunta por más detalles.',
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

    // 5. Preparar mensajes para OpenAI (con historial limitado)
    const messages: any[] = [
      { role: 'system', content: systemPrompt },
      ...limitedHistory,
      { role: 'user', content: message }
    ];

    // 6. Configuración de OpenAI
    const model = config.model || 'gpt-3.5-turbo'; // Por defecto más rápido
    const temperature = config.temperature !== undefined ? config.temperature : 0.7;
    const maxTokens = config.max_tokens || 1500; // Reducido para respuestas más rápidas

    // 7. Llamar a OpenAI (con timeout para evitar errores de Vercel)
    let completion;
    try {
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
          tool_choice: 'auto'
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

      // Preparar contexto enriquecido con instrucciones de validación
      let enrichedContext = '';
      
      // Añadir instrucciones para validación cuando hay múltiples productos
      if (functionResult.products && functionResult.products.length > 1) {
        enrichedContext += '\n\n⚠️ IMPORTANTE: Has encontrado múltiples productos. NO asumas cuál es el correcto. Debes:\n';
        enrichedContext += '1. Listar todos los productos encontrados con sus nombres completos\n';
        enrichedContext += '2. Preguntar al usuario cuál de estos productos es el que busca\n';
        enrichedContext += '3. NO afirmes que tienes un producto específico sin confirmar primero\n';
      } else if (functionResult.products && functionResult.products.length === 1) {
        const product = functionResult.products[0];
        // Verificar si el nombre coincide exactamente con la búsqueda
        if (functionArgs.query && typeof functionArgs.query === 'string') {
          const searchTerm = functionArgs.query.toLowerCase().trim();
          const productName = product.name.toLowerCase();
          if (!productName.includes(searchTerm) && !searchTerm.includes(productName.split(' ')[0])) {
            enrichedContext += '\n\n⚠️ IMPORTANTE: El producto encontrado no coincide exactamente con la búsqueda. Debes preguntar al usuario si este es el producto que busca antes de confirmar.\n';
          }
        }
        
        // Buscar contenido web adicional para el producto encontrado
        if (product.id) {
          try {
            const webContentResult = await searchWebContent(supabase, {
              query: product.name,
              product_id: product.id,
              limit: 3
            }, req);
            
            if (webContentResult && webContentResult.results && webContentResult.results.length > 0) {
              enrichedContext += '\n\n📚 INFORMACIÓN ADICIONAL DEL PRODUCTO (de contenido web indexado):\n';
              webContentResult.results.forEach((webItem: any, idx: number) => {
                enrichedContext += `\n--- Información adicional ${idx + 1} ---\n`;
                if (webItem.title) {
                  enrichedContext += `Título: ${webItem.title}\n`;
                }
                if (webItem.snippet) {
                  enrichedContext += `Descripción: ${webItem.snippet}\n`;
                }
                if (webItem.metadata) {
                  if (webItem.metadata.description) {
                    enrichedContext += `Descripción completa: ${webItem.metadata.description}\n`;
                  }
                  if (webItem.metadata.features && Array.isArray(webItem.metadata.features)) {
                    enrichedContext += `Características: ${webItem.metadata.features.join(', ')}\n`;
                  }
                  if (webItem.metadata.specifications && typeof webItem.metadata.specifications === 'object') {
                    const specs = Object.entries(webItem.metadata.specifications)
                      .slice(0, 5)
                      .map(([key, value]) => `${key}: ${value}`)
                      .join(', ');
                    if (specs) {
                      enrichedContext += `Especificaciones: ${specs}\n`;
                    }
                  }
                }
              });
              enrichedContext += '\nUsa esta información adicional para dar respuestas más completas y detalladas sobre el producto.\n';
            }
          } catch (error) {
            // Silenciar errores de búsqueda web para no romper el flujo principal
            console.error('Error searching web content for product:', error);
          }
        }
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
      const systemPromptWithContext = systemPrompt + enrichedContext;
      
      // Log para debugging
      console.log(`Function ${functionName} executed successfully. Result size:`, 
        JSON.stringify(functionResult).length, 'bytes');
      
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
        
        secondCompletion = await Promise.race([
          openai.chat.completions.create({
            model,
            temperature,
            max_tokens: maxTokens,
            messages: messagesWithContext.map((msg: any) => {
              // Asegurar que el mensaje de tool tenga el resultado limitado
              if (msg.role === 'tool') {
                return {
                  ...msg,
                  content: JSON.stringify(limitedFunctionResult)
                };
              }
              return msg;
            }) as any,
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

      // Guardar conversación en analytics (en background, no bloquea la respuesta)
      const responseTime = Date.now() - startTime;
      saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        finalMessage,
        functionName,
        functionResult.products || (functionResult.product ? [functionResult.product] : undefined),
        functionArgs.category || functionArgs.subcategory,
        model,
        responseTime
      ).catch(err => console.error('Error guardando analytics (no crítico):', err));

      res.status(200).json({
        success: true,
        message: finalMessage,
        function_called: functionName,
        function_result: functionResult,
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

      // Guardar conversación en analytics (en background, no bloquea la respuesta)
      const responseTime = Date.now() - startTime;
      saveConversationToAnalytics(
        supabase,
        sessionId || 'default',
        message,
        response,
        undefined, // No hay función
        undefined, // No hay productos
        undefined, // No hay categoría
        model,
        responseTime
      ).catch(err => console.error('Error guardando analytics (no crítico):', err));

      res.status(200).json({
        success: true,
        message: response,
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

// Función para calcular score de relevancia de un producto
function calculateRelevanceScore(product: any, searchTerm: string): number {
  if (!searchTerm) return 0;
  
  let score = 0;
  const normalizedSearch = normalizeText(searchTerm);
  const productName = normalizeText(product.name || '');
  const description = normalizeText(product.description || '');
  const category = normalizeText(product.category || '');
  
  // Coincidencia exacta en nombre (máximo peso)
  if (productName === normalizedSearch) {
    score += 200;
  } else if (productName.includes(normalizedSearch)) {
    score += 100;
    // Bonus si está al inicio
    const index = productName.indexOf(normalizedSearch);
    if (index !== -1 && index < 5) {
      score += 50;
    }
  }
  
  // Coincidencia de palabras individuales
  const searchWords = normalizedSearch.split(/\s+/).filter(w => w.length > 2);
  searchWords.forEach(word => {
    if (productName.includes(word)) score += 30;
    if (description.includes(word)) score += 10;
    if (category.includes(word)) score += 20;
  });
  
  // Coincidencia en SKU (si contiene)
  if (product.sku && normalizeText(product.sku).includes(normalizedSearch)) {
    score += 40;
  }
  
  return score;
}

// Función para formatear productos para el prompt de OpenAI
function formatProductsForPrompt(products: any[], limit: number = 5): string {
  if (!products || products.length === 0) {
    return 'No se encontraron productos.';
  }
  
  const limited = products.slice(0, limit);
  const formatted = limited.map((p, i) => {
    return `Producto ${i + 1}:
- Nombre: ${p.name}
- Precio: ${p.price || 'No disponible'}
- Categoría: ${p.category || 'N/A'}
- SKU: ${p.sku || 'N/A'}
- Descripción: ${(p.description || '').substring(0, 150)}${p.description && p.description.length > 150 ? '...' : ''}
- URL: ${p.product_url || 'N/A'}`;
  }).join('\n\n');
  
  if (products.length > limit) {
    return formatted + `\n\n(Se encontraron ${products.length} productos en total, mostrando los ${limit} más relevantes)`;
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
      
      if (conditions.length > 0) {
        // También buscar la frase completa (para casos donde coincide exactamente)
        conditions.push(`name.ilike.%${searchTerm}%`);
        conditions.push(`description.ilike.%${searchTerm}%`);
        conditions.push(`sku.ilike.%${searchTerm}%`);
        
        // Usar OR para buscar cualquiera de las condiciones
        // Si hay múltiples palabras, todas deben aparecer en algún campo
        if (words.length > 1) {
          // Para múltiples palabras, necesitamos que todas las palabras aparezcan
          // Usamos una estrategia: buscamos productos que contengan al menos una palabra,
          // y luego filtramos en memoria para asegurar que todas las palabras están presentes
          query = query.or(conditions.join(','));
        } else {
          // Para una sola palabra, usar OR simple
          query = query.or(conditions.join(','));
        }
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

  // Límite reducido por defecto (más rápido)
  // Si hay múltiples palabras, aumentar el límite para tener más opciones antes del filtrado
  const baseLimit = params.limit || 15;
  const maxLimit = 30;
  const searchTerm = params.query && typeof params.query === 'string' ? params.query.trim() : '';
  const hasMultipleWords = searchTerm.split(/\s+/).filter(w => w.length > 0).length > 1;
  const limit = Math.min(hasMultipleWords ? baseLimit * 2 : baseLimit, maxLimit); // Más resultados si hay múltiples palabras
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
      
      // Si hay múltiples palabras, filtrar para asegurar que todas aparezcan
      if (words.length > 1) {
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
          
          // Verificar que todas las palabras (o sus variaciones) aparezcan
          return words.every(word => {
            const variations = generateWordVariations(word);
            const normalizedVariations = variations.map(v => normalizeText(v));
            
            // Verificar si alguna variación aparece en el texto
            return normalizedVariations.some(variation => 
              normalizedSearchText.includes(variation)
            );
          });
        });
      }
    }
  }

  // Calcular scores de relevancia y ordenar si hay término de búsqueda
  if (params.query && typeof params.query === 'string' && sortedData.length > 0) {
    sortedData = sortedData
      .map((product: any) => ({
        ...product,
        relevanceScore: calculateRelevanceScore(product, params.query)
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
  const { data, error } = await supabase
    .from('products')
    .select('category, subcategory');
  
  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }
  
  const categories = new Set<string>();
  const subcategories = new Map<string, Set<string>>();
  
  (data || []).forEach((product: any) => {
    if (product.category) {
      categories.add(product.category);
      
      if (params.include_subcategories && product.subcategory) {
        if (!subcategories.has(product.category)) {
          subcategories.set(product.category, new Set());
        }
        subcategories.get(product.category)!.add(product.subcategory);
      }
    }
  });
  
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
) {
  try {
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

    const { error } = await supabase
      .from('chat_conversations')
      .insert({
        session_id: sessionId || 'default',
        user_message: userMessage,
        bot_response: botResponse,
        function_called: functionCalled || null,
        products_consulted: productsData.length > 0 ? productsData : null,
        category_consulted: detectedCategory || null,
        model_used: modelUsed || 'gpt-3.5-turbo',
        response_time_ms: responseTimeMs || null,
      });

    if (error) {
      console.error('Error guardando conversación en analytics:', error);
      // No fallar si no se puede guardar
    }
  } catch (error) {
    console.error('Error en saveConversationToAnalytics:', error);
    // No fallar si no se puede guardar
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


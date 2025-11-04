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

    // Obtener datos de la request
    const {
      message,
      conversationHistory = [],
      config = {}
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

    // 3. Limitar historial de conversación (últimos 6 mensajes para mayor velocidad)
    const limitedHistory = conversationHistory.slice(-6);

    // 4. Definir funciones disponibles para Function Calling
    const functions = [
      {
        name: 'search_products',
        description: 'Busca productos. Si hay >4 resultados, pregunta por más criterios (SKU, categoría). Si hay 1-4, muestra opciones. Máximo 4 productos.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Texto de búsqueda (nombre, descripción, SKU).'
            },
            category: {
              type: 'string',
              description: 'Categoría principal.'
            },
            subcategory: {
              type: 'string',
              description: 'Subcategoría.'
            },
            limit: {
              type: 'number',
              description: 'Máximo 4 resultados.'
            },
            offset: {
              type: 'number',
              description: 'Offset para paginación.'
            },
            sort_by: {
              type: 'string',
              enum: ['name', 'price_asc', 'price_desc', 'date_add', 'created_at'],
              description: 'Orden: name, price_asc, price_desc, date_add, created_at.'
            }
          },
          required: []
        }
      },
      {
        name: 'get_product_by_sku',
        description: 'Obtiene producto por SKU. Si no existe, informa al usuario.',
        parameters: {
          type: 'object',
          properties: {
            sku: {
              type: 'string',
              description: 'SKU del producto (exacto o parcial).'
            }
          },
          required: ['sku']
        }
      },
      {
        name: 'search_documents',
        description: 'IMPORTANTE: Busca información en los documentos PDF y de texto subidos por el usuario. DEBES usar esta función SIEMPRE que el usuario pregunte sobre: procedimientos, políticas, guías, manuales, instrucciones, cambios, devoluciones, garantías, términos, condiciones, o cualquier información que pueda estar documentada. Si el usuario pregunta "cómo hacer X", "procedimiento de Y", "política de Z", o menciona términos como "devolución", "cambio", "garantía", "manual", "guía", etc., DEBES buscar primero en los documentos antes de responder con información general. Usa esta función para encontrar información exacta de los documentos subidos.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Texto de búsqueda para buscar en el contenido de los documentos subidos. Debe ser específico y relevante a la pregunta del usuario.'
            },
            limit: {
              type: 'number',
              description: 'Número máximo de documentos a devolver. Por defecto: 5. Máximo: 10.'
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
    const maxTokens = config.max_tokens || 800; // Reducido para respuestas más rápidas

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
          setTimeout(() => reject(new Error('OpenAI request timeout')), 20000)
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
          // Scraping desactivado temporalmente para evitar FUNCTION_INVOCATION_FAILED
          // TODO: Reactivar cuando se optimice el scraping
          // if (functionResult.products && functionResult.products.length > 0) {
          //   try {
          //     await enrichProductsWithWebData(functionResult.products);
          //   } catch (scrapingError) {
          //     console.error('Error enriching products with web data:', scrapingError);
          //   }
          // }
          break;
        case 'get_product_by_sku':
          functionResult = await getProductBySku(supabase, functionArgs);
          // Scraping desactivado temporalmente para evitar FUNCTION_INVOCATION_FAILED
          // TODO: Reactivar cuando se optimice el scraping
          // if (functionResult.product && functionResult.found) {
          //   try {
          //     await enrichProductsWithWebData([functionResult.product]);
          //   } catch (scrapingError) {
          //     console.error('Error enriching product with web data:', scrapingError);
          //   }
          // }
          break;
        case 'search_documents':
          functionResult = await searchDocuments(supabase, functionArgs);
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
      
      // Contexto para documentos
      if (functionName === 'search_documents') {
        if (functionResult.results && functionResult.results.length > 0) {
          enrichedContext += '\n\n📄 INFORMACIÓN ENCONTRADA EN DOCUMENTOS SUBIDOS:\n';
          enrichedContext += 'IMPORTANTE: Esta información proviene de documentos reales subidos por el usuario. Debes usar EXACTAMENTE esta información para responder. NO inventes información.\n\n';
          functionResult.results.forEach((doc: any, idx: number) => {
            enrichedContext += `\n--- Documento ${idx + 1}: ${doc.filename} (${doc.file_type.toUpperCase()}) ---\n`;
            // Si hay texto extraído, usar más contexto (hasta 2000 caracteres)
            if (doc.extracted_text && doc.extracted_text.length > 0) {
              // Si hay snippet relevante, usar ese más contexto alrededor
              if (doc.snippet && doc.snippet.trim() && doc.snippet.length > 100) {
                enrichedContext += `${doc.snippet}\n`;
              } else {
                // Usar más texto del documento (hasta 2000 caracteres para dar contexto completo)
                const contextText = doc.extracted_text.length > 2000 
                  ? doc.extracted_text.substring(0, 2000) + '...'
                  : doc.extracted_text;
                enrichedContext += `${contextText}\n`;
              }
            } else if (doc.snippet && doc.snippet.trim()) {
              enrichedContext += `${doc.snippet}\n`;
            }
          });
          enrichedContext += '\n\nREGLAS ESTRICTAS PARA RESPONDER:\n';
          enrichedContext += '1. Usa SOLO la información de los documentos mostrados arriba.\n';
          enrichedContext += '2. Si los documentos tienen pasos específicos o procedimientos, cita los pasos EXACTOS tal como aparecen.\n';
          enrichedContext += '3. NO inventes pasos o información que no esté en los documentos.\n';
          enrichedContext += '4. Si la pregunta es sobre un procedimiento y está en los documentos, responde con los pasos exactos del documento.\n';
          enrichedContext += '5. Si hay información relevante en los documentos, úsala completa. No omitas detalles importantes.\n';
          enrichedContext += '6. Al final de tu respuesta, menciona que la información proviene de la documentación subida.';
        } else {
          enrichedContext += '\n\n⚠️ No se encontró información relevante en los documentos subidos sobre este tema.';
          enrichedContext += '\nIMPORTANTE: Si no hay información en documentos, debes informar al usuario que no encontraste información sobre ese tema en la documentación disponible.';
        }
      }
      
      // Contexto para productos
      if (functionName === 'search_products' || functionName === 'get_product_by_sku') {
        // Si hay más de 4 resultados, debe preguntar al usuario por más criterios
        // Y NO devolver productos al frontend
        if (functionResult.total && functionResult.total > 4) {
          enrichedContext += '\n\n🚫 CRÍTICO: Has encontrado ' + functionResult.total + ' productos (más de 4). REGLAS ESTRICTAS:\n';
          enrichedContext += '1. NO muestres ningún producto. NO uses tarjetas. NO listes productos.\n';
          enrichedContext += '2. NO devuelvas productos al usuario en esta respuesta.\n';
          enrichedContext += '3. DEBES preguntar al usuario por más criterios específicos para reducir la búsqueda.\n';
          enrichedContext += '4. Ejemplos de preguntas que debes hacer:\n';
          enrichedContext += '   - "He encontrado ' + functionResult.total + ' productos. Para ayudarte mejor, ¿podrías ser más específico?"\n';
          enrichedContext += '   - "¿Tienes el SKU del producto?"\n';
          enrichedContext += '   - "¿Qué categoría o tipo de producto buscas?"\n';
          enrichedContext += '   - "¿Hay algún rango de precio en particular?"\n';
          enrichedContext += '5. SOLO cuando el usuario proporcione más criterios, entonces busca de nuevo y muestra productos (máximo 4).\n';
          
          // Limpiar productos para que NO se muestren en el frontend
          functionResult.products = [];
          if (functionResult.product) {
            functionResult.product = null;
            functionResult.found = false;
          }
        }
        
        // Añadir instrucciones para validación cuando hay múltiples productos
        if (functionResult.products && functionResult.products.length > 1) {
          enrichedContext += '\n\n⚠️ IMPORTANTE: Has encontrado ' + functionResult.products.length + ' productos. REGLAS ESTRICTAS:\n';
          enrichedContext += '1. NO crees listas numeradas (1. **Producto**, etc.)\n';
          enrichedContext += '2. NO menciones precios, descripciones o detalles de productos en el texto\n';
          enrichedContext += '3. Las tarjetas se mostrarán automáticamente con toda la información\n';
          enrichedContext += '4. SOLO escribe un texto introductorio breve (2-3 líneas) que:\n';
          enrichedContext += '   - Presente los productos encontrados de forma general\n';
          enrichedContext += '   - Ofrezca consejos o sugerencias sobre cómo elegir\n';
          enrichedContext += '   - Invite al usuario a hacer preguntas\n';
          enrichedContext += '5. Ejemplo de texto introductorio: "Aquí tienes algunos productos para [categoría] que pueden ser de tu interés. Puedes revisar las tarjetas para ver precios y detalles. ¿Te interesa alguno en particular o necesitas más información?"\n';
          enrichedContext += '6. NO afirmes que tienes un producto específico sin confirmar primero\n';
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
          // Si hay un solo producto, mostrar solo la tarjeta con texto introductorio breve
          enrichedContext += '\n\n⚠️ IMPORTANTE: Muestra SOLO un texto introductorio breve (1-2 líneas) y la tarjeta. NO añadas texto descriptivo adicional ni listas numeradas. El producto ya se mostrará en formato de tarjeta con toda su información.\n';
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

      // Segunda llamada a OpenAI también con timeout
      let secondCompletion;
      try {
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
            setTimeout(() => reject(new Error('OpenAI request timeout')), 20000)
          )
        ]) as any;
      } catch (openaiError) {
        console.error('OpenAI second completion error:', openaiError);
        res.status(500).json({
          success: false,
          error: 'Error al generar respuesta final',
          message: openaiError instanceof Error ? openaiError.message : 'Timeout o error desconocido',
          details: 'Por favor, intenta de nuevo en un momento'
        });
        return;
      }

      const finalMessage = secondCompletion.choices[0].message.content;

      // Determinar fuentes de información
      const sources: string[] = [];
      if (functionName === 'search_products' || functionName === 'get_product_by_sku') {
        sources.push('products_db');
        // Scraping desactivado temporalmente
        // if (enrichedContext) {
        //   sources.push('web');
        // }
      } else if (functionName === 'search_documents') {
        sources.push('documents');
      } else if (functionName === 'search_web_documentation') {
        sources.push('web');
      }

      // Si hay más de 4 resultados, asegurar que NO se envíen productos al frontend
      if (functionResult.total && functionResult.total > 4) {
        functionResult.products = [];
        functionResult.product = null;
        if (functionResult.found !== undefined) {
          functionResult.found = false;
        }
      }

      // Preparar mensaje del asistente con productos y fuentes
      const assistantMessage: any = {
        role: 'assistant',
        content: finalMessage,
        function_calls: [toolCall],
        sources: sources.length > 0 ? sources : ['general']
      };

      // NO añadir productos al mensaje si hay más de 4 resultados
      if (!(functionResult.total && functionResult.total > 4)) {
        // Solo añadir productos si hay productos válidos y no hay más de 4 resultados totales
        if (functionResult.products && functionResult.products.length > 0) {
          assistantMessage.products = functionResult.products;
        } else if (functionResult.product && functionResult.found) {
          assistantMessage.products = [functionResult.product];
        }
      }

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

// Función para buscar productos (optimizada)
async function searchProducts(supabase: any, params: any) {
  // Seleccionar solo campos necesarios (incluyendo imagen)
  let query = supabase
    .from('products')
    .select('id, name, price, category, subcategory, sku, description, image_url, product_url, date_add', { count: 'exact' });

  // Búsqueda por texto (optimizada con índices - incluye description)
  if (params.query && typeof params.query === 'string') {
    const searchTerm = params.query.trim();
    if (searchTerm.length > 0) {
      // Buscar en nombre, descripción y SKU (como antes)
      query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
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

  // Límite máximo de 4 productos - si hay más, debe preguntar al usuario
  const limit = Math.min(params.limit || 4, 4); // Máximo 4 productos
  query = query.limit(limit);

  // Offset
  if (params.offset) {
    query = query.range(params.offset, params.offset + limit - 1);
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Supabase error: ${error.message}`);
  }

  // Ordenar por precio si es necesario (hay que hacerlo localmente)
  let sortedData = data || [];
  if (params.sort_by === 'price_asc' || params.sort_by === 'price_desc') {
    sortedData = sortedData.sort((a: any, b: any) => {
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

// Función para buscar en documentos
async function searchDocuments(supabase: any, params: any) {
  const searchTerm = params.query?.trim() || '';
  const limit = Math.min(params.limit || 5, 10); // Máximo 10 documentos

  if (!searchTerm) {
    return {
      results: [],
      total: 0,
      message: 'No search query provided'
    };
  }

  console.log('Searching documents for:', searchTerm);

  // Buscar en el texto extraído y en el nombre del archivo
  // Dividir el término de búsqueda en palabras para búsqueda más flexible
  const searchWords = searchTerm.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  let query = supabase
    .from('documents')
    .select('id, filename, original_filename, file_type, extracted_text, created_at');

  // Si hay texto extraído, buscar en él. Si no, buscar solo en el nombre del archivo
  if (searchWords.length > 0) {
    // Construir query OR para buscar cada palabra en el texto extraído
    const textConditions = searchWords.map(word => `extracted_text.ilike.%${word}%`).join(',');
    const filenameConditions = searchWords.map(word => `original_filename.ilike.%${word}%`).join(',');
    query = query.or(`${textConditions},${filenameConditions}`);
  } else {
    // Búsqueda simple si es muy corta
    query = query.or(`extracted_text.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`);
  }

  query = query.limit(limit);

  const { data, error } = await query;

  if (error) {
    console.error('Supabase error searching documents:', error);
    return {
      results: [],
      total: 0,
      error: error.message
    };
  }

  console.log('Found documents:', data?.length || 0);

  // Preparar resultados con snippets del texto relevante
  const results = (data || []).map((doc: any) => {
    let snippet = '';
    let relevance = 0;
    let extractedText = doc.extracted_text || '';

    if (extractedText && extractedText.length > 0) {
      const textLower = extractedText.toLowerCase();
      const searchLower = searchTerm.toLowerCase();
      
      // Buscar el término en el texto
      const index = textLower.indexOf(searchLower);
      if (index !== -1) {
        // Encontró el término, extraer snippet alrededor (más contexto)
        const start = Math.max(0, index - 300);
        const end = Math.min(extractedText.length, index + searchTerm.length + 300);
        snippet = extractedText.substring(start, end);
        if (start > 0) snippet = '...' + snippet;
        if (end < extractedText.length) snippet = snippet + '...';
        relevance = 1;
      } else {
        // Buscar palabras individuales
        const foundWords = searchWords.filter(word => textLower.includes(word));
        if (foundWords.length > 0) {
          // Encontrar la primera ocurrencia de cualquier palabra
          let firstIndex = -1;
          for (const word of foundWords) {
            const idx = textLower.indexOf(word);
            if (idx !== -1 && (firstIndex === -1 || idx < firstIndex)) {
              firstIndex = idx;
            }
          }
          if (firstIndex !== -1) {
            const start = Math.max(0, firstIndex - 200);
            const end = Math.min(extractedText.length, firstIndex + 200);
            snippet = extractedText.substring(start, end);
            if (start > 0) snippet = '...' + snippet;
            if (end < extractedText.length) snippet = snippet + '...';
            relevance = 0.8;
          }
        }
        
        // Si aún no hay snippet, usar los primeros caracteres
        if (!snippet && extractedText.length > 0) {
          snippet = extractedText.substring(0, 300);
          if (extractedText.length > 300) snippet += '...';
          relevance = 0.3;
        }
      }
    } else if (doc.original_filename.toLowerCase().includes(searchTerm.toLowerCase())) {
      snippet = `Documento: ${doc.original_filename}`;
      relevance = 0.5;
    }

    return {
      id: doc.id,
      filename: doc.original_filename,
      file_type: doc.file_type,
      snippet: snippet || '',
      extracted_text: extractedText, // Incluir el texto completo para el contexto
      relevance,
      created_at: doc.created_at
    };
  });

  // Ordenar por relevancia (los que tienen el término en el texto primero)
  results.sort((a, b) => b.relevance - a.relevance);

  console.log('Returning results:', results.length, 'with relevance:', results.map(r => r.relevance));

  return {
    results,
    total: results.length,
    query: searchTerm
  };
}


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './utils/embeddings.js';
import OpenAI from 'openai';

type ChatRole = 'user' | 'assistant' | 'system';

interface ChatMessage {
  role: ChatRole;
  content: string;
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  const startTime = Date.now();
  
  try {
    const { message, conversationHistory = [] } = req.body ?? {};
    
    console.log('[chat-rag] Request received:', {
      hasMessage: !!message,
      messageLength: message?.length,
      hasHistory: conversationHistory?.length > 0,
    });
    
    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid message',
        details: 'El campo message es obligatorio y debe ser un texto.',
      });
      return;
    }

    // Verificar configuración
    if (!process.env.OPENAI_API_KEY) {
      console.error('[chat-rag] OPENAI_API_KEY missing');
      res.status(500).json({
        success: false,
        error: 'OpenAI configuration missing',
        details: 'Asegúrate de configurar OPENAI_API_KEY.',
      });
      return;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      console.error('[chat-rag] Supabase configuration missing');
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        details: 'Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.',
      });
      return;
    }

    console.log('[chat-rag] Configuration verified');

    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );

    // Verificar si hay productos indexados antes de intentar usar RAG
    let hasIndexedProducts = false;
    try {
      console.log('[chat-rag] Checking for indexed products...');
      const { count, error: countError } = await supabase
        .from('product_embeddings')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      
      if (countError) {
        console.warn('[chat-rag] Error checking products:', countError);
      } else {
        hasIndexedProducts = (count || 0) > 0;
        console.log('[chat-rag] Indexed products count:', count);
      }
    } catch (checkError) {
      console.error('[chat-rag] Exception checking for indexed products:', checkError);
      // Continuar de todas formas
    }

    if (!hasIndexedProducts) {
      console.log('[chat-rag] No indexed products found, returning early');
      res.status(200).json({
        success: true,
        message: 'Lo siento, el sistema de búsqueda semántica aún no está disponible. Por favor, indexa algunos productos primero usando el endpoint /api/index-products-rag',
        conversation_history: [
          ...conversationHistory.filter((m: any) => m.role !== 'system'),
          { role: 'user', content: message },
          { 
            role: 'assistant', 
            content: 'Lo siento, el sistema de búsqueda semántica aún no está disponible. Por favor, indexa algunos productos primero usando el endpoint /api/index-products-rag'
          },
        ],
        products: undefined,
        sources: undefined,
        timings: {
          total_ms: Date.now() - startTime,
          steps: [],
        },
      });
      return;
    }

    // PRIMERO: Búsqueda exacta por nombre (más confiable para nombres de productos)
    console.log('[chat-rag] Starting search - exact name first...');
    const searchTerm = message.trim();
    const normalizedSearch = searchTerm.toLowerCase().trim();
    
    // Extraer posibles nombres de productos de la pregunta
    // Buscar patrones como "Plato Volcanic Terra", "producto X", etc.
    // Intentar extraer nombres de productos comunes (palabras con mayúsculas o entre comillas)
    let productNameToSearch = normalizedSearch;
    
    // Si la pregunta contiene un nombre de producto con mayúsculas o formato específico
    const productNameMatch = message.match(/([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)+)/);
    if (productNameMatch) {
      productNameToSearch = productNameMatch[1].toLowerCase();
      console.log('[chat-rag] Extracted product name from question:', productNameToSearch);
    } else {
      // Intentar extraer palabras clave relevantes (excluir palabras comunes de preguntas)
      const questionWords = ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'es', 'son', 'sirve', 'sirven', 'para', 'con', 'de', 'del', 'en', 'se', 'puede', 'pueden', 'qué', 'cuál', 'cuáles', 'cómo', 'dónde', 'cuándo', 'por', 'qué', 'microondas', 'horno', 'apto', 'apta', 'aptos', 'aptas'];
      const words = normalizedSearch.split(/\s+/).filter(w => w.length > 2 && !questionWords.includes(w));
      if (words.length > 0) {
        // Tomar las primeras 2-4 palabras que parecen ser el nombre del producto
        productNameToSearch = words.slice(0, 4).join(' ');
        console.log('[chat-rag] Extracted keywords from question:', productNameToSearch);
      }
    }
    
    let exactMatchProducts: any[] = [];
    const productIds = new Set<number>();
    const chunksText: string[] = [];
    
    // 1. Búsqueda exacta por nombre completo (usando el nombre extraído)
    if (productNameToSearch.length > 0) {
      console.log('[chat-rag] Searching exact name:', productNameToSearch);
      const { data: exactResults, error: exactError } = await supabase
        .from('products')
        .select('id, name, description, category, subcategory, sku, price, image_url, product_url')
        .ilike('name', `%${productNameToSearch}%`)
        .limit(10);
      
      if (!exactError && exactResults && exactResults.length > 0) {
        console.log(`[chat-rag] Found ${exactResults.length} products by exact name match`);
        exactResults.forEach(p => {
          console.log(`[chat-rag] Found product: ${p.name} (ID: ${p.id}), description length: ${p.description?.length || 0}`);
        });
        exactMatchProducts = exactResults;
      } else {
        console.log('[chat-rag] No products found with exact name search');
        if (exactError) {
          console.error('[chat-rag] Error in exact name search:', exactError);
        }
      }
    }
    
    // 2. Si no encontramos, buscar por palabras clave individuales
    if (exactMatchProducts.length === 0 && normalizedSearch.length > 0) {
      const keywords = normalizedSearch
        .split(/\s+/)
        .filter(word => word.length > 2)
        .slice(0, 3); // Máximo 3 palabras clave
      
      console.log('[chat-rag] Trying keyword search:', keywords);
      
      for (const keyword of keywords) {
        const { data: keywordResults, error: keywordError } = await supabase
          .from('products')
          .select('id, name, description, category, subcategory, sku, price, image_url, product_url')
          .ilike('name', `%${keyword}%`)
          .limit(10);
        
        if (!keywordError && keywordResults) {
          keywordResults.forEach(p => {
            if (!exactMatchProducts.find(existing => existing.id === p.id)) {
              exactMatchProducts.push(p);
            }
          });
        }
      }
    }
    
    // 3. Si encontramos productos exactos, usarlos directamente
    if (exactMatchProducts.length > 0) {
      console.log(`[chat-rag] Using ${exactMatchProducts.length} exact match products`);
      for (const product of exactMatchProducts) {
        productIds.add(product.id);
        
        let productChunk = product.name || '';
        if (product.category) {
          productChunk += ` - ${product.category}`;
        }
        if (product.subcategory) {
          productChunk += ` - ${product.subcategory}`;
        }
        if (product.description) {
          // Asegurarse de incluir la descripción completa
          const cleanDescription = product.description.replace(/<[^>]*>/g, '').trim();
          if (cleanDescription.length > 0) {
            productChunk += `. ${cleanDescription}`;
            console.log(`[chat-rag] Added description for ${product.name}: ${cleanDescription.substring(0, 100)}...`);
          } else {
            console.warn(`[chat-rag] Product ${product.name} has empty or invalid description`);
          }
        } else {
          console.warn(`[chat-rag] Product ${product.name} (ID: ${product.id}) has no description field`);
        }
        
        if (productChunk.trim().length > 0) {
          chunksText.push(productChunk.trim());
          console.log(`[chat-rag] Added chunk for product ${product.name}, total length: ${productChunk.length}`);
        }
      }
    } else {
      console.warn('[chat-rag] No exact match products found - will rely on semantic search only');
    }
    
    // 4. ADEMÁS: Búsqueda semántica para complementar (siempre ejecutar)
    console.log('[chat-rag] Also searching semantically...');
    
    // Si encontramos productos por nombre exacto, hacer búsqueda semántica adicional con palabras clave específicas
    // Esto ayuda a encontrar chunks con información detallada sobre características específicas
    let enhancedQuery = message;
    if (exactMatchProducts.length > 0 && productIds.size > 0) {
      // Extraer palabras clave de la pregunta (palabras de 4+ caracteres que no sean comunes)
      const stopWords = ['para', 'sobre', 'tiene', 'puede', 'cual', 'cuales', 'como', 'donde', 'cuando'];
      const queryWords = message.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 4 && !stopWords.includes(w));
      
      if (queryWords.length > 0) {
        // Crear query mejorada con nombre del producto + palabras clave
        const productNames = exactMatchProducts.map(p => p.name).join(' ');
        enhancedQuery = `${productNames} ${queryWords.join(' ')}`;
        console.log(`[chat-rag] Enhanced query for semantic search: "${enhancedQuery}"`);
      }
    }
    
    const queryEmbedding = await generateEmbedding(enhancedQuery);
    
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'search_similar_chunks',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.4, // Reducido de 0.5 a 0.4 para capturar más información relevante
        match_count: 15, // Aumentado de 10 a 15 para incluir más chunks potencialmente relevantes
      }
    );

    if (!searchError && similarChunks && similarChunks.length > 0) {
      console.log('[chat-rag] Found semantic chunks:', similarChunks.length);
      
      // IMPORTANTE: Añadir chunks semánticos incluso si el producto ya fue encontrado por búsqueda exacta
      // Esto asegura que incluimos información detallada de chunks indexados que pueden tener más detalles
      // Los chunks indexados pueden tener información más específica que la descripción completa del producto
      similarChunks.forEach((chunk: any) => {
        // Añadir product_id si no está ya en la lista
        if (chunk.product_id && !productIds.has(chunk.product_id)) {
          productIds.add(chunk.product_id);
        }
        
        // Añadir chunk si tiene contenido
        if (chunk.content && chunk.content.trim().length > 0) {
          // Verificar si el contenido es EXACTAMENTE igual (solo evitar duplicados exactos)
          // NO evitar chunks similares porque pueden tener información complementaria
          const isExactDuplicate = chunksText.some(existing => {
            // Solo considerar duplicado si es EXACTAMENTE igual (ignorando espacios al inicio/final)
            return existing.trim() === chunk.content.trim();
          });
          
          if (!isExactDuplicate) {
            chunksText.push(chunk.content.trim());
            console.log(`[chat-rag] ✅ Added semantic chunk for product ${chunk.product_id}: ${chunk.content.substring(0, 150)}...`);
            // Log adicional si contiene palabras clave relevantes
            const lowerContent = chunk.content.toLowerCase();
            const lowerQuery = message.toLowerCase();
            const queryWords = lowerQuery.split(/\s+/).filter(w => w.length > 3);
            const hasRelevantKeywords = queryWords.some(word => lowerContent.includes(word));
            if (hasRelevantKeywords) {
              console.log(`[chat-rag] ⚠️ Chunk contains relevant keywords from query!`);
            }
          } else {
            console.log(`[chat-rag] ⏭️ Skipped exact duplicate chunk for product ${chunk.product_id}`);
          }
        }
      });
    }

    console.log(`[chat-rag] Total products found: ${productIds.size}, chunks: ${chunksText.length}`);
    
    // Log detallado del contexto para debugging
    if (chunksText.length > 0) {
      console.log(`[chat-rag] 📋 Context summary:`);
      chunksText.forEach((chunk, idx) => {
        const preview = chunk.substring(0, 200);
        const hasKeywords = message.toLowerCase().split(/\s+/).some(word => 
          word.length > 3 && chunk.toLowerCase().includes(word.toLowerCase())
        );
        console.log(`[chat-rag]   Chunk ${idx + 1} (${chunk.length} chars)${hasKeywords ? ' ⭐ HAS KEYWORDS' : ''}: ${preview}...`);
      });
    }

    // Obtener documentos asociados a productos ANTES de generar la respuesta
    let documentsText: string[] = [];
    if (productIds.size > 0) {
      try {
        const productIdsArray = Array.from(productIds);
        console.log(`[chat-rag] Fetching documents for ${productIdsArray.length} products:`, productIdsArray);
        
        // Obtener TODOS los documentos asociados (incluso sin extracted_text para debugging)
        const { data: allDocumentsData, error: allDocsError } = await supabase
          .from('documents')
          .select('id, original_filename, extracted_text, product_id, has_extracted_text')
          .in('product_id', productIdsArray);
        
        if (allDocsError) {
          console.warn('[chat-rag] Error obteniendo documentos:', allDocsError);
        } else {
          console.log(`[chat-rag] Found ${allDocumentsData?.length || 0} total documents for these products`);
          
          if (allDocumentsData && allDocumentsData.length > 0) {
            // Log para debugging
            allDocumentsData.forEach((doc: any) => {
              console.log(`[chat-rag] Document ID ${doc.id}: product_id=${doc.product_id}, filename=${doc.original_filename}, has_text=${!!doc.extracted_text}, text_length=${doc.extracted_text?.length || 0}`);
            });
            
            // Filtrar solo documentos con texto extraído
            const documentsWithText = allDocumentsData.filter((doc: any) => 
              doc.product_id && 
              doc.extracted_text && 
              typeof doc.extracted_text === 'string' &&
              doc.extracted_text.trim().length > 0
            );
            
            console.log(`[chat-rag] ${documentsWithText.length} documents have extracted text`);
            
            if (documentsWithText.length > 0) {
              // Agrupar documentos por producto para mejor contexto
              const docsByProduct: Record<number, string[]> = {};
              
              documentsWithText.forEach((doc: any) => {
                if (!docsByProduct[doc.product_id]) {
                  docsByProduct[doc.product_id] = [];
                }
                const docInfo = `[Documento: ${doc.original_filename || 'Sin nombre'}]\n${doc.extracted_text}`;
                docsByProduct[doc.product_id].push(docInfo);
              });
              
              // Agregar texto de documentos al contexto
              for (const [productId, docTexts] of Object.entries(docsByProduct)) {
                if (docTexts.length > 0) {
                  const productIdNum = parseInt(productId);
                  documentsText.push(`\n--- Documentación del producto (ID: ${productIdNum}) ---\n${docTexts.join('\n\n')}`);
                  console.log(`[chat-rag] Added ${docTexts.length} document(s) for product ID ${productIdNum}`);
                }
              }
            } else {
              console.warn('[chat-rag] No documents with extracted text found. Documents may need to be re-uploaded to extract text.');
            }
          } else {
            console.log('[chat-rag] No documents found for these products');
          }
        }
      } catch (docError) {
        console.error('[chat-rag] Error obteniendo documentos:', docError);
        // Continuar sin documentos si falla
      }
    } else {
      console.log('[chat-rag] No product IDs found, skipping document fetch');
    }

    // Generar respuesta con OpenAI
    console.log('[chat-rag] Generating response with OpenAI...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    // Combinar contexto de productos y documentos
    const allContextParts: string[] = [];
    
    if (chunksText.length > 0) {
      allContextParts.push('--- Información del catálogo de productos ---');
      allContextParts.push(chunksText.join('\n\n'));
    }
    
    if (documentsText.length > 0) {
      allContextParts.push('\n--- Documentación adicional de productos ---');
      allContextParts.push(documentsText.join('\n\n'));
    }
    
    const contextText = allContextParts.length > 0
      ? allContextParts.join('\n\n')
      : 'No se encontraron productos relevantes en el catálogo.';

    const systemPrompt = `Eres ChefCopilot, un asistente experto en cocina profesional y productos de cocina.

REGLAS ESTRICTAS Y CRÍTICAS:
1. SOLO puedes responder usando EXACTAMENTE la información proporcionada en el contexto del catálogo.
2. NUNCA inventes, asumas o deduzcas información que no esté EXPLÍCITAMENTE escrita en el contexto.
3. NUNCA contradigas la información del contexto. Si el contexto dice "aptas para microondas", NO digas que no se pueden usar en microondas.
4. Si el contexto menciona características específicas (ej: "aptas para microondas, horno, salamandra"), repite EXACTAMENTE esas características sin modificarlas ni negarlas.
5. Si no encuentras información específica en el contexto sobre una característica, di claramente: "No encontré información sobre [característica específica] en la descripción del producto."
6. NUNCA uses conocimiento general o información que no esté en el contexto proporcionado.

INSTRUCCIONES DE RESPUESTA:
- Lee cuidadosamente TODO el contexto antes de responder. El contexto puede tener múltiples chunks del mismo producto con información complementaria.
- BUSCA ACTIVAMENTE en TODOS los chunks del contexto. Si un producto aparece en varios chunks, revisa TODOS para encontrar la información completa.
- Si el contexto dice que un producto es "apto para X" en CUALQUIER parte del contexto, confirma que es apto para X.
- Si el contexto menciona múltiples características (incluso en diferentes chunks), menciona TODAS las que sean relevantes a la pregunta.
- Responde en español de forma clara, usando EXACTAMENTE las palabras y frases del contexto cuando sea posible.
- Si encuentras información sobre la pregunta en CUALQUIER chunk del contexto, úsala para responder.
- Si hay información contradictoria en el contexto, menciona ambas pero indica la fuente más relevante.
- SIEMPRE incluye citas de fuentes al final usando el formato [Fuente: Producto: Nombre]

IMPORTANTE: Tu respuesta DEBE reflejar fielmente lo que dice el contexto. No interpretes, no asumas, no deduzcas. Solo repite y organiza la información que está explícitamente escrita. Si después de revisar TODO el contexto no encuentras la información específica, di claramente que no la encontraste.`;

    // Log del contexto completo para debugging (útil para detectar problemas)
    console.log('[chat-rag] Full context length:', contextText.length);
    console.log('[chat-rag] Context preview (first 2000 chars):', contextText.substring(0, 2000));
    
    // Verificar si el contexto contiene información relevante sobre la pregunta
    const lowerContext = contextText.toLowerCase();
    const lowerMessage = message.toLowerCase();
    
    // Extraer palabras clave de la pregunta
    const questionKeywords = lowerMessage
      .split(/\s+/)
      .filter(w => w.length > 3 && !['para', 'con', 'del', 'las', 'los', 'una', 'uno'].includes(w));
    
    console.log('[chat-rag] Question keywords:', questionKeywords);
    
    // Verificar si el contexto contiene las palabras clave
    const foundKeywords = questionKeywords.filter(kw => lowerContext.includes(kw));
    console.log('[chat-rag] Keywords found in context:', foundKeywords);
    console.log('[chat-rag] Keywords NOT found in context:', questionKeywords.filter(kw => !lowerContext.includes(kw)));
    
    // Verificación específica para microondas
    if (lowerMessage.includes('microondas') || lowerMessage.includes('microonda')) {
      console.log('[chat-rag] ⚠️ Question is about microondas - checking context...');
      if (lowerContext.includes('microondas')) {
        console.log('[chat-rag] ✅ Context DOES contain "microondas"');
        const microondasMatches = contextText.match(/[^.]*microondas[^.]*\./gi);
        if (microondasMatches) {
          console.log('[chat-rag] Found microondas mentions in context:', microondasMatches.slice(0, 5));
        }
      } else {
        console.error('[chat-rag] ❌ Context DOES NOT contain "microondas" - this is a problem!');
        console.log('[chat-rag] Available chunks:', chunksText.length);
        chunksText.forEach((chunk, idx) => {
          console.log(`[chat-rag] Chunk ${idx + 1} (${chunk.length} chars):`, chunk.substring(0, 200));
        });
      }
    }
    
    // Verificar si el producto específico está en el contexto
    if (lowerMessage.includes('volcanic') || lowerMessage.includes('plato volcanic')) {
      console.log('[chat-rag] ⚠️ Question is about Volcanic - checking context...');
      if (lowerContext.includes('volcanic')) {
        console.log('[chat-rag] ✅ Context DOES contain "volcanic"');
        const volcanicMatches = contextText.match(/[^.]*volcanic[^.]*\./gi);
        if (volcanicMatches) {
          console.log('[chat-rag] Found volcanic mentions:', volcanicMatches.slice(0, 3));
        }
      } else {
        console.error('[chat-rag] ❌ Context DOES NOT contain "volcanic" - product not found!');
      }
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o', // Actualizado a GPT-4o para mejor calidad y razonamiento
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.filter((m: any) => m.role !== 'system').slice(-5),
        {
          role: 'user',
          content: `Contexto del catálogo (usa SOLO esta información):\n${contextText}\n\nPregunta del usuario: ${message}\n\nINSTRUCCIONES CRÍTICAS:
1. REVISA CADA CHUNK INDIVIDUALMENTE. El contexto tiene ${chunksText.length} chunks. Lee TODOS antes de responder.

2. BUSCA PALABRAS CLAVE ESPECÍFICAS. Si la pregunta menciona "microondas", busca esa palabra en TODOS los chunks. Si menciona "apto para", busca esa frase en TODOS los chunks.

3. NO TE DETENGAS EN EL PRIMER CHUNK. Si el primer chunk no tiene la información, sigue buscando en los demás chunks. Cada chunk puede tener información diferente.

4. SI ENCUENTRAS LA INFORMACIÓN EN CUALQUIER CHUNK, úsala para responder inmediatamente. No digas "no encontré información" si la información está en algún chunk del contexto.

5. SI LA PREGUNTA ES SOBRE UNA CARACTERÍSTICA ESPECÍFICA (ej: "apto para microondas"), busca esa característica en TODOS los chunks del producto mencionado.

6. SIEMPRE incluye citas de fuentes al final usando [Fuente: Producto: Nombre del Producto].

7. SOLO di "No encontré información" si después de revisar TODOS los ${chunksText.length} chunks del contexto, realmente no encuentras ninguna mención de la característica preguntada.`,
        },
      ],
      temperature: 0.2, // Reducido a 0.2 para GPT-4o (más preciso que GPT-3.5)
      max_tokens: 1000, // Aumentado para permitir respuestas más completas con citas
    });

    const assistantResponse = completion.choices[0]?.message?.content || 'Lo siento, no pude generar una respuesta.';
    console.log('[chat-rag] Response generated successfully');

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Obtener información completa de productos si hay alguno
    let products: any[] = [];
    if (productIds.size > 0) {
      try {
        const supabase = createClient(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_ANON_KEY!
        );
        
        const queryPromise = supabase
          .from('products')
          .select('*')
          .in('id', Array.from(productIds));
        
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout obteniendo productos (5s)')), 5000)
        );
        
        const { data, error } = await Promise.race([
          queryPromise,
          timeoutPromise
        ]) as any;
        
        if (error) {
          console.warn('[chat-rag] Error obteniendo productos:', error);
        } else {
          products = data || [];
        }
      } catch (productError) {
        console.warn('[chat-rag] Error obteniendo productos:', productError);
        // Continuar sin productos si falla
      }
    }

    // Construir respuesta
    const assistantMessage: ChatMessage = {
      role: 'assistant',
      content: assistantResponse,
    };

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory.filter((m: any) => m.role !== 'system'),
      { role: 'user', content: message },
      assistantMessage,
    ];

    // Formatear productos para compatibilidad con el frontend
    const formattedProducts = products.map((p: any) => ({
      id: p.id,
      name: p.name || '',
      price: p.price || '',
      category: p.category || '',
      subcategory: p.subcategory || null,
      description: p.description || '',
      sku: p.sku || '',
      image: p.image_url || p.image || '',
      product_url: p.product_url || '',
      date_add: p.date_add || null,
      colors: p.colors || null,
      all_categories: p.all_categories || null,
    }));

    // Construir respuesta compatible con el formato esperado por el frontend
    const lastMessage: any = updatedHistory[updatedHistory.length - 1];
    if (lastMessage && formattedProducts.length > 0) {
      lastMessage.products = formattedProducts;
      lastMessage.sources = similarChunks && similarChunks.length > 0 ? ['products_db'] : undefined;
      lastMessage.response_timings = {
        total_ms: totalTime,
        steps: [
          { name: 'Vector Search', duration_ms: totalTime * 0.3 },
          { name: 'LLM Generation', duration_ms: totalTime * 0.7 },
        ],
      };
    }

    // Guardar conversación en la base de datos y obtener el ID
    const sessionId = req.body?.session_id || `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    let conversationId: string | null = null;
    
    try {
      console.log('[chat-rag] Intentando guardar conversación...', {
        sessionId,
        hasProducts: formattedProducts.length > 0,
        responseLength: assistantResponse.length
      });
      
      const { data: conversationData, error: conversationError } = await supabase
        .from('chat_conversations')
        .insert({
          session_id: sessionId,
          user_message: message,
          bot_response: assistantResponse,
          function_called: 'rag_search',
          products_consulted: formattedProducts.length > 0 ? formattedProducts.map(p => ({
            name: p.name,
            category: p.category,
            sku: p.sku,
            id: p.id
          })) : null,
          category_consulted: formattedProducts.length > 0 && formattedProducts[0]?.category ? formattedProducts[0].category : null,
          model_used: 'gpt-4o', // Actualizado para reflejar el cambio real
          response_time_ms: totalTime,
          tokens_used: completion.usage?.total_tokens || null,
        })
        .select('id')
        .single();
      
      if (conversationError) {
        console.error('[chat-rag] Error guardando conversación:', {
          error: conversationError,
          code: conversationError.code,
          message: conversationError.message,
          details: conversationError.details
        });
      } else if (conversationData) {
        conversationId = conversationData.id;
        console.log('[chat-rag] Conversación guardada exitosamente, ID:', conversationId);
      } else {
        console.warn('[chat-rag] No se recibió data ni error al guardar conversación');
      }
    } catch (err) {
      console.error('[chat-rag] Excepción al guardar conversación:', err);
    }

    // Construir fuentes detalladas para mejor citación
    const detailedSources = formattedProducts.length > 0 ? formattedProducts.map(p => ({
      type: 'product' as const,
      id: p.id,
      name: p.name,
      url: p.product_url || undefined,
      category: p.category || undefined,
    })) : undefined;

    const responsePayload = {
      success: true,
      message: assistantResponse,
      conversation_history: updatedHistory,
      conversation_id: conversationId,
      products: formattedProducts.length > 0 ? formattedProducts : undefined,
      function_result: formattedProducts.length > 0 ? {
        products: formattedProducts,
      } : undefined,
      sources: detailedSources || (similarChunks && similarChunks.length > 0 ? ['products_db'] : undefined),
      sources_detail: detailedSources, // Nuevo campo con información detallada de fuentes
      timings: {
        total_ms: totalTime,
        steps: [
          { name: 'Vector Search', duration_ms: totalTime * 0.3 },
          { name: 'LLM Generation', duration_ms: totalTime * 0.7 },
        ],
      },
    };

    console.log('[chat-rag] Enviando respuesta con conversation_id:', {
      conversation_id: conversationId,
      hasConversationId: !!conversationId
    });

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[chat-rag] Unhandled error:', {
      error,
      errorType: error?.constructor?.name,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
      duration: Date.now() - startTime,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack 
      ? error.stack.split('\n').slice(0, 5).join('\n') 
      : errorMessage;

    res.status(500).json({
      success: false,
      error: `RAG chat failed: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorDetails : 'Error interno del servidor. Por favor, intenta de nuevo.',
      timestamp: new Date().toISOString(),
    });
  }
}


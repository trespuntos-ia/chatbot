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

    // Búsqueda vectorial directa (sin LangChain para simplificar)
    console.log('[chat-rag] Generating query embedding...');
    const queryEmbedding = await generateEmbedding(message);

    console.log('[chat-rag] Searching similar chunks...');
    // Reducir threshold y aumentar resultados para mejor cobertura
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'search_similar_chunks',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.5, // Reducido de 0.7 a 0.5 para encontrar más resultados
        match_count: 10, // Aumentado de 5 a 10 para mejor cobertura
      }
    );

    if (searchError) {
      console.error('[chat-rag] Search error:', searchError);
      throw new Error(`Search error: ${searchError.message}`);
    }

    console.log('[chat-rag] Found chunks:', similarChunks?.length || 0);

    // Extraer productos mencionados en el contexto
    const productIds = new Set<number>();
    const chunksText: string[] = [];
    
    if (similarChunks && similarChunks.length > 0) {
      similarChunks.forEach((chunk: any) => {
        if (chunk.product_id) {
          productIds.add(chunk.product_id);
        }
        if (chunk.content) {
          chunksText.push(chunk.content);
        }
      });
    }

    // Si no encontramos resultados con búsqueda semántica, intentar búsqueda exacta por nombre
    if (productIds.size === 0 && message.trim().length > 0) {
      console.log('[chat-rag] No semantic results found, trying exact name search...');
      const searchTerm = message.trim().toLowerCase();
      
      // Buscar productos por nombre (búsqueda parcial case-insensitive)
      const { data: exactMatchProducts, error: exactError } = await supabase
        .from('products')
        .select('id, name, description, category, subcategory')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);
      
      if (!exactError && exactMatchProducts && exactMatchProducts.length > 0) {
        console.log(`[chat-rag] Found ${exactMatchProducts.length} products by exact name match`);
        
        // Obtener chunks de estos productos
        for (const product of exactMatchProducts) {
          productIds.add(product.id);
          
          // Crear chunk con nombre y descripción
          let productChunk = product.name || '';
          if (product.category) {
            productChunk += ` - ${product.category}`;
          }
          if (product.subcategory) {
            productChunk += ` - ${product.subcategory}`;
          }
          if (product.description) {
            productChunk += `. ${product.description}`;
          }
          
          if (productChunk.trim().length > 0) {
            chunksText.push(productChunk.trim());
          }
        }
      }
    }

    // Generar respuesta con OpenAI
    console.log('[chat-rag] Generating response with OpenAI...');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY!,
    });

    const contextText = chunksText.length > 0
      ? chunksText.join('\n\n')
      : 'No se encontraron productos relevantes en el catálogo.';

    const systemPrompt = `Eres ChefCopilot, un asistente experto en cocina profesional y productos de cocina.

REGLAS ESTRICTAS:
1. SOLO puedes responder usando la información proporcionada en el contexto del catálogo.
2. NUNCA inventes información, precios, características o productos que no estén en el contexto.
3. NUNCA busques información en internet o fuera de la base de datos.
4. Si no encuentras información en el contexto, di claramente: "No encontré información sobre [tema] en nuestro catálogo actual."
5. Si el usuario pregunta sobre un producto específico y no está en el contexto, sugiere que revise el catálogo completo o reformule la búsqueda.

Responde en español de forma clara y útil.
Si hay información de productos en el contexto, preséntalos de forma organizada con sus características exactas.
Si no hay productos relevantes, sé honesto y di que no encontraste información en el catálogo.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.filter((m: any) => m.role !== 'system').slice(-5),
        {
          role: 'user',
          content: `Contexto del catálogo:\n${contextText}\n\nPregunta del usuario: ${message}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 800,
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

    res.status(200).json({
      success: true,
      message: assistantResponse,
      conversation_history: updatedHistory,
      products: formattedProducts.length > 0 ? formattedProducts : undefined,
      function_result: formattedProducts.length > 0 ? {
        products: formattedProducts,
      } : undefined,
      sources: similarChunks && similarChunks.length > 0 ? ['products_db'] : undefined,
      timings: {
        total_ms: totalTime,
        steps: [
          { name: 'Vector Search', duration_ms: totalTime * 0.3 },
          { name: 'LLM Generation', duration_ms: totalTime * 0.7 },
        ],
      },
    });
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


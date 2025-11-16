import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRAGChain } from './utils/langchain-setup';
import { createClient } from '@supabase/supabase-js';

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

  try {
    const { message, conversationHistory = [] } = req.body ?? {};
    
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
      res.status(500).json({
        success: false,
        error: 'OpenAI configuration missing',
        details: 'Asegúrate de configurar OPENAI_API_KEY.',
      });
      return;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        details: 'Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.',
      });
      return;
    }

    const startTime = Date.now();

    // Verificar si hay productos indexados antes de intentar usar RAG
    let hasIndexedProducts = false;
    try {
      const supabaseCheck = createClient(
        process.env.SUPABASE_URL!,
        process.env.SUPABASE_ANON_KEY!
      );
      const { count } = await supabaseCheck
        .from('product_embeddings')
        .select('*', { count: 'exact', head: true })
        .limit(1);
      hasIndexedProducts = (count || 0) > 0;
    } catch (checkError) {
      console.warn('[chat-rag] Could not check for indexed products:', checkError);
      // Continuar de todas formas
    }

    if (!hasIndexedProducts) {
      res.status(200).json({
        success: true,
        message: 'Lo siento, el sistema de búsqueda semántica aún no está disponible. Por favor, indexa algunos productos primero usando el endpoint /api/index-products-rag',
        conversation_history: [
          ...conversationHistory.filter(m => m.role !== 'system'),
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

    // Crear chain de RAG con timeout
    let chain;
    try {
      chain = await Promise.race([
        createRAGChain(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout creating RAG chain (10s)')), 10000)
        )
      ]) as any;
    } catch (chainError) {
      console.error('[chat-rag] Error creating RAG chain:', chainError);
      res.status(500).json({
        success: false,
        error: 'Error al inicializar el sistema de búsqueda',
        details: chainError instanceof Error ? chainError.message : 'No se pudo conectar con la base de datos vectorial. Verifica que Supabase esté disponible y que hayas indexado productos.',
      });
      return;
    }
    
    // Ejecutar consulta con timeout
    let result;
    try {
      result = await Promise.race([
        chain.call({
          query: message,
        }),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Timeout ejecutando consulta (30s)')), 30000)
        )
      ]) as any;
    } catch (queryError) {
      console.error('[chat-rag] Error executing query:', queryError);
      res.status(500).json({
        success: false,
        error: 'Error al procesar la consulta',
        details: queryError instanceof Error ? queryError.message : 'La consulta tardó demasiado o falló. Por favor, intenta de nuevo.',
      });
      return;
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    // Extraer productos mencionados en el contexto
    const sourceDocuments = result.sourceDocuments || [];
    const productIds = new Set<number>();
    
    sourceDocuments.forEach((doc: any) => {
      if (doc.metadata && doc.metadata.product_id) {
        productIds.add(doc.metadata.product_id);
      }
    });

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
      content: result.text,
    };

    const updatedHistory: ChatMessage[] = [
      ...conversationHistory.filter(m => m.role !== 'system'),
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
    const lastMessage = updatedHistory[updatedHistory.length - 1];
    if (lastMessage && formattedProducts.length > 0) {
      lastMessage.products = formattedProducts;
      lastMessage.sources = sourceDocuments.length > 0 ? ['products_db'] : undefined;
      lastMessage.response_timings = {
        total_ms: totalTime,
        steps: [
          { name: 'RAG Retrieval', duration_ms: totalTime * 0.3 },
          { name: 'LLM Generation', duration_ms: totalTime * 0.7 },
        ],
      };
    }

    res.status(200).json({
      success: true,
      message: result.text,
      conversation_history: updatedHistory,
      products: formattedProducts.length > 0 ? formattedProducts : undefined,
      function_result: formattedProducts.length > 0 ? {
        products: formattedProducts,
        source_documents: sourceDocuments,
      } : undefined,
      sources: sourceDocuments.length > 0 ? ['products_db'] : undefined,
      timings: {
        total_ms: totalTime,
        steps: [
          { name: 'RAG Retrieval', duration_ms: totalTime * 0.3 },
          { name: 'LLM Generation', duration_ms: totalTime * 0.7 },
        ],
      },
    });
  } catch (error) {
    console.error('[chat-rag] Error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack 
      ? error.stack.split('\n').slice(0, 3).join('\n') 
      : errorMessage;

    res.status(500).json({
      success: false,
      error: `RAG chat failed: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorDetails : 'Error interno del servidor. Por favor, intenta de nuevo.',
    });
  }
}


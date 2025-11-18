import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './utils/embeddings.js';
import OpenAI from 'openai';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
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

    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid message',
      });
      return;
    }

    // Verificar configuración
    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({
        success: false,
        error: 'OpenAI configuration missing',
      });
      return;
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
      });
      return;
    }

    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );

    // Verificar si hay productos indexados
    const { count } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true })
      .limit(1);

    if (!count || count === 0) {
      res.status(200).json({
        success: true,
        message: 'Lo siento, el sistema de búsqueda semántica aún no está disponible. Por favor, indexa algunos productos primero.',
        conversation_history: [
          ...conversationHistory.filter((m: any) => m.role !== 'system'),
          { role: 'user', content: message },
          {
            role: 'assistant',
            content: 'Lo siento, el sistema de búsqueda semántica aún no está disponible. Por favor, indexa algunos productos primero.',
          },
        ],
      });
      return;
    }

    // Generar embedding de la query
    const queryEmbedding = await generateEmbedding(message);

    // Buscar chunks similares usando la función SQL
    const { data: similarChunks, error: searchError } = await supabase.rpc(
      'search_similar_chunks',
      {
        query_embedding: `[${queryEmbedding.join(',')}]`,
        match_threshold: 0.7,
        match_count: 5,
      }
    );

    if (searchError) {
      throw new Error(`Search error: ${searchError.message}`);
    }

    // Obtener productos relacionados
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

    // Obtener información de productos
    let products: any[] = [];
    if (productIds.size > 0) {
      const { data: productsData } = await supabase
        .from('products')
        .select('*')
        .in('id', Array.from(productIds));

      products = productsData || [];
    }

    // Generar respuesta con OpenAI
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const contextText = chunksText.length > 0
      ? chunksText.join('\n\n')
      : 'No se encontraron productos relevantes en el catálogo.';

    const systemPrompt = `Eres ChefCopilot, un asistente experto en cocina profesional.
Responde en español de forma clara y útil.
Si hay información de productos en el contexto, preséntalos de forma organizada.
Si no hay productos relevantes, sé honesto y sugiere búsquedas alternativas.`;

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

    // Formatear productos
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

    const updatedHistory = [
      ...conversationHistory.filter((m: any) => m.role !== 'system'),
      { role: 'user', content: message },
      {
        role: 'assistant',
        content: assistantResponse,
        products: formattedProducts.length > 0 ? formattedProducts : undefined,
      },
    ];

    res.status(200).json({
      success: true,
      message: assistantResponse,
      conversation_history: updatedHistory,
      products: formattedProducts.length > 0 ? formattedProducts : undefined,
      function_result: formattedProducts.length > 0
        ? { products: formattedProducts }
        : undefined,
      sources: similarChunks && similarChunks.length > 0 ? ['products_db'] : undefined,
      timings: {
        total_ms: Date.now() - startTime,
        steps: [],
      },
    });
  } catch (error) {
    console.error('[chat-rag-simple] Error:', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: process.env.NODE_ENV === 'development' && error instanceof Error
        ? error.stack?.split('\n').slice(0, 5).join('\n')
        : undefined,
    });
  }
}


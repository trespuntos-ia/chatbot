import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

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
    const { createClient } = require('@supabase/supabase-js');
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!openaiApiKey) {
      res.status(500).json({ error: 'OpenAI API key missing' });
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dateRange = '7d' } = req.body;

    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (dateRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === 'all') {
      startDate.setFullYear(2020);
    }

    // Obtener conversaciones
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    // Calcular estadísticas
    const totalConversations = conversations?.length || 0;
    const uniqueSessions = new Set(conversations?.map((c: any) => c.session_id) || []).size;

    // Productos más consultados
    const productCounts = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          const productName = product.name || 'Unknown';
          productCounts.set(productName, (productCounts.get(productName) || 0) + 1);
        });
      }
    });
    const topProducts = Array.from(productCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Categorías más consultadas
    const categoryCounts = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      if (conv.category_consulted) {
        categoryCounts.set(conv.category_consulted, (categoryCounts.get(conv.category_consulted) || 0) + 1);
      }
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          if (product.category) {
            categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
          }
        });
      }
    });
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Preguntas más frecuentes
    const questionCounts = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      const firstWords = conv.user_message.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
      questionCounts.set(firstWords, (questionCounts.get(firstWords) || 0) + 1);
    });
    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Generar resumen con OpenAI
    const summaryPrompt = `Eres un analista de datos experto. Analiza estos datos de un chatbot de e-commerce y genera un resumen narrativo claro y útil para el propietario del negocio.

DATOS DEL PERÍODO ${dateRange}:
- Total de conversaciones: ${totalConversations}
- Usuarios únicos: ${uniqueSessions}
- Top 10 productos consultados: ${JSON.stringify(topProducts)}
- Top 10 categorías consultadas: ${JSON.stringify(topCategories)}
- Top 5 preguntas frecuentes: ${JSON.stringify(topQuestions)}

Genera un resumen narrativo en español que incluya:
1. **Resumen ejecutivo** (2-3 párrafos): Qué está pasando en general con el chatbot
2. **Productos destacados** (1 párrafo): Qué productos se consultan más y por qué puede ser
3. **Categorías de interés** (1 párrafo): Qué categorías atraen más atención
4. **Insights y patrones** (1-2 párrafos): Patrones de comportamiento detectados
5. **Recomendaciones** (1 párrafo): Acciones recomendadas para mejorar el negocio

El resumen debe ser claro, profesional y útil para tomar decisiones de negocio.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un analista de datos experto que genera resúmenes claros y útiles para propietarios de negocios. Escribe en español de forma profesional.'
        },
        {
          role: 'user',
          content: summaryPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const summaryText = completion.choices[0].message.content || '';

    // Guardar resumen en BD
    const { error: saveError } = await supabase
      .from('chat_analytics_summaries')
      .insert({
        date_range_start: startDate.toISOString(),
        date_range_end: endDate.toISOString(),
        summary_text: summaryText,
        generated_by: 'manual',
        total_conversations: totalConversations,
        unique_sessions: uniqueSessions,
        top_products_summary: JSON.stringify(topProducts),
        top_categories_summary: JSON.stringify(topCategories)
      });

    if (saveError) {
      console.error('Error guardando resumen:', saveError);
    }

    res.status(200).json({
      success: true,
      summary: summaryText,
      generated_at: new Date().toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Error generando resumen:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}


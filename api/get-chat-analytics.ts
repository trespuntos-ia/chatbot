import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener parámetros de query
    const { dateRange = '7d', includeSummary = false } = req.query;

    // Calcular fecha de inicio
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (dateRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === 'all') {
      startDate.setFullYear(2020); // Fecha muy antigua para obtener todo
    }

    // 1. Métricas generales
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    // 2. Calcular métricas
    const totalConversations = conversations?.length || 0;
    
    // Sesiones únicas
    const uniqueSessions = new Set(conversations?.map((c: any) => c.session_id) || []).size;
    
    // Productos más consultados
    const productCounts = new Map<string, { name: string; count: number; category?: string }>();
    conversations?.forEach((conv: any) => {
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          const productName = product.name || 'Unknown';
          const current = productCounts.get(productName) || { name: productName, count: 0, category: product.category };
          productCounts.set(productName, { ...current, count: current.count + 1 });
        });
      }
    });
    
    const topProducts = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Categorías más consultadas
    const categoryCounts = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      if (conv.category_consulted) {
        categoryCounts.set(conv.category_consulted, (categoryCounts.get(conv.category_consulted) || 0) + 1);
      }
      // También contar categorías de productos consultados
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

    // Preguntas más frecuentes (simplificado - primeras palabras)
    const questionCounts = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      const firstWords = conv.user_message.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
      questionCounts.set(firstWords, (questionCounts.get(firstWords) || 0) + 1);
    });
    
    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conversaciones por día (para gráfico)
    const conversationsByDay = new Map<string, number>();
    conversations?.forEach((conv: any) => {
      const date = new Date(conv.created_at).toISOString().split('T')[0];
      conversationsByDay.set(date, (conversationsByDay.get(date) || 0) + 1);
    });
    
    const conversationsByDayArray = Array.from(conversationsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Tiempo promedio de respuesta
    const responseTimes = conversations?.filter((c: any) => c.response_time_ms).map((c: any) => c.response_time_ms) || [];
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : 0;

    // Obtener último resumen si se solicita
    let lastSummary = null;
    const shouldIncludeSummary = includeSummary === 'true' || includeSummary === true || includeSummary === '1';
    if (shouldIncludeSummary) {
      const { data: summaryData } = await supabase
        .from('chat_analytics_summaries')
        .select('*')
        .gte('date_range_start', startDate.toISOString())
        .lte('date_range_end', endDate.toISOString())
        .order('generated_at', { ascending: false })
        .limit(1)
        .single();
      
      lastSummary = summaryData;
    }

    res.status(200).json({
      success: true,
      metrics: {
        totalConversations,
        uniqueSessions,
        avgResponseTime,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      topProducts,
      topCategories,
      topQuestions,
      conversationsByDay: conversationsByDayArray,
      recentConversations: conversations?.slice(0, 20) || [], // Últimas 20 conversaciones
      lastSummary: lastSummary || null
    });

  } catch (error) {
    console.error('Error en get-chat-analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}


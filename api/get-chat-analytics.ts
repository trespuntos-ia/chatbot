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
    const { dateRange = '7d' } = req.query;
    const includeSummary = req.query.includeSummary;

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

    // 1. Métricas generales (con filtro de fecha)
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    // 2. Obtener conversaciones recientes (últimas 20, sin importar filtro de fecha)
    // Primero verificar cuántas hay en total
    const { count: totalCount } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    // Obtener conversaciones recientes - forzar sin caché usando timestamp
    const { data: recentConversationsData, error: recentError } = await supabase
      .from('chat_conversations')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(20);

    if (recentError) {
      console.error('[Analytics] Error obteniendo conversaciones recientes:', {
        error: recentError.message,
        code: recentError.code,
        details: recentError.details
      });
    } else {
      const latestDate = recentConversationsData?.[0]?.created_at;
      const now = new Date().toISOString();
      const timeDiffMinutes = latestDate 
        ? Math.round((new Date(now).getTime() - new Date(latestDate).getTime()) / 1000 / 60)
        : null;
      
      console.log('[Analytics] Conversaciones recientes obtenidas:', {
        totalInDB: totalCount || 0,
        returned: recentConversationsData?.length || 0,
        latest: latestDate || 'none',
        now: now,
        timeDiffMinutes: timeDiffMinutes,
        timeDiffText: timeDiffMinutes !== null 
          ? `${timeDiffMinutes} minutos` 
          : 'N/A'
      });
      
      // Si la más reciente es de hace más de 5 minutos, advertir
      if (timeDiffMinutes !== null && timeDiffMinutes > 5) {
        console.warn('[Analytics] ADVERTENCIA: La conversación más reciente es de hace', timeDiffMinutes, 'minutos');
      }
    }

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

    // Conversaciones por día (para gráfico) + tiempos por día
    const conversationsByDay = new Map<string, number>();
    const responseTimesByDayMap = new Map<string, { sum: number; count: number; fastest: number; slowest: number }>();
    conversations?.forEach((conv: any) => {
      const date = new Date(conv.created_at).toISOString().split('T')[0];
      conversationsByDay.set(date, (conversationsByDay.get(date) || 0) + 1);

      if (conv.response_time_ms && conv.response_time_ms > 0) {
        const stats = responseTimesByDayMap.get(date) || { sum: 0, count: 0, fastest: Number.POSITIVE_INFINITY, slowest: 0 };
        stats.sum += conv.response_time_ms;
        stats.count += 1;
        if (conv.response_time_ms < stats.fastest) {
          stats.fastest = conv.response_time_ms;
        }
        if (conv.response_time_ms > stats.slowest) {
          stats.slowest = conv.response_time_ms;
        }
        responseTimesByDayMap.set(date, stats);
      }
    });
    
    const conversationsByDayArray = Array.from(conversationsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const responseTimesByDay = Array.from(responseTimesByDayMap.entries())
      .map(([date, stats]) => ({
        date,
        avgResponseTime: stats.count > 0 ? Math.round(stats.sum / stats.count) : 0,
        fastestResponseTime: stats.fastest === Number.POSITIVE_INFINITY ? 0 : stats.fastest,
        slowestResponseTime: stats.slowest
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Tiempo promedio de respuesta
    const responseTimes = conversations?.filter((c: any) => c.response_time_ms).map((c: any) => c.response_time_ms) || [];
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length)
      : 0;

    let p90ResponseTime = 0;
    let fastestResponseTime = 0;
    let slowestResponseTime = 0;
    if (responseTimes.length > 0) {
      const sortedTimes = [...responseTimes].sort((a, b) => a - b);
      fastestResponseTime = sortedTimes[0];
      slowestResponseTime = sortedTimes[sortedTimes.length - 1];
      const p90Index = Math.floor(0.9 * (sortedTimes.length - 1));
      p90ResponseTime = sortedTimes[p90Index];
    }

    // Métricas de consumo de OpenAI
    const conversationsWithTokens = conversations?.filter((c: any) => c.tokens_used && c.tokens_used > 0) || [];
    const totalTokens = conversationsWithTokens.reduce((sum: number, c: any) => sum + (c.tokens_used || 0), 0);
    const avgTokensPerConversation = conversationsWithTokens.length > 0
      ? Math.round(totalTokens / conversationsWithTokens.length)
      : 0;
    
    // Calcular costos estimados por modelo
    // Precios por 1M tokens (aproximados, actualizados a 2024)
    const modelPricing: { [key: string]: { input: number; output: number } } = {
      'gpt-4': { input: 30, output: 60 },
      'gpt-4-turbo': { input: 10, output: 30 },
      'gpt-4o': { input: 5, output: 15 },
      'gpt-3.5-turbo': { input: 0.5, output: 1.5 },
      'gpt-3.5-turbo-16k': { input: 3, output: 4 },
    };
    
    // Calcular costos por modelo
    const tokensByModel = new Map<string, { total: number; count: number }>();
    conversationsWithTokens.forEach((c: any) => {
      const model = c.model_used || 'gpt-3.5-turbo';
      const tokens = c.tokens_used || 0;
      const current = tokensByModel.get(model) || { total: 0, count: 0 };
      tokensByModel.set(model, {
        total: current.total + tokens,
        count: current.count + 1
      });
    });
    
    // Estimar costos (asumiendo 70% input, 30% output como promedio)
    let estimatedCost = 0;
    const costByModel: Array<{ model: string; tokens: number; cost: number }> = [];
    
    tokensByModel.forEach((data, model) => {
      const pricing = modelPricing[model] || modelPricing['gpt-3.5-turbo'];
      const inputTokens = Math.round(data.total * 0.7);
      const outputTokens = Math.round(data.total * 0.3);
      const cost = (inputTokens / 1_000_000) * pricing.input + (outputTokens / 1_000_000) * pricing.output;
      estimatedCost += cost;
      costByModel.push({
        model,
        tokens: data.total,
        cost: Math.round(cost * 100) / 100 // Redondear a 2 decimales
      });
    });
    
    // Tokens por día
    const tokensByDay = new Map<string, number>();
    conversationsWithTokens.forEach((c: any) => {
      const date = new Date(c.created_at).toISOString().split('T')[0];
      tokensByDay.set(date, (tokensByDay.get(date) || 0) + (c.tokens_used || 0));
    });
    
    const tokensByDayArray = Array.from(tokensByDay.entries())
      .map(([date, tokens]) => ({ date, tokens }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Estadísticas de feedback (satisfacción)
    const feedbackStats = {
      total: 0,
      helpful: 0,
      notHelpful: 0,
      helpfulPercentage: 0
    };
    
    conversations?.forEach((conv: any) => {
      if (conv.feedback_helpful !== null && conv.feedback_helpful !== undefined) {
        feedbackStats.total++;
        if (conv.feedback_helpful === true) {
          feedbackStats.helpful++;
        } else {
          feedbackStats.notHelpful++;
        }
      }
    });
    
    if (feedbackStats.total > 0) {
      feedbackStats.helpfulPercentage = Math.round((feedbackStats.helpful / feedbackStats.total) * 100);
    }

    // Obtener último resumen si se solicita
    let lastSummary = null;
    const shouldIncludeSummary = includeSummary === 'true' || includeSummary === '1' || (Array.isArray(includeSummary) && includeSummary[0] === 'true');
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
        p90ResponseTime,
        fastestResponseTime,
        slowestResponseTime,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      openaiUsage: {
        totalTokens,
        avgTokensPerConversation: avgTokensPerConversation,
        conversationsWithTokens: conversationsWithTokens.length,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        costByModel,
        tokensByDay: tokensByDayArray
      },
      feedbackStats,
      topProducts,
      topCategories,
      topQuestions,
      conversationsByDay: conversationsByDayArray,
      responseTimesByDay,
      recentConversations: recentConversationsData || [], // Últimas 20 conversaciones (sin filtro de fecha)
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


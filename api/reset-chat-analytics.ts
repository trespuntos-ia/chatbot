import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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
    const { confirmation } = req.body || {};

    if (confirmation !== 'BORRAR') {
      res.status(400).json({
        success: false,
        error: 'Confirmación inválida. Escribe BORRAR para confirmar.'
      });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Configuración de Supabase faltante. Define SUPABASE_URL y SUPABASE_SERVICE_KEY.'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const nowIso = new Date().toISOString();

    const { count: conversationsCount, error: conversationsCountError } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    if (conversationsCountError) {
      throw conversationsCountError;
    }

    const { error: deleteConversationsError } = await supabase
      .from('chat_conversations')
      .delete()
      .lte('created_at', nowIso);

    if (deleteConversationsError) {
      throw deleteConversationsError;
    }

    const { count: summariesCount, error: summariesCountError } = await supabase
      .from('chat_analytics_summaries')
      .select('*', { count: 'exact', head: true });

    if (summariesCountError) {
      throw summariesCountError;
    }

    const { error: deleteSummariesError } = await supabase
      .from('chat_analytics_summaries')
      .delete()
      .lte('generated_at', nowIso);

    if (deleteSummariesError) {
      throw deleteSummariesError;
    }

    res.status(200).json({
      success: true,
      message: 'Todas las estadísticas del chat fueron eliminadas correctamente.',
      deleted: {
        conversations: conversationsCount || 0,
        summaries: summariesCount || 0
      }
    });
  } catch (error) {
    console.error('Error al resetear analytics de chat:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}




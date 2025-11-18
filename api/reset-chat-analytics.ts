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

    // Contar registros antes de borrar
    const { count: conversationsCount, error: conversationsCountError } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    if (conversationsCountError) {
      throw conversationsCountError;
    }

    // Borrar TODAS las conversaciones usando una condición que siempre es verdadera
    // Usamos gte con una fecha muy antigua para que siempre sea verdadero
    const { error: deleteConversationsError } = await supabase
      .from('chat_conversations')
      .delete()
      .gte('created_at', '1970-01-01T00:00:00Z');

    if (deleteConversationsError) {
      throw deleteConversationsError;
    }

    // Contar resúmenes antes de borrar
    const { count: summariesCount, error: summariesCountError } = await supabase
      .from('chat_analytics_summaries')
      .select('*', { count: 'exact', head: true });

    if (summariesCountError) {
      throw summariesCountError;
    }

    // Borrar TODOS los resúmenes usando una condición que siempre es verdadera
    const { error: deleteSummariesError } = await supabase
      .from('chat_analytics_summaries')
      .delete()
      .gte('generated_at', '1970-01-01T00:00:00Z');

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







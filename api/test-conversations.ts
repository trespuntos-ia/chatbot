import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener total de conversaciones
    const { count: totalCount } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    // Obtener últimas 5 conversaciones
    const { data: recent, error } = await supabase
      .from('chat_conversations')
      .select('id, session_id, user_message, created_at')
      .order('created_at', { ascending: false })
      .limit(5);

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    const now = new Date();
    const results = recent?.map((conv: any) => {
      const convDate = new Date(conv.created_at);
      const diffMs = now.getTime() - convDate.getTime();
      const diffMinutes = Math.round(diffMs / 1000 / 60);
      const diffHours = Math.round(diffMinutes / 60);
      
      return {
        id: conv.id,
        session_id: conv.session_id,
        user_message: conv.user_message?.substring(0, 50) + '...',
        created_at: conv.created_at,
        age_minutes: diffMinutes,
        age_hours: diffHours,
        age_text: diffMinutes < 60 
          ? `hace ${diffMinutes} minutos`
          : `hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`
      };
    }) || [];

    res.status(200).json({
      total_conversations: totalCount || 0,
      latest_5: results,
      current_time: now.toISOString()
    });

  } catch (error) {
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


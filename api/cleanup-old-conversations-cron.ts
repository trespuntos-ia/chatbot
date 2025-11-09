import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Calcular fecha límite (30 días atrás)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = thirtyDaysAgo.toISOString();

    // Primero contar cuántas conversaciones se van a eliminar (para logging)
    const { count: countToDelete } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true })
      .lt('created_at', cutoffDate);

    // Eliminar conversaciones más antiguas de 30 días
    const { error: deleteError, data: deletedData } = await supabase
      .from('chat_conversations')
      .delete()
      .lt('created_at', cutoffDate)
      .select();

    if (deleteError) {
      console.error('Error eliminando conversaciones antiguas:', deleteError);
      res.status(500).json({
        success: false,
        error: 'Error al limpiar conversaciones antiguas',
        details: deleteError.message
      });
      return;
    }

    // Contar conversaciones restantes
    const { count: remainingCount } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    res.status(200).json({
      success: true,
      message: 'Limpieza de conversaciones completada',
      deleted: countToDelete || 0,
      remaining: remainingCount || 0,
      cutoffDate: cutoffDate,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error en cleanup-old-conversations-cron:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}








import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        details: 'Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.',
      });
      return;
    }

    const idParam = req.query.id ?? (req.body?.id ?? null);
    const id =
      typeof idParam === 'string' ? Number.parseInt(idParam, 10) : typeof idParam === 'number' ? idParam : NaN;

    if (!Number.isFinite(id) || id <= 0) {
      res.status(400).json({
        success: false,
        error: 'ID inválido',
        details: 'Debes proporcionar un ID numérico del video a eliminar.',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { error: deleteError } = await supabase.from('product_videos').delete().eq('id', id);

    if (deleteError) {
      console.error('[delete-product-video] Error deleting video:', deleteError);
      res.status(500).json({
        success: false,
        error: 'Error al eliminar el video',
        details: deleteError.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
    });
  } catch (error) {
    console.error('[delete-product-video] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


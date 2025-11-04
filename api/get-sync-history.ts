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

    // Obtener parámetros de consulta
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Obtener historial de sincronización con información de conexión
    const { data, error } = await supabase
      .from('product_sync_history')
      .select(`
        *,
        prestashop_connections (
          id,
          name,
          prestashop_url
        )
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Error fetching sync history',
        details: error.message 
      });
      return;
    }

    // Obtener total para paginación
    const { count } = await supabase
      .from('product_sync_history')
      .select('*', { count: 'exact', head: true });

    res.status(200).json({ 
      success: true,
      history: data || [],
      total: count || 0,
      limit,
      offset
    });
  } catch (error) {
    console.error('Get sync history error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

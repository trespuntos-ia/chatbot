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
        error: 'Supabase configuration missing',
        details: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener documentos (sin el contenido binario para ahorrar ancho de banda)
    const { data, error } = await supabase
      .from('documents')
      .select('id, filename, original_filename, file_type, file_size, mime_type, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({
        error: 'Database error',
        details: error.message
      });
      return;
    }

    res.status(200).json({
      success: true,
      documents: data || []
    });
  } catch (error) {
    console.error('Get documents error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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

    const { query, limit = 5 } = req.body;

    if (!query || typeof query !== 'string') {
      res.status(400).json({
        error: 'Query required',
        details: 'Please provide a search query'
      });
      return;
    }

    // Buscar en el texto extraído usando búsqueda de texto completo
    // Usamos ilike para búsqueda simple (mejor para español)
    const searchTerm = query.trim();
    
    let dbQuery = supabase
      .from('documents')
      .select('id, filename, original_filename, file_type, extracted_text, created_at')
      .or(`extracted_text.ilike.%${searchTerm}%,original_filename.ilike.%${searchTerm}%`)
      .limit(limit);

    const { data, error } = await dbQuery;

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({
        error: 'Database error',
        details: error.message
      });
      return;
    }

    // Preparar resultados con snippets del texto relevante
    const results = (data || []).map((doc: any) => {
      let snippet = '';
      if (doc.extracted_text) {
        const text = doc.extracted_text;
        const index = text.toLowerCase().indexOf(searchTerm.toLowerCase());
        if (index !== -1) {
          const start = Math.max(0, index - 100);
          const end = Math.min(text.length, index + searchTerm.length + 100);
          snippet = text.substring(start, end);
          if (start > 0) snippet = '...' + snippet;
          if (end < text.length) snippet = snippet + '...';
        } else {
          snippet = text.substring(0, 200);
          if (text.length > 200) snippet += '...';
        }
      }

      return {
        id: doc.id,
        filename: doc.original_filename,
        file_type: doc.file_type,
        snippet,
        created_at: doc.created_at
      };
    });

    res.status(200).json({
      success: true,
      results,
      total: results.length
    });
  } catch (error) {
    console.error('Search documents error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}












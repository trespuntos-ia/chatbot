import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

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
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener datos del body
    const { file, filename, mimeType } = req.body;

    if (!file || !filename) {
      res.status(400).json({ error: 'File and filename required' });
      return;
    }

    // Convertir base64 a buffer
    const base64Data = file.includes(',') ? file.split(',')[1] : file;
    const fileBuffer = Buffer.from(base64Data, 'base64');

    // Determinar tipo de archivo simple
    const extension = filename.split('.').pop()?.toLowerCase() || 'txt';
    
    // Guardar en Supabase - solo campos esenciales
    const { data, error } = await supabase
      .from('documents')
      .insert({
        filename: `${Date.now()}_${filename}`,
        original_filename: filename,
        file_type: extension,
        file_size: fileBuffer.length,
        file_content: fileBuffer,
        extracted_text: '', // Vacío por ahora
        mime_type: mimeType || 'application/octet-stream'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ error: 'Database error', details: error.message });
      return;
    }

    res.status(200).json({
      success: true,
      document: {
        id: data.id,
        filename: data.original_filename,
        file_type: data.file_type,
        file_size: data.file_size
      }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

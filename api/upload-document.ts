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
    console.log('Upload request received');
    
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase config missing');
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener datos del body
    const { file, filename, mimeType, extractedText } = req.body;

    console.log('Request body:', {
      hasFile: !!file,
      filename: filename,
      fileLength: typeof file === 'string' ? file.length : 'not string',
      mimeType: mimeType
    });

    if (!file || !filename) {
      res.status(400).json({ error: 'File and filename required' });
      return;
    }

    // Convertir base64 a buffer
    let fileBuffer: Buffer;
    try {
      const base64Data = file.includes(',') ? file.split(',')[1] : file;
      fileBuffer = Buffer.from(base64Data, 'base64');
      console.log('File decoded:', {
        originalSize: file.length,
        decodedSize: fileBuffer.length,
        sizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2)
      });
    } catch (decodeErr) {
      console.error('Error decoding base64:', decodeErr);
      res.status(400).json({ error: 'Invalid base64 encoding' });
      return;
    }

    // Determinar tipo de archivo simple
    const extension = filename.split('.').pop()?.toLowerCase() || 'txt';
    
    console.log('Saving to Supabase:', {
      filename,
      extension,
      size: fileBuffer.length,
      bufferType: fileBuffer.constructor.name
    });

    // Guardar el archivo con texto extraído (si viene del cliente)
    // El texto se extrae en el cliente usando pdf.js para evitar problemas en Vercel
    try {
      // Limitar texto extraído a 50KB
      const maxTextLength = 50 * 1024;
      const finalExtractedText = extractedText && extractedText.length > 0
        ? (extractedText.length > maxTextLength 
            ? extractedText.substring(0, maxTextLength) + '...[truncado]'
            : extractedText)
        : '';

      const { data, error } = await supabase
        .from('documents')
        .insert({
          filename: `${Date.now()}_${filename}`,
          original_filename: filename,
          file_type: extension,
          file_size: fileBuffer.length,
          file_content: fileBuffer,
          extracted_text: finalExtractedText,
          mime_type: mimeType || 'application/octet-stream'
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
        res.status(500).json({ 
          error: 'Database error', 
          details: error.message,
          code: error.code,
          hint: error.hint
        });
        return;
      }

      console.log('Document saved successfully:', data.id);

      res.status(200).json({
        success: true,
        document: {
          id: data.id,
          filename: data.original_filename,
          file_type: data.file_type,
          file_size: data.file_size
        }
      });
    } catch (dbError) {
      console.error('Unexpected error saving to Supabase:', dbError);
      res.status(500).json({
        error: 'Internal server error',
        message: dbError instanceof Error ? dbError.message : 'Unknown error',
        details: 'Error al guardar en la base de datos'
      });
      return;
    }
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

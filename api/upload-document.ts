import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import pdf from 'pdf-parse';

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
    const { file, filename, mimeType } = req.body;

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
    
    console.log('Saving to Supabase first (text extraction will happen later):', {
      filename,
      extension,
      size: fileBuffer.length
    });

    // PASO 1: Guardar el archivo primero SIN extraer texto (para evitar timeouts)
    const { data, error } = await supabase
      .from('documents')
      .insert({
        filename: `${Date.now()}_${filename}`,
        original_filename: filename,
        file_type: extension,
        file_size: fileBuffer.length,
        file_content: fileBuffer,
        extracted_text: '', // Vacío por ahora, se actualizará después
        mime_type: mimeType || 'application/octet-stream'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Database error', 
        details: error.message,
        code: error.code,
        hint: error.hint
      });
      return;
    }

    console.log('Document saved successfully:', data.id);

    // PASO 2: Extraer texto en segundo plano (no bloquea la respuesta)
    // Esto se hace después de responder al usuario para que no espere
    (async () => {
      try {
        let extractedText = '';
        
        if (extension === 'pdf' || mimeType?.includes('pdf')) {
          console.log('Starting background PDF text extraction for:', data.id);
          try {
            // Timeout más largo en background (15 segundos)
            const pdfPromise = pdf(fileBuffer);
            const timeoutPromise = new Promise((_, reject) => 
              setTimeout(() => reject(new Error('PDF extraction timeout')), 15000)
            );
            
            const pdfData = await Promise.race([pdfPromise, timeoutPromise]) as any;
            extractedText = pdfData?.text || '';
            
            // Limitar a 50KB
            const maxTextLength = 50 * 1024;
            if (extractedText.length > maxTextLength) {
              extractedText = extractedText.substring(0, maxTextLength) + '...[truncado]';
            }
            
            console.log('PDF text extracted in background:', extractedText.length, 'characters');
          } catch (pdfError) {
            console.warn('Background PDF extraction failed:', pdfError);
            extractedText = '';
          }
        } else if (extension === 'txt' || extension === 'md' || mimeType?.includes('text/plain') || mimeType?.includes('text/markdown')) {
          extractedText = fileBuffer.toString('utf-8');
          // Limitar a 50KB
          const maxTextLength = 50 * 1024;
          if (extractedText.length > maxTextLength) {
            extractedText = extractedText.substring(0, maxTextLength) + '...[truncado]';
          }
          console.log('Text file extracted in background:', extractedText.length, 'characters');
        }

        // Actualizar el documento con el texto extraído
        if (extractedText) {
          const { error: updateError } = await supabase
            .from('documents')
            .update({ extracted_text: extractedText })
            .eq('id', data.id);
          
          if (updateError) {
            console.error('Error updating document with extracted text:', updateError);
          } else {
            console.log('Document updated with extracted text:', data.id);
          }
        }
      } catch (bgError) {
        console.error('Background text extraction error:', bgError);
        // No hacer nada, el archivo ya está guardado
      }
    })(); // Función auto-ejecutada asíncrona

    // Responder inmediatamente sin esperar la extracción de texto
    res.status(200).json({
      success: true,
      document: {
        id: data.id,
        filename: data.original_filename,
        file_type: data.file_type,
        file_size: data.file_size
      },
      message: 'Archivo subido correctamente. El texto se extraerá en segundo plano.'
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

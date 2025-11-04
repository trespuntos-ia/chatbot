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
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { documentId } = req.body;

    if (!documentId) {
      res.status(400).json({ error: 'Document ID required' });
      return;
    }

    console.log('Extracting text for document:', documentId);

    // Obtener el documento
    const { data: document, error: fetchError } = await supabase
      .from('documents')
      .select('id, filename, original_filename, file_type, file_content, mime_type, extracted_text')
      .eq('id', documentId)
      .single();

    if (fetchError || !document) {
      console.error('Error fetching document:', fetchError);
      res.status(404).json({ error: 'Document not found' });
      return;
    }

    // Si ya tiene texto extraído, no hacer nada
    if (document.extracted_text && document.extracted_text.length > 0) {
      res.status(200).json({
        success: true,
        message: 'Text already extracted',
        textLength: document.extracted_text.length
      });
      return;
    }

    // Extraer texto según el tipo de archivo
    let extractedText = '';
    const fileBuffer = Buffer.from(document.file_content);

    try {
      const extension = document.file_type?.toLowerCase() || '';
      const mimeType = document.mime_type || '';

      if (extension === 'pdf' || mimeType.includes('pdf')) {
        console.log('Extracting text from PDF...', { size: fileBuffer.length });
        
        // Timeout de 15 segundos
        const pdfPromise = pdf(fileBuffer);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('PDF extraction timeout')), 15000)
        );
        
        const pdfData = await Promise.race([pdfPromise, timeoutPromise]) as any;
        extractedText = pdfData?.text || '';
        console.log('PDF text extracted:', extractedText.length, 'characters');
      } else if (extension === 'txt' || extension === 'md' || mimeType.includes('text/plain') || mimeType.includes('text/markdown')) {
        extractedText = fileBuffer.toString('utf-8');
        console.log('Text file extracted:', extractedText.length, 'characters');
      }
    } catch (extractError) {
      console.error('Error extracting text:', extractError);
      res.status(500).json({
        error: 'Text extraction failed',
        message: extractError instanceof Error ? extractError.message : 'Unknown error'
      });
      return;
    }

    // Limitar a 50KB
    const maxTextLength = 50 * 1024;
    const finalExtractedText = extractedText.length > maxTextLength 
      ? extractedText.substring(0, maxTextLength) + '...[truncado]'
      : extractedText;

    // Actualizar el documento con el texto extraído
    const { error: updateError } = await supabase
      .from('documents')
      .update({ extracted_text: finalExtractedText })
      .eq('id', documentId);

    if (updateError) {
      console.error('Error updating document:', updateError);
      res.status(500).json({
        error: 'Failed to update document',
        message: updateError.message
      });
      return;
    }

    console.log('Document updated with extracted text:', documentId);

    res.status(200).json({
      success: true,
      textLength: finalExtractedText.length,
      message: 'Text extracted successfully'
    });
  } catch (error) {
    console.error('Extract text error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


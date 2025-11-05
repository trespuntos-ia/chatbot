import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Importación dinámica de pdf-parse para evitar errores en build
let pdfParse: any = null;
async function getPdfParse() {
  if (!pdfParse) {
    try {
      // Importación dinámica - manejar ESM sin default export
      const pdfParseModule = await import('pdf-parse') as any;
      // pdf-parse ESM no tiene default, es directamente el export
      pdfParse = pdfParseModule.default || pdfParseModule;
    } catch (error) {
      console.error('Error importing pdf-parse:', error);
      throw new Error('PDF parsing library not available');
    }
  }
  return pdfParse;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Función helper para enviar errores JSON
  const sendJsonError = (status: number, error: string, details?: string) => {
    if (!res.headersSent) {
      try {
        res.status(status).json({
          success: false,
          error,
          details: details || error
        });
      } catch (e) {
        console.error('Error sending JSON response:', e);
      }
    }
  };

  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    sendJsonError(405, 'Method not allowed');
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      sendJsonError(500, 'Supabase configuration missing');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { documentId } = req.body;

    if (!documentId) {
      sendJsonError(400, 'Document ID required');
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
      sendJsonError(404, 'Document not found', fetchError?.message);
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
    
    // Verificar que file_content existe
    if (!document.file_content) {
      sendJsonError(400, 'Document has no file content');
      return;
    }

    const fileBuffer = Buffer.from(document.file_content);

    try {
      const extension = document.file_type?.toLowerCase() || '';
      const mimeType = document.mime_type || '';

      if (extension === 'pdf' || mimeType.includes('pdf')) {
        console.log('Extracting text from PDF...', { size: fileBuffer.length, documentId });
        
        try {
          // Importar pdf-parse dinámicamente
          const pdf = await getPdfParse();
          
          // Timeout de 15 segundos
          const pdfPromise = pdf(fileBuffer);
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('PDF extraction timeout')), 15000)
          );
          
          const pdfData = await Promise.race([pdfPromise, timeoutPromise]) as any;
          extractedText = pdfData?.text || '';
          console.log('PDF text extracted:', extractedText.length, 'characters');
        } catch (pdfError) {
          console.error('PDF extraction error:', pdfError);
          sendJsonError(500, 'PDF extraction failed', pdfError instanceof Error ? pdfError.message : 'Unknown PDF error');
          return;
        }
      } else if (extension === 'txt' || extension === 'md' || mimeType.includes('text/plain') || mimeType.includes('text/markdown')) {
        extractedText = fileBuffer.toString('utf-8');
        console.log('Text file extracted:', extractedText.length, 'characters');
      } else {
        console.log('File type not supported for text extraction:', extension, mimeType);
        sendJsonError(400, 'File type not supported for text extraction');
        return;
      }
    } catch (extractError) {
      console.error('Error extracting text:', extractError);
      sendJsonError(500, 'Text extraction failed', extractError instanceof Error ? extractError.message : 'Unknown error');
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
      sendJsonError(500, 'Failed to update document', updateError.message);
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    console.error('Error stack:', errorStack);
    
    // Intentar enviar error JSON
    try {
      sendJsonError(500, 'Internal server error', errorMessage);
    } catch (sendError) {
      console.error('Failed to send error response:', sendError);
      // Último recurso: intentar enviar respuesta directamente
      if (!res.headersSent) {
        try {
          res.status(500).json({
            success: false,
            error: 'Internal server error',
            details: errorMessage
          });
        } catch (finalError) {
          console.error('Final error sending response:', finalError);
        }
      }
    }
  }
}


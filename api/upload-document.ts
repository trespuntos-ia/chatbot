import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import pdf from 'pdf-parse';
import mammoth from 'mammoth';

// Tipos MIME permitidos
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'text/plain',
  'text/markdown'
];

// Vercel tiene un límite de 4.5MB para el body de las requests
// Considerando que el archivo viene en base64 (~33% más grande) + overhead JSON
// Validamos 3MB del archivo original (~4MB en base64)
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (original), ~4MB en base64

// Wrapper para asegurar que siempre devolvemos JSON
async function safeHandler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Asegurar que siempre devolvemos JSON
  const sendJsonError = (status: number, error: string, details?: string) => {
    if (!res.headersSent) {
      try {
        res.status(status).json({
          error,
          details: details || error,
          success: false
        });
      } catch (e) {
        console.error('Error sending JSON response:', e);
      }
    }
  };

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
    sendJsonError(405, 'Method not allowed');
    return;
  }

  try {
    // Log inicial para debugging
    console.log('Upload handler called:', {
      method: req.method,
      hasBody: !!req.body,
      bodyType: typeof req.body,
      contentType: req.headers['content-type']
    });
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      sendJsonError(500, 'Supabase configuration missing', 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verificar que se envió un archivo
    if (!req.body) {
      console.error('No body received');
      sendJsonError(400, 'No request body', 'The request body is empty or could not be parsed');
      return;
    }

    if (!req.body.file) {
      console.error('No file in body:', {
        bodyKeys: Object.keys(req.body),
        bodyHasFile: 'file' in req.body
      });
      sendJsonError(400, 'No file provided', 'Please provide a file in the request body. Expected: { file: string, filename: string, mimeType: string }');
      return;
    }

    const { file, filename, mimeType } = req.body;
    
    // Validar que file sea string
    if (typeof file !== 'string') {
      console.error('File is not a string:', typeof file);
      sendJsonError(400, 'Invalid file format', `File must be a base64 string. Received type: ${typeof file}`);
      return;
    }
    
    // Log para debugging (solo tamaño, no contenido)
    console.log('Upload request received:', {
      filename: filename || 'not provided',
      mimeType: mimeType || 'not provided',
      base64Length: file.length,
      estimatedOriginalSize: Math.floor(file.length * 0.75) // Base64 es ~33% más grande
    });

    // Validar tipo MIME
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      sendJsonError(400, 'Invalid file type', `Allowed types: PDF, DOC, DOCX, TXT, MD. Received: ${mimeType || 'unknown'}`);
      return;
    }

    // Convertir base64 a buffer
    let fileBuffer: Buffer;
    try {
      // Si es base64, decodificarlo
      if (typeof file === 'string') {
        // Remover el prefijo data:application/pdf;base64, si existe
        const base64Data = file.includes(',') ? file.split(',')[1] : file;
        fileBuffer = Buffer.from(base64Data, 'base64');
        console.log('File decoded:', {
          originalBase64Size: file.length,
          decodedSize: fileBuffer.length,
          sizeMB: (fileBuffer.length / 1024 / 1024).toFixed(2)
        });
      } else {
        sendJsonError(400, 'Invalid file format', 'File must be provided as base64 string');
        return;
      }
    } catch (error) {
      console.error('Error decoding base64:', error);
      sendJsonError(400, 'Invalid file encoding', 'File must be valid base64 encoded');
      return;
    }

    // Validar tamaño (después de decodificar base64, el archivo original no debe exceder 3MB)
    // Vercel tiene límite de 4.5MB en el body total, pero aquí ya tenemos el buffer decodificado
    if (fileBuffer.length > MAX_FILE_SIZE) {
      sendJsonError(413, 'File too large', `Maximum file size is ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB (original file). Received: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. This is a Vercel limitation for serverless functions.`);
      return;
    }

    // Determinar tipo de archivo
    const fileType = getFileTypeFromMime(mimeType);
    const originalFilename = filename || `document_${Date.now()}.${fileType}`;
    const storedFilename = `${Date.now()}_${originalFilename}`;

    // Extraer texto del documento
    let extractedText = '';
    try {
      console.log('Starting text extraction for:', mimeType);
      extractedText = await extractTextFromFile(fileBuffer, mimeType);
      console.log('Text extraction completed:', {
        extractedLength: extractedText.length,
        hasText: extractedText.length > 0
      });
    } catch (error) {
      console.error('Error extracting text:', error);
      // Continuar sin texto extraído si falla - no es crítico
      extractedText = '';
    }

    // Guardar en Supabase
    console.log('Saving to Supabase:', {
      filename: storedFilename,
      originalFilename,
      fileType,
      fileSize: fileBuffer.length,
      extractedTextLength: extractedText.length
    });

    try {
      const { data, error: dbError } = await supabase
        .from('documents')
        .insert({
          filename: storedFilename,
          original_filename: originalFilename,
          file_type: fileType,
          file_size: fileBuffer.length,
          file_content: fileBuffer,
          extracted_text: extractedText,
          mime_type: mimeType
        })
        .select()
        .single();

      if (dbError) {
        console.error('Supabase error:', dbError);
        sendJsonError(500, 'Database error', dbError.message || 'Unknown database error');
        return;
      }

      console.log('Document saved successfully:', data.id);

      res.status(200).json({
        success: true,
        document: {
          id: data.id,
          filename: data.original_filename,
          file_type: data.file_type,
          file_size: data.file_size,
          created_at: data.created_at
        }
      });
    } catch (supabaseError) {
      console.error('Unexpected error saving to Supabase:', supabaseError);
      const errorMsg = supabaseError instanceof Error ? supabaseError.message : 'Unknown error';
      sendJsonError(500, 'Unexpected database error', errorMsg);
      return;
    }
  } catch (error) {
    console.error('Upload document error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    console.error('Error details:', {
      message: errorMessage,
      stack: errorStack,
      name: error instanceof Error ? error.name : undefined
    });

    // Asegurar que siempre devolvemos JSON, incluso en errores inesperados
    sendJsonError(500, 'Internal server error', errorMessage);
  }
}

// Exportar con wrapper de seguridad
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  try {
    await safeHandler(req, res);
  } catch (error) {
    // Último recurso: capturar cualquier error no controlado
    console.error('Unhandled error in upload-document:', error);
    if (!res.headersSent) {
      try {
        res.status(500).json({
          success: false,
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      } catch (e) {
        // Si incluso esto falla, al menos loguear
        console.error('Failed to send error response:', e);
      }
    }
  }
}

function getFileTypeFromMime(mimeType: string): string {
  if (mimeType.includes('pdf')) return 'pdf';
  if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) return 'docx';
  if (mimeType.includes('plain')) return 'txt';
  if (mimeType.includes('markdown')) return 'md';
  return 'unknown';
}

async function extractTextFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    // Extraer texto de PDF
    if (mimeType.includes('pdf')) {
      try {
        const data = await pdf(buffer);
        return data.text || '';
      } catch (pdfError) {
        console.error('Error parsing PDF:', pdfError);
        return '';
      }
    }
    
    // Extraer texto de Word (DOCX)
    if (mimeType.includes('wordprocessingml') || mimeType.includes('msword')) {
      try {
        // mammoth puede procesar tanto .docx como .doc (en algunos casos)
        const result = await mammoth.extractRawText({ buffer });
        return result.value || '';
      } catch (wordError) {
        console.error('Error parsing Word document:', wordError);
        // Para archivos .doc antiguos, mammoth puede no funcionar
        // En ese caso, retornamos vacío
        return '';
      }
    }
    
    // Para texto plano y markdown, leer directamente
    if (mimeType.includes('plain') || mimeType.includes('markdown')) {
      return buffer.toString('utf-8');
    }
    
    // Tipo no soportado
    return '';
  } catch (error) {
    console.error('Error extracting text from file:', error);
    return '';
  }
}


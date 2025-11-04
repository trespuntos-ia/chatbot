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

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    // Verificar que se envió un archivo
    if (!req.body || !req.body.file) {
      res.status(400).json({
        error: 'No file provided',
        details: 'Please provide a file in the request body'
      });
      return;
    }

    const { file, filename, mimeType } = req.body;

    // Validar tipo MIME
    if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
      res.status(400).json({
        error: 'Invalid file type',
        details: `Allowed types: PDF, DOC, DOCX, TXT, MD. Received: ${mimeType || 'unknown'}`
      });
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
      } else {
        res.status(400).json({
          error: 'Invalid file format',
          details: 'File must be provided as base64 string'
        });
        return;
      }
    } catch (error) {
      res.status(400).json({
        error: 'Invalid file encoding',
        details: 'File must be valid base64 encoded'
      });
      return;
    }

    // Validar tamaño
    if (fileBuffer.length > MAX_FILE_SIZE) {
      res.status(400).json({
        error: 'File too large',
        details: `Maximum file size is 10MB. Received: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB`
      });
      return;
    }

    // Determinar tipo de archivo
    const fileType = getFileTypeFromMime(mimeType);
    const originalFilename = filename || `document_${Date.now()}.${fileType}`;
    const storedFilename = `${Date.now()}_${originalFilename}`;

    // Extraer texto del documento (básico por ahora)
    let extractedText = '';
    try {
      extractedText = await extractTextFromFile(fileBuffer, mimeType);
    } catch (error) {
      console.error('Error extracting text:', error);
      // Continuar sin texto extraído si falla
      extractedText = '';
    }

    // Guardar en Supabase
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
      res.status(500).json({
        error: 'Database error',
        details: dbError.message
      });
      return;
    }

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
  } catch (error) {
    console.error('Upload document error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
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


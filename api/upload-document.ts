import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '6mb',
    },
  },
  maxDuration: 30, // Aumentar timeout a 30 segundos para archivos grandes
};

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
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // Para Storage

    if (!supabaseUrl || !supabaseKey) {
      console.error('Supabase config missing');
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    // Usar service key para Storage si está disponible, sino usar anon key
    const supabase = createClient(
      supabaseUrl, 
      supabaseServiceKey || supabaseKey
    );
    const supabaseAnon = createClient(supabaseUrl, supabaseKey);

    // Obtener datos del body
    const { file, filename, mimeType, extractedText, productId } = req.body;

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
    
    // Verificar producto si se proporciona
    let productDetails:
      | { id: number; name: string | null; sku: string | null; product_url: string | null }
      | null = null;

    if (productId !== null && productId !== undefined) {
      if (typeof productId !== 'number') {
        res.status(400).json({
          error: 'ID de producto inválido',
          details: 'El ID del producto debe ser un número o null',
        });
        return;
      }

      const { data: product, error: productError } = await supabaseAnon
        .from('products')
        .select('id, name, sku, product_url')
        .eq('id', productId)
        .maybeSingle();

      if (productError) {
        console.error('Supabase product fetch error:', productError);
        res.status(500).json({
          error: 'Error verificando el producto',
          details: productError.message,
        });
        return;
      }

      if (!product) {
        res.status(404).json({
          error: 'Producto no encontrado',
          details: `No existe un producto con ID ${productId}`,
        });
        return;
      }

      productDetails = product;
    }

    // Intentar subir a Supabase Storage primero (más eficiente)
    let fileUrl: string | null = null;
    const storageFilename = `${Date.now()}_${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const storagePath = `documents/${storageFilename}`;

    try {
      console.log('Uploading to Supabase Storage:', storagePath);
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, fileBuffer, {
          contentType: mimeType || 'application/octet-stream',
          upsert: false,
        });

      if (uploadError) {
        console.warn('Storage upload failed, falling back to database:', uploadError);
        // Si falla Storage, continuar con el método anterior (BYTEA)
      } else {
        // Obtener URL pública del archivo
        const { data: urlData } = supabase.storage
          .from('documents')
          .getPublicUrl(storagePath);
        
        fileUrl = urlData.publicUrl;
        console.log('File uploaded to Storage:', fileUrl);
      }
    } catch (storageError) {
      console.warn('Storage error, using database fallback:', storageError);
      // Continuar con el método de base de datos
    }

    // Limitar texto extraído a 50KB
    const maxTextLength = 50 * 1024;
    const finalExtractedText = extractedText && extractedText.length > 0
      ? (extractedText.length > maxTextLength 
          ? extractedText.substring(0, maxTextLength) + '...[truncado]'
          : extractedText)
      : '';

    // Guardar en la base de datos
    try {
      const insertData: any = {
        filename: `${Date.now()}_${filename}`,
        original_filename: filename,
        file_type: extension,
        file_size: fileBuffer.length,
        extracted_text: finalExtractedText,
        mime_type: mimeType || 'application/octet-stream',
        product_id: typeof productId === 'number' ? productId : null,
      };

      // Si tenemos URL de Storage, guardarla; si no, guardar el contenido binario
      if (fileUrl) {
        insertData.file_url = fileUrl;
      } else {
        // Fallback: guardar en BYTEA si Storage no está disponible
        insertData.file_content = fileBuffer;
      }

      const { data, error } = await supabaseAnon
        .from('documents')
        .insert(insertData)
        .select()
        .single();

      if (error) {
        console.error('Supabase insert error:', {
          message: error.message,
          code: error.code,
          hint: error.hint,
          details: error.details
        });
        
        // Si el error es de timeout o conexión, sugerir usar Storage
        if (error.message.includes('timeout') || error.message.includes('520') || error.code === 'PGRST116') {
          res.status(500).json({ 
            error: 'Error de conexión con la base de datos', 
            details: 'El archivo es demasiado grande o hay un problema de conexión. Por favor, intenta de nuevo en unos momentos.',
            code: error.code,
            hint: 'Si el problema persiste, verifica la configuración de Supabase Storage'
          });
        } else {
          res.status(500).json({ 
            error: 'Database error', 
            details: error.message,
            code: error.code,
            hint: error.hint
          });
        }
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
          file_url: fileUrl || undefined,
          product_id: data.product_id ?? null,
          product_name: productDetails?.name ?? null,
          product_sku: productDetails?.sku ?? null,
          product_url: productDetails?.product_url ?? null,
        }
      });
    } catch (dbError) {
      console.error('Unexpected error saving to Supabase:', dbError);
      const errorMessage = dbError instanceof Error ? dbError.message : 'Unknown error';
      
      if (errorMessage.includes('timeout') || errorMessage.includes('520')) {
        res.status(500).json({
          error: 'Timeout al guardar el archivo',
          message: 'El archivo es demasiado grande o hay un problema de conexión. Por favor, intenta con un archivo más pequeño o vuelve a intentar más tarde.',
          details: 'Error de conexión con Supabase'
        });
      } else {
        res.status(500).json({
          error: 'Internal server error',
          message: errorMessage,
          details: 'Error al guardar en la base de datos'
        });
      }
      return;
    }
  } catch (error) {
    console.error('Upload error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    if (errorMessage.includes('timeout') || errorMessage.includes('520')) {
      res.status(500).json({
        error: 'Error de conexión',
        message: 'No se pudo conectar con el servidor. Por favor, intenta de nuevo en unos momentos.',
        details: errorMessage
      });
    } else {
      res.status(500).json({
        error: 'Internal server error',
        message: errorMessage
      });
    }
  }
}

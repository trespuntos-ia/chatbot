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

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo permitir POST
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { products } = req.body;

    if (!products || !Array.isArray(products) || products.length === 0) {
      res.status(400).json({ error: 'Products array is required' });
      return;
    }

    // Validar variables de entorno
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ 
        error: 'Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_ANON_KEY environment variables.' 
      });
      return;
    }

    // Crear cliente de Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener productos existentes para preservar valores cuando los nuevos están vacíos
    const { data: existingProducts } = await supabase
      .from('products')
      .select('sku, category, description, image_url')
      .in('sku', products.map((p: any) => p.sku).filter(Boolean));

    const existingMap = new Map<string, any>();
    (existingProducts || []).forEach((p: any) => {
      existingMap.set(p.sku, p);
    });

    // Preparar productos para insertar (actualizar si ya existen por SKU)
    // Preservar valores existentes si los nuevos están vacíos
    const productsToInsert = products.map((product: any) => {
      const existing = existingMap.get(product.sku);
      return {
        name: product.name || '',
        price: product.price || '',
        // Preservar categoría existente si la nueva está vacía
        category: product.category || existing?.category || '',
        description: product.description || existing?.description || '',
        sku: product.sku || '',
        // Preservar imagen existente si la nueva está vacía
        image_url: product.image || existing?.image_url || '',
        product_url: product.product_url || '',
        // Guardar fecha de creación de PrestaShop solo si existe en el producto
        // No agregar date_add si la columna no existe en Supabase
        ...(product.date_add ? { date_add: product.date_add } : existing?.date_add ? { date_add: existing.date_add } : {}),
        updated_at: new Date().toISOString(),
      };
    });

    // Verificar primero si la tabla existe
    const { data: tableCheck, error: tableError } = await supabase
      .from('products')
      .select('id')
      .limit(1);

    if (tableError && tableError.code === '42P01') {
      res.status(500).json({ 
        error: 'Tabla no encontrada',
        details: 'La tabla "products" no existe. Por favor ejecuta el script SQL en Supabase (supabase-schema.sql)',
        code: 'TABLE_NOT_FOUND'
      });
      return;
    }

    // Insertar/actualizar productos usando upsert (basado en SKU)
    // Procesar en lotes para evitar límites de tamaño
    const batchSize = 100;
    let totalSaved = 0;
    const errors: any[] = [];

    for (let i = 0; i < productsToInsert.length; i += batchSize) {
      const batch = productsToInsert.slice(i, i + batchSize);
      
      const { data, error } = await supabase
        .from('products')
        .upsert(batch, {
          onConflict: 'sku',
          ignoreDuplicates: false,
        })
        .select();

      if (error) {
        console.error('Supabase error (batch):', error);
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          error: error.message,
          code: error.code,
          details: error.details
        });
      } else {
        totalSaved += data?.length || 0;
      }
    }

    if (errors.length > 0 && totalSaved === 0) {
      res.status(500).json({ 
        error: 'Error saving products to database',
        details: errors[0].error,
        code: errors[0].code,
        hint: errors[0].code === '42501' ? 'Problema de permisos. Verifica las políticas RLS en Supabase.' : 
              errors[0].code === '42P01' ? 'Tabla no encontrada. Ejecuta el script SQL.' : 
              'Revisa los logs de Supabase para más detalles',
        errors: errors
      });
      return;
    }

    const successMessage = errors.length > 0 
      ? `Guardados ${totalSaved} de ${products.length} productos (${errors.length} errores)`
      : `Successfully saved ${totalSaved} of ${products.length} products`;

    res.status(200).json({ 
      success: true,
      message: successMessage,
      saved: totalSaved,
      total: products.length,
      errors: errors.length > 0 ? errors.length : undefined
    });
  } catch (error) {
    console.error('Save products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


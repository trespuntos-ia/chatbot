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

    // Preparar productos para insertar (actualizar si ya existen por SKU)
    const productsToInsert = products.map((product: any) => ({
      name: product.name || '',
      price: product.price || '',
      category: product.category || '',
      description: product.description || '',
      sku: product.sku || '',
      image_url: product.image || '',
      product_url: product.product_url || '',
      updated_at: new Date().toISOString(),
    }));

    // Insertar/actualizar productos usando upsert (basado en SKU)
    const { data, error } = await supabase
      .from('products')
      .upsert(productsToInsert, {
        onConflict: 'sku',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Error saving products to database',
        details: error.message 
      });
      return;
    }

    res.status(200).json({ 
      success: true,
      message: `Successfully saved ${data?.length || products.length} products`,
      saved: data?.length || products.length,
      total: products.length
    });
  } catch (error) {
    console.error('Save products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


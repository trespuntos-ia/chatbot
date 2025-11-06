import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Helper para indexar todas las URLs de productos
 * 
 * POST /api/index-all-products
 * 
 * Busca todos los productos con product_url y los indexa automáticamente
 * Útil para indexación inicial masiva
 */
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({
      error: 'Supabase configuration missing'
    });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const { limit = 100, offset = 0, force = false } = req.body;

    // Obtener productos con product_url
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, product_url')
      .not('product_url', 'is', null)
      .neq('product_url', '')
      .range(offset, offset + limit - 1);

    if (productsError) throw productsError;

    if (!products || products.length === 0) {
      res.status(200).json({
        success: true,
        message: 'No products with URLs found',
        processed: 0,
        indexed: 0,
        errors: 0
      });
      return;
    }

    const results = {
      processed: 0,
      indexed: 0,
      skipped: 0,
      errors: 0,
      details: [] as any[]
    };

    // Indexar cada producto
    for (const product of products) {
      try {
        results.processed++;

        // Llamar a la API de indexación
        const indexUrl = `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/index-web-content`;
        
        const indexResponse = await fetch(indexUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            url: product.product_url,
            content_type: 'product_page',
            product_id: product.id,
            force
          })
        });

        const indexData = await indexResponse.json();

        if (indexData.success) {
          if (indexData.unchanged) {
            results.skipped++;
            results.details.push({
              product_id: product.id,
              product_name: product.name,
              url: product.product_url,
              status: 'unchanged'
            });
          } else {
            results.indexed++;
            results.details.push({
              product_id: product.id,
              product_name: product.name,
              url: product.product_url,
              status: 'indexed'
            });
          }
        } else {
          results.errors++;
          results.details.push({
            product_id: product.id,
            product_name: product.name,
            url: product.product_url,
            status: 'error',
            error: indexData.error
          });
        }

        // Pequeña pausa para no sobrecargar
        await new Promise(resolve => setTimeout(resolve, 500));

      } catch (error) {
        results.errors++;
        results.details.push({
          product_id: product.id,
          product_name: product.name,
          url: product.product_url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} products`,
      ...results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Index all products error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}



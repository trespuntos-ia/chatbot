import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ 
        error: 'Supabase configuration missing' 
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener solo los SKUs de todos los productos
    const { data, error } = await supabase
      .from('products')
      .select('sku, category');

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Error fetching SKUs',
        details: error.message 
      });
      return;
    }

    // Crear un mapa de SKU -> category para preservar categorías
    const skuMap = new Map<string, string>();
    (data || []).forEach((p: any) => {
      if (p.sku) {
        skuMap.set(p.sku, p.category || '');
      }
    });

    res.status(200).json({ 
      success: true,
      skus: Array.from(skuMap.keys()),
      skuMap: Object.fromEntries(skuMap),
      total: skuMap.size
    });
  } catch (error) {
    console.error('Get SKUs error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


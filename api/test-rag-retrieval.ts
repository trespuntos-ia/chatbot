import type { VercelRequest, VercelResponse } from '@vercel/node';
import { retrieveRelevantChunks } from './utils/vectorStore';
import { createClient } from '@supabase/supabase-js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query, limit = 10, threshold = 0.7 } = req.body || {};
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const chunks = await retrieveRelevantChunks(query, limit, threshold);
    
    // Obtener información completa de los productos
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: 'Supabase configuration missing' });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    const productIds = [...new Set(chunks.map(c => c.product_id))];
    
    let products: any[] = [];
    if (productIds.length > 0) {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .in('id', productIds);

      if (error) {
        console.error('Error fetching products:', error);
      } else {
        products = data || [];
      }
    }

    return res.json({
      success: true,
      query,
      chunks,
      products,
      count: chunks.length,
      threshold,
    });
  } catch (error) {
    console.error('Error testing RAG retrieval:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


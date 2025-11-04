import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'DELETE') {
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

    // Primero obtener el conteo antes de eliminar
    const { count: totalCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    // Eliminar todos los productos - usar gt('id', 0) que funciona mejor
    const { error, count } = await supabase
      .from('products')
      .delete()
      .gt('id', 0); // Esto eliminará todos los productos (id siempre > 0)

    if (error) {
      console.error('Supabase error clearing products:', error);
      res.status(500).json({ 
        error: 'Error clearing products',
        details: error.message,
        code: error.code
      });
      return;
    }

    // Verificar que realmente se eliminaron
    const { count: remainingCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    res.status(200).json({ 
      success: true,
      message: 'Todos los productos han sido eliminados',
      deleted: count || totalCount || 0,
      remaining: remainingCount || 0,
      verified: (remainingCount || 0) === 0
    });
  } catch (error) {
    console.error('Clear products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


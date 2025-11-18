import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

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
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Contar antes de eliminar
    const { count: totalCount } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    console.log(`Total embeddings antes de eliminar: ${totalCount || 0}`);

    // Eliminar todos los embeddings
    const { error: deleteError, count: deletedCount } = await supabase
      .from('product_embeddings')
      .delete()
      .neq('id', -1); // Condición que siempre es verdadera

    if (deleteError) {
      console.error('Error deleting embeddings:', deleteError);
      res.status(500).json({
        error: 'Error deleting embeddings',
        details: deleteError.message,
        hint: 'RLS policies may be blocking DELETE. Check Supabase policies or use service role key.',
      });
      return;
    }

    // Verificar que se eliminaron
    await new Promise(resolve => setTimeout(resolve, 1000));
    const { count: remainingCount } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    console.log(`Embeddings restantes después de eliminar: ${remainingCount || 0}`);

    res.status(200).json({
      success: true,
      message: `Se eliminaron ${deletedCount || totalCount || 0} embeddings indexados.`,
      deleted: deletedCount || totalCount || 0,
      remaining: remainingCount || 0,
      verified: (remainingCount || 0) === 0,
    });
  } catch (error) {
    console.error('Clear embeddings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


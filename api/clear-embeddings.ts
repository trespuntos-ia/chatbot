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
    // IMPORTANTE: Usar SERVICE_ROLE_KEY para poder eliminar sin restricciones RLS
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

    console.log(`[clear-embeddings] Total embeddings antes de eliminar: ${totalCount || 0}`);
    console.log(`[clear-embeddings] Using key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SERVICE_ROLE_KEY' : 'ANON_KEY'}`);

    // Eliminar todos los embeddings usando SQL directo si es posible, o DELETE con condición siempre verdadera
    // Usar .neq('id', -1) que siempre es verdadero para eliminar todos
    const { error: deleteError, count: deletedCount } = await supabase
      .from('product_embeddings')
      .delete()
      .neq('id', -1); // Condición que siempre es verdadera

    if (deleteError) {
      console.error('[clear-embeddings] Error deleting embeddings:', deleteError);
      
      // Si falla con DELETE, intentar con SQL directo usando RPC
      if (deleteError.code === 'PGRST116' || deleteError.message.includes('RLS') || deleteError.message.includes('policy')) {
        console.log('[clear-embeddings] DELETE blocked by RLS, trying SQL approach...');
        
        // Intentar ejecutar SQL directo usando rpc
        const { error: sqlError } = await supabase.rpc('exec_sql', {
          sql: 'DELETE FROM product_embeddings;'
        }).catch(() => ({ error: { message: 'RPC function not available' } }));
        
        if (sqlError) {
          return res.status(500).json({
            error: 'Error deleting embeddings',
            details: deleteError.message,
            hint: 'RLS policies are blocking DELETE. Please use SUPABASE_SERVICE_ROLE_KEY or disable RLS on product_embeddings table.',
            sqlError: sqlError.message,
          });
        }
      } else {
        return res.status(500).json({
          error: 'Error deleting embeddings',
          details: deleteError.message,
          hint: 'RLS policies may be blocking DELETE. Check Supabase policies or use service role key.',
        });
      }
    }

    // Esperar un momento para que se complete la eliminación
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Verificar que se eliminaron
    const { count: remainingCount, error: countError } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[clear-embeddings] Error counting remaining:', countError);
    }

    console.log(`[clear-embeddings] Embeddings restantes después de eliminar: ${remainingCount || 0}`);

    const actuallyDeleted = (totalCount || 0) - (remainingCount || 0);
    const verified = (remainingCount || 0) === 0;

    res.status(200).json({
      success: true,
      message: verified 
        ? `✅ Se eliminaron ${totalCount || 0} embeddings indexados correctamente.`
        : `⚠️ Se intentó eliminar ${totalCount || 0} embeddings. Eliminados: ${actuallyDeleted}, Restantes: ${remainingCount || 0}`,
      deleted: actuallyDeleted,
      attempted: totalCount || 0,
      remaining: remainingCount || 0,
      verified,
      warning: !verified ? 'Algunos embeddings no se pudieron eliminar. Verifica las políticas RLS en Supabase.' : undefined,
    });
  } catch (error) {
    console.error('Clear embeddings error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


import type { VercelRequest, VercelResponse } from '@vercel/node';
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
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    // CRÍTICO: Usar SERVICE_ROLE_KEY para poder eliminar sin restricciones RLS
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'SUPABASE_SERVICE_ROLE_KEY is required for this operation',
      });
      return;
    }

    // Crear cliente con SERVICE_ROLE_KEY (bypass RLS)
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false,
      },
    });

    // Contar antes de eliminar
    const { count: totalCount, error: countError } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    if (countError) {
      console.error('[clear-embeddings-force] Error counting:', countError);
      return res.status(500).json({
        error: 'Error counting embeddings',
        details: countError.message,
      });
    }

    console.log(`[clear-embeddings-force] Total embeddings antes de eliminar: ${totalCount || 0}`);

    // Usar TRUNCATE que es más rápido y eficiente para eliminar todo
    // TRUNCATE no puede ser ejecutado directamente desde Supabase client,
    // así que usamos DELETE con condición siempre verdadera usando SERVICE_ROLE_KEY
    const { error: deleteError } = await supabase
      .from('product_embeddings')
      .delete()
      .neq('id', -1); // Condición que siempre es verdadera

    if (deleteError) {
      console.error('[clear-embeddings-force] Error deleting:', deleteError);
      
      // Si DELETE falla, intentar con SQL directo usando RPC
      console.log('[clear-embeddings-force] DELETE failed, trying SQL RPC...');
      
      // Intentar ejecutar TRUNCATE usando rpc (si existe función exec_sql)
      const { error: truncateError } = await supabase.rpc('exec_sql', {
        sql: 'TRUNCATE TABLE product_embeddings;'
      }).catch(() => ({ error: { message: 'RPC function not available' } }));
      
      if (truncateError) {
        return res.status(500).json({
          error: 'Error deleting embeddings',
          details: deleteError.message,
          truncateError: truncateError.message,
          hint: 'Please check Supabase RLS policies or execute TRUNCATE manually in SQL Editor',
        });
      }
    }

    // Esperar un momento para que se complete la eliminación
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verificar que se eliminaron
    const { count: remainingCount, error: verifyError } = await supabase
      .from('product_embeddings')
      .select('*', { count: 'exact', head: true });

    if (verifyError) {
      console.error('[clear-embeddings-force] Error verifying:', verifyError);
    }

    console.log(`[clear-embeddings-force] Embeddings restantes después de eliminar: ${remainingCount || 0}`);

    const actuallyDeleted = (totalCount || 0) - (remainingCount || 0);
    const verified = (remainingCount || 0) === 0;

    res.status(200).json({
      success: verified,
      message: verified 
        ? `✅ Se eliminaron ${totalCount || 0} embeddings correctamente.`
        : `⚠️ Se intentó eliminar ${totalCount || 0} embeddings. Eliminados: ${actuallyDeleted}, Restantes: ${remainingCount || 0}`,
      deleted: actuallyDeleted,
      attempted: totalCount || 0,
      remaining: remainingCount || 0,
      verified,
    });
  } catch (error) {
    console.error('Clear embeddings force error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


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

    // Nota: La estructura de la tabla debe actualizarse manualmente ejecutando
    // supabase-add-all-categories.sql en Supabase SQL Editor antes de escanear productos

    // Primero obtener el conteo antes de eliminar
    const { count: totalCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    console.log(`Total productos antes de eliminar: ${totalCount || 0}`);

    // Intentar eliminar todos los productos de diferentes maneras
    let deletedCount = 0;
    let error: any = null;

    // Método 1: Intentar eliminar sin condición (si RLS lo permite)
    let result = await supabase
      .from('products')
      .delete()
      .neq('id', -1); // Condición que siempre es verdadera

    if (result.error) {
      console.log('Método 1 falló, intentando método 2:', result.error);
      
      // Método 2: Obtener todos los IDs y eliminar por lotes
      const { data: allProducts } = await supabase
        .from('products')
        .select('id')
        .limit(10000);

      if (allProducts && allProducts.length > 0) {
        const ids = allProducts.map(p => p.id);
        console.log(`Eliminando ${ids.length} productos por lotes...`);
        
        // Eliminar en lotes de 100
        const batchSize = 100;
        for (let i = 0; i < ids.length; i += batchSize) {
          const batch = ids.slice(i, i + batchSize);
          const batchResult = await supabase
            .from('products')
            .delete()
            .in('id', batch);
          
          if (batchResult.error) {
            console.error(`Error eliminando lote ${i}:`, batchResult.error);
            error = batchResult.error;
          } else {
            deletedCount += batch.length;
          }
        }
      } else {
        error = result.error;
      }
    } else {
      deletedCount = result.count || 0;
    }

    if (error && deletedCount === 0) {
      console.error('Supabase error clearing products:', error);
      res.status(500).json({ 
        error: 'Error clearing products',
        details: error.message,
        code: error.code,
        hint: 'RLS policies may be blocking DELETE. Check Supabase policies or use service role key.'
      });
      return;
    }

    // Esperar un momento para que se complete la eliminación
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verificar que realmente se eliminaron
    const { count: remainingCount } = await supabase
      .from('products')
      .select('*', { count: 'exact', head: true });

    console.log(`Productos restantes después de eliminar: ${remainingCount || 0}`);

    // Mensaje informativo sobre la estructura de la tabla
    let structureMessage = '';
    try {
      // Intentar verificar si existe la columna all_categories
      const { data: columnCheck } = await supabase
        .from('products')
        .select('all_categories')
        .limit(1);
      
      if (columnCheck === null || columnCheck.length === 0) {
        // No hay productos, no podemos verificar la columna
        structureMessage = ' Nota: Después de escanear productos, se guardarán con todas las categorías (nivel 1, 2 y 3).';
      }
    } catch (e) {
      // Si no existe la columna, se agregará cuando se guarden productos
      structureMessage = ' Nota: Asegúrate de ejecutar supabase-add-all-categories.sql si aún no lo has hecho.';
    }

    res.status(200).json({ 
      success: true,
      message: (remainingCount === 0 
        ? 'Todos los productos han sido eliminados correctamente.'
        : `Se eliminaron ${deletedCount} productos, pero quedan ${remainingCount} en la base de datos.`) + structureMessage,
      deleted: deletedCount || totalCount || 0,
      remaining: remainingCount || 0,
      verified: (remainingCount || 0) === 0,
      next_steps: [
        'Escanear productos desde PrestaShop',
        'Los productos se guardarán con todas las categorías (nivel 1, 2 y 3)',
        'Asegúrate de que la columna all_categories existe en Supabase (ejecuta supabase-add-all-categories.sql si es necesario)'
      ]
    });
  } catch (error) {
    console.error('Clear products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


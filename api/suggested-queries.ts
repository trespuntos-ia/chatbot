import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Validar variables de entorno
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({
      success: false,
      error: 'Configuración de Supabase faltante. Por favor, configura SUPABASE_URL y SUPABASE_SERVICE_KEY en las variables de entorno de Vercel.'
    });
  }

  // Crear cliente de Supabase dentro del handler
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // GET: Obtener sugerencias
    if (req.method === 'GET') {
      const { all } = req.query;
      
      let query = supabase
        .from('suggested_queries')
        .select('*');
      
      // Si no se pide "all", solo devolver activas
      if (all !== 'true') {
        query = query.eq('is_active', true);
      }
      
      const { data, error } = await query.order('display_order', { ascending: true });

      if (error) {
        const errorMsg = error.message || String(error);
        if (errorMsg.includes('does not exist') || errorMsg.includes('relation') || errorMsg.includes('42P01')) {
          throw new Error('La tabla suggested_queries no existe. Por favor, ejecuta el script SQL en Supabase: supabase-suggested-queries-schema.sql');
        }
        throw error;
      }

      return res.status(200).json({
        success: true,
        queries: data || []
      });
    }

    // POST: Crear nueva sugerencia
    if (req.method === 'POST') {
      const { query_text, display_order, is_active } = req.body;

      if (!query_text || !query_text.trim()) {
        return res.status(400).json({
          success: false,
          error: 'El texto de la sugerencia es requerido'
        });
      }

      const { data, error } = await supabase
        .from('suggested_queries')
        .insert({
          query_text: query_text.trim(),
          display_order: display_order || 0,
          is_active: is_active !== undefined ? is_active : true
        })
        .select()
        .single();

      if (error) throw error;

      return res.status(201).json({
        success: true,
        query: data
      });
    }

    // PUT: Actualizar sugerencias (acepta array completo)
    if (req.method === 'PUT') {
      const { queries } = req.body;

      if (!Array.isArray(queries)) {
        return res.status(400).json({
          success: false,
          error: 'Se requiere un array de sugerencias'
        });
      }

      // Eliminar todas las sugerencias existentes
      // Primero obtener todas las IDs para eliminarlas
      const { data: existingQueries, error: fetchError } = await supabase
        .from('suggested_queries')
        .select('id');

      if (fetchError) {
        // Si la tabla no existe, lanzar error con mensaje claro
        const errorMsg = fetchError.message || String(fetchError);
        if (errorMsg.includes('does not exist') || errorMsg.includes('relation') || errorMsg.includes('42P01')) {
          throw new Error('La tabla suggested_queries no existe. Por favor, ejecuta el script SQL en Supabase: supabase-suggested-queries-schema.sql');
        }
        console.error('Error fetching existing queries:', fetchError);
        throw new Error(`Error al obtener sugerencias existentes: ${errorMsg}`);
      }

      // Si hay queries existentes, eliminarlas
      if (existingQueries && existingQueries.length > 0) {
        const idsToDelete = existingQueries.map((q: any) => q.id);
        const { error: deleteError } = await supabase
          .from('suggested_queries')
          .delete()
          .in('id', idsToDelete);

        if (deleteError) {
          console.error('Error deleting existing queries:', deleteError);
          const errorMsg = deleteError.message || String(deleteError);
          throw new Error(`Error al eliminar sugerencias existentes: ${errorMsg}`);
        }
      }

      // Insertar las nuevas sugerencias
      if (queries.length > 0) {
        const queriesToInsert = queries.map((q: any, index: number) => ({
          query_text: q.query_text?.trim() || '',
          display_order: q.display_order !== undefined ? q.display_order : index + 1,
          is_active: q.is_active !== undefined ? q.is_active : true
        })).filter((q: any) => q.query_text);

        if (queriesToInsert.length > 0) {
          const { data, error: insertError } = await supabase
            .from('suggested_queries')
            .insert(queriesToInsert)
            .select();

          if (insertError) {
            console.error('Error inserting queries:', insertError);
            const errorMsg = insertError.message || String(insertError);
            if (errorMsg.includes('does not exist') || errorMsg.includes('relation') || errorMsg.includes('42P01')) {
              throw new Error('La tabla suggested_queries no existe. Por favor, ejecuta el script SQL en Supabase: supabase-suggested-queries-schema.sql');
            }
            throw new Error(`Error al insertar sugerencias: ${errorMsg}`);
          }

          return res.status(200).json({
            success: true,
            queries: data
          });
        }
      }

      return res.status(200).json({
        success: true,
        queries: []
      });
    }

    // DELETE: Eliminar una sugerencia
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id || typeof id !== 'string') {
        return res.status(400).json({
          success: false,
          error: 'ID de sugerencia requerido'
        });
      }

      const { error } = await supabase
        .from('suggested_queries')
        .delete()
        .eq('id', id);

      if (error) throw error;

      return res.status(200).json({
        success: true,
        message: 'Sugerencia eliminada correctamente'
      });
    }

    return res.status(405).json({
      success: false,
      error: 'Método no permitido'
    });
  } catch (error) {
    console.error('Error en suggested-queries API:', error);
    
    // Asegurar que siempre devolvemos JSON
    let errorMessage = 'Error desconocido';
    
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (typeof error === 'string') {
      errorMessage = error;
    } else if (error && typeof error === 'object') {
      // Intentar extraer mensaje de error de Supabase
      const errorObj = error as any;
      errorMessage = errorObj.message || errorObj.error || JSON.stringify(error);
    }
    
    // Si el error menciona que la tabla no existe, dar un mensaje más claro
    if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('42P01') || errorMessage.includes('no existe')) {
      return res.status(500).json({
        success: false,
        error: 'La tabla suggested_queries no existe. Por favor, ejecuta el script SQL en Supabase: supabase-suggested-queries-schema.sql'
      });
    }
    
    return res.status(500).json({
      success: false,
      error: errorMessage
    });
  }
}


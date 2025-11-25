import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

  try {
    const { confirmation } = req.body || {};

    if (confirmation !== 'BORRAR') {
      res.status(400).json({
        success: false,
        error: 'Confirmación inválida. Escribe BORRAR para confirmar.'
      });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    // Usar SERVICE_KEY para operaciones de DELETE (bypass RLS)
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Configuración de Supabase faltante. Define SUPABASE_URL y SUPABASE_SERVICE_KEY. La SERVICE_KEY es necesaria para operaciones de DELETE.'
      });
      return;
    }

    // Crear cliente con SERVICE_KEY para tener permisos completos
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: {
        persistSession: false
      }
    });

    // Contar registros antes de borrar
    const { count: conversationsCount, error: conversationsCountError } = await supabase
      .from('chat_conversations')
      .select('*', { count: 'exact', head: true });

    if (conversationsCountError) {
      throw conversationsCountError;
    }

    // Borrar TODAS las conversaciones usando función RPC (más confiable)
    let deletedConversationsCount = 0;
    
    try {
      // Intentar usar función RPC primero (más confiable)
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_all_chat_conversations');
      
      if (rpcError) {
        console.warn('RPC no disponible, intentando DELETE directo:', rpcError);
        // Fallback: intentar borrar con condición
        const { error: deleteError } = await supabase
          .from('chat_conversations')
          .delete()
          .gte('created_at', '1970-01-01T00:00:00Z');
        
        if (deleteError) {
          throw deleteError;
        }
        
        // Verificar cuántos registros se eliminaron realmente contando después del DELETE
        const { count: remainingCount, error: countError } = await supabase
          .from('chat_conversations')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('Error al contar registros restantes después del DELETE:', countError);
          // No podemos verificar cuántos se eliminaron, reportar 0 para evitar información incorrecta
          deletedConversationsCount = 0;
          throw new Error(`No se pudo verificar cuántos registros se eliminaron: ${countError.message}`);
        } else {
          // Calcular la diferencia entre antes y después
          const beforeCount = conversationsCount || 0;
          const afterCount = remainingCount || 0;
          deletedConversationsCount = Math.max(0, beforeCount - afterCount);
          
          if (deletedConversationsCount === 0 && beforeCount > 0) {
            console.warn(`⚠️ DELETE ejecutado pero no se eliminaron registros. Posible problema con RLS o permisos. Antes: ${beforeCount}, Después: ${afterCount}`);
          } else if (deletedConversationsCount < beforeCount && beforeCount > 0) {
            console.warn(`Se esperaban eliminar ${beforeCount} conversaciones, pero solo se eliminaron ${deletedConversationsCount}`);
          }
        }
      } else {
        deletedConversationsCount = rpcResult || 0;
      }
    } catch (error) {
      console.error('Error al borrar conversaciones:', error);
      throw new Error(`Error al borrar conversaciones: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    // Contar resúmenes antes de borrar
    const { count: summariesCount, error: summariesCountError } = await supabase
      .from('chat_analytics_summaries')
      .select('*', { count: 'exact', head: true });

    if (summariesCountError) {
      throw summariesCountError;
    }

    // Borrar TODOS los resúmenes usando función RPC
    let deletedSummariesCount = 0;
    
    try {
      // Intentar usar función RPC primero
      const { data: rpcResult, error: rpcError } = await supabase.rpc('delete_all_chat_summaries');
      
      if (rpcError) {
        console.warn('RPC no disponible, intentando DELETE directo:', rpcError);
        // Fallback: intentar borrar con condición
        const { error: deleteError } = await supabase
          .from('chat_analytics_summaries')
          .delete()
          .gte('generated_at', '1970-01-01T00:00:00Z');
        
        if (deleteError) {
          throw deleteError;
        }
        
        // Verificar cuántos registros se eliminaron realmente contando después del DELETE
        const { count: remainingCount, error: countError } = await supabase
          .from('chat_analytics_summaries')
          .select('*', { count: 'exact', head: true });
        
        if (countError) {
          console.error('Error al contar registros restantes después del DELETE:', countError);
          // No podemos verificar cuántos se eliminaron, reportar 0 para evitar información incorrecta
          deletedSummariesCount = 0;
          throw new Error(`No se pudo verificar cuántos registros se eliminaron: ${countError.message}`);
        } else {
          // Calcular la diferencia entre antes y después
          const beforeCount = summariesCount || 0;
          const afterCount = remainingCount || 0;
          deletedSummariesCount = Math.max(0, beforeCount - afterCount);
          
          if (deletedSummariesCount === 0 && beforeCount > 0) {
            console.warn(`⚠️ DELETE ejecutado pero no se eliminaron registros. Posible problema con RLS o permisos. Antes: ${beforeCount}, Después: ${afterCount}`);
          } else if (deletedSummariesCount < beforeCount && beforeCount > 0) {
            console.warn(`Se esperaban eliminar ${beforeCount} resúmenes, pero solo se eliminaron ${deletedSummariesCount}`);
          }
        }
      } else {
        deletedSummariesCount = rpcResult || 0;
      }
    } catch (error) {
      console.error('Error al borrar resúmenes:', error);
      throw new Error(`Error al borrar resúmenes: ${error instanceof Error ? error.message : 'Error desconocido'}`);
    }

    res.status(200).json({
      success: true,
      message: 'Todas las estadísticas del chat fueron eliminadas correctamente.',
      deleted: {
        conversations: deletedConversationsCount,
        summaries: deletedSummariesCount
      }
    });
  } catch (error) {
    console.error('Error al resetear analytics de chat:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}







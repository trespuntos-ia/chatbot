import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,PUT,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST' && req.method !== 'PUT') {
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

    const { 
      id,
      name,
      prestashop_url,
      api_key,
      base_url,
      lang_code,
      lang_slug,
      is_active
    } = req.body;

    if (!prestashop_url || !api_key) {
      res.status(400).json({ 
        error: 'prestashop_url and api_key are required' 
      });
      return;
    }

    const connectionData = {
      name: name || 'Default Connection',
      prestashop_url,
      api_key,
      base_url: base_url || null,
      lang_code: lang_code || 1,
      lang_slug: lang_slug || 'es',
      is_active: is_active !== undefined ? is_active : true,
      updated_at: new Date().toISOString()
    };

    let result;

    if (req.method === 'PUT' && id) {
      // Actualizar conexión existente
      const { data, error } = await supabase
        .from('prestashop_connections')
        .update(connectionData)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Desactivar otras conexiones si esta es activa
      if (connectionData.is_active) {
        await supabase
          .from('prestashop_connections')
          .update({ is_active: false })
          .neq('id', id || '00000000-0000-0000-0000-000000000000');
      }

      // Crear nueva conexión
      const { data, error } = await supabase
        .from('prestashop_connections')
        .insert({
          ...connectionData,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.status(200).json({ 
      success: true,
      connection: result
    });
  } catch (error) {
    console.error('Save connection error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

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

    // Obtener parámetros de query
    const { 
      limit = '50', 
      offset = '0', 
      category,
      search 
    } = req.query;

    // Construir query base - simplificada para evitar errores
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Aplicar filtros
    if (category && typeof category === 'string') {
      query = query.ilike('category', `%${category}%`);
    }

    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Ordenar por id (siempre existe) - más seguro
    query = query.order('id', { ascending: false });

    // Ejecutar query
    let { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      res.status(500).json({ 
        error: 'Error fetching products',
        details: error.message,
        code: error.code,
        hint: error.code === 'PGRST116' ? 'Columna no encontrada. Verifica que la tabla products existe y tiene las columnas correctas.' : undefined
      });
      return;
    }

    // Si tenemos datos, ordenar localmente por date_add si existe, sino por created_at
    if (data && data.length > 0) {
      data = data.sort((a: any, b: any) => {
        // Priorizar date_add si existe
        if (a.date_add && b.date_add) {
          return new Date(b.date_add).getTime() - new Date(a.date_add).getTime();
        }
        if (a.date_add) return -1;
        if (b.date_add) return 1;
        
        // Si no hay date_add, usar created_at
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        if (a.created_at) return -1;
        if (b.created_at) return 1;
        
        // Por último, usar id
        return (b.id || 0) - (a.id || 0);
      });

      // Aplicar paginación manualmente
      const start = parseInt(offset as string);
      const end = start + parseInt(limit as string);
      data = data.slice(start, end);
      
      // Actualizar count para reflejar el total real
      count = count || data.length;
    }

    res.status(200).json({ 
      success: true,
      products: data || [],
      total: count || 0,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string)
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


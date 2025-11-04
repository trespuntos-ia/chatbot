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

    // Query básica - sin ordenar en Supabase para evitar errores
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Filtrar por categoría si se proporciona
    if (category && typeof category === 'string') {
      query = query.ilike('category', `%${category}%`);
    }

    // Buscar por nombre o SKU si se proporciona
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Ejecutar query sin ordenar
    const { data, error, count } = await query;

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Error fetching products',
        details: error.message 
      });
      return;
    }

    // Ordenar localmente si tenemos datos
    let sortedData = data || [];
    if (sortedData.length > 0) {
      sortedData = sortedData.sort((a: any, b: any) => {
        // Intentar ordenar por date_add si existe
        if (a.date_add && b.date_add) {
          return new Date(b.date_add).getTime() - new Date(a.date_add).getTime();
        }
        if (a.date_add) return -1;
        if (b.date_add) return 1;
        // Si no, por created_at
        if (a.created_at && b.created_at) {
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        }
        // Por último, por id
        return (b.id || 0) - (a.id || 0);
      });
    }

    // Aplicar paginación
    const start = parseInt(offset as string);
    const end = start + parseInt(limit as string);
    const paginatedData = sortedData.slice(start, end);

    res.status(200).json({ 
      success: true,
      products: paginatedData,
      total: count || sortedData.length,
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

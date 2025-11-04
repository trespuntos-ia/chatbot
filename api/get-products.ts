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

    // Construir query base - ordenar por created_at por defecto (más seguro)
    // Si la columna date_add existe, se puede cambiar después
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);

    // Filtrar por categoría si se proporciona (buscar en el campo que puede contener múltiples categorías)
    if (category && typeof category === 'string') {
      query = query.ilike('category', `%${category}%`);
    }

    // Buscar por nombre o SKU si se proporciona
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Intentar ordenar por date_add si existe, sino usar created_at
    let { data, error, count } = await query;

    // Si hay error al ordenar por created_at, intentar sin orden específico
    if (error && error.code === 'PGRST116') {
      // Error de columna no encontrada, intentar sin orden específico
      query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .range(parseInt(offset as string), parseInt(offset as string) + parseInt(limit as string) - 1);
      
      if (category && typeof category === 'string') {
        query = query.ilike('category', `%${category}%`);
      }
      
      if (search && typeof search === 'string') {
        query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }
      
      const result = await query;
      data = result.data;
      error = result.error;
      count = result.count;
    }

    if (error) {
      console.error('Supabase error:', error);
      res.status(500).json({ 
        error: 'Error fetching products',
        details: error.message,
        code: error.code 
      });
      return;
    }

    // Si tenemos datos y algunos tienen date_add, ordenar localmente por date_add
    if (data && data.length > 0 && data.some((p: any) => p.date_add)) {
      data = data.sort((a: any, b: any) => {
        if (!a.date_add) return 1;
        if (!b.date_add) return -1;
        return new Date(b.date_add).getTime() - new Date(a.date_add).getTime();
      });
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


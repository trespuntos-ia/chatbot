import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API para buscar contenido web indexado
 * 
 * GET /api/search-web-content?query=texto&limit=10
 * 
 * Busca en el contenido indexado usando búsqueda full-text de PostgreSQL
 */
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

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({
      error: 'Supabase configuration missing'
    });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const query = req.query.query as string;
    const limit = parseInt(req.query.limit as string) || 10;
    const content_type = req.query.content_type as string;
    const product_id = req.query.product_id as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({
        error: 'Missing query parameter',
        details: 'The query parameter is required'
      });
      return;
    }

    // Construir consulta de búsqueda full-text
    let dbQuery = supabase
      .from('web_content_index')
      .select('id, url, title, content, metadata, content_type, source, product_id, last_updated_at')
      .eq('status', 'active')
      .limit(limit);

    // Búsqueda full-text usando PostgreSQL
    // Buscar en título y contenido
    const searchTerms = query
      .split(/\s+/)
      .filter(t => t.length > 0)
      .map(t => t.trim())
      .join(' & ');

    // Usar función de búsqueda full-text de PostgreSQL
    // Nota: Esto requiere que Supabase permita funciones personalizadas
    // Alternativa: usar ilike para búsqueda simple
    dbQuery = dbQuery.or(`title.ilike.%${query}%,content.ilike.%${query}%`);

    // Filtrar por tipo de contenido si se especifica
    if (content_type) {
      dbQuery = dbQuery.eq('content_type', content_type);
    }

    // Filtrar por producto si se especifica
    if (product_id) {
      dbQuery = dbQuery.eq('product_id', product_id);
    }

    const { data, error } = await dbQuery;

    if (error) throw error;

    // Ordenar por relevancia (simplificado: por longitud de coincidencia)
    const sorted = (data || []).sort((a, b) => {
      const aScore = calculateRelevanceScore(a, query);
      const bScore = calculateRelevanceScore(b, query);
      return bScore - aScore;
    });

    // Limitar resultados
    const limitedResults = sorted.slice(0, limit);

    // Formatear resultados
    const results = limitedResults.map(item => ({
      id: item.id,
      url: item.url,
      title: item.title,
      snippet: extractSnippet(item.content, query, 200),
      metadata: item.metadata,
      content_type: item.content_type,
      source: item.source,
      product_id: item.product_id,
      last_updated_at: item.last_updated_at
    }));

    res.status(200).json({
      success: true,
      query,
      results,
      total: results.length
    });

  } catch (error) {
    console.error('Search web content error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Calcula un score de relevancia simple
 */
function calculateRelevanceScore(item: any, query: string): number {
  const queryLower = query.toLowerCase();
  const titleLower = (item.title || '').toLowerCase();
  const contentLower = (item.content || '').toLowerCase();

  let score = 0;

  // Título tiene más peso
  if (titleLower.includes(queryLower)) {
    score += 10;
    // Si está al inicio del título, más puntos
    if (titleLower.startsWith(queryLower)) {
      score += 5;
    }
  }

  // Contenido
  if (contentLower.includes(queryLower)) {
    score += 1;
    // Contar ocurrencias
    const occurrences = (contentLower.match(new RegExp(queryLower, 'g')) || []).length;
    score += Math.min(occurrences, 5);
  }

  // Metadata
  if (item.metadata) {
    const metadataStr = JSON.stringify(item.metadata).toLowerCase();
    if (metadataStr.includes(queryLower)) {
      score += 2;
    }
  }

  return score;
}

/**
 * Extrae un snippet del contenido alrededor de la búsqueda
 */
function extractSnippet(content: string, query: string, maxLength: number): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const index = contentLower.indexOf(queryLower);

  if (index === -1) {
    // No encontrado, devolver inicio
    return content.substring(0, maxLength) + (content.length > maxLength ? '...' : '');
  }

  // Extraer alrededor de la coincidencia
  const start = Math.max(0, index - 50);
  const end = Math.min(content.length, index + query.length + 50);
  
  let snippet = content.substring(start, end);
  
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';

  // Resaltar término (opcional)
  snippet = snippet.replace(
    new RegExp(query, 'gi'),
    match => `**${match}**`
  );

  return snippet;
}







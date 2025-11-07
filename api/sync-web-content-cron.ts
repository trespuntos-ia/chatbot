import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * API Cron para actualizar contenido web cada noche
 * 
 * Esta función:
 * 1. Busca URLs que necesitan actualización (next_check_at <= now)
 * 2. Scrapea cada URL
 * 3. Compara hash para ver si cambió
 * 4. Actualiza solo si hay cambios
 * 
 * Se puede llamar manualmente o configurar en Vercel Cron
 * 
 * GET/POST /api/sync-web-content-cron
 * Query params:
 *   - limit: número máximo de URLs a procesar (default: 50)
 *   - force: forzar actualización aunque no haya cambios (default: false)
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({
      error: 'Supabase configuration missing'
    });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const force = req.query.force === 'true';

    // 1. Obtener URLs que necesitan actualización
    // Primero de web_content_sources (configuración)
    const { data: sources, error: sourcesError } = await supabase
      .from('web_content_sources')
      .select('*')
      .eq('enabled', true)
      .lte('next_scrape_at', new Date().toISOString())
      .order('priority', { ascending: false })
      .order('next_scrape_at', { ascending: true })
      .limit(limit);

    if (sourcesError) throw sourcesError;

    // También obtener de web_content_index (contenido ya indexado)
    const { data: indexedContent, error: indexedError } = await supabase
      .from('web_content_index')
      .select('url, next_check_at, status')
      .eq('status', 'active')
      .lte('next_check_at', new Date().toISOString())
      .limit(limit - (sources?.length || 0));

    if (indexedError) throw indexedError;

    // Combinar URLs únicas
    const urlsToCheck = new Set<string>();
    
    if (sources) {
      sources.forEach((s: any) => urlsToCheck.add(s.url));
    }
    
    if (indexedContent) {
      indexedContent.forEach((c: any) => urlsToCheck.add(c.url));
    }

    if (urlsToCheck.size === 0) {
      res.status(200).json({
        success: true,
        message: 'No URLs need updating',
        processed: 0,
        updated: 0,
        unchanged: 0,
        errors: 0
      });
      return;
    }

    // 2. Procesar cada URL
    const results = {
      processed: 0,
      updated: 0,
      unchanged: 0,
      errors: 0,
      details: [] as any[]
    };

    for (const url of Array.from(urlsToCheck).slice(0, limit)) {
      try {
        results.processed++;

        // Llamar a la API de indexación
        const indexResponse = await fetch(
          `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}/api/index-web-content`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              url,
              force
            })
          }
        );

        const indexData = await indexResponse.json();

        if (indexData.success) {
          if (indexData.unchanged) {
            results.unchanged++;
            results.details.push({ url, status: 'unchanged' });
          } else {
            results.updated++;
            results.details.push({ url, status: 'updated', changed: indexData.changed });
          }
        } else {
          results.errors++;
          results.details.push({ url, status: 'error', error: indexData.error });
          
          // Marcar como error en la base de datos
          await supabase
            .from('web_content_index')
            .update({
              status: 'error',
              error_message: indexData.error || 'Unknown error',
              last_scraped_at: new Date().toISOString()
            })
            .eq('url', url);
        }
      } catch (error) {
        results.errors++;
        results.details.push({
          url,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    res.status(200).json({
      success: true,
      message: `Processed ${results.processed} URLs`,
      ...results,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Sync web content cron error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}







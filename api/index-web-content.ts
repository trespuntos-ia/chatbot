import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

/**
 * API para indexar contenido web
 * 
 * POST /api/index-web-content
 * Body: { url: string, content_type?: string, product_id?: number }
 * 
 * Esta API scrapea una URL y guarda el contenido en la base de datos.
 * Si el contenido ya existe y no ha cambiado (mismo hash), no lo actualiza.
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
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
    const { url, content_type = 'product_page', product_id, force = false } = req.body;

    if (!url || typeof url !== 'string') {
      res.status(400).json({
        error: 'Missing or invalid url',
        details: 'The url field is required and must be a string'
      });
      return;
    }

    // Validar URL
    try {
      new URL(url);
    } catch {
      res.status(400).json({
        error: 'Invalid URL format'
      });
      return;
    }

    // Scrapear contenido
    const scrapedContent = await scrapeWebContent(url);

    if (scrapedContent.error) {
      res.status(500).json({
        success: false,
        error: 'Failed to scrape content',
        details: scrapedContent.error,
        url
      });
      return;
    }

    // Calcular hash del contenido
    const contentHash = crypto
      .createHash('sha256')
      .update(scrapedContent.content || '')
      .digest('hex');

    // Verificar si ya existe y si ha cambiado
    const { data: existing } = await supabase
      .from('web_content_index')
      .select('id, content_hash, last_scraped_at, scrape_count')
      .eq('url', url)
      .single();

    // Si existe y no ha cambiado, y no es forzado, no actualizar
    if (existing && existing.content_hash === contentHash && !force) {
      res.status(200).json({
        success: true,
        message: 'Content unchanged, no update needed',
        url,
        last_scraped_at: existing.last_scraped_at,
        unchanged: true
      });
      return;
    }

    // Preparar datos para insertar/actualizar
    const contentData: any = {
      url,
      title: scrapedContent.title || url,
      content: scrapedContent.content || '',
      content_hash: contentHash,
      content_type,
      metadata: scrapedContent.metadata || {},
      source: new URL(url).hostname,
      last_scraped_at: new Date().toISOString(),
      next_check_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Próxima verificación en 24h
      status: 'active',
      error_message: null
    };

    if (product_id) {
      contentData.product_id = product_id;
    }

    if (existing) {
      // Actualizar existente
      contentData.scrape_count = (existing.scrape_count || 0) + 1;
      
      const { data: updated, error: updateError } = await supabase
        .from('web_content_index')
        .update(contentData)
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) throw updateError;

      res.status(200).json({
        success: true,
        message: 'Content updated successfully',
        content: updated,
        changed: existing.content_hash !== contentHash
      });
    } else {
      // Insertar nuevo
      contentData.scrape_count = 1;
      
      const { data: inserted, error: insertError } = await supabase
        .from('web_content_index')
        .insert(contentData)
        .select()
        .single();

      if (insertError) throw insertError;

      res.status(201).json({
        success: true,
        message: 'Content indexed successfully',
        content: inserted
      });
    }

    // Actualizar web_content_sources si existe
    const { data: source } = await supabase
      .from('web_content_sources')
      .select('id')
      .eq('url', url)
      .single();

    if (source) {
      await supabase
        .from('web_content_sources')
        .update({ last_scraped_at: new Date().toISOString() })
        .eq('id', source.id);
    }

  } catch (error) {
    console.error('Index web content error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Función para scrapear contenido web
 */
async function scrapeWebContent(url: string): Promise<{
  title?: string;
  content: string;
  metadata?: Record<string, any>;
  error?: string;
}> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 segundos timeout

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatbotWebIndexer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      return { content: '', error: `HTTP ${response.status}` };
    }

    const html = await response.text();
    const result: {
      title?: string;
      content: string;
      metadata?: Record<string, any>;
    } = {
      content: '',
      metadata: {}
    };

    // Extraer título
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/is);
    if (titleMatch) {
      result.title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
    }

    // Extraer contenido principal (eliminar scripts, styles, etc.)
    let cleanHtml = html
      .replace(/<script[^>]*>.*?<\/script>/gis, '')
      .replace(/<style[^>]*>.*?<\/style>/gis, '')
      .replace(/<noscript[^>]*>.*?<\/noscript>/gis, '');

    // Extraer texto del body
    const bodyMatch = cleanHtml.match(/<body[^>]*>(.*?)<\/body>/is);
    if (bodyMatch) {
      cleanHtml = bodyMatch[1];
    }

    // Extraer texto limpio
    result.content = cleanHtml
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 50000); // Limitar a 50k caracteres

    // Extraer metadata estructurada
    const metadata: Record<string, any> = {};

    // Meta description
    const metaDescMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDescMatch) {
      metadata.description = metaDescMatch[1].trim();
    }

    // JSON-LD
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.description) metadata.description = jsonLd.description;
        if (jsonLd.name) metadata.name = jsonLd.name;
        if (jsonLd.offers) metadata.offers = jsonLd.offers;
      } catch (e) {
        // Ignorar errores de parsing
      }
    }

    // Características (listas)
    const features: string[] = [];
    const featureListMatch = cleanHtml.match(/<(ul|ol)[^>]*>(.*?)<\/\1>/is);
    if (featureListMatch) {
      const listItems = featureListMatch[2].match(/<li[^>]*>(.*?)<\/li>/gis);
      if (listItems) {
        listItems.slice(0, 10).forEach((item: string) => {
          const text = item.replace(/<[^>]+>/g, '').trim();
          if (text.length > 10 && text.length < 200) {
            features.push(text);
          }
        });
      }
    }
    if (features.length > 0) {
      metadata.features = features;
    }

    // Especificaciones (tablas)
    const specifications: Record<string, string> = {};
    const tableMatch = cleanHtml.match(/<table[^>]*>(.*?)<\/table>/is);
    if (tableMatch) {
      const rows = tableMatch[1].match(/<tr[^>]*>(.*?)<\/tr>/gis);
      if (rows) {
        rows.slice(0, 15).forEach((row: string) => {
          const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);
          if (cells && cells.length >= 2) {
            const key = cells[0].replace(/<[^>]+>/g, '').trim();
            const value = cells[1].replace(/<[^>]+>/g, '').trim();
            if (key && value && key.length < 50 && value.length < 200) {
              specifications[key] = value;
            }
          }
        });
      }
    }
    if (Object.keys(specifications).length > 0) {
      metadata.specifications = specifications;
    }

    result.metadata = metadata;

    return result;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { content: '', error: 'Timeout' };
      }
      return { content: '', error: error.message };
    }
    return { content: '', error: 'Unknown error' };
  }
}


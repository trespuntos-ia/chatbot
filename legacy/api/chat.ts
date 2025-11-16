import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

type ChatRole = 'user' | 'assistant' | 'system';

type SourceTag = 'products_db' | 'categories' | 'web';

interface CategoryInfo {
  category: string;
  subcategory: string | null;
  subsubcategory?: string | null;
  hierarchy?: string[] | null;
  category_id?: number;
  is_primary?: boolean;
}

interface ProductRecord {
  id: number;
  name: string;
  price: string | null;
  category: string | null;
  subcategory?: string | null;
  description: string | null;
  sku: string | null;
  image_url?: string | null;
  image?: string | null;
  product_url: string | null;
  date_add?: string | null;
  colors?: string[] | null;
  all_categories?: CategoryInfo[] | null;
}

interface Product {
  id?: number;
  name: string;
  price: string;
  category: string;
  subcategory: string | null;
  description: string;
  sku: string;
  image: string;
  product_url: string;
  date_add?: string | null;
  colors?: string[] | null;
  all_categories?: CategoryInfo[] | null;
}

interface ChatMessage {
  role: ChatRole;
  content: string;
  products?: Product[];
  sources?: SourceTag[];
  function_result?: unknown;
}

interface ProductMatch {
  product: Product;
  matched_fields: Array<'name' | 'description' | 'product_url'>;
}

interface CategoryMatch {
  category?: string | null;
  subcategory?: string | null;
  hierarchy?: string[] | null;
  matched_field: 'category' | 'subcategory' | 'all_categories';
}

interface WebContentMatch {
  id: string;
  title: string | null;
  url: string;
  content_type: string | null;
  product_id: number | null;
  matched_field: 'title' | 'url';
}

interface SupportingDocument {
  id: number;
  original_filename: string | null;
  file_type: string | null;
  created_at?: string | null;
}

interface SupportingVideo {
  id: number;
  title: string | null;
  youtube_url: string;
  created_at?: string | null;
}

interface SupportingContent {
  by_product: Record<
    number,
    {
      documents: SupportingDocument[];
      videos: SupportingVideo[];
    }
  >;
  total_documents: number;
  total_videos: number;
}

interface ExactMatchResult {
  original_query: string;
  normalized_query: string;
  products: ProductMatch[];
  categories: CategoryMatch[];
  web_content: WebContentMatch[];
}

function setCorsHeaders(res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );
}

function stripHtml(value: string | null | undefined): string {
  if (!value) return '';
  return value.replace(/<[^>]+>/g, ' ');
}

function normalize(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Palabras comunes en español que debemos ignorar al extraer palabras clave
const STOP_WORDS = new Set([
  'el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas',
  'de', 'del', 'en', 'a', 'al', 'con', 'por', 'para', 'sobre',
  'que', 'quien', 'quienes', 'cual', 'cuales',
  'quiero', 'quieres', 'quiere', 'queremos', 'quieren',
  'informacion', 'información', 'datos', 'sobre', 'acerca',
  'me', 'te', 'le', 'nos', 'les',
  'es', 'son', 'está', 'están', 'estoy', 'estamos',
  'tengo', 'tienes', 'tiene', 'tenemos', 'tienen',
  'hacer', 'hago', 'haces', 'hace', 'hacemos', 'hacen',
  'ver', 'mostrar', 'buscar', 'encontrar', 'necesito', 'necesitas',
]);

// Extraer palabras clave relevantes de una consulta
function extractKeywords(query: string): string[] {
  const normalized = normalize(query);
  const words = normalized.split(/\s+/).filter(w => w.length > 0);
  
  // Filtrar palabras comunes y mantener solo palabras significativas
  let keywords = words
    .filter(word => !STOP_WORDS.has(word) && word.length >= 2)
    .filter((word, index, arr) => arr.indexOf(word) === index); // Eliminar duplicados
  
  // Si no hay palabras clave después de filtrar, usar todas las palabras de 3+ caracteres
  if (keywords.length === 0) {
    keywords = words.filter(w => w.length >= 3);
  }
  
  // Si aún no hay keywords, usar la consulta completa normalizada (para casos como "TwinStones")
  if (keywords.length === 0 && normalized.length >= 3) {
    keywords = [normalized];
  }
  
  // Asegurar que tenemos al menos una palabra clave
  if (keywords.length === 0 && query.trim().length > 0) {
    // Usar la consulta original normalizada como última opción
    keywords = [normalize(query.trim())];
  }
  
  return keywords;
}

function matchesNormalized(candidate: unknown, normalizedQuery: string): boolean {
  if (typeof candidate !== 'string') return false;
  const normalizedCandidate = normalize(stripHtml(candidate));

  if (normalizedCandidate.length === 0 || normalizedQuery.length === 0) {
    return false;
  }

  if (normalizedCandidate === normalizedQuery) {
    return true;
  }

  if (normalizedCandidate.length >= 3 && normalizedQuery.includes(normalizedCandidate)) {
    return true;
  }

  if (normalizedQuery.length >= 3 && normalizedCandidate.includes(normalizedQuery)) {
    return true;
  }

  return false;
}

function mapProduct(record: ProductRecord): Product {
  return {
    id: record.id,
    name: record.name ?? '',
    price: record.price ?? '',
    category: record.category ?? '',
    subcategory: record.subcategory ?? null,
    description: stripHtml(record.description),
    sku: record.sku ?? '',
    image: record.image_url ?? record.image ?? '',
    product_url: record.product_url ?? '',
    date_add: record.date_add ?? null,
    colors: Array.isArray(record.colors) ? record.colors : null,
    all_categories: Array.isArray(record.all_categories) ? record.all_categories : null,
  };
}

async function findExactProductMatches(
  supabase: SupabaseClient,
  query: string,
  normalizedQuery: string
): Promise<ProductMatch[]> {
  if (!query.trim()) return [];

  try {
    const selectFields =
      'id,name,price,category,subcategory,description,sku,image_url,image,product_url,date_add,colors,all_categories';

    // Extraer palabras clave de la consulta
    const keywords = extractKeywords(query);
    console.log('[chat] findExactProductMatches', {
      query,
      normalizedQuery,
      keywords,
      keywordsCount: keywords.length,
    });
    
    // Si hay palabras clave, buscar productos que las contengan
    // Si no hay palabras clave, usar la consulta original
    const searchTerms = keywords.length > 0 ? keywords : [normalizedQuery];
    
    // Construir consultas de búsqueda para cada palabra clave
    const searchQueries: Promise<any>[] = [];
    
    for (const term of searchTerms) {
      if (term.length < 2) continue;
      
      // Buscar productos cuyo nombre, descripción o URL contenga el término
      searchQueries.push(
        supabase.from('products').select(selectFields).ilike('name', `%${term}%`).limit(50),
        supabase.from('products').select(selectFields).ilike('description', `%${term}%`).limit(50),
        supabase.from('products').select(selectFields).ilike('product_url', `%${term}%`).limit(50),
        supabase.from('products').select(selectFields).ilike('sku', `%${term}%`).limit(50),
      );
    }
    
    // También buscar con la consulta completa normalizada (por si acaso)
    if (normalizedQuery.length >= 3) {
      searchQueries.push(
        supabase.from('products').select(selectFields).ilike('name', `%${normalizedQuery}%`).limit(50),
        supabase.from('products').select(selectFields).ilike('description', `%${normalizedQuery}%`).limit(50),
      );
    }

    const allResults = await Promise.all(searchQueries);
    
    // Agrupar todos los resultados sin duplicados
    const allCandidates = new Map<number, ProductRecord>();
    const errors: any[] = [];
    
    for (const result of allResults) {
      if (result.error) {
        errors.push(result.error);
      } else if (Array.isArray(result.data)) {
        for (const record of result.data) {
          if (record && typeof record.id === 'number') {
            allCandidates.set(record.id, record);
          }
        }
      }
    }

    const candidates = Array.from(allCandidates.values());
    
    console.log('[chat] findExactProductMatches results', {
      candidatesCount: candidates.length,
      searchTerms,
      errorsCount: errors.length,
    });

    if (errors.length > 0) {
      console.error('[chat] findExactProductMatches errors', errors);
      // Si hay errores críticos (no solo "no encontrado"), lanzar el error
      const criticalErrors = errors.filter((e: any) => {
        if (!e) return false;
        const code = e.code || '';
        const message = (e.message || '').toLowerCase();
        // Errores que no son críticos: PGRST116 (no encontrado), etc.
        return !code.includes('PGRST116') && !message.includes('not found');
      });
      if (criticalErrors.length > 0) {
        throw new Error(`Database query failed: ${JSON.stringify(criticalErrors)}`);
      }
    }

    const matches = new Map<string, ProductMatch>();

    // Si encontramos candidatos con .ilike(), los aceptamos directamente
    // porque ya pasaron el filtro de búsqueda en la base de datos
    for (const record of candidates) {
      if (!record) continue;
      
      const matchedFields: ProductMatch['matched_fields'] = [];
      const normalizedName = normalize(stripHtml(record.name || ''));
      const normalizedDesc = normalize(stripHtml(record.description || ''));
      const normalizedUrl = normalize(record.product_url || '');
      const normalizedSku = normalize(record.sku || '');

      // Si encontramos el producto con .ilike(), significa que hay coincidencia
      // Verificamos en qué campo se encontró
      let nameMatches = false;
      let descMatches = false;
      let urlMatches = false;

      if (keywords.length > 0) {
        // Buscar coincidencias con palabras clave (búsqueda bidireccional)
        for (const kw of keywords) {
          if (!nameMatches && (normalizedName.includes(kw) || kw.includes(normalizedName) || normalizedSku.includes(kw))) {
            nameMatches = true;
          }
          if (!descMatches && (normalizedDesc.includes(kw) || kw.includes(normalizedDesc))) {
            descMatches = true;
          }
          if (!urlMatches && (normalizedUrl.includes(kw) || kw.includes(normalizedUrl))) {
            urlMatches = true;
          }
        }
      }
      
      // También verificar con la consulta completa normalizada
      if (!nameMatches) {
        nameMatches = matchesNormalized(record.name, normalizedQuery) || 
                     matchesNormalized(record.sku, normalizedQuery) ||
                     (normalizedQuery.length >= 3 && (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)));
      }
      if (!descMatches) {
        descMatches = matchesNormalized(record.description, normalizedQuery) ||
                     (normalizedQuery.length >= 3 && (normalizedDesc.includes(normalizedQuery) || normalizedQuery.includes(normalizedDesc)));
      }
      if (!urlMatches) {
        urlMatches = matchesNormalized(record.product_url, normalizedQuery) ||
                    (normalizedQuery.length >= 3 && (normalizedUrl.includes(normalizedQuery) || normalizedQuery.includes(normalizedUrl)));
      }

      // Si encontramos el producto con .ilike(), aceptarlo directamente
      // .ilike() ya filtró por coincidencias parciales, así que confiamos en eso
      if (nameMatches) matchedFields.push('name');
      if (descMatches) matchedFields.push('description');
      if (urlMatches) matchedFields.push('product_url');
      
      // Si no hay coincidencia exacta pero el producto fue encontrado por .ilike(),
      // asumimos que hay coincidencia (probablemente en el nombre, que es el campo más común)
      if (matchedFields.length === 0) {
        matchedFields.push('name');
      }

      try {
        const product = mapProduct(record);
        const key =
          typeof record.id === 'number'
            ? `id:${record.id}`
            : `text:${normalize(product.sku || product.name)}`;

        if (matches.has(key)) {
          const existing = matches.get(key)!;
          const merged = Array.from(new Set([...existing.matched_fields, ...matchedFields]));
          matches.set(key, { product: existing.product, matched_fields: merged as ProductMatch['matched_fields'] });
        } else {
          matches.set(key, { product, matched_fields: matchedFields });
        }
      } catch (mapError) {
        console.error('[chat] Error mapping product', { record, error: mapError });
        continue;
      }
    }

    return Array.from(matches.values());
  } catch (error) {
    console.error('[chat] findExactProductMatches error', error);
    throw error;
  }
}

async function findExactCategoryMatches(
  supabase: SupabaseClient,
  query: string,
  normalizedQuery: string
): Promise<CategoryMatch[]> {
  if (!query.trim()) return [];

  try {
    const selectFields = 'category,subcategory,all_categories';
    const [categoryRes, subcategoryRes] = await Promise.all([
      supabase.from('products').select(selectFields).ilike('category', query.trim()).limit(200),
      supabase.from('products').select(selectFields).ilike('subcategory', query.trim()).limit(200),
    ]);

    const errors = [categoryRes.error, subcategoryRes.error].filter(Boolean);
    if (errors.length > 0) {
      console.error('[chat] findExactCategoryMatches errors', errors);
      // Si hay errores críticos (no solo "no encontrado"), lanzar el error
      const criticalErrors = errors.filter((e: any) => {
        if (!e) return false;
        const code = e.code || '';
        const message = (e.message || '').toLowerCase();
        return !code.includes('PGRST116') && !message.includes('not found');
      });
      if (criticalErrors.length > 0) {
        throw new Error(`Database query failed: ${JSON.stringify(criticalErrors)}`);
      }
      return [];
    }

    const matches: CategoryMatch[] = [];
    const seen = new Set<string>();

    const rows = [...(categoryRes.data ?? []), ...(subcategoryRes.data ?? [])];

    for (const row of rows) {
      if (!row) continue;
      
      if (matchesNormalized(row?.category, normalizedQuery)) {
        const key = `category:${normalize(row?.category ?? '')}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({ category: row?.category ?? null, matched_field: 'category' });
        }
      }

      if (matchesNormalized(row?.subcategory, normalizedQuery)) {
        const key = `subcategory:${normalize(row?.category ?? '')}|${normalize(row?.subcategory ?? '')}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({
            category: row?.category ?? null,
            subcategory: row?.subcategory ?? null,
            matched_field: 'subcategory',
          });
        }
      }

      if (Array.isArray(row?.all_categories)) {
        for (const item of row.all_categories) {
          if (!item) continue;
          
          if (matchesNormalized((item as CategoryInfo)?.category, normalizedQuery)) {
            const key = `allcat:${normalize(String((item as CategoryInfo)?.category ?? ''))}`;
            if (!seen.has(key)) {
              seen.add(key);
              matches.push({
                category: (item as CategoryInfo)?.category ?? null,
                hierarchy: Array.isArray((item as CategoryInfo)?.hierarchy)
                  ? (item as CategoryInfo)?.hierarchy!
                  : null,
                matched_field: 'all_categories',
              });
            }
          }

          if (matchesNormalized((item as CategoryInfo)?.subcategory ?? undefined, normalizedQuery)) {
            const key = `allsub:${normalize(String((item as CategoryInfo)?.subcategory ?? ''))}`;
            if (!seen.has(key)) {
              seen.add(key);
              matches.push({
                category: (item as CategoryInfo)?.category ?? null,
                subcategory: (item as CategoryInfo)?.subcategory ?? null,
                hierarchy: Array.isArray((item as CategoryInfo)?.hierarchy)
                  ? (item as CategoryInfo)?.hierarchy!
                  : null,
                matched_field: 'all_categories',
              });
            }
          }
        }
      }
    }

    return matches;
  } catch (error) {
    console.error('[chat] findExactCategoryMatches error', error);
    throw error;
  }
}

async function findExactWebContentMatches(
  supabase: SupabaseClient,
  query: string,
  normalizedQuery: string
): Promise<WebContentMatch[]> {
  if (!query.trim()) return [];

  try {
    const selectFields = 'id,title,url,content_type,product_id';
    const [titleRes, urlRes] = await Promise.all([
      supabase.from('web_content_index').select(selectFields).ilike('title', query.trim()).limit(100),
      supabase.from('web_content_index').select(selectFields).ilike('url', query.trim()).limit(100),
    ]);

    const errors = [titleRes.error, urlRes.error].filter(Boolean);
    if (errors.length > 0) {
      console.error('[chat] findExactWebContentMatches errors', errors);
      // Si hay errores críticos (no solo "no encontrado"), lanzar el error
      const criticalErrors = errors.filter((e: any) => {
        if (!e) return false;
        const code = e.code || '';
        const message = (e.message || '').toLowerCase();
        return !code.includes('PGRST116') && !message.includes('not found');
      });
      if (criticalErrors.length > 0) {
        throw new Error(`Database query failed: ${JSON.stringify(criticalErrors)}`);
      }
      return [];
    }

    const matches: WebContentMatch[] = [];
    const seen = new Set<string>();

    const rows = [...(titleRes.data ?? []), ...(urlRes.data ?? [])];

    for (const row of rows) {
      if (!row) continue;
      
      if (matchesNormalized(row?.title, normalizedQuery)) {
        const key = `title:${row?.id ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({
            id: String(row?.id ?? ''),
            title: row?.title ?? null,
            url: row?.url ?? '',
            content_type: row?.content_type ?? null,
            product_id: typeof row?.product_id === 'number' ? row?.product_id : null,
            matched_field: 'title',
          });
        }
      }

      if (matchesNormalized(row?.url, normalizedQuery)) {
        const key = `url:${row?.id ?? ''}`;
        if (!seen.has(key)) {
          seen.add(key);
          matches.push({
            id: String(row?.id ?? ''),
            title: row?.title ?? null,
            url: row?.url ?? '',
            content_type: row?.content_type ?? null,
            product_id: typeof row?.product_id === 'number' ? row?.product_id : null,
            matched_field: 'url',
          });
        }
      }
    }

    return matches;
  } catch (error) {
    console.error('[chat] findExactWebContentMatches error', error);
    throw error;
  }
}

async function findExactMatches(
  supabase: SupabaseClient,
  query: string
): Promise<ExactMatchResult> {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return {
      original_query: query,
      normalized_query: normalizedQuery,
      products: [],
      categories: [],
      web_content: [],
    };
  }

  try {
    // Ejecutar búsquedas en paralelo, pero manejar errores individualmente
    const results = await Promise.allSettled([
      findExactProductMatches(supabase, query, normalizedQuery),
      findExactCategoryMatches(supabase, query, normalizedQuery),
      findExactWebContentMatches(supabase, query, normalizedQuery),
    ]);

    const products = results[0].status === 'fulfilled' ? results[0].value : [];
    const categories = results[1].status === 'fulfilled' ? results[1].value : [];
    const webContent = results[2].status === 'fulfilled' ? results[2].value : [];

    // Si todas las búsquedas fallaron, lanzar el primer error
    if (results[0].status === 'rejected' && results[1].status === 'rejected' && results[2].status === 'rejected') {
      const firstError = results[0].reason || results[1].reason || results[2].reason;
      throw firstError instanceof Error ? firstError : new Error(String(firstError));
    }

    // Log errores parciales pero continuar
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        const searchType = ['products', 'categories', 'web_content'][index];
        console.warn(`[chat] findExactMatches: ${searchType} search failed`, result.reason);
      }
    });

    return {
      original_query: query,
      normalized_query: normalizedQuery,
      products,
      categories,
      web_content: webContent,
    };
  } catch (error) {
    console.error('[chat] findExactMatches unexpected error', error);
    // Re-lanzar el error para que sea manejado por el handler principal
    throw error;
  }
}

async function fetchSupportingContentForProducts(
  supabase: SupabaseClient,
  productMatches: ProductMatch[]
): Promise<SupportingContent> {
  const productIds = Array.from(
    new Set(
      productMatches
        .map(match => (typeof match.product.id === 'number' ? match.product.id : null))
        .filter((id): id is number => id !== null)
    )
  );

  if (productIds.length === 0) {
    return {
      by_product: {},
      total_documents: 0,
      total_videos: 0,
    };
  }

  const [documentsRes, videosRes] = await Promise.all([
    supabase
      .from('documents')
      .select('id, original_filename, file_type, created_at, product_id')
      .in('product_id', productIds),
    supabase
      .from('product_videos')
      .select('id, title, youtube_url, created_at, product_id')
      .in('product_id', productIds),
  ]);

  if (documentsRes.error) {
    console.warn('[chat] Error fetching documents for products:', documentsRes.error);
  }

  if (videosRes.error) {
    console.warn('[chat] Error fetching videos for products:', videosRes.error);
  }

  const byProduct: SupportingContent['by_product'] = {};
  let totalDocuments = 0;
  let totalVideos = 0;

  if (Array.isArray(documentsRes.data)) {
    for (const doc of documentsRes.data) {
      if (typeof doc.product_id !== 'number') continue;
      if (!byProduct[doc.product_id]) {
        byProduct[doc.product_id] = { documents: [], videos: [] };
      }
      byProduct[doc.product_id].documents.push({
        id: doc.id,
        original_filename: doc.original_filename ?? null,
        file_type: doc.file_type ?? null,
        created_at: doc.created_at ?? null,
      });
      totalDocuments += 1;
    }
  }

  if (Array.isArray(videosRes.data)) {
    for (const video of videosRes.data) {
      if (typeof video.product_id !== 'number') continue;
      if (!byProduct[video.product_id]) {
        byProduct[video.product_id] = { documents: [], videos: [] };
      }
      byProduct[video.product_id].videos.push({
        id: video.id,
        title: video.title ?? null,
        youtube_url: video.youtube_url ?? '',
        created_at: video.created_at ?? null,
      });
      totalVideos += 1;
    }
  }

  return {
    by_product: byProduct,
    total_documents: totalDocuments,
    total_videos: totalVideos,
  };
}

function buildSupportingContentSummary(
  productMatches: ProductMatch[],
  supportingContent: SupportingContent
): string {
  const lines: string[] = [];

  for (const match of productMatches) {
    const productId = typeof match.product.id === 'number' ? match.product.id : null;
    if (!productId) continue;
    const entry = supportingContent.by_product[productId];
    if (!entry) continue;

    const docCount = entry.documents.length;
    const videoCount = entry.videos.length;

    if (docCount === 0 && videoCount === 0) continue;

    const descriptors: string[] = [];
    if (docCount > 0) {
      descriptors.push(`${docCount} documento${docCount === 1 ? '' : 's'}`);
    }
    if (videoCount > 0) {
      descriptors.push(`${videoCount} video${videoCount === 1 ? '' : 's'} de YouTube`);
    }

    const skuLabel = match.product.sku ? ` (SKU: ${match.product.sku})` : '';
    lines.push(`• ${match.product.name}${skuLabel}: ${descriptors.join(' y ')}`);
  }

  if (lines.length === 0) {
    return '';
  }

  return lines.join('\n');
}

function buildAssistantMessage(result: ExactMatchResult): string {
  const summary: string[] = [];

  if (result.products.length > 0) {
    const names = result.products.map(match => match.product.name).filter(Boolean).slice(0, 5).join(', ');
    summary.push(`• Productos (${result.products.length}): ${names || 'coincidencias exactas en nombre o url'}`);
  }

  if (result.categories.length > 0) {
    const names = result.categories
      .map(match => match.subcategory || match.category)
      .filter(Boolean)
      .slice(0, 5)
      .join(', ');
    summary.push(`• Categorías (${result.categories.length}): ${names || 'coincidencias exactas en categorías'}`);
  }

  if (result.web_content.length > 0) {
    const names = result.web_content.map(match => match.title || match.url).filter(Boolean).slice(0, 3).join(', ');
    summary.push(`• Contenido web (${result.web_content.length}): ${names || 'urls con coincidencia exacta'}`);
  }

  if (summary.length === 0) {
    return 'No encontré productos que coincidan con tu búsqueda. Intenta con:\n• El nombre completo o parcial de un producto\n• El nombre de una categoría\n• Una palabra clave relacionada con el producto que buscas\n\nEjemplos: "conchadora", "ahumador", "nitrógeno", "pacojet"';
  }

  return `He encontrado coincidencias exactas según tu consulta:\n${summary.join('\n')}`;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  setCorsHeaders(res);

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const { message } = req.body ?? {};
    if (typeof message !== 'string' || message.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Missing or invalid message',
        details: 'El campo message es obligatorio y debe ser un texto.',
      });
      return;
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('[chat] Missing Supabase configuration', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
      });
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        details: 'Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    try {
      const matchResult = await findExactMatches(supabase, message);
      const assistantMessage = buildAssistantMessage(matchResult);
      const supportingContent = await fetchSupportingContentForProducts(supabase, matchResult.products);
      const supportingSummary = buildSupportingContentSummary(matchResult.products, supportingContent);
      const finalAssistantMessage =
        supportingSummary.length > 0
          ? `${assistantMessage}\n\nRecursos asociados por producto:\n${supportingSummary}`
          : assistantMessage;

      const sources: SourceTag[] = [];
      if (matchResult.products.length > 0) sources.push('products_db');
      if (matchResult.categories.length > 0) sources.push('categories');
      if (matchResult.web_content.length > 0) sources.push('web');

      const functionResultPayload = {
        exact_match: matchResult,
        supporting_content: supportingContent,
      };

      const assistant: ChatMessage = {
        role: 'assistant',
        content: finalAssistantMessage,
        products: matchResult.products.map(match => match.product),
        sources: sources.length > 0 ? sources : undefined,
        function_result: functionResultPayload,
      };

      const conversationHistory: ChatMessage[] = [{ role: 'user', content: message }, assistant];

      res.status(200).json({
        success: true,
        message: finalAssistantMessage,
        function_called: 'exact_match_search',
        function_result: functionResultPayload,
        conversation_history: conversationHistory,
      });
    } catch (dbError) {
      console.error('[chat] Database query error', {
        error: dbError,
        message: dbError instanceof Error ? dbError.message : String(dbError),
        stack: dbError instanceof Error ? dbError.stack : undefined,
      });
      
      // Si es un error de conexión o configuración, devolver un error más específico
      if (dbError instanceof Error) {
        const errorMsg = dbError.message.toLowerCase();
        if (errorMsg.includes('fetch') || errorMsg.includes('network') || errorMsg.includes('connection')) {
          res.status(500).json({
            success: false,
            error: 'Error de conexión con la base de datos',
            details: 'No se pudo conectar con Supabase. Verifica tu conexión a internet y la configuración.',
          });
          return;
        }
        if (errorMsg.includes('permission') || errorMsg.includes('unauthorized') || errorMsg.includes('401')) {
          res.status(500).json({
            success: false,
            error: 'Error de autenticación',
            details: 'Las credenciales de Supabase no son válidas. Verifica SUPABASE_ANON_KEY.',
          });
          return;
        }
      }
      
      throw dbError; // Re-lanzar para que sea capturado por el catch general
    }
  } catch (error) {
    console.error('[chat] Unexpected error', {
      error,
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
      body: req.body,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorDetails = error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : errorMessage;

    res.status(500).json({
      success: false,
      error: `Exact match search failed: ${errorMessage}`,
      details: process.env.NODE_ENV === 'development' ? errorDetails : 'Error interno del servidor. Por favor, intenta de nuevo.',
    });
  }
}



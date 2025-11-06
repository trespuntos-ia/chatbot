import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// Función para extraer valor multilenguaje
function extractMultilanguageValue(field: any): string {
  if (typeof field === 'string') {
    return field;
  }
  if (Array.isArray(field) && field[0]?.value) {
    return field[0].value;
  }
  if (field?.value) {
    return field.value;
  }
  if (field && typeof field === 'object') {
    const values = Object.values(field);
    if (values.length > 0 && typeof values[0] === 'string') {
      return values[0] as string;
    }
  }
  return '';
}

// Obtener información básica de una categoría
async function getCategoryBasicInfo(
  categoryId: number,
  apiKey: string,
  prestashopUrl: string,
  langCode: number
): Promise<{ name: string; parentId: number | null } | null> {
  if (!categoryId || categoryId === 1 || categoryId === 0 || categoryId === 2) {
    return null;
  }

  try {
    const queryParams = new URLSearchParams({
      ws_key: apiKey,
      output_format: 'JSON',
      language: String(langCode || 1),
    });
    const url = `${prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) return null;

    const data = await response.json();
    if (data?.category) {
      const name = extractMultilanguageValue(data.category.name);
      const parentId = data.category.id_parent ? parseInt(data.category.id_parent) : null;
      return { name, parentId };
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
  }

  return null;
}

// Obtener jerarquía completa de una categoría (hasta 3 niveles)
async function getCategoryHierarchy(
  categoryId: number,
  cache: Map<number, { name: string; parentId: number | null; hierarchy: string[] }>,
  apiKey: string,
  prestashopUrl: string,
  langCode: number
): Promise<{ name: string; parentId: number | null; hierarchy: string[] }> {
  if (!categoryId || categoryId === 1 || categoryId === 0 || categoryId === 2) {
    return { name: '', parentId: null, hierarchy: [] };
  }

  if (cache.has(categoryId)) {
    return cache.get(categoryId)!;
  }

  const hierarchy: string[] = [];
  let currentId: number | null = categoryId;
  const visited = new Set<number>();

  while (currentId && currentId !== 1 && currentId !== 0 && currentId !== 2 && !visited.has(currentId)) {
    visited.add(currentId);

    if (cache.has(currentId)) {
      const cached = cache.get(currentId)!;
      const filteredCachedHierarchy = cached.hierarchy.filter(name => name && name.toLowerCase() !== 'inicio');
      hierarchy.unshift(...filteredCachedHierarchy);
      break;
    }

    const basicInfo = await getCategoryBasicInfo(currentId, apiKey, prestashopUrl, langCode);
    if (!basicInfo) {
      break;
    }

    if (basicInfo.name && basicInfo.name.toLowerCase() !== 'inicio') {
      hierarchy.unshift(basicInfo.name);
    }

    if (!basicInfo.parentId || basicInfo.parentId === 1 || basicInfo.parentId === 0 || basicInfo.parentId === 2) {
      break;
    }

    currentId = basicInfo.parentId;

    if (hierarchy.length >= 3) {
      break;
    }
  }

  const basicInfo = await getCategoryBasicInfo(categoryId, apiKey, prestashopUrl, langCode);
  const parentId = basicInfo?.parentId || null;
  const filteredHierarchy = hierarchy.filter(name => name && name.toLowerCase() !== 'inicio');

  const categoryInfo = {
    name: filteredHierarchy[filteredHierarchy.length - 1] || '',
    parentId,
    hierarchy: filteredHierarchy
  };

  cache.set(categoryId, categoryInfo);
  return categoryInfo;
}

// Obtener nombre de categoría (solo el nombre, no la jerarquía completa)
async function getCategoryName(
  categoryId: number,
  cache: Map<number, string>,
  apiKey: string,
  prestashopUrl: string,
  langCode: number
): Promise<string> {
  if (!categoryId || categoryId === 1 || categoryId === 0 || categoryId === 2) {
    return '';
  }

  if (cache.has(categoryId)) {
    return cache.get(categoryId)!;
  }

  try {
    const queryParams = new URLSearchParams({
      ws_key: apiKey,
      output_format: 'JSON',
      language: String(langCode || 1),
    });
    const url = `${prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) return '';

    const data = await response.json();
    if (data?.category) {
      const name = extractMultilanguageValue(data.category.name);
      if (name && name.toLowerCase() !== 'inicio') {
        cache.set(categoryId, name);
        return name;
      }
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
  }

  return '';
}

// Mapear un producto (igual que en PHP, pero también con jerarquía completa)
async function mapTestProduct(
  product: any,
  categoryCache: Map<number, string>,
  fullCategoryCache: Map<number, { name: string; parentId: number | null; hierarchy: string[] }>,
  apiKey: string,
  prestashopUrl: string,
  langCode: number,
  baseUrl?: string,
  langSlug?: string
): Promise<any> {
  const name = extractMultilanguageValue(product.name);
  const description = product.description_short
    ? extractMultilanguageValue(product.description_short)
    : '';

  // Extraer todas las categorías del producto
  const allCategoryIds: number[] = [];
  
  // Primero extraer todas las categorías de associations (como en PHP)
  if (product.associations && product.associations.categories) {
    let associatedCategories: any[] = [];

    if (Array.isArray(product.associations.categories)) {
      associatedCategories = product.associations.categories;
    } else if (product.associations.categories.category) {
      if (Array.isArray(product.associations.categories.category)) {
        associatedCategories = product.associations.categories.category;
      } else {
        associatedCategories = [product.associations.categories.category];
      }
    }

    for (const cat of associatedCategories) {
      let catId: number | null = null;
      if (typeof cat === 'object' && cat !== null) {
        catId = parseInt(cat.id || cat.id?.value || '0');
      } else if (typeof cat === 'string' || typeof cat === 'number') {
        catId = parseInt(String(cat));
      }
      
      // Excluir categoría "Inicio" (ID 2) y raíz (1, 0)
      if (catId && catId !== 1 && catId !== 0 && catId !== 2 && !allCategoryIds.includes(catId)) {
        allCategoryIds.push(catId);
      }
    }
  }
  
  // Si no hay categorías en associations, usar la categoría por defecto
  if (allCategoryIds.length === 0 && product.id_category_default && product.id_category_default != 2) {
    const defaultCategoryId = parseInt(product.id_category_default);
    if (defaultCategoryId && defaultCategoryId !== 1 && defaultCategoryId !== 0 && defaultCategoryId !== 2) {
      allCategoryIds.push(defaultCategoryId);
    }
  }

  // Obtener jerarquía completa de todas las categorías
  const allCategories: Array<{
    category: string;
    subcategory: string | null;
    subsubcategory: string | null;
    hierarchy: string[];
    category_id: number;
    is_primary: boolean;
  }> = [];

  for (let i = 0; i < allCategoryIds.length; i++) {
    const catId = allCategoryIds[i];
    const categoryInfo = await getCategoryHierarchy(catId, fullCategoryCache, apiKey, prestashopUrl, langCode);
    const hierarchy = categoryInfo.hierarchy || [];

    if (hierarchy.length === 0) continue;

    const level1 = hierarchy[0] || '';
    const level2 = hierarchy[1] || null;
    const level3 = hierarchy[2] || null;

    allCategories.push({
      category: level1,
      subcategory: level2,
      subsubcategory: level3 || null,
      hierarchy: hierarchy,
      category_id: catId,
      is_primary: i === 0
    });
  }

  // Obtener nombres simples para el campo category (como en PHP)
  const categorias: string[] = [];
  for (const catId of allCategoryIds) {
    const nombreCat = await getCategoryName(catId, categoryCache, apiKey, prestashopUrl, langCode);
    if (nombreCat && nombreCat.toLowerCase() !== 'inicio') {
      if (!categorias.includes(nombreCat)) {
        categorias.push(nombreCat);
      }
    }
  }
  
  // Concatenar todas las categorías con comas (como en PHP: implode(', ', $categorias))
  const category = categorias.join(', ');

  const linkRewrite = extractMultilanguageValue(product.link_rewrite);
  const imageId = product.id_default_image || '';
  let imageUrl = '';

  if (imageId && linkRewrite) {
    const base = baseUrl || prestashopUrl.replace('/api/', '/');
    imageUrl = `${base}${imageId}-medium_default/${linkRewrite}.jpg`;
  }

  // Precio sin impuestos
  let priceValue = '';
  if (product.price) {
    const priceRaw = parseFloat(product.price);
    if (product.price_tax_excl !== undefined && product.price_tax_excl !== null) {
      priceValue = parseFloat(product.price_tax_excl).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    } else {
      // Calcular sin IVA (dividir por 1.21)
      const priceWithoutTax = priceRaw / 1.21;
      priceValue = priceWithoutTax.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
  }

  let productUrl = '';
  if (linkRewrite) {
    const base = baseUrl || prestashopUrl.replace('/api/', '/');
    const lang = langSlug || 'es';
    productUrl = `${base}${lang}/${product.id}-${linkRewrite}`;
    if (product.ean13) {
      productUrl += `-${product.ean13}`;
    }
    productUrl += '.html';
  }

  return {
    name,
    price: priceValue,
    category,
    description: description.replace(/<[^>]*>/g, '').trim(),
    sku: product.reference || product.ean13 || '',
    image: imageUrl,
    product_url: productUrl,
    categorias_detalle: categorias,
    all_categories: allCategories.length > 0 ? allCategories : undefined,
  };
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed', method: req.method });
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

    // Obtener la conexión activa
    const { data: connections, error: connError } = await supabase
      .from('prestashop_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (connError || !connections || connections.length === 0) {
      res.status(404).json({ 
        error: 'No active PrestaShop connection found'
      });
      return;
    }

    const connection = connections[0];
    
    // Obtener product_id de query o body
    const productId = req.query.id || req.query.product_id || req.body?.id || req.body?.product_id;

    if (!productId) {
      res.status(400).json({ 
        error: 'product_id is required',
        hint: 'Use ?id=70 or ?product_id=70',
        received_query: req.query,
        received_body: req.body
      });
      return;
    }

    // Convertir a número si es string
    const productIdNum = typeof productId === 'string' ? parseInt(productId) : productId;
    if (isNaN(productIdNum)) {
      res.status(400).json({ 
        error: 'product_id must be a number',
        received: productId
      });
      return;
    }

    // Configuración de API
    const apiConfig = {
      apiKey: connection.api_key,
      prestashopUrl: connection.prestashop_url,
      baseUrl: connection.base_url || undefined,
      langCode: connection.lang_code || 1,
      langSlug: connection.lang_slug || 'es',
    };

    // Obtener el producto de PrestaShop
    const queryParams = new URLSearchParams({
      ws_key: apiConfig.apiKey,
      output_format: 'JSON',
      language: String(apiConfig.langCode || 1),
    });
    
    const url = `${apiConfig.prestashopUrl.replace(/\/$/, '')}/products/${productIdNum}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${Buffer.from(apiConfig.apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ 
        error: `Error fetching product from PrestaShop: ${response.statusText}`,
        status: response.status
      });
      return;
    }

    const data = await response.json();
    const rawProduct = data.product || data;

    if (!rawProduct) {
      res.status(404).json({ 
        error: 'Product not found in PrestaShop'
      });
      return;
    }

    // Mapear el producto
    const categoryCache = new Map<number, string>();
    const fullCategoryCache = new Map<number, { name: string; parentId: number | null; hierarchy: string[] }>();
    const mappedProduct = await mapTestProduct(
      rawProduct,
      categoryCache,
      fullCategoryCache,
      apiConfig.apiKey,
      apiConfig.prestashopUrl,
      apiConfig.langCode,
      apiConfig.baseUrl,
      apiConfig.langSlug
    );

    res.status(200).json({
      success: true,
      product: mappedProduct,
      debug: {
        category_cache_size: categoryCache.size,
        category_cache: Object.fromEntries(categoryCache),
      }
    });

  } catch (error) {
    console.error('Test product error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : undefined;
    
    res.status(500).json({ 
      error: 'Internal server error',
      message: errorMessage,
      stack: process.env.NODE_ENV === 'development' ? errorStack : undefined
    });
  }
}


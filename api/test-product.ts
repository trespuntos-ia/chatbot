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

// Mapear un producto (igual que en PHP)
async function mapTestProduct(
  product: any,
  categoryCache: Map<number, string>,
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

  // Obtener TODAS las categorías del producto (como en PHP)
  const categorias: string[] = [];
  
  // Obtener todas las categorías de associations
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
      if (catId && catId !== 1 && catId !== 0 && catId !== 2) {
        const nombreCat = await getCategoryName(catId, categoryCache, apiKey, prestashopUrl, langCode);
        if (nombreCat && nombreCat.toLowerCase() !== 'inicio') {
          categorias.push(nombreCat);
        }
      }
    }
  }
  
  // Si no hay categorías en associations, usar la categoría por defecto
  if (categorias.length === 0 && product.id_category_default && product.id_category_default != 2) {
    const nombreCat = await getCategoryName(parseInt(product.id_category_default), categoryCache, apiKey, prestashopUrl, langCode);
    if (nombreCat && nombreCat.toLowerCase() !== 'inicio') {
      categorias.push(nombreCat);
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
    const mappedProduct = await mapTestProduct(
      rawProduct,
      categoryCache,
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


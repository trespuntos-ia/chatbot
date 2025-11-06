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
      console.error('Supabase configuration missing:', {
        hasUrl: !!supabaseUrl,
        hasKey: !!supabaseKey,
        urlLength: supabaseUrl?.length || 0,
        keyLength: supabaseKey?.length || 0
      });
      res.status(500).json({ 
        error: 'Supabase configuration missing',
        details: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables',
        hint: 'See VERCEL_ENV_SETUP.md for instructions'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener parámetros de query
    const { 
      limit = '50', 
      offset = '0', 
      category,
      search,
      test_product_id // Nuevo parámetro para probar un solo producto
    } = req.query;

    // Si se proporciona test_product_id, usar el endpoint de prueba
    if (test_product_id) {
      // Redirigir a la lógica de test-single-product
      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseKey) {
        res.status(500).json({ error: 'Supabase configuration missing' });
        return;
      }

      const supabase = createClient(supabaseUrl, supabaseKey);
      const { data: connections } = await supabase
        .from('prestashop_connections')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (!connections || connections.length === 0) {
        res.status(404).json({ error: 'No active PrestaShop connection found' });
        return;
      }

      const connection = connections[0];
      const productId = typeof test_product_id === 'string' ? parseInt(test_product_id) : test_product_id;

      // Llamar a PrestaShop API directamente
      const queryParams = new URLSearchParams({
        ws_key: connection.api_key,
        output_format: 'JSON',
        language: String(connection.lang_code || 1),
      });
      
      const prestashopUrl = `${connection.prestashop_url.replace(/\/$/, '')}/products/${productId}?${queryParams.toString()}`;
      
      try {
        const prestashopResponse = await fetch(prestashopUrl, {
          headers: {
            'Authorization': `Basic ${Buffer.from(connection.api_key + ':').toString('base64')}`,
            'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
          },
        });

        if (!prestashopResponse.ok) {
          res.status(prestashopResponse.status).json({ 
            error: `Error fetching product from PrestaShop: ${prestashopResponse.statusText}` 
          });
          return;
        }

        const productData = await prestashopResponse.json();
        const rawProduct = productData.product || productData;

        // Mapear el producto con categorías (como en PHP)
        const categoryCache = new Map<number, string>();
        const mappedProduct = await mapTestProduct(
          rawProduct,
          categoryCache,
          connection.api_key,
          connection.prestashop_url,
          connection.lang_code || 1,
          connection.base_url || undefined,
          connection.lang_slug || 'es'
        );

        res.status(200).json({
          success: true,
          test_mode: true,
          product: mappedProduct,
          raw_product: {
            id: rawProduct.id,
            associations: rawProduct.associations,
            id_category_default: rawProduct.id_category_default,
            price: rawProduct.price,
            price_tax_excl: rawProduct.price_tax_excl,
          },
          debug: {
            category_cache_size: categoryCache.size,
            category_cache: Object.fromEntries(categoryCache),
          },
          message: 'Product mapped with categories (like PHP version)'
        });
        return;
      } catch (error) {
        res.status(500).json({ 
          error: 'Error fetching product',
          message: error instanceof Error ? error.message : 'Unknown error'
        });
        return;
      }
    }

    // Query básica - sin ordenar en Supabase para evitar errores
    // Incluir has_web_content si existe (compatible con versiones anteriores)
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
      console.error('Supabase error:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      });
      
      // Detectar errores comunes
      let errorMessage = 'Error fetching products';
      let details = error.message;
      
      if (error.code === 'PGRST116') {
        errorMessage = 'Table not found';
        details = 'The products table does not exist. Please run the supabase-schema.sql script in Supabase.';
      } else if (error.code === '42501') {
        errorMessage = 'Permission denied';
        details = 'RLS (Row Level Security) policies may be blocking access. Check your Supabase RLS policies.';
      } else if (error.message?.includes('relation') && error.message?.includes('does not exist')) {
        errorMessage = 'Table does not exist';
        details = 'The products table has not been created. Please run supabase-schema.sql in Supabase SQL Editor.';
      }
      
      res.status(500).json({ 
        error: errorMessage,
        details: details,
        code: error.code,
        hint: error.hint
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

    // Enriquecer productos con información de contenido web si existe la columna
    // Si has_web_content no existe, intentar calcularlo dinámicamente
    const enrichedProducts = await Promise.all(
      paginatedData.map(async (product: any) => {
        // Si la columna existe, ya está incluida
        if ('has_web_content' in product) {
          return product;
        }
        
        // Si no existe, verificar dinámicamente si hay contenido web
        try {
          const { data: webContent } = await supabase
            .from('web_content_index')
            .select('id')
            .eq('product_id', product.id)
            .eq('status', 'active')
            .limit(1)
            .single();
          
          product.has_web_content = !!webContent;
        } catch {
          // Si falla (tabla no existe o no hay relación), asumir false
          product.has_web_content = false;
        }
        
        return product;
      })
    );

    res.status(200).json({ 
      success: true,
      products: enrichedProducts,
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

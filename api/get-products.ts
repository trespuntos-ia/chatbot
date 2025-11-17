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
      category, // Mantener compatibilidad con el filtro antiguo
      category1, // Categoría nivel 1
      category2, // Categoría nivel 2
      category3, // Categoría nivel 3
      search,
      test_product_id // Nuevo parámetro para probar un solo producto
    } = req.query;

    console.log('get-products called with params:', { test_product_id, limit, offset, category, search });
    console.log('req.query:', req.query);

    // Si se proporciona test_product_id, usar el endpoint de prueba
    // Verificar tanto test_product_id como testProductId (por si viene en camelCase)
    const testId = test_product_id || (req.query as any).testProductId;
    if (testId) {
      console.log('Test product mode activated for product_id:', testId);
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
      const productId = typeof testId === 'string' ? parseInt(testId) : testId;

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

    // Optimizar: usar límite y offset directamente en Supabase
    const limitNum = Math.min(parseInt(limit as string), 100); // Máximo 100 productos por página
    const offsetNum = parseInt(offset as string);

    // Si hay filtros jerárquicos, necesitamos obtener más productos para filtrar correctamente
    // porque el filtrado se hace en memoria después de obtener los datos
    const hasHierarchicalFilters = !!(category1 || category2 || category3);
    const fetchLimit = hasHierarchicalFilters 
      ? Math.max(limitNum * 10, 1000) // Obtener más productos cuando hay filtros jerárquicos
      : limitNum;

    // Query básica
    let query = supabase
      .from('products')
      .select('*', { count: 'exact' });

    // Solo aplicar paginación directamente si NO hay filtros jerárquicos
    if (!hasHierarchicalFilters) {
      query = query.range(offsetNum, offsetNum + limitNum - 1);
    } else {
      // Si hay filtros jerárquicos, obtener más productos para filtrar
      query = query.range(0, fetchLimit - 1);
    }

    // Filtrar por categoría antigua (compatibilidad hacia atrás)
    if (category && typeof category === 'string') {
      query = query.ilike('category', `%${category}%`);
    }

    // Buscar por nombre o SKU si se proporciona
    if (search && typeof search === 'string') {
      query = query.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
    }

    // Ordenar por id descendente (más rápido que ordenar en memoria)
    query = query.order('id', { ascending: false });

    // Ejecutar query
    const { data, error, count } = await query;

    // Filtrar por categorías jerárquicas después de obtener los datos
    // (porque Supabase no tiene operadores JSON avanzados para filtrar en all_categories)
    let filteredData = data || [];
    
    if (hasHierarchicalFilters) {
      filteredData = filteredData.filter((product: any) => {
        // Si no tiene all_categories, usar el filtro antiguo
        if (!product.all_categories || !Array.isArray(product.all_categories) || product.all_categories.length === 0) {
          // Fallback al filtro antiguo si hay category1
          if (category1 && product.category) {
            return product.category.includes(category1 as string);
          }
          return false;
        }

        // Buscar en all_categories si coincide con los filtros jerárquicos
        return product.all_categories.some((cat: any) => {
          let matches = true;
          
          // Filtrar por nivel 1
          if (category1 && typeof category1 === 'string') {
            matches = matches && cat.category === category1;
          }
          
          // Filtrar por nivel 2 (solo si también hay nivel 1)
          if (category2 && typeof category2 === 'string' && matches) {
            matches = matches && cat.subcategory === category2;
          }
          
          // Filtrar por nivel 3 (solo si también hay nivel 2)
          if (category3 && typeof category3 === 'string' && matches) {
            matches = matches && cat.subsubcategory === category3;
          }
          
          return matches;
        });
      });

      // Aplicar paginación después del filtrado jerárquico
      const startIndex = offsetNum;
      const endIndex = startIndex + limitNum;
      filteredData = filteredData.slice(startIndex, endIndex);
    }

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

    // Los datos ya vienen paginados y ordenados de Supabase
    // Pero si hay filtros jerárquicos, ya están filtrados en filteredData
    const paginatedData = filteredData;

    // Optimizar: obtener todos los IDs de una vez para verificar web_content
    const productIds = paginatedData.map((p: any) => p.id);
    
    // Verificar web_content en batch (una sola consulta en lugar de N consultas)
    let webContentMap = new Map<number, boolean>();
    if (productIds.length > 0 && !paginatedData.some((p: any) => 'has_web_content' in p)) {
      try {
        const { data: webContentData } = await supabase
          .from('web_content_index')
          .select('product_id')
          .in('product_id', productIds)
          .eq('status', 'active');
        
        if (webContentData) {
          webContentData.forEach((item: any) => {
            webContentMap.set(item.product_id, true);
          });
        }
      } catch {
        // Si falla (tabla no existe), todos serán false
      }
    }

    // Enriquecer productos con información de contenido web
    const enrichedProducts = paginatedData.map((product: any) => {
      // Si la columna existe, ya está incluida
      if ('has_web_content' in product) {
        return product;
      }
      
      // Usar el mapa para verificar web_content
      product.has_web_content = webContentMap.has(product.id);
      
      return product;
    });

    // Calcular el total correcto: si hay filtros jerárquicos, necesitamos contar todos los filtrados
    let totalCount = count || 0;
    
    if (hasHierarchicalFilters) {
      // Obtener todos los productos (con filtros de búsqueda aplicados) para contar los que coinciden con los filtros jerárquicos
      let countQuery = supabase
        .from('products')
        .select('id, all_categories, category');

      if (category && typeof category === 'string') {
        countQuery = countQuery.ilike('category', `%${category}%`);
      }

      if (search && typeof search === 'string') {
        countQuery = countQuery.or(`name.ilike.%${search}%,sku.ilike.%${search}%`);
      }

      countQuery = countQuery.order('id', { ascending: false });

      const { data: allData } = await countQuery;

      if (allData) {
        const filteredCount = allData.filter((product: any) => {
          if (!product.all_categories || !Array.isArray(product.all_categories) || product.all_categories.length === 0) {
            if (category1 && product.category) {
              return product.category.includes(category1 as string);
            }
            return false;
          }

          return product.all_categories.some((cat: any) => {
            let matches = true;
            if (category1 && typeof category1 === 'string') {
              matches = matches && cat.category === category1;
            }
            if (category2 && typeof category2 === 'string' && matches) {
              matches = matches && cat.subcategory === category2;
            }
            if (category3 && typeof category3 === 'string' && matches) {
              matches = matches && cat.subsubcategory === category3;
            }
            return matches;
          });
        }).length;

        totalCount = filteredCount;
      }
    }

    res.status(200).json({ 
      success: true,
      products: enrichedProducts,
      total: totalCount,
      limit: limitNum,
      offset: offsetNum
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

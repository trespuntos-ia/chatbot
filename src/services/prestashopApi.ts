import type { Product, ApiConfig } from '../types';

/**
 * Extrae un valor compatible con múltiples formatos devueltos por la API.
 */
function extractMultilanguageValue(field: any): string {
  if (typeof field === 'string') {
    return field;
  }

  if (Array.isArray(field)) {
    if (field[0]?.value) {
      return field[0].value;
    }
  }

  if (field?.value) {
    return field.value;
  }

  const first = Array.isArray(field) ? field[0] : field;
  if (first?.value) {
    return first.value;
  }

  return '';
}

/**
 * Sanitiza el HTML de la descripción corta.
 */
function sanitizeDescription(content: string): string {
  if (!content) return '';
  
  // Remover HTML tags pero mantener algunos básicos
  const div = document.createElement('div');
  div.innerHTML = content;
  return div.textContent || div.innerText || '';
}

/**
 * Obtiene el nombre de la categoría por su ID usando el proxy de Vercel.
 * Retorna objeto con categoría y subcategoría (categoría padre).
 */
async function getCategoryInfo(
  categoryId: number,
  cache: Map<number, { name: string; parentId?: number; parentName?: string }>,
  config: ApiConfig
): Promise<{ name: string; parentName?: string }> {
  if (!categoryId) return { name: '' };

  if (cache.has(categoryId)) {
    const cached = cache.get(categoryId)!;
    return { name: cached.name, parentName: cached.parentName };
  }

  try {
    // Usar el proxy de Vercel en lugar de llamar directamente a la API
    const proxyUrl = `/api/prestashop-category?categoryId=${categoryId}&language=${config.langCode || 1}&prestashop_url=${encodeURIComponent(config.prestashopUrl)}&ws_key=${encodeURIComponent(config.apiKey)}`;
    
    const response = await fetch(proxyUrl, {
      method: 'GET',
    });

    if (!response.ok) return { name: '' };

    const data = await response.json();
    if (data?.category) {
      const name = extractMultilanguageValue(data.category.name);
      const parentIdRaw = data.category.id_parent;
      const parentId = parentIdRaw ? (typeof parentIdRaw === 'string' ? parseInt(parentIdRaw) : parentIdRaw) : undefined;
      
      let parentName: string | undefined;
      if (parentId && parentId !== 0 && parentId !== 1) {
        // Obtener nombre de la categoría padre
        const parentInfo = await getCategoryInfo(parentId, cache, config);
        parentName = parentInfo.name;
      }

      const info = { name, parentId, parentName };
      cache.set(categoryId, info);
      return { name, parentName };
    }
  } catch (error) {
    console.error('Error fetching category:', error);
  }

  return { name: '' };
}

/**
 * Obtiene la categoría y subcategoría del producto.
 * Retorna objeto con categoría principal y subcategoría separadas.
 */
async function getProductCategories(
  product: any,
  categoryCache: Map<number, { name: string; parentId?: number; parentName?: string }>,
  config: ApiConfig
): Promise<{ category: string; subcategory?: string }> {
  // Solo usar la categoría por defecto (como en la versión original)
  if (product.id_category_default) {
    const categoryInfo = await getCategoryInfo(
      parseInt(product.id_category_default),
      categoryCache,
      config
    );
    
    // Si hay categoría padre, esa es la categoría principal y la actual es la subcategoría
    if (categoryInfo.parentName && categoryInfo.parentName !== categoryInfo.name) {
      return {
        category: categoryInfo.parentName,
        subcategory: categoryInfo.name
      };
    }
    // Si no hay categoría padre, la actual es la categoría principal
    return {
      category: categoryInfo.name || '',
      subcategory: undefined
    };
  }

  return { category: '' };
}

/**
 * Mapea un producto de la API a nuestro formato.
 */
async function mapProduct(
  product: any,
  categoryCache: Map<number, { name: string; parentId?: number; parentName?: string }>,
  config: ApiConfig
): Promise<Product> {
  const name = extractMultilanguageValue(product.name);
  const description = product.description_short
    ? sanitizeDescription(extractMultilanguageValue(product.description_short))
    : '';

  // Obtener categoría y subcategoría separadas
  const { category, subcategory } = await getProductCategories(product, categoryCache, config);

  const linkRewrite = extractMultilanguageValue(product.link_rewrite);
  const imageId = product.id_default_image || '';
  let imageUrl = '';

  if (imageId && linkRewrite) {
    const baseUrl = config.baseUrl || config.prestashopUrl.replace('/api/', '/');
    imageUrl = `${baseUrl}${imageId}-medium_default/${linkRewrite}.jpg`;
  }

  const priceValue = product.price
    ? parseFloat(product.price).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '';

  let productUrl = '';
  if (linkRewrite) {
    const baseUrl = config.baseUrl || config.prestashopUrl.replace('/api/', '/');
    const langSlug = config.langSlug || 'es';
    productUrl = `${baseUrl}${langSlug}/${product.id}-${linkRewrite}`;
    if (product.ean13) {
      productUrl += `-${product.ean13}`;
    }
    productUrl += '.html';
  }

  // Obtener fecha de creación (date_add) de PrestaShop
  let dateAdd: string | undefined;
  if (product.date_add) {
    // date_add viene en formato ISO de PrestaShop
    dateAdd = product.date_add;
  }

  return {
    name,
    price: priceValue,
    category,
    subcategory,
    description,
    sku: product.reference || product.ean13 || '',
    image: imageUrl,
    product_url: productUrl,
    date_add: dateAdd,
  };
}

/**
 * Realiza una solicitud GET a la API de PrestaShop usando el proxy de Vercel.
 */
async function prestashopGet(
  endpoint: string,
  query: Record<string, string> = {},
  config: ApiConfig
): Promise<any> {
  // Usar el proxy de Vercel en lugar de llamar directamente a la API
  const queryParams = new URLSearchParams({
    prestashop_url: config.prestashopUrl,
    ws_key: config.apiKey,
    output_format: 'JSON',
    ...query,
  });

  const proxyUrl = `/api/prestashop-proxy?endpoint=${encodeURIComponent(endpoint)}&${queryParams.toString()}`;

  try {
    const response = await fetch(proxyUrl, {
      method: 'GET',
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Error desconocido al obtener datos de la API');
  }
}

/**
 * Obtiene todos los productos de PrestaShop con progreso.
 */
export async function fetchAllProducts(
  config: ApiConfig,
  onProgress?: (current: number, total: number | null) => void
): Promise<Product[]> {
  const products: Product[] = [];
  const categoryCache = new Map<number, { name: string; parentId?: number; parentName?: string }>();
  let offset = 0;
  const chunkSize = 150;
  let iterations = 0;
  const maxIterations = 500;

  while (iterations < maxIterations) {
    const query = {
      language: String(config.langCode || 1),
      limit: `${offset},${chunkSize}`,
      display: '[id,id_default_image,name,price,reference,link_rewrite,ean13,id_category_default,description_short,date_add]',
      sort: 'id_ASC',
    };

    try {
      const response = await prestashopGet('products', query, config);

      if (!response?.products || response.products.length === 0) {
        break;
      }

      // Procesar productos en lotes
      for (const product of response.products) {
        const mappedProduct = await mapProduct(product, categoryCache, config);
        products.push(mappedProduct);
        
        if (onProgress) {
          onProgress(products.length, null);
        }
      }

      const count = response.products.length;
      if (count < chunkSize) {
        break;
      }

      offset += count;
      iterations++;

      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 100));
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  if (onProgress) {
    onProgress(products.length, products.length);
  }

  return products;
}


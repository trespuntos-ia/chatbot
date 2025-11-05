// Utility functions for PrestaShop product synchronization (Server-side)

interface ApiConfig {
  apiKey: string;
  prestashopUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}

interface Product {
  name: string;
  price: string;
  category: string;
  description: string;
  sku: string;
  image: string;
  product_url: string;
}

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

function sanitizeDescription(html: string): string {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .trim();
}

async function getCategoryName(
  categoryId: number,
  cache: Map<number, string>,
  config: ApiConfig
): Promise<string> {
  if (!categoryId || cache.has(categoryId)) {
    return cache.get(categoryId) || '';
  }
  try {
    const queryParams = new URLSearchParams({
      ws_key: config.apiKey,
      output_format: 'JSON',
      language: String(config.langCode || 1),
    });
    const url = `${config.prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${queryParams.toString()}`;
    // Usar btoa si Buffer no está disponible (entornos web)
    let authHeader: string;
    try {
      if (typeof Buffer !== 'undefined') {
        authHeader = `Basic ${Buffer.from(config.apiKey + ':').toString('base64')}`;
      } else {
        // Fallback para entornos web
        authHeader = `Basic ${btoa(config.apiKey + ':')}`;
      }
    } catch (e) {
      // Fallback final
      authHeader = `Basic ${Buffer.from ? Buffer.from(config.apiKey + ':').toString('base64') : btoa(config.apiKey + ':')}`;
    }

    const response = await fetch(url, {
      headers: {
        'Authorization': authHeader,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });
    if (response.ok) {
      const data = await response.json();
      const name = extractMultilanguageValue((data.category || data).name);
      cache.set(categoryId, name);
      return name;
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
  }
  return '';
}

async function mapProduct(
  product: any,
  categoryCache: Map<number, string>,
  config: ApiConfig
): Promise<Product> {
  const name = extractMultilanguageValue(product.name);
  const description = product.description_short
    ? sanitizeDescription(extractMultilanguageValue(product.description_short))
    : '';
  let category = '';
  if (product.id_category_default) {
    category = await getCategoryName(parseInt(product.id_category_default), categoryCache, config);
  }
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
  return {
    name,
    price: priceValue,
    category,
    description,
    sku: product.reference || product.ean13 || '',
    image: imageUrl,
    product_url: productUrl,
  };
}

async function prestashopGet(
  endpoint: string,
  query: Record<string, string> = {},
  config: ApiConfig
): Promise<any> {
  const queryParams = new URLSearchParams({
    ws_key: config.apiKey,
    output_format: 'JSON',
    ...query,
  });
  const url = `${config.prestashopUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}?${queryParams.toString()}`;
  
  // Usar btoa si Buffer no está disponible (entornos web)
  let authHeader: string;
  try {
    if (typeof Buffer !== 'undefined') {
      authHeader = `Basic ${Buffer.from(config.apiKey + ':').toString('base64')}`;
    } else {
      authHeader = `Basic ${btoa(config.apiKey + ':')}`;
    }
  } catch (e) {
    authHeader = `Basic ${Buffer.from ? Buffer.from(config.apiKey + ':').toString('base64') : btoa(config.apiKey + ':')}`;
  }

  const response = await fetch(url, {
    headers: {
      'Authorization': authHeader,
      'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

export async function fetchAllProducts(
  config: ApiConfig,
  onProgress?: (current: number, total: number | null) => void
): Promise<Product[]> {
  const products: Product[] = [];
  const categoryCache = new Map<number, string>();
  let offset = 0;
  const chunkSize = 150;
  let iterations = 0;
  const maxIterations = 500;

  while (iterations < maxIterations) {
    const query = {
      language: String(config.langCode || 1),
      limit: `${offset},${chunkSize}`,
      display: '[id,id_default_image,name,price,reference,link_rewrite,ean13,id_category_default,description_short]',
      sort: 'id_ASC',
    };
    try {
      const response = await prestashopGet('products', query, config);
      if (!response?.products || response.products.length === 0) {
        break;
      }
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

import type { Product, ApiConfig, CategoryInfo } from '../types';

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
 * Obtiene el nombre de la categoría por su ID.
 */
async function getCategoryName(
  categoryId: number,
  cache: Map<number, string>,
  config: ApiConfig
): Promise<string> {
  if (!categoryId) return '';

  if (cache.has(categoryId)) {
    return cache.get(categoryId)!;
  }

  try {
    const url = `${config.prestashopUrl}/categories/${categoryId}?ws_key=${config.apiKey}&output_format=JSON&language=${config.langCode || 1}`;
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) return '';

    const data = await response.json();
    if (data?.category) {
      const name = extractMultilanguageValue(data.category.name);
      cache.set(categoryId, name);
      return name;
    }
  } catch (error) {
    console.error('Error fetching category:', error);
  }

  return '';
}

/**
 * Obtiene la información completa de una categoría con su jerarquía (hasta 3 niveles).
 */
async function getCategoryFullInfo(
  categoryId: number,
  cache: Map<number, { name: string; parent: number | null }>,
  config: ApiConfig
): Promise<{ hierarchy: string[]; name: string }> {
  if (!categoryId || categoryId === 1 || categoryId === 0 || categoryId === 2) {
    return { hierarchy: [], name: '' };
  }

  const hierarchy: string[] = [];
  let currentId: number | null = categoryId;
  const visited = new Set<number>();

  while (currentId && currentId !== 1 && currentId !== 0 && currentId !== 2 && !visited.has(currentId)) {
    visited.add(currentId);

    // Verificar cache
    if (cache.has(currentId)) {
      const cached: { name: string; parent: number | null } = cache.get(currentId)!;
      hierarchy.unshift(cached.name);
      currentId = cached.parent;
      continue;
    }

    try {
      const url = `${config.prestashopUrl}/categories/${currentId}?ws_key=${config.apiKey}&output_format=JSON&language=${config.langCode || 1}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
          'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
        },
      });

      if (!response.ok) break;

      const data = await response.json();
      if (data?.category) {
        const name = extractMultilanguageValue(data.category.name);
        const parentId = data.category.id_parent ? parseInt(data.category.id_parent) : null;
        
        cache.set(currentId, { name, parent: parentId });
        hierarchy.unshift(name);
        currentId = parentId;
      } else {
        break;
      }
    } catch (error) {
      console.error(`Error fetching category ${currentId}:`, error);
      break;
    }
  }

  return { hierarchy, name: hierarchy[0] || '' };
}

/**
 * Mapea un producto de la API a nuestro formato.
 */
async function mapProduct(
  product: any,
  categoryCache: Map<number, string>,
  fullCategoryCache: Map<number, { name: string; parent: number | null }>,
  config: ApiConfig
): Promise<Product> {
  const name = extractMultilanguageValue(product.name);
  const description = product.description_short
    ? sanitizeDescription(extractMultilanguageValue(product.description_short))
    : '';

  // Extraer todas las categorías del producto (EXACTAMENTE como en PHP)
  // El PHP primero busca en associations, y solo usa id_category_default si no hay categorías
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

  // Si no hay categorías en associations, usar la categoría por defecto (excepto si es "Inicio")
  if (allCategoryIds.length === 0 && product.id_category_default && product.id_category_default != 2) {
    const defaultCategoryId = parseInt(product.id_category_default);
    if (defaultCategoryId && defaultCategoryId !== 1 && defaultCategoryId !== 0 && defaultCategoryId !== 2) {
      allCategoryIds.push(defaultCategoryId);
    }
  }

  console.log(`Producto ${name}: IDs de categorías encontrados:`, allCategoryIds);

  // Procesar todas las categorías para obtener jerarquía completa
  const allCategories: CategoryInfo[] = [];

  for (let i = 0; i < allCategoryIds.length; i++) {
    const catId = allCategoryIds[i];
    const categoryInfo = await getCategoryFullInfo(catId, fullCategoryCache, config);
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

  // Log para depuración
  if (allCategories.length > 0) {
    console.log(`Producto ${name}: ${allCategories.length} categorías encontradas`, allCategories);
  } else if (allCategoryIds.length > 0) {
    console.warn(`Producto ${name}: Se encontraron ${allCategoryIds.length} IDs de categoría pero no se pudieron procesar`);
  }

  // Generar lista plana de todas las categorías (EXACTAMENTE como en tabla_productos_categorias.php)
  // El PHP obtiene solo el nombre directo de cada categoría asociada, NO la jerarquía completa
  const allCategoryNames: string[] = [];

  // Recorrer todas las categorías y obtener solo el nombre directo de cada una
  for (const catId of allCategoryIds) {
    // Obtener solo el nombre de la categoría (no la jerarquía completa)
    const categoryName = await getCategoryName(catId, categoryCache, config);
    if (categoryName && categoryName.toLowerCase() !== 'inicio') {
      // Solo agregar si no está ya en la lista (evitar duplicados)
      if (!allCategoryNames.includes(categoryName)) {
        allCategoryNames.push(categoryName);
      }
    }
  }

  // Si no hay categorías, intentar obtener la categoría por defecto
  if (allCategoryNames.length === 0 && defaultCategoryId) {
    const defaultCatName = await getCategoryName(defaultCategoryId, categoryCache, config);
    if (defaultCatName && defaultCatName.toLowerCase() !== 'inicio') {
      allCategoryNames.push(defaultCatName);
    }
  }

  // Concatenar todas las categorías con comas (como en el PHP: implode(', ', $categorias))
  const category = allCategoryNames.join(', ');

  const linkRewrite = extractMultilanguageValue(product.link_rewrite);
  const imageId = product.id_default_image || '';
  let imageUrl = '';

  if (imageId && linkRewrite) {
    const baseUrl = config.baseUrl || config.prestashopUrl.replace('/api/', '/');
    imageUrl = `${baseUrl}${imageId}-medium_default/${linkRewrite}.jpg`;
  }

  // En PrestaShop, el campo 'price' puede venir con impuestos incluidos o sin ellos
  // Priorizamos el precio sin impuestos si está disponible
  let priceValue = '';
  
  if (product.price) {
    const priceRaw = parseFloat(product.price);
    
    // 1. Prioridad: precio sin impuestos explícito
    if (product.price_tax_excl !== undefined && product.price_tax_excl !== null) {
      priceValue = parseFloat(product.price_tax_excl).toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`Producto ${name}: Precio sin impuestos (price_tax_excl): ${priceValue}`);
    } 
    // 2. Si el precio parece ser con impuestos (común en PrestaShop), calcular sin impuestos
    // PrestaShop normalmente devuelve el precio CON impuestos en el campo 'price'
    // Calculamos el precio sin IVA asumiendo 21% (estándar en España)
    else {
      // Dividir por 1.21 para obtener precio sin IVA
      const priceWithoutTax = priceRaw / 1.21;
      priceValue = priceWithoutTax.toLocaleString('es-ES', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
      console.log(`Producto ${name}: Precio original: ${priceRaw}, Precio sin IVA (calculado): ${priceValue}`);
    }
  }

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
    date_add: product.date_add || undefined,
    all_categories: allCategories.length > 0 ? allCategories : undefined,
  };
}

/**
 * Realiza una solicitud GET a la API de PrestaShop.
 */
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

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
      mode: 'cors',
    });

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Error de CORS: La API de PrestaShop no permite solicitudes desde el navegador. Considera usar un proxy o habilitar CORS en PrestaShop.');
    }
    throw error;
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
  const categoryCache = new Map<number, string>();
  const fullCategoryCache = new Map<number, { name: string; parent: number | null }>();
  let offset = 0;
  const chunkSize = 150;
  let iterations = 0;
  const maxIterations = 500;

  while (iterations < maxIterations) {
    const query = {
      language: String(config.langCode || 1),
      limit: `${offset},${chunkSize}`,
      display: '[id,id_default_image,name,price,price_tax_excl,wholesale_price,reference,link_rewrite,ean13,id_category_default,description_short,date_add,associations]',
      sort: 'id_ASC',
    };

    try {
      const response = await prestashopGet('products', query, config);

      if (!response?.products || response.products.length === 0) {
        break;
      }

      // Procesar productos en lotes
      for (const product of response.products) {
        const mappedProduct = await mapProduct(product, categoryCache, fullCategoryCache, config);
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


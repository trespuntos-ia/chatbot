import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

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
  all_categories?: Array<{
    category: string;
    subcategory: string | null;
    subsubcategory?: string | null;
    hierarchy: string[];
    category_id: number;
    is_primary: boolean;
  }>;
}

// ============================================
// FUNCIONES DE UTILIDAD PARA PRESTASHOP
// Todo el código está inline aquí para evitar problemas de importación en Vercel
// Última actualización: $(date +%Y-%m-%d)
// ============================================
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

function getAuthHeader(apiKey: string): string {
  try {
    if (typeof Buffer !== 'undefined') {
      return `Basic ${Buffer.from(apiKey + ':').toString('base64')}`;
    } else {
      return `Basic ${btoa(apiKey + ':')}`;
    }
  } catch (e) {
    return `Basic ${Buffer.from ? Buffer.from(apiKey + ':').toString('base64') : btoa(apiKey + ':')}`;
  }
}

// Tipo para información de categoría con jerarquía completa
interface CategoryInfo {
  name: string;
  parentId: number | null;
  // Cadena completa de categorías desde la raíz hasta esta
  hierarchy: string[]; // [raíz, nivel2, nivel3]
}

// Obtiene la información básica de una categoría (sin recursión)
async function getCategoryBasicInfo(
  categoryId: number,
  config: ApiConfig
): Promise<{ name: string; parentId: number | null } | null> {
  if (!categoryId || categoryId === 1 || categoryId === 0) {
    return null; // Raíz
  }
  
  try {
    const queryParams = new URLSearchParams({
      ws_key: config.apiKey,
      output_format: 'JSON',
      language: String(config.langCode || 1),
    });
    const url = `${config.prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${queryParams.toString()}`;
    
    // Añadir timeout de 5 segundos
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(config.apiKey),
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (response.ok) {
      const data = await response.json();
      const category = data.category || data;
      const name = extractMultilanguageValue(category.name);
      const parentId = category.id_parent ? parseInt(category.id_parent) : null;
      return { name, parentId };
    }
  } catch (error: any) {
    if (error.name === 'AbortError') {
      console.error(`Timeout fetching category ${categoryId}`);
    } else {
      console.error(`Error fetching category ${categoryId}:`, error);
    }
  }
  
  return null;
}

// Obtiene la jerarquía completa de categorías (hasta 3 niveles)
async function getCategoryInfo(
  categoryId: number,
  cache: Map<number, CategoryInfo>,
  config: ApiConfig
): Promise<CategoryInfo> {
  if (!categoryId) {
    return { name: '', parentId: null, hierarchy: [] };
  }
  
  // Si ya está en cache, retornarlo
  if (cache.has(categoryId)) {
    return cache.get(categoryId)!;
  }
  
  // Construir la jerarquía desde la categoría actual hasta la raíz
  const hierarchy: string[] = [];
  let currentId: number | null = categoryId;
  const visited = new Set<number>(); // Prevenir loops infinitos
  
  while (currentId && currentId !== 1 && currentId !== 0 && !visited.has(currentId)) {
    visited.add(currentId);
    
    // Verificar si está en cache primero
    if (cache.has(currentId)) {
      const cached = cache.get(currentId)!;
      hierarchy.unshift(...cached.hierarchy);
      break;
    }
    
    // Obtener información básica
    const basicInfo = await getCategoryBasicInfo(currentId, config);
    if (!basicInfo) {
      break;
    }
    
    // Excluir "Inicio" de la jerarquía
    if (basicInfo.name && basicInfo.name.toLowerCase() !== 'inicio') {
      hierarchy.unshift(basicInfo.name);
    }
    
    // Si no tiene padre o el padre es la raíz o "Inicio", terminamos
    if (!basicInfo.parentId || basicInfo.parentId === 1 || basicInfo.parentId === 0 || basicInfo.parentId === 2) {
      break;
    }
    
    currentId = basicInfo.parentId;
    
    // Limitar a 3 niveles máximo
    if (hierarchy.length >= 3) {
      break;
    }
  }
  
  // Guardar en cache todas las categorías de la jerarquía
  let parentId: number | null = null;
  if (hierarchy.length > 0) {
    // Obtener el parentId de la categoría actual
    const currentInfo = await getCategoryBasicInfo(categoryId, config);
    parentId = currentInfo?.parentId || null;
    
    // Crear y cachear la información completa
    const categoryInfo: CategoryInfo = {
      name: hierarchy[hierarchy.length - 1] || '', // El último nivel es la categoría actual
      parentId,
      hierarchy
    };
    
    cache.set(categoryId, categoryInfo);
  } else {
    return { name: '', parentId: null, hierarchy: [] };
  }
  
  return cache.get(categoryId)!;
}

async function mapProduct(
  product: any,
  categoryCache: Map<number, CategoryInfo>,
  config: ApiConfig
): Promise<Product & { subcategory?: string | null }> {
  const name = extractMultilanguageValue(product.name);
  const description = product.description_short
    ? sanitizeDescription(extractMultilanguageValue(product.description_short))
    : '';
  
  let category = '';
  let subcategory: string | null = null;
  const allCategories: Array<{
    category: string;
    subcategory: string | null;
    subsubcategory?: string | null;
    hierarchy: string[];
    category_id: number;
    is_primary: boolean;
  }> = [];
  
  // Función auxiliar para procesar una categoría completa
  const processCategoryFull = async (categoryId: number, isPrimary: boolean = false): Promise<{
    category: string;
    subcategory: string | null;
    subsubcategory: string | null;
    hierarchy: string[];
    category_id: number;
    is_primary: boolean;
  } | null> => {
    if (!categoryId || categoryId === 1 || categoryId === 0) {
      return null;
    }
    
    const categoryInfo = await getCategoryInfo(categoryId, categoryCache, config);
    const hierarchy = categoryInfo.hierarchy || [];
    
    if (hierarchy.length === 0) {
      return null;
    }
    
    // Filtrar "Inicio" de la jerarquía
    const filteredHierarchy = hierarchy.filter(name => name && name.toLowerCase() !== 'inicio');
    
    if (filteredHierarchy.length === 0) {
      return null;
    }
    
    // Extraer niveles de jerarquía (después de filtrar "Inicio")
    const level1 = filteredHierarchy[0] || '';
    const level2 = filteredHierarchy[1] || null;
    const level3 = filteredHierarchy[2] || null;
    
    // Para compatibilidad: category y subcategory (categoría principal)
    if (isPrimary) {
      category = level1;
      if (level2 && level3) {
        subcategory = `${level2} > ${level3}`;
      } else if (level2) {
        subcategory = level2;
      }
    }
    
    return {
      category: level1,
      subcategory: level2,
      subsubcategory: level3 || null,
      hierarchy: filteredHierarchy, // Usar la jerarquía filtrada
      category_id: categoryId,
      is_primary: isPrimary
    };
  };
  
  // Función para extraer todas las categorías asociadas del producto (EXACTAMENTE como en PHP)
  // El PHP primero busca en associations, y solo usa id_category_default si no hay categorías
  const extractAllCategoryIds = (product: any): number[] => {
    const categoryIds: number[] = [];
    
    // Primero extraer todas las categorías de associations (como en PHP)
    if (product.associations && product.associations.categories) {
      let associatedCategories: any[] = [];
      
      // PrestaShop puede devolver asociaciones en diferentes formatos:
      if (Array.isArray(product.associations.categories)) {
        // Formato 1: array directo
        associatedCategories = product.associations.categories;
      } else if (product.associations.categories.category) {
        if (Array.isArray(product.associations.categories.category)) {
          // Formato 2: array dentro de category
          associatedCategories = product.associations.categories.category;
        } else {
          // Formato 3: objeto único
          associatedCategories = [product.associations.categories.category];
        }
      }
      
      // Extraer IDs de categorías asociadas (excluyendo ID 2 "Inicio")
      for (const cat of associatedCategories) {
        let catId: number | null = null;
        
        if (typeof cat === 'object' && cat !== null) {
          catId = parseInt(cat.id || cat.id?.value || '0');
        } else if (typeof cat === 'string' || typeof cat === 'number') {
          catId = parseInt(String(cat));
        }
        
        // Excluir categoría "Inicio" (ID 2) y raíz (1, 0)
        if (catId && catId !== 1 && catId !== 0 && catId !== 2 && !categoryIds.includes(catId)) {
          categoryIds.push(catId);
        }
      }
    }
    
    // Si no hay categorías en associations, usar la categoría por defecto (excepto si es "Inicio")
    if (categoryIds.length === 0 && product.id_category_default && product.id_category_default != 2) {
      const defaultCategoryId = parseInt(product.id_category_default);
      if (defaultCategoryId && defaultCategoryId !== 1 && defaultCategoryId !== 0 && defaultCategoryId !== 2) {
        categoryIds.push(defaultCategoryId);
      }
    }
    
    return categoryIds;
  };
  
  // Obtener TODAS las categorías del producto
  const allCategoryIds = extractAllCategoryIds(product);
  
  if (allCategoryIds.length > 0) {
    // Procesar todas las categorías en paralelo para mayor eficiencia
    const categoryPromises = allCategoryIds.map((catId, index) => 
      processCategoryFull(catId, index === 0) // Primera categoría es la principal
    );
    
    const categoryResults = await Promise.all(categoryPromises);
    
    // Filtrar nulos y agregar a allCategories
    categoryResults.forEach((catInfo) => {
      if (catInfo) {
        allCategories.push(catInfo);
      }
    });
    
    // Si no se procesó ninguna categoría pero hay IDs, intentar con la primera
    if (allCategories.length === 0 && allCategoryIds.length > 0) {
      const firstCategory = await processCategoryFull(allCategoryIds[0], true);
      if (firstCategory) {
        allCategories.push(firstCategory);
      }
    }
    
    // Debug: Log para verificar categorías (solo algunos productos para no saturar)
    if (Math.random() < 0.01) {
      console.log(`Product categories debug: ${product.name || 'Unknown'} - Found ${allCategoryIds.length} category IDs, processed ${allCategories.length} categories`);
    }
  } else {
    console.warn(`Product ${product.name || 'Unknown'} has no valid categories (id_category_default: ${product.id_category_default})`);
  }
  
  // Generar lista plana de todas las categorías (EXACTAMENTE como en tabla_productos_categorias.php)
  // El PHP obtiene solo el nombre directo de cada categoría asociada, NO la jerarquía completa
  const allCategoryNames: string[] = [];
  
  // Recorrer todas las categorías y obtener solo el nombre directo de cada una
  for (const catId of allCategoryIds) {
    // Obtener solo el nombre de la categoría (no la jerarquía completa)
    const catInfo = await getCategoryInfo(catId, categoryCache, config);
    if (catInfo && catInfo.hierarchy.length > 0) {
      // Tomar solo el nombre de la categoría (el último nivel, que es la categoría misma)
      const categoryName = catInfo.hierarchy[catInfo.hierarchy.length - 1];
      if (categoryName && categoryName.toLowerCase() !== 'inicio') {
        // Solo agregar si no está ya en la lista (evitar duplicados)
        if (!allCategoryNames.includes(categoryName)) {
          allCategoryNames.push(categoryName);
        }
      }
    }
  }
  
  // Si no hay categorías, intentar obtener la categoría por defecto
  if (allCategoryNames.length === 0 && product.id_category_default) {
    const defaultCatInfo = await getCategoryInfo(parseInt(product.id_category_default), categoryCache, config);
    if (defaultCatInfo && defaultCatInfo.hierarchy.length > 0) {
      const defaultCatName = defaultCatInfo.hierarchy[defaultCatInfo.hierarchy.length - 1];
      if (defaultCatName && defaultCatName.toLowerCase() !== 'inicio') {
        allCategoryNames.push(defaultCatName);
      }
    }
  }
  
  // Concatenar todas las categorías con comas (como en el PHP: implode(', ', $categorias))
  category = allCategoryNames.join(', ');
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
    all_categories: allCategories.length > 0 ? allCategories : undefined,
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
  const response = await fetch(url, {
    headers: {
      'Authorization': getAuthHeader(config.apiKey),
      'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
    },
  });
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  return await response.json();
}

// Esta función ya no se usa directamente, pero la mantenemos por compatibilidad
async function fetchAllProducts(
  config: ApiConfig,
  onProgress?: (current: number, total: number | null) => void
): Promise<Array<Product & { subcategory?: string | null }>> {
  const products: Array<Product & { subcategory?: string | null }> = [];
  const categoryCache = new Map<number, CategoryInfo>();
  let offset = 0;
  const chunkSize = 150;
  let iterations = 0;
  const maxIterations = 500;

  while (iterations < maxIterations) {
    const query = {
      language: String(config.langCode || 1),
      limit: `${offset},${chunkSize}`,
      display: 'full',
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

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Añadir CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  
  // Log para debugging - Version 2.0 (sin módulos externos)
  console.log('Sync cron endpoint called at:', new Date().toISOString());
  console.log('All functions are inline - no external imports');
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo permitir POST (o GET para pruebas manuales)
  if (req.method !== 'POST' && req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Verificar que sea una llamada autorizada (desde cron o con token)
  const authToken = req.headers.authorization?.replace('Bearer ', '') || req.query.token;
  const cronSecret = process.env.CRON_SECRET || 'your-secret-token';
  
  // Para pruebas manuales, permitir sin token si viene el parámetro manual
  if (req.query.manual === 'true') {
    // Permitir sin token para pruebas (solo en desarrollo)
    // En producción, requerir token siempre
  } else if (authToken !== cronSecret) {
    res.status(401).json({ 
      error: 'Unauthorized',
      hint: 'Provide token in query parameter: ?token=YOUR_CRON_SECRET or ?manual=true for testing'
    });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('Missing Supabase environment variables');
      res.status(500).json({ 
        error: 'Supabase configuration missing',
        details: 'SUPABASE_URL and SUPABASE_ANON_KEY must be set in Vercel environment variables'
      });
      return;
    }

    console.log('Starting sync process...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener la conexión activa
    console.log('Fetching active connection from Supabase...');
    const { data: connections, error: connError } = await supabase
      .from('prestashop_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (connError) {
      console.error('Error fetching connection:', connError);
      throw new Error(`Error fetching connection: ${connError.message}`);
    }

    if (!connections || connections.length === 0) {
      console.log('No active connection found');
      res.status(404).json({ 
        error: 'No active PrestaShop connection found',
        hint: 'Please create a connection in the dashboard first (Conexiones tab)',
        details: 'Go to Dashboard → Conexiones tab and configure your PrestaShop connection'
      });
      return;
    }

    console.log('Connection found:', connections[0].name);

    const connection = connections[0];

    // Crear registro de sincronización
    const { data: syncRecord, error: syncCreateError } = await supabase
      .from('product_sync_history')
      .insert({
        connection_id: connection.id,
        status: 'running',
        log_messages: [{ timestamp: new Date().toISOString(), message: 'Iniciando sincronización...' }]
      })
      .select()
      .single();

    if (syncCreateError) {
      throw new Error(`Error creating sync record: ${syncCreateError.message}`);
    }

    const syncId = syncRecord.id;
    const logMessages: Array<{ timestamp: string; message: string; type?: string }> = [];

    const addLog = (message: string, type: string = 'info') => {
      logMessages.push({
        timestamp: new Date().toISOString(),
        message,
        type
      });
    };

    // Contadores para productos importados y actualizados (declarados fuera del try para estar disponibles en catch)
    let imported: number = 0;
    let updated: number = 0;

    try {
      addLog(`Conexión: ${connection.prestashop_url}`, 'info');

      // Preparar configuración de API
      const apiConfig: ApiConfig = {
        apiKey: connection.api_key,
        prestashopUrl: connection.prestashop_url,
        baseUrl: connection.base_url || undefined,
        langCode: connection.lang_code || 1,
        langSlug: connection.lang_slug || 'es',
      };

      // Obtener productos existentes (todos los campos para comparar cambios)
      addLog('Obteniendo productos existentes de la base de datos...', 'info');
      const { data: existingProducts, error: existingError } = await supabase
        .from('products')
        .select('sku, name, price, category, subcategory, description, image_url, product_url, all_categories');
      
      if (existingError) {
        addLog(`Error obteniendo productos existentes: ${existingError.message}`, 'error');
        throw new Error(`Error fetching existing products: ${existingError.message}`);
      }
      
      // Crear sets y mapas para verificar productos existentes (normalizados)
      const existingSkus = new Set<string>();
      const existingNameSkuPairs = new Map<string, string>(); // nombre -> sku para productos sin SKU
      const existingProductsMap = new Map<string, any>(); // SKU normalizado -> producto completo
      
      (existingProducts || []).forEach((p: any) => {
        const sku = p.sku?.trim() || '';
        const name = p.name?.trim() || '';
        
        if (sku) {
          // Normalizar SKU: lowercase y eliminar espacios
          const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
          existingSkus.add(normalizedSku);
          existingProductsMap.set(normalizedSku, p);
        }
        
        if (name) {
          // Normalizar nombre: lowercase y eliminar espacios extras
          const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
          existingNameSkuPairs.set(normalizedName, sku);
          // También guardar por nombre si no tiene SKU
          if (!sku) {
            existingProductsMap.set(`name:${normalizedName}`, p);
          }
        }
      });

      addLog(`Productos existentes en base de datos: ${existingProducts?.length || 0} (${existingSkus.size} con SKU, ${existingNameSkuPairs.size} con nombre)`, 'info');

      // Obtener todas las categorías primero para evitar múltiples requests
      addLog('Precargando categorías de PrestaShop...', 'info');
      const categoryIdsSet = new Set<number>();
      
      // Primero obtener todos los productos sin procesar categorías para extraer los IDs
      const rawProducts: any[] = [];
      let offset = 0;
      const chunkSize = 150;
      let iterations = 0;
      const maxIterations = 500;
      
      while (iterations < maxIterations) {
        const query = {
          language: String(apiConfig.langCode || 1),
          limit: `${offset},${chunkSize}`,
          display: 'full',
          sort: 'id_ASC',
        };
        
        try {
          const response = await prestashopGet('products', query, apiConfig);
          if (!response?.products || response.products.length === 0) {
            break;
          }
          
          response.products.forEach((product: any) => {
            // Agregar categoría por defecto
            if (product.id_category_default) {
              const defaultCatId = parseInt(product.id_category_default);
              if (defaultCatId !== 1 && defaultCatId !== 0) {
                categoryIdsSet.add(defaultCatId);
              }
            }
            
            // Agregar todas las categorías asociadas
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
              
              associatedCategories.forEach((cat: any) => {
                let catId: number | null = null;
                if (typeof cat === 'object' && cat !== null) {
                  catId = parseInt(cat.id || cat.id?.value || '0');
                } else if (typeof cat === 'string' || typeof cat === 'number') {
                  catId = parseInt(String(cat));
                }
                if (catId && catId !== 1 && catId !== 0) {
                  categoryIdsSet.add(catId);
                }
              });
            }
            
            rawProducts.push(product);
          });
          
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
      
      addLog(`Productos obtenidos: ${rawProducts.length}, Categorías únicas: ${categoryIdsSet.size}`, 'info');
      
      // Precargar todas las categorías con su jerarquía
      addLog('Construyendo jerarquía de categorías...', 'info');
      const categoryCache = new Map<number, CategoryInfo>();
      for (const categoryId of categoryIdsSet) {
        if (categoryId && categoryId !== 1 && categoryId !== 0) {
          await getCategoryInfo(categoryId, categoryCache, apiConfig);
        }
      }
      addLog(`Categorías precargadas: ${categoryCache.size}`, 'info');
      
      // Ahora mapear productos usando categorías ya en cache
      addLog('Mapeando productos con categorías...', 'info');
      const allProducts: Array<Product & { subcategory?: string | null }> = [];
      for (const product of rawProducts) {
        const mappedProduct = await mapProduct(product, categoryCache, apiConfig);
        allProducts.push(mappedProduct);
      }

      addLog(`Productos escaneados de PrestaShop: ${allProducts.length}`, 'info');
      
      // Debug: Mostrar estadísticas de categorías
      const categoryStats = new Map<string, number>();
      allProducts.forEach((p: any) => {
        const cat = p.category || 'Sin categoría';
        categoryStats.set(cat, (categoryStats.get(cat) || 0) + 1);
      });
      const topCategories = Array.from(categoryStats.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([cat, count]) => `${cat} (${count})`)
        .join(', ');
      addLog(`Top categorías encontradas: ${topCategories}`, 'info');

      // Separar productos nuevos de productos que necesitan actualización
      const productsToUpdate: Array<{ product: any; existing: any }> = [];
      const trulyNewProducts: any[] = [];

      allProducts.forEach((product: any) => {
        const sku = product.sku?.trim() || '';
        const name = product.name?.trim() || '';
        let existing: any = null;

        if (sku) {
          const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
          existing = existingProductsMap.get(normalizedSku);
        } else if (name) {
          const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
          existing = existingProductsMap.get(`name:${normalizedName}`);
        }

        if (existing) {
          // Comparar all_categories (JSONB)
          const existingCategoriesJson = JSON.stringify(existing.all_categories || []);
          const newCategoriesJson = JSON.stringify(product.all_categories || []);
          
          // Producto existe: verificar si necesita actualización
          const needsUpdate = 
            (product.name?.trim() || '') !== (existing.name?.trim() || '') ||
            (product.price?.trim() || '') !== (existing.price?.trim() || '') ||
            (product.category?.trim() || '') !== (existing.category?.trim() || '') ||
            (product.subcategory || null) !== (existing.subcategory || null) ||
            (product.description?.trim() || '') !== (existing.description?.trim() || '') ||
            (product.image?.trim() || '') !== (existing.image_url?.trim() || '') ||
            (product.product_url?.trim() || '') !== (existing.product_url?.trim() || '') ||
            existingCategoriesJson !== newCategoriesJson;

          if (needsUpdate) {
            productsToUpdate.push({ product, existing });
          }
        } else {
          // Producto nuevo
          const normalizedSku = sku ? sku.toLowerCase().replace(/\s+/g, '') : '';
          const normalizedName = name ? name.toLowerCase().replace(/\s+/g, ' ').trim() : '';
          
          if (normalizedSku && !existingSkus.has(normalizedSku)) {
            trulyNewProducts.push(product);
          } else if (!normalizedSku && normalizedName && !existingNameSkuPairs.has(normalizedName)) {
            trulyNewProducts.push(product);
          }
        }
      });

      addLog(`Productos que necesitan actualización: ${productsToUpdate.length}`, 'info');
      addLog(`Productos realmente nuevos: ${trulyNewProducts.length}`, 'info');

      // Reinicializar contadores para esta sincronización
      imported = 0;
      updated = 0;
      const errors: Array<{ sku?: string; error: string; batch?: number }> = [];

      // Actualizar productos existentes
      if (productsToUpdate.length > 0) {
        addLog('Actualizando productos existentes...', 'info');
        const batchSize = 100;
        for (let i = 0; i < productsToUpdate.length; i += batchSize) {
          const batch = productsToUpdate.slice(i, i + batchSize);
          
          const updates = batch.map(({ product }) => ({
            name: product.name || '',
            price: product.price || '',
            category: product.category || '',
            subcategory: product.subcategory || null,
            description: product.description || '',
            image_url: product.image || '',
            product_url: product.product_url || '',
            all_categories: product.all_categories || [],
            updated_at: new Date().toISOString(),
            // Usar SKU o nombre para identificar el producto
            ...(product.sku?.trim() ? { sku: product.sku.trim() } : {})
          }));

          // Actualizar en batch por SKU (más eficiente)
          const skuUpdates = updates.filter(u => u.sku);
          const nameUpdates = updates.filter(u => !u.sku);
          
          // Actualizar por SKU en batch
          if (skuUpdates.length > 0) {
            // Agrupar por SKU y actualizar
            for (const update of skuUpdates) {
              const sku = update.sku?.trim() || '';
              const { error: updateError } = await supabase
                .from('products')
                .update({
                  name: update.name,
                  price: update.price,
                  category: update.category,
                  subcategory: update.subcategory,
                  description: update.description,
                  image_url: update.image_url,
                  product_url: update.product_url,
                  all_categories: update.all_categories,
                  updated_at: update.updated_at
                })
                .eq('sku', sku);

              if (updateError) {
                errors.push({ error: updateError.message, sku });
                addLog(`Error actualizando producto SKU ${sku}: ${updateError.message}`, 'error');
              } else {
                // Incrementar contador de productos actualizados
                updated = updated + 1;
              }
            }
          }
          
          // Actualizar por nombre (sin SKU)
          if (nameUpdates.length > 0) {
            for (const update of nameUpdates) {
              const { error: updateError } = await supabase
                .from('products')
                .update({
                  price: update.price,
                  category: update.category,
                  subcategory: update.subcategory,
                  description: update.description,
                  image_url: update.image_url,
                  product_url: update.product_url,
                  all_categories: update.all_categories,
                  updated_at: update.updated_at
                })
                .eq('name', update.name);

              if (updateError) {
                errors.push({ error: updateError.message });
                addLog(`Error actualizando producto ${update.name}: ${updateError.message}`, 'error');
              } else {
                // Incrementar contador de productos actualizados
                updated = updated + 1;
              }
            }
          }

          addLog(`Lote ${Math.floor(i / batchSize) + 1} actualizado: ${batch.length} productos`, 'success');
        }
      }

      // Insertar productos nuevos
      if (trulyNewProducts.length > 0) {
        addLog('Importando productos nuevos...', 'info');

        // Preparar productos para insertar, filtrando duplicados dentro del mismo lote
        const productsToInsert: any[] = [];
        const seenSkus = new Set<string>();
        const seenNames = new Set<string>();
        
        for (const product of trulyNewProducts) {
          const sku = product.sku?.trim() || '';
          const name = product.name?.trim().toLowerCase() || '';
          
          // Verificar duplicados dentro del lote
          if (sku) {
            const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
            if (seenSkus.has(normalizedSku)) {
              continue; // Skip duplicado en el lote
            }
            seenSkus.add(normalizedSku);
          } else if (name) {
            if (seenNames.has(name)) {
              continue; // Skip duplicado en el lote
            }
            seenNames.add(name);
          }
          
          // Generar SKU único si está vacío (usando timestamp + índice)
          const finalSku = sku || `AUTO-${Date.now()}-${productsToInsert.length}`;
          
          productsToInsert.push({
            name: product.name || '',
            price: product.price || '',
            category: product.category || '',
            subcategory: product.subcategory || null,
            description: product.description || '',
            sku: finalSku,
            image_url: product.image || '',
            product_url: product.product_url || '',
            all_categories: product.all_categories || [],
            updated_at: new Date().toISOString(),
          });
        }
        
        addLog(`Productos a insertar después de filtrar duplicados en lote: ${productsToInsert.length}`, 'info');

        // Insertar SOLO productos nuevos
        const batchSize = 100;
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
          const batch = productsToInsert.slice(i, i + batchSize);
          
          // Verificar una vez más antes de insertar
          const skusInBatch = batch.map(p => p.sku).filter(Boolean);
          const { data: existingInBatch } = await supabase
            .from('products')
            .select('sku')
            .in('sku', skusInBatch);
          
          const existingSkusInBatch = new Set((existingInBatch || []).map((p: any) => p.sku?.trim().toLowerCase()));
          const finalBatch = batch.filter(p => {
            const normalizedSku = p.sku?.trim().toLowerCase() || '';
            return !existingSkusInBatch.has(normalizedSku);
          });
          
          if (finalBatch.length === 0) {
            addLog(`Lote ${Math.floor(i / batchSize) + 1}: Todos los productos ya existen, saltando...`, 'info');
            continue;
          }
          
          // Insertar productos nuevos
          const { data: insertedData, error: insertError } = await supabase
            .from('products')
            .insert(finalBatch)
            .select();

          if (insertError) {
            errors.push({ error: insertError.message, batch: i / batchSize + 1 });
            addLog(`Error en lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`, 'error');
          } else {
            const insertedCount = insertedData?.length || 0;
            imported += insertedCount;
            addLog(`Lote ${Math.floor(i / batchSize) + 1} importado: ${insertedCount} productos nuevos`, 'success');
          }
        }
      } else {
        addLog('No hay productos nuevos para importar', 'info');
      }

      // Actualizar registro de sincronización como completado
      await supabase
        .from('product_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'completed',
          total_products_scanned: allProducts.length,
          new_products_found: trulyNewProducts.length,
          products_imported: imported,
          products_updated: updated,
          errors: errors,
          log_messages: logMessages
        })
        .eq('id', syncId);

      addLog('Sincronización completada exitosamente', 'success');

      res.status(200).json({
        success: true,
        syncId,
        message: 'Sincronización completada',
        totalProductsScanned: allProducts.length,
        newProductsFound: trulyNewProducts.length,
        productsImported: imported,
        productsUpdated: updated,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      // Actualizar registro como fallido
      const errorMessage = error instanceof Error ? error.message : 'Error desconocido';
      addLog(`Error en sincronización: ${errorMessage}`, 'error');
      console.error('Sync error:', error);
      
      // Intentar actualizar el estado (puede fallar si hay problema de conexión)
      try {
        await supabase
          .from('product_sync_history')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'failed',
            errors: [{ error: errorMessage }],
            log_messages: logMessages,
            products_updated: updated || 0,
            products_imported: imported || 0
          })
          .eq('id', syncId);
      } catch (updateError) {
        console.error('Error updating sync status:', updateError);
      }

      throw error;
    }

  } catch (error) {
    console.error('Sync products error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}


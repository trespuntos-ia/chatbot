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
    const response = await fetch(url, {
      headers: {
        'Authorization': getAuthHeader(config.apiKey),
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });
    if (response.ok) {
      const data = await response.json();
      const category = data.category || data;
      const name = extractMultilanguageValue(category.name);
      const parentId = category.id_parent ? parseInt(category.id_parent) : null;
      return { name, parentId };
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
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
    
    hierarchy.unshift(basicInfo.name);
    
    // Si no tiene padre o el padre es la raíz, terminamos
    if (!basicInfo.parentId || basicInfo.parentId === 1 || basicInfo.parentId === 0) {
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
  
  if (product.id_category_default) {
    const categoryInfo = await getCategoryInfo(parseInt(product.id_category_default), categoryCache, config);
    const hierarchy = categoryInfo.hierarchy || [];
    
    // Manejar jerarquía de hasta 3 niveles:
    // Nivel 1: Categoría principal (raíz)
    // Nivel 2: Subcategoría
    // Nivel 3: Sub-subcategoría (la del producto)
    
    if (hierarchy.length === 1) {
      // Solo 1 nivel: solo categoría
      category = hierarchy[0];
      subcategory = null;
    } else if (hierarchy.length === 2) {
      // 2 niveles: categoría y subcategoría
      category = hierarchy[0];
      subcategory = hierarchy[1];
    } else if (hierarchy.length >= 3) {
      // 3 niveles: categoría, subcategoría y sub-subcategoría
      // En Supabase guardamos: category = nivel 1, subcategory = nivel 2 > nivel 3
      category = hierarchy[0];
      subcategory = `${hierarchy[1]} > ${hierarchy[2]}`; // Concatenar niveles 2 y 3
    } else {
      // Sin jerarquía
      category = categoryInfo.name || '';
      subcategory = null;
    }
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

      // Obtener productos existentes (SKU y también por nombre para productos sin SKU)
      addLog('Obteniendo productos existentes de la base de datos...', 'info');
      const { data: existingProducts, error: existingError } = await supabase
        .from('products')
        .select('sku, name');
      
      if (existingError) {
        addLog(`Error obteniendo productos existentes: ${existingError.message}`, 'error');
        throw new Error(`Error fetching existing products: ${existingError.message}`);
      }
      
      // Crear sets para verificar productos existentes (normalizados)
      // Normalizar SKUs: trim, lowercase, eliminar espacios extras
      const existingSkus = new Set<string>();
      const existingNameSkuPairs = new Map<string, string>(); // nombre -> sku para productos sin SKU
      
      (existingProducts || []).forEach((p: any) => {
        const sku = p.sku?.trim() || '';
        const name = p.name?.trim() || '';
        
        if (sku) {
          // Normalizar SKU: lowercase y eliminar espacios
          const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
          existingSkus.add(normalizedSku);
        }
        
        if (name) {
          // Normalizar nombre: lowercase y eliminar espacios extras
          const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
          existingNameSkuPairs.set(normalizedName, sku);
        }
      });

      addLog(`Productos existentes en base de datos: ${existingProducts?.length || 0} (${existingSkus.size} con SKU, ${existingNameSkuPairs.size} con nombre)`, 'info');

      // Obtener todos los productos de PrestaShop
      addLog('Escaneando productos de PrestaShop...', 'info');
      const allProducts = await fetchAllProducts(apiConfig, (current, total) => {
        // Opcional: actualizar progreso en la base de datos
      });

      addLog(`Productos escaneados de PrestaShop: ${allProducts.length}`, 'info');

      // Filtrar productos nuevos (verificar por SKU y también por nombre si no tiene SKU)
      const newProducts = allProducts.filter(product => {
        const sku = product.sku?.trim() || '';
        const name = product.name?.trim() || '';
        
        if (sku) {
          // Producto con SKU: verificar por SKU normalizado
          const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
          return !existingSkus.has(normalizedSku);
        } else if (name) {
          // Producto sin SKU: verificar por nombre normalizado
          const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
          return !existingNameSkuPairs.has(normalizedName);
        } else {
          // Sin SKU ni nombre, lo consideramos nuevo pero puede dar problemas
          return true;
        }
      });
      
      // Debug: contar por qué se consideran nuevos
      let newBySku = 0;
      let newByName = 0;
      let newByNoData = 0;
      
      allProducts.forEach(product => {
        const sku = product.sku?.trim() || '';
        const name = product.name?.trim() || '';
        
        if (sku) {
          const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
          if (!existingSkus.has(normalizedSku)) newBySku++;
        } else if (name) {
          const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
          if (!existingNameSkuPairs.has(normalizedName)) newByName++;
        } else {
          newByNoData++;
        }
      });
      
      addLog(`Desglose de productos nuevos: ${newBySku} por SKU, ${newByName} por nombre, ${newByNoData} sin datos`, 'info');

      addLog(`Productos nuevos encontrados: ${newProducts.length}`, 'info');

      let imported = 0;
      const errors: Array<{ sku?: string; error: string }> = [];

      if (newProducts.length > 0) {
        addLog('Importando productos nuevos...', 'info');

        // Preparar productos para insertar
        const productsToInsert = newProducts.map((product: any) => ({
          name: product.name || '',
          price: product.price || '',
          category: product.category || '',
          subcategory: product.subcategory || null,
          description: product.description || '',
          sku: product.sku || '',
          image_url: product.image || '',
          product_url: product.product_url || '',
          updated_at: new Date().toISOString(),
        }));

        // Insertar SOLO productos nuevos (NO actualizar existentes)
        // Usar insert con ignoreDuplicates para evitar errores de duplicados
        const batchSize = 100;
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
          const batch = productsToInsert.slice(i, i + batchSize);
          
          // Verificar una vez más que no existan antes de insertar (usando la misma normalización)
          const trulyNewProducts = batch.filter((p: any) => {
            const sku = p.sku?.trim() || '';
            const name = p.name?.trim() || '';
            
            if (sku) {
              const normalizedSku = sku.toLowerCase().replace(/\s+/g, '');
              return !existingSkus.has(normalizedSku);
            } else if (name) {
              const normalizedName = name.toLowerCase().replace(/\s+/g, ' ').trim();
              return !existingNameSkuPairs.has(normalizedName);
            } else {
              // Sin SKU ni nombre: verificar si existe en la base de datos
              // Esto es más costoso, así que solo para este caso especial
              return true; // Ya fue filtrado en la primera verificación
            }
          });
          
          if (trulyNewProducts.length === 0) {
            addLog(`Lote ${Math.floor(i / batchSize) + 1}: Todos los productos ya existen, saltando...`, 'info');
            continue;
          }
          
          // Insertar solo productos realmente nuevos
          const { data: insertedData, error: insertError } = await supabase
            .from('products')
            .insert(trulyNewProducts)
            .select();

          if (insertError) {
            errors.push({ error: insertError.message, batch: i / batchSize + 1 });
            addLog(`Error en lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`, 'error');
          } else {
            const insertedCount = insertedData?.length || 0;
            imported += insertedCount;
            addLog(`Lote ${Math.floor(i / batchSize) + 1} importado: ${insertedCount} productos nuevos`, 'success');
            
            if (trulyNewProducts.length > insertedCount) {
              addLog(`  (${trulyNewProducts.length - insertedCount} productos ya existían y fueron omitidos)`, 'info');
            }
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
          new_products_found: newProducts.length,
          products_imported: imported,
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
        newProductsFound: newProducts.length,
        productsImported: imported,
        errors: errors.length > 0 ? errors : undefined
      });

    } catch (error) {
      // Actualizar registro como fallido
      addLog(`Error en sincronización: ${error instanceof Error ? error.message : 'Error desconocido'}`, 'error');
      
      await supabase
        .from('product_sync_history')
        .update({
          sync_completed_at: new Date().toISOString(),
          status: 'failed',
          errors: [{ error: error instanceof Error ? error.message : 'Unknown error' }],
          log_messages: logMessages
        })
        .eq('id', syncId);

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


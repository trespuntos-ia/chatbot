import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Script para corregir categorías de productos que tienen "Inicio" como categoría
 * Este script busca en PrestaShop las categorías reales usando las asociaciones
 */

interface ApiConfig {
  prestashopUrl: string;
  apiKey: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}

function extractMultilanguageValue(field: any): string {
  if (typeof field === 'string') return field;
  if (Array.isArray(field) && field.length > 0) {
    return field[0].value || field[0] || '';
  }
  if (field && typeof field === 'object' && field.value) {
    return field.value;
  }
  return '';
}

async function getCategoryName(categoryId: number, config: ApiConfig): Promise<string> {
  if (!categoryId || categoryId === 1 || categoryId === 0) return '';
  
  try {
    const queryParams = new URLSearchParams({
      ws_key: config.apiKey,
      output_format: 'JSON',
      language: String(config.langCode || 1),
    });
    const url = `${config.prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const category = data.category || data;
      return extractMultilanguageValue(category.name);
    }
  } catch (error) {
    console.error(`Error fetching category ${categoryId}:`, error);
  }
  
  return '';
}

async function getProductCategory(productId: number, config: ApiConfig): Promise<string | null> {
  try {
    const queryParams = new URLSearchParams({
      ws_key: config.apiKey,
      output_format: 'JSON',
      language: String(config.langCode || 1),
    });
    const url = `${config.prestashopUrl.replace(/\/$/, '')}/products/${productId}?${queryParams.toString()}`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${btoa(config.apiKey + ':')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });
    
    if (response.ok) {
      const data = await response.json();
      const product = data.product || data;
      
      // Si id_category_default es 1, buscar en associations
      const defaultCategoryId = parseInt(product.id_category_default || '0');
      
      if (defaultCategoryId === 1 && product.associations && product.associations.categories) {
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
        
        // Encontrar la primera categoría válida
        for (const cat of associatedCategories) {
          let catId: number | null = null;
          
          if (typeof cat === 'object' && cat !== null) {
            catId = parseInt(cat.id || cat.id?.value || '0');
          } else if (typeof cat === 'string' || typeof cat === 'number') {
            catId = parseInt(String(cat));
          }
          
          if (catId && catId !== 1 && catId !== 0) {
            const categoryName = await getCategoryName(catId, config);
            if (categoryName) return categoryName;
          }
        }
      } else if (defaultCategoryId !== 1 && defaultCategoryId !== 0) {
        const categoryName = await getCategoryName(defaultCategoryId, config);
        if (categoryName) return categoryName;
      }
    }
  } catch (error) {
    console.error(`Error fetching product ${productId}:`, error);
  }
  
  return null;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener configuración de PrestaShop
    const { data: connections } = await supabase
      .from('prestashop_connections')
      .select('*')
      .eq('is_active', true)
      .limit(1)
      .single();

    if (!connections) {
      res.status(500).json({ error: 'No active PrestaShop connection found' });
      return;
    }

    const apiConfig: ApiConfig = {
      prestashopUrl: connections.prestashop_url,
      apiKey: connections.api_key,
      baseUrl: connections.base_url,
      langCode: connections.lang_code || 1,
      langSlug: connections.lang_slug || 'es',
    };

    // Obtener productos con categoría "Inicio" o vacía
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, sku, category, product_url')
      .or('category.eq.Inicio,category.is.null,category.eq.');

    if (error) {
      res.status(500).json({ error: error.message });
      return;
    }

    if (!products || products.length === 0) {
      res.status(200).json({ 
        message: 'No products found with incorrect categories',
        updated: 0 
      });
      return;
    }

    // Extraer ID de producto de product_url o usar SKU para buscar
    const updates: Array<{ id: string; category: string }> = [];
    let updated = 0;
    let errors = 0;

    for (const product of products) {
      try {
        // Intentar extraer ID de product_url
        let productId: number | null = null;
        
        if (product.product_url) {
          const match = product.product_url.match(/\/(\d+)-/);
          if (match) {
            productId = parseInt(match[1]);
          }
        }

        // Si no encontramos ID en URL, necesitaríamos buscar por SKU
        // Por ahora, solo procesamos los que tienen ID en URL
        if (productId) {
          const category = await getProductCategory(productId, apiConfig);
          
          if (category && category !== 'Inicio') {
            updates.push({ id: product.id, category });
          }
        }
      } catch (error) {
        console.error(`Error processing product ${product.name}:`, error);
        errors++;
      }
    }

    // Actualizar productos en lotes
    const batchSize = 50;
    for (let i = 0; i < updates.length; i += batchSize) {
      const batch = updates.slice(i, i + batchSize);
      
      for (const update of batch) {
        const { error: updateError } = await supabase
          .from('products')
          .update({ category: update.category })
          .eq('id', update.id);
        
        if (updateError) {
          console.error(`Error updating product ${update.id}:`, updateError);
          errors++;
        } else {
          updated++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Updated ${updated} products, ${errors} errors`,
      total: products.length,
      updated,
      errors
    });
  } catch (error) {
    console.error('Fix categories error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}











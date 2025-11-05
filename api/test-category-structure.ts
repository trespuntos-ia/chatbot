import type { VercelRequest, VercelResponse } from '@vercel/node';

/**
 * Endpoint de prueba para verificar la estructura de categorías de PrestaShop
 * Uso: /api/test-category-structure?categoryId=XX&prestashop_url=XXX&ws_key=XXX
 */
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
    const { categoryId, productId, prestashop_url, ws_key, language } = req.query;

    const prestashopUrl = (prestashop_url as string) || process.env.PRESTASHOP_API_URL || 'https://100x100chef.com/shop/api/';
    const apiKey = (ws_key as string) || process.env.PRESTASHOP_API_KEY;

    if (!apiKey) {
      res.status(400).json({ error: 'API Key is required' });
      return;
    }

    const langCode = language || '1';
    const query = new URLSearchParams({
      ws_key: apiKey,
      output_format: 'JSON',
      language: String(langCode),
    });

    let result: any = {};

    // Si se proporciona un categoryId, obtener esa categoría y su padre
    if (categoryId) {
      const categoryUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${query.toString()}`;
      const categoryResponse = await fetch(categoryUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
        },
      });

      if (categoryResponse.ok) {
        const categoryData = await categoryResponse.json();
        result.category = categoryData.category || null;
        
        // Si tiene padre, obtener también el padre
        if (categoryData.category?.id_parent && categoryData.category.id_parent !== '0' && categoryData.category.id_parent !== '1') {
          const parentId = categoryData.category.id_parent;
          const parentUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${parentId}?${query.toString()}`;
          const parentResponse = await fetch(parentUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
              'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
            },
          });
          
          if (parentResponse.ok) {
            const parentData = await parentResponse.json();
            result.parentCategory = parentData.category || null;
          }
        }
      }
    }

    // Si se proporciona un productId, obtener el producto y sus categorías
    if (productId) {
      const productUrl = `${prestashopUrl.replace(/\/$/, '')}/products/${productId}?${query.toString()}`;
      const productResponse = await fetch(productUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
        },
      });

      if (productResponse.ok) {
        const productData = await productResponse.json();
        result.product = {
          id: productData.product?.id,
          name: productData.product?.name,
          id_category_default: productData.product?.id_category_default,
          // También obtener todas las categorías asociadas
          associations: productData.product?.associations || null,
        };

        // Obtener la categoría por defecto
        if (productData.product?.id_category_default) {
          const defaultCategoryId = productData.product.id_category_default;
          const defaultCategoryUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${defaultCategoryId}?${query.toString()}`;
          const defaultCategoryResponse = await fetch(defaultCategoryUrl, {
            method: 'GET',
            headers: {
              'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
              'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
            },
          });
          
          if (defaultCategoryResponse.ok) {
            const defaultCategoryData = await defaultCategoryResponse.json();
            result.product.defaultCategory = defaultCategoryData.category || null;
            
            // Obtener también el padre si existe
            if (defaultCategoryData.category?.id_parent && defaultCategoryData.category.id_parent !== '0' && defaultCategoryData.category.id_parent !== '1') {
              const parentId = defaultCategoryData.category.id_parent;
              const parentUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${parentId}?${query.toString()}`;
              const parentResponse = await fetch(parentUrl, {
                method: 'GET',
                headers: {
                  'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                  'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
                },
              });
              
              if (parentResponse.ok) {
                const parentData = await parentResponse.json();
                result.product.parentCategory = parentData.category || null;
              }
            }
          }
        }
      }
    }

    // Si no se proporciona ni categoryId ni productId, obtener algunos productos de ejemplo
    if (!categoryId && !productId) {
      const productsUrl = `${prestashopUrl.replace(/\/$/, '')}/products?${query.toString()}&limit=0,5&display=[id,name,id_category_default]`;
      const productsResponse = await fetch(productsUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
          'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
        },
      });

      if (productsResponse.ok) {
        const productsData = await productsResponse.json();
        result.sampleProducts = productsData.products?.slice(0, 3) || [];
        
        // Para cada producto, obtener su categoría
        for (const product of result.sampleProducts) {
          if (product.id_category_default) {
            const catUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${product.id_category_default}?${query.toString()}`;
            const catResponse = await fetch(catUrl, {
              method: 'GET',
              headers: {
                'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
              },
            });
            
            if (catResponse.ok) {
              const catData = await catResponse.json();
              product.category = catData.category || null;
              
              // Obtener padre si existe
              if (catData.category?.id_parent && catData.category.id_parent !== '0' && catData.category.id_parent !== '1') {
                const parentId = catData.category.id_parent;
                const parentUrl = `${prestashopUrl.replace(/\/$/, '')}/categories/${parentId}?${query.toString()}`;
                const parentResponse = await fetch(parentUrl, {
                  method: 'GET',
                  headers: {
                    'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
                    'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
                  },
                });
                
                if (parentResponse.ok) {
                  const parentData = await parentResponse.json();
                  product.parentCategory = parentData.category || null;
                }
              }
            }
          }
        }
      }
    }

    res.status(200).json({
      success: true,
      message: 'Estructura de categorías de PrestaShop',
      data: result,
      note: 'Para probar, usa: ?categoryId=XX o ?productId=XX o sin parámetros para ver productos de ejemplo'
    });
  } catch (error) {
    console.error('Test category structure error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      details: error instanceof Error ? error.stack : undefined
    });
  }
}



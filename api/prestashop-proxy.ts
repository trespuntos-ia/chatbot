import type { VercelRequest, VercelResponse } from '@vercel/node';

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

  // Manejar preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // Solo permitir GET
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { endpoint, ...queryParams } = req.query;

    if (!endpoint || typeof endpoint !== 'string') {
      res.status(400).json({ error: 'Endpoint is required' });
      return;
    }

    // Obtener la URL base de PrestaShop desde los query params o variables de entorno
    const prestashopUrl = (queryParams.prestashop_url as string) || process.env.PRESTASHOP_API_URL || 'https://100x100chef.com/shop/api/';
    const apiKey = queryParams.ws_key as string || process.env.PRESTASHOP_API_KEY;

    if (!apiKey) {
      res.status(400).json({ error: 'API Key is required' });
      return;
    }

    // Construir query string
    // El parámetro 'display' puede venir con corchetes, necesitamos manejarlo correctamente
    const query = new URLSearchParams();
    query.set('ws_key', apiKey as string);
    query.set('output_format', 'JSON');
    
    // Agregar todos los demás parámetros
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'prestashop_url' && key !== 'ws_key' && key !== 'endpoint') {
        // Si el valor es un string con corchetes (display), mantenerlo como está
        if (typeof value === 'string') {
          query.set(key, value);
        } else {
          query.set(key, String(value));
        }
      }
    }

    const url = `${prestashopUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}?${query.toString()}`;

    // Hacer la solicitud a la API de PrestaShop
    console.log('Making request to PrestaShop:', url.substring(0, 100) + '...');
    
    // Crear AbortController para timeout (compatible con Node.js 18)
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Could not read error response');
      console.error('PrestaShop API error:', {
        status: response.status,
        statusText: response.statusText,
        errorText: errorText.substring(0, 500)
      });
      
      res.status(response.status).json({ 
        error: `API Error: ${response.status} ${response.statusText}`,
        details: errorText.substring(0, 1000),
        url: url.substring(0, 200) // Solo mostrar parte de la URL por seguridad
      });
      return;
    }

    // Intentar parsear JSON
    let data;
    try {
      const text = await response.text();
      data = JSON.parse(text);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      res.status(500).json({
        error: 'Invalid JSON response from PrestaShop API',
        message: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      });
      return;
    }

    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    
    // Detectar errores específicos
    let errorMessage = 'Internal server error';
    let details = error instanceof Error ? error.message : 'Unknown error';
    
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        errorMessage = 'Request timeout';
        details = 'The request to PrestaShop API timed out. Please try again.';
      } else if (error.message.includes('fetch')) {
        errorMessage = 'Network error';
        details = 'Could not connect to PrestaShop API. Check the URL and network connection.';
      }
    }
    
    res.status(500).json({ 
      error: errorMessage,
      details: details,
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


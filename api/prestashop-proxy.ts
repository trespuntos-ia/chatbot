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
    // El parámetro 'display' necesita corchetes sin codificar para PrestaShop
    const queryParts: string[] = [];
    queryParts.push(`ws_key=${encodeURIComponent(apiKey as string)}`);
    queryParts.push(`output_format=JSON`);
    
    // Agregar todos los demás parámetros
    for (const [key, value] of Object.entries(queryParams)) {
      if (key !== 'prestashop_url' && key !== 'ws_key' && key !== 'endpoint') {
        // El parámetro 'display' puede venir codificado o no, necesitamos decodificarlo y mantener corchetes sin codificar
        if (key === 'display') {
          let displayValue = String(value);
          // Si viene codificado, decodificarlo
          try {
            displayValue = decodeURIComponent(displayValue);
          } catch (e) {
            // Si falla la decodificación, usar el valor original
          }
          // Asegurarse de que los corchetes estén sin codificar
          displayValue = displayValue.replace(/%5B/g, '[').replace(/%5D/g, ']');
          queryParts.push(`${key}=${displayValue}`);
        } else {
          queryParts.push(`${key}=${encodeURIComponent(String(value))}`);
        }
      }
    }

    const queryString = queryParts.join('&');
    const url = `${prestashopUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}?${queryString}`;

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


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
    const query = new URLSearchParams({
      ws_key: apiKey as string,
      output_format: 'JSON',
      ...(queryParams as Record<string, string>),
    });

    const url = `${prestashopUrl.replace(/\/$/, '')}/${endpoint.replace(/^\//, '')}?${query.toString()}`;

    // Hacer la solicitud a la API de PrestaShop
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      res.status(response.status).json({ 
        error: `API Error: ${response.status} ${response.statusText}`,
        details: errorText 
      });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


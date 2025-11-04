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

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { categoryId, language } = req.query;

    if (!categoryId || typeof categoryId !== 'string') {
      res.status(400).json({ error: 'Category ID is required' });
      return;
    }

    const prestashopUrl = (req.query.prestashop_url as string) || process.env.PRESTASHOP_API_URL || 'https://100x100chef.com/shop/api/';
    const apiKey = req.query.ws_key as string || process.env.PRESTASHOP_API_KEY;

    if (!apiKey) {
      res.status(400).json({ error: 'API Key is required' });
      return;
    }

    const query = new URLSearchParams({
      ws_key: apiKey,
      output_format: 'JSON',
      language: (language as string) || '1',
    });

    const url = `${prestashopUrl.replace(/\/$/, '')}/categories/${categoryId}?${query.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Basic ${Buffer.from(apiKey + ':').toString('base64')}`,
        'User-Agent': 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
      },
    });

    if (!response.ok) {
      res.status(response.status).json({ 
        error: `API Error: ${response.status} ${response.statusText}`
      });
      return;
    }

    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    console.error('Category proxy error:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


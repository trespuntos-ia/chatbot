import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        details: 'Asegúrate de configurar SUPABASE_URL y SUPABASE_ANON_KEY.',
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('product_videos')
      .select('id, title, youtube_url, product_id, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[get-product-videos] Supabase error:', error);
      res.status(500).json({
        success: false,
        error: 'Error al consultar los videos',
        details: error.message,
      });
      return;
    }

    const productIds = Array.from(
      new Set(
        (data || [])
          .map((video) => (typeof video.product_id === 'number' ? video.product_id : null))
          .filter((id): id is number => id !== null)
      )
    );

    let productsById: Record<number, { name: string; sku: string; product_url: string | null }> = {};

    if (productIds.length > 0) {
      const { data: productsData, error: productsError } = await supabase
        .from('products')
        .select('id, name, sku, product_url')
        .in('id', productIds);

      if (productsError) {
        console.warn('[get-product-videos] Error fetching products:', productsError);
      } else if (Array.isArray(productsData)) {
        productsById = productsData.reduce((acc, product) => {
          if (typeof product.id === 'number') {
            acc[product.id] = {
              name: product.name ?? '',
              sku: product.sku ?? '',
              product_url: product.product_url ?? null,
            };
          }
          return acc;
        }, {} as Record<number, { name: string; sku: string; product_url: string | null }>);
      }
    }

    const videos = (data || []).map((video) => {
      const product = video.product_id ? productsById[video.product_id] : undefined;
      return {
        id: video.id,
        title: video.title,
        youtube_url: video.youtube_url,
        product_id: video.product_id ?? null,
        created_at: video.created_at,
        updated_at: video.updated_at,
        product_name: product?.name ?? null,
        product_sku: product?.sku ?? null,
        product_url: product?.product_url ?? null,
      };
    });

    res.status(200).json({
      success: true,
      videos,
    });
  } catch (error) {
    console.error('[get-product-videos] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


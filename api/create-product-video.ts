import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

function isValidYoutubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();
    return (
      host.includes('youtube.com') ||
      host.includes('youtu.be') ||
      host.includes('youtube-nocookie.com')
    );
  } catch {
    return false;
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
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
    const { youtubeUrl, title, productId } = req.body ?? {};

    if (typeof youtubeUrl !== 'string' || youtubeUrl.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'URL requerida',
        details: 'Debes proporcionar una URL válida de YouTube.',
      });
      return;
    }

    if (!isValidYoutubeUrl(youtubeUrl.trim())) {
      res.status(400).json({
        success: false,
        error: 'URL inválida',
        details: 'La URL debe pertenecer a YouTube.',
      });
      return;
    }

    if (productId !== null && productId !== undefined && typeof productId !== 'number') {
      res.status(400).json({
        success: false,
        error: 'ID de producto inválido',
        details: 'El ID de producto debe ser un número o null.',
      });
      return;
    }

    let productDetails:
      | { id: number; name: string | null; sku: string | null; product_url: string | null }
      | null = null;

    if (typeof productId === 'number') {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, sku, product_url')
        .eq('id', productId)
        .maybeSingle();

      if (productError) {
        console.error('[create-product-video] Error fetching product:', productError);
        res.status(500).json({
          success: false,
          error: 'Error verificando el producto',
          details: productError.message,
        });
        return;
      }

      if (!product) {
        res.status(404).json({
          success: false,
          error: 'Producto no encontrado',
          details: `No existe un producto con ID ${productId}`,
        });
        return;
      }

      productDetails = product;
    }

    const cleanTitle =
      typeof title === 'string' && title.trim().length > 0 ? title.trim().slice(0, 255) : null;

    const { data: video, error: insertError } = await supabase
      .from('product_videos')
      .insert({
        youtube_url: youtubeUrl.trim(),
        title: cleanTitle,
        product_id: typeof productId === 'number' ? productId : null,
      })
      .select('id, title, youtube_url, created_at, product_id')
      .maybeSingle();

    if (insertError) {
      console.error('[create-product-video] Error inserting video:', insertError);
      res.status(500).json({
        success: false,
        error: 'Error al guardar el video',
        details: insertError.message,
      });
      return;
    }

    res.status(200).json({
      success: true,
      video: {
        ...video,
        product_name: productDetails?.name ?? null,
        product_sku: productDetails?.sku ?? null,
        product_url: productDetails?.product_url ?? null,
      },
    });
  } catch (error) {
    console.error('[create-product-video] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


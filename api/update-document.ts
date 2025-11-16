import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'PATCH') {
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
    const { id, productId } = req.body ?? {};

    if (typeof id !== 'number' || id <= 0) {
      res.status(400).json({
        success: false,
        error: 'ID inválido',
        details: 'Debes proporcionar un ID numérico del documento.',
      });
      return;
    }

    if (productId !== null && productId !== undefined && typeof productId !== 'number') {
      res.status(400).json({
        success: false,
        error: 'ID de producto inválido',
        details: 'El ID del producto debe ser un número o null.',
      });
      return;
    }

    let productDetails: { id: number; name: string | null; sku: string | null; product_url: string | null } | null =
      null;

    if (typeof productId === 'number') {
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name, sku, product_url')
        .eq('id', productId)
        .maybeSingle();

      if (productError) {
        console.error('[update-document] Error fetching product:', productError);
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

    const { data: updatedDocument, error: updateError } = await supabase
      .from('documents')
      .update({
        product_id: typeof productId === 'number' ? productId : null,
      })
      .eq('id', id)
      .select('id, product_id')
      .maybeSingle();

    if (updateError) {
      console.error('[update-document] Error updating document:', updateError);
      res.status(500).json({
        success: false,
        error: 'Error al actualizar el documento',
        details: updateError.message,
      });
      return;
    }

    if (!updatedDocument) {
      res.status(404).json({
        success: false,
        error: 'Documento no encontrado',
        details: `No existe un documento con ID ${id}`,
      });
      return;
    }

    res.status(200).json({
      success: true,
      document: {
        id: updatedDocument.id,
        product_id: updatedDocument.product_id,
        product_name: productDetails?.name ?? null,
        product_sku: productDetails?.sku ?? null,
        product_url: productDetails?.product_url ?? null,
      },
    });
  } catch (error) {
    console.error('[update-document] Unexpected error:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


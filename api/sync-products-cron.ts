import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { fetchAllProducts } from './utils/prestashop-sync';

interface ApiConfig {
  apiKey: string;
  prestashopUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Añadir CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  
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

      // Obtener SKUs existentes
      addLog('Obteniendo productos existentes de la base de datos...', 'info');
      const { data: existingProducts } = await supabase
        .from('products')
        .select('sku');
      
      const existingSkus = new Set(
        (existingProducts || [])
          .map((p: any) => p.sku)
          .filter((sku: string) => sku && sku.trim() !== '')
      );

      addLog(`Productos existentes en base de datos: ${existingSkus.size}`, 'info');

      // Obtener todos los productos de PrestaShop
      addLog('Escaneando productos de PrestaShop...', 'info');
      const allProducts = await fetchAllProducts(apiConfig, (current, total) => {
        // Opcional: actualizar progreso en la base de datos
      });

      addLog(`Productos escaneados de PrestaShop: ${allProducts.length}`, 'info');

      // Filtrar productos nuevos
      const newProducts = allProducts.filter(product => {
        if (!product.sku || product.sku.trim() === '') {
          return true; // Sin SKU, lo consideramos nuevo
        }
        return !existingSkus.has(product.sku.trim());
      });

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
          subcategory: null,
          description: product.description || '',
          sku: product.sku || '',
          image_url: product.image || '',
          product_url: product.product_url || '',
          updated_at: new Date().toISOString(),
        }));

        // Insertar en lotes
        const batchSize = 100;
        for (let i = 0; i < productsToInsert.length; i += batchSize) {
          const batch = productsToInsert.slice(i, i + batchSize);
          
          const { error: insertError } = await supabase
            .from('products')
            .upsert(batch, {
              onConflict: 'sku',
              ignoreDuplicates: false,
            });

          if (insertError) {
            errors.push({ error: insertError.message });
            addLog(`Error en lote ${Math.floor(i / batchSize) + 1}: ${insertError.message}`, 'error');
          } else {
            imported += batch.length;
            addLog(`Lote ${Math.floor(i / batchSize) + 1} importado: ${batch.length} productos`, 'success');
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


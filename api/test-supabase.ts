import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

/**
 * Endpoint de prueba para verificar la conexión a Supabase
 * Útil para debugging
 */
export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
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

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    const report = {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseKey,
      url: supabaseUrl ? `${supabaseUrl.substring(0, 20)}...` : 'missing',
      urlLength: supabaseUrl?.length || 0,
      keyLength: supabaseKey?.length || 0,
      keyPrefix: supabaseKey ? `${supabaseKey.substring(0, 20)}...` : 'missing',
    };

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        success: false,
        error: 'Supabase configuration missing',
        report,
        instructions: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables'
      });
      return;
    }

    // Intentar conectar a Supabase
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Intentar hacer una query simple
    const { data, error, count } = await supabase
      .from('products')
      .select('id', { count: 'exact' })
      .limit(1);

    if (error) {
      res.status(500).json({
        success: false,
        error: 'Supabase connection error',
        report,
        supabaseError: {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        },
        possibleSolutions: [
          'Verify that SUPABASE_URL and SUPABASE_ANON_KEY are correct',
          'Check that the products table exists in Supabase',
          'Run the supabase-schema.sql script in Supabase SQL Editor'
        ]
      });
      return;
    }

    res.status(200).json({
      success: true,
      report,
      connection: 'OK',
      tableExists: true,
      productCount: count || 0,
      message: 'Supabase is configured correctly!'
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Unexpected error',
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
  }
}


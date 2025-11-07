import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
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
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { conversationId, helpful } = req.body;

    if (!conversationId || typeof helpful !== 'boolean') {
      res.status(400).json({
        error: 'Missing or invalid parameters',
        details: 'conversationId (string) and helpful (boolean) are required'
      });
      return;
    }

    // Actualizar el feedback en la conversación
    const { data, error } = await supabase
      .from('chat_conversations')
      .update({ feedback_helpful: helpful })
      .eq('id', conversationId)
      .select()
      .single();

    if (error) {
      console.error('Error updating feedback:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
      return;
    }

    res.status(200).json({
      success: true,
      data
    });

  } catch (error) {
    console.error('Error in save-feedback:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}







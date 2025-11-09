import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    res.status(500).json({ 
      error: 'Supabase configuration missing',
      details: 'Please configure SUPABASE_URL and SUPABASE_ANON_KEY in Vercel environment variables'
    });
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // GET: Obtener todos los prompts o un prompt específico
    if (req.method === 'GET') {
      const { id, active_only } = req.query;

      if (id) {
        // Obtener un prompt específico con sus variables
        const { data: prompt, error: promptError } = await supabase
          .from('system_prompts')
          .select('*')
          .eq('id', id)
          .single();

        if (promptError) throw promptError;

        // Obtener variables del prompt
        const { data: variables, error: varsError } = await supabase
          .from('prompt_variables')
          .select('*')
          .eq('prompt_id', id)
          .order('variable_name');

        if (varsError) throw varsError;

        res.status(200).json({
          success: true,
          prompt: {
            ...prompt,
            variables: variables || []
          }
        });
      } else {
        // Obtener todos los prompts
        let query = supabase
          .from('system_prompts')
          .select('*')
          .order('created_at', { ascending: false });

        if (active_only === 'true') {
          query = query.eq('is_active', true);
        }

        const { data: prompts, error } = await query;

        if (error) throw error;

        // Para cada prompt, obtener sus variables
        const promptsWithVariables = await Promise.all(
          (prompts || []).map(async (prompt) => {
            const { data: variables } = await supabase
              .from('prompt_variables')
              .select('*')
              .eq('prompt_id', prompt.id)
              .order('variable_name');

            return {
              ...prompt,
              variables: variables || []
            };
          })
        );

        res.status(200).json({
          success: true,
          prompts: promptsWithVariables
        });
      }
      return;
    }

    // POST: Crear un nuevo prompt
    if (req.method === 'POST') {
      const { name, prompt, description, variables, is_active, structured_fields } = req.body;

      if (!name || !prompt) {
        res.status(400).json({
          error: 'Missing required fields',
          details: 'name and prompt are required'
        });
        return;
      }

      // Si se va a activar, desactivar todos los demás primero
      if (is_active) {
        await supabase
          .from('system_prompts')
          .update({ is_active: false })
          .neq('is_active', false);
      }

      // Crear el prompt
      const { data: newPrompt, error: promptError } = await supabase
        .from('system_prompts')
        .insert({
          name,
          prompt,
          description: description || null,
          is_active: is_active || false,
          structured_fields: structured_fields || null
        })
        .select()
        .single();

      if (promptError) throw promptError;

      // Crear variables si se proporcionan
      if (variables && Array.isArray(variables) && variables.length > 0) {
        const variablesToInsert = variables.map((v: any) => ({
          prompt_id: newPrompt.id,
          variable_name: v.variable_name,
          variable_value: v.variable_value || null,
          variable_type: v.variable_type || 'text',
          description: v.description || null
        }));

        const { error: varsError } = await supabase
          .from('prompt_variables')
          .insert(variablesToInsert);

        if (varsError) throw varsError;
      }

      // Obtener el prompt completo con variables
      const { data: variablesData } = await supabase
        .from('prompt_variables')
        .select('*')
        .eq('prompt_id', newPrompt.id)
        .order('variable_name');

      res.status(201).json({
        success: true,
        prompt: {
          ...newPrompt,
          variables: variablesData || []
        }
      });
      return;
    }

    // PUT: Actualizar un prompt
    if (req.method === 'PUT') {
      const { id, name, prompt, description, variables, is_active, structured_fields } = req.body;

      if (!id) {
        res.status(400).json({
          error: 'Missing required field',
          details: 'id is required'
        });
        return;
      }

      // Si se va a activar, desactivar todos los demás primero
      if (is_active) {
        await supabase
          .from('system_prompts')
          .update({ is_active: false })
          .neq('id', id);
      }

      // Actualizar el prompt
      const updateData: any = {};
      if (name !== undefined) updateData.name = name;
      if (prompt !== undefined) updateData.prompt = prompt;
      if (description !== undefined) updateData.description = description;
      if (is_active !== undefined) updateData.is_active = is_active;
      if (structured_fields !== undefined) updateData.structured_fields = structured_fields;

      const { data: updatedPrompt, error: promptError } = await supabase
        .from('system_prompts')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (promptError) throw promptError;

      // Actualizar variables si se proporcionan
      if (variables && Array.isArray(variables)) {
        // Eliminar variables existentes
        await supabase
          .from('prompt_variables')
          .delete()
          .eq('prompt_id', id);

        // Insertar nuevas variables
        if (variables.length > 0) {
          const variablesToInsert = variables.map((v: any) => ({
            prompt_id: id,
            variable_name: v.variable_name,
            variable_value: v.variable_value || null,
            variable_type: v.variable_type || 'text',
            description: v.description || null
          }));

          const { error: varsError } = await supabase
            .from('prompt_variables')
            .insert(variablesToInsert);

          if (varsError) throw varsError;
        }
      }

      // Obtener el prompt completo con variables
      const { data: variablesData } = await supabase
        .from('prompt_variables')
        .select('*')
        .eq('prompt_id', id)
        .order('variable_name');

      res.status(200).json({
        success: true,
        prompt: {
          ...updatedPrompt,
          variables: variablesData || []
        }
      });
      return;
    }

    // DELETE: Eliminar un prompt
    if (req.method === 'DELETE') {
      const { id } = req.query;

      if (!id) {
        res.status(400).json({
          error: 'Missing required field',
          details: 'id is required'
        });
        return;
      }

      // Las variables se eliminan automáticamente por CASCADE
      const { error } = await supabase
        .from('system_prompts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      res.status(200).json({
        success: true,
        message: 'Prompt deleted successfully'
      });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Prompts API error:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}


import type {
  SystemPrompt,
  PromptVariable,
  PromptStructuredFields
} from '../types';

const API_BASE = '/api';

export interface PromptsResponse {
  success: boolean;
  prompts?: SystemPrompt[];
  prompt?: SystemPrompt;
  message?: string;
}

/**
 * Obtener todos los prompts
 */
export async function getPrompts(activeOnly: boolean = false): Promise<SystemPrompt[]> {
  try {
    const response = await fetch(`${API_BASE}/prompts?active_only=${activeOnly}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching prompts: ${response.statusText}`);
    }

    const data: PromptsResponse = await response.json();
    
    if (data.success && data.prompts) {
      return data.prompts;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error getting prompts:', error);
    throw error;
  }
}

/**
 * Obtener un prompt específico por ID
 */
export async function getPromptById(id: string): Promise<SystemPrompt> {
  try {
    const response = await fetch(`${API_BASE}/prompts?id=${id}`);
    
    if (!response.ok) {
      throw new Error(`Error fetching prompt: ${response.statusText}`);
    }

    const data: PromptsResponse = await response.json();
    
    if (data.success && data.prompt) {
      return data.prompt;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error getting prompt:', error);
    throw error;
  }
}

/**
 * Obtener el prompt activo
 */
export async function getActivePrompt(): Promise<SystemPrompt | null> {
  try {
    const prompts = await getPrompts(true);
    return prompts.length > 0 ? prompts[0] : null;
  } catch (error) {
    console.error('Error getting active prompt:', error);
    return null;
  }
}

/**
 * Crear un nuevo prompt
 */
export async function createPrompt(
  name: string,
  prompt: string,
  description?: string,
  variables?: PromptVariable[],
  isActive: boolean = false,
  structuredFields?: PromptStructuredFields
): Promise<SystemPrompt> {
  try {
    const response = await fetch(`${API_BASE}/prompts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        prompt,
        description,
        variables: variables || [],
        is_active: isActive,
        structured_fields: structuredFields || null,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error creating prompt: ${response.statusText}`);
    }

    const data: PromptsResponse = await response.json();
    
    if (data.success && data.prompt) {
      return data.prompt;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error creating prompt:', error);
    throw error;
  }
}

/**
 * Actualizar un prompt existente
 */
export async function updatePrompt(
  id: string,
  updates: {
    name?: string;
    prompt?: string;
    description?: string;
    variables?: PromptVariable[];
    is_active?: boolean;
    structured_fields?: PromptStructuredFields | null;
  }
): Promise<SystemPrompt> {
  try {
    const response = await fetch(`${API_BASE}/prompts`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id,
        ...updates,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error updating prompt: ${response.statusText}`);
    }

    const data: PromptsResponse = await response.json();
    
    if (data.success && data.prompt) {
      return data.prompt;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error updating prompt:', error);
    throw error;
  }
}

/**
 * Activar un prompt (desactiva todos los demás)
 */
export async function activatePrompt(id: string): Promise<SystemPrompt> {
  return updatePrompt(id, { is_active: true });
}

/**
 * Eliminar un prompt
 */
export async function deletePrompt(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/prompts?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error deleting prompt: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting prompt:', error);
    throw error;
  }
}

/**
 * Procesar un prompt reemplazando variables
 */
export function processPrompt(prompt: SystemPrompt): string {
  let processedPrompt = prompt.prompt;
  
  if (prompt.variables && prompt.variables.length > 0) {
    prompt.variables.forEach((variable) => {
      const regex = new RegExp(`\\{\\{${variable.variable_name}\\}\\}`, 'g');
      processedPrompt = processedPrompt.replace(regex, variable.variable_value || '');
    });
  }
  
  return processedPrompt;
}

export interface GeneratePromptPayload extends PromptStructuredFields {}

export async function generateSystemPrompt(
  fields: GeneratePromptPayload
): Promise<string> {
  try {
    const response = await fetch(`${API_BASE}/generate-system-prompt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(fields)
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'No se pudo generar el prompt con IA');
    }

    const data = await response.json();

    if (data?.success && typeof data.prompt === 'string') {
      return data.prompt;
    }

    throw new Error('Respuesta inválida del generador de prompt');
  } catch (error) {
    console.error('Error generating system prompt:', error);
    throw error;
  }
}

/**
 * Extraer variables del texto del prompt
 */
export function extractVariablesFromPrompt(promptText: string): string[] {
  const regex = /\{\{(\w+)\}\}/g;
  const variables: string[] = [];
  let match;
  
  while ((match = regex.exec(promptText)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  
  return variables;
}


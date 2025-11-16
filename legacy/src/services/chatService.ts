import type { ChatMessage, ChatConfig, ChatResponse } from '../types';

const API_BASE = '/api';

/**
 * Enviar mensaje al chat
 */
export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[] = [],
  config: ChatConfig,
  sessionId?: string
): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        config,
        sessionId
      }),
    });

    // Verificar el tipo de contenido antes de parsear
    const contentType = response.headers.get('content-type');
    const isJson = contentType && contentType.includes('application/json');

    if (!response.ok) {
      let errorMessage = `Error: ${response.statusText}`;
      
      if (isJson) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // Si falla el parseo JSON, usar el texto de la respuesta
          const text = await response.text();
          errorMessage = text || errorMessage;
        }
      } else {
        // Si no es JSON, leer como texto
        const text = await response.text();
        errorMessage = text || errorMessage;
      }
      
      throw new Error(errorMessage);
    }

    // Asegurar que la respuesta es JSON antes de parsear
    if (!isJson) {
      const text = await response.text();
      throw new Error(`Expected JSON but got: ${contentType}. Response: ${text.substring(0, 200)}`);
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    // Si es un error de red o timeout, proporcionar un mensaje más claro
    if (error instanceof TypeError && error.message.includes('fetch')) {
      throw new Error('Error de conexión. Por favor, verifica tu conexión a internet.');
    }
    throw error;
  }
}

/**
 * Configuración por defecto de OpenAI
 * Usando gpt-3.5-turbo para mejor velocidad y costo
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  model: 'gpt-3.5-turbo',
  temperature: 0.7,
  max_tokens: 800, // Reducido significativamente para respuestas más rápidas
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0
};

/**
 * Modelos disponibles de OpenAI
 */
export const AVAILABLE_MODELS = [
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];


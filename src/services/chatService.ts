import type { ChatMessage, ChatConfig, ChatResponse } from '../types';

const API_BASE = '/api';

// Flag para usar RAG - ACTIVADO por defecto para usar el nuevo sistema RAG
// Cambia a false si quieres volver al sistema anterior de búsqueda exacta
// Para desactivar RAG, crea variable de entorno: VITE_USE_RAG_CHAT=false
const USE_RAG_CHAT = import.meta.env.VITE_USE_RAG_CHAT !== 'false'; // Por defecto true (usa RAG)

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
    // Usar endpoint RAG si está habilitado, sino usar el endpoint tradicional
    const endpoint = USE_RAG_CHAT ? `${API_BASE}/chat-rag` : `${API_BASE}/chat`;
    
    const response = await fetch(endpoint, {
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
 * Actualizado a GPT-4o para mejor calidad y razonamiento
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  model: 'gpt-4o',
  temperature: 0.2, // Reducido para respuestas más precisas y menos creativas
  max_tokens: 1000, // Aumentado para permitir respuestas más completas con citas
  top_p: 1.0,
  frequency_penalty: 0.0,
  presence_penalty: 0.0
};

/**
 * Modelos disponibles de OpenAI
 */
export const AVAILABLE_MODELS = [
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4', label: 'GPT-4' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];


import type { ChatMessage, ChatConfig, ChatResponse } from '../types';

const API_BASE = '/api';

/**
 * Enviar mensaje al chat
 */
export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[] = [],
  config: ChatConfig
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
        config
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error: ${response.statusText}`);
    }

    const data: ChatResponse = await response.json();
    return data;
  } catch (error) {
    console.error('Error sending chat message:', error);
    throw error;
  }
}

/**
 * Configuración por defecto de OpenAI
 */
export const DEFAULT_CHAT_CONFIG: ChatConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  max_tokens: 2000,
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


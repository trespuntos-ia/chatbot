import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import type { ChatMessage } from '../types';

const STORAGE_KEY = 'chatbot_conversation';

// Función para cargar mensajes desde localStorage
function loadMessagesFromStorage(): ChatMessage[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed)) {
        // Validar y limpiar mensajes antes de retornarlos
        // Asegurarse de que solo contengan campos válidos
        return parsed.filter((msg: any) => {
          // Validar que tenga al menos role y content
          if (!msg || typeof msg !== 'object') return false;
          if (msg.role !== 'user' && msg.role !== 'assistant' && msg.role !== 'system') return false;
          if (typeof msg.content !== 'string') return false;
          
          // Filtrar mensajes de error automáticos del sistema
          const isErrorMsg = msg.role === 'assistant' && 
                           msg.content && 
                           msg.content.includes('Lo siento, hubo un error');
          return !isErrorMsg;
        }).map((msg: any) => {
          // Limpiar el mensaje, solo mantener campos válidos
          const cleaned: ChatMessage = {
            role: msg.role,
            content: msg.content
          };
          // Solo agregar campos opcionales si existen y son válidos
          if (msg.sources && Array.isArray(msg.sources)) {
            cleaned.sources = msg.sources;
          }
          if (msg.products && Array.isArray(msg.products)) {
            cleaned.products = msg.products;
          }
          if (msg.function_calls) {
            cleaned.function_calls = msg.function_calls;
          }
          return cleaned;
        });
      }
    }
  } catch (error) {
    console.error('Error loading messages from localStorage:', error);
    // Si hay error, limpiar el localStorage para evitar problemas futuros
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (e) {
      // Ignorar errores al limpiar
    }
  }
  return [];
}

// Función para guardar mensajes en localStorage
function saveMessagesToStorage(messages: ChatMessage[]): void {
  try {
    // Filtrar mensajes del sistema y mensajes de error temporales
    const messagesToSave = messages
      .filter(m => m.role !== 'system')
      .filter(m => {
        // No guardar mensajes de error automáticos del sistema
        const isErrorMsg = m.role === 'assistant' && 
                          m.content && 
                          m.content.includes('Lo siento, hubo un error');
        return !isErrorMsg;
      });
    
    // Solo guardar si hay mensajes válidos (no solo errores)
    if (messagesToSave.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave));
    }
  } catch (error) {
    console.error('Error saving messages to localStorage:', error);
  }
}

interface ChatContextType {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  clearMessages: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: ReactNode }) {
  // Cargar mensajes desde localStorage al inicializar
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadMessagesFromStorage());

  // Guardar mensajes en localStorage cada vez que cambien
  useEffect(() => {
    if (messages.length > 0) {
      saveMessagesToStorage(messages);
    } else {
      // Si se limpia, también limpiar localStorage
      localStorage.removeItem(STORAGE_KEY);
    }
  }, [messages]);

  // Función para limpiar mensajes
  const clearMessages = () => {
    setMessages([]);
    localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <ChatContext.Provider value={{ messages, setMessages, clearMessages }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}


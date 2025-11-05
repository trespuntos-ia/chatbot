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
        return parsed;
      }
    }
  } catch (error) {
    console.error('Error loading messages from localStorage:', error);
  }
  return [];
}

// Función para guardar mensajes en localStorage
function saveMessagesToStorage(messages: ChatMessage[]): void {
  try {
    const messagesToSave = messages.filter(m => m.role !== 'system');
    localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToSave));
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


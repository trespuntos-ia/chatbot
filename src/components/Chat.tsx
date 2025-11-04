import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService';
import { ProductCard } from './ProductCard';
import { parseMessageContent, splitMessageWithProducts, findRecommendedProduct } from '../utils/messageParser';
import { formatSources } from '../utils/sourceLabels';
import type { ChatMessage, ChatConfig, Product } from '../types';

interface ChatProps {
  config: ChatConfig;
}

export function Chat({ config }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll automático al final
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputMessage.trim()
    };

    // Añadir mensaje del usuario
    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setError('');
    setLoadingStage('Analizando tu pregunta...');

    try {
      // Preparar historial de conversación (sin system messages)
      const conversationHistory = messages.filter(m => m.role !== 'system');

      // Enviar mensaje
      setLoadingStage('Consultando con OpenAI...');
      const response = await sendChatMessage(
        inputMessage.trim(),
        conversationHistory,
        config
      );

      if (response.function_called) {
        setLoadingStage('Consultando base de datos...');
        // Pequeña pausa para mostrar el cambio de estado
        await new Promise(resolve => setTimeout(resolve, 100));
        setLoadingStage('Generando respuesta...');
      }

      if (response.success && response.conversation_history) {
        // Extraer productos de la respuesta si existen
        const lastMessage = response.conversation_history[response.conversation_history.length - 1];
        let products: Product[] = [];

        // Si hay function_result con productos
        if (response.function_result) {
          if (response.function_result.products && Array.isArray(response.function_result.products)) {
            products = response.function_result.products;
          } else if (response.function_result.product && response.function_result.found) {
            // Producto único por SKU
            products = [response.function_result.product];
          }
        }

        // Si hay productos y el mensaje recomienda uno específico, filtrar
        if (lastMessage && products.length > 0) {
          if (lastMessage.content) {
            const recommendedProduct = findRecommendedProduct(lastMessage.content, products);
            if (recommendedProduct && products.length > 1) {
              // Solo mostrar el producto recomendado si hay múltiples productos
              products = [recommendedProduct];
            }
          }
          lastMessage.products = products;
        }

        // Actualizar mensajes con el historial completo
        setMessages(response.conversation_history);
      } else {
        throw new Error(response.error || 'Error al obtener respuesta');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
      // Añadir mensaje de error
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Lo siento, hubo un error: ${err instanceof Error ? err.message : 'Error desconocido'}`
      }]);
    } finally {
      setIsLoading(false);
      setLoadingStage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleClearChat = () => {
    if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
      setMessages([]);
      setError('');
    }
  };

  return (
    <div className="flex flex-col h-full max-h-[800px]">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Chat con IA</h2>
          <p className="text-sm text-slate-600">
            Haz preguntas sobre productos y obtén respuestas inteligentes
          </p>
        </div>
        {messages.length > 0 && (
          <button
            onClick={handleClearChat}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition"
          >
            Limpiar Chat
          </button>
        )}
      </div>

      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
        {messages.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 mx-auto mb-4 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <p>Comienza una conversación escribiendo un mensaje</p>
          </div>
        ) : (
          messages.map((message, index) => {
            if (message.role === 'assistant' && message.products && message.products.length > 0) {
              // Dividir mensaje en partes (texto y productos)
              const parts = splitMessageWithProducts(message.content, message.products);
              
              return (
                <div key={index} className="space-y-4">
                  {parts.map((part, partIndex) => {
                    if (part.type === 'text') {
                      // Parsear el texto con formato markdown
                      const { html } = parseMessageContent(part.content as string, message.products);
                      
                      return (
                        <div key={partIndex} className="flex justify-start">
                          <div className="max-w-[90%] rounded-lg px-4 py-3 bg-slate-100 text-slate-900">
                            <div 
                              className="prose prose-sm max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-a:text-indigo-600"
                              dangerouslySetInnerHTML={{ __html: html }}
                            />
                            {partIndex === 0 && message.function_calls && (
                              <div className="mt-2 text-xs opacity-75">
                                🔍 Consultó la base de datos
                              </div>
                            )}
                            {/* Fuentes de información */}
                            {partIndex === 0 && message.sources && message.sources.length > 0 && (
                              <div className="mt-3 pt-3 border-t border-slate-200">
                                <p className="text-xs text-slate-500">
                                  Fuente: {formatSources(message.sources)}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    } else {
                      // Mostrar tarjeta de producto
                      return (
                        <div key={partIndex} className="flex justify-start">
                          <div className="w-full max-w-[400px]">
                            <ProductCard product={part.content as Product} />
                          </div>
                        </div>
                      );
                    }
                  })}
                </div>
              );
            }

            // Mensaje normal (usuario o asistente sin productos)
            return (
              <div key={index}>
                <div
                  className={`flex ${
                    message.role === 'user' ? 'justify-end' : 'justify-start'
                  } mb-2`}
                >
                  <div
                    className={`max-w-[80%] rounded-lg px-4 py-3 ${
                      message.role === 'user'
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-900'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    {message.function_calls && (
                      <div className="mt-2 text-xs opacity-75">
                        🔍 Consultó la base de datos
                      </div>
                    )}
                    {/* Fuentes de información */}
                    {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Fuente: {formatSources(message.sources)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4 text-slate-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-sm text-slate-600">
                  {loadingStage || 'Pensando...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-red-800 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-200 pt-4">
        <div className="flex gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            rows={3}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <svg
                  className="animate-spin h-5 w-5"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Enviando...
              </>
            ) : (
              <>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                  />
                </svg>
                Enviar
              </>
            )}
          </button>
        </div>
        <p className="text-xs text-slate-500 mt-2">
          Presiona Enter para enviar, Shift+Enter para nueva línea
        </p>
      </div>
    </div>
  );
}


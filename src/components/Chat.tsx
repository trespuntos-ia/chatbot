import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService';
import { ProductCard } from './ProductCard';
import { parseMessageContent, splitMessageWithProducts, findRecommendedProduct } from '../utils/messageParser';
import { getSourcesDescription } from '../utils/sourceLabels';
import { useChat } from '../contexts/ChatContext';
import type { ChatConfig, ChatMessage, Product } from '../types';

interface ChatProps {
  config: ChatConfig;
}

export function Chat({ config }: ChatProps) {
  const { messages, setMessages } = useChat();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Generar o recuperar session_id desde localStorage
  useEffect(() => {
    let storedSessionId = localStorage.getItem('chat_session_id');
    if (!storedSessionId) {
      storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('chat_session_id', storedSessionId);
    }
    setSessionId(storedSessionId);
  }, []);

  // Scroll automático al final - solo si no hay productos en el último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    // Solo hacer scroll automático si el último mensaje no tiene productos
    // Si hay productos, el usuario debe poder ver desde arriba y bajar manualmente
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.products && lastMessage.products.length > 0) {
      // No hacer scroll si hay productos, dejar que el usuario vea desde arriba
      return;
    }
    // Hacer scroll solo para mensajes normales sin productos
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
        config,
        sessionId
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

        // Añadir conversation_id al último mensaje del asistente
        if (lastMessage && response.conversation_id) {
          lastMessage.conversation_id = response.conversation_id;
          lastMessage.feedback_submitted = false;
        }

        // Actualizar mensajes con el historial completo
        setMessages(response.conversation_history);
      } else {
        throw new Error(response.error || 'Error al obtener respuesta');
      }
    } catch (err) {
      const errorMessage = err instanceof Error 
        ? err.message 
        : typeof err === 'string' 
        ? err 
        : 'Error desconocido al comunicarse con el servidor';
      
      setError(errorMessage);
      
      // Añadir mensaje de error al chat solo si no hay un error previo similar
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Lo siento, hubo un error: ${errorMessage}. Por favor, intenta de nuevo o contacta con soporte si el problema persiste.`
      };
      
      setMessages(prev => {
        // Evitar duplicar mensajes de error consecutivos
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.role === 'assistant' && lastMessage.content.includes('Lo siento, hubo un error')) {
          return prev;
        }
        return [...prev, errorMsg];
      });
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

  const handleFeedback = async (conversationId: string, helpful: boolean, messageIndex: number) => {
    if (!conversationId) return;

    try {
      const response = await fetch('/api/save-feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          conversationId,
          helpful
        }),
      });

      const result = await response.json();

      if (result.success) {
        // Marcar el feedback como enviado en el mensaje
        setMessages(prev => {
          const updated = [...prev];
          if (updated[messageIndex]) {
            updated[messageIndex] = {
              ...updated[messageIndex],
              feedback_submitted: true
            };
          }
          return updated;
        });
      } else {
        console.error('Error guardando feedback:', result.error);
      }
    } catch (error) {
      console.error('Error enviando feedback:', error);
    }
  };



  return (
    <div className="flex flex-col h-full">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-5 sm:space-y-3 mb-4 px-5 sm:px-4 py-5 sm:py-4">
        {/* Mensajes de bienvenida cuando no hay conversación */}
        {messages.length === 0 && (
          <div className="space-y-5 sm:space-y-3">
            <div className="flex justify-start">
              <div className="max-w-[95%] sm:max-w-[85%] rounded-2xl px-6 py-5 sm:px-4 sm:py-3 bg-slate-100 text-slate-700">
                <div className="whitespace-pre-wrap text-lg sm:text-sm">
                  👋 ¡Bienvenido a 100%Chef!
                </div>
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[95%] sm:max-w-[85%] rounded-2xl px-6 py-5 sm:px-4 sm:py-3 bg-slate-100 text-slate-700">
                <div className="whitespace-pre-wrap text-lg sm:text-sm leading-relaxed">
                  Si mezclas curiosidad con técnica, estás en el lugar correcto. Cuéntame tu receta… yo pongo la tecnología. ¿En qué puedo ayudarte hoy?
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Mensajes de la conversación */}
        {messages.map((message, index) => {
          if (message.role === 'assistant' && message.products && message.products.length > 0) {
            // Dividir mensaje en partes (texto y productos)
            const parts = splitMessageWithProducts(message.content, message.products);
            
            // Separar texto y productos
            const textParts = parts.filter(p => p.type === 'text');
            const productParts = parts.filter(p => p.type === 'product');
            
            return (
              <div key={index} className="space-y-4">
                {/* Mostrar texto introductorio (ya filtrado por splitMessageWithProducts) */}
                {textParts.map((part, partIndex) => {
                  const textContent = part.content as string;
                  
                  // Solo mostrar si hay contenido significativo (más de 10 caracteres)
                  if (!textContent || textContent.trim().length < 10) {
                    return null;
                  }
                  
                  // Parsear el texto con formato markdown (sin imágenes si hay productos)
                  const { html } = parseMessageContent(textContent, message.products);
                  
                  return (
                    <div key={`text-${partIndex}`} className="flex justify-start">
                      <div className="max-w-[95%] sm:max-w-[90%] rounded-2xl px-6 py-5 sm:px-4 sm:py-3 bg-slate-100 text-slate-700">
                        <div 
                          className="prose prose-lg sm:prose-sm max-w-none prose-headings:text-slate-700 prose-p:text-slate-700 prose-a:text-blue-600 prose-p:text-lg sm:prose-p:text-sm prose-headings:text-xl sm:prose-headings:text-base"
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                        {partIndex === 0 && message.function_calls && (
                          <div className="mt-3 text-base sm:text-xs opacity-75">
                            🔍 Consultó la base de datos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Todas las tarjetas de productos - ancho completo */}
                {productParts.length > 0 && (
                  <div className="w-full -mx-4 px-4 space-y-4 sm:space-y-3">
                    {productParts.map((part, productIndex) => (
                      <ProductCard key={`product-${productIndex}`} product={part.content as Product} />
                    ))}
                  </div>
                )}
                
                {/* Mostrar fuentes al final */}
                {message.sources && message.sources.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[95%] text-base sm:text-xs text-slate-500">
                      {getSourcesDescription(message.sources)}
                    </div>
                  </div>
                )}
                
                {/* Pregunta de satisfacción */}
                {message.conversation_id && !message.feedback_submitted && (
                  <div className="flex justify-start mt-5 sm:mt-3">
                    <div className="max-w-[95%] rounded-2xl px-6 py-5 sm:px-4 sm:py-3 bg-slate-50 border border-slate-200">
                      <p className="text-base sm:text-xs text-slate-600 mb-4 sm:mb-2 font-medium">¿Te ha ayudado la respuesta?</p>
                      <div className="flex gap-4 sm:gap-2">
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, true, index)}
                          className="px-6 py-3 sm:px-4 sm:py-2 text-lg sm:text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, false, index)}
                          className="px-6 py-3 sm:px-4 sm:py-2 text-lg sm:text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Confirmación de feedback enviado */}
                {message.feedback_submitted && (
                  <div className="flex justify-start mt-3">
                    <div className="max-w-[95%] text-base sm:text-xs text-slate-500">
                      ✓ Gracias por tu feedback
                    </div>
                  </div>
                )}
              </div>
            );
          }

          // Mensaje normal (usuario o asistente sin productos)
          return (
            <div key={index}>
              <div
                className={`flex ${
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                }`}
              >
                <div
                  className={`max-w-[95%] sm:max-w-[85%] rounded-2xl px-6 py-5 sm:px-4 sm:py-3 ${
                    message.role === 'user'
                      ? 'bg-blue-600 text-white'
                      : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-lg sm:text-sm leading-relaxed">{message.content}</div>
                  {message.function_calls && (
                    <div className="mt-3 text-base sm:text-xs opacity-75">
                      🔍 Consultó la base de datos
                    </div>
                  )}
                  {/* Fuentes de información */}
                  {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-base sm:text-xs text-slate-500">
                        {getSourcesDescription(message.sources)}
                      </p>
                    </div>
                  )}
                  {/* Pregunta de satisfacción */}
                  {message.role === 'assistant' && message.conversation_id && !message.feedback_submitted && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-base sm:text-xs text-slate-600 mb-4 sm:mb-2 font-medium">¿Te ha ayudado la respuesta?</p>
                      <div className="flex gap-4 sm:gap-2">
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, true, index)}
                          className="px-6 py-3 sm:px-3 sm:py-1.5 text-base sm:text-xs font-medium bg-green-100 text-green-700 rounded-lg hover:bg-green-200 transition-colors"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, false, index)}
                          className="px-6 py-3 sm:px-3 sm:py-1.5 text-base sm:text-xs font-medium bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Confirmación de feedback enviado */}
                  {message.role === 'assistant' && message.feedback_submitted && (
                    <div className="mt-4 pt-4 border-t border-slate-200">
                      <p className="text-base sm:text-xs text-slate-500">✓ Gracias por tu feedback</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}


        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-slate-100 rounded-2xl px-6 py-5 sm:px-4 sm:py-3">
              <div className="flex items-center gap-4 sm:gap-2">
                <svg
                  className="animate-spin h-6 w-6 sm:h-4 sm:w-4 text-slate-600"
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
                <span className="text-lg sm:text-sm text-slate-600">
                  {loadingStage || 'Consultando...'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 mx-5 sm:mx-4 bg-red-50 border border-red-200 rounded-xl p-5 sm:p-3 text-red-800 text-lg sm:text-sm">
          <div className="flex items-center gap-4 sm:gap-2">
            <svg className="h-7 w-7 sm:h-5 sm:w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-red-600 hover:text-red-800 p-1"
              aria-label="Cerrar error"
            >
              <svg className="h-6 w-6 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-slate-100 pt-5 sm:pt-3 px-5 sm:px-4 pb-4 sm:pb-2">
        <div className="flex gap-4 sm:gap-2">
          <textarea
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Escribe tu pregunta..."
            disabled={isLoading}
            rows={2}
            className="flex-1 px-6 py-4 sm:px-4 sm:py-2.5 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed text-lg sm:text-sm"
          />
          <button
            onClick={handleSendMessage}
            disabled={isLoading || !inputMessage.trim()}
            className="px-6 py-4 sm:px-4 sm:py-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 min-w-[60px] sm:min-w-0"
          >
            {isLoading ? (
              <svg
                className="animate-spin h-7 w-7 sm:h-5 sm:w-5"
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
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-7 w-7 sm:h-5 sm:w-5"
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
            )}
          </button>
        </div>
      </div>
    </div>
  );
}


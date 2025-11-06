import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/chatService';
import { ProductCard } from './ProductCard';
import { parseMessageContent, splitMessageWithProducts, findRecommendedProduct } from '../utils/messageParser';
import { getSourcesDescription } from '../utils/sourceLabels';
import { useChat } from '../contexts/ChatContext';
import { getSuggestedQueries } from '../services/suggestedQueriesService';
import type { ChatConfig, ChatMessage, Product } from '../types';

interface ChatProps {
  config: ChatConfig;
  isExpanded?: boolean;
  onFirstMessage?: () => void;
}

export function Chat({ config, isExpanded = false, onFirstMessage }: ChatProps) {
  const { messages, setMessages } = useChat();
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [suggestedQueries, setSuggestedQueries] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement | HTMLInputElement>(null);
  const hasSentFirstMessage = useRef(false);

  // Determinar si estamos en estado inicial (sin mensajes)
  const isInitialState = messages.length === 0;

  // Cargar sugerencias al montar
  useEffect(() => {
    loadSuggestedQueries();
  }, []);

  const loadSuggestedQueries = async () => {
    try {
      const queries = await getSuggestedQueries();
      setSuggestedQueries(queries.map(q => q.query_text));
    } catch (error) {
      console.error('Error loading suggested queries:', error);
      // Si falla, usar sugerencias por defecto
      setSuggestedQueries([
        "Busco un ahumador portátil para showcooking en sala",
        "¿Tenéis herramientas para trabajar con nitrógeno líquido?",
        "Necesito una máquina para destilaciones en frío",
        "¿Tenéis copas o vasos que funcionen con hielo seco?",
        "Producto para infusionar aceites en frío"
      ]);
    }
  };

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
    const lastMessage = messages[messages.length - 1];
    if (lastMessage && lastMessage.role === 'assistant' && lastMessage.products && lastMessage.products.length > 0) {
      return;
    }
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    // Notificar primer mensaje
    if (!hasSentFirstMessage.current) {
      hasSentFirstMessage.current = true;
      onFirstMessage?.();
    }

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
            products = [response.function_result.product];
          }
        }

        // Si hay productos y el mensaje recomienda uno específico, filtrar
        if (lastMessage && products.length > 0) {
          if (lastMessage.content) {
            const recommendedProduct = findRecommendedProduct(lastMessage.content, products);
            if (recommendedProduct && products.length > 1) {
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
      
      const errorMsg: ChatMessage = {
        role: 'assistant',
        content: `Lo siento, hubo un error: ${errorMessage}. Por favor, intenta de nuevo o contacta con soporte si el problema persiste.`
      };
      
      setMessages(prev => {
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

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSuggestionClick = (suggestion: string) => {
    setInputMessage(suggestion);
    inputRef.current?.focus();
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
    <div className="flex flex-col h-full bg-[#202020]">
      {/* Mensajes */}
      <div className="flex-1 overflow-y-auto space-y-4 px-6 py-6">
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
                {/* Mostrar texto introductorio */}
                {textParts.map((part, partIndex) => {
                  const textContent = part.content as string;
                  
                  if (!textContent || textContent.trim().length < 10) {
                    return null;
                  }
                  
                  const { html } = parseMessageContent(textContent, message.products);
                  
                  return (
                    <div key={`text-${partIndex}`} className="flex justify-start">
                      <div className="max-w-[85%] rounded-2xl px-6 py-4 bg-[#2a2a2a] border border-gray-700/50 text-gray-300">
                        <div 
                          className="prose prose-sm max-w-none prose-headings:text-gray-300 prose-p:text-gray-300 prose-a:text-cyan-400 prose-p:text-sm prose-headings:text-base whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{ __html: html }}
                        />
                        {partIndex === 0 && message.function_calls && (
                          <div className="mt-3 text-xs text-gray-500">
                            🔍 Consultó la base de datos
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                
                {/* Tarjetas de productos */}
                {productParts.length > 0 && (
                  <div className={`w-full ${isExpanded ? 'grid grid-cols-2 gap-4' : 'space-y-4'}`}>
                    {productParts.map((part, productIndex) => (
                      <ProductCard key={`product-${productIndex}`} product={part.content as Product} />
                    ))}
                  </div>
                )}
                
                {/* Fuentes */}
                {message.sources && message.sources.length > 0 && (
                  <div className="flex justify-start">
                    <div className="max-w-[85%] text-xs text-gray-500">
                      {getSourcesDescription(message.sources)}
                    </div>
                  </div>
                )}
                
                {/* Pregunta de satisfacción */}
                {message.conversation_id && !message.feedback_submitted && (
                  <div className="flex justify-start mt-4">
                    <div className="max-w-[85%] rounded-2xl px-6 py-4 bg-[#2a2a2a] border border-gray-700/50">
                      <p className="text-sm text-gray-300 mb-3 font-medium">¿Te ha ayudado la respuesta?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, true, index)}
                          className="px-4 py-2 text-sm font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, false, index)}
                          className="px-4 py-2 text-sm font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Confirmación de feedback */}
                {message.feedback_submitted && (
                  <div className="flex justify-start mt-3">
                    <div className="max-w-[85%] text-xs text-gray-500">
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
                  className={`max-w-[85%] rounded-2xl px-6 py-4 ${
                    message.role === 'user'
                      ? 'bg-cyan-500 text-black'
                      : 'bg-[#2a2a2a] border border-gray-700/50 text-gray-300'
                  }`}
                >
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</div>
                  {message.function_calls && (
                    <div className="mt-3 text-xs text-gray-500">
                      🔍 Consultó la base de datos
                    </div>
                  )}
                  {/* Fuentes de información */}
                  {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <p className="text-xs text-gray-500">
                        {getSourcesDescription(message.sources)}
                      </p>
                    </div>
                  )}
                  {/* Pregunta de satisfacción */}
                  {message.role === 'assistant' && message.conversation_id && !message.feedback_submitted && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <p className="text-xs text-gray-300 mb-3 font-medium">¿Te ha ayudado la respuesta?</p>
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, true, index)}
                          className="px-4 py-2 text-xs font-medium bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                        >
                          Sí
                        </button>
                        <button
                          onClick={() => handleFeedback(message.conversation_id!, false, index)}
                          className="px-4 py-2 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                        >
                          No
                        </button>
                      </div>
                    </div>
                  )}
                  {/* Confirmación de feedback */}
                  {message.role === 'assistant' && message.feedback_submitted && (
                    <div className="mt-4 pt-4 border-t border-gray-700/50">
                      <p className="text-xs text-gray-500">✓ Gracias por tu feedback</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Indicador de escritura - tres puntos animados */}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-[#2a2a2a] border border-gray-700/50 rounded-2xl px-6 py-4">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div 
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <div 
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <div 
                    className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
                {loadingStage && (
                  <span className="text-sm text-gray-400 ml-2">{loadingStage}</span>
                )}
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Error */}
      {error && (
        <div className="mx-6 mb-4 bg-red-900/30 border border-red-700/50 rounded-xl p-4 text-red-300 text-sm">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span className="flex-1">{error}</span>
            <button
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-300 p-1"
              aria-label="Cerrar error"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Input - Estado inicial vs conversacional */}
      {isInitialState ? (
        // Estado inicial: textarea grande con sugerencias debajo
        <div className="border-t border-gray-700/50 pt-6 px-6 pb-6">
          <div className="relative">
            <textarea
              ref={inputRef as React.RefObject<HTMLTextAreaElement>}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Pregunta cualquier cosa..."
              disabled={isLoading}
              rows={4}
              className="w-full min-h-[100px] px-6 py-4 bg-[#2a2a2a] border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 resize-none disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder-gray-500"
            />

            {/* Botones en fila inferior dentro del textarea */}
            <div className="absolute bottom-3 right-3 flex items-center gap-2">
              <button
                className="p-2 text-gray-400 hover:text-white hover:bg-[#202020] rounded-lg transition"
                aria-label="Micrófono"
                title="Micrófono (próximamente)"
              >
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
                    d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                  />
                </svg>
              </button>
              <button
                onClick={handleSendMessage}
                disabled={isLoading || !inputMessage.trim()}
                className={`p-2 rounded-lg transition ${
                  inputMessage.trim() && !isLoading
                    ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                }`}
                aria-label="Enviar"
              >
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
              </button>
            </div>
          </div>

          {/* Sugerencias de búsqueda - siempre visibles debajo del input */}
          <div className="mt-4 space-y-2">
            {suggestedQueries.map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-[#2a2a2a] hover:text-white transition-colors rounded-lg flex items-center gap-3 group"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 text-gray-400 group-hover:text-gray-300 flex-shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <span className="flex-1">{suggestion}</span>
              </button>
            ))}
          </div>
        </div>
      ) : (
        // Estado conversacional: input compacto en línea
        <div className="border-t border-gray-700/50 pt-3 px-6 pb-4">
          <div className="flex items-center gap-3">
            <input
              ref={inputRef as React.RefObject<HTMLInputElement>}
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Escribe tu pregunta..."
              disabled={isLoading}
              className="flex-1 px-4 py-3 bg-[#2a2a2a] border border-gray-700/50 rounded-xl focus:ring-2 focus:ring-cyan-500 focus:border-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed text-white placeholder-gray-500 text-sm"
            />
            <button
              className="p-3 text-gray-400 hover:text-white hover:bg-[#2a2a2a] rounded-lg transition"
              aria-label="Micrófono"
              title="Micrófono (próximamente)"
            >
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
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            </button>
            <button
              onClick={handleSendMessage}
              disabled={isLoading || !inputMessage.trim()}
              className={`p-3 rounded-lg transition ${
                inputMessage.trim() && !isLoading
                  ? 'bg-cyan-500 text-black hover:bg-cyan-400'
                  : 'bg-gray-700 text-gray-500 cursor-not-allowed'
              }`}
              aria-label="Enviar"
            >
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
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

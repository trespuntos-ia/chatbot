import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Chat } from './Chat';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import { useChat } from '../contexts/ChatContext';
import type { ChatConfig as ChatConfigType } from '../types';
import { getSuggestedQueries } from '../services/suggestedQueriesService';

interface ChatWidgetProps {
  config?: ChatConfigType;
}

export function ChatWidget({ config = DEFAULT_CHAT_CONFIG }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(true); // Abierto por defecto
  const [isExpanded, setIsExpanded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [heroInput, setHeroInput] = useState('');
  const [headerSuggestions, setHeaderSuggestions] = useState<string[]>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const { clearMessages } = useChat();
  const heroInputRef = useRef<HTMLInputElement | null>(null);
  const [queuedMessage, setQueuedMessage] = useState<{ id: string; text: string } | null>(null);

  const openChatWindow = (fullscreen: boolean = false) => {
    setIsOpen(true);
    setIsExpanded(true);
    setIsFullscreen(fullscreen);
  };

  const fallbackSuggestions = useMemo(
    () => [
      'Busco un ahumador portátil para showcooking en sala',
      '¿Tenéis herramientas para trabajar con nitrógeno líquido?',
      'Necesito una máquina para destilaciones en frío',
      '¿Tenéis copas o vasos que funcionen con hielo seco?',
      'Producto para infusionar aceites en frío',
    ],
    []
  );

  // Cargar frases desde el admin
  useEffect(() => {
    let isMounted = true;

    const loadQueries = async () => {
      try {
        const queries = await getSuggestedQueries();
        if (!isMounted) return;

        const activeQueries = queries
          .filter((query) => query.is_active !== false && query.query_text.trim().length > 0)
          .sort((a, b) => a.display_order - b.display_order)
          .map((query) => query.query_text.trim());

        if (activeQueries.length > 0) {
          setHeaderSuggestions(activeQueries);
          setCurrentSuggestionIndex(0);
        } else {
          setHeaderSuggestions(fallbackSuggestions);
          setCurrentSuggestionIndex(0);
        }
      } catch (error) {
        console.error('Error loading header suggestions:', error);
        if (isMounted) {
          setHeaderSuggestions(fallbackSuggestions);
          setCurrentSuggestionIndex(0);
        }
      }
    };

    loadQueries();

    return () => {
      isMounted = false;
    };
  }, [fallbackSuggestions]);

  // Animación cíclica de la frase inferior
  useEffect(() => {
    if (headerSuggestions.length <= 1) return;

    const interval = window.setInterval(() => {
      setCurrentSuggestionIndex((prev) => (prev + 1) % headerSuggestions.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [headerSuggestions]);

  const currentSuggestion =
    headerSuggestions[currentSuggestionIndex] ?? fallbackSuggestions[0] ?? 'Haz tu primera pregunta...';

  const focusChatInput = () => {
    const inputElement = document.getElementById('chat-input') as HTMLTextAreaElement | HTMLInputElement | null;
    if (inputElement) {
      inputElement.focus({ preventScroll: true });
      inputElement.scrollIntoView({ block: 'end', behavior: 'smooth' });
    }
  };

  const createQueuedMessage = (text: string) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    text,
  });

  const dispatchHeroMessage = () => {
    const trimmed = heroInput.trim();

    if (trimmed.length === 0) {
      return false;
    }

    setQueuedMessage(createQueuedMessage(trimmed));
    window.dispatchEvent(new CustomEvent('prefill-chat-input', { detail: trimmed }));
    setHeroInput('');
    return true;
  };

  const handleSuggestionClick = (text: string) => {
    setHeroInput(text);
    if (!isExpanded) {
      openChatWindow(false);
    }
    requestAnimationFrame(() => {
      const input = heroInputRef.current;
      if (input) {
        const length = text.length;
        input.focus();
        input.setSelectionRange(length, length);
      }
    });
  };

  const handleHeroSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasMessage = dispatchHeroMessage();

    if (hasMessage) {
      if (!isExpanded) {
        openChatWindow(false);
      } else {
        requestAnimationFrame(() => focusChatInput());
      }
    }
  };

  const handleCompactHeroSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const hasMessage = dispatchHeroMessage();

    if (hasMessage) {
      openChatWindow(false);
      requestAnimationFrame(() => focusChatInput());
    }
  };

  // Función para limpiar el chat
  const handleClearChat = () => {
    if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
      clearMessages();
      setIsExpanded(false);
      setIsFullscreen(false);
      setHasAutoExpanded(false); // Resetear para permitir auto-expansión en la próxima conversación
    }
  };

  // Función para manejar el cambio manual de expansión
  const handleToggleExpand = () => {
    if (!isExpanded) {
      openChatWindow(false);
      setHasAutoExpanded(true);
      return;
    }
    const newFullscreenState = !isFullscreen;
    setIsFullscreen(newFullscreenState);
    setHasAutoExpanded(true);
  };

  return (
    <>
      {isOpen && isExpanded && isFullscreen && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(140deg,_rgba(5,10,19,0.96)_0%,_rgba(11,18,34,0.94)_45%,_rgba(4,9,20,0.98)_100%)]" />
          <div className="absolute inset-0 backdrop-blur-[12px]" />
        </div>
      )}
      {/* Botón animado "Abrir Asistente" - aparece cuando el modal está cerrado */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => openChatWindow(false)}
          className="fixed bottom-6 right-6 group z-50"
          aria-label="Asistente"
        >
          {/* Capa 2: Halo Glow */}
          <div className="absolute inset-0 rounded-full bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 opacity-75 blur-xl group-hover:opacity-100 transition-opacity duration-300 animate-pulse" />

          {/* Capa 3: Contenedor Principal */}
          <div className="relative flex items-center gap-3 bg-gradient-to-r from-cyan-500 via-blue-600 to-purple-700 px-6 py-4 rounded-full shadow-2xl overflow-hidden">
            {/* Capa 4: Efecto Shine */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
              animate={{ x: ['-100%', '200%'] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 1,
                ease: "easeInOut"
              }}
            />

            {/* Capa 5A: Icono con Rotación */}
            <motion.div
              animate={{ rotate: [0, 10, -10, 10, 0] }}
              transition={{
                duration: 2,
                repeat: Infinity,
                repeatDelay: 0.5,
                ease: "easeInOut"
              }}
            >
              <Sparkles className="w-5 h-5 text-white relative z-10" />
            </motion.div>

            {/* Capa 5B: Texto */}
            <span className="text-white font-medium relative z-10 tracking-wide">
              Asistente
            </span>

            {/* Capa 6: Partículas Flotantes */}
            <div className="absolute inset-0 overflow-hidden rounded-full">
              {/* Partícula 1 - Izquierda */}
              <motion.div
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: '20%', top: '30%' }}
                animate={{
                  y: [-10, -20, -10],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: 0,
                }}
              />

              {/* Partícula 2 - Centro */}
              <motion.div
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: '60%', top: '40%' }}
                animate={{
                  y: [-10, -20, -10],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: 0.5,
                }}
              />

              {/* Partícula 3 - Derecha */}
              <motion.div
                className="absolute w-1 h-1 bg-white rounded-full"
                style={{ left: '80%', top: '50%' }}
                animate={{
                  y: [-10, -20, -10],
                  opacity: [0, 1, 0],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  delay: 1,
                }}
              />
            </div>
          </div>
        </motion.button>
      )}

      {/* Modal flotante - esquina inferior derecha */}
      <div
        className={`fixed z-50 transition-all duration-300 ${
          isOpen
            ? isFullscreen
              ? 'inset-0 h-full w-full overflow-hidden opacity-100 pointer-events-auto'
              : isExpanded
                ? 'bottom-6 right-6 h-[840px] w-full max-w-[728px] opacity-100 pointer-events-auto'
                : 'bottom-6 right-6 w-full max-w-[380px] opacity-100 pointer-events-auto'
            : 'invisible pointer-events-none opacity-0'
        }`}
      >
        {isOpen &&
          (isExpanded ? (
            <div
              className={`flex h-full flex-col overflow-hidden border border-[#303030] shadow-[0_30px_120px_-40px_rgba(8,12,24,0.85)] transition-all duration-300 ${
                isFullscreen ? 'rounded-none bg-[#1a1a1a]' : 'rounded-[32px] bg-[#202020]'
              }`}
            >
              <div className="border-b border-[#2a2a2a] bg-[#202020] px-6 py-6">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-semibold text-white tracking-tight">ChefCopilot</h2>
                    </div>
                    <p className="max-w-sm text-sm text-white/70">
                      Tu asesor experto en cocina profesional
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleToggleExpand}
                      className="rounded-lg p-2 text-white/60 transition hover:bg-[#26262c] hover:text-white"
                      aria-label={isFullscreen ? 'Contraer' : 'Expandir'}
                    >
                      {isFullscreen ? (
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
                            d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
                          />
                        </svg>
                      ) : (
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
                            d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                          />
                        </svg>
                      )}
                    </button>
                    <button
                      onClick={(event) => {
                        event.stopPropagation();
                        handleClearChat();
                      }}
                      className="rounded-lg p-2 text-white/60 transition hover:bg-[#26262c] hover:text-white"
                      aria-label="Limpiar conversación"
                      title="Limpiar conversación"
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
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </button>
                    <button
                      onClick={() => {
                        setIsOpen(false);
                        setIsExpanded(false);
                        setIsFullscreen(false);
                      }}
                      className="rounded-lg p-2 text-white/60 transition hover:bg-[#26262c] hover:text-white"
                      aria-label="Cerrar"
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
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleHeroSubmit} className="mt-6">
                  <div className="relative flex items-center gap-3 rounded-3xl border border-[#3a3a3a] bg-[#2A2A2A] px-4 py-3 shadow-inner transition focus-within:border-cyan-500/60 focus-within:shadow-cyan-500/10">
                    <input
                      type="text"
                      value={heroInput}
                      onChange={(event) => setHeroInput(event.target.value)}
                      placeholder="Pregunta cualquier cosa..."
                      className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                      aria-label="Pregunta al asistente"
                      ref={heroInputRef}
                    />
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
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
                        type="submit"
                        className="rounded-full bg-cyan-500 p-2 text-black shadow-md transition hover:bg-cyan-400"
                        aria-label="Enviar pregunta"
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
                            d="M12 19l9 2-9-18-9 18 9-2zm0-9v6"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </form>

                <div className="mt-4 flex min-h-[1.5rem] items-center gap-2 text-sm text-white/70">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 flex-shrink-0 text-white/60"
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
                  <div className="relative h-5 overflow-hidden">
                    <AnimatePresence mode="wait">
                      <motion.button
                        key={currentSuggestion}
                        initial={{ y: 12, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: -12, opacity: 0 }}
                        transition={{ duration: 0.45, ease: 'easeInOut' }}
                        type="button"
                        onClick={() => handleSuggestionClick(currentSuggestion)}
                        className="rounded-full px-3 py-1 text-left text-white/80 ring-offset-[#202020] transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                      >
                        {currentSuggestion}
                      </motion.button>
                    </AnimatePresence>
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-hidden">
                <Chat
                  config={config}
                  isExpanded={isExpanded}
                  queuedMessage={queuedMessage}
                  onConsumeQueuedMessage={() => setQueuedMessage(null)}
                  onFirstMessage={() => {
                    if (!hasAutoExpanded) {
                      setHasAutoExpanded(true);
                    }
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col gap-4 overflow-hidden rounded-[28px] border border-[#303030] bg-[#202020] p-5 text-white/80 shadow-[0_24px_96px_-36px_rgba(11,14,30,0.85)]">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-semibold text-white">ChefCopilot</h2>
                  </div>
                  <p className="text-sm text-white/60">
                    Tu asesor experto en cocina profesional
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => openChatWindow(false)}
                    className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                    aria-label="Expandir chat"
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
                        d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setIsOpen(false);
                      setIsExpanded(false);
                      setIsFullscreen(false);
                    }}
                    className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                    aria-label="Cerrar chat"
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
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              </div>

              <form onSubmit={handleCompactHeroSubmit}>
                <div className="flex items-center gap-3 rounded-2xl border border-[#3a3a3a] bg-[#2A2A2A] px-4 py-3 shadow-inner transition focus-within:border-cyan-400/60">
                  <input
                    type="text"
                    value={heroInput}
                    onChange={(event) => setHeroInput(event.target.value)}
                    placeholder="Pregunta cualquier cosa..."
                    className="flex-1 bg-transparent text-sm text-white placeholder-white/50 focus:outline-none"
                    aria-label="Pregunta al asistente"
                    ref={heroInputRef}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full p-2 text-white/50 transition hover:bg-white/10 hover:text-white"
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
                      type="submit"
                      className="rounded-full bg-cyan-500 p-2 text-black shadow-md transition hover:bg-cyan-400"
                      aria-label="Enviar pregunta"
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
                          d="M12 19l9 2-9-18-9 18 9-2zm0-9v6"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
              </form>

              <div className="flex items-center gap-2 text-sm text-white/70">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-4 w-4 flex-shrink-0 text-white/55"
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
                <div className="relative h-5 overflow-hidden">
                  <AnimatePresence mode="wait">
                    <motion.button
                      key={currentSuggestion}
                      initial={{ y: 12, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      exit={{ y: -12, opacity: 0 }}
                      transition={{ duration: 0.45, ease: 'easeInOut' }}
                      type="button"
                      onClick={() => handleSuggestionClick(currentSuggestion)}
                      className="rounded-full px-3 py-1 text-left text-white/80 ring-offset-[#202020] transition hover:text-white focus:outline-none focus:ring-2 focus:ring-cyan-500/60"
                    >
                      {currentSuggestion}
                    </motion.button>
                  </AnimatePresence>
                </div>
              </div>
            </div>
          ))}
      </div>
    </>
  );
}

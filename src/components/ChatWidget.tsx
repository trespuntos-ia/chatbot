import { useEffect, useMemo, useState, type FormEvent } from 'react';
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
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const [heroInput, setHeroInput] = useState('');
  const [headerSuggestions, setHeaderSuggestions] = useState<string[]>([]);
  const [currentSuggestionIndex, setCurrentSuggestionIndex] = useState(0);
  const { clearMessages } = useChat();

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

  const handleHeroSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = heroInput.trim();

    if (trimmed.length > 0) {
      window.dispatchEvent(new CustomEvent('prefill-chat-input', { detail: trimmed }));
      setHeroInput('');
    }

    setTimeout(() => focusChatInput(), 25);
  };

  // Función para limpiar el chat
  const handleClearChat = () => {
    if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
      clearMessages();
      setIsExpanded(false);
      setHasAutoExpanded(false); // Resetear para permitir auto-expansión en la próxima conversación
    }
  };

  // Función para manejar el cambio manual de expansión
  const handleToggleExpand = () => {
    const newExpandedState = !isExpanded;
    setIsExpanded(newExpandedState);
    // Si el usuario contrae manualmente, marcar que ya no queremos auto-expansión
    // Si expande manualmente, también marcar para evitar conflictos
    setHasAutoExpanded(true);
  };

  return (
    <>
      {isOpen && isExpanded && (
        <div className="fixed inset-0 z-40 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.18),_transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(140deg,_rgba(5,10,19,0.96)_0%,_rgba(11,18,34,0.94)_45%,_rgba(4,9,20,0.98)_100%)]" />
        </div>
      )}
      {/* Botón animado "Abrir Asistente" - aparece cuando el modal está cerrado */}
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
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

      {/* Modal flotante - esquina superior derecha */}
      <div 
        className={`fixed z-50 transition-all duration-300 ${
          isOpen 
            ? (isExpanded 
                ? 'top-0 right-0 md:top-6 md:right-6 w-full md:w-[800px] h-full md:h-[calc(100vh-3rem)] opacity-100 pointer-events-auto' 
                : 'top-6 right-6 w-full md:w-[400px] h-[650px] opacity-100 pointer-events-auto')
            : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        {/* Contenedor principal con esquinas redondeadas y sombra */}
        <div className={`flex flex-col h-full overflow-hidden border border-gray-700/50 shadow-[0_30px_120px_-40px_rgba(8,12,24,0.85)] ${
          isExpanded ? 'md:rounded-2xl' : 'rounded-2xl'
        } ${isExpanded ? 'bg-[linear-gradient(160deg,_rgba(9,13,23,0.95)_0%,_rgba(7,12,25,0.92)_60%,_rgba(3,7,18,0.96)_100%)]' : 'bg-[#202020]'}`}>
          {/* Header con hero interactivo */}
          <div className="px-6 py-6 border-b border-gray-700/50 bg-gradient-to-br from-[#18181b] via-[#15161b] to-[#11121a]">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-semibold text-white tracking-tight">ChefCopilot</h2>
                  <motion.span
                    className="px-3 py-1 rounded-full bg-cyan-500/15 text-cyan-200 text-xs font-semibold uppercase tracking-[0.12em] border border-cyan-500/40 shadow-sm"
                    animate={{ opacity: [0.8, 1, 0.8] }}
                    transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                  >
                    Asistente activo
                  </motion.span>
                </div>
                <p className="text-sm text-white/70 max-w-sm">
                  Tu asesor experto en cocina profesional
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleExpand}
                  className="p-2 hover:bg-[#26262c] rounded-lg transition text-white/60 hover:text-white"
                  aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                >
                  {isExpanded ? (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    handleClearChat();
                  }}
                  className="p-2 hover:bg-[#26262c] rounded-lg transition text-white/60 hover:text-white"
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
                  }}
                  className="p-2 hover:bg-[#26262c] rounded-lg transition text-white/60 hover:text-white"
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
              <div className="relative flex items-center gap-3 bg-[#111216]/95 border border-white/8 rounded-3xl px-4 py-3 shadow-inner focus-within:border-cyan-500/60 focus-within:shadow-cyan-500/10 transition">
                <input
                  type="text"
                  value={heroInput}
                  onChange={(event) => setHeroInput(event.target.value)}
                  placeholder="Pregunta cualquier cosa..."
                  className="flex-1 bg-transparent text-sm text-white placeholder-white/40 focus:outline-none"
                  aria-label="Pregunta al asistente"
                />
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="p-2 text-white/50 hover:text-white hover:bg-white/10 rounded-full transition"
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
                    className="p-2 rounded-full bg-cyan-500 text-black hover:bg-cyan-400 transition shadow-md"
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

            <div className="mt-4 flex items-center gap-2 text-sm text-white/70 min-h-[1.5rem]">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4 text-white/60 flex-shrink-0"
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
                  <motion.span
                    key={currentSuggestion}
                    initial={{ y: 12, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -12, opacity: 0 }}
                    transition={{ duration: 0.45, ease: 'easeInOut' }}
                    className="block text-white/80"
                  >
                    {currentSuggestion}
                  </motion.span>
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Contenido del chat */}
          <div className="flex-1 overflow-hidden">
            <Chat 
              config={config}
              isExpanded={isExpanded}
              onFirstMessage={() => {
                if (!isExpanded && !hasAutoExpanded) {
                  setIsExpanded(true);
                  setHasAutoExpanded(true);
                }
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

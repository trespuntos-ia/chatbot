import { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Maximize2,
  Minimize2,
  X,
  Mic,
  Send,
  Search
} from 'lucide-react';
import { Chat } from './Chat';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import { useChat } from '../contexts/ChatContext';
import type { ChatConfig as ChatConfigType } from '../types';

interface ChatWidgetProps {
  config?: ChatConfigType;
}

export function ChatWidget({ config = DEFAULT_CHAT_CONFIG }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(true); // Abierto por defecto
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const { clearMessages } = useChat();
  const defaultSuggestion = useMemo(
    () => 'Busco un ahumador portátil para showcooking en sala',
    []
  );

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

  const handleOpenFromCollapsed = () => {
    setIsExpanded(true);
    setHasAutoExpanded(true);
  };

  const collapsedView = (
    <div className="relative flex flex-col rounded-[40px] border border-white/8 bg-[#0b1220]/90 shadow-[0_35px_120px_-40px_rgba(6,13,26,0.9)] backdrop-blur-2xl px-6 py-7 text-white">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-white">ChefCopilot</h2>
          <p className="mt-1 text-sm text-white/65">
            Tu asesor experto en cocina profesional
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleOpenFromCollapsed}
            className="p-2 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
            aria-label="Expandir"
            type="button"
          >
            <Maximize2 className="h-5 w-5" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
            aria-label="Cerrar"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="mt-6">
        <div className="relative flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/4 px-5 py-4 shadow-inner">
          <input
            type="text"
            placeholder="Pregunta cualquier cosa..."
            className="flex-1 bg-transparent text-base text-white placeholder:text-white/40 focus:outline-none cursor-pointer"
            onFocus={handleOpenFromCollapsed}
            readOnly
          />
          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenFromCollapsed}
              className="p-2 rounded-full hover:bg-white/10 transition text-white/70 hover:text-white"
              aria-label="Hablar"
              type="button"
            >
              <Mic className="h-5 w-5" />
            </button>
            <button
              onClick={handleOpenFromCollapsed}
              className="p-2 rounded-full bg-white/15 hover:bg-white/25 transition text-white"
              aria-label="Enviar"
              type="button"
            >
              <Send className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 flex items-center gap-2 text-sm text-white/55">
        <Search className="h-4 w-4" />
        <span>{defaultSuggestion}</span>
      </div>
    </div>
  );

  return (
    <>
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
                ? 'top-0 right-0 md:top-10 md:right-10 w-full md:w-[880px] h-full md:h-[calc(100vh-5rem)] opacity-100 pointer-events-auto'
                : 'bottom-14 right-14 w-full max-w-[420px] opacity-100 pointer-events-auto')
            : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        {isExpanded ? (
          <div className="relative flex h-full flex-col overflow-hidden rounded-[32px] border border-white/8 bg-[#0b1220]/95 shadow-[0_40px_140px_-40px_rgba(3,8,18,0.9)] backdrop-blur-2xl">
            <div className="absolute inset-0 bg-white/6 pointer-events-none" style={{ maskImage: 'radial-gradient(circle at top, rgba(0,0,0,0.75), transparent 60%)' }} />
            <div className="absolute inset-0 border border-white/10 rounded-[32px] pointer-events-none mix-blend-screen" />

            {/* Header */}
            <div className="relative border-b border-white/10 px-6 py-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold text-white">ChefCopilot</h2>
                    <p className="text-xs text-white/60">
                      Tu asesor experto en cocina profesional
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleToggleExpand}
                    className="p-2 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
                    aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                    type="button"
                  >
                    {isExpanded ? (
                      <Minimize2 className="h-5 w-5" />
                    ) : (
                      <Maximize2 className="h-5 w-5" />
                    )}
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleClearChat();
                    }}
                    className="p-2 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
                    aria-label="Limpiar conversación"
                    title="Limpiar conversación"
                    type="button"
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
                    className="p-2 rounded-lg hover:bg-white/10 transition text-white/60 hover:text-white"
                    aria-label="Cerrar"
                    type="button"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <p className="mt-3 text-xs text-white/55 leading-relaxed">
                Explora productos, técnicas, accesorios o platos con un asistente que habla tu idioma culinario.
              </p>
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
        ) : (
          collapsedView
        )}
      </div>
    </>
  );
}

import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Sparkles } from 'lucide-react';
import { Chat } from './Chat';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import { useChat } from '../contexts/ChatContext';
import type { ChatConfig as ChatConfigType } from '../types';

interface ChatWidgetProps {
  config?: ChatConfigType;
}

export function ChatWidget({ config = DEFAULT_CHAT_CONFIG }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const { messages, clearMessages } = useChat();

  // Auto-expandir al enviar el primer mensaje
  useEffect(() => {
    if (messages.length > 0 && !isExpanded) {
      setIsExpanded(true);
    }
  }, [messages.length, isExpanded]);

  // Función para limpiar el chat
  const handleClearChat = () => {
    if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
      clearMessages();
      setIsExpanded(false);
    }
  };

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
          aria-label="Abrir Asistente"
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
              Abrir Asistente
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
        <div className={`bg-[#202020] shadow-2xl flex flex-col h-full overflow-hidden border border-gray-700/50 ${
          isExpanded ? 'md:rounded-2xl' : 'rounded-2xl'
        }`}>
          {/* Header con botones de control */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700/50">
            {/* Botón cerrar (X) - esquina superior izquierda */}
            <button
              onClick={() => {
                setIsOpen(false);
                setIsExpanded(false);
              }}
              className="p-2 hover:bg-[#2a2a2a] rounded-lg transition text-gray-400 hover:text-white"
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

            {/* Logo y descripción de ChefCopilot - alineado a la derecha */}
            <div className="flex-1 text-right">
              <h2 className="text-lg font-semibold text-white">ChefCopilot</h2>
              <p className="text-xs text-gray-400">Asesor experto en cocina profesional</p>
            </div>

            {/* Botones de control - esquina superior derecha */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition text-gray-400 hover:text-white"
                aria-label={isExpanded ? "Contraer" : "Expandir"}
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
                className="p-2 hover:bg-[#2a2a2a] rounded-lg transition text-gray-400 hover:text-white"
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
            </div>
          </div>

          {/* Contenido del chat */}
          <div className="flex-1 overflow-hidden">
            <Chat 
              config={config} 
              onFirstMessage={() => {
                if (!isExpanded) {
                  setIsExpanded(true);
                }
              }}
            />
          </div>
        </div>
      </div>
    </>
  );
}

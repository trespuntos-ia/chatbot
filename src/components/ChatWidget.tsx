import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import {
  Sparkles,
  Search,
  Mic,
  Send,
  Maximize2,
  Minimize2,
  X
} from 'lucide-react';
import { Chat } from './Chat';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import { useChat } from '../contexts/ChatContext';
import type { ChatConfig as ChatConfigType } from '../types';

interface ChatWidgetProps {
  config?: ChatConfigType;
}

export function ChatWidget({ config = DEFAULT_CHAT_CONFIG }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(true);
  const [isExpanded, setIsExpanded] = useState(false);
  const [hasAutoExpanded, setHasAutoExpanded] = useState(false);
  const { clearMessages } = useChat();

  const placeholder = useMemo(
    () => 'Busco un ahumador portátil para showcooking en sala',
    []
  );

  const handleToggleExpand = () => {
    const next = !isExpanded;
    setIsExpanded(next);
    setHasAutoExpanded(true);
  };

  const handleOpenCollapsed = () => {
    setIsExpanded(true);
    setHasAutoExpanded(true);
  };

  const handleClearChat = () => {
    if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
      clearMessages();
      setIsExpanded(false);
      setHasAutoExpanded(false);
    }
  };

  return (
    <>
      {!isOpen && (
        <motion.button
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 rounded-full bg-black px-5 py-3 text-sm font-medium text-white shadow-lg"
        >
          Abrir asistente
        </motion.button>
      )}

      <motion.div
        layout
        transition={{ type: 'spring', stiffness: 280, damping: 26 }}
        className={`fixed z-40 ${
          isOpen
            ? isExpanded
              ? 'top-0 right-0 h-full w-full md:top-12 md:right-12 md:h-[calc(100vh-8rem)] md:w-[940px]'
              : 'bottom-12 right-12 w-[min(90vw,360px)]'
            : 'pointer-events-none opacity-0'
        }`}
      >
        {isExpanded ? (
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            className="relative flex h-full flex-col overflow-hidden rounded-[28px] border border-black/10 bg-[#0f1116]/98 text-white shadow-[0_40px_140px_-45px_rgba(0,0,0,0.75)] backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/10">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold">ChefCopilot</h2>
                  <p className="text-xs text-white/65">Tu asesor experto en cocina profesional</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleToggleExpand}
                  className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label={isExpanded ? 'Contraer' : 'Expandir'}
                  type="button"
                >
                  {isExpanded ? <Minimize2 className="h-5 w-5" /> : <Maximize2 className="h-5 w-5" />}
                </button>
                <button
                  onClick={() => {
                    setIsOpen(false);
                    setIsExpanded(false);
                  }}
                  className="rounded-lg p-2 text-white/60 transition hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

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

            <div className="flex items-center justify-between border-t border-white/10 px-6 py-4 text-xs text-white/60">
              <button
                onClick={handleClearChat}
                className="transition hover:text-white"
                type="button"
              >
                Limpiar conversación
              </button>
              <button
                onClick={() => setIsExpanded(false)}
                className="transition hover:text-white"
                type="button"
              >
                Contraer
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.div
            layout
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            className="relative flex w-full cursor-pointer flex-col rounded-[30px] border border-black/10 bg-[#101116]/95 px-6 py-6 text-white shadow-[0_30px_90px_-40px_rgba(10,12,22,0.7)] backdrop-blur"
            onClick={handleOpenCollapsed}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">ChefCopilot</h2>
                <p className="mt-1 text-xs text-white/65">Tu asesor experto en cocina profesional</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    handleOpenCollapsed();
                  }}
                  className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
                  aria-label="Expandir"
                  type="button"
                >
                  <Maximize2 className="h-5 w-5" />
                </button>
                <button
                  onClick={(event) => {
                    event.stopPropagation();
                    setIsOpen(false);
                  }}
                  className="rounded-full p-2 text-white/65 transition hover:bg-white/10 hover:text-white"
                  aria-label="Cerrar"
                  type="button"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="mt-6">
              <div className="flex items-center gap-3 rounded-[24px] border border-white/10 bg-white/6 px-5 py-4 shadow-inner">
                <input
                  type="text"
                  placeholder="Pregunta cualquier cosa..."
                  readOnly
                  className="flex-1 cursor-pointer bg-transparent text-sm text-white placeholder:text-white/40 focus:outline-none"
                />
                <div className="flex items-center gap-2">
                  <button
                    className="rounded-full p-2 text-white/70 transition hover:bg-white/10 hover:text-white"
                    type="button"
                  >
                    <Mic className="h-5 w-5" />
                  </button>
                  <button
                    className="rounded-full bg-white/20 p-2 text-white transition hover:bg-white/30"
                    type="button"
                  >
                    <Send className="h-5 w-5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-5 flex items-center gap-2 text-xs text-white/60">
              <Search className="h-4 w-4" />
              <span>{placeholder}</span>
            </div>
          </motion.div>
        )}
      </motion.div>
    </>
  );
}

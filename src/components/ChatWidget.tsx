import { useState } from 'react';
import { Chat } from './Chat';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import type { ChatConfig as ChatConfigType } from '../types';

interface ChatWidgetProps {
  config?: ChatConfigType;
}

export function ChatWidget({ config = DEFAULT_CHAT_CONFIG }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  return (
    <>
      {/* Botón flotante circular */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 w-16 h-16 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-2xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
          aria-label="Abrir chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-8 w-8"
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
        </button>
      )}

      {/* Overlay con blur */}
      <div
        className={`fixed inset-0 bg-black/20 backdrop-blur-sm z-40 transition-opacity duration-300 ${
          isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => {
          setIsOpen(false);
          setIsMaximized(false);
        }}
      />

      {/* Ventana de chat - siempre montada pero oculta cuando está cerrada */}
      <div 
        className={`fixed z-50 flex flex-col transition-all duration-300 ${
          isOpen 
            ? (isMaximized 
                ? 'bottom-0 right-0 top-0 left-1/2 w-1/2 opacity-100 pointer-events-auto' 
                : 'bottom-6 right-6 w-full max-w-md h-[85vh] max-h-[700px] opacity-100 pointer-events-auto')
            : 'opacity-0 pointer-events-none invisible'
        }`}
      >
        {/* Contenedor principal con esquinas redondeadas */}
        <div className={`bg-white shadow-2xl flex flex-col h-full overflow-hidden ${
          isMaximized ? 'rounded-none' : 'rounded-t-[2rem] rounded-b-3xl'
        }`}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setIsOpen(false);
                  setIsMaximized(false);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                aria-label="Cerrar"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <h2 className="text-lg font-semibold text-slate-900">
                Hola, ¿qué tal? 👋
              </h2>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                aria-label={isMaximized ? "Minimizar" : "Maximizar"}
              >
                {isMaximized ? (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5 text-slate-600"
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
                    className="h-5 w-5 text-slate-600"
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
                  // Disparar evento personalizado para limpiar chat
                  window.dispatchEvent(new CustomEvent('clearChat'));
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
                aria-label="Limpiar conversación"
                title="Limpiar conversación"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5 text-slate-600"
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
            <Chat config={config} />
          </div>

        </div>

        {/* Botón de cerrar circular azul fuera del chat */}
        <button
          onClick={() => {
            setIsOpen(false);
            setIsMaximized(false);
          }}
          className="absolute -bottom-12 right-4 w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-xl flex items-center justify-center transition-all duration-300 hover:scale-110 z-50"
          aria-label="Cerrar chat"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2.5}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        {/* Footer con branding - más abajo */}
        <div className="absolute bottom-[-5rem] left-1/2 transform -translate-x-1/2 text-center w-full">
          <p className="text-xs text-slate-400">
            POWERED BY{' '}
            <span className="font-semibold text-slate-600">Tres Puntos</span>
          </p>
        </div>
      </div>
    </>
  );
}

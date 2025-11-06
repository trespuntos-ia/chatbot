import { useState } from 'react';
import { ProductsReport } from './ProductsReport';
import { Connections } from './Connections';
import { PromptConfig } from './PromptConfig';
import { Chat } from './Chat';
import { ChatConfig } from './ChatConfig';
import { Documentation } from './Documentation';
import { SyncHistory } from './SyncHistory';
import { WidgetIntegration } from './WidgetIntegration';
import { ChatAnalytics } from './ChatAnalytics';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import type { ChatConfig as ChatConfigType } from '../types';

type Tab = 'products' | 'connections' | 'chat' | 'prompts' | 'documentation' | 'history' | 'integration' | 'analytics';

export function Dashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('products');
  const [chatConfig, setChatConfig] = useState<ChatConfigType>(DEFAULT_CHAT_CONFIG);

  const tabs = [
    { id: 'products' as Tab, label: 'Productos', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    )},
    { id: 'connections' as Tab, label: 'Conexiones', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-5.656-3.555a4 4 0 001.414-2.828l4-4a4 4 0 012.828-1.414l-2.828 2.828z" />
      </svg>
    )},
    { id: 'chat' as Tab, label: 'Chat', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    )},
    { id: 'prompts' as Tab, label: 'Configuración AI', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )},
    { id: 'documentation' as Tab, label: 'Documentación', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    )},
    { id: 'history' as Tab, label: 'Historial', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )},
    { id: 'integration' as Tab, label: 'Integración', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
      </svg>
    )},
    { id: 'analytics' as Tab, label: 'Analytics', icon: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )},
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        {/* Header */}
        <div className="mb-4 sm:mb-6 lg:mb-8">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-slate-900 mb-1 sm:mb-2">
            Dashboard PrestaShop
          </h1>
            <p className="text-sm sm:text-base text-slate-600">
            Gestiona tus productos y conexiones de PrestaShop
          </p>
          </div>
        </div>

        {/* Tabs Desktop */}
        <div className="hidden lg:block mb-6">
          <div className="border-b border-slate-200">
            <nav className="-mb-px flex space-x-8 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-4 px-1 border-b-2 font-medium text-sm whitespace-nowrap transition-colors flex items-center gap-2 ${
                    activeTab === tab.id
                      ? 'border-indigo-500 text-indigo-600'
                      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tabs Mobile (horizontal scroll mejorado) */}
        <div className="lg:hidden mb-4 sm:mb-6 -mx-4 sm:-mx-6 lg:mx-0">
          <div className="bg-white border-b-2 border-slate-300 sticky top-0 z-30 shadow-lg">
            <div className="relative">
              <nav 
                className="mobile-nav-scroll scrollbar-hide"
                style={{ 
                  WebkitOverflowScrolling: 'touch',
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  scrollBehavior: 'smooth',
                  display: 'flex',
                  overflowX: 'auto',
                  overflowY: 'hidden'
                }}
              >
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id);
                      // Scroll al elemento activo
                      setTimeout(() => {
                        const element = document.querySelector(`[data-tab-id="${tab.id}"]`);
                        if (element) {
                          element.scrollIntoView({ 
                            behavior: 'smooth', 
                            block: 'nearest', 
                            inline: 'center' 
                          });
                        }
                      }, 50);
                    }}
                    data-tab-id={tab.id}
                    className={`py-5 px-7 border-b-4 font-bold text-lg whitespace-nowrap transition-all duration-200 flex items-center gap-3 flex-shrink-0 min-w-max ${
                      activeTab === tab.id
                        ? 'border-indigo-600 text-indigo-700 bg-indigo-100 shadow-sm'
                        : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex-shrink-0 text-xl">{tab.icon}</span>
                    <span className="font-bold">{tab.label}</span>
                  </button>
                ))}
              </nav>
              {/* Indicadores de scroll más visibles */}
              <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-white via-white to-transparent pointer-events-none z-20" />
              <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-white via-white to-transparent pointer-events-none z-20" />
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="mt-4 sm:mt-6">
          {activeTab === 'products' && <ProductsReport />}
          {activeTab === 'connections' && <Connections />}
          {activeTab === 'chat' && (
            <div className="space-y-4 sm:space-y-6">
              <ChatConfig config={chatConfig} onConfigChange={setChatConfig} />
              <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-0 sm:p-6">
                <Chat config={chatConfig} />
              </div>
            </div>
          )}
          {activeTab === 'prompts' && <PromptConfig />}
          {activeTab === 'documentation' && <Documentation />}
          {activeTab === 'history' && <SyncHistory />}
          {activeTab === 'integration' && <WidgetIntegration />}
          {activeTab === 'analytics' && <ChatAnalytics />}
        </div>
      </div>
    </div>
  );
}


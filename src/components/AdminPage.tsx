import { useMemo, useState } from 'react';
import { ProductsReport } from './ProductsReport';
import { Connections } from './Connections';
import { ChatConfig } from './ChatConfig';
import { Chat } from './Chat';
import { PromptConfig } from './PromptConfig';
import { WidgetIntegration } from './WidgetIntegration';
import { ChatAnalytics } from './ChatAnalytics';
import { SyncHistory } from './SyncHistory';
import { Documentation } from './Documentation';
import { DEFAULT_CHAT_CONFIG } from '../services/chatService';
import type { ChatConfig as ChatConfigType } from '../types';

interface AdminSection {
  id: string;
  label: string;
  description: string;
  content: JSX.Element;
}

export function AdminPage() {
  const [chatConfigState, setChatConfigState] = useState<ChatConfigType>(DEFAULT_CHAT_CONFIG);

  const sections = useMemo<AdminSection[]>(() => [
    {
      id: 'overview',
      label: 'Resumen de productos',
      description: 'Estadísticas clave y reporte detallado de tu catálogo sincronizado desde PrestaShop.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <ProductsReport />
        </div>
      ),
    },
    {
      id: 'connections',
      label: 'Conexiones',
      description: 'Gestiona integraciones y verifica el estado de las conexiones con tu tienda y fuentes externas.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <Connections />
        </div>
      ),
    },
    {
      id: 'chat-config',
      label: 'Configuración del chat',
      description: 'Ajusta los parámetros del asistente y prueba la experiencia conversacional en tiempo real.',
      content: (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <ChatConfig config={chatConfigState} onConfigChange={setChatConfigState} />
          </div>
          <div className="bg-slate-900 rounded-2xl shadow-lg border border-slate-800 overflow-hidden">
            <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-white tracking-tight">Asistente en vivo</h3>
              <span className="text-xs uppercase tracking-[0.12em] text-white/60">Vista previa</span>
            </div>
            <div className="h-[640px]">
              <Chat config={chatConfigState} isExpanded />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'prompts',
      label: 'Prompts y comportamiento',
      description: 'Define el rol del asistente, establece restricciones y añade instrucciones personalizadas.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <PromptConfig />
        </div>
      ),
    },
    {
      id: 'integration',
      label: 'Integración del widget',
      description: 'Configura y copia el código de integración para incrustar el asistente en tu web o apps.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <WidgetIntegration />
        </div>
      ),
    },
    {
      id: 'analytics',
      label: 'Analíticas',
      description: 'Consulta métricas de uso, contención y conversiones asistidas del asistente ChefCopilot.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <ChatAnalytics />
        </div>
      ),
    },
    {
      id: 'history',
      label: 'Historial y auditoría',
      description: 'Revisa el histórico de sincronizaciones, estados y eventos del asistente.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <SyncHistory />
        </div>
      ),
    },
    {
      id: 'documentation',
      label: 'Documentación',
      description: 'Accede a manuales, guías y mejores prácticas para administrar tu asistente conversacional.',
      content: (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <Documentation />
        </div>
      ),
    },
  ], [chatConfigState]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-12">
        <header className="mb-10">
          <p className="text-xs font-semibold uppercase tracking-[0.4em] text-indigo-500/80">
            Centro de control
          </p>
          <h1 className="mt-2 text-3xl sm:text-4xl lg:text-5xl font-bold text-slate-900">
            Panel de administración ChefCopilot
          </h1>
          <p className="mt-4 text-base sm:text-lg text-slate-600 max-w-3xl">
            Gestiona desde un único lugar la configuración del asistente, tus prompts,
            integraciones, analíticas en tiempo real y toda la documentación de soporte.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[280px,minmax(0,1fr)]">
          <aside className="hidden lg:block">
            <nav className="sticky top-8 rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-200">
                <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-[0.2em]">
                  Secciones
                </h2>
              </div>
              <ul className="divide-y divide-slate-200">
                {sections.map((section) => (
                  <li key={section.id}>
                    <a
                      href={`#${section.id}`}
                      className="flex flex-col gap-1 px-6 py-4 hover:bg-indigo-50/80 transition-colors group"
                    >
                      <span className="text-sm font-semibold text-slate-700 group-hover:text-indigo-700">
                        {section.label}
                      </span>
                      <span className="text-xs text-slate-500">
                        {section.description}
                      </span>
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </aside>

          <main className="space-y-12">
            {sections.map((section) => (
              <section key={section.id} id={section.id} className="scroll-mt-24">
                <div className="mb-6">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex items-center justify-center rounded-full bg-indigo-100 text-indigo-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em]">
                      {section.label}
                    </span>
                    <div className="h-px flex-1 bg-gradient-to-r from-indigo-200 via-slate-200 to-transparent" />
                  </div>
                  <p className="mt-3 text-base text-slate-600 max-w-3xl">
                    {section.description}
                  </p>
                </div>
                {section.content}
              </section>
            ))}
          </main>
        </div>
      </div>
    </div>
  );
}


import { useState, useEffect, useCallback } from 'react';
import { ChatWidget } from './components/ChatWidget';
import { ChatProvider } from './contexts/ChatContext';
import { Dashboard } from './components/Dashboard';
import { AdminPage } from './components/AdminPage';

type AppView = 'landing' | 'dashboard' | 'admin';

const resolveViewFromLocation = (): AppView => {
  if (typeof window === 'undefined') return 'dashboard';
  const { pathname, search } = window.location;

  if (pathname === '/admin') {
    return 'admin';
  }

  if (pathname === '/landing') {
    return 'landing';
  }

  const params = new URLSearchParams(search);
  return params.get('view') === 'landing' ? 'landing' : 'dashboard';
};

function App() {
  const [view, setView] = useState<AppView>(resolveViewFromLocation);

  const syncViewWithLocation = useCallback(() => {
    setView(resolveViewFromLocation());
  }, []);

  useEffect(() => {
    window.addEventListener('popstate', syncViewWithLocation);
    return () => window.removeEventListener('popstate', syncViewWithLocation);
  }, [syncViewWithLocation]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.location.pathname === '/landing') {
      const url = new URL(window.location.href);
      url.pathname = '/';
      url.searchParams.set('view', 'landing');
      window.history.replaceState({}, '', url.toString());
      setView('landing');
    } else if (window.location.pathname === '/admin') {
      setView('admin');
    }
  }, []);

  const switchView = (target: AppView) => {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (target === 'landing') {
      url.pathname = '/';
      url.searchParams.set('view', 'landing');
    } else if (target === 'admin') {
      url.pathname = '/admin';
      url.searchParams.delete('view');
    } else {
      url.pathname = '/';
      url.searchParams.delete('view');
    }
    window.history.pushState({}, '', url.toString());
    setView(target);
  };

  return (
    <ChatProvider>
      {view === 'dashboard' ? (
        <>
          <Dashboard />
          <ChatWidget />
          <button
            onClick={() => switchView('landing')}
            className="fixed top-5 right-5 z-50 rounded-full border border-slate-200 bg-white/90 px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-white"
            type="button"
          >
            Ver landing del chat
          </button>
          <button
            onClick={() => switchView('admin')}
            className="fixed top-5 right-5 mt-12 z-50 rounded-full border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
            type="button"
          >
            Ir al panel /admin
          </button>
        </>
      ) : view === 'landing' ? (
        <div className="relative min-h-screen overflow-hidden bg-transparent text-white">
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.2),_transparent_55%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_right,_rgba(37,99,235,0.18),_transparent_60%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_rgba(15,23,42,0.74),_rgba(3,7,18,0.95)_75%)]" />
          </div>

          <div className="absolute top-6 right-6 z-50">
            <button
              onClick={() => switchView('dashboard')}
              className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-medium text-white/85 backdrop-blur hover:bg-white/15"
              type="button"
            >
              Ir al dashboard
            </button>
          </div>

          <ChatWidget />
        </div>
      ) : (
        <div className="relative min-h-screen">
          <div className="absolute top-6 right-6 z-50 flex flex-wrap gap-3">
            <button
              onClick={() => switchView('dashboard')}
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              type="button"
            >
              Ir a vista principal
            </button>
            <button
              onClick={() => switchView('landing')}
              className="rounded-full border border-indigo-200 bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-500"
              type="button"
            >
              Ver landing del chat
            </button>
          </div>
          <AdminPage />
        </div>
      )}
    </ChatProvider>
  );
}

export default App;

import { useState, useEffect } from 'react';
import type { ApiConfig } from '../types';

interface AuthFormProps {
  onAuthenticate: (config: ApiConfig) => void;
}

type ConnectionStatus = 'idle' | 'checking' | 'connected' | 'error';

export function AuthForm({ onAuthenticate }: AuthFormProps) {
  // Cargar configuración guardada del localStorage
  let initialConfig = null;
  if (typeof window !== 'undefined') {
    try {
      const savedConfig = localStorage.getItem('prestashop-config');
      if (savedConfig) {
        initialConfig = JSON.parse(savedConfig);
      }
    } catch (e) {
      console.error('Error loading saved config:', e);
    }
  }

  const [apiKey, setApiKey] = useState(initialConfig?.apiKey || 'E5CUG6DLAD9EA46AIN7Z2LIX1W3IIJKZ');
  const [prestashopUrl, setPrestashopUrl] = useState(initialConfig?.prestashopUrl || 'https://100x100chef.com/shop/api/');
  const [baseUrl, setBaseUrl] = useState(initialConfig?.baseUrl || 'https://100x100chef.com/shop/');
  const [langCode, setLangCode] = useState(String(initialConfig?.langCode || '1'));
  const [langSlug, setLangSlug] = useState(initialConfig?.langSlug || 'es');
  const [error, setError] = useState('');
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('idle');
  const [connectionMessage, setConnectionMessage] = useState('');

  // Verificar conexión cuando cambien los campos principales
  useEffect(() => {
    const checkConnection = async () => {
      if (!apiKey.trim() || !prestashopUrl.trim()) {
        setConnectionStatus('idle');
        setConnectionMessage('');
        return;
      }

      setConnectionStatus('checking');
      setConnectionMessage('Verificando conexión...');

      try {
        const queryParams = new URLSearchParams({
          prestashop_url: prestashopUrl.trim(),
          ws_key: apiKey.trim(),
          output_format: 'JSON',
        });

        const proxyUrl = `/api/prestashop-proxy?endpoint=products&${queryParams.toString()}&limit=0,1`;

        const response = await fetch(proxyUrl, {
          method: 'GET',
        });

        if (response.ok) {
          setConnectionStatus('connected');
          setConnectionMessage('Conexión exitosa');
        } else {
          const errorData = await response.json().catch(() => ({}));
          setConnectionStatus('error');
          setConnectionMessage(errorData.error || 'Error de conexión');
        }
      } catch (err) {
        setConnectionStatus('error');
        setConnectionMessage(err instanceof Error ? err.message : 'Error al verificar conexión');
      }
    };

    // Debounce para no verificar en cada tecla
    const timeoutId = setTimeout(checkConnection, 1000);
    return () => clearTimeout(timeoutId);
  }, [apiKey, prestashopUrl]);

  // Verificar conexión al montar si hay valores iniciales
  useEffect(() => {
    if (apiKey.trim() && prestashopUrl.trim()) {
      const checkConnection = async () => {
        setConnectionStatus('checking');
        setConnectionMessage('Verificando conexión...');

        try {
          const queryParams = new URLSearchParams({
            prestashop_url: prestashopUrl.trim(),
            ws_key: apiKey.trim(),
            output_format: 'JSON',
          });

          const proxyUrl = `/api/prestashop-proxy?endpoint=products&${queryParams.toString()}&limit=0,1`;

          const response = await fetch(proxyUrl, {
            method: 'GET',
          });

          if (response.ok) {
            setConnectionStatus('connected');
            setConnectionMessage('Conexión exitosa');
          } else {
            const errorData = await response.json().catch(() => ({}));
            setConnectionStatus('error');
            setConnectionMessage(errorData.error || 'Error de conexión');
          }
        } catch (err) {
          setConnectionStatus('error');
          setConnectionMessage(err instanceof Error ? err.message : 'Error al verificar conexión');
        }
      };

      checkConnection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!apiKey.trim()) {
      setError('La API Key es requerida');
      return;
    }

    if (!prestashopUrl.trim()) {
      setError('La URL de PrestaShop es requerida');
      return;
    }

    onAuthenticate({
      apiKey: apiKey.trim(),
      prestashopUrl: prestashopUrl.trim(),
      baseUrl: baseUrl.trim() || undefined,
      langCode: parseInt(langCode) || 1,
      langSlug: langSlug.trim() || 'es',
    });
  };

  return (
    <div className="w-full">
      <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-500 via-sky-500 to-cyan-500 px-6 py-8">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-lg bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">PrestaShop Products</h1>
                <p className="text-sm text-white/80">Conecta con tu API</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Indicador de estado de conexión */}
            {connectionStatus !== 'idle' && (
              <div className={`px-4 py-3 rounded-lg text-sm flex items-center gap-2 ${
                connectionStatus === 'connected'
                  ? 'bg-green-50 border border-green-200 text-green-700'
                  : connectionStatus === 'checking'
                  ? 'bg-blue-50 border border-blue-200 text-blue-700'
                  : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {connectionStatus === 'connected' && (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                )}
                {connectionStatus === 'checking' && (
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                {connectionStatus === 'error' && (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="font-medium">{connectionMessage}</span>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="apiKey" className="block text-sm font-semibold text-slate-700 mb-2">
                API Key <span className="text-red-500">*</span>
              </label>
              <input
                id="apiKey"
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="E5CUG6DLAD9EA46AIN7Z2LIX1W3IIJKZ"
                required
              />
            </div>

            <div>
              <label htmlFor="prestashopUrl" className="block text-sm font-semibold text-slate-700 mb-2">
                URL API PrestaShop <span className="text-red-500">*</span>
              </label>
              <input
                id="prestashopUrl"
                type="url"
                value={prestashopUrl}
                onChange={(e) => setPrestashopUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="https://tu-tienda.com/api/"
                required
              />
            </div>

            <div>
              <label htmlFor="baseUrl" className="block text-sm font-semibold text-slate-700 mb-2">
                URL Base (opcional)
              </label>
              <input
                id="baseUrl"
                type="url"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                placeholder="https://tu-tienda.com/"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="langCode" className="block text-sm font-semibold text-slate-700 mb-2">
                  Código Idioma
                </label>
                <input
                  id="langCode"
                  type="number"
                  value={langCode}
                  onChange={(e) => setLangCode(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="1"
                />
              </div>

              <div>
                <label htmlFor="langSlug" className="block text-sm font-semibold text-slate-700 mb-2">
                  Slug Idioma
                </label>
                <input
                  id="langSlug"
                  type="text"
                  value={langSlug}
                  onChange={(e) => setLangSlug(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                  placeholder="es"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={connectionStatus === 'checking'}
              className="w-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-600 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition shadow-lg shadow-indigo-500/50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Conectar y Obtener Productos
            </button>
          </form>
        </div>
    </div>
  );
}


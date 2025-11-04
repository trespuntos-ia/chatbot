import { useState } from 'react';
import type { ApiConfig } from '../types';

interface AuthFormProps {
  onAuthenticate: (config: ApiConfig) => void;
}

export function AuthForm({ onAuthenticate }: AuthFormProps) {
  const [apiKey, setApiKey] = useState('');
  const [prestashopUrl, setPrestashopUrl] = useState('https://100x100chef.com/shop/api/');
  const [baseUrl, setBaseUrl] = useState('https://100x100chef.com/shop/');
  const [langCode, setLangCode] = useState('1');
  const [langSlug, setLangSlug] = useState('es');
  const [error, setError] = useState('');

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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
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
              className="w-full bg-gradient-to-r from-indigo-500 to-sky-500 text-white font-semibold py-3 px-6 rounded-lg hover:from-indigo-600 hover:to-sky-600 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition shadow-lg shadow-indigo-500/50"
            >
              Conectar y Obtener Productos
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}


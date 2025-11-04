import { useState } from 'react';
import { AuthForm } from './components/AuthForm';
import { ProgressBar } from './components/ProgressBar';
import { ProductTable } from './components/ProductTable';
import { fetchAllProducts } from './services/prestashopApi';
import type { ApiConfig, Product } from './types';

type AppState = 'auth' | 'loading' | 'success' | 'error';

function App() {
  const [state, setState] = useState<AppState>('auth');
  const [products, setProducts] = useState<Product[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: null as number | null });
  const [error, setError] = useState<string>('');

  const handleAuthenticate = async (config: ApiConfig) => {
    setState('loading');
    setProgress({ current: 0, total: null });
    setError('');

    try {
      const fetchedProducts = await fetchAllProducts(config, (current, total) => {
        setProgress({ current, total });
      });

      setProducts(fetchedProducts);
      setState('success');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al obtener productos');
      setState('error');
    }
  };

  const handleReset = () => {
    setState('auth');
    setProducts([]);
    setProgress({ current: 0, total: null });
    setError('');
  };

  if (state === 'auth') {
    return <AuthForm onAuthenticate={handleAuthenticate} />;
  }

  if (state === 'loading') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-8">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                <svg
                  className="animate-spin h-8 w-8 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Obteniendo productos
              </h2>
              <p className="text-slate-600">
                Por favor espera mientras descargamos todos los productos de tu tienda
              </p>
            </div>
            <ProgressBar
              current={progress.current}
              total={progress.total}
            />
          </div>
        </div>
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-8">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-8 w-8 text-red-600"
                  xmlns="http://www.w3.org/2000/svg"
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
              </div>
              <h2 className="text-2xl font-bold text-slate-900 mb-2">
                Error
              </h2>
              <p className="text-red-600 mb-6">{error}</p>
              <button
                onClick={handleReset}
                className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-medium"
              >
                Intentar de nuevo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 py-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Productos PrestaShop
            </h1>
            <p className="text-slate-600 mt-1">
              {products.length.toLocaleString()} productos cargados
            </p>
          </div>
          <button
            onClick={handleReset}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-medium"
          >
            Nueva conexión
          </button>
        </div>
        <ProductTable products={products} />
      </div>
    </div>
  );
}

export default App;

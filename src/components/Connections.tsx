import { useState, useEffect } from 'react';
import { AuthForm } from './AuthForm';
import { ProgressBar } from './ProgressBar';
import { ProductTable } from './ProductTable';
import { fetchAllProducts } from '../services/prestashopApi';
import type { ApiConfig, Product } from '../types';

type ConnectionState = 'no-connection' | 'scanning' | 'products-found' | 'error';

export function Connections() {
  const [connectionState, setConnectionState] = useState<ConnectionState>('no-connection');
  const [config, setConfig] = useState<ApiConfig | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [progress, setProgress] = useState({ current: 0, total: null as number | null });
  const [error, setError] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });

  // Función para guardar conexión existente en Supabase
  const saveExistingConnectionToSupabase = async (apiConfig: ApiConfig) => {
    try {
      const response = await fetch('/api/save-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Default Connection',
          prestashop_url: apiConfig.prestashopUrl,
          api_key: apiConfig.apiKey,
          base_url: apiConfig.baseUrl,
          lang_code: apiConfig.langCode || 1,
          lang_slug: apiConfig.langSlug || 'es',
          is_active: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Error al guardar conexión');
      }
      
      return await response.json();
    } catch (err) {
      console.error('Error saving connection:', err);
      throw err;
    }
  };

  // Cargar configuración guardada del localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem('prestashop-config');
    if (savedConfig) {
      try {
        const parsed = JSON.parse(savedConfig);
        setConfig(parsed);
        setConnectionState('no-connection');
        
        // Intentar guardar automáticamente en Supabase
        saveExistingConnectionToSupabase(parsed).catch(() => {
          // Silencioso si falla, el usuario puede hacerlo manualmente
        });
      } catch (e) {
        console.error('Error loading saved config:', e);
      }
    }
  }, []);

  const handleAuthenticate = async (apiConfig: ApiConfig) => {
    // Guardar configuración en localStorage (para uso inmediato)
    localStorage.setItem('prestashop-config', JSON.stringify(apiConfig));
    
    // También guardar en Supabase para el cron job
    try {
      const response = await fetch('/api/save-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: 'Default Connection',
          prestashop_url: apiConfig.prestashopUrl,
          api_key: apiConfig.apiKey,
          base_url: apiConfig.baseUrl,
          lang_code: apiConfig.langCode || 1,
          lang_slug: apiConfig.langSlug || 'es',
          is_active: true,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        console.error('Error saving connection to database:', data);
        throw new Error(data.error || 'Error al guardar conexión en la base de datos');
      }
      
      const result = await response.json();
      console.log('Connection saved successfully:', result);
      
      // Mostrar mensaje de éxito
      setSaveStatus({ 
        type: 'success', 
        message: 'Conexión guardada correctamente. El cron job podrá usar esta configuración.' 
      });
    } catch (err) {
      console.error('Error saving connection to database:', err);
      setSaveStatus({ 
        type: 'error', 
        message: err instanceof Error ? err.message : 'Error al guardar conexión en la base de datos para el cron job' 
      });
      // No bloqueamos el flujo, pero mostramos el error
    }
    
    setConfig(apiConfig);
    setError('');
  };

  const handleScan = async () => {
    if (!config) {
      setError('Por favor configura la conexión primero');
      return;
    }

    setConnectionState('scanning');
    setProgress({ current: 0, total: null });
    setError('');
    setProducts([]);

    try {
      // Primero obtener los SKUs existentes en Supabase
      const skusResponse = await fetch('/api/get-existing-skus');
      if (!skusResponse.ok) {
        throw new Error('Error al obtener SKUs existentes de Supabase');
      }
      const skusData = await skusResponse.json();
      const existingSkus = new Set((skusData.skus || []).filter((sku: string) => sku && sku.trim() !== ''));
      
      console.log(`SKUs existentes en Supabase: ${existingSkus.size}`);

      // Escanear todos los productos de PrestaShop
      const fetchedProducts = await fetchAllProducts(config, (current, total) => {
        setProgress({ current, total });
      });

      console.log(`Productos escaneados de PrestaShop: ${fetchedProducts.length}`);

      // Filtrar solo productos nuevos (que no están en Supabase)
      const newProducts = fetchedProducts.filter(product => {
        // Si no tiene SKU, lo consideramos nuevo
        if (!product.sku || product.sku.trim() === '') {
          return true;
        }
        // Si el SKU no existe en Supabase, es nuevo
        const isNew = !existingSkus.has(product.sku.trim());
        return isNew;
      });

      console.log(`Productos nuevos (no en Supabase): ${newProducts.length}`);

      setProducts(newProducts);
      setConnectionState('products-found');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al escanear productos');
      setConnectionState('error');
    }
  };

  const handleSaveToDatabase = async () => {
    if (products.length === 0) {
      setSaveStatus({ type: 'error', message: 'No hay productos para guardar' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/save-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error al guardar productos');
      }

      setSaveStatus({ 
        type: 'success', 
        message: `¡Éxito! Se guardaron ${data.saved} productos en la base de datos.` 
      });
      
      // Limpiar la lista de productos después de guardar
      setProducts([]);
    } catch (error) {
      console.error('Error saving products:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Error desconocido al guardar productos' 
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setConnectionState('no-connection');
    setProducts([]);
    setProgress({ current: 0, total: null });
    setError('');
    setSaveStatus({ type: null, message: '' });
  };

  const handleClearProducts = async () => {
    if (!confirm('¿Estás seguro de que quieres eliminar TODOS los productos de la base de datos? Esta acción no se puede deshacer.')) {
      return;
    }

    setIsClearing(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/clear-products', {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error al eliminar productos');
      }

      setSaveStatus({ 
        type: 'success', 
        message: `Se eliminaron ${data.deleted || 0} productos de la base de datos. ${data.verified ? 'Verificado correctamente.' : 'Verifica en Supabase.'}` 
      });
      
      // Limpiar la lista de productos después de eliminar
      setProducts([]);
    } catch (error) {
      console.error('Error clearing products:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Error desconocido al eliminar productos' 
      });
    } finally {
      setIsClearing(false);
    }
  };

  if (!config) {
    return (
      <div className="w-full">
        <h2 className="text-2xl font-bold text-slate-900 mb-4">Configurar Conexión</h2>
        <p className="text-slate-600 mb-6">
          Configura tu conexión a PrestaShop para escanear productos
        </p>
        <AuthForm onAuthenticate={handleAuthenticate} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Información de la conexión */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Conexión PrestaShop</h2>
            <div className="space-y-1 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-green-500"></span>
                <span>Conectado: {config.prestashopUrl}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
                <span>API Key: {config.apiKey.substring(0, 10)}...</span>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={async () => {
                if (config) {
                  try {
                    await saveExistingConnectionToSupabase(config);
                    setSaveStatus({ 
                      type: 'success', 
                      message: 'Conexión guardada en Supabase correctamente' 
                    });
                  } catch (err) {
                    setSaveStatus({ 
                      type: 'error', 
                      message: err instanceof Error ? err.message : 'Error al guardar conexión' 
                    });
                  }
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition text-sm font-medium"
            >
              Guardar en Supabase
            </button>
            <button
              onClick={() => {
                localStorage.removeItem('prestashop-config');
                setConfig(null);
                handleReset();
              }}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
            >
              Cambiar Conexión
            </button>
          </div>
        </div>
      </div>

      {/* Botones de acción */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleScan}
            disabled={connectionState === 'scanning'}
            className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {connectionState === 'scanning' ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Escaneando...
              </>
            ) : (
              <>
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
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                Escanear Productos
              </>
            )}
          </button>

            <button
              onClick={handleClearProducts}
              disabled={isClearing}
              className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isClearing ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Eliminando...
                </>
              ) : (
                <>
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
                  Limpiar Base de Datos
                </>
              )}
            </button>
            {connectionState === 'products-found' && products.length > 0 && (
            <button
              onClick={handleSaveToDatabase}
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Guardando...
                </>
              ) : (
                <>
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
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Guardar en Base de Datos
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Barra de progreso durante escaneo */}
      {connectionState === 'scanning' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <ProgressBar
            current={progress.current}
            total={progress.total}
            message="Escaneando productos de PrestaShop..."
          />
        </div>
      )}

      {/* Mensaje de estado de guardado */}
      {saveStatus.type && (
        <div className={`rounded-lg p-4 ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{saveStatus.message}</span>
          </div>
        </div>
      )}

      {/* Error */}
      {error && connectionState === 'error' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{error}</span>
            </div>
            <button
              onClick={handleReset}
              className="text-sm underline hover:no-underline"
            >
              Reintentar
            </button>
          </div>
        </div>
      )}

      {/* Información de productos encontrados */}
      {connectionState === 'products-found' && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                Productos Nuevos Encontrados
              </h3>
              <p className="text-sm text-slate-600 mt-1">
                {products.length === 0 
                  ? 'No se encontraron productos nuevos. Todos los productos ya están en la base de datos.'
                  : `Se encontraron ${products.length} producto${products.length !== 1 ? 's' : ''} nuevo${products.length !== 1 ? 's' : ''} para guardar.`
                }
              </p>
            </div>
          </div>
          {products.length > 0 && (
            <div>
              <ProductTable products={products} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}


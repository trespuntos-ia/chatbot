import { useState, useEffect } from 'react';

interface SyncHistoryEntry {
  id: string;
  sync_started_at: string;
  sync_completed_at: string | null;
  status: 'running' | 'completed' | 'failed';
  total_products_scanned: number;
  new_products_found: number;
  products_imported: number;
  errors: Array<{ error: string; sku?: string }>;
  log_messages: Array<{ timestamp: string; message: string; type?: string }>;
  prestashop_connections: {
    id: string;
    name: string;
    prestashop_url: string;
  } | null;
}

export function SyncHistory() {
  const [history, setHistory] = useState<SyncHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<SyncHistoryEntry | null>(null);

  useEffect(() => {
    loadHistory();
    const interval = setInterval(loadHistory, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadHistory = async () => {
    try {
      setError(null);
      setLoading(true);
      const response = await fetch('/api/get-sync-history?limit=50');
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Error ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setHistory(data.history || []);
    } catch (err) {
      console.error('Error loading sync history:', err);
      setError(err instanceof Error ? err.message : 'Error desconocido al cargar el historial');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-ES', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(date);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      running: 'bg-yellow-100 text-yellow-800 border-yellow-200',
      completed: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200'
    };

    const labels = {
      running: 'En Proceso',
      completed: 'Completado',
      failed: 'Fallido'
    };

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status as keyof typeof styles] || styles.running}`}>
        {labels[status as keyof typeof labels] || status}
      </span>
    );
  };

  const getLogIcon = (type?: string) => {
    switch (type) {
      case 'error':
        return '🔴';
      case 'success':
        return '✅';
      case 'info':
      default:
        return 'ℹ️';
    }
  };

  if (loading && history.length === 0) {
    return (
      <div className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-2xl font-bold text-slate-900 mb-2">
            Historial de Actualizaciones
          </h2>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-slate-600">Cargando historial...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
        <div className="flex items-center justify-between">
          <span>{error}</span>
          <button
            onClick={loadHistory}
            className="text-sm underline hover:no-underline"
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">
              Historial de Actualizaciones
            </h2>
            <p className="text-slate-600">
              Registro de todas las sincronizaciones automáticas de productos
            </p>
          </div>
          <button
            onClick={loadHistory}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition text-sm font-medium"
          >
            Actualizar
          </button>
        </div>
      </div>

      {history.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-12 text-center">
          <svg
            className="mx-auto h-16 w-16 text-slate-300 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
            />
          </svg>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            No hay historial de sincronizaciones todavía
          </h3>
          <p className="text-slate-600 mb-4">
            Aún no se ha ejecutado ninguna sincronización automática.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mt-6 text-left max-w-md mx-auto">
            <p className="text-sm text-blue-900 font-medium mb-2">📅 Próxima sincronización automática:</p>
            <p className="text-sm text-blue-700">
              Cada noche a las 23:50 UTC (00:50 hora peninsular española)
            </p>
            <p className="text-xs text-blue-600 mt-3">
              💡 <strong>Tip:</strong> Puedes probar la sincronización manualmente desde el endpoint:
              <br />
              <code className="text-xs bg-blue-100 px-2 py-1 rounded mt-1 inline-block">
                /api/sync-products-cron?manual=true&token=TU_CRON_SECRET
              </code>
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 hover:shadow-md transition"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-3">
                    {getStatusBadge(entry.status)}
                    <span className="text-sm text-slate-600">
                      {formatDate(entry.sync_started_at)}
                    </span>
                    {entry.prestashop_connections && (
                      <span className="text-sm text-slate-500">
                        {entry.prestashop_connections.name}
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Productos Escaneados</div>
                      <div className="text-lg font-semibold text-slate-900">
                        {entry.total_products_scanned.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Productos Nuevos</div>
                      <div className="text-lg font-semibold text-blue-600">
                        {entry.new_products_found.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Importados</div>
                      <div className="text-lg font-semibold text-green-600">
                        {entry.products_imported.toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-slate-500 mb-1">Errores</div>
                      <div className="text-lg font-semibold text-red-600">
                        {entry.errors?.length || 0}
                      </div>
                    </div>
                  </div>

                  {entry.sync_completed_at && (
                    <div className="text-xs text-slate-500">
                      Completado: {formatDate(entry.sync_completed_at)}
                      {entry.sync_started_at && (
                        <span className="ml-2">
                          (Duración: {Math.round(
                            (new Date(entry.sync_completed_at).getTime() - 
                             new Date(entry.sync_started_at).getTime()) / 1000
                          )}s)
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {entry.log_messages && entry.log_messages.length > 0 && (
                  <button
                    onClick={() => setSelectedEntry(selectedEntry?.id === entry.id ? null : entry)}
                    className="ml-4 px-3 py-2 text-sm border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
                  >
                    {selectedEntry?.id === entry.id ? 'Ocultar' : 'Ver'} Detalles
                  </button>
                )}
              </div>

              {selectedEntry?.id === entry.id && entry.log_messages && entry.log_messages.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Log de Sincronización</h4>
                  <div className="bg-slate-50 rounded-lg p-4 max-h-64 overflow-y-auto space-y-2">
                    {entry.log_messages.map((log, idx) => (
                      <div key={idx} className="text-xs font-mono flex items-start gap-2">
                        <span className="text-slate-500 min-w-[100px]">
                          {new Date(log.timestamp).toLocaleTimeString('es-ES')}
                        </span>
                        <span className="mr-2">{getLogIcon(log.type)}</span>
                        <span className={log.type === 'error' ? 'text-red-600' : log.type === 'success' ? 'text-green-600' : 'text-slate-700'}>
                          {log.message}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {entry.errors && entry.errors.length > 0 && (
                <div className="mt-4 pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-red-900 mb-2">Errores</h4>
                  <div className="bg-red-50 rounded-lg p-3 space-y-1">
                    {entry.errors.map((err, idx) => (
                      <div key={idx} className="text-xs text-red-800">
                        {err.sku && <span className="font-semibold">SKU {err.sku}: </span>}
                        {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

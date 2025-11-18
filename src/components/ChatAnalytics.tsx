import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AnalyticsData {
  metrics: {
    totalConversations: number;
    uniqueSessions: number;
    avgResponseTime: number;
    p90ResponseTime?: number;
    fastestResponseTime?: number;
    slowestResponseTime?: number;
    dateRange: {
      start: string;
      end: string;
    };
  };
  openaiUsage?: {
    totalTokens: number;
    avgTokensPerConversation: number;
    conversationsWithTokens: number;
    estimatedCost: number;
    costByModel: Array<{ model: string; tokens: number; cost: number }>;
    tokensByDay: Array<{ date: string; tokens: number }>;
  };
  feedbackStats: {
    total: number;
    helpful: number;
    notHelpful: number;
    helpfulPercentage: number;
  };
  topProducts: Array<{ name: string; count: number; category?: string }>;
  topCategories: Array<{ category: string; count: number }>;
  topQuestions: Array<{ question: string; count: number }>;
  conversationsByDay: Array<{ date: string; count: number }>;
  responseTimesByDay?: Array<{ date: string; avgResponseTime: number; fastestResponseTime: number; slowestResponseTime: number }>;
  recentConversations: Array<any>;
}

export function ChatAnalytics() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [dateRange, setDateRange] = useState<'24h' | '7d' | '30d' | 'all'>('7d');
  const [error, setError] = useState<string>('');
  
  // Estados para el resumen narrativo
  const [summary, setSummary] = useState<string | null>(null);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryGeneratedAt, setSummaryGeneratedAt] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    fetchAnalytics();
    fetchLastSummary();

    const interval = setInterval(() => {
      fetchAnalytics();
    }, 20 * 60 * 1000); // 20 minutos

    return () => clearInterval(interval);
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/get-chat-analytics?dateRange=${dateRange}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
        setLastRefresh(new Date());
      } else {
        setError(result.error || 'Error al cargar analytics');
      }
    } catch (err) {
      setError('Error al conectar con el servidor');
      console.error('Error fetching analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const resetAnalytics = async () => {
    if (resetLoading) return;

    const confirmation = window.prompt('Esta acción eliminará todas las estadísticas y conversaciones guardadas. Escribe BORRAR para confirmar.');

    if (confirmation !== 'BORRAR') {
      alert('Acción cancelada. Debes escribir BORRAR exactamente para eliminar las estadísticas.');
      return;
    }

    setResetLoading(true);
    try {
      const response = await fetch('/api/reset-chat-analytics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirmation })
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result?.error || 'No se pudo eliminar las estadísticas');
      }

      alert('Se borraron todas las estadísticas correctamente.');
      // Refrescar los datos después de borrar (esto mostrará todas las métricas en 0)
      await fetchAnalytics();
      await fetchLastSummary();
      // Limpiar el resumen ya que fue borrado
      setSummary(null);
      setSummaryGeneratedAt(null);
    } catch (error) {
      console.error('Error reseteando analytics:', error);
      alert(error instanceof Error ? error.message : 'Error desconocido al borrar estadísticas.');
    } finally {
      setResetLoading(false);
    }
  };

  const fetchLastSummary = async () => {
    // Obtener último resumen guardado (si existe)
    try {
      const response = await fetch(`/api/get-chat-analytics?dateRange=${dateRange}&includeSummary=true`);
      const result = await response.json();
      if (result.success && result.lastSummary) {
        setSummary(result.lastSummary.summary_text);
        setSummaryGeneratedAt(result.lastSummary.generated_at);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  };

  const generateSummary = async () => {
    setSummaryLoading(true);
    try {
      const response = await fetch('/api/generate-analytics-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dateRange })
      });
      const result = await response.json();
      
      if (result.success) {
        setSummary(result.summary);
        setSummaryGeneratedAt(result.generated_at);
      } else {
        alert('Error al generar resumen: ' + (result.error || 'Error desconocido'));
      }
    } catch (err) {
      alert('Error al conectar con el servidor');
      console.error('Error generating summary:', err);
    } finally {
      setSummaryLoading(false);
    }
  };

  const formatMsToSeconds = (ms?: number) => {
    if (!ms || ms <= 0) {
      return '—';
    }
    return `${(ms / 1000).toFixed(2)}s`;
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
        <p className="mt-4 text-slate-600">Cargando analytics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-800">{error}</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-8 text-center">
        <p className="text-slate-600">No hay datos disponibles</p>
      </div>
    );
  }

  const analytics = data;

  const exportToCSV = () => {
    if (!analytics.recentConversations || analytics.recentConversations.length === 0) {
      alert('No hay conversaciones para exportar');
      return;
    }

    const headers = ['Fecha', 'Usuario', 'Bot', 'Función Llamada', 'Productos Consultados', 'Categoría', 'Tiempo Respuesta (ms)'];
    const rows = analytics.recentConversations.map((conv: any) => {
      const fecha = new Date(conv.created_at).toLocaleString('es-ES');
      const userMessage = (conv.user_message || '').replace(/"/g, '""');
      const botResponse = (conv.bot_response || '').replace(/"/g, '""');
      const functionCalled = conv.function_called || '';
      const products = conv.products_consulted
        ? JSON.stringify(conv.products_consulted).replace(/"/g, '""')
        : '';
      const category = conv.category_consulted || '';
      const responseTime = conv.response_time_ms || '';

      return `"${fecha}","${userMessage}","${botResponse}","${functionCalled}","${products}","${category}","${responseTime}"`;
    });

    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `conversaciones_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const conversationChartData = analytics.conversationsByDay.map(item => ({
    date: new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    count: item.count
  }));

  const responseTimesByDay = analytics.responseTimesByDay || [];
  const responseTimeChartData = responseTimesByDay.map(item => ({
    date: new Date(item.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }),
    avg: Number((item.avgResponseTime / 1000).toFixed(2)),
    fast: Number((item.fastestResponseTime / 1000).toFixed(2)),
    slow: Number((item.slowestResponseTime / 1000).toFixed(2)),
  }));

  const COLORS = ['#4f46e5', '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff', '#faf5ff'];

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-slate-700">Período:</label>
            <select
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as any)}
              className="px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
            >
              <option value="24h">Últimas 24 horas</option>
              <option value="7d">Últimos 7 días</option>
              <option value="30d">Últimos 30 días</option>
              <option value="all">Todo el tiempo</option>
            </select>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-xs text-slate-500">
              Última actualización: {lastRefresh.toLocaleTimeString('es-ES')}
            </span>
            <button
              onClick={resetAnalytics}
              disabled={resetLoading}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              {resetLoading ? 'Borrando...' : 'Borrar todo'}
            </button>
            <button
              onClick={() => {
                fetchAnalytics();
                fetchLastSummary();
                setLastRefresh(new Date());
              }}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm font-medium flex items-center gap-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Total Conversaciones</div>
          <div className="text-3xl font-bold text-slate-900">{analytics.metrics.totalConversations}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Usuarios Únicos</div>
          <div className="text-3xl font-bold text-slate-900">{analytics.metrics.uniqueSessions}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Tiempo Promedio</div>
          <div className="flex items-baseline gap-2">
            <div className="text-3xl font-bold text-slate-900">{formatMsToSeconds(analytics.metrics.avgResponseTime)}</div>
            <span className={analytics.metrics.avgResponseTime <= 3000 ? 'px-2 py-1 text-xs font-semibold bg-emerald-100 text-emerald-700 rounded-full' : 'px-2 py-1 text-xs font-semibold bg-amber-100 text-amber-700 rounded-full'}>
              Objetivo ≤ 3s
            </span>
          </div>
          <div className="text-xs text-slate-500 mt-2">
            {analytics.metrics.avgResponseTime <= 3000
              ? '¡Excelente! Estamos dentro del objetivo.'
              : 'Seguimos optimizando para bajar de los 3 segundos.'}
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Satisfacción</div>
          {analytics.feedbackStats.total > 0 ? (
            <>
              <div className="text-3xl font-bold text-slate-900">{analytics.feedbackStats.helpfulPercentage}%</div>
              <div className="text-xs text-slate-500 mt-1">
                {analytics.feedbackStats.helpful} de {analytics.feedbackStats.total} respuestas útiles
              </div>
            </>
          ) : (
            <div className="text-lg text-slate-400">Sin datos</div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Percentil 90</div>
          <div className="text-2xl font-bold text-slate-900">{formatMsToSeconds(analytics.metrics.p90ResponseTime)}</div>
          <div className="text-xs text-slate-500 mt-1">El 90% de las respuestas fueron más rápidas que este tiempo.</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Respuesta más rápida</div>
          <div className="text-2xl font-bold text-slate-900">{formatMsToSeconds(analytics.metrics.fastestResponseTime)}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Respuesta más lenta</div>
          <div className="text-2xl font-bold text-slate-900">{formatMsToSeconds(analytics.metrics.slowestResponseTime)}</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversaciones por día</h3>
          {conversationChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={conversationChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} allowDecimals={false} />
                <Tooltip formatter={(value) => [`${value} conversaciones`, 'Total']} labelStyle={{ fontSize: 12 }} />
                <Bar dataKey="count" fill="#6366F1" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500">No hay datos suficientes para mostrar el historial.</div>
          )}
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Velocidad de respuesta</h3>
          {responseTimeChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={responseTimeChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" stroke="#475569" fontSize={12} />
                <YAxis stroke="#475569" fontSize={12} unit="s" allowDecimals />
                <Tooltip formatter={(value) => [`${value} s`, '']} labelStyle={{ fontSize: 12 }} />
                <Legend />
                <Line type="monotone" dataKey="avg" stroke="#4F46E5" strokeWidth={2} dot={false} name="Promedio" />
                <Line type="monotone" dataKey="fast" stroke="#22C55E" strokeWidth={1.5} dot={false} name="Más rápida" />
                <Line type="monotone" dataKey="slow" stroke="#EF4444" strokeWidth={1.5} dot={false} name="Más lenta" />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-sm text-slate-500">No hay datos suficientes para mostrar la velocidad de respuesta.</div>
          )}
        </div>
      </div>

      {/* Métricas de Consumo de OpenAI */}
      <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Consumo de OpenAI
        </h3>
        
        {analytics.openaiUsage && analytics.openaiUsage.totalTokens > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-xs font-medium text-slate-600 mb-1">Tokens Totales</div>
                <div className="text-2xl font-bold text-purple-900">
                  {analytics.openaiUsage.totalTokens.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">
                  {analytics.openaiUsage.conversationsWithTokens} conversaciones
                </div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-xs font-medium text-slate-600 mb-1">Promedio por Conversación</div>
                <div className="text-2xl font-bold text-purple-900">
                  {analytics.openaiUsage.avgTokensPerConversation.toLocaleString()}
                </div>
                <div className="text-xs text-slate-500 mt-1">tokens</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-xs font-medium text-slate-600 mb-1">Costo Estimado</div>
                <div className="text-2xl font-bold text-purple-900">
                  ${analytics.openaiUsage.estimatedCost.toFixed(2)}
                </div>
                <div className="text-xs text-slate-500 mt-1">USD</div>
              </div>
              <div className="bg-white rounded-lg p-4 border border-purple-100">
                <div className="text-xs font-medium text-slate-600 mb-1">Costo por Conversación</div>
                <div className="text-2xl font-bold text-purple-900">
                  ${analytics.openaiUsage.conversationsWithTokens > 0 
                    ? (analytics.openaiUsage.estimatedCost / analytics.openaiUsage.conversationsWithTokens).toFixed(4)
                    : '0.0000'}
                </div>
                <div className="text-xs text-slate-500 mt-1">promedio</div>
              </div>
            </div>

            {/* Costo por Modelo */}
            {analytics.openaiUsage.costByModel && analytics.openaiUsage.costByModel.length > 0 && (
              <div className="mb-6">
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Costo por Modelo</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {analytics.openaiUsage.costByModel.map((item, index) => (
                    <div key={index} className="bg-white rounded-lg p-3 border border-purple-100">
                      <div className="text-xs font-medium text-slate-600 mb-1">{item.model}</div>
                      <div className="flex items-baseline justify-between">
                        <div className="text-lg font-bold text-purple-900">${item.cost.toFixed(2)}</div>
                        <div className="text-xs text-slate-500">{item.tokens.toLocaleString()} tokens</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gráfico de Tokens por Día */}
            {analytics.openaiUsage.tokensByDay && analytics.openaiUsage.tokensByDay.length > 0 && (
              <div>
                <h4 className="text-sm font-semibold text-slate-700 mb-3">Tokens por Día</h4>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.openaiUsage.tokensByDay.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value: any) => `${value.toLocaleString()} tokens`} />
                    <Bar dataKey="tokens" fill="#7c3aed" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <div className="bg-white rounded-lg p-6 border border-purple-100 text-center">
            <p className="text-slate-600 mb-2">
              {analytics.openaiUsage ? 'No hay datos de consumo en este período' : 'Cargando datos de consumo...'}
            </p>
            <p className="text-xs text-slate-500">
              Los datos de consumo se mostrarán automáticamente cuando haya conversaciones con tokens registrados.
            </p>
          </div>
        )}
      </div>

      {/* Estadísticas de Satisfacción */}
      {analytics.feedbackStats.total > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Satisfacción del Usuario</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm font-medium text-green-700 mb-1">Respuestas Útiles</div>
              <div className="text-2xl font-bold text-green-900">{analytics.feedbackStats.helpful}</div>
              <div className="text-xs text-green-600 mt-1">
                {analytics.feedbackStats.total > 0 
                  ? Math.round((analytics.feedbackStats.helpful / analytics.feedbackStats.total) * 100) 
                  : 0}% del total
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm font-medium text-red-700 mb-1">No Útiles</div>
              <div className="text-2xl font-bold text-red-900">{analytics.feedbackStats.notHelpful}</div>
              <div className="text-xs text-red-600 mt-1">
                {analytics.feedbackStats.total > 0 
                  ? Math.round((analytics.feedbackStats.notHelpful / analytics.feedbackStats.total) * 100) 
                  : 0}% del total
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm font-medium text-blue-700 mb-1">Total de Feedback</div>
              <div className="text-2xl font-bold text-blue-900">{analytics.feedbackStats.total}</div>
              <div className="text-xs text-blue-600 mt-1">
                de {analytics.metrics.totalConversations} conversaciones
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Resumen Narrativo Generado por OpenAI */}
      <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-xl shadow-sm border border-indigo-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Resumen Ejecutivo</h3>
          <button
            onClick={generateSummary}
            disabled={summaryLoading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
          >
            {summaryLoading ? 'Generando...' : 'Generar Nuevo Resumen'}
          </button>
        </div>
        {summaryGeneratedAt && (
          <p className="text-xs text-slate-500 mb-3">
            Última actualización: {new Date(summaryGeneratedAt).toLocaleString('es-ES')}
          </p>
        )}
        {summary ? (
          <div className="prose prose-sm max-w-none">
            <div className="whitespace-pre-wrap text-slate-700 leading-relaxed">
              {summary}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-slate-600 mb-4">No hay resumen disponible para este período</p>
            <button
              onClick={generateSummary}
              disabled={summaryLoading}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {summaryLoading ? 'Generando...' : 'Generar Resumen'}
            </button>
          </div>
        )}
      </div>

      {/* Gráfico de conversaciones por día (Line Chart) */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversaciones por Día</h3>
        {analytics.conversationsByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={analytics.conversationsByDay.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }))}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="count" stroke="#4f46e5" strokeWidth={2} name="Conversaciones" />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-600 text-center py-8">No hay datos para mostrar</p>
        )}
      </div>

      {/* Gráficos en la misma línea: Top Productos y Distribución por Categorías */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de productos más consultados (Bar Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Top 10 Productos Consultados</h3>
          {analytics.topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={analytics.topProducts.slice(0, 10).map(p => ({ name: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name, consultas: p.count }))}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="consultas" fill="#4f46e5" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-600 text-center py-8">No hay productos consultados</p>
          )}
        </div>

        {/* Gráfico de categorías (Pie Chart) */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Distribución por Categorías</h3>
          {analytics.topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={analytics.topCategories.slice(0, 8)}
                  dataKey="count"
                  nameKey="category"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={(props: any) => {
                    const percent = props.percent || 0;
                    const category = props.category || props.name || '';
                    return `${category}: ${(percent * 100).toFixed(0)}%`;
                  }}
                >
                  {analytics.topCategories.slice(0, 8).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-slate-600 text-center py-8">No hay categorías consultadas</p>
          )}
        </div>
      </div>

      {/* Tabla de Top Productos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Top Productos Consultados</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Producto</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">Consultas</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-slate-200">
              {analytics.topProducts.length > 0 ? (
                analytics.topProducts.map((product, index) => (
                  <tr key={index} className="hover:bg-slate-50">
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-slate-900">{index + 1}</td>
                    <td className="px-4 py-3 text-sm text-slate-900">{product.name}</td>
                    <td className="px-4 py-3 text-sm text-slate-600">{product.category || 'N/A'}</td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm font-semibold text-indigo-600 text-right">{product.count}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-600">No hay productos consultados</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Top Categorías */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Categorías Más Consultadas</h3>
        <div className="space-y-2">
          {analytics.topCategories.length > 0 ? (
            analytics.topCategories.map((cat, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                <div className="font-medium text-slate-900">{cat.category}</div>
                <div className="text-lg font-semibold text-indigo-600">{cat.count}</div>
              </div>
            ))
          ) : (
            <p className="text-slate-600 text-center py-4">No hay categorías consultadas en este período</p>
          )}
        </div>
      </div>

      {/* Preguntas más frecuentes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Preguntas Más Frecuentes</h3>
        <div className="space-y-2">
          {analytics.topQuestions.length > 0 ? (
            analytics.topQuestions.map((q, index) => (
              <div key={index} className="p-3 bg-slate-50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">{q.question}...</div>
                  <div className="text-sm font-semibold text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">
                    {q.count} {q.count === 1 ? 'vez' : 'veces'}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <p className="text-slate-600 text-center py-4">No hay preguntas registradas</p>
          )}
        </div>
      </div>

      {/* Conversaciones recientes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">Conversaciones Recientes</h3>
          <button
            onClick={exportToCSV}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-sm font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Descargar CSV
          </button>
        </div>
        <div className="space-y-4">
          {analytics.recentConversations.length > 0 ? (
            analytics.recentConversations.map((conv, index) => (
              <div key={index} className="border-b border-slate-200 pb-4 last:border-0">
                <div className="text-sm text-slate-500 mb-2">
                  {new Date(conv.created_at).toLocaleString('es-ES')}
                </div>
                <div className="mb-2">
                  <div className="text-xs font-medium text-slate-500 mb-1">Usuario:</div>
                  <div className="text-slate-900">{conv.user_message}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500 mb-1">Bot:</div>
                  <div className="text-slate-700">{conv.bot_response.substring(0, 200)}...</div>
                </div>
                {conv.products_consulted && conv.products_consulted.length > 0 && (
                  <div className="mt-2 text-sm text-indigo-600">
                    📦 {conv.products_consulted.length} producto(s) consultado(s)
                  </div>
                )}
                {conv.feedback_helpful !== null && conv.feedback_helpful !== undefined && (
                  <div className="mt-2 text-sm">
                    {conv.feedback_helpful ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        ✓ Respuesta útil
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        ✗ No útil
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))
          ) : (
            <p className="text-slate-600 text-center py-4">No hay conversaciones recientes</p>
          )}
        </div>
      </div>
    </div>
  );
}


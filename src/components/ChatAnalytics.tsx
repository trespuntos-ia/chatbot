import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface AnalyticsData {
  metrics: {
    totalConversations: number;
    uniqueSessions: number;
    avgResponseTime: number;
    dateRange: {
      start: string;
      end: string;
    };
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

  useEffect(() => {
    fetchAnalytics();
    fetchLastSummary();
    
    // Auto-refresh cada 30 segundos para ver conversaciones nuevas
    const interval = setInterval(() => {
      fetchAnalytics();
      setLastRefresh(new Date());
    }, 30000); // 30 segundos
    
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

  const exportToCSV = () => {
    if (!data || !data.recentConversations || data.recentConversations.length === 0) {
      alert('No hay conversaciones para exportar');
      return;
    }

    // Preparar datos CSV
    const headers = ['Fecha', 'Usuario', 'Bot', 'Función Llamada', 'Productos Consultados', 'Categoría', 'Tiempo Respuesta (ms)'];
    const rows = data.recentConversations.map((conv: any) => {
      const fecha = new Date(conv.created_at).toLocaleString('es-ES');
      const userMessage = (conv.user_message || '').replace(/"/g, '""'); // Escapar comillas
      const botResponse = (conv.bot_response || '').replace(/"/g, '""'); // Escapar comillas
      const functionCalled = conv.function_called || '';
      const products = conv.products_consulted 
        ? JSON.stringify(conv.products_consulted).replace(/"/g, '""')
        : '';
      const category = conv.category_consulted || '';
      const responseTime = conv.response_time_ms || '';
      
      return `"${fecha}","${userMessage}","${botResponse}","${functionCalled}","${products}","${category}","${responseTime}"`;
    });

    // Crear contenido CSV
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    // Crear blob y descargar
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM para Excel
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `conversaciones_${dateRange}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
          <div className="text-3xl font-bold text-slate-900">{data.metrics.totalConversations}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Usuarios Únicos</div>
          <div className="text-3xl font-bold text-slate-900">{data.metrics.uniqueSessions}</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Tiempo Promedio</div>
          <div className="text-3xl font-bold text-slate-900">{data.metrics.avgResponseTime}ms</div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="text-sm font-medium text-slate-600 mb-1">Satisfacción</div>
          {data.feedbackStats.total > 0 ? (
            <>
              <div className="text-3xl font-bold text-slate-900">{data.feedbackStats.helpfulPercentage}%</div>
              <div className="text-xs text-slate-500 mt-1">
                {data.feedbackStats.helpful} de {data.feedbackStats.total} respuestas útiles
              </div>
            </>
          ) : (
            <div className="text-lg text-slate-400">Sin datos</div>
          )}
        </div>
      </div>

      {/* Estadísticas de Satisfacción */}
      {data.feedbackStats.total > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">Satisfacción del Usuario</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg p-4 border border-green-200">
              <div className="text-sm font-medium text-green-700 mb-1">Respuestas Útiles</div>
              <div className="text-2xl font-bold text-green-900">{data.feedbackStats.helpful}</div>
              <div className="text-xs text-green-600 mt-1">
                {data.feedbackStats.total > 0 
                  ? Math.round((data.feedbackStats.helpful / data.feedbackStats.total) * 100) 
                  : 0}% del total
              </div>
            </div>
            <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-lg p-4 border border-red-200">
              <div className="text-sm font-medium text-red-700 mb-1">No Útiles</div>
              <div className="text-2xl font-bold text-red-900">{data.feedbackStats.notHelpful}</div>
              <div className="text-xs text-red-600 mt-1">
                {data.feedbackStats.total > 0 
                  ? Math.round((data.feedbackStats.notHelpful / data.feedbackStats.total) * 100) 
                  : 0}% del total
              </div>
            </div>
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-4 border border-blue-200">
              <div className="text-sm font-medium text-blue-700 mb-1">Total de Feedback</div>
              <div className="text-2xl font-bold text-blue-900">{data.feedbackStats.total}</div>
              <div className="text-xs text-blue-600 mt-1">
                de {data.metrics.totalConversations} conversaciones
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
        {data.conversationsByDay.length > 0 ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data.conversationsByDay.map(d => ({ ...d, date: new Date(d.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }) }))}>
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
          {data.topProducts.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={data.topProducts.slice(0, 10).map(p => ({ name: p.name.length > 30 ? p.name.substring(0, 30) + '...' : p.name, consultas: p.count }))}>
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
          {data.topCategories.length > 0 ? (
            <ResponsiveContainer width="100%" height={400}>
              <PieChart>
                <Pie
                  data={data.topCategories.slice(0, 8)}
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
                  {data.topCategories.slice(0, 8).map((_, index) => (
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
              {data.topProducts.length > 0 ? (
                data.topProducts.map((product, index) => (
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
          {data.topCategories.length > 0 ? (
            data.topCategories.map((cat, index) => (
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
          {data.topQuestions.length > 0 ? (
            data.topQuestions.map((q, index) => (
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
          {data.recentConversations.length > 0 ? (
            data.recentConversations.map((conv, index) => (
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


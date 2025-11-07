# 📊 Propuesta: Panel de Analytics del Chat

## 🎯 Objetivo

Crear un **panel de Analytics** en el Dashboard donde el cliente pueda ver:
- ✅ **Resumen narrativo generado por OpenAI** (texto explicativo de lo que está pasando)
- ✅ **Qué productos se consultan más** (top productos con gráficos)
- ✅ **Qué preguntan los usuarios** (preguntas más frecuentes)
- ✅ **Métricas generales** (total consultas, usuarios únicos, etc.)
- ✅ **Gráficos visuales** (conversaciones por día, productos por categoría, etc.)
- ✅ **Tablas interactivas** (conversaciones recientes, detalles de productos)
- ✅ **Categorías más consultadas**

---

## ⏱️ Estrategia de Actualización

### **Actualización en Tiempo Real vs Periódica**

**Recomendación: Híbrida (Lo mejor de ambos mundos)**

#### **Datos en Tiempo Real (Inmediatos):**
- ✅ **Métricas básicas** (total conversaciones, usuarios únicos)
- ✅ **Conversaciones recientes** (últimas 20)
- ✅ **Top productos/categorías** (basados en datos actuales)
- ✅ **Gráficos** (se actualizan al cargar la página)

#### **Resumen Narrativo (Periódico):**
- 🔄 **Generado cada hora** (o cuando el cliente hace clic en "Actualizar")
- 🔄 **Opcionalmente:** Generar automáticamente cada 24 horas y guardarlo

**Ventajas:**
- ✅ Datos inmediatos (métricas, gráficos, tablas)
- ✅ Resumen inteligente (no se genera en cada consulta, ahorra costos)
- ✅ El cliente puede forzar actualización del resumen cuando quiera
- ✅ Balance entre costos y actualidad

**Implementación:**
- El resumen se genera cuando:
  1. El cliente hace clic en "Generar Resumen" (botón manual)
  2. O automáticamente cada hora (opcional, usando Vercel Cron Jobs)
  3. Se guarda en BD para no regenerarlo constantemente

---

## 🗄️ Paso 1: Base de Datos - Logging de Conversaciones

**Archivo:** `supabase-chat-analytics-schema.sql` (nuevo)

**Tiempo estimado:** 20 minutos

### Tabla: `chat_conversations` (Guardar cada mensaje)

```sql
-- Tabla para guardar todas las conversaciones del chat
CREATE TABLE IF NOT EXISTS chat_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_message TEXT NOT NULL,
  bot_response TEXT NOT NULL,
  function_called TEXT, -- Nombre de la función llamada (si aplica)
  products_consulted JSONB, -- Array de productos consultados en esta interacción
  category_consulted TEXT, -- Categoría consultada (si aplica)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Metadata adicional
  model_used TEXT, -- Modelo de OpenAI usado
  response_time_ms INTEGER, -- Tiempo de respuesta en ms
  tokens_used INTEGER -- Tokens usados (opcional)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_chat_conversations_session_id ON chat_conversations(session_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_at ON chat_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_function_called ON chat_conversations(function_called);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_category ON chat_conversations(category_consulted);

-- Índice GIN para búsqueda en productos consultados
CREATE INDEX IF NOT EXISTS idx_chat_conversations_products ON chat_conversations USING gin(products_consulted);

-- Política RLS
ALTER TABLE chat_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON chat_conversations
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON chat_conversations
  FOR INSERT WITH CHECK (true);
```

### Tabla: `chat_analytics_summaries` (Resúmenes generados por OpenAI)

```sql
-- Tabla para guardar resúmenes narrativos generados por OpenAI
CREATE TABLE IF NOT EXISTS chat_analytics_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_range_start TIMESTAMP WITH TIME ZONE NOT NULL,
  date_range_end TIMESTAMP WITH TIME ZONE NOT NULL,
  summary_text TEXT NOT NULL, -- Resumen narrativo generado por OpenAI
  generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  generated_by TEXT DEFAULT 'manual', -- 'manual' o 'cron'
  
  -- Metadata del resumen
  total_conversations INTEGER,
  unique_sessions INTEGER,
  top_products_summary TEXT, -- Resumen de productos
  top_categories_summary TEXT, -- Resumen de categorías
  insights TEXT, -- Insights adicionales
  recommendations TEXT -- Recomendaciones para el cliente
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_summaries_date ON chat_analytics_summaries(date_range_end DESC);
CREATE INDEX IF NOT EXISTS idx_chat_analytics_summaries_generated ON chat_analytics_summaries(generated_at DESC);
```

### Tabla: `chat_analytics` (Métricas agregadas - opcional para optimización)

```sql
-- Tabla para métricas agregadas (opcional, para optimizar consultas)
CREATE TABLE IF NOT EXISTS chat_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  total_conversations INTEGER DEFAULT 0,
  unique_sessions INTEGER DEFAULT 0,
  total_product_queries INTEGER DEFAULT 0,
  most_consulted_products JSONB, -- Array de {product_name, count}
  most_consulted_categories JSONB, -- Array de {category, count}
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(date)
);

CREATE INDEX IF NOT EXISTS idx_chat_analytics_date ON chat_analytics(date DESC);
```

---

## 🔧 Paso 2: Modificar `api/chat.ts` para Guardar Conversaciones

**Archivo:** `api/chat.ts`

**Tiempo estimado:** 1-2 horas

### 2.1. Añadir función para guardar conversación

Añadir al final del archivo (antes de las funciones de productos):

```typescript
// Función para guardar conversación en analytics
async function saveConversationToAnalytics(
  supabase: any,
  sessionId: string,
  userMessage: string,
  botResponse: string,
  functionCalled?: string,
  productsConsulted?: any[],
  categoryConsulted?: string,
  modelUsed?: string,
  responseTimeMs?: number
) {
  try {
    // Extraer productos consultados si hay función de productos
    let productsData: any[] = [];
    if (productsConsulted && Array.isArray(productsConsulted)) {
      productsData = productsConsulted.map((p: any) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        category: p.category,
        price: p.price
      }));
    }

    // Extraer categoría si hay productos
    let detectedCategory = categoryConsulted;
    if (!detectedCategory && productsData.length > 0) {
      detectedCategory = productsData[0]?.category;
    }

    const { error } = await supabase
      .from('chat_conversations')
      .insert({
        session_id: sessionId || 'default',
        user_message: userMessage,
        bot_response: botResponse,
        function_called: functionCalled || null,
        products_consulted: productsData.length > 0 ? productsData : null,
        category_consulted: detectedCategory || null,
        model_used: modelUsed || 'gpt-3.5-turbo',
        response_time_ms: responseTimeMs || null,
      });

    if (error) {
      console.error('Error guardando conversación en analytics:', error);
      // No fallar si no se puede guardar
    }
  } catch (error) {
    console.error('Error en saveConversationToAnalytics:', error);
    // No fallar si no se puede guardar
  }
}
```

### 2.2. Guardar conversación después de cada respuesta

**En respuestas CON función (después de línea ~765):**

```typescript
// Después de preparar assistantMessage (línea ~749)
// Guardar conversación en analytics
const startTime = Date.now(); // Debe estar al inicio del handler
const responseTime = Date.now() - startTime;

await saveConversationToAnalytics(
  supabase,
  sessionId || 'default',
  message,
  finalMessage,
  functionName,
  functionResult.products || (functionResult.product ? [functionResult.product] : undefined),
  functionArgs.category || functionArgs.subcategory,
  model,
  responseTime
);

// Continuar con el res.json normal...
```

**En respuestas SIN función (después de línea ~769):**

```typescript
// Después de preparar assistantMessage (línea ~773)
const startTime = Date.now(); // Debe estar al inicio del handler
const responseTime = Date.now() - startTime;

await saveConversationToAnalytics(
  supabase,
  sessionId || 'default',
  message,
  response,
  undefined, // No hay función
  undefined, // No hay productos
  undefined, // No hay categoría
  model,
  responseTime
);

// Continuar con el res.json normal...
```

### 2.3. Capturar tiempo de inicio

Añadir al inicio del handler (después de línea 67):

```typescript
const startTime = Date.now(); // Para medir tiempo de respuesta
```

---

## 🔌 Paso 3: Crear API para Analytics

**Archivo:** `api/get-chat-analytics.ts` (nuevo)

**Tiempo estimado:** 2-3 horas

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({
        error: 'Supabase configuration missing'
      });
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Obtener parámetros de query
    const { dateRange = '7d' } = req.query;

    // Calcular fecha de inicio
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (dateRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === 'all') {
      startDate.setFullYear(2020); // Fecha muy antigua para obtener todo
    }

    // 1. Métricas generales
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    // 2. Calcular métricas
    const totalConversations = conversations?.length || 0;
    
    // Sesiones únicas
    const uniqueSessions = new Set(conversations?.map(c => c.session_id) || []).size;
    
    // Productos más consultados
    const productCounts = new Map<string, { name: string; count: number; category?: string }>();
    conversations?.forEach(conv => {
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          const productName = product.name || 'Unknown';
          const current = productCounts.get(productName) || { name: productName, count: 0, category: product.category };
          productCounts.set(productName, { ...current, count: current.count + 1 });
        });
      }
    });
    
    const topProducts = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Categorías más consultadas
    const categoryCounts = new Map<string, number>();
    conversations?.forEach(conv => {
      if (conv.category_consulted) {
        categoryCounts.set(conv.category_consulted, (categoryCounts.get(conv.category_consulted) || 0) + 1);
      }
      // También contar categorías de productos consultados
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          if (product.category) {
            categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
          }
        });
      }
    });
    
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Preguntas más frecuentes (simplificado - primeras palabras)
    const questionCounts = new Map<string, number>();
    conversations?.forEach(conv => {
      const firstWords = conv.user_message.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
      questionCounts.set(firstWords, (questionCounts.get(firstWords) || 0) + 1);
    });
    
    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Conversaciones por día (para gráfico)
    const conversationsByDay = new Map<string, number>();
    conversations?.forEach(conv => {
      const date = new Date(conv.created_at).toISOString().split('T')[0];
      conversationsByDay.set(date, (conversationsByDay.get(date) || 0) + 1);
    });
    
    const conversationsByDayArray = Array.from(conversationsByDay.entries())
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Tiempo promedio de respuesta
    const responseTimes = conversations?.filter(c => c.response_time_ms).map(c => c.response_time_ms) || [];
    const avgResponseTime = responseTimes.length > 0
      ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length)
      : 0;

    res.status(200).json({
      success: true,
      metrics: {
        totalConversations,
        uniqueSessions,
        avgResponseTime,
        dateRange: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        }
      },
      topProducts,
      topCategories,
      topQuestions,
      conversationsByDay: conversationsByDayArray,
      recentConversations: conversations?.slice(0, 20) || [] // Últimas 20 conversaciones
    });

  } catch (error) {
    console.error('Error en get-chat-analytics:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
```

---

## 🔌 Paso 3.5: Crear API para Generar Resumen con OpenAI

**Archivo:** `api/generate-analytics-summary.ts` (nuevo)

**Tiempo estimado:** 1-2 horas

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

export default async function handler(
  req: VercelRequest,
  res: VercelResponse
) {
  // Permitir CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const openaiApiKey = process.env.OPENAI_API_KEY;
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;

    if (!openaiApiKey) {
      res.status(500).json({ error: 'OpenAI API key missing' });
      return;
    }

    if (!supabaseUrl || !supabaseKey) {
      res.status(500).json({ error: 'Supabase configuration missing' });
      return;
    }

    const openai = new OpenAI({ apiKey: openaiApiKey });
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { dateRange = '7d' } = req.body;

    // Calcular fechas
    const endDate = new Date();
    const startDate = new Date();
    
    if (dateRange === '24h') {
      startDate.setHours(startDate.getHours() - 24);
    } else if (dateRange === '7d') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (dateRange === '30d') {
      startDate.setDate(startDate.getDate() - 30);
    } else if (dateRange === 'all') {
      startDate.setFullYear(2020);
    }

    // Obtener conversaciones
    const { data: conversations, error: conversationsError } = await supabase
      .from('chat_conversations')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false });

    if (conversationsError) throw conversationsError;

    // Calcular estadísticas
    const totalConversations = conversations?.length || 0;
    const uniqueSessions = new Set(conversations?.map(c => c.session_id) || []).size;

    // Productos más consultados
    const productCounts = new Map<string, number>();
    conversations?.forEach(conv => {
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          const productName = product.name || 'Unknown';
          productCounts.set(productName, (productCounts.get(productName) || 0) + 1);
        });
      }
    });
    const topProducts = Array.from(productCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Categorías más consultadas
    const categoryCounts = new Map<string, number>();
    conversations?.forEach(conv => {
      if (conv.category_consulted) {
        categoryCounts.set(conv.category_consulted, (categoryCounts.get(conv.category_consulted) || 0) + 1);
      }
      if (conv.products_consulted && Array.isArray(conv.products_consulted)) {
        conv.products_consulted.forEach((product: any) => {
          if (product.category) {
            categoryCounts.set(product.category, (categoryCounts.get(product.category) || 0) + 1);
          }
        });
      }
    });
    const topCategories = Array.from(categoryCounts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Preguntas más frecuentes
    const questionCounts = new Map<string, number>();
    conversations?.forEach(conv => {
      const firstWords = conv.user_message.toLowerCase().split(/\s+/).slice(0, 5).join(' ');
      questionCounts.set(firstWords, (questionCounts.get(firstWords) || 0) + 1);
    });
    const topQuestions = Array.from(questionCounts.entries())
      .map(([question, count]) => ({ question, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Preparar datos para OpenAI
    const analyticsData = {
      periodo: dateRange,
      totalConversaciones: totalConversations,
      usuariosUnicos: uniqueSessions,
      topProductos: topProducts,
      topCategorias: topCategories,
      preguntasFrecuentes: topQuestions,
      muestraConversaciones: conversations?.slice(0, 10).map(c => ({
        pregunta: c.user_message.substring(0, 100),
        respuesta: c.bot_response.substring(0, 100),
        productosConsultados: c.products_consulted?.length || 0
      }))
    };

    // Generar resumen con OpenAI
    const summaryPrompt = `Eres un analista de datos experto. Analiza estos datos de un chatbot de e-commerce y genera un resumen narrativo claro y útil para el propietario del negocio.

DATOS DEL PERÍODO ${dateRange}:
- Total de conversaciones: ${totalConversations}
- Usuarios únicos: ${uniqueSessions}
- Top 10 productos consultados: ${JSON.stringify(topProducts)}
- Top 10 categorías consultadas: ${JSON.stringify(topCategories)}
- Top 5 preguntas frecuentes: ${JSON.stringify(topQuestions)}

Genera un resumen narrativo en español que incluya:
1. **Resumen ejecutivo** (2-3 párrafos): Qué está pasando en general con el chatbot
2. **Productos destacados** (1 párrafo): Qué productos se consultan más y por qué puede ser
3. **Categorías de interés** (1 párrafo): Qué categorías atraen más atención
4. **Insights y patrones** (1-2 párrafos): Patrones de comportamiento detectados
5. **Recomendaciones** (1 párrafo): Acciones recomendadas para mejorar el negocio

El resumen debe ser claro, profesional y útil para tomar decisiones de negocio.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Eres un analista de datos experto que genera resúmenes claros y útiles para propietarios de negocios. Escribe en español de forma profesional.'
        },
        {
          role: 'user',
          content: summaryPrompt
        }
      ],
      temperature: 0.7,
      max_tokens: 1500
    });

    const summaryText = completion.choices[0].message.content || '';

    // Guardar resumen en BD
    const { error: saveError } = await supabase
      .from('chat_analytics_summaries')
      .insert({
        date_range_start: startDate.toISOString(),
        date_range_end: endDate.toISOString(),
        summary_text: summaryText,
        generated_by: 'manual',
        total_conversations: totalConversations,
        unique_sessions: uniqueSessions,
        top_products_summary: JSON.stringify(topProducts),
        top_categories_summary: JSON.stringify(topCategories)
      });

    if (saveError) {
      console.error('Error guardando resumen:', saveError);
    }

    res.status(200).json({
      success: true,
      summary: summaryText,
      generated_at: new Date().toISOString(),
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      }
    });

  } catch (error) {
    console.error('Error generando resumen:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
}
```

---

## 🎨 Paso 4: Instalar Librería de Gráficos

**Tiempo estimado:** 5 minutos

```bash
npm install recharts
```

---

## 🎨 Paso 5: Crear Componente Analytics con Gráficos, Tablas y Resumen Narrativo

**Archivo:** `src/components/ChatAnalytics.tsx` (nuevo)

**Tiempo estimado:** 6-8 horas

```typescript
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

  useEffect(() => {
    fetchAnalytics();
    fetchLastSummary();
  }, [dateRange]);

  const fetchAnalytics = async () => {
    setLoading(true);
    setError('');
    
    try {
      const response = await fetch(`/api/get-chat-analytics?dateRange=${dateRange}`);
      const result = await response.json();
      
      if (result.success) {
        setData(result);
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

  return (
    <div className="space-y-6">
      {/* Filtros */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4">
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
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={data.topCategories.slice(0, 8)}
                dataKey="count"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ category, percent }) => `${category}: ${(percent * 100).toFixed(0)}%`}
              >
                {data.topCategories.slice(0, 8).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={['#4f46e5', '#7c3aed', '#a855f7', '#c084fc', '#d8b4fe', '#e9d5ff', '#f3e8ff', '#faf5ff'][index % 8]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-slate-600 text-center py-8">No hay categorías consultadas</p>
        )}
      </div>

      {/* Preguntas más frecuentes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Preguntas Más Frecuentes</h3>
        <div className="space-y-2">
          {data.topQuestions.map((q, index) => (
            <div key={index} className="p-3 bg-slate-50 rounded-lg">
              <div className="font-medium text-slate-900 mb-1">{q.question}...</div>
              <div className="text-sm text-slate-600">{q.count} veces</div>
            </div>
          ))}
        </div>
      </div>

      {/* Conversaciones recientes */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Conversaciones Recientes</h3>
        <div className="space-y-4">
          {data.recentConversations.map((conv, index) => (
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

---

## 🔗 Paso 5: Integrar Analytics en Dashboard

**Archivo:** `src/components/Dashboard.tsx`

**Tiempo estimado:** 15 minutos

### 5.1. Añadir nuevo tab

```typescript
// Modificar línea 13
type Tab = 'products' | 'connections' | 'chat' | 'prompts' | 'documentation' | 'history' | 'integration' | 'analytics';

// Añadir botón de tab (después de línea 201)
<button
  onClick={() => setActiveTab('analytics')}
  className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
    activeTab === 'analytics'
      ? 'border-indigo-500 text-indigo-600'
      : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
  }`}
>
  <div className="flex items-center gap-2">
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
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
      />
    </svg>
    Analytics
  </div>
</button>

// Añadir contenido del tab (después de línea 248)
{activeTab === 'analytics' && <ChatAnalytics />}

// Importar componente
import { ChatAnalytics } from './ChatAnalytics';
```

---

## ✅ Checklist de Implementación

### Backend:
- [ ] Crear tabla `chat_conversations` en Supabase
- [ ] Modificar `api/chat.ts` para guardar cada conversación
- [ ] Crear API `api/get-chat-analytics.ts`
- [ ] Probar que se guardan las conversaciones

### Frontend:
- [ ] Crear componente `ChatAnalytics.tsx`
- [ ] Añadir tab "Analytics" en `Dashboard.tsx`
- [ ] Probar visualización de datos

### Testing:
- [ ] Probar que se guardan conversaciones correctamente
- [ ] Probar que el API devuelve datos correctos
- [ ] Probar que el panel muestra datos
- [ ] Probar filtros de fecha

---

## 📊 Resultado Final

Después de implementar, el cliente podrá:

1. **Ver métricas generales:**
   - Total de conversaciones
   - Usuarios únicos
   - Tiempo promedio de respuesta

2. **Ver productos más consultados:**
   - Top 10 productos
   - Con contador de consultas
   - Con categoría

3. **Ver categorías más consultadas:**
   - Top 10 categorías
   - Con contador

4. **Ver gráfico temporal:**
   - Conversaciones por día
   - Visualización en barras

5. **Ver preguntas más frecuentes:**
   - Top 10 preguntas
   - Con contador

6. **Ver conversaciones recientes:**
   - Últimas 20 conversaciones
   - Con timestamp
   - Con productos consultados

7. **Filtrar por período:**
   - Últimas 24 horas
   - Últimos 7 días
   - Últimos 30 días
   - Todo el tiempo

---

## ⏱️ Tiempo Total Estimado

- **Backend (BD + API + Logging):** 3-5 horas
- **Frontend (Componente + Integración):** 4-6 horas
- **Testing:** 1-2 horas

**Total: 8-13 horas**

---

## 🚀 Orden de Implementación Recomendado

1. **Paso 1:** Crear tablas en Supabase (30 min)
2. **Paso 2:** Modificar `api/chat.ts` para guardar conversaciones (1-2 horas)
3. **Paso 3:** Crear API `get-chat-analytics.ts` (2-3 horas)
4. **Paso 3.5:** Crear API `generate-analytics-summary.ts` (1-2 horas)
5. **Paso 4:** Instalar recharts (5 min)
6. **Paso 5:** Crear componente `ChatAnalytics.tsx` con gráficos y resumen (6-8 horas)
7. **Paso 6:** Integrar en Dashboard (15 min)
8. **Testing:** Probar todo (1-2 horas)

---

## 📝 Nota sobre Actualización

**Respuesta a tu pregunta: "¿Se actualizará al momento o cuándo?"**

### ✅ **Datos en Tiempo Real (Inmediatos):**
- Métricas (total conversaciones, usuarios únicos)
- Gráficos (conversaciones por día, productos, categorías)
- Tablas (conversaciones recientes, top productos)
- **Se actualizan automáticamente al cargar la página o cambiar el filtro**

### 🔄 **Resumen Narrativo (Bajo Demanda o Periódico):**
- **Opción 1 (Recomendada):** Botón "Generar Resumen" - el cliente hace clic cuando quiere
- **Opción 2:** Automático cada hora (usando Vercel Cron Jobs)
- **Opción 3:** Automático cada 24 horas

**Recomendación:** Empezar con Opción 1 (botón manual) porque:
- ✅ Control del cliente sobre cuándo generar
- ✅ Ahorra costos (no genera en cada consulta)
- ✅ El resumen se guarda en BD, así que se puede mostrar el último generado
- ✅ Más simple de implementar

**Implementación:**
- El componente muestra el último resumen guardado (si existe)
- Botón "Generar Nuevo Resumen" que llama a la API
- Muestra loading mientras se genera
- Una vez generado, se muestra y se guarda para consultas futuras

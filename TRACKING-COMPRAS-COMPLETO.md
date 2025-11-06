# 📊 Tracking de Compras desde el Chat - Documentación Completa

## 🎯 Objetivo

Implementar un sistema completo para trackear las compras que se realizan a través del chat. Cuando el bot recomienda un producto y el usuario hace clic y acaba comprando, el sistema registra esta conversión para poder analizarla en el apartado de **Analytics** del admin.

**Objetivos específicos:**
- Saber qué productos recomendados en el chat resultan en compras
- Medir la efectividad del bot en términos de conversión
- Identificar qué tipos de recomendaciones funcionan mejor
- Calcular el ROI del chatbot

---

## 📋 ÍNDICE

1. [Visión General y Flujo Completo](#1-visión-general-y-flujo-completo)
2. [Implementación por Fases](#2-implementación-por-fases)
3. [Fase 1: Tracking Básico (Recomendaciones + Clics)](#3-fase-1-tracking-básico-recomendaciones--clics) ⭐ **EMPEZAMOS AQUÍ**
4. [Fase 2: Tracking de Compras (Sincronización con PrestaShop)](#4-fase-2-tracking-de-compras-sincronización-con-prestashop)
5. [Ejemplo Práctico Completo](#5-ejemplo-práctico-completo)
6. [Dependencias y Requisitos](#6-dependencias-y-requisitos)
7. [Resumen y Comparación](#7-resumen-y-comparación)

---

## 1. Visión General y Flujo Completo

### Flujo del Sistema

```
1. Bot recomienda producto → Se guarda recomendación con tracking ID único
2. Usuario hace clic en producto → Se registra el evento de clic
3. Usuario navega/compara → Se trackean interacciones intermedias
4. Usuario completa compra → Se vincula la compra con la recomendación del chat
```

### Dónde se Muestra

**📍 Todas las métricas se mostrarán en el apartado de Analytics del panel de administración**

El tracking de productos se integrará como una nueva sección dentro del componente `ChatAnalytics.tsx`, mostrando:

- Métricas principales (cards)
- Gráficos de evolución
- Tablas de productos más recomendados/vendidos
- Funnel de conversión (Fase 2)

---

## 2. Implementación por Fases

### ¿Por qué por Fases?

**Fase 1 (Actual):**
- Implementación más rápida (2-3 días)
- Validación temprana del sistema
- Métricas básicas útiles desde el inicio
- No requiere dependencias externas

**Fase 2 (Futuro):**
- Añade tracking completo de compras
- Requiere sincronización con PrestaShop
- Métricas avanzadas de conversión
- Se implementa después de validar Fase 1

### Plan de Implementación

1. **FASE 1** - Tracking básico (recomendaciones + clics)
2. Validar que funciona correctamente
3. Obtener feedback del cliente
4. **FASE 2** - Tracking de compras (sincronización con PrestaShop)

---

## 3. Fase 1: Tracking Básico (Recomendaciones + Clics) ⭐

### 🎯 Objetivo

Implementar el tracking básico de productos recomendados y clics en los enlaces, mostrando las métricas en el **apartado de Analytics** del panel de administración.

**Lo que trackearemos:**
- ✅ Productos recomendados por el bot
- ✅ Clics en los enlaces de productos
- ✅ Métricas básicas en Analytics

**Lo que NO trackearemos (Fase 2):**
- ❌ Añadidos al carrito
- ❌ Compras completadas

---

### 📊 Qué Veremos en Analytics (Fase 1)

**Métricas Principales:**
- Total de productos recomendados
- Total de clics en productos
- Tasa de clics (clics / recomendaciones)
- Productos más recomendados
- Productos con más clics
- Evolución temporal (gráficos)

**Tablas:**
- Lista de recomendaciones realizadas
- Lista de clics registrados
- Productos más populares

**Estructura en Analytics:**
```
Analytics
├── Métricas Generales del Chat
├── 📊 Tracking de Productos Recomendados (NUEVO - Fase 1)
│   ├── Métricas principales (cards)
│   ├── Gráfico de evolución
│   ├── Top productos recomendados
│   └── Top productos con más clics
└── [Otras secciones de analytics...]
```

---

### 🗄️ Base de Datos - Tablas Necesarias

```sql
-- Tabla para trackear productos recomendados en conversaciones
CREATE TABLE IF NOT EXISTS chat_product_recommendations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  message_id UUID REFERENCES messages(id) ON DELETE SET NULL,
  product_id TEXT NOT NULL, -- ID del producto en la base de datos
  product_sku TEXT,
  product_name TEXT,
  product_url TEXT,
  tracking_token TEXT UNIQUE NOT NULL, -- Token único para tracking (ej: "chat_abc123xyz")
  recommended_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  clicked_at TIMESTAMP WITH TIME ZONE, -- Cuando el usuario hace clic
  session_id TEXT, -- ID de sesión del usuario
  user_id TEXT, -- ID del usuario (si está autenticado)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_product_recommendations_conversation ON chat_product_recommendations(conversation_id);
CREATE INDEX idx_chat_product_recommendations_tracking_token ON chat_product_recommendations(tracking_token);
CREATE INDEX idx_chat_product_recommendations_clicked ON chat_product_recommendations(clicked_at) WHERE clicked_at IS NOT NULL;
CREATE INDEX idx_chat_product_recommendations_session ON chat_product_recommendations(session_id);

-- Tabla para trackear eventos de interacción con productos
CREATE TABLE IF NOT EXISTS chat_product_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recommendation_id UUID REFERENCES chat_product_recommendations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'click', 'view'
  event_data JSONB, -- Datos adicionales del evento (URL, timestamp, etc.)
  session_id TEXT,
  user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_product_events_recommendation ON chat_product_events(recommendation_id);
CREATE INDEX idx_chat_product_events_type ON chat_product_events(event_type);
CREATE INDEX idx_chat_product_events_created ON chat_product_events(created_at);
```

**Nota:** En la Fase 1, los campos `added_to_cart_at`, `purchased_at`, `order_id`, y `order_total` NO se usan todavía (se añadirán en Fase 2).

---

### 🔧 Implementación Técnica - Fase 1

#### 1. Modificar API de Chat para Guardar Recomendaciones

Cuando el bot recomienda productos, guardarlos automáticamente:

```typescript
// En api/chat.ts, después de obtener productos recomendados
async function saveProductRecommendations(
  supabase: any,
  conversationId: string,
  messageId: string,
  products: any[],
  sessionId: string
) {
  const recommendations = [];
  
  for (const product of products) {
    // Generar token único de tracking
    const trackingToken = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Añadir parámetro de tracking a la URL del producto
    const productUrl = new URL(product.product_url);
    productUrl.searchParams.set('chat_ref', trackingToken);
    productUrl.searchParams.set('utm_source', 'chatbot');
    productUrl.searchParams.set('utm_medium', 'chat');
    productUrl.searchParams.set('utm_campaign', 'product_recommendation');
    
    const recommendation = {
      conversation_id: conversationId,
      message_id: messageId,
      product_id: product.id?.toString() || '',
      product_sku: product.sku || '',
      product_name: product.name || '',
      product_url: productUrl.toString(), // URL con parámetros de tracking
      tracking_token: trackingToken,
      session_id: sessionId,
    };
    
    recommendations.push(recommendation);
  }
  
  // Guardar todas las recomendaciones
  const { data, error } = await supabase
    .from('chat_product_recommendations')
    .insert(recommendations)
    .select();
  
  if (error) {
    console.error('Error saving product recommendations:', error);
    return null;
  }
  
  return data;
}
```

**Dónde llamar esta función:**
- En `api/chat.ts`, después de que OpenAI devuelva productos recomendados
- Justo antes de enviar la respuesta al usuario
- Ejemplo: después de `getProductRecommendations()` o `search_products()`

---

#### 2. API para Registrar Clics en Productos

```typescript
// api/track-product-click.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
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
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { tracking_token, session_id, user_id } = req.body;

    if (!tracking_token) {
      return res.status(400).json({
        success: false,
        error: 'Tracking token requerido',
      });
    }

    // Actualizar recomendación con timestamp de clic
    const { data: recommendation, error: updateError } = await supabase
      .from('chat_product_recommendations')
      .update({
        clicked_at: new Date().toISOString(),
        session_id: session_id || null,
        user_id: user_id || null,
      })
      .eq('tracking_token', tracking_token)
      .select()
      .single();

    if (updateError || !recommendation) {
      return res.status(404).json({
        success: false,
        error: 'Recomendación no encontrada',
      });
    }

    // Guardar evento de clic
    await supabase.from('chat_product_events').insert({
      recommendation_id: recommendation.id,
      event_type: 'click',
      session_id: session_id || null,
      user_id: user_id || null,
      event_data: {
        url: recommendation.product_url,
        timestamp: new Date().toISOString(),
      },
    });

    res.status(200).json({
      success: true,
      recommendation_id: recommendation.id,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

---

#### 3. Modificar Componente de Tarjeta de Producto (Frontend)

Añadir tracking cuando el usuario hace clic:

```typescript
// En el componente de tarjeta de producto (donde se muestran los productos del chat)
function ProductCard({ product, trackingToken }: { product: any; trackingToken?: string }) {
  const handleProductClick = async () => {
    if (trackingToken) {
      // Registrar clic (no bloqueante - no esperamos la respuesta)
      fetch('/api/track-product-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tracking_token: trackingToken,
          session_id: getSessionId(), // Función para obtener session ID
        }),
      }).catch(console.error); // Silenciar errores para no afectar UX
    }
    
    // Abrir producto en nueva pestaña
    window.open(product.product_url, '_blank');
  };

  return (
    <div className="product-card">
      {/* ... contenido de la tarjeta ... */}
      <button onClick={handleProductClick}>
        Ver Producto
      </button>
    </div>
  );
}
```

**Importante:** El tracking debe ser asíncrono y no bloqueante. Si falla, no debe afectar la experiencia del usuario.

---

#### 4. API para Obtener Métricas (Analytics)

```typescript
// api/get-product-tracking-stats.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Obtener fecha de inicio (por defecto últimos 30 días)
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // 1. Total de recomendaciones
    const { count: totalRecommendations } = await supabase
      .from('chat_product_recommendations')
      .select('*', { count: 'exact', head: true })
      .gte('recommended_at', startDate.toISOString());

    // 2. Total de clics
    const { count: totalClicks } = await supabase
      .from('chat_product_recommendations')
      .select('*', { count: 'exact', head: true })
      .not('clicked_at', 'is', null)
      .gte('recommended_at', startDate.toISOString());

    // 3. Tasa de clics
    const clickRate = totalRecommendations > 0 
      ? (totalClicks / totalRecommendations * 100).toFixed(2)
      : 0;

    // 4. Productos más recomendados
    const { data: topRecommended } = await supabase
      .from('chat_product_recommendations')
      .select('product_id, product_name, product_sku')
      .gte('recommended_at', startDate.toISOString());

    // Agrupar y contar
    const productCounts = new Map();
    topRecommended?.forEach(rec => {
      const key = rec.product_id || rec.product_sku;
      productCounts.set(key, {
        product_id: rec.product_id,
        product_name: rec.product_name,
        product_sku: rec.product_sku,
        count: (productCounts.get(key)?.count || 0) + 1,
      });
    });

    const topRecommendedProducts = Array.from(productCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 5. Productos con más clics
    const { data: clickedProducts } = await supabase
      .from('chat_product_recommendations')
      .select('product_id, product_name, product_sku')
      .not('clicked_at', 'is', null)
      .gte('recommended_at', startDate.toISOString());

    const clickCounts = new Map();
    clickedProducts?.forEach(rec => {
      const key = rec.product_id || rec.product_sku;
      clickCounts.set(key, {
        product_id: rec.product_id,
        product_name: rec.product_name,
        product_sku: rec.product_sku,
        count: (clickCounts.get(key)?.count || 0) + 1,
      });
    });

    const topClickedProducts = Array.from(clickCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // 6. Evolución temporal (últimos 7 días)
    const { data: dailyStats } = await supabase
      .from('chat_product_recommendations')
      .select('recommended_at, clicked_at')
      .gte('recommended_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

    // Agrupar por día
    const dailyData = new Map();
    dailyStats?.forEach(stat => {
      const date = new Date(stat.recommended_at).toISOString().split('T')[0];
      if (!dailyData.has(date)) {
        dailyData.set(date, { date, recommendations: 0, clicks: 0 });
      }
      dailyData.get(date).recommendations++;
      if (stat.clicked_at) {
        dailyData.get(date).clicks++;
      }
    });

    const dailyEvolution = Array.from(dailyData.values())
      .sort((a, b) => a.date.localeCompare(b.date));

    res.status(200).json({
      success: true,
      stats: {
        total_recommendations: totalRecommendations || 0,
        total_clicks: totalClicks || 0,
        click_rate: parseFloat(clickRate),
        top_recommended_products: topRecommendedProducts,
        top_clicked_products: topClickedProducts,
        daily_evolution: dailyEvolution,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

---

#### 5. Componente React para Analytics

**📍 Este componente se integrará en el apartado de Analytics del Dashboard**

```typescript
// src/components/ProductTrackingAnalytics.tsx
import { useState, useEffect } from 'react';

interface TrackingStats {
  total_recommendations: number;
  total_clicks: number;
  click_rate: number;
  top_recommended_products: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    count: number;
  }>;
  top_clicked_products: Array<{
    product_id: string;
    product_name: string;
    product_sku: string;
    count: number;
  }>;
  daily_evolution: Array<{
    date: string;
    recommendations: number;
    clicks: number;
  }>;
}

export function ProductTrackingAnalytics() {
  const [stats, setStats] = useState<TrackingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  useEffect(() => {
    fetchStats();
  }, [days]);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/get-product-tracking-stats?days=${days}`);
      const data = await response.json();
      if (data.success) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div>Cargando métricas...</div>;
  }

  if (!stats) {
    return <div>No hay datos disponibles</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-6">📊 Tracking de Productos Recomendados</h2>
      <p className="text-sm text-gray-500 mb-6">
        Métricas de productos recomendados por el chatbot y clics realizados por los usuarios
      </p>

      {/* Filtro de días */}
      <div className="mb-4">
        <label className="mr-2">Período:</label>
        <select value={days} onChange={(e) => setDays(Number(e.target.value))}>
          <option value={7}>Últimos 7 días</option>
          <option value={30}>Últimos 30 días</option>
          <option value={90}>Últimos 90 días</option>
        </select>
      </div>

      {/* Métricas principales */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Recomendaciones</h3>
          <p className="text-3xl font-bold">{stats.total_recommendations}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Clics</h3>
          <p className="text-3xl font-bold">{stats.total_clicks}</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-sm text-gray-500">Tasa de Clics</h3>
          <p className="text-3xl font-bold">{stats.click_rate}%</p>
        </div>
      </div>

      {/* Gráfico de evolución */}
      <div className="bg-white p-4 rounded-lg shadow mb-6">
        <h3 className="text-lg font-semibold mb-4">Evolución Diaria</h3>
        {/* Aquí iría un gráfico (Chart.js, Recharts, etc.) */}
        <div className="text-sm text-gray-500">
          {stats.daily_evolution.map(day => (
            <div key={day.date} className="flex justify-between py-2 border-b">
              <span>{day.date}</span>
              <span>Rec: {day.recommendations} | Clics: {day.clicks}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Top productos */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Productos Más Recomendados</h3>
          <ul>
            {stats.top_recommended_products.map((product, index) => (
              <li key={product.product_id} className="py-2 border-b">
                <span className="font-semibold">{index + 1}.</span> {product.product_name} 
                <span className="text-gray-500 ml-2">({product.count} veces)</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Productos con Más Clics</h3>
          <ul>
            {stats.top_clicked_products.map((product, index) => (
              <li key={product.product_id} className="py-2 border-b">
                <span className="font-semibold">{index + 1}.</span> {product.product_name}
                <span className="text-gray-500 ml-2">({product.count} clics)</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
```

**Integración en ChatAnalytics.tsx:**

```typescript
// En src/components/ChatAnalytics.tsx
import { ProductTrackingAnalytics } from './ProductTrackingAnalytics';

// Dentro del componente, añadir una nueva sección:
{/* ... otras secciones ... */}

<ProductTrackingAnalytics />

{/* ... otras secciones ... */}
```

---

### ✅ Checklist de Implementación - Fase 1

- [ ] Crear tablas en Supabase (`chat_product_recommendations` y `chat_product_events`)
- [ ] Modificar `api/chat.ts` para guardar recomendaciones
- [ ] Crear `api/track-product-click.ts`
- [ ] Modificar componente de tarjeta de producto para trackear clics
- [ ] Crear `api/get-product-tracking-stats.ts`
- [ ] Crear componente `ProductTrackingAnalytics.tsx` en el admin
- [ ] Integrar componente en el apartado de Analytics del Dashboard
- [ ] Añadir como nueva sección dentro de `ChatAnalytics.tsx`
- [ ] Probar con recomendaciones reales
- [ ] Verificar que los clics se registran correctamente
- [ ] Validar que las métricas se muestran correctamente

---

## 4. Fase 2: Tracking de Compras (Sincronización con PrestaShop)

### 🎯 Objetivo

Añadir el tracking de compras completadas, sincronizando con la API de PrestaShop para vincular órdenes con recomendaciones.

**Lo que añadiremos:**
- ✅ Detección de compras completadas
- ✅ Vinculación de órdenes con recomendaciones
- ✅ Métricas de conversión (recomendaciones → compras)
- ✅ Ingresos generados por el chat

---

### 📊 Qué Veremos en Analytics (Fase 2)

**Métricas Adicionales:**
- Total de compras completadas
- Tasa de conversión (compras / recomendaciones)
- Ingresos totales generados
- Valor promedio de compra
- Tiempo promedio hasta compra
- Funnel completo: Recomendación → Clic → Carrito → Compra

**Tablas Adicionales:**
- Lista de compras realizadas
- Productos más vendidos
- Conversiones por producto

**Estructura Actualizada en Analytics:**
```
Analytics
├── Métricas Generales del Chat
├── 📊 Tracking de Productos Recomendados (Fase 1 + Fase 2)
│   ├── Métricas principales (cards)
│   │   ├── Recomendaciones ✅
│   │   ├── Clics ✅
│   │   ├── Compras ✅ (NUEVO - Fase 2)
│   │   ├── Tasa de conversión ✅ (NUEVO - Fase 2)
│   │   └── Ingresos generados ✅ (NUEVO - Fase 2)
│   ├── Funnel de conversión ✅ (NUEVO - Fase 2)
│   ├── Gráfico de evolución
│   ├── Top productos recomendados
│   ├── Top productos con más clics
│   └── Top productos vendidos ✅ (NUEVO - Fase 2)
└── [Otras secciones de analytics...]
```

---

### 🗄️ Modificaciones a la Base de Datos

Añadir campos a la tabla existente:

```sql
-- Añadir campos para tracking de compras (si no existen)
ALTER TABLE chat_product_recommendations 
ADD COLUMN IF NOT EXISTS added_to_cart_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS purchased_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS order_id TEXT,
ADD COLUMN IF NOT EXISTS order_total DECIMAL(10, 2);

-- Índice para búsquedas de compras
CREATE INDEX IF NOT EXISTS idx_chat_product_recommendations_purchased 
ON chat_product_recommendations(purchased_at) 
WHERE purchased_at IS NOT NULL;
```

---

### 🔧 Implementación Técnica - Fase 2

#### 1. Cron Job para Sincronizar Compras

```typescript
// api/sync-prestashop-purchases.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_KEY!
    );

    // 1. Obtener recomendaciones pendientes de tracking (sin purchased_at)
    const { data: pendingRecommendations, error: recError } = await supabase
      .from('chat_product_recommendations')
      .select('*')
      .is('purchased_at', null)
      .not('clicked_at', 'is', null); // Solo las que tuvieron clic

    if (recError) throw recError;

    if (!pendingRecommendations || pendingRecommendations.length === 0) {
      return res.status(200).json({ 
        success: true, 
        message: 'No hay recomendaciones pendientes',
        processed: 0 
      });
    }

    // 2. Obtener órdenes nuevas de PrestaShop (últimas 24 horas)
    const prestaShopUrl = process.env.PRESTASHOP_URL;
    const prestaShopApiKey = process.env.PRESTASHOP_API_KEY;
    
    const ordersUrl = `${prestaShopUrl}/api/orders?ws_key=${prestaShopApiKey}&output_format=JSON&date_add=[${getDateFilter()}]`;
    
    const ordersResponse = await fetch(ordersUrl, {
      headers: {
        'Authorization': `Basic ${btoa(prestaShopApiKey + ':')}`,
      },
    });

    if (!ordersResponse.ok) {
      throw new Error(`PrestaShop API error: ${ordersResponse.statusText}`);
    }

    const ordersData = await ordersResponse.json();
    const orders = Array.isArray(ordersData.orders?.order) 
      ? ordersData.orders.order 
      : ordersData.orders?.order 
        ? [ordersData.orders.order] 
        : [];

    let processed = 0;
    let matched = 0;

    // 3. Para cada recomendación pendiente, buscar si hay una orden que coincida
    for (const recommendation of pendingRecommendations) {
      for (const order of orders) {
        // Obtener detalles de la orden
        const orderDetailsUrl = `${prestaShopUrl}/api/orders/${order.id}?ws_key=${prestaShopApiKey}&output_format=JSON`;
        const orderDetailsResponse = await fetch(orderDetailsUrl, {
          headers: {
            'Authorization': `Basic ${btoa(prestaShopApiKey + ':')}`,
          },
        });

        if (!orderDetailsResponse.ok) continue;

        const orderDetails = await orderDetailsResponse.json();
        const orderData = orderDetails.order;

        // Verificar si la orden contiene el producto recomendado
        const orderProducts = orderData.associations?.order_rows?.order_row || [];
        const orderProductsArray = Array.isArray(orderProducts) ? orderProducts : [orderProducts];

        const matchingProduct = orderProductsArray.find((op: any) => {
          const productId = op.product_id?.toString() || op.id_product?.toString();
          const productReference = op.product_reference || '';
          
          return (
            productId === recommendation.product_id ||
            productReference === recommendation.product_sku ||
            op.product_name?.toLowerCase().includes(recommendation.product_name?.toLowerCase() || '')
          );
        });

        if (matchingProduct) {
          // Vincular compra con recomendación
          const orderTotal = parseFloat(orderData.total_paid_tax_incl || orderData.total_paid || '0');
          const orderDate = orderData.date_add || new Date().toISOString();

          const { error: updateError } = await supabase
            .from('chat_product_recommendations')
            .update({
              purchased_at: orderDate,
              order_id: order.id.toString(),
              order_total: orderTotal,
            })
            .eq('id', recommendation.id);

          if (!updateError) {
            await supabase.from('chat_product_events').insert({
              recommendation_id: recommendation.id,
              event_type: 'purchase',
              event_data: {
                order_id: order.id.toString(),
                order_total: orderTotal,
                timestamp: orderDate,
              },
            });

            matched++;
            break;
          }
        }
      }
      processed++;
    }

    res.status(200).json({
      success: true,
      processed,
      matched,
      message: `Procesadas ${processed} recomendaciones, ${matched} compras encontradas`,
    });
  } catch (error) {
    console.error('Error syncing purchases:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

function getDateFilter(): string {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const today = new Date();
  
  const formatDate = (date: Date) => {
    return date.toISOString().replace('T', ' ').substring(0, 19);
  };
  
  return `${formatDate(yesterday)};${formatDate(today)}`;
}
```

---

#### 2. Configurar Cron Job en Vercel

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/sync-prestashop-purchases",
      "schedule": "*/10 * * * *"  // Cada 10 minutos
    }
  ]
}
```

---

#### 3. Actualizar API de Métricas

Añadir métricas de compras a `api/get-product-tracking-stats.ts`:

```typescript
// Añadir estas métricas adicionales:

// Total de compras
const { count: totalPurchases } = await supabase
  .from('chat_product_recommendations')
  .select('*', { count: 'exact', head: true })
  .not('purchased_at', 'is', null)
  .gte('recommended_at', startDate.toISOString());

// Ingresos totales
const { data: purchases } = await supabase
  .from('chat_product_recommendations')
  .select('order_total')
  .not('purchased_at', 'is', null)
  .not('order_total', 'is', null)
  .gte('recommended_at', startDate.toISOString());

const totalRevenue = purchases?.reduce((sum, p) => sum + (parseFloat(p.order_total) || 0), 0) || 0;

// Tasa de conversión
const conversionRate = totalRecommendations > 0
  ? (totalPurchases / totalRecommendations * 100).toFixed(2)
  : 0;
```

---

#### 4. Actualizar Componente de Analytics

Añadir sección de compras y funnel de conversión al componente `ProductTrackingAnalytics.tsx` en el apartado de Analytics.

---

### ✅ Checklist de Implementación - Fase 2

- [ ] Añadir campos de compras a la tabla
- [ ] Crear `api/sync-prestashop-purchases.ts`
- [ ] Configurar cron job en Vercel
- [ ] Actualizar API de métricas con datos de compras
- [ ] Actualizar componente `ProductTrackingAnalytics.tsx` en Analytics
- [ ] Probar sincronización con órdenes reales
- [ ] Validar que las compras se vinculan correctamente
- [ ] Verificar métricas de conversión

---

## 5. Ejemplo Práctico Completo

### Escenario

María está buscando un "abrelatas" en la tienda online. El chatbot le recomienda un producto y ella acaba comprándolo.

---

### PASO 1: Usuario pregunta en el chat

```
María: "¿Tienes abrelatas?"
```

**Qué pasa detrás:**
- El chat API (`api/chat.ts`) recibe el mensaje
- OpenAI busca productos relacionados con "abrelatas"
- Encuentra el producto: "Abrelatas Manual Premium" (ID: 123, SKU: ABR-001)

---

### PASO 2: Bot responde con producto recomendado

```
Bot: "¡Sí! Te recomiendo este abrelatas premium:"
[Mostrar tarjeta con imagen, precio €12.99, botón "Ver Producto"]
```

**Qué pasa detrás:**
1. El sistema genera un **token único de tracking**: `chat_1704123456_abc123xyz`
2. Se guarda en la base de datos:

```sql
INSERT INTO chat_product_recommendations (
  conversation_id: 'conv_789',
  message_id: 'msg_456',
  product_id: '123',
  product_sku: 'ABR-001',
  product_name: 'Abrelatas Manual Premium',
  product_url: 'https://tienda.com/es/123-abrelatas-premium.html?chat_ref=chat_1704123456_abc123xyz&utm_source=chatbot',
  tracking_token: 'chat_1704123456_abc123xyz',
  session_id: 'sess_maria_001',
  recommended_at: '2024-01-01 10:30:00'
);
```

3. La URL del producto se modifica para incluir el tracking:
   - URL original: `https://tienda.com/es/123-abrelatas-premium.html`
   - URL con tracking: `https://tienda.com/es/123-abrelatas-premium.html?chat_ref=chat_1704123456_abc123xyz&utm_source=chatbot`

---

### PASO 3: Usuario hace clic en "Ver Producto"

María hace clic en el botón de la tarjeta del producto.

**Qué pasa detrás:**
1. El componente React detecta el clic y llama a la API:

```typescript
fetch('/api/track-product-click', {
  method: 'POST',
  body: JSON.stringify({
    tracking_token: 'chat_1704123456_abc123xyz',
    session_id: 'sess_maria_001'
  })
});
```

2. La API actualiza la base de datos:

```sql
UPDATE chat_product_recommendations 
SET clicked_at = '2024-01-01 10:31:15'
WHERE tracking_token = 'chat_1704123456_abc123xyz';

INSERT INTO chat_product_events (
  recommendation_id: 'rec_001',
  event_type: 'click',
  event_data: { url: 'https://tienda.com/...', timestamp: '2024-01-01 10:31:15' }
);
```

3. María es redirigida a la página del producto con el parámetro `chat_ref` en la URL

---

### PASO 4: Usuario completa la compra (Fase 2)

María va al checkout, completa el pago y llega a la página de confirmación.

**Qué pasa detrás (Fase 2):**
1. El cron job se ejecuta cada 10 minutos
2. Consulta órdenes nuevas de PrestaShop
3. Encuentra una orden con el producto "Abrelatas Manual Premium"
4. Busca recomendaciones pendientes que coincidan
5. Vincula la compra con la recomendación:

```sql
UPDATE chat_product_recommendations 
SET 
  purchased_at = '2024-01-01 10:42:18',
  order_id = 'ORD-12345',
  order_total = 12.99
WHERE tracking_token = 'chat_1704123456_abc123xyz';
```

---

### RESULTADO FINAL: En el Panel Analytics

El admin puede ver en el apartado de Analytics:

**Métricas (Fase 1):**
- ✅ 1 recomendación realizada
- ✅ 1 clic registrado
- 📊 Tasa de clics: 100%

**Métricas (Fase 2):**
- ✅ 1 compra completada
- 💰 Ingresos: €12.99
- 📊 Tasa de conversión: 100% (1 compra de 1 recomendación)

**Tabla de Compras (Fase 2):**
| Fecha Recomendación | Producto | Fecha Clic | Fecha Compra | Valor | Tiempo hasta Compra |
|---------------------|----------|------------|--------------|-------|---------------------|
| 01/01/2024 10:30:00 | Abrelatas Premium | 01/01/2024 10:31:15 | 01/01/2024 10:42:18 | €12.99 | 12 minutos 18 segundos |

**Funnel de Conversión (Fase 2):**
```
Recomendación (1)
    ↓
Clic (1) - 100%
    ↓
Compra (1) - 100%
```

---

## 6. Dependencias y Requisitos

### Fase 1 - Sin Dependencias Externas

**Lo que necesitamos:**
- ✅ Acceso a Supabase (ya lo tenemos)
- ✅ Modificar `api/chat.ts` (ya existe)
- ✅ Crear nuevas APIs de tracking
- ✅ Crear componente React para Analytics

**Lo que NO necesitamos:**
- ❌ Acceso a PrestaShop
- ❌ Modificar PrestaShop
- ❌ Scripts externos

---

### Fase 2 - Requiere API de PrestaShop

**Lo que necesitamos:**
- ✅ Acceso a API de PrestaShop (ya lo tenemos para productos)
- ✅ Configurar cron job en Vercel
- ✅ Variables de entorno: `PRESTASHOP_URL` y `PRESTASHOP_API_KEY`

**Lo que NO necesitamos:**
- ❌ Modificar PrestaShop
- ❌ Scripts en PrestaShop
- ❌ Webhooks

---

### Ventajas de Usar API de PrestaShop

- ✅ No requiere modificar PrestaShop
- ✅ Funciona con tu API existente
- ✅ Tracking completo de compras
- ✅ No necesitas scripts en PrestaShop
- ✅ Datos precisos de la API

**Desventajas:**
- ⚠️ No es en tiempo real (delay de 5-10 minutos)
- ⚠️ Requiere cron job configurado

---

## 7. Resumen y Comparación

### Fase 1 vs Fase 2

| Aspecto | Fase 1 | Fase 2 |
|---------|--------|--------|
| **Tracking de Recomendaciones** | ✅ | ✅ |
| **Tracking de Clics** | ✅ | ✅ |
| **Tracking de Compras** | ❌ | ✅ |
| **Métricas de Conversión** | ❌ | ✅ |
| **Ingresos Generados** | ❌ | ✅ |
| **Dependencias Externas** | Ninguna | API de PrestaShop |
| **Complejidad** | 🟢 Baja | 🟡 Media |
| **Tiempo Estimado** | 2-3 días | +1-2 días |
| **Ubicación en Admin** | Analytics | Analytics |

---

### 🎯 Plan de Implementación

**FASE 1 (Actual):**
1. Implementar tracking básico
2. Validar que funciona correctamente
3. Mostrar métricas en Analytics
4. Obtener feedback del cliente

**FASE 2 (Futuro):**
1. Una vez validada la Fase 1
2. Implementar sincronización con PrestaShop
3. Añadir métricas de compras
4. Completar el sistema de tracking

---

### 📝 Notas Importantes

- **Fase 1 es independiente**: Puede funcionar perfectamente sin la Fase 2
- **Fase 2 requiere Fase 1**: Necesita las tablas y APIs de la Fase 1
- **No hay prisa**: Podemos validar la Fase 1 antes de implementar la Fase 2
- **Flexibilidad**: Si la Fase 1 funciona bien, podemos esperar para la Fase 2
- **Todo en Analytics**: Todas las métricas se muestran en el apartado de Analytics del admin

---

## 🚀 Empezamos con la Fase 1

**Objetivo inmediato:** Implementar tracking de recomendaciones y clics, mostrando las métricas en el apartado de Analytics del admin.

**Próximos pasos:**
1. Crear las tablas en Supabase
2. Modificar `api/chat.ts` para guardar recomendaciones
3. Crear API de tracking de clics
4. Crear API de métricas
5. Añadir componente a Analytics
6. Probar y validar

**Fase 2 se implementará después de validar que la Fase 1 funciona correctamente.**

---

## 📚 Archivos a Crear/Modificar

### Nuevos Archivos (Fase 1)
- `api/track-product-click.ts`
- `api/get-product-tracking-stats.ts`
- `src/components/ProductTrackingAnalytics.tsx`

### Archivos a Modificar (Fase 1)
- `api/chat.ts` - Añadir función `saveProductRecommendations()`
- `src/components/ChatAnalytics.tsx` - Integrar `ProductTrackingAnalytics`
- Componente de tarjeta de producto (donde se muestran productos) - Añadir tracking de clics

### Nuevos Archivos (Fase 2)
- `api/sync-prestashop-purchases.ts`

### Archivos a Modificar (Fase 2)
- `api/get-product-tracking-stats.ts` - Añadir métricas de compras
- `src/components/ProductTrackingAnalytics.tsx` - Añadir sección de compras
- `vercel.json` - Configurar cron job

---

## ✅ Resumen Final

Este documento contiene toda la información necesaria para implementar el sistema completo de tracking de compras desde el chat, dividido en dos fases:

1. **Fase 1**: Tracking básico (recomendaciones + clics) - **Empezamos aquí**
2. **Fase 2**: Tracking de compras (sincronización con PrestaShop) - **Futuro**

Todo se mostrará en el **apartado de Analytics** del panel de administración.


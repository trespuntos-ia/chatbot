# 📊 PROPUESTA: Sistema de Estadísticas y Analytics para Chatbot

## 🎯 Objetivo
Implementar un sistema completo de estadísticas y analytics tanto para el panel de administración como para el chat, con el objetivo de poder vender e instalar este chatbot en múltiples webs.

---

## 📋 ÍNDICE
1. [Funcionalidades Admin](#1-funcionalidades-admin)
2. [Funcionalidades Chat](#2-funcionalidades-chat)
3. [Estructura de Base de Datos](#3-estructura-de-base-de-datos)
4. [APIs Necesarias](#4-apis-necesarias)
5. [Componentes Frontend](#5-componentes-frontend)
6. [Plan de Implementación](#6-plan-de-implementación)

---

## 1. FUNCIONALIDADES ADMIN

### 1.1 Panel de Nivel de Conocimiento del Bot

**Objetivo**: Mostrar visualmente cómo va evolucionando el conocimiento del bot basado en las conversaciones.

**Métricas a mostrar:**
- **Total de conversaciones** procesadas
- **Tasa de éxito de respuestas** (basado en feedback de usuarios)
- **Nivel de conocimiento** (0-100%): Calculado basado en:
  - Número de preguntas únicas respondidas
  - Tasa de satisfacción promedio
  - Cobertura de temas (categorías de productos consultadas)
  - Resolución de consultas (sin necesidad de escalar a humano)
- **Evolución temporal**: Gráfico de línea mostrando el crecimiento del conocimiento
- **Temas más consultados**: Lista de categorías/temas más frecuentes
- **Áreas de mejora**: Temas con baja satisfacción o sin respuesta

**Visualización:**
- Dashboard con cards de métricas principales
- Gráfico de evolución temporal (últimos 30 días)
- Indicador de progreso visual (barra circular o lineal)
- Lista de temas con nivel de conocimiento

### 1.2 Panel de Preguntas Más Repetidas

**Objetivo**: Identificar las preguntas más frecuentes para mejorar el bot y optimizar respuestas.

**Funcionalidades:**
- **Top 20 preguntas más frecuentes** con:
  - Texto de la pregunta
  - Número de veces formulada
  - Tasa de satisfacción asociada
  - Tiempo promedio de respuesta
  - Categoría/tema asociado
- **Filtros:**
  - Por rango de fechas
  - Por categoría de producto
  - Por nivel de satisfacción
- **Agrupación inteligente**: Agrupar preguntas similares (usando NLP)
- **Exportación**: CSV/JSON de las preguntas
- **Acciones rápidas**:
  - Ver conversaciones relacionadas
  - Marcar como "optimizar respuesta"
  - Añadir a FAQ

**Visualización:**
- Tabla ordenable con ranking
- Gráfico de barras horizontal
- Nube de palabras de las preguntas más comunes
- Filtros y búsqueda

### 1.3 Panel de Conversiones (Respuestas → Compra)

**Objetivo**: Medir la efectividad del bot en términos de conversión a ventas.

**Métricas a mostrar:**
- **Tasa de conversión general**: % de usuarios que compran después de usar el chat
- **Número promedio de respuestas hasta compra**: Distribución de conversaciones que terminan en compra
- **Funnel de conversión**:
  - Usuarios que iniciaron chat
  - Usuarios que recibieron respuesta útil
  - Usuarios que visitaron producto
  - Usuarios que añadieron al carrito
  - Usuarios que completaron compra
- **Productos más consultados antes de compra**
- **Tiempo promedio hasta compra** después de consulta
- **Valor promedio de compra** tras usar el chat

**Funcionalidades:**
- **Configuración manual**: Permitir marcar manualmente conversaciones que resultaron en compra
- **Integración con PrestaShop**: Tracking automático de compras (si es posible)
- **Segmentación**: Análisis por:
  - Categoría de producto
  - Tipo de pregunta
  - Hora del día
  - Día de la semana

**Visualización:**
- Dashboard con métricas principales
- Gráfico de funnel de conversión
- Gráfico de distribución de número de respuestas hasta compra
- Tabla de productos más vendidos tras consulta
- Gráficos de evolución temporal

---

## 2. FUNCIONALIDADES CHAT

### 2.1 Pregunta Final de Utilidad

**Objetivo**: Recopilar feedback de los usuarios sobre la utilidad del bot.

**Implementación:**
- Al finalizar una conversación (después de X mensajes o cuando el usuario cierra el chat), mostrar un popup o mensaje:
  - "¿Te ha resultado útil esta conversación?"
  - Opciones: 👍 Sí / 👎 No / ⚠️ Más o menos
- Si el usuario responde negativamente, opcionalmente pedir:
  - "¿Qué podríamos mejorar?" (campo de texto opcional)
- Guardar el feedback en la base de datos asociado a la conversación

**Casos especiales:**
- No mostrar si el usuario ya cerró el chat anteriormente
- Permitir cerrar sin responder (no forzar)
- Mostrar solo una vez por conversación
- Posibilidad de configurar cuándo mostrar (después de N mensajes)

**Diseño:**
- Popup discreto y no intrusivo
- Botones grandes y fáciles de usar
- Animación suave de entrada
- Posibilidad de minimizar o cerrar

---

## 3. ESTRUCTURA DE BASE DE DATOS

### 3.1 Tabla: `conversations`

```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  user_id TEXT, -- ID del usuario (puede ser anónimo)
  started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ended_at TIMESTAMP WITH TIME ZONE,
  message_count INTEGER DEFAULT 0,
  was_helpful BOOLEAN, -- Feedback del usuario
  feedback_text TEXT, -- Comentario opcional del usuario
  resulted_in_purchase BOOLEAN DEFAULT FALSE, -- Marcado manual o automático
  purchase_value DECIMAL(10,2), -- Valor de la compra si aplica
  purchase_product_ids TEXT[], -- IDs de productos comprados
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conversations_session_id ON conversations(session_id);
CREATE INDEX idx_conversations_started_at ON conversations(started_at);
CREATE INDEX idx_conversations_user_id ON conversations(user_id);
CREATE INDEX idx_conversations_was_helpful ON conversations(was_helpful);
CREATE INDEX idx_conversations_resulted_in_purchase ON conversations(resulted_in_purchase);
```

### 3.2 Tabla: `messages`

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  metadata JSONB, -- Información adicional (productos consultados, funciones llamadas, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation_id ON messages(conversation_id);
CREATE INDEX idx_messages_created_at ON messages(created_at);
CREATE INDEX idx_messages_role ON messages(role);
CREATE INDEX idx_messages_content_fts ON messages USING gin(to_tsvector('spanish', content));
```

### 3.3 Tabla: `questions_analytics`

```sql
CREATE TABLE questions_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  normalized_question TEXT, -- Versión normalizada para agrupar similares
  category TEXT, -- Categoría del producto/tema relacionado
  frequency INTEGER DEFAULT 1,
  avg_satisfaction_score DECIMAL(3,2), -- 0-1 basado en feedback
  avg_response_time_ms INTEGER, -- Tiempo promedio de respuesta en ms
  first_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_questions_normalized ON questions_analytics(normalized_question);
CREATE INDEX idx_questions_category ON questions_analytics(category);
CREATE INDEX idx_questions_frequency ON questions_analytics(frequency DESC);
CREATE INDEX idx_questions_text_fts ON questions_analytics USING gin(to_tsvector('spanish', question_text));
```

### 3.4 Tabla: `bot_knowledge_metrics`

```sql
CREATE TABLE bot_knowledge_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL UNIQUE,
  total_conversations INTEGER DEFAULT 0,
  total_messages INTEGER DEFAULT 0,
  unique_questions_answered INTEGER DEFAULT 0,
  avg_satisfaction_score DECIMAL(3,2) DEFAULT 0,
  knowledge_coverage DECIMAL(5,2) DEFAULT 0, -- % de cobertura de temas
  categories_covered INTEGER DEFAULT 0,
  conversion_rate DECIMAL(5,2) DEFAULT 0, -- % de conversiones
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_knowledge_metrics_date ON bot_knowledge_metrics(date DESC);
```

### 3.5 Tabla: `conversation_products`

```sql
CREATE TABLE conversation_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  product_id TEXT, -- ID o SKU del producto
  product_name TEXT,
  action TEXT, -- 'viewed', 'added_to_cart', 'purchased'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_conv_products_conversation_id ON conversation_products(conversation_id);
CREATE INDEX idx_conv_products_product_id ON conversation_products(product_id);
CREATE INDEX idx_conv_products_action ON conversation_products(action);
```

---

## 4. APIs NECESARIAS

### 4.1 API: `api/conversations.ts`

**Endpoints:**
- `POST /api/conversations` - Crear nueva conversación
- `GET /api/conversations/:id` - Obtener conversación
- `PATCH /api/conversations/:id` - Actualizar conversación (feedback, compra, etc.)
- `GET /api/conversations` - Listar conversaciones (con filtros)

### 4.2 API: `api/messages.ts`

**Endpoints:**
- `POST /api/messages` - Guardar mensaje
- `GET /api/messages?conversation_id=xxx` - Obtener mensajes de una conversación

### 4.3 API: `api/analytics.ts`

**Endpoints:**
- `GET /api/analytics/knowledge` - Obtener métricas de conocimiento
- `GET /api/analytics/questions` - Obtener preguntas más repetidas
- `GET /api/analytics/conversions` - Obtener métricas de conversión
- `GET /api/analytics/dashboard` - Obtener resumen completo del dashboard

### 4.4 API: `api/questions.ts`

**Endpoints:**
- `POST /api/questions/track` - Registrar nueva pregunta
- `GET /api/questions/top` - Obtener top preguntas con filtros

---

## 5. COMPONENTES FRONTEND

### 5.1 Admin - Nuevo Tab: "Analytics"

**Componente: `AnalyticsDashboard.tsx`**

Sub-secciones:
- **KnowledgePanel.tsx** - Panel de conocimiento del bot
- **QuestionsPanel.tsx** - Panel de preguntas más repetidas
- **ConversionsPanel.tsx** - Panel de conversiones

**Estructura:**
```typescript
<Dashboard>
  <Tabs>
    <Tab>Productos</Tab>
    <Tab>Conexiones</Tab>
    <Tab>Configuración AI</Tab>
    <Tab>Analytics</Tab> {/* NUEVO */}
  </Tabs>
  <AnalyticsDashboard>
    <KnowledgePanel />
    <QuestionsPanel />
    <ConversionsPanel />
  </AnalyticsDashboard>
</Dashboard>
```

### 5.2 Chat - Componente de Feedback

**Componente: `FeedbackModal.tsx`**

- Modal que aparece al finalizar conversación
- Botones de feedback (Sí/No/Más o menos)
- Campo opcional de texto
- Integración con el sistema de chat existente

---

## 6. PLAN DE IMPLEMENTACIÓN

### Fase 1: Base de Datos y Backend (Semana 1)

1. ✅ Crear esquema SQL para todas las tablas
2. ✅ Crear APIs básicas:
   - `api/conversations.ts`
   - `api/messages.ts`
   - `api/questions.ts`
3. ✅ Crear función de normalización de preguntas (para agrupar similares)
4. ✅ Implementar tracking automático de preguntas

### Fase 2: Chat - Feedback (Semana 1-2)

1. ✅ Crear componente `FeedbackModal.tsx`
2. ✅ Integrar en el sistema de chat
3. ✅ Conectar con API para guardar feedback
4. ✅ Testing de la funcionalidad

### Fase 3: Admin - Panel de Conocimiento (Semana 2)

1. ✅ Crear API `api/analytics/knowledge.ts`
2. ✅ Crear componente `KnowledgePanel.tsx`
3. ✅ Implementar cálculo de métricas de conocimiento
4. ✅ Crear visualizaciones (gráficos, indicadores)
5. ✅ Integrar en Dashboard

### Fase 4: Admin - Panel de Preguntas (Semana 2-3)

1. ✅ Crear API `api/analytics/questions.ts`
2. ✅ Crear componente `QuestionsPanel.tsx`
3. ✅ Implementar filtros y búsqueda
4. ✅ Implementar agrupación de preguntas similares
5. ✅ Integrar en Dashboard

### Fase 5: Admin - Panel de Conversiones (Semana 3)

1. ✅ Crear API `api/analytics/conversions.ts`
2. ✅ Crear componente `ConversionsPanel.tsx`
3. ✅ Implementar funcionalidad de marcar conversaciones como compra
4. ✅ Crear visualizaciones de funnel
5. ✅ Integrar en Dashboard

### Fase 6: Optimizaciones y Mejoras (Semana 4)

1. ✅ Optimización de queries
2. ✅ Caching de datos de analytics
3. ✅ Exportación de datos (CSV/JSON)
4. ✅ Documentación
5. ✅ Testing completo

---

## 7. CONSIDERACIONES TÉCNICAS

### 7.1 Normalización de Preguntas

Para agrupar preguntas similares, usar:
- Limpieza de texto (lowercase, sin acentos opcionales)
- Similitud semántica (usando embeddings de OpenAI o similar)
- Agrupación por similitud (threshold configurable)

### 7.2 Cálculo de Nivel de Conocimiento

Fórmula propuesta:
```
Knowledge Score = (
  (unique_questions_answered / max_expected_questions) * 0.3 +
  (avg_satisfaction_score) * 0.4 +
  (categories_covered / max_categories) * 0.2 +
  (conversion_rate) * 0.1
) * 100
```

### 7.3 Performance

- Usar índices apropiados en todas las tablas
- Implementar paginación en todas las listas
- Cachear métricas calculadas (actualizar cada hora)
- Usar materialized views para queries complejos si es necesario

### 7.4 Privacidad

- Respetar GDPR si aplica
- Permitir anonimización de datos
- Configuración de retención de datos
- No almacenar información sensible de usuarios

---

## 8. PRÓXIMOS PASOS

1. **Revisar y aprobar esta propuesta**
2. **Crear branch de desarrollo**: `feature/analytics-system`
3. **Empezar con Fase 1**: Crear esquema de BD
4. **Iterar con feedback** durante el desarrollo

---

## 9. NOTAS ADICIONALES

- **Multi-tenancy**: Si el sistema se vende a múltiples clientes, considerar añadir `tenant_id` a todas las tablas
- **Integración con PrestaShop**: Para tracking automático de compras, necesitaríamos webhooks o polling de la API de PrestaShop
- **Configuración**: Permitir configurar qué métricas mostrar y cuáles ocultar
- **Permisos**: Considerar diferentes niveles de acceso (admin completo vs. solo lectura)

---

¿Te parece bien esta propuesta? ¿Quieres que empecemos a implementar alguna parte específica?


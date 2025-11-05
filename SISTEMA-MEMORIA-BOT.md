# 📚 Sistema de Memoria del Bot - Documentación Completa

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [¿Qué es y para qué sirve?](#qué-es-y-para-qué-sirve)
3. [Cómo Funciona](#cómo-funciona)
4. [Flujo Completo Paso a Paso](#flujo-completo-paso-a-paso)
5. [Implementación Técnica](#implementación-técnica)
6. [Base de Datos](#base-de-datos)
7. [APIs](#apis)
8. [Panel de Analytics](#panel-de-analytics)
9. [Consideraciones y Optimizaciones](#consideraciones-y-optimizaciones)
10. [Costos](#costos)

---

## 🎯 Resumen Ejecutivo

El **Sistema de Memoria del Bot** permite que el chatbot "recuerde" información sobre cada usuario/sesión mediante un **documento persistente** que OpenAI lee y actualiza automáticamente en cada interacción. Este documento se acumula con el tiempo y se genera un **resumen estructurado** para que el cliente pueda ver en el panel de Analytics qué está pasando con sus usuarios.

### Características Clave:

- ✅ **Memoria persistente**: El bot recuerda preferencias, productos consultados, patrones de comportamiento
- ✅ **Actualización automática**: El documento se actualiza en cada consulta del usuario
- ✅ **Resumen automático**: Se genera cada 3-5 actualizaciones (sin bloquear la respuesta)
- ✅ **Panel Analytics**: El cliente ve datos inmediatamente, sin espera
- ✅ **Sin intervención manual**: Todo funciona automáticamente

---

## 💡 ¿Qué es y para qué sirve?

### ¿Qué es?

Es un sistema donde **OpenAI mantiene un documento de texto** por cada usuario/sesión que contiene anotaciones sobre:
- Preferencias del usuario (categorías, tipos de productos, rango de precio)
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento (frecuencia, horarios, tipo de cliente)

### ¿Para qué sirve?

1. **Para el Bot**:
   - Personalizar respuestas basadas en interacciones anteriores
   - Recordar preferencias del usuario
   - Mejorar la experiencia del usuario

2. **Para el Cliente (Admin)**:
   - Ver qué buscan los usuarios
   - Entender patrones de comportamiento
   - Obtener insights para mejorar el negocio
   - Detectar oportunidades de venta

### Ejemplo Práctico:

**Día 1:**
- Usuario pregunta: "¿Tienes aceite de oliva ecológico?"
- Documento se actualiza: "Usuario consultó: aceite de oliva ecológico"

**Día 2:**
- Usuario pregunta: "¿Qué precio tiene?"
- Bot lee documento: "Recuerda que consultó aceite de oliva ecológico"
- Bot responde: "El aceite de oliva ecológico que consultaste tiene un precio de..."
- Documento se actualiza: "Usuario consultó: aceite de oliva ecológico. Interesado en precio"

**Cliente en Admin:**
- Ve resumen: "Usuario busca productos ecológicos, prioriza precio, ha consultado aceite de oliva"

---

## 🔄 Cómo Funciona

### Arquitectura General

```
Usuario pregunta
    ↓
API lee documento de memoria (Supabase)
    ↓
OpenAI procesa: Lee documento + Responde + Actualiza documento
    ↓
API guarda documento actualizado (Supabase)
    ↓
API genera resumen automáticamente (cada 3-5 actualizaciones)
    ↓
Cliente abre Analytics → Ve datos ya generados
```

### Componentes Principales

1. **Documento de Memoria**: Texto acumulativo con anotaciones (en Supabase)
2. **Actualización Automática**: Cada vez que el usuario pregunta
3. **Generación de Resumen**: Cada 3-5 actualizaciones (en background)
4. **Panel Analytics**: Muestra resúmenes ya generados

---

## 📝 Flujo Completo Paso a Paso

### PASO 1: Usuario hace una pregunta en el chat

```
Usuario escribe: "¿Tienes aceite de oliva ecológico?"
```

**Dónde:** Frontend - Componente `Chat.tsx`

---

### PASO 2: Frontend envía mensaje a la API

```typescript
POST /api/chat
{
  message: "¿Tienes aceite de oliva ecológico?",
  conversationHistory: [...],
  sessionId: "abc123", // ID único de sesión
  config: {...}
}
```

**Dónde:** `src/services/chatService.ts` → `api/chat.ts`

---

### PASO 3: API lee el documento de memoria actual

```typescript
// api/chat.ts

const { data: memoryDoc } = await supabase
  .from('bot_memory_documents')
  .select('document_content, update_count')
  .eq('session_id', sessionId)
  .single();

// Si no existe, crear uno vacío
if (!memoryDoc) {
  await supabase.from('bot_memory_documents').insert({
    session_id: sessionId,
    document_content: '',
    update_count: 0,
  });
}
```

**Dónde:** API en Vercel consulta Supabase  
**Tabla:** `bot_memory_documents`  
**Qué se obtiene:** Documento de memoria actual (o vacío si es primera vez)

**Cuándo:** En tiempo real, justo antes de llamar a OpenAI

---

### PASO 4: API construye el prompt con memoria

```typescript
// api/chat.ts

const memoryContext = memoryDoc?.document_content 
  ? `\n\n## MEMORIA DEL USUARIO:\n${memoryDoc.document_content}\n\nUsa esta información para personalizar tu respuesta.` 
  : '';

const systemPrompt = processPrompt(activePrompts) + memoryContext;

const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,
  { role: 'user', content: message }
];
```

**Dónde:** API en Vercel, antes de llamar a OpenAI  
**Qué se hace:** Se combina el system prompt + documento de memoria

---

### PASO 5: OpenAI procesa y devuelve respuesta + documento actualizado

```typescript
// api/chat.ts

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,
  response_format: { type: 'json_object' },
  // OpenAI devuelve:
  // {
  //   "response": "Sí, tenemos varios aceites de oliva ecológicos...",
  //   "updated_document": "Usuario interesado en productos ecológicos. Consultó: aceite de oliva ecológico..."
  // }
});

const responseData = JSON.parse(completion.choices[0].message.content);
```

**Dónde:** OpenAI API  
**Qué ocurre:**
- OpenAI lee el documento de memoria
- Procesa la pregunta del usuario
- Genera una respuesta útil
- **Actualiza el documento** añadiendo/modificando anotaciones

**Instrucciones a OpenAI:**
```
"Tienes un documento de memoria. LEE el documento actual, 
procesa la consulta, genera una respuesta, y ACTUALIZA 
el documento con nuevas anotaciones relevantes.

Formato de respuesta JSON:
{
  "response": "Tu respuesta al usuario",
  "updated_document": "Documento actualizado con nuevas anotaciones"
}"
```

---

### PASO 6: API guarda el documento actualizado

```typescript
// api/chat.ts

const updateCount = (memoryDoc?.update_count || 0) + 1;

await supabase
  .from('bot_memory_documents')
  .update({
    document_content: responseData.updated_document,
    update_count: updateCount,
    last_updated_at: new Date().toISOString(),
  })
  .eq('session_id', sessionId);
```

**Dónde:** API en Vercel guarda en Supabase  
**Qué se guarda:**
- Documento actualizado con nuevas anotaciones
- Contador de actualizaciones (para generar resumen cada 3-5)
- Timestamp de última actualización

**Cuándo:** Inmediatamente después de recibir respuesta de OpenAI

---

### PASO 7: API genera resumen automáticamente (cada 3-5 actualizaciones)

```typescript
// api/chat.ts

// Generar resumen solo cada 3-5 actualizaciones (Opción A)
if (updateCount % 3 === 0 || updateCount % 5 === 0) {
  // Generar resumen en background (no bloquea la respuesta)
  generateSummaryInBackground(sessionId, responseData.updated_document, supabase, openai);
}
```

**Dónde:** API en Vercel, después de guardar documento  
**Qué se hace:**
- OpenAI analiza el documento completo
- Genera resumen estructurado en JSON
- Guarda en `bot_memory_documents.summary`

**Cuándo:**
- **Automáticamente**: Cada 3ª o 5ª actualización
- **En background**: No bloquea la respuesta al usuario
- **Sin espera**: El usuario recibe su respuesta inmediatamente

**Estrategia (Opción A):**
- Generar resumen en la **3ª actualización**
- Y luego en la **5ª actualización**
- Y luego cada **5 actualizaciones** (5, 10, 15, 20...)

---

### PASO 8: Usuario recibe respuesta en el chat

```
Bot: "Sí, tenemos varios aceites de oliva ecológicos:
- Aceite de Oliva Virgen Extra Ecológico - 15.99€
- Aceite de Oliva Ecológico Premium - 12.50€
..."
```

**Dónde:** Frontend - Componente `Chat.tsx`

---

### PASO 9: Cliente abre Analytics y ve datos inmediatamente

```
Cliente abre Dashboard → Tab "Analytics" → Ve resúmenes
```

**Dónde:** Frontend - Dashboard → Tab "Analytics" → `MemorySummaryPanel.tsx`

**Qué ocurre:**
1. API lee todos los documentos con sus resúmenes ya generados
2. Los resúmenes **ya están listos** en Supabase
3. Panel muestra datos **inmediatamente** (sin espera)

**Cuándo:** Bajo demanda, cuando el cliente abre el panel

---

## 🛠️ Implementación Técnica

### 1. Modificar `api/chat.ts`

Añadir al inicio del handler (después de obtener el prompt activo):

```typescript
// 1. Obtener o crear documento de memoria
const { data: memoryDoc } = await supabase
  .from('bot_memory_documents')
  .select('document_content, update_count')
  .eq('session_id', sessionId || 'default')
  .single();

let memoryDocument = memoryDoc?.document_content || '';
let updateCount = memoryDoc?.update_count || 0;

// Si no existe, crear uno nuevo
if (!memoryDoc) {
  const { error: insertError } = await supabase
    .from('bot_memory_documents')
    .insert({
      session_id: sessionId || 'default',
      document_content: '',
      update_count: 0,
    });
  if (insertError) console.error('Error creando documento:', insertError);
}

// 2. Construir prompt con memoria
const memoryContext = memoryDocument 
  ? `\n\n## MEMORIA DEL USUARIO:\n${memoryDocument}\n\nUsa esta información para personalizar tu respuesta.` 
  : '';

const systemPrompt = processPrompt(activePrompts) + memoryContext;
```

Después de obtener respuesta de OpenAI (antes de retornar al usuario):

```typescript
// 3. Parsear respuesta de OpenAI
const responseData = JSON.parse(completion.choices[0].message.content || '{}');

// 4. Actualizar contador
updateCount = updateCount + 1;

// 5. Guardar documento actualizado
const { error: updateError } = await supabase
  .from('bot_memory_documents')
  .update({
    document_content: responseData.updated_document || memoryDocument,
    update_count: updateCount,
    last_updated_at: new Date().toISOString(),
  })
  .eq('session_id', sessionId || 'default');

// 6. Generar resumen automáticamente (cada 3-5 actualizaciones)
if (updateCount % 3 === 0 || updateCount % 5 === 0) {
  if (responseData.updated_document && responseData.updated_document.length > 100) {
    generateSummaryInBackground(
      sessionId || 'default',
      responseData.updated_document,
      supabase,
      openai
    );
  }
}

// 7. Retornar respuesta al usuario (sin esperar el resumen)
res.json({
  success: true,
  message: responseData.response,
  document_updated: true,
});
```

### 2. Función para generar resumen en background

```typescript
// api/chat.ts

async function generateSummaryInBackground(
  sessionId: string,
  documentContent: string,
  supabase: any,
  openai: OpenAI
) {
  // Ejecutar en background sin bloquear
  setImmediate(async () => {
    try {
      // Solo generar si el documento tiene suficiente contenido
      if (!documentContent || documentContent.length < 50) {
        return;
      }

      const summaryPrompt = `Analiza este documento de memoria de un chatbot y genera un resumen claro y estructurado para un cliente (administrador) que quiere entender qué está pasando con las conversaciones del bot.

DOCUMENTO DE MEMORIA:
${documentContent}

Genera un resumen en formato JSON con esta estructura:
{
  "resumen_general": "Resumen de 2-3 párrafos sobre las interacciones",
  "preferencias_usuario": ["preferencia1", "preferencia2"],
  "productos_consultados": ["producto1", "producto2"],
  "necesidades_detectadas": "Descripción de necesidades",
  "patrones_comportamiento": "Descripción de patrones (frecuencia, horarios, tipo de cliente)",
  "recomendaciones": "Recomendaciones para mejorar la experiencia o cerrar ventas",
  "estadisticas": {
    "total_consultas": 12,
    "productos_consultados": 8,
    "categorias_exploradas": 3,
    "tiempo_promedio_sesion": "4 minutos",
    "satisfaccion_promedio": "Alta"
  }
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Genera resúmenes claros y útiles en JSON válido.' },
          { role: 'user', content: summaryPrompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      });

      const summary = completion.choices[0].message.content;

      // Guardar resumen en Supabase
      await supabase
        .from('bot_memory_documents')
        .update({ summary })
        .eq('session_id', sessionId);
        
    } catch (error) {
      console.error('Error generando resumen en background:', error);
      // No fallar si el resumen no se puede generar
    }
  });
}
```

### 3. Modificar System Prompt para incluir instrucciones de memoria

En el system prompt (Supabase), añadir:

```
Eres un asistente experto en productos de e-commerce.

Tienes acceso a un documento de memoria que contiene anotaciones sobre las interacciones con este usuario.

INSTRUCCIONES:
1. Lee el documento de memoria actual (si existe)
2. Procesa la consulta del usuario
3. Genera una respuesta útil
4. ACTUALIZA el documento de memoria añadiendo/modificando anotaciones relevantes

FORMATO DE RESPUESTA:
Debes responder SIEMPRE en JSON con esta estructura:
{
  "response": "Tu respuesta al usuario (texto normal)",
  "updated_document": "Documento de memoria actualizado con nuevas anotaciones"
}

Las anotaciones en el documento deben incluir:
- Preferencias del usuario (categorías, tipos de productos, rango de precio)
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento
- Cualquier información relevante para futuras interacciones

Mantén el documento organizado y actualizado. Si es la primera interacción, crea el documento inicial.
```

---

## 🗄️ Base de Datos

### Tabla: `bot_memory_documents`

```sql
CREATE TABLE IF NOT EXISTS bot_memory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  document_content TEXT NOT NULL DEFAULT '', -- Contenido del documento con anotaciones
  summary TEXT, -- Resumen generado para el cliente (JSON)
  update_count INTEGER DEFAULT 0, -- Contador de actualizaciones (para generar resumen cada 3-5)
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX idx_memory_doc_user_id ON bot_memory_documents(user_id);
CREATE INDEX idx_memory_doc_session_id ON bot_memory_documents(session_id);
CREATE INDEX idx_memory_doc_last_updated ON bot_memory_documents(last_updated_at DESC);
CREATE INDEX idx_memory_doc_update_count ON bot_memory_documents(update_count);
```

### Campos Explicados:

- **`document_content`**: Texto acumulativo con anotaciones de OpenAI
- **`summary`**: Resumen estructurado en JSON (generado cada 3-5 actualizaciones)
- **`update_count`**: Contador que incrementa en cada actualización (usado para generar resumen)
- **`session_id`**: ID único de sesión del usuario (generado en frontend)

---

## 🔌 APIs

### 1. API Principal: Chat con Memoria

**Endpoint:** `POST /api/chat`

**Modificaciones necesarias:**
- Leer documento de memoria antes de llamar a OpenAI
- Incluir documento en system prompt
- Guardar documento actualizado después de la respuesta
- Generar resumen cada 3-5 actualizaciones

**Código:** Ver sección "Implementación Técnica"

---

### 2. API: Obtener Todos los Resúmenes

**Endpoint:** `GET /api/get-all-memory-summaries`

**Archivo:** `api/get-all-memory-summaries.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { dateRange, preference, status } = req.query;

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Calcular fecha según filtro
    let dateFilter = new Date();
    if (dateRange === '24h') dateFilter.setHours(dateFilter.getHours() - 24);
    else if (dateRange === '7d') dateFilter.setDate(dateFilter.getDate() - 7);
    else if (dateRange === '30d') dateFilter.setDate(dateFilter.getDate() - 30);

    let query = supabase
      .from('bot_memory_documents')
      .select('*')
      .gte('last_updated_at', dateFilter.toISOString())
      .order('last_updated_at', { ascending: false });

    const { data, error } = await query;

    if (error) throw error;

    // Procesar resúmenes
    const summaries = (data || []).map(doc => ({
      user_id: doc.user_id,
      session_id: doc.session_id,
      summary: doc.summary ? JSON.parse(doc.summary) : null,
      last_updated: doc.last_updated_at,
      has_document: !!doc.document_content,
      update_count: doc.update_count,
      status: getStatus(doc.last_updated_at),
    }));

    // Aplicar filtros adicionales
    let filtered = summaries;
    if (preference) {
      filtered = filtered.filter(s => 
        s.summary?.preferencias_usuario?.some(p => 
          p.toLowerCase().includes(preference.toLowerCase())
        )
      );
    }
    if (status && status !== 'all') {
      filtered = filtered.filter(s => s.status === status);
    }

    res.status(200).json({ success: true, summaries: filtered });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

function getStatus(lastUpdated: string): string {
  const hours = (Date.now() - new Date(lastUpdated).getTime()) / (1000 * 60 * 60);
  if (hours < 24) return 'Activo';
  if (hours < 168) return 'Inactivo'; // 7 días
  return 'Dormido';
}
```

---

## 📊 Panel de Analytics

### Componente: `MemorySummaryPanel.tsx`

**Ubicación:** `src/components/MemorySummaryPanel.tsx`

**Funcionalidades:**
- Mostrar métricas principales (usuarios con memoria, conversaciones totales)
- Listar todos los resúmenes en tabla
- Ver detalle de resumen individual
- Filtros (fecha, preferencia, estado)
- Exportar datos

**Datos que muestra:**
- Resumen general
- Preferencias del usuario
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento
- Recomendaciones
- Estadísticas

**Cuándo se actualiza:**
- **Inmediatamente** cuando se abre (lee datos de Supabase)
- Los resúmenes **ya están generados** (no hay espera)

---

## ⚙️ Consideraciones y Optimizaciones

### 1. Generación de Resumen (Opción A)

**Estrategia:** Cada 3-5 actualizaciones

```typescript
// Generar resumen en la 3ª, 5ª, 10ª, 15ª, 20ª... actualización
if (updateCount % 3 === 0 || updateCount % 5 === 0) {
  generateSummaryInBackground(...);
}
```

**Ventajas:**
- Reduce costos de tokens (no genera en cada consulta)
- Mantiene resúmenes actualizados
- Balance entre frecuencia y costo

### 2. Tamaño del Documento

- **Límite recomendado:** ~5000 caracteres
- **Si crece mucho:** Hacer resumen periódico y "resetear" el documento
- **Optimización:** Si el documento es muy largo, hacer resumen y empezar uno nuevo

### 3. Session ID

**Generación en Frontend:**

```typescript
// src/components/Chat.tsx

useEffect(() => {
  // Generar o recuperar session_id
  let sessionId = localStorage.getItem('chat_session_id');
  if (!sessionId) {
    sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chat_session_id', sessionId);
  }
  setSessionId(sessionId);
}, []);
```

**Enviar en cada llamada:**

```typescript
const response = await sendChatMessage(
  message,
  conversationHistory,
  config,
  sessionId // Añadir sessionId
);
```

### 4. Manejo de Errores

- Si falla la generación del resumen: No afectar la respuesta al usuario
- Si falla la actualización del documento: Loggear error pero continuar
- Si no hay documento: Crear uno nuevo automáticamente

### 5. Privacidad (GDPR)

- Permitir borrar documento de memoria de un usuario
- Anonimizar datos si es necesario
- Opción de desactivar memoria por usuario

---

## 💰 Costos

### Tokens por Consulta:

1. **Actualizar documento**: ~500-1000 tokens extra
   - Leer documento actual: ~200-500 tokens
   - Actualizar documento: ~300-500 tokens

2. **Generar resumen**: ~1000-2000 tokens cada vez
   - Analizar documento completo: ~500-1000 tokens
   - Generar resumen estructurado: ~500-1000 tokens
   - **Frecuencia**: Cada 3-5 actualizaciones (no cada consulta)

### Costo Estimado (gpt-4o-mini):

- **Por consulta (actualizar documento)**: ~$0.0001-0.0002
- **Por resumen (cada 3-5 consultas)**: ~$0.0001-0.0002
- **Costo total por 100 consultas**: ~$0.01-0.02

### Optimizaciones de Costo:

- Usar `gpt-4o-mini` (más barato que GPT-4)
- Generar resumen solo cada 3-5 actualizaciones
- Limitar tamaño del documento (~5000 caracteres)
- Hacer resumen periódico y "resetear" documento si crece mucho

---

## ✅ Checklist de Implementación

### Backend:

- [ ] Crear tabla `bot_memory_documents` en Supabase
- [ ] Modificar `api/chat.ts` para leer documento de memoria
- [ ] Modificar `api/chat.ts` para guardar documento actualizado
- [ ] Añadir función `generateSummaryInBackground` en `api/chat.ts`
- [ ] Implementar lógica de generación cada 3-5 actualizaciones
- [ ] Crear API `api/get-all-memory-summaries.ts`
- [ ] Actualizar system prompt para incluir instrucciones de memoria

### Frontend:

- [ ] Generar y guardar `session_id` en localStorage
- [ ] Enviar `session_id` en cada llamada al chat
- [ ] Añadir tab "Analytics" en Dashboard
- [ ] Crear componente `MemorySummaryPanel.tsx`
- [ ] Implementar tabla de resúmenes
- [ ] Implementar modal de detalle de resumen
- [ ] Añadir filtros y búsqueda
- [ ] Añadir gráficos y visualizaciones

### Testing:

- [ ] Probar que el documento se actualiza en cada consulta
- [ ] Probar que el resumen se genera cada 3-5 actualizaciones
- [ ] Probar que el panel muestra datos inmediatamente
- [ ] Probar con múltiples sesiones
- [ ] Probar con documentos largos

---

## 📚 Referencias

- Documento principal: `PROPUESTA-MEJORAS-BOT-ADMIN.md`
- Schema SQL: Ver sección "Base de Datos" arriba
- APIs: Ver sección "APIs" arriba
- Panel Analytics: Ver sección "Panel de Analytics" arriba

---

**Última actualización:** 2024-01-15  
**Versión:** 1.0  
**Opción de generación:** A (cada 3-5 actualizaciones)



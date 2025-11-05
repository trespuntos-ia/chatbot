# 🚀 PROPUESTA: Mejoras para Chatbot y Panel de Administración

## 🎯 Objetivo
Definir funcionalidades para mejorar tanto la experiencia del usuario en el chat como las capacidades del panel de administración, con el objetivo de crear un producto comercializable para instalar en múltiples webs.

---

## 📋 ÍNDICE
1. [Mejoras del Chatbot](#1-mejoras-del-chatbot)
2. [Mejoras del Panel Admin](#2-mejoras-del-panel-admin)
3. [Lista de Funcionalidades con Dificultad](#3-lista-de-funcionalidades-con-dificultad)

---

## 1. MEJORAS DEL CHATBOT

### 🎨 Enfoque Principal: Mejora en la Presentación de Respuestas

El objetivo es hacer que las respuestas del bot sean más visuales, interactivas y útiles, especialmente cuando se trata de mostrar productos.

---

### 1.1 Tarjetas de Productos en Respuestas

**Descripción:**
Cuando el bot encuentra un producto que el usuario está buscando, en lugar de solo mostrar texto, mostrar una tarjeta visual atractiva con:

- **Imagen del producto** (thumbnail)
- **Nombre del producto**
- **Precio** destacado
- **Descripción corta** (primeras 2-3 líneas)
- **Botón "Ver Producto"** que lleva al link de compra
- **Botón "Añadir al Carrito"** - Añade directamente al carrito de PrestaShop
- **Botón "Comprar Ahora"** (opcional, directo al checkout si es posible)
- **SKU** (opcional, en texto pequeño)

**Opciones de Interacción:**
- **Opción A (Recomendada)**: Click en botón "Añadir al Carrito" → Añade al carrito
- **Opción B (Avanzada)**: Click en toda la tarjeta → Añade al carrito (con confirmación)
- **Opción C (Híbrida)**: Click en tarjeta → Ver detalles, Botón específico → Añadir al carrito

**Casos de uso:**
- Usuario pregunta: "¿Tienes aceite de oliva?"
- Usuario pregunta: "Muéstrame productos de cocina"
- Usuario pregunta: "¿Cuál es el precio del producto ABC123?"

**Ejemplo de respuesta:**
```
Bot: "¡Sí! Encontré estos productos que pueden interesarte:"

[Mostrar 1-3 tarjetas de productos en grid horizontal]

"¿Te gustaría saber más sobre algún producto en particular?"
```

**Ventajas:**
- Mejora significativamente la experiencia visual
- Facilita la conversión (botones directos)
- Hace el chat más profesional y moderno
- Reduce fricción para llegar al producto
- **Añadir al carrito directamente aumenta conversión significativamente**

---

### 1.1.1 Añadir al Carrito desde Tarjeta (NUEVA FUNCIONALIDAD)

**Descripción:**
Permitir añadir productos al carrito de PrestaShop directamente desde las tarjetas del chat, sin salir de la conversación.

**¿Es buena funcionalidad?** 
✅ **SÍ, muy buena** - Aumenta significativamente la conversión porque:
- Reduce fricción (no tiene que buscar el producto manualmente)
- Impulso de compra (el usuario está en "modo compra" cuando consulta)
- Experiencia fluida (todo desde el chat)
- Reduce abandono de carrito

**⚠️ Consideraciones de UX:**
- **NO hacer click en toda la tarjeta** = añadir al carrito (riesgo de añadir accidentalmente)
- **SÍ hacer botón específico** "Añadir al Carrito" (más seguro)
- Mostrar confirmación visual después de añadir ("✓ Añadido al carrito")
- Opción de "Ver carrito" o continuar navegando

**Requisitos Técnicos:**

1. **API de PrestaShop para añadir al carrito:**
   - PrestaShop tiene API REST pero añadir al carrito requiere:
     - **Opción 1 (Recomendada)**: Usar el endpoint de PrestaShop vía AJAX
       - Endpoint: `POST /index.php?controller=cart&action=add`
       - Parámetros: `id_product`, `id_product_attribute`, `qty`, `token` (CSRF)
     - **Opción 2**: Usar la API REST de PrestaShop (si está disponible en la versión)
       - Requiere autenticación y manejo de sesiones
     - **Opción 3**: Integración con JavaScript nativo de PrestaShop
       - Si el chat está embebido en la web, puede usar el JavaScript de PrestaShop

2. **Manejo de Sesión:**
   - PrestaShop usa sesiones PHP/cookies para identificar el carrito
   - Necesitamos mantener la sesión del usuario
   - Si el chat está en iframe o widget, necesitamos compartir cookies

3. **Frontend (Componente React/JS):**
   ```typescript
   // Función para añadir al carrito
   async function addToCart(productId: number, quantity: number = 1) {
     try {
       // Opción 1: Usar endpoint de PrestaShop
       const response = await fetch(
         `${prestashopUrl}/index.php?controller=cart&action=add&ajax=1`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
           },
           credentials: 'include', // Importante para cookies
           body: new URLSearchParams({
             id_product: productId.toString(),
             qty: quantity.toString(),
             token: csrfToken, // Necesario para seguridad
           }),
         }
       );
       
       if (response.ok) {
         // Mostrar confirmación
         showNotification('✓ Producto añadido al carrito');
         // Opcional: Actualizar contador de carrito si está visible
       }
     } catch (error) {
       showError('Error al añadir al carrito');
     }
   }
   ```

4. **Backend (API Proxy - Opcional pero recomendado):**
   - Crear endpoint en tu backend: `POST /api/cart/add`
   - El backend hace la llamada a PrestaShop
   - Maneja autenticación y tokens CSRF
   - Retorna respuesta estructurada

5. **Token CSRF:**
   - PrestaShop requiere token CSRF para seguridad
   - Necesitamos obtenerlo del frontend o generarlo
   - Se puede obtener del HTML de la página o vía API

6. **Variables/Atributos del Producto:**
   - Si el producto tiene variantes (tallas, colores), necesitamos:
     - `id_product_attribute` además de `id_product`
     - Mostrar selector de variantes antes de añadir

**Implementación Sugerida:**

**Fase 1 - Básico:**
- Botón "Añadir al Carrito" en cada tarjeta
- Click → Añade producto (cantidad 1)
- Muestra confirmación visual
- Si hay error, muestra mensaje

**Fase 2 - Avanzado:**
- Selector de cantidad antes de añadir
- Manejo de variantes (tallas, colores)
- Actualización en tiempo real del contador del carrito
- Botón "Ver Carrito" después de añadir

**Fase 3 - Premium:**
- Añadir múltiples productos a la vez
- Sugerencias de productos relacionados después de añadir
- "¿Añadir también...?" después de añadir un producto

**Dificultad:** 🟡 **Media-Alta**
- Requiere integración con PrestaShop (API o endpoints)
- Manejo de sesiones/cookies
- Tokens CSRF
- Manejo de errores robusto

**Valor:** 🔥🔥🔥🔥🔥 **Muy Alto**
- Aumenta conversión significativamente
- Diferenciador clave vs otros chatbots
- Experiencia de usuario premium

**Alternativa si es muy complejo:**
- En lugar de añadir directamente, usar link especial:
  - `https://tienda.com/producto?id_product=123&add=1`
  - Esto añade al carrito y redirige (más simple pero menos fluido)

---

### 1.2 Respuestas con Múltiples Productos (Grid)

**Descripción:**
Cuando hay múltiples productos que coinciden, mostrarlos en un grid de tarjetas (2-3 columnas según el tamaño de pantalla).

**Características:**
- Máximo 6 productos mostrados inicialmente
- Botón "Ver más productos" si hay más resultados
- Scroll horizontal en móvil
- Grid responsive (2 columnas en móvil, 3 en desktop)

---

### 1.3 Comparación de Productos

**Descripción:**
Si el usuario pregunta por comparaciones ("¿Cuál es mejor entre X e Y?"), mostrar tarjetas lado a lado para comparar.

**Ejemplo:**
```
Usuario: "¿Qué diferencia hay entre el aceite de oliva virgen extra y el normal?"

Bot: [Mostrar 2 tarjetas lado a lado con información comparativa]
```

---

### 1.4 Respuestas con Imágenes Contextuales

**Descripción:**
No solo productos, sino también:
- Imágenes de categorías cuando se habla de ellas
- Diagramas o infografías cuando se explica algo complejo
- GIFs animados para instrucciones paso a paso

---

### 1.5 Botones de Acción Rápida

**Descripción:**
Después de mostrar un producto, ofrecer botones de acción rápida:
- "Ver detalles completos"
- "Añadir al carrito"
- "Comparar con otros"
- "¿Tienes más preguntas?"

Esto hace el chat más interactivo y reduce la necesidad de escribir.

---

### 1.6 Feedback de Utilidad

**Descripción:**
Al finalizar una conversación (después de X mensajes o cuando el usuario cierra el chat), mostrar un popup discreto:

**Pregunta:** "¿Te ha resultado útil esta conversación?"
**Opciones:**
- 👍 Sí
- 👎 No  
- ⚠️ Más o menos

Si responde negativamente, opcionalmente pedir:
- "¿Qué podríamos mejorar?" (campo de texto opcional)

**Características:**
- No intrusivo (se puede cerrar sin responder)
- Solo se muestra una vez por conversación
- Guarda el feedback en la base de datos para estadísticas

---

### 1.7 Respuestas con Formato Enriquecido

**Descripción:**
Mejorar el formato de las respuestas de texto:
- **Negrita** para destacar información importante
- Listas numeradas o con viñetas
- Código formateado para SKUs, precios, etc.
- Emojis contextuales (💰 para precios, 📦 para productos, etc.)

---

### 1.8 Indicador de "Escribiendo..."

**Descripción:**
Mostrar un indicador visual cuando el bot está procesando la respuesta (especialmente útil si tarda unos segundos).

**Animación:**
- Puntos animados "..." o
- Indicador de "Pensando..." con animación

---

### 1.9 Sugerencias de Preguntas

**Descripción:**
Después de una respuesta, mostrar sugerencias de preguntas relacionadas como botones clickeables:

**Ejemplo:**
```
Bot: "Encontré 5 productos de aceite de oliva. ¿Te gustaría ver más detalles?"

[Botones sugeridos:]
- "¿Cuál es el más barato?"
- "Muéstrame el más vendido"
- "¿Tienes descuentos?"
```

---

### 1.10 Historial de Conversación Visible

**Descripción:**
Mostrar un pequeño historial de la conversación actual (últimos 3-5 mensajes) con posibilidad de:
- Hacer clic en un mensaje anterior para ver el contexto
- Copiar mensajes
- Reenviar una pregunta

---

## 2. MEJORAS DEL BACKEND

### 2.0 Sistema de Memoria del Bot (Documento Persistente con Anotaciones)

**Descripción:**
Implementar un sistema donde OpenAI mantiene un documento persistente por usuario/sesión que va leyendo y actualizando con anotaciones en cada interacción. Este documento acumula toda la información y luego se genera un resumen para mostrar al cliente en el admin.

**¿Es buena funcionalidad?**
✅ **EXCELENTE idea** - Simple y efectivo porque:
- **Documento único**: Un solo documento por usuario que se va acumulando
- **Anotaciones automáticas**: OpenAI decide qué añadir/modificar
- **Resumen para cliente**: Finalmente generar un resumen legible para el admin
- **Memoria persistente**: El bot "recuerda" todo lo importante
- **Sin complejidad**: No necesita procesamiento asíncrono complejo

**Cómo funciona:**

1. **Documento inicial**: Crear un documento vacío por usuario/sesión en Supabase
2. **En cada consulta**:
   - OpenAI lee el documento actual
   - Procesa la nueva consulta del usuario
   - Añade/modifica anotaciones en el documento
   - Guarda el documento actualizado
3. **Acumulación**: El documento va creciendo con el tiempo
4. **Resumen para cliente**: Generar un resumen del documento para mostrar en el admin

**Casos de uso:**
- Usuario pregunta sobre productos → OpenAI anota preferencias
- Usuario vuelve días después → OpenAI lee el documento y "recuerda"
- Cliente quiere ver qué pasa → Admin ve un resumen del documento
- Detectar patrones → El documento acumula información que permite análisis

**Estructura del Resumen:**

El resumen incluye:
- **Preferencias**: Categorías de interés, tipo de productos, rango de precio, características importantes
- **Patrones de compra**: Frecuencia, momento del día, tipo de cliente
- **Historial**: Productos consultados, preguntas comunes, temas recurrentes
- **Contexto**: Necesidades detectadas, objetivos, notas importantes

**Requisitos Técnicos:**

1. **Base de datos**: Tabla `user_memory_summaries` con campos:
   - `user_id` / `session_id`
   - `summary` (texto)
   - `summary_json` (JSONB con estructura)
   - `conversation_count`
   - `last_updated_at`

2. **API Backend**: 
   - `POST /api/generate-memory-summary` - Genera resumen con OpenAI
   - `GET /api/get-user-memory` - Obtiene memoria del usuario
   - `POST /api/process-conversations-memory` - Proceso automático (cron)

3. **Integración en Chat**:
   - Antes de generar respuesta, obtener memoria del usuario
   - Incluir resumen en el system prompt
   - Personalizar respuestas basadas en memoria

**Estrategias de Actualización:**

- **Por número**: Actualizar cada 5-10 conversaciones nuevas
- **Por tiempo**: Actualizar diariamente
- **Híbrido**: Cada X conversaciones O cada Y días (lo que ocurra primero)
- **On-demand**: Actualización manual desde admin

---

### 2.0.1 Implementación Técnica

**1. Esquema SQL - Tabla para Documentos de Memoria:**

```sql
-- Tabla para documentos de memoria del bot (uno por usuario/sesión)
CREATE TABLE IF NOT EXISTS bot_memory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  document_content TEXT NOT NULL DEFAULT '', -- Contenido del documento con anotaciones
  summary TEXT, -- Resumen generado para el cliente (opcional, se genera cuando se pide)
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, session_id)
);

CREATE INDEX idx_memory_doc_user_id ON bot_memory_documents(user_id);
CREATE INDEX idx_memory_doc_session_id ON bot_memory_documents(session_id);
CREATE INDEX idx_memory_doc_last_updated ON bot_memory_documents(last_updated_at DESC);
```

**2. Flujo de Trabajo en cada Consulta:**

```typescript
// api/chat-with-memory.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { userMessage, userId, sessionId } = req.body;
    
    if (!userMessage) {
      return res.status(400).json({ error: 'Mensaje requerido' });
    }

    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // 1. Obtener o crear documento de memoria
    let query = supabase.from('bot_memory_documents').select('*');
    if (userId) query = query.eq('user_id', userId);
    if (sessionId) query = query.eq('session_id', sessionId);
    
    const { data: existingDoc, error: fetchError } = await query.single();

    let memoryDocument = existingDoc?.document_content || '';
    
    // Si no existe, crear uno nuevo
    if (!existingDoc) {
      const { error: insertError } = await supabase
        .from('bot_memory_documents')
        .insert({
          user_id: userId,
          session_id: sessionId,
          document_content: '',
        });
      if (insertError) throw insertError;
    }

    // 2. Construir prompt para OpenAI que incluya el documento
    const systemPrompt = `Eres un asistente experto en productos de PrestaShop.

Tienes acceso a un documento de memoria que contiene anotaciones sobre las interacciones con este usuario. 

DOCUMENTO DE MEMORIA ACTUAL:
${memoryDocument || '(Documento vacío - primera interacción)'}

INSTRUCCIONES:
1. Lee el documento de memoria actual
2. Procesa la consulta del usuario
3. Genera una respuesta útil
4. ACTUALIZA el documento de memoria añadiendo/modificando anotaciones relevantes basadas en esta interacción

FORMATO DE RESPUESTA:
Responde en JSON con esta estructura:
{
  "response": "Tu respuesta al usuario",
  "updated_document": "Documento de memoria actualizado con nuevas anotaciones"
}

Las anotaciones en el documento deben incluir:
- Preferencias del usuario (categorías, tipos de productos, rango de precio)
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento
- Cualquier información relevante para futuras interacciones

Mantén el documento organizado y actualizado.`;

    // 3. Llamar a OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    });

    const responseData = JSON.parse(completion.choices[0].message.content || '{}');
    
    // 4. Guardar documento actualizado
    const { error: updateError } = await supabase
      .from('bot_memory_documents')
      .update({
        document_content: responseData.updated_document || memoryDocument,
        last_updated_at: new Date().toISOString(),
      })
      .eq(userId ? 'user_id' : 'session_id', userId || sessionId);

    if (updateError) throw updateError;

    // 5. Generar resumen automáticamente en background (no bloquea la respuesta)
    // Solo si el documento tiene suficiente contenido (ej: > 100 caracteres)
    if (responseData.updated_document && responseData.updated_document.length > 100) {
      generateSummaryInBackground(userId || sessionId, responseData.updated_document, supabase, openai);
    }

    // 6. Retornar respuesta al usuario (sin esperar el resumen)
    res.status(200).json({
      success: true,
      response: responseData.response,
      document_updated: true,
    });
  } catch (error) {
    console.error('Error en chat con memoria:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}

// Función que genera resumen en background (no bloquea)
async function generateSummaryInBackground(
  userIdOrSession: string,
  documentContent: string,
  supabase: any,
  openai: OpenAI
) {
  // Ejecutar en background sin bloquear
  setImmediate(async () => {
    try {
      const summaryPrompt = `Analiza este documento de memoria y genera un resumen JSON:
{
  "resumen_general": "...",
  "preferencias_usuario": [],
  "productos_consultados": [],
  "necesidades_detectadas": "",
  "patrones_comportamiento": "",
  "recomendaciones": ""
}

Documento:\n${documentContent}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Genera resúmenes claros en JSON válido.' },
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
        .eq('session_id', userIdOrSession)
        .or(`user_id.eq.${userIdOrSession}`);
    } catch (error) {
      console.error('Error generando resumen en background:', error);
      // No fallar si el resumen no se puede generar
    }
  });
}
```

**3. Generación Automática de Resumen (Integrada en chat.ts):**

```typescript
// Esta función se llama automáticamente después de guardar el documento
// Se ejecuta en background, no bloquea la respuesta al usuario

async function generateSummaryInBackground(
  userIdOrSession: string,
  documentContent: string,
  supabase: any,
  openai: OpenAI
) {
  // Ejecutar sin bloquear (background)
  setImmediate(async () => {
    try {
      // Solo generar si el documento tiene suficiente contenido
      if (!documentContent || documentContent.length < 50) {
        return; // Documento muy corto, no generar resumen aún
      }

      const summaryPrompt = `Analiza este documento de memoria y genera un resumen JSON:
{
  "resumen_general": "Resumen de 2-3 párrafos",
  "preferencias_usuario": [],
  "productos_consultados": [],
  "necesidades_detectadas": "",
  "patrones_comportamiento": "",
  "recomendaciones": ""
}

Documento:\n${documentContent}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Genera resúmenes claros en JSON válido.' },
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
        .eq('session_id', userIdOrSession)
        .or(`user_id.eq.${userIdOrSession}`);
        
    } catch (error) {
      console.error('Error generando resumen en background:', error);
      // No fallar si el resumen no se puede generar
    }
  });
}
```

**Estrategias para optimizar generación de resúmenes:**

1. **Generar cada X actualizaciones** (ej: cada 5 actualizaciones):
```typescript
// Contar cuántas veces se ha actualizado el documento
const updateCount = (existingDoc?.update_count || 0) + 1;

if (updateCount % 5 === 0) {
  // Generar resumen cada 5 actualizaciones
  generateSummaryInBackground(...);
}
```

2. **Generar solo si el documento cambió significativamente**:
```typescript
// Comparar longitud o hash del documento
const significantChange = Math.abs(
  documentContent.length - (existingDoc?.document_content?.length || 0)
) > 100;

if (significantChange) {
  generateSummaryInBackground(...);
}
```

3. **Generar con delay** (para evitar spam si hay muchas consultas rápidas):
```typescript
// Esperar 30 segundos después de la última actualización
// Si hay más actualizaciones, cancelar y esperar más
```

**Cuándo se genera:**
- **Automáticamente** después de guardar el documento actualizado
- **En background** (no bloquea la respuesta al usuario)
- **Solo si hay contenido suficiente** (ej: > 50 caracteres)
- **Optimizado** (cada X actualizaciones o si hay cambio significativo)

**4. API: Obtener Todos los Resúmenes (Para mostrar en Admin):**

```typescript
// api/get-memory-summary.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { userId, sessionId } = req.query;

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    let query = supabase.from('bot_memory_documents').select('summary, document_content, last_updated_at');
    if (userId) query = query.eq('user_id', userId);
    if (sessionId) query = query.eq('session_id', sessionId);

    const { data, error } = await query.single();

    if (error) throw error;

    res.status(200).json({
      success: true,
      summary: data?.summary ? JSON.parse(data.summary) : null,
      has_document: !!data?.document_content,
      last_updated: data?.last_updated_at,
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

**Dificultad:** 🟡 **Media**
- Integración con OpenAI para leer/escribir documentos
- Manejo de JSON en respuestas
- Actualización de documentos en cada interacción
- Generación de resúmenes bajo demanda

**Valor:** 🔥🔥🔥🔥🔥 **Muy Alto**
- Memoria persistente automática
- Resumen para cliente en admin
- Sin procesamiento asíncrono complejo
- Simple y efectivo

**Consideraciones:**

- **Formato del documento**: El documento puede ser texto libre organizado por secciones
- **Tamaño del documento**: Limitar a ~5000 caracteres para no exceder tokens (si crece mucho, hacer resumen periódico)
- **Frecuencia de actualización**: El documento se actualiza en cada interacción
- **Resumen automático**: El resumen se genera automáticamente en background después de cada actualización (o cada X actualizaciones)
- **Panel Analytics**: Siempre muestra datos ya generados, sin espera
- **Costo**: 
  - Actualizar documento: ~500-1000 tokens extra por consulta
  - Generar resumen: ~1000-2000 tokens cada vez que se genera (cada X actualizaciones)

**Ventajas de este enfoque:**
- ✅ Simple: Un solo documento que se va acumulando
- ✅ Automático: OpenAI decide qué anotar
- ✅ Persistente: Se mantiene entre sesiones
- ✅ Resumen para cliente: Generado cuando se necesita
- ✅ Sin complejidad asíncrona: Todo en el flujo de la consulta

---

### 2.0.2 Panel en Admin - Resumen de Memoria del Bot

**Descripción:**
Panel en el admin donde el cliente puede ver un resumen completo de lo que está pasando con el chatbot, basado en los documentos de memoria que OpenAI va acumulando.

---

## 📊 QUÉ VERÁ EL CLIENTE EN EL ADMIN

### Vista General - Dashboard de Memoria

**1. Métricas Principales (Cards superiores):**

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│ Usuarios Activos│  │ Conversaciones   │  │ Última          │
│ con Memoria     │  │ Totales          │  │ Actualización   │
│                 │  │                  │  │                 │
│     1,234       │  │     5,678        │  │  Hace 2 horas   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

- **Usuarios con memoria**: Total de usuarios/sesiones que tienen documento de memoria
- **Conversaciones totales**: Número total de interacciones procesadas
- **Última actualización**: Cuándo se actualizó el documento más reciente

---

### 2. Lista de Resúmenes por Usuario/Sesión

**Tabla con información resumida:**

| Usuario/Sesión | Última Interacción | Preferencias Detectadas | Productos Consultados | Estado | Acciones |
|----------------|-------------------|------------------------|---------------------|--------|----------|
| User #1234 | Hace 2 horas | Ecológicos, Premium | Aceite oliva, Miel | 🟢 Activo | Ver Detalles |
| Session #abc | Hace 1 día | Sin gluten, Barato | Pan, Pasta | 🟡 Inactivo | Ver Detalles |
| User #5678 | Hace 5 min | Orgánicos, Fitness | Proteínas, Vitaminas | 🟢 Activo | Ver Detalles |

**Columnas:**
- **Usuario/Sesión**: Identificador (puede ser anónimo con session_id)
- **Última Interacción**: Tiempo desde la última consulta
- **Preferencias Detectadas**: Tags rápidos de preferencias (ej: "Ecológicos", "Premium")
- **Productos Consultados**: Lista de productos más consultados
- **Estado**: 🟢 Activo (últimas 24h) / 🟡 Inactivo (1-7 días) / 🔴 Dormido (>7 días)
- **Acciones**: Botón "Ver Detalles" para expandir

---

### 3. Detalle de Resumen Individual (Al hacer clic en "Ver Detalles")

**Panel expandido con información completa:**

#### 📋 Resumen General
```
Este usuario ha interactuado 12 veces con el chatbot en los últimos 7 días.
Muestra interés en productos ecológicos y orgánicos, con preferencia por
productos premium. Ha consultado principalmente categorías de alimentación
saludable y suplementos.
```

#### 🎯 Preferencias del Usuario
- **Categorías de interés**: 
  - Alimentación ecológica (8 consultas)
  - Suplementos nutricionales (5 consultas)
  - Productos orgánicos (6 consultas)
- **Tipo de productos**: Premium, ecológicos, sin conservantes
- **Rango de precio**: Medio-Alto (busca calidad sobre precio)
- **Características importantes**: 
  - ✅ Sin gluten
  - ✅ Orgánico certificado
  - ✅ Productos locales

#### 📦 Productos Más Consultados
1. Aceite de Oliva Virgen Extra - 5 consultas
2. Miel de Tomillo - 4 consultas
3. Proteína Vegana - 3 consultas
4. Vitaminas D3 - 2 consultas

#### 🔍 Necesidades Detectadas
- Busca productos para dieta vegana/vegetariana
- Interés en productos locales y de proximidad
- Prioriza calidad y certificaciones (eco, bio)
- Compra para consumo personal y familiar

#### 📈 Patrones de Comportamiento
- **Frecuencia**: Consulta regularmente (2-3 veces por semana)
- **Momento del día**: Principalmente mañanas (9:00-12:00)
- **Tipo de cliente**: Analítico, busca información detallada antes de comprar
- **Duración promedio**: 5-8 mensajes por consulta

#### 💡 Recomendaciones
- El usuario valora información detallada sobre origen y certificaciones
- Responde bien a recomendaciones de productos relacionados
- Probablemente está en fase de comparación antes de comprar
- Considerar ofrecer descuentos en productos premium para cerrar compra

#### 📊 Estadísticas de Interacción
- **Total de consultas**: 12
- **Productos consultados**: 8 diferentes
- **Categorías exploradas**: 3
- **Tiempo promedio de sesión**: 4 minutos
- **Tasa de satisfacción**: Alta (según feedback)

---

### 4. Vista Agregada - Resumen Global

**Panel con resumen de TODOS los usuarios:**

#### 📊 Preferencias Más Comunes (Top 10)
1. Productos ecológicos - 45% de usuarios
2. Precio bajo - 38% de usuarios
3. Sin gluten - 32% de usuarios
4. Productos premium - 28% de usuarios
5. Orgánicos - 25% de usuarios
...

#### 🔥 Productos Más Consultados (Top 20)
1. Aceite de Oliva - 234 consultas
2. Miel - 189 consultas
3. Pan integral - 156 consultas
4. Pasta - 142 consultas
5. Queso - 128 consultas
...

#### 📈 Patrones Globales
- **Hora pico**: 10:00-12:00 y 18:00-20:00
- **Día más activo**: Viernes y sábado
- **Tipo de cliente más común**: Buscador de ofertas (42%)
- **Duración promedio**: 6 mensajes por conversación

#### 🎯 Insights para el Cliente
- Los usuarios buscan principalmente productos ecológicos y orgánicos
- Hay alta demanda de productos sin gluten
- Los usuarios valoran información detallada sobre certificaciones
- Oportunidad: Crear sección destacada de productos ecológicos
- Oportunidad: Añadir filtros por certificaciones (eco, bio, sin gluten)

---

### 5. Funcionalidades del Panel

**Filtros y Búsqueda:**
- 🔍 **Búsqueda**: Por usuario, producto consultado, preferencia
- 📅 **Filtro por fecha**: Últimas 24h, 7 días, 30 días, Todo
- 🏷️ **Filtro por preferencia**: Ecológicos, Premium, Sin gluten, etc.
- 📊 **Filtro por estado**: Activo, Inactivo, Dormido
- 📦 **Filtro por producto**: Mostrar solo usuarios que consultaron X producto

**Acciones:**
- ✅ **Generar resumen**: Si un usuario no tiene resumen, generarlo
- 📥 **Exportar**: Exportar resúmenes a CSV/JSON
- 🔄 **Actualizar**: Refrescar datos de memoria
- 👁️ **Ver documento completo**: Ver el documento raw de memoria (para debugging)
- 🗑️ **Limpiar memoria**: Borrar documento de memoria de un usuario (GDPR)

**Visualizaciones:**
- 📊 Gráfico de barras: Preferencias más comunes
- 📈 Gráfico de líneas: Evolución de consultas por día
- 🥧 Gráfico circular: Distribución de tipos de cliente
- 📋 Nube de palabras: Palabras clave más frecuentes en consultas

---

### 6. Ejemplo de Resumen Completo (JSON que recibe el cliente)

```json
{
  "resumen_general": "Este usuario ha interactuado 12 veces con el chatbot en los últimos 7 días. Muestra interés en productos ecológicos y orgánicos, con preferencia por productos premium. Ha consultado principalmente categorías de alimentación saludable y suplementos.",
  
  "preferencias_usuario": [
    "Productos ecológicos",
    "Orgánicos certificados",
    "Sin gluten",
    "Productos premium",
    "Origen local"
  ],
  
  "productos_consultados": [
    "Aceite de Oliva Virgen Extra",
    "Miel de Tomillo",
    "Proteína Vegana",
    "Vitaminas D3",
    "Pan integral ecológico"
  ],
  
  "necesidades_detectadas": "El usuario busca productos para dieta vegana/vegetariana, con interés en productos locales y de proximidad. Prioriza calidad y certificaciones (eco, bio) sobre precio. Compra para consumo personal y familiar.",
  
  "patrones_comportamiento": "Consulta regularmente (2-3 veces por semana), principalmente en horario de mañana (9:00-12:00). Es un cliente analítico que busca información detallada antes de comprar. Duración promedio de 5-8 mensajes por consulta.",
  
  "recomendaciones": "El usuario valora información detallada sobre origen y certificaciones. Responde bien a recomendaciones de productos relacionados. Probablemente está en fase de comparación antes de comprar. Considerar ofrecer descuentos en productos premium para cerrar compra.",
  
  "estadisticas": {
    "total_consultas": 12,
    "productos_consultados": 8,
    "categorias_exploradas": 3,
    "tiempo_promedio_sesion": "4 minutos",
    "satisfaccion_promedio": "Alta"
  },
  
  "ultima_actualizacion": "2024-01-15T10:30:00Z",
  "fecha_primera_interaccion": "2024-01-08T14:20:00Z"
}
```

---

### 7. Componente React Completo

```typescript
// components/MemorySummaryPanel.tsx
import { useState, useEffect } from 'react';

interface MemorySummary {
  user_id?: string;
  session_id: string;
  summary: {
    resumen_general: string;
    preferencias_usuario: string[];
    productos_consultados: string[];
    necesidades_detectadas: string;
    patrones_comportamiento: string;
    recomendaciones: string;
    estadisticas: {
      total_consultas: number;
      productos_consultados: number;
      categorias_exploradas: number;
      tiempo_promedio_sesion: string;
      satisfaccion_promedio: string;
    };
  };
  last_updated: string;
  has_document: boolean;
}

function MemorySummaryPanel() {
  const [summaries, setSummaries] = useState<MemorySummary[]>([]);
  const [selectedSummary, setSelectedSummary] = useState<MemorySummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    dateRange: '7d',
    preference: '',
    status: 'all',
  });

  useEffect(() => {
    fetchSummaries();
  }, [filters]);

  const fetchSummaries = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/get-all-memory-summaries?${new URLSearchParams(filters)}`);
      const data = await res.json();
      setSummaries(data.summaries || []);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateSummary = async (userId: string, sessionId: string) => {
    await fetch(`/api/generate-memory-summary?userId=${userId}&sessionId=${sessionId}`);
    fetchSummaries();
  };

  return (
    <div className="memory-summary-panel">
      {/* Header con métricas */}
      <div className="metrics-cards">
        <MetricCard title="Usuarios con Memoria" value={summaries.length} />
        <MetricCard title="Conversaciones Totales" value={summaries.reduce((sum, s) => sum + (s.summary?.estadisticas?.total_consultas || 0), 0)} />
        <MetricCard title="Última Actualización" value={summaries[0]?.last_updated || 'N/A'} />
      </div>

      {/* Filtros */}
      <div className="filters">
        <select value={filters.dateRange} onChange={(e) => setFilters({...filters, dateRange: e.target.value})}>
          <option value="24h">Últimas 24h</option>
          <option value="7d">Últimos 7 días</option>
          <option value="30d">Últimos 30 días</option>
          <option value="all">Todo</option>
        </select>
        {/* Más filtros... */}
      </div>

      {/* Tabla de resúmenes */}
      <div className="summaries-table">
        <table>
          <thead>
            <tr>
              <th>Usuario/Sesión</th>
              <th>Última Interacción</th>
              <th>Preferencias</th>
              <th>Productos Consultados</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {summaries.map((summary) => (
              <tr key={summary.session_id}>
                <td>{summary.user_id || summary.session_id}</td>
                <td>{formatTimeAgo(summary.last_updated)}</td>
                <td>
                  <div className="tags">
                    {summary.summary?.preferencias_usuario?.slice(0, 3).map(p => (
                      <span key={p} className="tag">{p}</span>
                    ))}
                  </div>
                </td>
                <td>
                  <div className="products">
                    {summary.summary?.productos_consultados?.slice(0, 2).join(', ')}
                    {summary.summary?.productos_consultados?.length > 2 && '...'}
                  </div>
                </td>
                <td>
                  <StatusBadge lastUpdated={summary.last_updated} />
                </td>
                <td>
                  <button onClick={() => setSelectedSummary(summary)}>
                    Ver Detalles
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal con detalle completo */}
      {selectedSummary && (
        <MemoryDetailModal
          summary={selectedSummary}
          onClose={() => setSelectedSummary(null)}
          onGenerateSummary={generateSummary}
        />
      )}
    </div>
  );
}
```

---

### 8. API: Obtener Todos los Resúmenes

```typescript
// api/get-all-memory-summaries.ts
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
      status: getStatus(doc.last_updated_at), // Activo, Inactivo, Dormido
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

---

## 2.1 FLUJO COMPLETO: De la Pregunta del Usuario al Panel de Analytics

### 📋 Resumen Ejecutivo

**Pregunta del usuario** → **Chat procesa con OpenAI** → **Documento de memoria se actualiza** → **Datos se acumulan** → **Resumen para cliente en Admin**

---

### 🔄 PROCESO COMPLETO PASO A PASO

#### **PASO 1: Usuario hace una pregunta en el chat**

```
Usuario escribe: "¿Tienes aceite de oliva ecológico?"
```

**Dónde ocurre:**
- Frontend: Componente `Chat.tsx` en el Dashboard
- El usuario escribe en el input y presiona "Enviar"

---

#### **PASO 2: Frontend envía mensaje a la API**

```typescript
// src/services/chatService.ts
sendChatMessage(message, conversationHistory, config)
  ↓
POST /api/chat
{
  message: "¿Tienes aceite de oliva ecológico?",
  conversationHistory: [...], // Últimos mensajes
  sessionId: "abc123", // ID de sesión único
  config: {...}
}
```

**Dónde ocurre:**
- Frontend → API en Vercel (`api/chat.ts`)

**Datos que se envían:**
- Mensaje del usuario
- Historial de conversación (últimos 10 mensajes)
- Session ID (generado en localStorage o cookie)
- Configuración del chat

---

#### **PASO 3: API lee el documento de memoria actual**

```typescript
// api/chat.ts (NUEVO código a añadir)

// 1. Obtener documento de memoria del usuario
const { data: memoryDoc } = await supabase
  .from('bot_memory_documents')
  .select('document_content')
  .eq('session_id', sessionId)
  .single();

// Si no existe, crear uno vacío
if (!memoryDoc) {
  await supabase.from('bot_memory_documents').insert({
    session_id: sessionId,
    document_content: '',
  });
}
```

**Dónde ocurre:**
- API en Vercel consulta Supabase
- Tabla: `bot_memory_documents`

**Qué se obtiene:**
- Documento de memoria actual del usuario (o vacío si es primera vez)
- Ejemplo: "Usuario interesado en productos ecológicos. Consultó: miel, pan integral..."

**Cuándo:**
- **En tiempo real**, justo antes de llamar a OpenAI
- **Cada vez** que el usuario envía un mensaje

---

#### **PASO 4: API construye el prompt con memoria**

```typescript
// api/chat.ts

// 2. Construir system prompt con memoria
const memoryContext = memoryDoc?.document_content 
  ? `\n\n## MEMORIA DEL USUARIO:\n${memoryDoc.document_content}\n\nUsa esta información para personalizar tu respuesta.` 
  : '';

const systemPrompt = processPrompt(activePrompts) + memoryContext;

// 3. Preparar mensajes para OpenAI
const messages = [
  { role: 'system', content: systemPrompt },
  ...conversationHistory,
  { role: 'user', content: message }
];
```

**Dónde ocurre:**
- API en Vercel, antes de llamar a OpenAI

**Qué se hace:**
- Se combina el system prompt (desde Supabase) + documento de memoria
- Se preparan los mensajes para OpenAI

**Cuándo:**
- **En tiempo real**, en cada consulta

---

#### **PASO 5: OpenAI procesa y devuelve respuesta + documento actualizado**

```typescript
// api/chat.ts

// 4. Llamar a OpenAI con instrucción especial
const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messages,
  response_format: { type: 'json_object' }, // Forzar JSON
  // ... instrucciones para que devuelva:
  // {
  //   "response": "Sí, tenemos varios aceites de oliva ecológicos...",
  //   "updated_document": "Usuario interesado en productos ecológicos. Consultó: miel, pan integral, aceite de oliva ecológico. Preferencias: ecológico, premium..."
  // }
});

const responseData = JSON.parse(completion.choices[0].message.content);
```

**Dónde ocurre:**
- OpenAI API (servidor de OpenAI)

**Qué ocurre:**
- OpenAI lee el documento de memoria
- Procesa la pregunta del usuario
- Genera una respuesta útil
- **Actualiza el documento** añadiendo/modificando anotaciones

**Cuándo:**
- **En tiempo real**, en cada consulta
- Tiempo: 2-5 segundos típicamente

**Instrucciones a OpenAI:**
```
"Tienes un documento de memoria. LEE el documento actual, 
procesa la consulta, genera una respuesta, y ACTUALIZA 
el documento con nuevas anotaciones relevantes."
```

---

#### **PASO 6: API guarda el documento actualizado**

```typescript
// api/chat.ts

// 5. Guardar documento actualizado en Supabase
await supabase
  .from('bot_memory_documents')
  .update({
    document_content: responseData.updated_document,
    last_updated_at: new Date().toISOString(),
  })
  .eq('session_id', sessionId);

// 6. Retornar respuesta al usuario
res.json({
  success: true,
  message: responseData.response,
  // ... otros datos
});
```

**Dónde ocurre:**
- API en Vercel guarda en Supabase
- Tabla: `bot_memory_documents`

**Qué se guarda:**
- Documento actualizado con nuevas anotaciones
- Timestamp de última actualización

**Cuándo:**
- **Inmediatamente** después de recibir respuesta de OpenAI
- **En tiempo real**, en cada consulta

---

#### **PASO 7: Usuario recibe respuesta en el chat**

```
Bot: "Sí, tenemos varios aceites de oliva ecológicos:
- Aceite de Oliva Virgen Extra Ecológico - 15.99€
- Aceite de Oliva Ecológico Premium - 12.50€
..."
```

**Dónde ocurre:**
- Frontend: Componente `Chat.tsx`
- El usuario ve la respuesta en la interfaz

---

#### **PASO 8: Cliente quiere ver Analytics (Admin)**

```
Cliente abre Dashboard → Tab "Analytics" → Ve resúmenes
```

**Dónde ocurre:**
- Frontend: Dashboard → Tab "Analytics"
- Componente: `MemorySummaryPanel.tsx`

**Cuándo:**
- **Bajo demanda**: Cuando el cliente abre el panel
- **No es automático**: El cliente debe entrar al tab

---

#### **PASO 9: Generación automática de resumen (en background)**

```typescript
// Esto ocurre AUTOMÁTICAMENTE después de cada actualización del documento
// Opción A: Justo después de guardar el documento actualizado
// Opción B: Cada X actualizaciones (ej: cada 5 actualizaciones)

// En api/chat.ts, después de guardar el documento:
if (shouldGenerateSummary(memoryDoc)) {
  // Generar resumen automáticamente (sin esperar)
  generateSummaryAsync(sessionId, responseData.updated_document);
}

// Función que genera resumen en background (no bloquea)
async function generateSummaryAsync(sessionId: string, documentContent: string) {
  // No esperar, se ejecuta en background
  setTimeout(async () => {
    const summary = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{
        role: 'user',
        content: `Analiza este documento y genera resumen JSON: ${documentContent}`
      }],
      response_format: { type: 'json_object' }
    });
    
    // Guardar resumen en Supabase
    await supabase
      .from('bot_memory_documents')
      .update({ summary: summary.choices[0].message.content })
      .eq('session_id', sessionId);
  }, 0);
}
```

**Dónde ocurre:**
- API en Vercel, después de guardar documento actualizado
- Se ejecuta en background (no bloquea la respuesta al usuario)

**Qué se hace:**
- OpenAI analiza el documento de memoria
- Genera resumen estructurado
- Guarda en `bot_memory_documents.summary`

**Cuándo:**
- **Automáticamente**: Después de cada actualización del documento (o cada X actualizaciones)
- **En background**: No bloquea la respuesta al usuario
- **Siempre actualizado**: El resumen siempre está disponible cuando se necesita

**Estrategia de generación:**
- **Opción A (Recomendada)**: Generar resumen cada 3-5 actualizaciones del documento
- **Opción B**: Generar resumen después de cada actualización (más costoso en tokens)
- **Opción C**: Generar resumen cada X minutos (ej: cada 30 min) si hay documentos sin resumen reciente

---

#### **PASO 10: Cliente abre Analytics y ve datos inmediatamente**

```
Panel muestra:
- Resumen general
- Preferencias detectadas
- Productos consultados
- Patrones de comportamiento
- Recomendaciones
```

**Dónde ocurre:**
- Frontend: Panel de Analytics
- Datos desde: Supabase (`bot_memory_documents.summary`)

**Cuándo:**
- **Inmediatamente** cuando abre el panel
- Los datos se actualizan cuando se regenera el resumen

---

### 📊 DE DÓNDE SALEN LOS DATOS EN EL PANEL

| Dato en el Panel | Origen | Cómo se obtiene | Cuándo se actualiza |
|------------------|--------|-----------------|---------------------|
| **Resumen general** | Documento de memoria → OpenAI resumen | OpenAI analiza el documento completo | Cuando se genera el resumen (bajo demanda) |
| **Preferencias usuario** | Documento de memoria | OpenAI detecta patrones en el documento | Cada vez que OpenAI actualiza el documento |
| **Productos consultados** | Documento de memoria | OpenAI anota productos mencionados | Cada consulta que menciona productos |
| **Patrones comportamiento** | Documento de memoria | OpenAI detecta frecuencia, horarios, etc. | Se acumula en el documento con cada consulta |
| **Recomendaciones** | OpenAI genera | OpenAI analiza el documento y sugiere | Cuando se genera el resumen |
| **Estadísticas** | Documento de memoria | Se cuenta información del documento | Se calcula al generar el resumen |

---

### ⏱️ FRECUENCIA DE ACTUALIZACIÓN

#### **Documento de Memoria:**
- **Actualización**: **En tiempo real** (cada vez que el usuario pregunta)
- **Proceso**: Automático, sin intervención
- **Dónde**: Tabla `bot_memory_documents.document_content`

#### **Resumen para el Cliente:**
- **Actualización**: **Automático** (después de cada actualización del documento, o cada X actualizaciones)
- **Proceso**: Se genera en background automáticamente
- **Dónde**: Tabla `bot_memory_documents.summary`
- **Cuando el cliente abre Analytics**: Los datos **ya están listos**, no hay espera
- **Regeneración**: Se regenera automáticamente cuando el documento cambia significativamente

#### **Panel de Analytics:**
- **Actualización**: **En tiempo real** cuando se abre (lee datos de Supabase)
- **Proceso**: Consulta directa a Supabase
- **Refresh**: El cliente puede refrescar manualmente

---

### 🔄 FLUJO VISUAL COMPLETO

```
┌─────────────────┐
│ Usuario pregunta│
│ "¿Tienes X?"    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend: Chat  │
│ Envía a API     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API: chat.ts    │
│ 1. Lee documento  │ ← Supabase (bot_memory_documents)
│ 2. Construye    │
│    prompt       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ OpenAI          │
│ - Lee documento │
│ - Procesa       │
│ - Responde      │
│ - Actualiza doc │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API: chat.ts    │
│ Guarda documento│ → Supabase (bot_memory_documents)
│ actualizado     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Frontend: Chat  │
│ Muestra         │
│ respuesta       │
└─────────────────┘

┌─────────────────┐
│ API: chat.ts    │
│ Guarda documento│ → Supabase
│ actualizado     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API: chat.ts    │
│ (Background)    │
│ Genera resumen  │ → OpenAI analiza documento
│ automáticamente │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Guarda resumen  │ → Supabase (bot_memory_documents.summary)
│ en Supabase     │
└─────────────────┘

┌─────────────────┐
│ Cliente abre    │
│ Analytics       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API: get-all... │
│ Lee resúmenes   │ ← Supabase (YA GENERADOS)
│ (ya listos)     │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Panel Analytics │
│ Muestra datos   │
│ INMEDIATAMENTE  │
│ (sin espera)     │
└─────────────────┘
```

---

### 📝 RESUMEN EN 5 PUNTOS

1. **Usuario pregunta** → Chat envía a `api/chat.ts`

2. **API lee documento de memoria** → Supabase (`bot_memory_documents`)

3. **OpenAI procesa** → Lee documento, responde, actualiza documento

4. **API guarda documento actualizado** → Supabase (en tiempo real)

5. **Cliente abre Analytics** → Genera resumen (si no existe) → Muestra en panel

**Frecuencia:**
- **Documento**: Se actualiza **cada vez** que el usuario pregunta (tiempo real)
- **Resumen**: Se genera **automáticamente en background** después de cada actualización (o cada X actualizaciones)
- **Panel**: Muestra datos **inmediatamente** cuando se abre (los resúmenes ya están generados en Supabase)

**Flujo mejorado:**
1. Usuario pregunta → Documento se actualiza → Resumen se genera automáticamente (background)
2. Cliente abre Analytics → Lee resúmenes ya generados → Muestra datos inmediatamente (sin espera)

---

## 2.2 COMPATIBILIDAD CON EL PROYECTO ACTUAL

### ✅ Lo que ya existe y encaja perfectamente:

1. **Dashboard React con Tabs**
   - Ya tienes: `Dashboard.tsx` con tabs (products, connections, chat, prompts, documentation)
   - ✅ **Encaja**: Añadir nuevo tab "Analytics" o "Memoria del Bot"
   - ✅ **Encaja**: Añadir panel de resumen de memoria como nueva sección

2. **Sistema de Chat con OpenAI**
   - Ya tienes: `api/chat.ts` que maneja conversaciones con OpenAI
   - Ya tienes: `Chat.tsx` componente funcional
   - ✅ **Encaja**: Modificar `api/chat.ts` para integrar el sistema de memoria
   - ✅ **Encaja**: El documento de memoria se lee/actualiza en cada llamada al chat

3. **Supabase configurado**
   - Ya tienes: Supabase para productos y prompts
   - ✅ **Encaja**: Añadir tabla `bot_memory_documents` en Supabase
   - ✅ **Encaja**: Usar las mismas credenciales y conexión

4. **APIs en Vercel**
   - Ya tienes: `api/chat.ts`, `api/get-products.ts`, etc.
   - ✅ **Encaja**: Crear nuevas APIs (`api/get-memory-summary.ts`, `api/generate-memory-summary.ts`)
   - ✅ **Encaja**: Mismo patrón de serverless functions

5. **Sistema de Prompts**
   - Ya tienes: `system_prompts` y `prompt_variables` en Supabase
   - ✅ **Encaja**: El documento de memoria se puede incluir en el system prompt
   - ✅ **Encaja**: Se integra con el sistema de prompts existente

### 🔧 Adaptaciones necesarias:

1. **Modificar `api/chat.ts`**:
   - Añadir código para leer documento de memoria antes de llamar a OpenAI
   - Añadir código para actualizar documento después de la respuesta
   - Incluir el documento en el system prompt

2. **Añadir tablas en Supabase**:
   - `bot_memory_documents` (para documentos de memoria)
   - `conversations` y `messages` (si no existen, para tracking básico)

3. **Añadir nuevo tab en Dashboard**:
   - Nuevo tab "Analytics" o "Memoria del Bot"
   - Componente `MemorySummaryPanel.tsx`

4. **Crear nuevas APIs**:
   - `api/get-memory-summary.ts` (obtener resumen)
   - `api/generate-memory-summary.ts` (generar resumen)
   - `api/get-all-memory-summaries.ts` (listar todos)

### 📝 Ejemplo de Integración en `api/chat.ts` actual:

```typescript
// En api/chat.ts, después de obtener el prompt activo (línea ~100)
// AÑADIR: Obtener documento de memoria
const { data: memoryDoc } = await supabase
  .from('bot_memory_documents')
  .select('document_content')
  .eq('session_id', req.body.sessionId || 'default')
  .single();

const memoryContext = memoryDoc?.document_content 
  ? `\n\n## MEMORIA DEL USUARIO:\n${memoryDoc.document_content}` 
  : '';

// Modificar el systemPrompt para incluir memoria
const systemPrompt = processPrompt(activePrompts) + memoryContext;

// Después de obtener respuesta de OpenAI (línea ~200)
// AÑADIR: Actualizar documento de memoria
if (responseData.updated_document) {
  await supabase
    .from('bot_memory_documents')
    .upsert({
      session_id: req.body.sessionId || 'default',
      document_content: responseData.updated_document,
      last_updated_at: new Date().toISOString(),
    });
}
```

### ⚠️ Consideraciones:

1. **Session ID**: El chat actual no parece usar session_id persistente. Necesitarás:
   - Generar un session_id único por usuario/sesión
   - Guardarlo en localStorage o cookies
   - Pasarlo en cada llamada al chat

2. **Respuesta de OpenAI**: Necesitas que OpenAI devuelva JSON con `response` y `updated_document`:
   - Modificar el prompt para que OpenAI devuelva JSON estructurado
   - O hacer dos llamadas: una para respuesta, otra para actualizar documento

3. **Compatibilidad con chat actual**: 
   - El chat actual funciona sin memoria (funciona bien)
   - Con memoria: añade funcionalidad sin romper lo existente
   - Puede ser opcional: activar/desactivar desde config

### 🎯 Resumen de Compatibilidad:

| Componente | Estado Actual | Compatibilidad | Cambios Necesarios |
|------------|---------------|----------------|-------------------|
| Dashboard React | ✅ Existe | ✅ Perfecto | Añadir tab "Analytics" |
| Chat Component | ✅ Funciona | ✅ Perfecto | Sin cambios (solo backend) |
| API Chat | ✅ Existe | ✅ Compatible | Modificar para memoria |
| Supabase | ✅ Configurado | ✅ Perfecto | Añadir 1 tabla nueva |
| Sistema Prompts | ✅ Funciona | ✅ Compatible | Integrar memoria en prompt |
| APIs Vercel | ✅ Funcionan | ✅ Mismo patrón | Añadir 3 APIs nuevas |

**Conclusión**: ✅ **TODO ENCAJA PERFECTAMENTE**. La propuesta es totalmente compatible con tu proyecto actual. Solo necesitas:
1. Añadir tablas en Supabase
2. Modificar `api/chat.ts` para integrar memoria
3. Añadir nuevo tab en Dashboard
4. Crear nuevas APIs para resúmenes

---

## 3. MEJORAS DEL PANEL ADMIN

### 3.1 Configuración Visual del Chatbot

**Descripción:**
Panel en el admin donde el cliente puede personalizar completamente la apariencia del chatbot que verán los usuarios finales. Incluye tema, colores, logo y otras opciones visuales.

**¿Por qué es importante?**
- Permite que cada cliente personalice el chatbot según su marca
- Mejora la experiencia del usuario (coherencia visual)
- Diferenciador comercial (cada cliente puede tener su propio estilo)
- Profesionalismo y branding

---

#### 3.1.1 Opciones de Personalización

**1. Tema (Light/Dark)**
- **Light**: Fondo claro, texto oscuro (modo claro)
- **Dark**: Fondo oscuro, texto claro (modo oscuro)
- Vista previa en tiempo real

**2. Colores Personalizables**
- **Color de acento**: Color principal para botones, mensajes del usuario, elementos destacados, enlaces
  - Opciones predefinidas: Purple, Magenta, Orange, Yellow, Green, Blue
  - Selector de color personalizado (color picker)
  - Se aplica a: Botones, mensajes del usuario, enlaces, elementos destacados
- **Color de mensajes del bot**: Color de fondo de los mensajes del bot
  - Opciones: Gris (default), mismo que acento, personalizado
  - Selector de color personalizado
- **Color de fondo del chat**: Color de fondo principal del chat
  - Opciones: Blanco (light), Gris claro, Gris oscuro (dark), personalizado
  - Selector de color personalizado
- **Color del texto**: Color del texto principal del chat
  - Opciones: Negro (light), Blanco (dark), personalizado
  - Selector de color personalizado
- **Color del header**: Color de fondo del encabezado del chat (donde aparece el logo y nombre del bot)
  - Opciones: Mismo que fondo, acento, personalizado
  - Selector de color personalizado
- **Color del borde**: Color de los bordes del chat y elementos
  - Opciones: Gris claro (default), mismo que acento, personalizado
  - Selector de color personalizado
- **Color del input**: Color de fondo del campo de texto donde el usuario escribe
  - Opciones: Blanco/Gris claro (default), personalizado
  - Selector de color personalizado

**3. Logo del Chatbot**
- **Subir logo**: Permite subir imagen del logo
- **Recorte de imagen**: Funcionalidad de crop/recorte para ajustar el logo
- **Tamaños recomendados**: 128x128px, 256x256px
- **Formatos soportados**: PNG, JPG, SVG
- **Vista previa**: Ver cómo se ve el logo en el chat

**4. Nombre del Bot**
- Campo de texto para personalizar el nombre que aparece en el chat
- Ejemplo: "Asistente", "Soporte", "ChatBot", etc.

**5. Mensaje de bienvenida**
- Texto personalizado que aparece cuando el usuario abre el chat por primera vez
- Ejemplo: "¡Hola! ¿En qué puedo ayudarte?"

**6. Posición del Chatbot**
- **Bottom Right**: Esquina inferior derecha (default)
- **Bottom Left**: Esquina inferior izquierda
- **Top Right**: Esquina superior derecha
- **Top Left**: Esquina superior izquierda

**7. Tamaño del Chat**
- **Small**: Chat pequeño (300px ancho)
- **Medium**: Chat mediano (400px ancho)
- **Large**: Chat grande (500px ancho)

---

#### 3.1.2 Vista Previa en Tiempo Real

El panel muestra una **vista previa del chat** que se actualiza en tiempo real mientras el cliente cambia las opciones, permitiendo ver exactamente cómo se verá el chatbot para los usuarios finales.

---

#### 3.1.3 Implementación Técnica

**1. Base de Datos - Tabla de Configuración del Chat**

```sql
CREATE TABLE IF NOT EXISTS chat_theme_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  theme TEXT DEFAULT 'light', -- 'light' o 'dark'
  accent_color TEXT DEFAULT '#10b981', -- Color hexadecimal para acentos (botones, mensajes usuario)
  bot_message_color TEXT DEFAULT 'grey', -- 'grey', 'accent', o color hexadecimal para mensajes del bot
  background_color TEXT DEFAULT '#ffffff', -- Color de fondo del chat (o 'auto' para usar tema)
  text_color TEXT DEFAULT '#1e293b', -- Color del texto principal (o 'auto' para usar tema)
  header_color TEXT DEFAULT 'auto', -- Color del header (o 'auto' para usar tema, 'accent' para usar acento)
  border_color TEXT DEFAULT '#e2e8f0', -- Color de bordes (o 'accent' para usar acento)
  input_color TEXT DEFAULT '#f8fafc', -- Color de fondo del input (o 'auto' para usar tema)
  logo_url TEXT, -- URL del logo subido
  logo_width INTEGER DEFAULT 32, -- Ancho del logo en píxeles
  logo_height INTEGER DEFAULT 32, -- Alto del logo en píxeles
  bot_name TEXT DEFAULT 'Asistente', -- Nombre del bot
  welcome_message TEXT DEFAULT '¡Hola! ¿En qué puedo ayudarte?',
  position TEXT DEFAULT 'bottom-right', -- 'bottom-right', 'bottom-left', 'top-right', 'top-left'
  chat_width TEXT DEFAULT 'medium', -- 'small', 'medium', 'large'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_chat_theme_config_updated ON chat_theme_config(updated_at DESC);
```

**2. API: Obtener Configuración del Chat**

```typescript
// api/get-chat-config.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const { data, error } = await supabase
      .from('chat_theme_config')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;

    // Si no hay configuración, retornar valores por defecto
    const defaultConfig = {
      theme: 'light',
      accent_color: '#10b981',
      bot_message_color: 'grey',
      background_color: '#ffffff',
      text_color: '#1e293b',
      header_color: 'auto',
      border_color: '#e2e8f0',
      input_color: '#f8fafc',
      logo_url: null,
      logo_width: 32,
      logo_height: 32,
      bot_name: 'Asistente',
      welcome_message: '¡Hola! ¿En qué puedo ayudarte?',
      position: 'bottom-right',
      chat_width: 'medium',
    };

    res.status(200).json({
      success: true,
      config: data || defaultConfig,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

**3. API: Guardar Configuración del Chat**

```typescript
// api/save-chat-config.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    const {
      theme,
      accent_color,
      bot_message_color,
      background_color,
      text_color,
      header_color,
      border_color,
      input_color,
      logo_url,
      logo_width,
      logo_height,
      bot_name,
      welcome_message,
      position,
      chat_width,
    } = req.body;

    // Validar datos
    if (!theme || !accent_color || !bot_message_color) {
      return res.status(400).json({
        success: false,
        error: 'Campos requeridos faltantes',
      });
    }

    // Obtener configuración existente
    const { data: existing } = await supabase
      .from('chat_theme_config')
      .select('id')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    let result;
    if (existing) {
      // Actualizar existente
      const { data, error } = await supabase
        .from('chat_theme_config')
        .update({
          theme,
          accent_color,
          bot_message_color,
          background_color: background_color || (theme === 'dark' ? '#1e293b' : '#ffffff'),
          text_color: text_color || (theme === 'dark' ? '#ffffff' : '#1e293b'),
          header_color: header_color || 'auto',
          border_color: border_color || '#e2e8f0',
          input_color: input_color || '#f8fafc',
          logo_url,
          logo_width: logo_width || 32,
          logo_height: logo_height || 32,
          bot_name: bot_name || 'Asistente',
          welcome_message: welcome_message || '¡Hola! ¿En qué puedo ayudarte?',
          position: position || 'bottom-right',
          chat_width: chat_width || 'medium',
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (error) throw error;
      result = data;
    } else {
      // Crear nueva
      const { data, error } = await supabase
        .from('chat_theme_config')
        .insert({
          theme,
          accent_color,
          bot_message_color,
          background_color: background_color || (theme === 'dark' ? '#1e293b' : '#ffffff'),
          text_color: text_color || (theme === 'dark' ? '#ffffff' : '#1e293b'),
          header_color: header_color || 'auto',
          border_color: border_color || '#e2e8f0',
          input_color: input_color || '#f8fafc',
          logo_url,
          logo_width: logo_width || 32,
          logo_height: logo_height || 32,
          bot_name: bot_name || 'Asistente',
          welcome_message: welcome_message || '¡Hola! ¿En qué puedo ayudarte?',
          position: position || 'bottom-right',
          chat_width: chat_width || 'medium',
        })
        .select()
        .single();

      if (error) throw error;
      result = data;
    }

    res.status(200).json({
      success: true,
      config: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

**4. API: Subir Logo con Recorte**

```typescript
// api/upload-chat-logo.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_KEY
    );

    // Obtener imagen base64 del body
    const { imageData, cropData } = req.body;

    if (!imageData) {
      return res.status(400).json({
        success: false,
        error: 'Imagen requerida',
      });
    }

    // Convertir base64 a buffer
    const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Generar nombre único para el archivo
    const fileName = `chat-logo-${Date.now()}.png`;
    const filePath = `chat-assets/${fileName}`;

    // Subir a Supabase Storage (bucket: 'chat-assets')
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('chat-assets')
      .upload(filePath, buffer, {
        contentType: 'image/png',
        upsert: true,
      });

    if (uploadError) throw uploadError;

    // Obtener URL pública
    const { data: { publicUrl } } = supabase.storage
      .from('chat-assets')
      .getPublicUrl(filePath);

    // Si hay datos de recorte, guardarlos también
    const logoWidth = cropData?.width || 128;
    const logoHeight = cropData?.height || 128;

    res.status(200).json({
      success: true,
      logo_url: publicUrl,
      logo_width: logoWidth,
      logo_height: logoHeight,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
    });
  }
}
```

**Nota:** Necesitarás crear un bucket en Supabase Storage llamado `chat-assets` con permisos públicos para lectura.

---

#### 3.1.4 Componente React: Panel de Configuración

```typescript
// src/components/ChatThemeConfig.tsx
import { useState, useEffect } from 'react';
import { ImageCropper } from './ImageCropper'; // Componente para recortar imagen

interface ChatThemeConfig {
  theme: 'light' | 'dark';
  accent_color: string;
  bot_message_color: 'grey' | 'accent' | string;
  background_color: string;
  text_color: string;
  header_color: 'auto' | 'accent' | string;
  border_color: 'accent' | string;
  input_color: string;
  logo_url: string | null;
  logo_width: number;
  logo_height: number;
  bot_name: string;
  welcome_message: string;
  position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';
  chat_width: 'small' | 'medium' | 'large';
}

const ACCENT_COLORS = [
  { name: 'Purple', value: '#8b5cf6' },
  { name: 'Magenta', value: '#ec4899' },
  { name: 'Orange', value: '#f97316' },
  { name: 'Yellow', value: '#eab308' },
  { name: 'Green', value: '#10b981' },
  { name: 'Blue', value: '#3b82f6' },
];

export function ChatThemeConfig() {
  const [config, setConfig] = useState<ChatThemeConfig>({
    theme: 'light',
    accent_color: '#10b981',
    bot_message_color: 'grey',
    background_color: '#ffffff',
    text_color: '#1e293b',
    header_color: 'auto',
    border_color: '#e2e8f0',
    input_color: '#f8fafc',
    logo_url: null,
    logo_width: 32,
    logo_height: 32,
    bot_name: 'Asistente',
    welcome_message: '¡Hola! ¿En qué puedo ayudarte?',
    position: 'bottom-right',
    chat_width: 'medium',
  });

  const [loading, setLoading] = useState(false);
  const [showCropper, setShowCropper] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  const fetchConfig = async () => {
    try {
      const res = await fetch('/api/get-chat-config');
      const data = await res.json();
      if (data.success && data.config) {
        setConfig(data.config);
      }
    } catch (error) {
      console.error('Error cargando configuración:', error);
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/save-chat-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config),
      });

      const data = await res.json();
      if (data.success) {
        alert('Configuración guardada exitosamente');
      } else {
        alert('Error al guardar: ' + data.error);
      }
    } catch (error) {
      alert('Error al guardar configuración');
    } finally {
      setLoading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setSelectedImage(e.target?.result as string);
        setShowCropper(true);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCropComplete = async (croppedImage: string, cropData: any) => {
    try {
      const res = await fetch('/api/upload-chat-logo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageData: croppedImage,
          cropData,
        }),
      });

      const data = await res.json();
      if (data.success) {
        setConfig({
          ...config,
          logo_url: data.logo_url,
          logo_width: data.logo_width,
          logo_height: data.logo_height,
        });
        setShowCropper(false);
        setSelectedImage(null);
      }
    } catch (error) {
      alert('Error al subir logo');
    }
  };

  return (
    <div className="chat-theme-config">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel de Configuración */}
        <div className="space-y-6">
          <div>
            <h2 className="text-2xl font-bold mb-4">
              Personaliza tu Chatbot
            </h2>
            <p className="text-slate-600">
              Cambia los colores, tema y logo para que coincida con tu marca
            </p>
          </div>

          {/* Tema */}
          <div>
            <label className="block text-sm font-medium mb-3">Tema</label>
            <div className="flex gap-4">
              <button
                onClick={() => setConfig({ ...config, theme: 'light' })}
                className={`flex-1 p-4 border-2 rounded-lg transition ${
                  config.theme === 'light'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">☀️</div>
                  <div className="font-medium">Light</div>
                </div>
              </button>
              <button
                onClick={() => setConfig({ ...config, theme: 'dark' })}
                className={`flex-1 p-4 border-2 rounded-lg transition ${
                  config.theme === 'dark'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200'
                }`}
              >
                <div className="text-center">
                  <div className="text-2xl mb-2">🌙</div>
                  <div className="font-medium">Dark</div>
                </div>
              </button>
            </div>
          </div>

          {/* Color de Acento */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color de Acento
            </label>
            <p className="text-xs text-slate-500 mb-2">
              Color para botones, mensajes del usuario y elementos destacados
            </p>
            <div className="flex gap-2 flex-wrap">
              {ACCENT_COLORS.map((color) => (
                <button
                  key={color.value}
                  onClick={() => setConfig({ ...config, accent_color: color.value })}
                  className={`w-12 h-12 rounded-full border-2 transition ${
                    config.accent_color === color.value
                      ? 'border-slate-900 scale-110'
                      : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
              <input
                type="color"
                value={config.accent_color}
                onChange={(e) => setConfig({ ...config, accent_color: e.target.value })}
                className="w-12 h-12 rounded-full border-2 border-slate-300 cursor-pointer"
              />
            </div>
          </div>

          {/* Color de Mensajes del Bot */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color de Mensajes del Bot
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              <button
                onClick={() => setConfig({ ...config, bot_message_color: 'grey' })}
                className={`px-4 py-2 border-2 rounded-lg transition ${
                  config.bot_message_color === 'grey'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200'
                }`}
              >
                Gris
              </button>
              <button
                onClick={() => setConfig({ ...config, bot_message_color: 'accent' })}
                className={`px-4 py-2 border-2 rounded-lg transition ${
                  config.bot_message_color === 'accent'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-200'
                }`}
              >
                Mismo que Acento
              </button>
            </div>
            <input
              type="color"
              value={typeof config.bot_message_color === 'string' && config.bot_message_color.startsWith('#') ? config.bot_message_color : '#f1f5f9'}
              onChange={(e) => setConfig({ ...config, bot_message_color: e.target.value })}
              className="w-full h-10 rounded border border-slate-300 cursor-pointer"
            />
          </div>

          {/* Color de Fondo */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color de Fondo del Chat
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setConfig({ ...config, background_color: config.theme === 'dark' ? '#1e293b' : '#ffffff' })}
                className="px-3 py-1 text-xs border border-slate-300 rounded"
              >
                Auto (según tema)
              </button>
            </div>
            <input
              type="color"
              value={config.background_color}
              onChange={(e) => setConfig({ ...config, background_color: e.target.value })}
              className="w-full h-10 rounded border border-slate-300 cursor-pointer"
            />
          </div>

          {/* Color del Texto */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color del Texto
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setConfig({ ...config, text_color: config.theme === 'dark' ? '#ffffff' : '#1e293b' })}
                className="px-3 py-1 text-xs border border-slate-300 rounded"
              >
                Auto (según tema)
              </button>
            </div>
            <input
              type="color"
              value={config.text_color}
              onChange={(e) => setConfig({ ...config, text_color: e.target.value })}
              className="w-full h-10 rounded border border-slate-300 cursor-pointer"
            />
          </div>

          {/* Color del Header */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color del Header
            </label>
            <div className="flex gap-2 flex-wrap mb-2">
              <button
                onClick={() => setConfig({ ...config, header_color: 'auto' })}
                className={`px-3 py-1 text-xs border rounded transition ${
                  config.header_color === 'auto'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-300'
                }`}
              >
                Auto
              </button>
              <button
                onClick={() => setConfig({ ...config, header_color: 'accent' })}
                className={`px-3 py-1 text-xs border rounded transition ${
                  config.header_color === 'accent'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-300'
                }`}
              >
                Mismo que Acento
              </button>
            </div>
            {config.header_color !== 'auto' && config.header_color !== 'accent' && (
              <input
                type="color"
                value={config.header_color}
                onChange={(e) => setConfig({ ...config, header_color: e.target.value })}
                className="w-full h-10 rounded border border-slate-300 cursor-pointer"
              />
            )}
          </div>

          {/* Color del Borde */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color del Borde
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setConfig({ ...config, border_color: 'accent' })}
                className={`px-3 py-1 text-xs border rounded transition ${
                  config.border_color === 'accent'
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-slate-300'
                }`}
              >
                Mismo que Acento
              </button>
            </div>
            {config.border_color !== 'accent' && (
              <input
                type="color"
                value={config.border_color}
                onChange={(e) => setConfig({ ...config, border_color: e.target.value })}
                className="w-full h-10 rounded border border-slate-300 cursor-pointer"
              />
            )}
          </div>

          {/* Color del Input */}
          <div>
            <label className="block text-sm font-medium mb-3">
              Color de Fondo del Input
            </label>
            <div className="flex gap-2 mb-2">
              <button
                onClick={() => setConfig({ ...config, input_color: config.theme === 'dark' ? '#1e293b' : '#f8fafc' })}
                className="px-3 py-1 text-xs border border-slate-300 rounded"
              >
                Auto (según tema)
              </button>
            </div>
            <input
              type="color"
              value={config.input_color}
              onChange={(e) => setConfig({ ...config, input_color: e.target.value })}
              className="w-full h-10 rounded border border-slate-300 cursor-pointer"
            />
          </div>

          {/* Logo */}
          <div>
            <label className="block text-sm font-medium mb-3">Logo</label>
            <div className="flex items-center gap-4">
              {config.logo_url && (
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="w-16 h-16 object-contain"
                />
              )}
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="block text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-purple-50 file:text-purple-700 hover:file:bg-purple-100"
              />
            </div>
            <p className="text-xs text-slate-500 mt-2">
              Tamaño recomendado: 128x128px. Formatos: PNG, JPG, SVG
            </p>
          </div>

          {/* Nombre del Bot */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Nombre del Bot
            </label>
            <input
              type="text"
              value={config.bot_name}
              onChange={(e) => setConfig({ ...config, bot_name: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          {/* Mensaje de Bienvenida */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Mensaje de Bienvenida
            </label>
            <textarea
              value={config.welcome_message}
              onChange={(e) => setConfig({ ...config, welcome_message: e.target.value })}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
              rows={3}
            />
          </div>

          {/* Botón Guardar */}
          <button
            onClick={handleSave}
            disabled={loading}
            className="w-full bg-purple-600 text-white py-3 rounded-lg font-semibold hover:bg-purple-700 disabled:opacity-50"
          >
            {loading ? 'Guardando...' : 'Guardar Configuración'}
          </button>
        </div>

        {/* Vista Previa */}
        <div>
          <h3 className="text-lg font-semibold mb-4">Vista Previa</h3>
          <div
            className="border rounded-lg p-4"
            style={{
              width: config.chat_width === 'small' ? '300px' : config.chat_width === 'large' ? '500px' : '400px',
              backgroundColor: config.background_color,
              color: config.text_color,
              borderColor: config.border_color === 'accent' ? config.accent_color : config.border_color,
            }}
          >
            {/* Header del Chat */}
            <div
              className="flex items-center gap-2 mb-4 pb-2 border-b"
              style={{
                backgroundColor: config.header_color === 'auto' 
                  ? (config.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
                  : config.header_color === 'accent'
                  ? config.accent_color
                  : config.header_color,
                borderColor: config.border_color === 'accent' ? config.accent_color : config.border_color,
              }}
            >
              {config.logo_url && (
                <img
                  src={config.logo_url}
                  alt="Logo"
                  className="w-8 h-8 object-contain"
                />
              )}
              <span className="font-semibold">{config.bot_name}</span>
            </div>

            {/* Mensajes */}
            <div className="space-y-3">
              {/* Mensaje del Bot */}
              <div
                className="flex gap-2"
                style={{
                  backgroundColor:
                    config.bot_message_color === 'accent'
                      ? config.accent_color
                      : config.bot_message_color === 'grey'
                      ? config.theme === 'dark'
                        ? 'rgba(255,255,255,0.1)'
                        : 'rgba(0,0,0,0.05)'
                      : config.bot_message_color,
                  padding: '12px',
                  borderRadius: '12px',
                  maxWidth: '80%',
                  color: config.bot_message_color === 'accent' ? '#ffffff' : config.text_color,
                }}
              >
                <div className="text-sm">Bot message here</div>
              </div>

              {/* Mensaje del Usuario */}
              <div className="flex justify-end">
                <div
                  className="text-sm text-white p-3 rounded-lg"
                  style={{
                    backgroundColor: config.accent_color,
                    maxWidth: '80%',
                  }}
                >
                  User message here
                </div>
              </div>
            </div>

            {/* Input de texto (vista previa) */}
            <div className="mt-4 pt-4 border-t" style={{ borderColor: config.border_color === 'accent' ? config.accent_color : config.border_color }}>
              <input
                type="text"
                placeholder="Escribe un mensaje..."
                className="w-full px-4 py-2 rounded-lg border"
                style={{
                  backgroundColor: config.input_color,
                  borderColor: config.border_color === 'accent' ? config.accent_color : config.border_color,
                  color: config.text_color,
                }}
                readOnly
              />
            </div>
          </div>
        </div>
      </div>

      {/* Modal de Recorte de Imagen */}
      {showCropper && selectedImage && (
        <ImageCropper
          image={selectedImage}
          onCropComplete={handleCropComplete}
          onCancel={() => {
            setShowCropper(false);
            setSelectedImage(null);
          }}
        />
      )}
    </div>
  );
}
```

**5. Componente: ImageCropper (Recorte de Imagen)**

```typescript
// src/components/ImageCropper.tsx
import { useState, useRef } from 'react';

interface ImageCropperProps {
  image: string;
  onCropComplete: (croppedImage: string, cropData: any) => void;
  onCancel: () => void;
}

export function ImageCropper({ image, onCropComplete, onCancel }: ImageCropperProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0, width: 128, height: 128 });
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  const handleCrop = () => {
    const canvas = canvasRef.current;
    const img = imageRef.current;
    if (!canvas || !img) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    canvas.width = crop.width;
    canvas.height = crop.height;

    ctx.drawImage(
      img,
      crop.x,
      crop.y,
      crop.width,
      crop.height,
      0,
      0,
      crop.width,
      crop.height
    );

    const croppedImage = canvas.toDataURL('image/png');
    onCropComplete(croppedImage, {
      width: crop.width,
      height: crop.height,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <h3 className="text-xl font-bold mb-4">Recortar Logo</h3>
        
        <div className="relative mb-4" style={{ maxHeight: '400px', overflow: 'hidden' }}>
          <img
            ref={imageRef}
            src={image}
            alt="Preview"
            className="max-w-full"
            onLoad={() => {
              // Inicializar crop al centro
              if (imageRef.current) {
                const img = imageRef.current;
                const size = Math.min(img.width, img.height, 128);
                setCrop({
                  x: (img.width - size) / 2,
                  y: (img.height - size) / 2,
                  width: size,
                  height: size,
                });
              }
            }}
          />
          {/* Aquí iría el overlay de recorte (usar librería como react-image-crop o similar) */}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-4">
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleCrop}
            className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            Recortar y Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
```

**Nota:** Para una mejor experiencia de recorte, se recomienda usar una librería como `react-image-crop` o `react-easy-crop`.

---

#### 3.1.5 Aplicar Configuración al Chat del Usuario

**Modificar el componente Chat para usar la configuración:**

```typescript
// src/components/Chat.tsx

// Añadir al inicio del componente
const [chatConfig, setChatConfig] = useState<any>(null);

useEffect(() => {
  fetchChatConfig();
}, []);

const fetchChatConfig = async () => {
  try {
    const res = await fetch('/api/get-chat-config');
    const data = await res.json();
    if (data.success) {
      setChatConfig(data.config);
    }
  } catch (error) {
    console.error('Error cargando configuración:', error);
  }
};

// Aplicar estilos dinámicos
const chatStyles = {
  backgroundColor: chatConfig?.background_color || (chatConfig?.theme === 'dark' ? '#1e293b' : '#ffffff'),
  color: chatConfig?.text_color || (chatConfig?.theme === 'dark' ? '#ffffff' : '#1e293b'),
  '--accent-color': chatConfig?.accent_color || '#10b981',
  borderColor: chatConfig?.border_color === 'accent' 
    ? chatConfig?.accent_color 
    : chatConfig?.border_color || '#e2e8f0',
} as React.CSSProperties;

// Aplicar estilos a elementos específicos
const headerStyles = {
  backgroundColor: chatConfig?.header_color === 'auto'
    ? (chatConfig?.theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)')
    : chatConfig?.header_color === 'accent'
    ? chatConfig?.accent_color
    : chatConfig?.header_color,
} as React.CSSProperties;

const inputStyles = {
  backgroundColor: chatConfig?.input_color || (chatConfig?.theme === 'dark' ? '#1e293b' : '#f8fafc'),
  borderColor: chatConfig?.border_color === 'accent' ? chatConfig?.accent_color : chatConfig?.border_color,
} as React.CSSProperties;
```

---

#### 3.1.6 Resumen de Funcionalidades

| Funcionalidad | Estado | Dificultad | Prioridad |
|---------------|--------|------------|-----------|
| Tema (Light/Dark) | ⬜ Pendiente | 🟢 Baja | 🔥🔥🔥 Alta |
| Color de Acento | ⬜ Pendiente | 🟢 Baja | 🔥🔥🔥 Alta |
| Color Mensajes Bot | ⬜ Pendiente | 🟢 Baja | 🔥🔥 Media |
| Color de Fondo | ⬜ Pendiente | 🟢 Baja | 🔥🔥 Media |
| Color del Texto | ⬜ Pendiente | 🟢 Baja | 🔥🔥 Media |
| Color del Header | ⬜ Pendiente | 🟢 Baja | 🔥🔥 Media |
| Color del Borde | ⬜ Pendiente | 🟢 Baja | 🔥 Media |
| Color del Input | ⬜ Pendiente | 🟢 Baja | 🔥 Media |
| Subir Logo | ⬜ Pendiente | 🟡 Media | 🔥🔥🔥 Alta |
| Recorte de Logo | ⬜ Pendiente | 🟠 Alta | 🔥🔥🔥 Alta |
| Nombre del Bot | ⬜ Pendiente | 🟢 Baja | 🔥🔥 Media |
| Mensaje Bienvenida | ⬜ Pendiente | 🟢 Baja | 🔥 Media |
| Posición Chat | ⬜ Pendiente | 🟡 Media | 🔥 Baja |
| Tamaño Chat | ⬜ Pendiente | 🟢 Baja | 🔥 Baja |
| Vista Previa | ⬜ Pendiente | 🟡 Media | 🔥🔥 Media |

**Dificultad General:** 🟡 **Media**  
**Valor Comercial:** 🔥🔥🔥🔥🔥 **Muy Alto**

---

## 3.2 Panel de Nivel de Conocimiento del Bot

**Descripción:**
Dashboard que muestra visualmente cómo evoluciona el conocimiento del bot basado en las conversaciones.

**Métricas:**
- **Total de conversaciones** procesadas
- **Tasa de éxito de respuestas** (basado en feedback)
- **Nivel de conocimiento** (0-100%): Calculado con:
  - Número de preguntas únicas respondidas
  - Tasa de satisfacción promedio
  - Cobertura de temas (categorías consultadas)
  - Resolución de consultas
- **Evolución temporal**: Gráfico de línea (últimos 30 días)
- **Temas más consultados**: Lista de categorías frecuentes
- **Áreas de mejora**: Temas con baja satisfacción

**Visualización:**
- Cards de métricas principales
- Gráfico de evolución temporal
- Indicador de progreso visual (barra circular)
- Lista de temas con nivel de conocimiento

---

### 2.2 Panel de Preguntas Más Repetidas

**Descripción:**
Identificar las preguntas más frecuentes para mejorar el bot y optimizar respuestas.

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
- **Agrupación inteligente**: Agrupar preguntas similares (NLP)
- **Exportación**: CSV/JSON
- **Acciones rápidas:**
  - Ver conversaciones relacionadas
  - Marcar como "optimizar respuesta"
  - Añadir a FAQ

**Visualización:**
- Tabla ordenable con ranking
- Gráfico de barras horizontal
- Nube de palabras
- Filtros y búsqueda

---

### 2.3 Panel de Conversiones (Respuestas → Compra)

**Descripción:**
Medir la efectividad del bot en términos de conversión a ventas.

**Métricas:**
- **Tasa de conversión general**: % de usuarios que compran después del chat
- **Número promedio de respuestas hasta compra**: Distribución
- **Funnel de conversión**:
  - Usuarios que iniciaron chat
  - Usuarios que recibieron respuesta útil
  - Usuarios que visitaron producto
  - Usuarios que añadieron al carrito
  - Usuarios que completaron compra
- **Productos más consultados antes de compra**
- **Tiempo promedio hasta compra**
- **Valor promedio de compra** tras usar el chat

**Funcionalidades:**
- **Marcado manual**: Marcar conversaciones que resultaron en compra
- **Integración con PrestaShop**: Tracking automático (si es posible)
- **Segmentación**: Por categoría, tipo de pregunta, hora, día

**Visualización:**
- Dashboard con métricas principales
- Gráfico de funnel
- Gráfico de distribución de respuestas hasta compra
- Tabla de productos más vendidos tras consulta
- Gráficos de evolución temporal

---

### 2.4 Editor Visual de Respuestas

**Descripción:**
Permitir al admin editar o crear respuestas personalizadas para preguntas frecuentes.

**Funcionalidades:**
- Editor WYSIWYG para respuestas
- Inserción de productos en respuestas
- Plantillas de respuestas
- Preview de cómo se verá la respuesta
- A/B testing de respuestas

---

### 2.5 Configuración de Comportamiento del Chat

**Descripción:**
Panel de configuración para personalizar el comportamiento del bot:
- Tiempo antes de mostrar feedback
- Número de productos a mostrar por defecto
- Estilo de las tarjetas (colores, tamaño)
- Habilitar/deshabilitar sugerencias
- Configurar mensajes de bienvenida

---

## 3. LISTA DE FUNCIONALIDADES CON DIFICULTAD

### 📊 Tabla de Funcionalidades

| # | Funcionalidad | Categoría | Dificultad | Prioridad | Estado | Notas |
|---|---------------|-----------|------------|-----------|--------|-------|
| 1 | **Tarjetas de productos en respuestas** | Chat - Presentación | 🟡 Media | 🔴 Alta | ❌ No implementado | Mostrar productos encontrados como tarjetas con imagen, info y link |
| 1.1 | **Añadir al carrito desde tarjeta** | Chat - Conversión | 🟡 Media-Alta | 🔴 Alta | ❌ No implementado | Botón para añadir producto al carrito directamente desde el chat |
| 2 | **Grid de múltiples productos** | Chat - Presentación | 🟡 Media | 🔴 Alta | ❌ No implementado | Grid responsive para mostrar varios productos |
| 3 | **Comparación de productos** | Chat - Presentación | 🟠 Alta | 🟡 Media | ❌ No implementado | Mostrar productos lado a lado para comparar |
| 4 | **Imágenes contextuales** | Chat - Presentación | 🟢 Baja | 🟡 Media | ❌ No implementado | Imágenes de categorías, diagramas, etc. |
| 5 | **Botones de acción rápida** | Chat - Interacción | 🟢 Baja | 🔴 Alta | ❌ No implementado | Botones "Ver detalles", "Añadir al carrito", etc. |
| 6 | **Feedback de utilidad** | Chat - Analytics | 🟢 Baja | 🔴 Alta | ❌ No implementado | Popup al finalizar conversación |
| 7 | **Formato enriquecido en respuestas** | Chat - Presentación | 🟢 Baja | 🟡 Media | ❌ No implementado | Negrita, listas, emojis, código formateado |
| 8 | **Indicador "Escribiendo..."** | Chat - UX | 🟢 Baja | 🟡 Media | ❌ No implementado | Animación mientras procesa |
| 9 | **Sugerencias de preguntas** | Chat - Interacción | 🟡 Media | 🟡 Media | ❌ No implementado | Botones con preguntas sugeridas |
| 10 | **Historial de conversación** | Chat - UX | 🟡 Media | 🟡 Media | ❌ No implementado | Mostrar últimos mensajes con acciones |
| 10.1 | **Sistema de memoria del bot (Documento persistente)** | Backend - IA | 🟡 Media | 🔴 Alta | ❌ No implementado | Documento que OpenAI lee/actualiza en cada consulta, con resumen para cliente |
| 11 | **Panel de nivel de conocimiento** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Dashboard con métricas de conocimiento |
| 12 | **Panel de preguntas repetidas** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Top preguntas con filtros y análisis |
| 13 | **Panel de conversiones** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Tracking de respuestas → compra |
| 14 | **Editor visual de respuestas** | Admin - Configuración | 🟠 Alta | 🟡 Media | ❌ No implementado | Editor WYSIWYG para personalizar respuestas |
| 15 | **Configuración de comportamiento** | Admin - Configuración | 🟡 Media | 🟡 Media | ❌ No implementado | Panel para configurar comportamiento del bot |

---

### 📝 Leyenda

**Dificultad:**
- 🟢 **Baja**: Implementación sencilla, < 1 día
- 🟡 **Media**: Requiere varias partes, 2-4 días
- 🟠 **Alta**: Complejo, requiere múltiples componentes, 5+ días

**Prioridad:**
- 🔴 **Alta**: Funcionalidad core, impacta directamente en la experiencia
- 🟡 **Media**: Mejora la experiencia pero no es crítica
- 🟢 **Baja**: Nice to have, puede esperar

**Estado:**
- ✅ **Implementado**: Completado y funcionando
- 🚧 **En progreso**: Actualmente en desarrollo
- ❌ **No implementado**: Pendiente de implementar

---

## 4. PRIORIZACIÓN SUGERIDA

### Fase 1 - MVP Core (Semanas 1-2)
1. Tarjetas de productos en respuestas (#1)
2. Grid de múltiples productos (#2)
3. Botones de acción rápida (#5)
4. Feedback de utilidad (#6)
5. Panel de nivel de conocimiento (#11)
6. Panel de preguntas repetidas (#12)
7. Panel de conversiones (#13)

### Fase 2 - Mejoras UX (Semanas 3-4)
1. Formato enriquecido (#7)
2. Indicador "Escribiendo..." (#8)
3. Sugerencias de preguntas (#9)
4. Historial de conversación (#10)

### Fase 3 - Funcionalidades Avanzadas (Semanas 5-6)
1. Comparación de productos (#3)
2. Imágenes contextuales (#4)
3. Editor visual de respuestas (#14)
4. Configuración de comportamiento (#15)

---

## 5. CONSIDERACIONES TÉCNICAS

### 5.1 Para las Tarjetas de Productos

**Requisitos:**
- El bot debe detectar cuando encuentra productos en la respuesta
- Necesita extraer datos del producto (imagen, precio, URL, etc.)
- Formato de respuesta estructurado (JSON o similar) para que el frontend pueda renderizar tarjetas
- Componente React/Vue para renderizar las tarjetas

**Implementación sugerida:**
- El bot devuelve un objeto estructurado además del texto
- El frontend detecta si hay productos en la respuesta
- Renderiza tarjetas en lugar de solo texto
- Fallback a texto si no hay estructura

### 5.2 Para el Sistema de Analytics

**Requisitos:**
- Base de datos para almacenar conversaciones y mensajes
- Tracking de eventos (feedback, clicks, compras)
- APIs para consultar estadísticas
- Componentes de visualización (gráficos, tablas)

**Estructura sugerida:**
- Tabla `conversations` - Sesiones de chat
- Tabla `messages` - Mensajes individuales
- Tabla `questions_analytics` - Preguntas analizadas
- Tabla `bot_knowledge_metrics` - Métricas diarias
- Tabla `conversation_products` - Productos consultados/completados

---

## 6. PRÓXIMOS PASOS

1. **Revisar y priorizar** esta lista de funcionalidades
2. **Confirmar qué funcionalidades** queremos implementar primero
3. **Crear issues/tareas** para cada funcionalidad
4. **Empezar con Fase 1** (MVP Core)

---

## 7. NOTAS ADICIONALES

- **Multi-tenancy**: Si se vende a múltiples clientes, considerar `tenant_id` en todas las tablas
- **Integración PrestaShop**: Para tracking automático de compras, necesitar webhooks o polling
- **Privacidad**: Respetar GDPR, permitir anonimización de datos
- **Performance**: Cachear métricas calculadas, usar índices apropiados
- **Responsive**: Todas las mejoras deben funcionar bien en móvil

---

## 8. RECOMENDACIONES: ¿Qué Implementar Primero?

Basándome en **impacto visual**, **valor comercial** y **facilidad de implementación**, estas son mis recomendaciones:

### 🎯 TOP 5 - Implementar PRIMERO (Mayor ROI)

#### 1. **Tarjetas de Productos en Respuestas (#1)** ⭐⭐⭐
**Por qué:**
- **Impacto visual inmediato**: Cambia completamente la experiencia del usuario
- **Aumenta conversión**: Botones directos a compra = más ventas
- **Diferencia competitiva**: La mayoría de chatbots solo muestran texto
- **Dificultad media pero vale la pena**: Requiere estructura de datos pero no es complejo

**ROI**: 🔥🔥🔥🔥🔥 (Máximo)

---

#### 1.1. **Añadir al Carrito desde Tarjeta (#1.1)** ⭐⭐⭐
**Por qué:**
- **Aumenta conversión exponencialmente**: El usuario compra sin salir del chat
- **Diferenciador clave**: Muy pocos chatbots lo hacen
- **Experiencia premium**: Todo fluido desde el chat
- **Dificultad media-alta pero vale MUCHO la pena**: Requiere integración con PrestaShop

**ROI**: 🔥🔥🔥🔥🔥 (Máximo - Aún más alto que tarjetas básicas)

**Nota**: Esta funcionalidad convierte las tarjetas de visualización en una herramienta de conversión directa.

---

#### 2. **Feedback de Utilidad (#6)** ⭐⭐⭐
**Por qué:**
- **Muy fácil de implementar** (🟢 Baja dificultad)
- **Base para todas las analíticas**: Sin feedback no hay datos
- **Valor comercial**: Los clientes quieren ver métricas de satisfacción
- **Mejora continua**: Permite identificar problemas rápidamente

**ROI**: 🔥🔥🔥🔥🔥 (Máximo - y es fácil)

---

#### 3. **Botones de Acción Rápida (#5)** ⭐⭐⭐
**Por qué:**
- **Reduce fricción**: El usuario no tiene que escribir "quiero comprar"
- **Aumenta conversión**: Un click vs escribir y buscar
- **Fácil de implementar** (🟢 Baja dificultad)
- **Complementa perfectamente** las tarjetas de productos

**ROI**: 🔥🔥🔥🔥 (Muy alto y fácil)

---

#### 4. **Panel de Preguntas Más Repetidas (#12)** ⭐⭐
**Por qué:**
- **Valor comercial alto**: Los clientes quieren saber qué preguntan sus usuarios
- **Mejora el producto**: Identifica qué optimizar
- **Diferencia competitiva**: No todos los chatbots ofrecen esto
- **Base para optimizaciones**: Permite mejorar respuestas específicas

**ROI**: 🔥🔥🔥🔥 (Alto valor comercial)

---

#### 5. **Panel de Conversiones (#13)** ⭐⭐
**Por qué:**
- **Valor comercial crítico**: "¿Cuánto vendo gracias al chat?" es la pregunta #1
- **Justificación de precio**: Permite mostrar ROI a clientes
- **Diferencia competitiva**: Muy pocos chatbots miden esto bien

**ROI**: 🔥🔥🔥🔥 (Alto valor comercial)

---

### 🟢 Quick Wins (Fáciles y con Impacto)

Estas son fáciles de implementar y mejoran la experiencia:

#### 6. **Formato Enriquecido (#7)** 
- Muy fácil (🟢 Baja)
- Mejora la legibilidad
- Hace el chat más profesional
- **Implementar junto con las tarjetas**

#### 7. **Indicador "Escribiendo..." (#8)**
- Muy fácil (🟢 Baja)
- Mejora la percepción de velocidad
- Estándar en chats modernos
- **Implementar en paralelo con otras funciones**

---

### 🟡 Segunda Ola (Después del MVP)

Una vez tengas el core funcionando, añade estas:

#### 8. **Grid de Múltiples Productos (#2)**
- Complementa las tarjetas (#1)
- Necesario cuando hay muchos resultados
- **Implementar después de #1**

#### 9. **Panel de Nivel de Conocimiento (#11)**
- Visualmente atractivo para clientes
- Muestra evolución del bot
- **Implementar después de tener feedback (#6)**

#### 10. **Sugerencias de Preguntas (#9)**
- Reduce fricción (no tienen que escribir)
- Guía al usuario
- **Implementar después del feedback**

---

### 🔴 Diferir (Para Más Tarde)

Estas son útiles pero no críticas para el MVP:

- **Comparación de productos (#3)**: Útil pero menos frecuente
- **Imágenes contextuales (#4)**: Nice to have
- **Historial de conversación (#10)**: Ya está implícito en el chat
- **Editor visual (#14)**: Avanzado, para después
- **Configuración de comportamiento (#15)**: Puede esperar

---

## 9. PLAN DE ACCIÓN RECOMENDADO

### 🚀 Sprint 1 (Semana 1-2): MVP Core
**Objetivo**: Producto vendible con funcionalidades diferenciadoras

1. ✅ **Tarjetas de Productos (#1)** - El diferenciador principal
2. ✅ **Añadir al Carrito desde Tarjeta (#1.1)** - ⚡ CRÍTICO para conversión
3. ✅ **Botones de Acción Rápida (#5)** - Complementa tarjetas
4. ✅ **Feedback de Utilidad (#6)** - Base de datos
5. ✅ **Formato Enriquecido (#7)** - Quick win
6. ✅ **Indicador "Escribiendo..." (#8)** - Quick win

**Resultado**: Chat funcional y visualmente atractivo con capacidad de añadir al carrito y feedback básico

---

### 📊 Sprint 2 (Semana 3-4): Analytics
**Objetivo**: Dashboard con métricas valiosas

1. ✅ **Panel de Preguntas Repetidas (#12)**
2. ✅ **Panel de Conversiones (#13)**
3. ✅ **Grid de Múltiples Productos (#2)**

**Resultado**: Dashboard completo con métricas comerciales

---

### 🎨 Sprint 3 (Semana 5+): Mejoras y Refinamiento
**Objetivo**: Pulir y añadir funciones avanzadas

1. ✅ **Panel de Nivel de Conocimiento (#11)**
2. ✅ **Sugerencias de Preguntas (#9)**
3. ✅ **Comparación de productos (#3)** (si hay demanda)

**Resultado**: Producto completo y pulido

---

## 10. RESUMEN DE RECOMENDACIÓN

### 🎯 Prioridad ABSOLUTA (Empezar YA):
1. **Tarjetas de Productos** - Tu diferenciador principal
2. **Añadir al Carrito desde Tarjeta** - ⚡ EL MÁS IMPORTANTE para conversión
3. **Feedback de Utilidad** - Base para todo lo demás
4. **Botones de Acción Rápida** - Aumenta conversión

### 📈 Segunda Prioridad (Después del MVP):
4. **Panel de Preguntas Repetidas** - Valor comercial alto
5. **Panel de Conversiones** - Valor comercial crítico

### ⚡ Quick Wins (Implementar en paralelo):
- Formato enriquecido
- Indicador "Escribiendo..."

---

**Conclusión**: Si implementas las **Top 5** tendrás un producto **vendible y diferenciado**. El resto son mejoras que puedes añadir según el feedback de clientes.

---

¿Qué te parece esta propuesta? ¿Quieres añadir, modificar o priorizar alguna funcionalidad?


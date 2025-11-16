# 🎯 Fase 1: MVP del Sistema de Memoria

## 📋 Objetivo

Implementar la funcionalidad básica de memoria del bot: que el bot **recuerde** información entre conversaciones y **actualice** el documento de memoria automáticamente.

**Lo que NO incluye en esta fase:**
- ❌ Generación automática de resúmenes
- ❌ Panel de Analytics
- ❌ API para obtener resúmenes

**Lo que SÍ incluye:**
- ✅ Tabla `bot_memory_documents` en Supabase
- ✅ Lectura del documento de memoria antes de cada consulta
- ✅ Actualización del documento después de cada respuesta
- ✅ Session ID en el frontend
- ✅ System prompt actualizado con instrucciones de memoria

---

## 🗄️ Paso 1: Crear Tabla en Supabase

**Archivo:** `supabase-memory-schema.sql` (nuevo)

**Tiempo estimado:** 15 minutos

```sql
-- Tabla para almacenar documentos de memoria del bot
CREATE TABLE IF NOT EXISTS bot_memory_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  session_id TEXT NOT NULL,
  document_content TEXT NOT NULL DEFAULT '',
  update_count INTEGER DEFAULT 0,
  last_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id)
);

-- Índices para búsquedas rápidas
CREATE INDEX IF NOT EXISTS idx_memory_doc_session_id ON bot_memory_documents(session_id);
CREATE INDEX IF NOT EXISTS idx_memory_doc_last_updated ON bot_memory_documents(last_updated_at DESC);

-- Política RLS (Row Level Security)
ALTER TABLE bot_memory_documents ENABLE ROW LEVEL SECURITY;

-- Permitir lectura y escritura pública (ajustar según necesidades de seguridad)
CREATE POLICY "Allow public read access" ON bot_memory_documents
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON bot_memory_documents
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON bot_memory_documents
  FOR UPDATE USING (true);

-- Función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_memory_doc_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger para actualizar updated_at
CREATE TRIGGER update_memory_doc_updated_at 
  BEFORE UPDATE ON bot_memory_documents 
  FOR EACH ROW 
  EXECUTE FUNCTION update_memory_doc_updated_at();
```

**Acción:** Ejecutar este SQL en Supabase SQL Editor

---

## 🔧 Paso 2: Modificar `api/chat.ts`

**Archivo:** `api/chat.ts`

**Tiempo estimado:** 2-3 horas

### 2.1. Añadir lectura de memoria (después de línea 104)

Después de procesar el prompt, añadir:

```typescript
// 2.5. Obtener o crear documento de memoria
const sessionId = req.body.sessionId || req.body.session_id || 'default';
let memoryDocument = '';
let updateCount = 0;

try {
  const { data: memoryDoc, error: memoryError } = await supabase
    .from('bot_memory_documents')
    .select('document_content, update_count')
    .eq('session_id', sessionId)
    .single();

  if (memoryError && memoryError.code !== 'PGRST116') {
    // Error distinto a "no encontrado"
    console.error('Error leyendo memoria:', memoryError);
  }

  if (memoryDoc) {
    memoryDocument = memoryDoc.document_content || '';
    updateCount = memoryDoc.update_count || 0;
  } else {
    // Crear documento nuevo si no existe
    const { error: insertError } = await supabase
      .from('bot_memory_documents')
      .insert({
        session_id: sessionId,
        document_content: '',
        update_count: 0,
      });
    
    if (insertError) {
      console.error('Error creando documento de memoria:', insertError);
    }
  }
} catch (error) {
  console.error('Error en operación de memoria:', error);
  // Continuar sin memoria si hay error
}
```

### 2.2. Añadir memoria al system prompt (después de línea 104)

```typescript
// 2.6. Añadir contexto de memoria al system prompt
const memoryContext = memoryDocument 
  ? `\n\n## MEMORIA DEL USUARIO:\n${memoryDocument}\n\nIMPORTANTE: Usa esta información para personalizar tu respuesta. Recuerda lo que el usuario ha consultado anteriormente.` 
  : '';

const systemPromptWithMemory = systemPrompt + memoryContext;
```

### 2.3. Modificar el system prompt para incluir instrucciones de memoria

En el system prompt (que viene de Supabase), añadir estas instrucciones al final:

```typescript
// Esto se añade al systemPrompt que viene de Supabase
const memoryInstructions = `

## INSTRUCCIONES SOBRE MEMORIA:

Tienes acceso a un documento de memoria que contiene información sobre las interacciones previas con este usuario.

INSTRUCCIONES:
1. Si hay un documento de memoria, LÉELO para entender el contexto del usuario
2. Usa esa información para personalizar tu respuesta
3. Al final de tu respuesta, actualiza el documento de memoria con información relevante

FORMATO DE RESPUESTA:
Al final de tu respuesta, añade una sección especial con el formato:
[MEMORIA_ACTUALIZADA]
[nueva información a añadir al documento]
[/MEMORIA_ACTUALIZADA]

Ejemplo:
[MEMORIA_ACTUALIZADA]
Usuario consultó: aceite de oliva ecológico. Interesado en precio.
[/MEMORIA_ACTUALIZADA]

Mantén el documento organizado y actualizado con:
- Preferencias del usuario (categorías, tipos de productos)
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento
`;

const systemPromptWithMemory = systemPrompt + memoryContext + memoryInstructions;
```

### 2.4. Actualizar mensajes para usar el prompt con memoria

Cambiar línea 356:
```typescript
// ANTES:
const messages: any[] = [
  { role: 'system', content: systemPrompt },
  ...limitedHistory,
  { role: 'user', content: message }
];

// DESPUÉS:
const messages: any[] = [
  { role: 'system', content: systemPromptWithMemory },
  ...limitedHistory,
  { role: 'user', content: message }
];
```

### 2.5. Extraer y guardar documento actualizado (después de obtener respuesta de OpenAI)

Buscar donde se procesa la respuesta final (después de línea 767, donde se retorna la respuesta):

```typescript
// ANTES de retornar la respuesta (línea ~767)
// Extraer documento actualizado de la respuesta
let updatedDocument = memoryDocument; // Por defecto, mantener el documento actual

if (responseMessage.content) {
  // Buscar sección [MEMORIA_ACTUALIZADA]...[/MEMORIA_ACTUALIZADA]
  const memoryRegex = /\[MEMORIA_ACTUALIZADA\](.*?)\[\/MEMORIA_ACTUALIZADA\]/s;
  const memoryMatch = responseMessage.content.match(memoryRegex);
  
  if (memoryMatch && memoryMatch[1]) {
    const newMemoryContent = memoryMatch[1].trim();
    
    // Combinar documento existente con nuevo contenido
    if (memoryDocument) {
      updatedDocument = `${memoryDocument}\n\n${newMemoryContent}`;
    } else {
      updatedDocument = newMemoryContent;
    }
    
    // Limitar tamaño del documento (máximo 5000 caracteres)
    if (updatedDocument.length > 5000) {
      // Mantener solo los últimos 5000 caracteres
      updatedDocument = updatedDocument.slice(-5000);
    }
    
    // Incrementar contador
    updateCount = updateCount + 1;
    
    // Guardar documento actualizado en Supabase
    try {
      const { error: updateError } = await supabase
        .from('bot_memory_documents')
        .update({
          document_content: updatedDocument,
          update_count: updateCount,
          last_updated_at: new Date().toISOString(),
        })
        .eq('session_id', sessionId);
      
      if (updateError) {
        console.error('Error actualizando documento de memoria:', updateError);
      }
    } catch (error) {
      console.error('Error guardando memoria:', error);
      // No fallar si no se puede guardar la memoria
    }
    
    // Remover la sección de memoria de la respuesta antes de mostrar al usuario
    responseMessage.content = responseMessage.content.replace(memoryRegex, '').trim();
  }
}
```

### 2.6. Aplicar el mismo proceso para respuestas con función

Buscar donde se procesa `secondCompletion` (después de línea 695) y aplicar el mismo código de extracción de memoria.

---

## 🎨 Paso 3: Añadir Session ID en Frontend

**Archivo:** `src/components/Chat.tsx`

**Tiempo estimado:** 30 minutos

### 3.1. Añadir estado para sessionId

```typescript
// Añadir después de los otros useState (línea ~15)
const [sessionId, setSessionId] = useState<string>('');

// Añadir useEffect para generar/recuperar sessionId
useEffect(() => {
  // Generar o recuperar session_id desde localStorage
  let storedSessionId = localStorage.getItem('chat_session_id');
  if (!storedSessionId) {
    storedSessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    localStorage.setItem('chat_session_id', storedSessionId);
  }
  setSessionId(storedSessionId);
}, []);
```

### 3.2. Modificar llamada a sendChatMessage

```typescript
// Modificar línea ~59
const response = await sendChatMessage(
  inputMessage.trim(),
  conversationHistory,
  config,
  sessionId // Añadir sessionId
);
```

---

## 🔌 Paso 4: Modificar `chatService.ts`

**Archivo:** `src/services/chatService.ts`

**Tiempo estimado:** 15 minutos

### 4.1. Añadir sessionId al parámetro

```typescript
// Modificar función sendChatMessage (línea ~8)
export async function sendChatMessage(
  message: string,
  conversationHistory: ChatMessage[] = [],
  config: ChatConfig,
  sessionId?: string // Añadir parámetro opcional
): Promise<ChatResponse> {
  try {
    const response = await fetch(`${API_BASE}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        conversationHistory,
        config,
        sessionId // Añadir al body
      }),
    });
    // ... resto del código igual
  }
}
```

---

## 📝 Paso 5: Actualizar System Prompt en Supabase

**Tiempo estimado:** 30 minutos

**Acción:** Ir a Supabase → Tabla `system_prompts` → Editar el prompt activo

Añadir al final del prompt existente:

```
---

## INSTRUCCIONES SOBRE MEMORIA DEL USUARIO:

Tienes acceso a un documento de memoria que contiene información sobre las interacciones previas con este usuario.

INSTRUCCIONES:
1. Si hay un documento de memoria en la sección "MEMORIA DEL USUARIO", LÉELO para entender el contexto del usuario
2. Usa esa información para personalizar tu respuesta y recordar preferencias del usuario
3. Al final de tu respuesta, actualiza el documento de memoria con información relevante de esta interacción

FORMATO DE ACTUALIZACIÓN:
Al final de tu respuesta (después del texto normal), añade una sección especial con el formato:
[MEMORIA_ACTUALIZADA]
[nueva información a añadir al documento]
[/MEMORIA_ACTUALIZADA]

Ejemplo de uso:
Si el usuario pregunta "¿Tienes aceite de oliva ecológico?", responde normalmente y luego añade:
[MEMORIA_ACTUALIZADA]
Usuario consultó: aceite de oliva ecológico. Interesado en productos ecológicos.
[/MEMORIA_ACTUALIZADA]

Información a incluir en el documento:
- Preferencias del usuario (categorías, tipos de productos, rango de precio)
- Productos consultados
- Necesidades detectadas
- Patrones de comportamiento (si se detectan)
- Cualquier información relevante para futuras interacciones

Mantén el documento organizado y actualizado. Si es la primera interacción, crea el documento inicial.
```

---

## ✅ Checklist de Implementación Fase 1

- [ ] Ejecutar SQL para crear tabla `bot_memory_documents` en Supabase
- [ ] Modificar `api/chat.ts`:
  - [ ] Añadir lectura de documento de memoria (Paso 2.1)
  - [ ] Añadir memoria al system prompt (Paso 2.2)
  - [ ] Añadir instrucciones de memoria al prompt (Paso 2.3)
  - [ ] Modificar mensajes para usar prompt con memoria (Paso 2.4)
  - [ ] Extraer y guardar documento actualizado en respuestas sin función (Paso 2.5)
  - [ ] Extraer y guardar documento actualizado en respuestas con función (Paso 2.6)
- [ ] Modificar `src/components/Chat.tsx`:
  - [ ] Añadir estado y useEffect para sessionId (Paso 3.1)
  - [ ] Pasar sessionId a sendChatMessage (Paso 3.2)
- [ ] Modificar `src/services/chatService.ts`:
  - [ ] Añadir sessionId como parámetro (Paso 4.1)
- [ ] Actualizar system prompt en Supabase (Paso 5)
- [ ] Probar:
  - [ ] Hacer una pregunta en el chat
  - [ ] Verificar que se crea documento en `bot_memory_documents`
  - [ ] Hacer segunda pregunta
  - [ ] Verificar que el bot "recuerda" la primera pregunta
  - [ ] Verificar que el documento se actualiza en Supabase

---

## 🧪 Cómo Probar la Fase 1

1. **Primera consulta:**
   - Usuario: "¿Tienes aceite de oliva ecológico?"
   - Bot debe responder normalmente
   - Verificar en Supabase que existe registro en `bot_memory_documents` con `session_id` y `document_content` contiene información sobre aceite de oliva

2. **Segunda consulta (sin mencionar aceite):**
   - Usuario: "¿Qué precio tiene?"
   - Bot debe responder refiriéndose al aceite de oliva ecológico que consultó antes
   - Verificar que el documento se actualiza con la nueva información

3. **Tercera consulta:**
   - Usuario: "¿Qué otros productos ecológicos tienes?"
   - Bot debe recordar que el usuario está interesado en productos ecológicos
   - Verificar que el documento contiene información sobre preferencia por productos ecológicos

---

## 📊 Resultado Esperado

Después de la Fase 1, el bot:
- ✅ Recuerda información entre conversaciones
- ✅ Personaliza respuestas basándose en consultas anteriores
- ✅ Actualiza automáticamente el documento de memoria
- ✅ Mantiene un documento persistente por sesión

**Próximos pasos (Fase 2):**
- Generación automática de resúmenes
- Panel de Analytics para visualizar datos

---

**Tiempo total estimado Fase 1:** 4-6 horas  
**Dificultad:** Media  
**Riesgo:** Bajo










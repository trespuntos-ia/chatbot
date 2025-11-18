# Solución: Error de Información Contradictoria en Respuestas RAG

## Problema Identificado

El sistema RAG estaba generando respuestas que **contradecían la información del catálogo**. 

**Ejemplo del error:**
- **Descripción del producto dice:** "Estas vajillas son aptas para microondas, horno, salamandra, grill y lavavajillas..."
- **Respuesta del chat decía:** "No se puede utilizar en microondas" ❌

## Causa del Problema

1. **Temperatura muy alta (0.7)**: Permitía demasiada "creatividad" al modelo, haciendo que inventara o interpretara información incorrectamente.

2. **Prompt no suficientemente estricto**: El prompt no era lo suficientemente explícito sobre NO contradicir la información del contexto.

3. **Falta de validación**: No había logging para detectar cuando el contexto contenía información específica que luego se negaba en la respuesta.

## Solución Implementada

### 1. Prompt Mejorado y Más Estricto

**Antes:**
```typescript
const systemPrompt = `Eres ChefCopilot...
REGLAS ESTRICTAS:
1. SOLO puedes responder usando la información proporcionada...
2. NUNCA inventes información...
`;
```

**Ahora:**
```typescript
const systemPrompt = `Eres ChefCopilot...

REGLAS ESTRICTAS Y CRÍTICAS:
1. SOLO puedes responder usando EXACTAMENTE la información proporcionada...
2. NUNCA inventes, asumas o deduzcas información que no esté EXPLÍCITAMENTE escrita...
3. NUNCA contradigas la información del contexto. Si el contexto dice "aptas para microondas", 
   NO digas que no se pueden usar en microondas.
4. Si el contexto menciona características específicas, repite EXACTAMENTE esas características 
   sin modificarlas ni negarlas.
5. Si no encuentras información específica, di claramente: "No encontré información sobre..."
6. NUNCA uses conocimiento general o información que no esté en el contexto proporcionado.

INSTRUCCIONES DE RESPUESTA:
- Lee cuidadosamente TODO el contexto antes de responder.
- Si el contexto dice que un producto es "apto para X", confirma que es apto para X.
- Si el contexto menciona múltiples características, menciona TODAS las relevantes.
- Responde usando EXACTAMENTE las palabras y frases del contexto cuando sea posible.

IMPORTANTE: Tu respuesta DEBE reflejar fielmente lo que dice el contexto. 
No interpretes, no asumas, no deduzcas. Solo repite y organiza la información 
que está explícitamente escrita.`;
```

### 2. Temperatura Reducida

**Antes:** `temperature: 0.7` (más creativo, menos preciso)  
**Ahora:** `temperature: 0.3` (más preciso, menos creativo)

Esto hace que el modelo sea más determinista y siga más fielmente el contexto proporcionado.

### 3. Mensaje de Usuario Mejorado

**Antes:**
```typescript
content: `Contexto del catálogo:\n${contextText}\n\nPregunta del usuario: ${message}`
```

**Ahora:**
```typescript
content: `Contexto del catálogo (usa SOLO esta información):\n${contextText}\n\nPregunta del usuario: ${message}\n\nIMPORTANTE: Responde usando EXACTAMENTE la información del contexto. Si el contexto dice que es apto para microondas, confirma que es apto para microondas.`
```

### 4. Logging Mejorado para Debugging

Se añadió logging específico para detectar problemas:

```typescript
console.log('[chat-rag] Full context length:', contextText.length);
console.log('[chat-rag] Context preview (first 1000 chars):', contextText.substring(0, 1000));
if (contextText.toLowerCase().includes('microondas')) {
  console.log('[chat-rag] ⚠️ Context contains "microondas" - checking for contradictions...');
  const microondasMatches = contextText.match(/microondas[^.]*\./gi);
  if (microondasMatches) {
    console.log('[chat-rag] Found microondas mentions:', microondasMatches);
  }
}
```

## Cómo Verificar que Funciona

1. **Haz una pregunta sobre un producto específico** que tenga información clara en la descripción.

2. **Revisa los logs de Vercel** para ver:
   - El contexto completo que se envió
   - Si hay menciones de características específicas
   - La respuesta generada

3. **Verifica que la respuesta coincida** exactamente con la información del contexto.

## Próximos Pasos Recomendados

1. **Monitorear respuestas**: Revisar periódicamente las respuestas para detectar cualquier inconsistencia.

2. **Añadir validación post-respuesta**: Podríamos añadir una validación que compare palabras clave del contexto con la respuesta para detectar contradicciones automáticamente.

3. **Considerar usar GPT-4**: GPT-4 es más preciso que GPT-3.5-turbo para seguir instrucciones estrictas, aunque es más costoso.

4. **Añadir citas de fuente**: Mostrar al usuario de dónde viene cada pieza de información (ej: "Según la descripción del producto...").

## Archivos Modificados

- `api/chat-rag.ts`: Mejorado el prompt, reducida la temperatura, añadido logging

## Estado

✅ **Desplegado en producción** - Los cambios ya están activos.


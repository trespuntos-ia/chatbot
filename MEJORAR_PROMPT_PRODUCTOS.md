# 📋 Cómo Funciona el Sistema de Prompts

## Explicación del Sistema

El sistema de prompts funciona de la siguiente manera:

1. **Almacenamiento en Supabase**: Los prompts se guardan en la tabla `system_prompts`
2. **Prompt Activo**: Solo UN prompt puede estar activo (`is_active = true`)
3. **Carga Automática**: Cuando el usuario hace una pregunta, el sistema:
   - Carga el prompt activo desde Supabase
   - Procesa las variables (ej: `{{language}}` → `español`)
   - Lo usa como "system prompt" para OpenAI
4. **Editable desde UI**: Puedes editar el prompt desde la pestaña "Configuración AI" en el dashboard

## Flujo Actual

```
Usuario pregunta → API carga prompt activo → Procesa variables → Envía a OpenAI → Respuesta
```

## Mejoras Necesarias para Productos

Cuando OpenAI busca productos y:
- ❌ No encuentra coincidencia exacta → Debe preguntar y mostrar opciones
- ❌ Hay múltiples productos similares → Debe listar opciones y preguntar cuál
- ✅ Encuentra coincidencia exacta → Puede confirmar directamente


# 📋 INSTRUCCIONES: Fase 1 - Configuración de Prompts

## ✅ Estado: IMPLEMENTADO

La Fase 1 está completa. Ahora necesitas seguir estos pasos para activarla.

---

## 🚀 PASOS PARA ACTIVAR

### Paso 1: Ejecutar Schema en Supabase

1. Ve a tu proyecto en **Supabase Dashboard**
2. Abre el **SQL Editor**
3. Copia el contenido de `supabase-prompts-schema.sql`
4. Pega y ejecuta el script
5. Verifica que las tablas se hayan creado:
   - `system_prompts`
   - `prompt_variables`

### Paso 2: Verificar Variables de Entorno

Asegúrate de que en **Vercel** tienes configuradas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### Paso 3: Probar la Funcionalidad

1. Ejecuta tu aplicación localmente o despliega en Vercel
2. Ve al Dashboard
3. Haz clic en la pestaña **"Configuración AI"**
4. Deberías ver:
   - Un prompt por defecto ya creado
   - Lista de prompts guardados
   - Editor de prompts

---

## 📁 ARCHIVOS CREADOS

### Backend (API)
- ✅ `api/prompts.ts` - Endpoint completo para CRUD de prompts

### Frontend
- ✅ `src/services/promptService.ts` - Servicio para gestionar prompts
- ✅ `src/components/PromptConfig.tsx` - Componente del editor de prompts
- ✅ `src/components/Dashboard.tsx` - Actualizado con nueva pestaña
- ✅ `src/types.ts` - Tipos TypeScript actualizados

### Base de Datos
- ✅ `supabase-prompts-schema.sql` - Schema completo para Supabase

---

## 🎯 FUNCIONALIDADES IMPLEMENTADAS

### ✅ Gestión de Prompts
- Crear nuevos prompts
- Editar prompts existentes
- Eliminar prompts
- Activar/desactivar prompts (solo uno activo a la vez)

### ✅ Variables Dinámicas
- Detección automática de variables en el prompt (`{{variable_name}}`)
- Edición de valores de variables
- Vista previa del prompt procesado

### ✅ Interfaz de Usuario
- Lista de prompts guardados
- Editor de prompts con vista previa
- Indicador visual de prompt activo
- Mensajes de éxito/error

---

## 🧪 CÓMO PROBAR

### 1. Crear un Nuevo Prompt

1. Ve a "Configuración AI"
2. Haz clic en "+ Nuevo Prompt"
3. Completa:
   - Nombre: "Mi Prompt de Prueba"
   - Prompt: "Eres un asistente... {{language}}"
4. Si usas variables, se detectarán automáticamente
5. Completa los valores de las variables
6. Haz clic en "Crear Prompt"

### 2. Activar un Prompt

1. Selecciona un prompt de la lista
2. Haz clic en "Activar"
3. El prompt se marcará como activo (badge verde)
4. Todos los demás prompts se desactivarán automáticamente

### 3. Editar un Prompt

1. Selecciona un prompt de la lista
2. Modifica el texto o las variables
3. Haz clic en "Guardar Cambios"
4. La vista previa se actualiza en tiempo real

---

## 🔍 VERIFICACIÓN

### Verificar en Supabase

Ejecuta esta query en SQL Editor para verificar:

```sql
-- Ver todos los prompts
SELECT * FROM system_prompts ORDER BY created_at DESC;

-- Ver variables de un prompt
SELECT * FROM prompt_variables WHERE prompt_id = 'TU_PROMPT_ID';

-- Ver prompt activo
SELECT * FROM system_prompts WHERE is_active = true;
```

### Verificar en la Aplicación

1. Abre la consola del navegador (F12)
2. Ve a "Configuración AI"
3. No deberías ver errores en la consola
4. Los prompts deberían cargarse correctamente

---

## ⚠️ PROBLEMAS COMUNES

### Error: "Supabase configuration missing"
- Verifica que las variables de entorno estén configuradas en Vercel
- Reinicia el servidor de desarrollo

### Error: "Table does not exist"
- Ejecuta el script SQL en Supabase
- Verifica que las tablas se hayan creado

### Los prompts no se cargan
- Verifica la consola del navegador para errores
- Verifica que el endpoint `/api/prompts` funcione
- Revisa las políticas RLS en Supabase

### Las variables no se detectan
- Asegúrate de usar el formato correcto: `{{variable_name}}`
- Las variables deben tener nombres válidos (sin espacios, sin caracteres especiales)

---

## 📝 NOTAS IMPORTANTES

1. **Solo un prompt activo**: El sistema permite solo un prompt activo a la vez. Al activar uno, se desactivan automáticamente los demás.

2. **Variables dinámicas**: Las variables se detectan automáticamente del texto del prompt. Solo necesitas escribir `{{nombre_variable}}` en el prompt.

3. **Vista previa**: La vista previa muestra el prompt con las variables reemplazadas. Úsala para verificar que todo esté correcto.

4. **Prompt por defecto**: Se crea un prompt por defecto al ejecutar el schema SQL. Puedes editarlo o crear nuevos.

---

## 🎯 PRÓXIMOS PASOS

Una vez que la Fase 1 esté funcionando correctamente, podemos continuar con:

- **Fase 2**: Chat básico con OpenAI (usará los prompts que configures)
- **Fase 3**: Sistema de documentos (RAG)
- **Fase 4**: Multi-plataforma (WooCommerce)
- **Fase 5**: Web scraping

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Schema SQL ejecutado en Supabase
- [ ] Tablas creadas correctamente
- [ ] Variables de entorno configuradas en Vercel
- [ ] Aplicación funcionando localmente o desplegada
- [ ] Pestaña "Configuración AI" visible en el Dashboard
- [ ] Puedo crear un nuevo prompt
- [ ] Puedo editar un prompt existente
- [ ] Puedo activar un prompt
- [ ] Las variables se detectan automáticamente
- [ ] La vista previa funciona correctamente

---

¿Todo funcionando? ¡Perfecto! Avísame cuando esté listo para continuar con la Fase 2 (Chat con OpenAI).


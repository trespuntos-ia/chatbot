# 🔧 Solución: Dashboard No Muestra Información

## ❌ Problema

El dashboard muestra "Cargando..." pero nunca muestra los prompts guardados.

## 🔍 Posibles Causas

1. **La tabla `system_prompts` no existe en Supabase**
2. **El endpoint `/api/prompts` está fallando**
3. **Error de conexión o CORS**
4. **Variables de entorno no configuradas**

---

## ✅ Solución Paso a Paso

### Paso 1: Verificar que las Tablas Existen

Ve a **Supabase Dashboard** → **SQL Editor** y ejecuta:

```sql
-- Verificar si existe la tabla system_prompts
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'system_prompts'
);

-- Verificar si existe la tabla prompt_variables
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'prompt_variables'
);
```

**Si retorna `false`**, necesitas crear las tablas.

### Paso 2: Crear las Tablas (si no existen)

Ejecuta en **Supabase SQL Editor**:

**Opción A: Script completo (recomendado)**
```sql
-- Copia y pega el contenido completo de:
-- supabase-prompts-schema-safe.sql
```

**Opción B: Crear manualmente**

1. Ejecuta `supabase-prompts-schema-safe.sql` completo en Supabase SQL Editor

### Paso 3: Verificar el Endpoint

Abre la consola del navegador (F12) y revisa si hay errores.

**Probar el endpoint manualmente:**

```bash
# Desde terminal o navegador
curl https://tu-proyecto.vercel.app/api/prompts
```

O desde el navegador, abre:
```
https://tu-proyecto.vercel.app/api/prompts
```

**Deberías ver:**
```json
{
  "success": true,
  "prompts": [...]
}
```

### Paso 4: Verificar Variables de Entorno

En Vercel Dashboard → Settings → Environment Variables, verifica que tienes:

- ✅ `SUPABASE_URL`
- ✅ `SUPABASE_ANON_KEY`

### Paso 5: Verificar en la Consola del Navegador

1. Abre el dashboard
2. Presiona F12 para abrir DevTools
3. Ve a la pestaña **Console**
4. Busca errores relacionados con:
   - `fetch`
   - `prompts`
   - `CORS`
   - `404`
   - `500`

---

## 🐛 Errores Comunes y Soluciones

### Error: "Failed to fetch"
**Causa**: El endpoint no está disponible o hay problema de CORS

**Solución**:
- Verifica que el proyecto está desplegado en Vercel
- Verifica que la URL del endpoint es correcta
- Revisa los logs de Vercel Functions

### Error: "Table does not exist"
**Causa**: La tabla `system_prompts` no existe

**Solución**:
- Ejecuta `supabase-prompts-schema-safe.sql` en Supabase

### Error: "Supabase configuration missing"
**Causa**: Variables de entorno no configuradas

**Solución**:
- Configura `SUPABASE_URL` y `SUPABASE_ANON_KEY` en Vercel

### Error: 404 Not Found
**Causa**: El endpoint `/api/prompts` no existe o la ruta está mal

**Solución**:
- Verifica que `api/prompts.ts` existe
- Verifica que está desplegado correctamente
- Revisa `vercel.json` para asegurar que los rewrites están correctos

---

## 📋 Checklist de Diagnóstico

Ejecuta estos pasos en orden:

- [ ] **Verificar tablas en Supabase:**
  ```sql
  SELECT * FROM system_prompts LIMIT 1;
  ```

- [ ] **Probar endpoint directamente:**
  ```bash
  curl https://tu-proyecto.vercel.app/api/prompts
  ```

- [ ] **Revisar consola del navegador:**
  - Abre DevTools (F12)
  - Ve a Console
  - Busca errores

- [ ] **Verificar variables de entorno:**
  - Vercel Dashboard → Settings → Environment Variables
  - Verifica que `SUPABASE_URL` y `SUPABASE_ANON_KEY` están configuradas

- [ ] **Revisar logs de Vercel:**
  - Vercel Dashboard → Deployments → Selecciona el último deployment
  - Ve a "Functions" → Busca `/api/prompts`
  - Revisa los logs para errores

---

## 🔧 Solución Rápida

Si quieres una solución rápida, ejecuta esto en Supabase SQL Editor:

```sql
-- Crear tabla si no existe
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  structured_fields JSONB
);

CREATE TABLE IF NOT EXISTS prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Habilitar RLS y crear políticas básicas
ALTER TABLE system_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_variables ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read access to prompts" ON system_prompts;
CREATE POLICY "Allow public read access to prompts" ON system_prompts
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to prompts" ON system_prompts;
CREATE POLICY "Allow public write access to prompts" ON system_prompts
  FOR ALL USING (true);

DROP POLICY IF EXISTS "Allow public read access to variables" ON prompt_variables;
CREATE POLICY "Allow public read access to variables" ON prompt_variables
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Allow public write access to variables" ON prompt_variables;
CREATE POLICY "Allow public write access to variables" ON prompt_variables
  FOR ALL USING (true);
```

Luego recarga el dashboard.

---

## 📝 Después de Solucionar

Una vez que las tablas estén creadas y el endpoint funcione:

1. **Recarga el dashboard** (F5)
2. **Deberías ver** la lista de prompts (o un mensaje diciendo que no hay prompts)
3. **Crea un prompt de prueba** usando el botón "+ Nuevo Prompt"

---

## 💡 Debugging Adicional

Si aún no funciona, revisa:

1. **Network Tab en DevTools:**
   - Ve a Network
   - Recarga la página
   - Busca la petición a `/api/prompts`
   - Revisa el Status Code y la Response

2. **Logs del Servidor:**
   - Si estás en local: revisa la terminal donde corre `vercel dev`
   - Si está en Vercel: revisa los logs en el dashboard

3. **Verificar que el componente se está montando:**
   - Agrega un `console.log` en `loadPrompts()` para verificar que se ejecuta

---

## ✅ Verificación Final

Después de aplicar las soluciones, deberías poder:

- ✅ Ver la lista de prompts (aunque esté vacía)
- ✅ Crear un nuevo prompt
- ✅ Ver prompts existentes si los hay
- ✅ No ver "Cargando..." indefinidamente

Si aún tienes problemas, comparte:
1. El error exacto de la consola del navegador
2. El resultado de `curl https://tu-proyecto.vercel.app/api/prompts`
3. Si las tablas existen en Supabase


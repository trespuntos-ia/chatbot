# 🐛 Guía de Debugging - Errores de Supabase

## 🔍 Paso 1: Verificar el Error Exacto

El error que ves ahora debería ser más descriptivo. Anota el mensaje completo.

## 🧪 Paso 2: Probar la Conexión a Supabase

He creado un endpoint de prueba. Después de desplegar, visita:

**https://chatbot-v2-murex.vercel.app/api/test-supabase**

Este endpoint te dirá:
- ✅ Si las variables de entorno están configuradas
- ✅ Si la conexión a Supabase funciona
- ✅ Si la tabla `products` existe
- ❌ Qué error específico está ocurriendo

## 🔧 Problemas Comunes y Soluciones

### Error: "Supabase configuration missing"

**Causa**: Las variables de entorno no están configuradas en Vercel.

**Solución**:
1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
2. Verifica que existen estas dos variables:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
3. Si no existen, agrégalas (ver `CONFIGURACION-RAPIDA.md`)
4. **IMPORTANTE**: Después de agregar, haz redeploy

### Error: "Table not found" o "PGRST116"

**Causa**: La tabla `products` no existe en Supabase.

**Solución**:
1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
2. Ve a **SQL Editor** (menú lateral izquierdo)
3. Haz clic en **New query**
4. Abre el archivo `supabase-schema.sql` de este proyecto
5. Copia TODO el contenido
6. Pégalo en el editor SQL
7. Haz clic en **Run** (o presiona Cmd/Ctrl + Enter)
8. Espera a que se ejecute
9. Verifica en **Table Editor** que la tabla `products` existe

### Error: "Permission denied" o "42501"

**Causa**: Las políticas RLS (Row Level Security) están bloqueando el acceso.

**Solución**:
1. Ve a Supabase → **Table Editor** → Tabla `products`
2. Haz clic en los tres puntos (⋯) → **Edit Policies**
3. Verifica que existen políticas que permitan SELECT, INSERT, UPDATE
4. Si no existen, ejecuta este SQL en SQL Editor:

```sql
-- Permitir lectura pública
CREATE POLICY "Allow public read access" ON products
  FOR SELECT USING (true);

-- Permitir inserción pública
CREATE POLICY "Allow public insert access" ON products
  FOR INSERT WITH CHECK (true);

-- Permitir actualización pública
CREATE POLICY "Allow public update access" ON products
  FOR UPDATE USING (true);
```

### Error: "Error fetching products" (genérico)

**Causa**: Puede ser varios problemas.

**Solución**:
1. Abre la consola del navegador (F12 → Console)
2. Busca el error exacto
3. Revisa los logs de Vercel:
   - Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2
   - Ve a **Deployments** → Último deployment → **Logs**
   - Busca errores relacionados con Supabase

## 📋 Checklist de Verificación

Usa este checklist para verificar que todo está configurado:

- [ ] Variables de entorno configuradas en Vercel:
  - [ ] `SUPABASE_URL` está configurada
  - [ ] `SUPABASE_ANON_KEY` está configurada
  - [ ] Ambas están en Production, Preview y Development

- [ ] Tabla creada en Supabase:
  - [ ] La tabla `products` existe en Supabase
  - [ ] Puedes verla en Table Editor

- [ ] Políticas RLS configuradas:
  - [ ] Hay políticas que permiten SELECT
  - [ ] Hay políticas que permiten INSERT
  - [ ] Hay políticas que permiten UPDATE

- [ ] Deployment actualizado:
  - [ ] Hiciste redeploy después de agregar variables
  - [ ] El deployment se completó sin errores

- [ ] Endpoint de prueba funciona:
  - [ ] Visita: `/api/test-supabase`
  - [ ] Debería mostrar `success: true`

## 🆘 Obtener Ayuda

Si sigues teniendo problemas:

1. **Ejecuta el endpoint de prueba** y comparte el resultado
2. **Revisa los logs de Vercel** y comparte el error exacto
3. **Abre la consola del navegador** (F12) y comparte cualquier error
4. **Verifica en Supabase** que la tabla existe y tiene datos

## 🔗 Enlaces Útiles

- Dashboard de Vercel: https://vercel.com/tres-puntos-projects/chatbot-v2
- Variables de entorno: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
- Supabase Dashboard: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
- SQL Editor en Supabase: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz/sql/new


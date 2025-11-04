# 🚀 Guía de Despliegue en Vercel

## ✅ Checklist Pre-Deploy

Antes de desplegar, verifica:

- [x] Schema de base de datos ejecutado en Supabase
- [x] Tablas `system_prompts` y `prompt_variables` creadas
- [x] Variables de entorno configuradas en Vercel:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
- [x] Archivos de código listos:
  - `api/prompts.ts` ✅
  - `src/components/PromptConfig.tsx` ✅
  - `src/components/Dashboard.tsx` ✅
  - `src/services/promptService.ts` ✅

---

## 🚀 Despliegue

### Opción 1: Desde Vercel CLI (Recomendado)

```bash
# 1. Asegúrate de estar en el directorio del proyecto
cd /Users/jordi/Documents/GitHub/chatbot2

# 2. Verifica que Vercel CLI está instalado
vercel --version

# 3. Si no está instalado, instálalo:
npm i -g vercel

# 4. Despliega a producción
vercel --prod
```

### Opción 2: Desde GitHub (Automático)

Si tienes el proyecto conectado a GitHub:

1. Haz commit de los cambios:
   ```bash
   git add .
   git commit -m "Fase 1: Sistema de configuración de prompts"
   git push origin main
   ```

2. Vercel desplegará automáticamente cuando detecte el push

### Opción 3: Desde Vercel Dashboard

1. Ve a https://vercel.com
2. Selecciona tu proyecto
3. Ve a **Deployments**
4. Haz clic en **Redeploy** en el último deployment
5. O haz un nuevo commit y push

---

## ⚙️ Verificar Variables de Entorno

**IMPORTANTE**: Antes de desplegar, asegúrate de que estas variables estén configuradas:

1. Ve a Vercel Dashboard → Tu Proyecto → **Settings** → **Environment Variables**

2. Verifica que tienes:
   - `SUPABASE_URL` - URL de tu proyecto Supabase
   - `SUPABASE_ANON_KEY` - Clave pública anónima

3. Si faltan, agrégalas:
   - Name: `SUPABASE_URL`
   - Value: `https://tu-proyecto.supabase.co`
   - Environment: ✅ Production, ✅ Preview, ✅ Development

4. Haz clic en **Save**

---

## 🔍 Verificar el Deploy

Después del deploy:

1. **Verifica la URL**: Ve a tu aplicación desplegada
   - Ejemplo: `https://tu-proyecto.vercel.app`

2. **Prueba la nueva funcionalidad**:
   - Ve al Dashboard
   - Haz clic en la pestaña **"Configuración AI"**
   - Deberías ver el prompt "Default Prompt"
   - Puedes crear y editar prompts

3. **Verifica los logs** si hay problemas:
   - Vercel Dashboard → **Deployments** → Selecciona el deployment → **Logs**

---

## 🐛 Solución de Problemas

### Error: "Supabase configuration missing"
- **Solución**: Verifica que las variables de entorno estén configuradas en Vercel
- Redesplega después de agregar las variables

### Error: "Table does not exist"
- **Solución**: Ejecuta el script `supabase-prompts-schema.sql` en Supabase SQL Editor

### La pestaña "Configuración AI" no aparece
- **Solución**: 
  1. Verifica que el build fue exitoso
  2. Revisa la consola del navegador (F12) para errores
  3. Asegúrate de que el código está actualizado en el repositorio

### Las variables de entorno no funcionan
- **Solución**: 
  1. Verifica que están configuradas para todos los ambientes (Production, Preview, Development)
  2. Haz un redeploy completo después de agregar/modificar variables

---

## 📝 Notas Importantes

- ⚠️ **Las variables de entorno solo se aplican a nuevos deployments**
- Después de agregar/modificar variables, SIEMPRE redesplega
- El build puede tardar 1-2 minutos
- Si cambias código, haz commit y push para que Vercel detecte los cambios

---

## ✅ Después del Deploy Exitoso

Una vez que todo funcione:

1. ✅ Fase 1 completada
2. ✅ Sistema de prompts funcionando
3. ✅ Listo para continuar con Fase 2 (Chat con OpenAI)

---

¿Listo para desplegar? Ejecuta el comando de deploy cuando estés listo.


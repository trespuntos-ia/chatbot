# Desplegar Funcionalidad de Documentación en Vercel

## ✅ Verificación de Archivos

Los siguientes archivos necesitan estar en el repositorio para que Vercel los despliegue:

### Archivos de API (en `/api/`):
- ✅ `upload-document.ts` - Subir documentos
- ✅ `get-documents.ts` - Obtener lista de documentos
- ✅ `delete-document.ts` - Eliminar documentos
- ✅ `search-documents.ts` - Buscar en documentos

### Archivos Frontend:
- ✅ `src/components/Documentation.tsx` - Componente de documentación
- ✅ `src/components/Dashboard.tsx` - Actualizado con nueva pestaña

### Archivos de Base de Datos:
- ✅ `supabase-documents-schema.sql` - Esquema SQL para crear tabla

## 📋 Pasos para Desplegar

### 1. Verificar Cambios Locales

```bash
git status
```

Deberías ver los nuevos archivos y cambios modificados.

### 2. Añadir Archivos al Repositorio

```bash
# Añadir todos los archivos nuevos y modificados
git add api/upload-document.ts
git add api/get-documents.ts
git add api/delete-document.ts
git add api/search-documents.ts
git add src/components/Documentation.tsx
git add src/components/Dashboard.tsx
git add src/types.ts
git add supabase-documents-schema.sql
git add package.json
git add DOCUMENTACION-SETUP.md

# O añadir todos los cambios de una vez
git add .
```

### 3. Hacer Commit

```bash
git commit -m "feat: Add document upload and management functionality

- Add document upload API endpoint
- Add document listing and deletion endpoints
- Add document search functionality
- Add Documentation component to Dashboard
- Add Supabase schema for documents table
- Integrate document search with OpenAI chat"
```

### 4. Push a GitHub

```bash
git push origin main
```

### 5. Verificar en Vercel

1. Ve a tu dashboard de Vercel: https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Verifica que se haya iniciado un nuevo deployment automáticamente
4. Espera a que termine el build

### 6. Verificar Variables de Entorno

Asegúrate de que estas variables estén configuradas en Vercel:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `OPENAI_API_KEY`

Configuración en Vercel:
1. Ve a Settings → Environment Variables
2. Verifica que todas las variables estén configuradas
3. Asegúrate de que estén disponibles para Production, Preview y Development

### 7. Ejecutar el Schema SQL en Supabase

**IMPORTANTE**: Antes de usar la funcionalidad, debes crear la tabla en Supabase:

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor**
3. Abre el archivo `supabase-documents-schema.sql`
4. Copia y pega el contenido completo
5. Ejecuta el script

Esto creará la tabla `documents` necesaria.

## 🔍 Verificar que el Deploy Funciona

### 1. Verificar que las Rutas API Están Disponibles

Después del deploy, verifica que las rutas estén disponibles:
- `https://tu-dominio.vercel.app/api/upload-document` (POST)
- `https://tu-dominio.vercel.app/api/get-documents` (GET)
- `https://tu-dominio.vercel.app/api/delete-document` (DELETE)

### 2. Verificar Logs de Vercel

Si hay errores:
1. Ve a tu proyecto en Vercel
2. Click en "Deployments"
3. Selecciona el último deployment
4. Click en "Functions" para ver los logs de las funciones serverless

### 3. Probar la Funcionalidad

1. Abre tu aplicación desplegada
2. Ve a la pestaña "Documentación"
3. Intenta subir un archivo pequeño (ej: un archivo de texto de 1KB)
4. Verifica que aparezca en la lista
5. Intenta eliminarlo

## 🐛 Troubleshooting

### Error: "Function not found"
- Verifica que los archivos estén en la carpeta `/api/`
- Verifica que los archivos estén en el repositorio (git push)
- Verifica que el deployment haya terminado correctamente

### Error: "Module not found"
- Verifica que `package.json` incluya las dependencias:
  - `pdf-parse`
  - `mammoth`
- Haz un nuevo deploy después de actualizar `package.json`

### Error: "Database error"
- Verifica que hayas ejecutado `supabase-documents-schema.sql` en Supabase
- Verifica que las variables de entorno `SUPABASE_URL` y `SUPABASE_ANON_KEY` estén configuradas

### Error: "413 Content Too Large"
- Esto es normal si el archivo es mayor a 3MB
- El límite es 3MB para el archivo original (debido a limitaciones de Vercel)

## 📝 Notas Importantes

1. **Las dependencias `pdf-parse` y `mammoth` deben estar en `package.json`** - Ya están añadidas, pero verifica que estén en el repositorio.

2. **Vercel detecta automáticamente las funciones en `/api/`** - No necesitas configuración adicional en `vercel.json` para las funciones serverless.

3. **El primer deploy puede tardar más** - Especialmente si Vercel necesita instalar las nuevas dependencias.

4. **Revisa los logs si algo falla** - Los logs de Vercel te dirán exactamente qué está pasando.




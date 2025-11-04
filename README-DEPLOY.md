# Configuración de Despliegue en Vercel

## Problema del 404

Si estás obteniendo un error 404 en `https://chatbot-v2-murex.vercel.app/`, es porque el proyecto en Vercel está buscando archivos en la raíz del repositorio, pero la aplicación está en el subdirectorio `prestashop-products-app/`.

## Solución

Tienes dos opciones:

### Opción 1: Configurar Root Directory en Vercel (Recomendado)

1. Ve a: https://vercel.com/tres-puntos-projects/chatbot-v2/settings
2. En la sección **"Root Directory"**, selecciona o escribe: `prestashop-products-app`
3. Guarda los cambios
4. Vercel automáticamente redesplegará el proyecto

### Opción 2: Usar vercel.json en la raíz

Ya existe un `vercel.json` en la raíz del repositorio que debería funcionar, pero puede que necesites hacer un nuevo despliegue.

### Verificar Configuración

El proyecto debería tener:
- **Framework**: Vite
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Root Directory**: `prestashop-products-app` (si usas Opción 1)

## Desplegar Manualmente

Si tienes acceso al equipo, puedes desplegar desde la terminal:

```bash
cd prestashop-products-app
vercel --prod
```


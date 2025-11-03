# Solución al Error 404 en Vercel

## El Problema
Vercel está devolviendo 404 porque no encuentra los archivos construidos.

## Solución Paso a Paso

### Opción A: Configurar Root Directory en Vercel Dashboard (RECOMENDADO)

1. Ve a tu proyecto en Vercel: https://vercel.com/dashboard
2. Click en **Settings**
3. En la sección **General**, busca **Root Directory**
4. Configura **Root Directory** como: `frontend-angular`
5. **NO** configures Build Command ni Output Directory (déjalos en blanco)
6. Guarda los cambios
7. Ve a **Deployments** y haz un nuevo deploy

### Opción B: Mover vercel.json dentro de frontend-angular

Si la Opción A no funciona:

1. Mueve el `vercel.json` de la raíz a `frontend-angular/`
2. Actualiza el contenido a:

```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist/prestashop-products/browser",
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

3. En Vercel Dashboard, configura **Root Directory** como: `frontend-angular`

### Verificación

Después de desplegar, verifica en los logs:

1. El build se completa exitosamente
2. Los archivos se generan en `dist/prestashop-products/browser/`
3. El archivo `index.html` existe

Si aún no funciona, revisa los logs de build en Vercel para ver qué error específico aparece.


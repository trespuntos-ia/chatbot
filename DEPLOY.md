# Guía de Despliegue en Vercel

## Configuración del Proyecto en Vercel

Para desplegar correctamente la aplicación Angular en Vercel, sigue estos pasos:

### Opción 1: Configuración desde el Dashboard de Vercel

1. Ve a tu proyecto en Vercel
2. Ve a **Settings** → **General**
3. Configura el **Root Directory** como `frontend-angular`
4. Configura el **Build Command** como `npm run build`
5. Configura el **Output Directory** como `dist/prestashop-products/browser`
6. Guarda los cambios

### Opción 2: Usar vercel.json (Actual)

Si estás usando el `vercel.json` en la raíz del proyecto:

1. Asegúrate de que el `vercel.json` esté en la raíz del repositorio
2. El build se ejecutará desde `frontend-angular/`
3. Los archivos se servirán desde `frontend-angular/dist/prestashop-products/browser`

### Solución de Problemas

Si obtienes un error 404:

1. **Verifica el Root Directory**: En Vercel Dashboard → Settings → General, el Root Directory debe ser `frontend-angular` o dejar vacío si el `vercel.json` está en la raíz.

2. **Verifica el Output Directory**: Debe ser `dist/prestashop-products/browser` (relativo al Root Directory)

3. **Verifica que el build se complete**: Revisa los logs de build en Vercel para asegurarte de que el build se completa exitosamente.

4. **Verifica el index.html**: Asegúrate de que el archivo `index.html` se genere en `dist/prestashop-products/browser/index.html`

### Estructura Esperada Después del Build

```
frontend-angular/
  dist/
    prestashop-products/
      browser/
        index.html
        main-[hash].js
        styles-[hash].css
        ...
```

### Configuración de Variables de Entorno

Si necesitas configurar variables de entorno para la URL del backend:

1. Ve a **Settings** → **Environment Variables**
2. Agrega `API_URL` con la URL de tu backend Laravel
3. Actualiza los servicios en Angular para usar `process.env['API_URL']` o configura la variable directamente


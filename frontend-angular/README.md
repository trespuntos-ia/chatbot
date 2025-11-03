# PrestaShop Products Frontend

Aplicación Angular para obtener y gestionar productos de PrestaShop.

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm start
```

La aplicación estará disponible en `http://localhost:4200`

## Build para producción

```bash
npm run build
```

El build estará en la carpeta `dist/prestashop-products`

## Configuración

Asegúrate de configurar la URL de la API en `src/app/services/auth.service.ts` y `src/app/services/product.service.ts` si tu backend está en una URL diferente a `http://localhost:8000`.


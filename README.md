# PrestaShop Products App

Aplicación React para obtener y visualizar productos de PrestaShop a través de su API.

## Características

- 🔐 Autenticación con API Key de PrestaShop
- 📊 Barra de progreso en tiempo real durante la descarga
- 📋 Tabla interactiva con todos los productos
- 🔍 Búsqueda y filtrado de productos
- 💾 Exportación a CSV y JSON
- 📱 Diseño responsive

## Requisitos

- Node.js 18+ 
- npm o yarn

## Instalación

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

La aplicación estará disponible en `http://localhost:5173`

## Construcción

```bash
npm run build
```

## Despliegue en Vercel

1. Instala Vercel CLI (si no lo tienes):
```bash
npm i -g vercel
```

2. Desde la carpeta del proyecto, ejecuta:
```bash
vercel
```

3. Sigue las instrucciones en pantalla para configurar el proyecto.

O simplemente conecta tu repositorio en GitHub a Vercel desde el dashboard.

## Uso

1. Ingresa tu **API Key** de PrestaShop
2. Ingresa la **URL de la API** (ej: `https://tu-tienda.com/api/`)
3. Opcionalmente configura la URL base, código de idioma y slug
4. Haz clic en "Conectar y Obtener Productos"
5. Espera a que se descarguen todos los productos (se mostrará el progreso)
6. Explora los productos en la tabla
7. Exporta los datos en CSV o JSON usando los botones correspondientes

## Estructura del Proyecto

```
prestashop-products-app/
├── src/
│   ├── components/
│   │   ├── AuthForm.tsx       # Formulario de autenticación
│   │   ├── ProgressBar.tsx    # Barra de progreso
│   │   └── ProductTable.tsx   # Tabla de productos
│   ├── services/
│   │   └── prestashopApi.ts   # Lógica de API
│   ├── utils/
│   │   └── export.ts          # Funciones de exportación
│   ├── types.ts              # Tipos TypeScript
│   ├── App.tsx               # Componente principal
│   └── main.tsx              # Punto de entrada
├── vercel.json               # Configuración de Vercel
└── package.json
```

## Tecnologías

- React 19
- TypeScript
- Vite
- Tailwind CSS

## 📚 Documentación

Toda la documentación del proyecto está organizada en la carpeta `docs/`:

- **Sistema de Chat**: Ver [docs/chat-sistema/](./docs/chat-sistema/README.md)
  - Lógica completa del sistema
  - Plan de mejoras
  - Análisis de viabilidad y costos
  - Propuestas y mejoras

Para más información, consulta [docs/README.md](./docs/README.md)

## Licencia

MIT

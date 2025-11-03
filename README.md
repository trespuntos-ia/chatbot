# PrestaShop Products Manager

Aplicación completa para obtener y gestionar productos de PrestaShop, construida con Angular (frontend) y Laravel (backend).

## Características

- ✅ Autenticación con API Key y contraseña
- ✅ Obtención de productos con barra de progreso en tiempo real
- ✅ Tabla completa con todos los datos de productos
- ✅ Enlaces a productos en PrestaShop
- ✅ Guardado de productos en base de datos
- ✅ Interfaz moderna y responsive

## Estructura del Proyecto

```
├── backend-laravel/     # API Laravel
├── frontend-angular/   # Aplicación Angular
└── conexion-prestashop/ # Script PHP original (referencia)
```

## Instalación

### Backend (Laravel)

```bash
cd backend-laravel
composer install
cp .env.example .env
php artisan key:generate

# Configurar base de datos (SQLite por defecto)
touch database/database.sqlite
php artisan migrate
```

### Frontend (Angular)

```bash
cd frontend-angular
npm install
```

## Configuración

### Backend

1. Edita `.env` y configura:
   - `DB_DATABASE`: Ruta absoluta a tu base de datos SQLite
   - `SESSION_DRIVER`: Driver de sesión (file por defecto)
   - `CORS_ALLOWED_ORIGINS`: Orígenes permitidos para CORS

### Frontend

1. Si tu backend está en una URL diferente, edita:
   - `src/app/services/auth.service.ts`
   - `src/app/services/product.service.ts`

   Cambia `http://localhost:8000` por tu URL del backend.

## Uso

### Desarrollo

**Backend:**
```bash
cd backend-laravel
php artisan serve
# Servidor en http://localhost:8000
```

**Frontend:**
```bash
cd frontend-angular
npm start
# Aplicación en http://localhost:4200
```

### Producción

#### Para Vercel (Frontend)

1. Build del frontend:
```bash
cd frontend-angular
npm run build
```

2. Configura Vercel para servir desde `dist/prestashop-products`

3. Asegúrate de configurar las variables de entorno para la URL del backend

#### Backend

El backend Laravel puede desplegarse en cualquier servidor que soporte PHP 8.1+:
- Servidor compartido
- VPS
- Heroku
- Railway
- etc.

## API Endpoints

### Autenticación
- `POST /api/auth/login` - Iniciar sesión
- `GET /api/auth/check` - Verificar autenticación
- `POST /api/auth/logout` - Cerrar sesión

### Productos
- `GET /api/products/fetch?offset=0&limit=150&session_id=xxx` - Obtener productos paginados
- `GET /api/products/progress?session_id=xxx` - Obtener progreso
- `GET /api/products/all?session_id=xxx` - Obtener todos los productos de la sesión
- `POST /api/products/save` - Guardar productos
- `GET /api/products/saved` - Obtener productos guardados

## Requisitos

- PHP 8.1+
- Composer
- Node.js 18+
- npm o yarn
- Base de datos SQLite (o MySQL/PostgreSQL configurado)

## Notas

- Las credenciales se almacenan en sesión del servidor
- Los productos se obtienen en chunks de 150 para mejor rendimiento
- La barra de progreso muestra el avance en tiempo real
- Los productos se guardan en la base de datos local

## Licencia

MIT


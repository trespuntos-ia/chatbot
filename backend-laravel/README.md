# PrestaShop Products API (Laravel)

API REST para obtener y gestionar productos de PrestaShop.

## Instalación

```bash
composer install
cp .env.example .env
php artisan key:generate
touch database/database.sqlite
php artisan migrate
```

## Configuración

Edita `.env`:
- `DB_DATABASE`: Ruta absoluta a `database.sqlite`
- `SESSION_DRIVER`: `file` (por defecto)
- `CORS_ALLOWED_ORIGINS`: Orígenes permitidos separados por coma

## Ejecutar

```bash
php artisan serve
```

## Endpoints

Ver README principal para detalles completos de la API.


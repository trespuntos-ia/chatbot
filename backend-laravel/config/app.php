<?php

return [
    'name' => env('APP_NAME', 'PrestaShop Products API'),
    'env' => env('APP_ENV', 'production'),
    'debug' => env('APP_DEBUG', false),
    'url' => env('APP_URL', 'http://localhost'),
    'timezone' => 'UTC',
    'locale' => 'es',
    'fallback_locale' => 'en',
    'faker_locale' => 'es_ES',
    'key' => env('APP_KEY'),
    'cipher' => 'AES-256-CBC',
    'providers' => [
        Illuminate\Cache\CacheServiceProvider::class,
        Illuminate\Database\DatabaseServiceProvider::class,
        Illuminate\Filesystem\FilesystemServiceProvider::class,
        Illuminate\Foundation\Providers\FoundationServiceProvider::class,
        Illuminate\Routing\RouteServiceProvider::class,
        Illuminate\Session\SessionServiceProvider::class,
        Illuminate\Validation\ValidationServiceProvider::class,
        Illuminate\View\ViewServiceProvider::class,
        App\Providers\AppServiceProvider::class,
        App\Providers\RouteServiceProvider::class,
    ],
];


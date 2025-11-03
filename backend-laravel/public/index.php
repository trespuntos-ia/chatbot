<?php

use Illuminate\Http\Request;

define('LARAVEL_START', microtime(true));

// Cargar el autoloader de Composer
require __DIR__ . '/../vendor/autoload.php';

// Cargar la aplicación Laravel
$app = require_once __DIR__ . '/../bootstrap/app.php';

// Manejar la solicitud
$kernel = $app->make(Illuminate\Contracts\Http\Kernel::class);

$response = $kernel->handle(
    $request = Request::capture()
);

$response->send();

$kernel->terminate($request, $response);


<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\ProductController;
use Illuminate\Support\Facades\Route;

// Rutas de autenticación
Route::post('/auth/login', [AuthController::class, 'login']);
Route::get('/auth/check', [AuthController::class, 'check']);
Route::post('/auth/logout', [AuthController::class, 'logout']);

// Rutas de productos (requieren autenticación)
Route::middleware('auth.session')->group(function () {
    Route::get('/products/fetch', [ProductController::class, 'fetchProducts']);
    Route::get('/products/progress', [ProductController::class, 'getProgress']);
    Route::get('/products/all', [ProductController::class, 'getAllProducts']);
    Route::post('/products/save', [ProductController::class, 'saveProducts']);
    Route::get('/products/saved', [ProductController::class, 'getSavedProducts']);
});


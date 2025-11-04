<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;

class AuthController extends Controller
{
    /**
     * Autentica al usuario con API key y contraseña
     */
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'api_key' => 'required|string',
            'password' => 'required|string',
            'prestashop_url' => 'required|url',
        ]);

        // Guardar credenciales en sesión
        session([
            'api_key' => $request->api_key,
            'password' => $request->password,
            'prestashop_url' => rtrim($request->prestashop_url, '/'),
            'authenticated' => true,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Autenticación exitosa',
        ]);
    }

    /**
     * Verifica si el usuario está autenticado
     */
    public function check(): JsonResponse
    {
        return response()->json([
            'authenticated' => session('authenticated', false),
        ]);
    }

    /**
     * Cierra la sesión
     */
    public function logout(): JsonResponse
    {
        session()->flush();
        return response()->json([
            'success' => true,
            'message' => 'Sesión cerrada',
        ]);
    }
}


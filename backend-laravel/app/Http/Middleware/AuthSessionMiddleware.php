<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;

class AuthSessionMiddleware
{
    public function handle(Request $request, Closure $next)
    {
        if (!session('authenticated')) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        return $next($request);
    }
}


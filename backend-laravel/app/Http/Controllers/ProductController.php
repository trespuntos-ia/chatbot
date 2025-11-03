<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use App\Services\PrestaShopService;
use App\Models\Product;

class ProductController extends Controller
{
    protected $prestaShopService;

    public function __construct(PrestaShopService $prestaShopService)
    {
        $this->prestaShopService = $prestaShopService;
    }

    /**
     * Obtiene productos de PrestaShop con progreso
     */
    public function fetchProducts(Request $request): JsonResponse
    {
        if (!session('authenticated')) {
            return response()->json(['error' => 'No autenticado'], 401);
        }

        $offset = $request->input('offset', 0);
        $limit = $request->input('limit', 150);
        $sessionId = $request->input('session_id', uniqid());

        try {
            $result = $this->prestaShopService->getProducts(
                session('prestashop_url'),
                session('api_key'),
                $offset,
                $limit
            );

            // Guardar progreso en sesión
            $progress = session("progress_{$sessionId}", [
                'total' => 0,
                'current' => 0,
                'products' => [],
            ]);

            $progress['current'] = $offset + count($result['products']);
            $progress['products'] = array_merge($progress['products'], $result['products']);
            
            if (isset($result['total'])) {
                $progress['total'] = $result['total'];
            }

            session(["progress_{$sessionId}" => $progress]);

            return response()->json([
                'success' => true,
                'products' => $result['products'],
                'has_more' => $result['has_more'] ?? false,
                'progress' => $progress,
                'session_id' => $sessionId,
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtiene el progreso actual
     */
    public function getProgress(Request $request): JsonResponse
    {
        $sessionId = $request->input('session_id');
        if (!$sessionId) {
            return response()->json(['error' => 'Session ID requerido'], 400);
        }

        $progress = session("progress_{$sessionId}", [
            'total' => 0,
            'current' => 0,
            'products' => [],
        ]);

        return response()->json([
            'progress' => $progress,
        ]);
    }

    /**
     * Obtiene todos los productos de la sesión
     */
    public function getAllProducts(Request $request): JsonResponse
    {
        $sessionId = $request->input('session_id');
        if (!$sessionId) {
            return response()->json(['error' => 'Session ID requerido'], 400);
        }

        $progress = session("progress_{$sessionId}", [
            'products' => [],
        ]);

        return response()->json([
            'products' => $progress['products'],
            'total' => count($progress['products']),
        ]);
    }

    /**
     * Guarda productos en la base de datos
     */
    public function saveProducts(Request $request): JsonResponse
    {
        $request->validate([
            'products' => 'required|array',
        ]);

        try {
            $saved = 0;
            $errors = [];

            foreach ($request->products as $productData) {
                try {
                    Product::updateOrCreate(
                        ['sku' => $productData['sku'] ?? ''],
                        [
                            'name' => $productData['name'] ?? '',
                            'price' => $productData['price'] ?? '',
                            'category' => $productData['category'] ?? '',
                            'description' => $productData['description'] ?? '',
                            'image' => $productData['image'] ?? '',
                            'product_url' => $productData['product_url'] ?? '',
                            'sku' => $productData['sku'] ?? '',
                        ]
                    );
                    $saved++;
                } catch (\Exception $e) {
                    $errors[] = $e->getMessage();
                }
            }

            return response()->json([
                'success' => true,
                'saved' => $saved,
                'errors' => $errors,
                'message' => "Se guardaron {$saved} productos exitosamente",
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'error' => $e->getMessage(),
            ], 500);
        }
    }

    /**
     * Obtiene productos guardados
     */
    public function getSavedProducts(): JsonResponse
    {
        $products = Product::all();
        return response()->json([
            'products' => $products,
            'total' => $products->count(),
        ]);
    }
}


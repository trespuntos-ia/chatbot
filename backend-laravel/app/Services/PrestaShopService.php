<?php

namespace App\Services;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;

class PrestaShopService
{
    protected $client;

    public function __construct()
    {
        $this->client = new Client([
            'timeout' => 30,
            'connect_timeout' => 10,
            'verify' => true,
        ]);
    }

    /**
     * Realiza una solicitud GET a la API de PrestaShop
     */
    public function makeRequest(string $baseUrl, string $apiKey, string $endpoint, array $query = []): ?array
    {
        $query['ws_key'] = $apiKey;
        $query['output_format'] = 'JSON';

        $url = rtrim($baseUrl, '/') . '/api/' . ltrim($endpoint, '/');
        if (!empty($query)) {
            $url .= '?' . http_build_query($query);
        }

        try {
            $response = $this->client->get($url, [
                'auth' => [$apiKey, ''],
                'headers' => [
                    'User-Agent' => 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0)',
                ],
            ]);

            $body = $response->getBody()->getContents();
            $data = json_decode($body, true);

            return is_array($data) ? $data : null;
        } catch (GuzzleException $e) {
            throw new \Exception('Error al conectar con PrestaShop: ' . $e->getMessage());
        }
    }

    /**
     * Obtiene productos paginados
     */
    public function getProducts(string $baseUrl, string $apiKey, int $offset = 0, int $limit = 150): array
    {
        $query = [
            'language' => 1,
            'limit' => "{$offset},{$limit}",
            'display' => '[id,id_default_image,name,price,reference,link_rewrite,ean13,id_category_default,description_short]',
            'sort' => 'id_ASC',
        ];

        $response = $this->makeRequest($baseUrl, $apiKey, 'products', $query);

        if (empty($response['products'])) {
            return [
                'products' => [],
                'has_more' => false,
                'total' => 0,
            ];
        }

        $products = [];
        $categoryCache = [];

        foreach ($response['products'] as $product) {
            $products[] = $this->mapProduct($product, $baseUrl, $categoryCache);
        }

        return [
            'products' => $products,
            'has_more' => count($response['products']) === $limit,
            'total' => count($response['products']),
        ];
    }

    /**
     * Mapea un producto de PrestaShop
     */
    protected function mapProduct(array $product, string $baseUrl, array &$categoryCache): array
    {
        $name = $this->extractMultilanguageValue($product['name'] ?? '');
        $description = $this->extractMultilanguageValue($product['description_short'] ?? '');

        $category = '';
        if (!empty($product['id_category_default'])) {
            $category = $this->getCategoryName($baseUrl, $product['id_category_default'], $categoryCache);
        }

        $linkRewrite = $this->extractMultilanguageValue($product['link_rewrite'] ?? '');
        $imageId = $product['id_default_image'] ?? '';
        $imageUrl = '';

        if (!empty($imageId) && !empty($linkRewrite)) {
            $imageUrl = rtrim($baseUrl, '/') . '/' . $imageId . '-medium_default/' . $linkRewrite . '.jpg';
        }

        $price = '';
        if (isset($product['price'])) {
            $price = number_format((float) $product['price'], 2, ',', '.');
        }

        $productUrl = '';
        if (!empty($linkRewrite)) {
            $productUrl = rtrim($baseUrl, '/') . '/es/' . $product['id'] . '-' . $linkRewrite;
            if (!empty($product['ean13'])) {
                $productUrl .= '-' . $product['ean13'];
            }
            $productUrl .= '.html';
        }

        return [
            'id' => $product['id'] ?? '',
            'name' => $name,
            'price' => $price,
            'category' => $category,
            'description' => strip_tags($description, '<p><br><strong><em><ul><ol><li>'),
            'sku' => !empty($product['reference']) ? $product['reference'] : ($product['ean13'] ?? ''),
            'image' => $imageUrl,
            'product_url' => $productUrl,
        ];
    }

    /**
     * Extrae valor multilenguaje
     */
    protected function extractMultilanguageValue($field): string
    {
        if (is_string($field)) {
            return $field;
        }

        if (is_array($field)) {
            if (isset($field[0]['value'])) {
                return $field[0]['value'];
            }
            if (isset($field['value'])) {
                return $field['value'];
            }
            $first = reset($field);
            if (is_array($first) && isset($first['value'])) {
                return $first['value'];
            }
        }

        return '';
    }

    /**
     * Obtiene el nombre de una categoría
     */
    protected function getCategoryName(string $baseUrl, int $categoryId, array &$cache): string
    {
        if (empty($categoryId)) {
            return '';
        }

        if (isset($cache[$categoryId])) {
            return $cache[$categoryId];
        }

        try {
            $response = $this->makeRequest($baseUrl, session('api_key'), "categories/{$categoryId}", [
                'language' => 1,
            ]);

            if (!empty($response['category'])) {
                $name = $this->extractMultilanguageValue($response['category']['name'] ?? '');
                $cache[$categoryId] = $name;
                return $name;
            }
        } catch (\Exception $e) {
            // Silenciar errores de categoría
        }

        return '';
    }
}


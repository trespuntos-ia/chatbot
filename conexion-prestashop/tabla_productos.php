<?php

/**
 * Script para obtener productos desde la API de PrestaShop y mostrarlos en una tabla paginada.
 * Requiere tener configuradas las constantes de acceso a la API.
 */

// Configuración de la API de PrestaShop.
if (!defined('API_KEY')) {
    define('API_KEY', 'E5CUG6DLAD9EA46AIN7Z2LIX1W3IIJKZ');
}

if (!defined('PRESTASHOP_URL')) {
    define('PRESTASHOP_URL', 'https://100x100chef.com/shop/api/');
}

if (!defined('BASE_URL')) {
    define('BASE_URL', 'https://100x100chef.com/shop/');
}

if (!defined('PRESTASHOP_LANG_CODE')) {
    define('PRESTASHOP_LANG_CODE', 1);
}

if (!defined('PRESTASHOP_LANG_SLUG')) {
    define('PRESTASHOP_LANG_SLUG', 'es');
}

// Aumentamos los límites de tiempo y memoria para manejar catálogos grandes.
if (function_exists('ini_set')) {
    @ini_set('memory_limit', '512M');
    @ini_set('max_execution_time', '120');
}

if (function_exists('set_time_limit')) {
    @set_time_limit(0);
}

/**
 * Realiza una solicitud GET a la API de PrestaShop.
 *
 * @param string $endpoint Ruta del recurso (por ejemplo, "products").
 * @param array  $query    Parámetros de la consulta.
 *
 * @return array|null
 */
function prestashop_get($endpoint, array $query = [])
{
    $query['ws_key'] = API_KEY;
    $query['output_format'] = 'JSON';

    $query_string = [];
    foreach ($query as $clave => $valor) {
        $query_string[] = $clave . '=' . urlencode($valor);
    }

    $url = rtrim(PRESTASHOP_URL, '/') . '/' . ltrim($endpoint, '/');
    if (!empty($query_string)) {
        $url .= '?' . implode('&', $query_string);
    }

    $headers = [
        'Authorization: Basic ' . base64_encode(API_KEY . ':'),
        'User-Agent: Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0; +https://100x100chef.com)'
    ];

    $curl = curl_init($url);
    curl_setopt_array($curl, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_USERPWD => API_KEY . ':',
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
        CURLOPT_HTTPAUTH => CURLAUTH_BASIC,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (compatible; PrestaShopProductGrid/1.0; +https://100x100chef.com)',
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_TIMEOUT => 30,
    ]);

    $cuerpo = curl_exec($curl);
    if ($cuerpo === false) {
        if (isset($_GET['debug']) && $_GET['debug'] === '1') {
            echo '<pre class="bg-red-100 p-4 overflow-x-auto text-xs">cURL error: ' . htmlspecialchars(curl_error($curl), ENT_QUOTES, 'UTF-8') . '</pre>';
        }
        curl_close($curl);
        return null;
    }

    if (isset($_GET['debug']) && $_GET['debug'] === '1') {
        echo '<pre class="bg-yellow-100 p-4 overflow-x-auto text-xs">' . htmlspecialchars($cuerpo, ENT_QUOTES, 'UTF-8') . '</pre>';
    }

    curl_close($curl);

    $datos = json_decode($cuerpo, true);

    if ($datos === null && json_last_error() !== JSON_ERROR_NONE && isset($_GET['debug']) && $_GET['debug'] === '1') {
        echo '<pre class="bg-red-100 p-4 overflow-x-auto text-xs">JSON error: ' . htmlspecialchars(json_last_error_msg(), ENT_QUOTES, 'UTF-8') . '</pre>';
    }

    return is_array($datos) ? $datos : null;
}

/**
 * Extrae un valor compatible con múltiples formatos devueltos por la API.
 *
 * @param mixed $campo Campo devuelto por la API.
 *
 * @return string
 */
function extraer_valor_multilenguaje($campo)
{
    if (is_string($campo)) {
        return $campo;
    }

    if (is_array($campo)) {
        if (isset($campo[0]['value'])) {
            return $campo[0]['value'];
        }

        if (isset($campo['value'])) {
            return $campo['value'];
        }

        $primer = reset($campo);
        if (is_array($primer) && isset($primer['value'])) {
            return $primer['value'];
        }
    }

    return '';
}

/**
 * Obtiene el nombre de la categoría por su ID.
 *
 * @param int   $category_id ID de la categoría.
 * @param array $cache       Referencia al array de caché local.
 *
 * @return string
 */
function obtener_nombre_categoria($category_id, array &$cache)
{
    if (empty($category_id)) {
        return '';
    }

    if (isset($cache[$category_id])) {
        return $cache[$category_id];
    }

    $respuesta = prestashop_get("categories/{$category_id}", ['language' => PRESTASHOP_LANG_CODE]);

    if (!empty($respuesta['category'])) {
        $nombre = extraer_valor_multilenguaje($respuesta['category']['name']);
        $cache[$category_id] = $nombre;
        return $nombre;
    }

    return '';
}

/**
 * Convierte el HTML de descripción corto a un formato seguro para mostrar.
 *
 * @param string $contenido HTML de la descripción.
 *
 * @return string
 */
function sanitizar_descripcion($contenido)
{
    if (empty($contenido)) {
        return '';
    }

    return strip_tags($contenido, '<p><br><strong><em><ul><ol><li>');
}

/**
 * Normaliza la información de un producto de PrestaShop para mostrarla en la tabla.
 *
 * @param array $producto         Datos del producto devueltos por la API.
 * @param array $cache_categorias Caché local de nombres de categorías.
 *
 * @return array
 */
function mapear_producto(array $producto, array &$cache_categorias)
{
    $nombre = extraer_valor_multilenguaje($producto['name']);
    $descripcion = '';

    if (isset($producto['description_short'])) {
        $descripcion = extraer_valor_multilenguaje($producto['description_short']);
    }

    $categoria = '';
    if (!empty($producto['id_category_default'])) {
        $categoria = obtener_nombre_categoria((int) $producto['id_category_default'], $cache_categorias);
    }

    $link_rewrite = extraer_valor_multilenguaje($producto['link_rewrite']);
    $image_id = isset($producto['id_default_image']) ? $producto['id_default_image'] : '';
    $image_url = '';

    if (!empty($image_id) && !empty($link_rewrite)) {
        $image_url = BASE_URL . $image_id . '-medium_default/' . $link_rewrite . '.jpg';
    }

    $price_value = '';
    if (isset($producto['price'])) {
        $price_value = number_format((float) $producto['price'], 2, ',', '.');
    }

    $product_url = '';
    if (!empty($link_rewrite)) {
        $product_url = BASE_URL . PRESTASHOP_LANG_SLUG . '/' . $producto['id'] . '-' . $link_rewrite;
        if (!empty($producto['ean13'])) {
            $product_url .= '-' . $producto['ean13'];
        }
        $product_url .= '.html';
    }

    return [
        'name' => $nombre,
        'price' => $price_value,
        'category' => $categoria,
        'description' => sanitizar_descripcion($descripcion),
        'sku' => !empty($producto['reference']) ? $producto['reference'] : (isset($producto['ean13']) ? $producto['ean13'] : ''),
        'image' => $image_url,
        'product_url' => $product_url,
    ];
}

/**
 * Descarga todos los productos disponibles desde la API de PrestaShop.
 *
 * @param int|null $maximo Número máximo de productos a recuperar (null para todos).
 *
 * @return array
 */
function obtener_productos($maximo = null)
{
    $productos = [];
    $cache_categorias = [];
    $offset = 0;
    $chunk = 150;
    $iteraciones = 0;
    $limite_iteraciones = 500;

    while ($iteraciones < $limite_iteraciones) {
        if ($maximo !== null && count($productos) >= $maximo) {
            break;
        }

        $limite_actual = $chunk;
        if ($maximo !== null) {
            $restantes = $maximo - count($productos);
            if ($restantes <= 0) {
                break;
            }
            if ($restantes < $chunk) {
                $limite_actual = $restantes;
            }
        }

        $query = [
            'language' => PRESTASHOP_LANG_CODE,
            'limit' => $offset . ',' . $limite_actual,
            'display' => '[id,id_default_image,name,price,reference,link_rewrite,ean13,id_category_default,description_short]',
            'sort' => 'id_ASC',
        ];

        if (isset($_GET['debug']) && $_GET['debug'] === '1') {
            echo '<pre class="bg-blue-100 p-4 overflow-x-auto text-xs">Consulta: ' . htmlspecialchars(print_r($query, true), ENT_QUOTES, 'UTF-8') . '</pre>';
        }

        $respuesta = prestashop_get('products', $query);

        if (empty($respuesta['products'])) {
            break;
        }

        foreach ($respuesta['products'] as $producto) {
            $productos[] = mapear_producto($producto, $cache_categorias);

            if ($maximo !== null && count($productos) >= $maximo) {
                break;
            }
        }

        $cantidad = count($respuesta['products']);
        if ($cantidad < $limite_actual) {
            break;
        }

        $offset += $cantidad;
        $iteraciones++;

        if (function_exists('set_time_limit')) {
            @set_time_limit(120);
        }
        break;
    }

    return $productos;
}

$productos = obtener_productos();
$total_productos = count($productos);

?><!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Listado de productos</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/tailwindcss/2.2.19/tailwind.min.css" />
    <link rel="stylesheet" href="https://cdn.datatables.net/1.13.6/css/dataTables.tailwind.min.css" />
    <link rel="stylesheet" href="https://cdn.datatables.net/responsive/2.5.0/css/responsive.tailwind.min.css" />
    <style>
        :root {
            color-scheme: light;
        }

        table.dataTable tbody td {
            vertical-align: top;
        }

        .product-image {
            width: 72px;
            height: 72px;
            object-fit: cover;
            border-radius: 0.75rem;
            box-shadow: inset 0 0 0 1px rgba(15, 23, 42, 0.08);
        }

        .line-clamp-5 {
            display: -webkit-box;
            -webkit-line-clamp: 5;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
    </style>
</head>
<body class="min-h-screen bg-slate-100">
    <main class="mx-auto max-w-7xl px-4 py-10">
        <section class="relative overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-900/10">
            <div class="absolute inset-x-0 top-0 h-40 bg-gradient-to-r from-indigo-500/10 via-sky-500/10 to-cyan-500/10"></div>

            <div class="relative space-y-8 px-6 py-10 sm:px-10">
                <header class="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div class="space-y-3">
                        <p class="inline-flex items-center gap-2 rounded-full bg-indigo-100/80 px-4 py-1 text-xs font-medium uppercase tracking-widest text-indigo-700">
                            <span class="inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
                            Catálogo PrestaShop
                        </p>
                        <h1 class="text-3xl font-semibold text-slate-900">Listado de productos</h1>
                        <p class="max-w-2xl text-sm text-slate-600">
                            Vista dinámica conectada a la API de tu tienda. Filtra y pagina la información directamente desde la interfaz.
                        </p>
                    </div>
                    <div class="flex flex-col gap-2 text-sm text-slate-600 md:items-end">
                        <div class="flex items-center gap-2">
                            <span class="inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                            Idioma activo: <span class="font-medium text-slate-900"><?php echo htmlspecialchars(strtoupper(PRESTASHOP_LANG_SLUG), ENT_QUOTES, 'UTF-8'); ?></span>
                        </div>
                        <div>
                            Total de productos: <span class="font-semibold text-slate-900"><?php echo number_format($total_productos, 0, ',', '.'); ?></span>
                        </div>
                        <div>
                            Paginación: <span class="font-semibold text-slate-900">En el navegador (DataTables)</span>
                        </div>
                    </div>
                </header>

                <div class="rounded-2xl border border-slate-200/70 bg-white/70 p-6 shadow-sm backdrop-blur">
                    <div class="flex flex-col gap-3 text-sm text-slate-600">
                        <div class="flex items-center gap-2 text-slate-700">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-4 w-4 text-indigo-500">
                                <path fill-rule="evenodd" d="M10 1.5a.75.75 0 0 1 .673.418l1.732 3.423 3.777.548a.75.75 0 0 1 .416 1.279l-2.73 2.661.645 3.764a.75.75 0 0 1-1.088.791L10 12.347l-3.415 1.793a.75.75 0 0 1-1.088-.79l.645-3.765-2.73-2.662a.75.75 0 0 1 .416-1.279l3.777-.548L9.327 1.918A.75.75 0 0 1 10 1.5Z" clip-rule="evenodd" />
                            </svg>
                            Operando siempre en español (código PrestaShop 1).
                        </div>
                        <p>* Todos los productos se descargan al cargar la página; DataTables se encarga de la paginación y la búsqueda en el navegador.</p>
                        <a href="<?php echo basename(__FILE__); ?>" class="self-start inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-300">
                            Recargar vista
                        </a>
                    </div>
                </div>
                <div class="rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div class="overflow-hidden">
                        <table id="tabla-productos" class="stripe hover w-full text-left text-sm text-slate-700">
                            <thead class="bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
                                <tr>
                                    <th scope="col" class="px-4 py-3">Imagen</th>
                                    <th scope="col" class="px-4 py-3">Nombre</th>
                                    <th scope="col" class="px-4 py-3">Precio</th>
                                    <th scope="col" class="px-4 py-3">Categoría</th>
                                    <th scope="col" class="px-4 py-3">Descripción</th>
                                    <th scope="col" class="px-4 py-3">SKU</th>
                                    <th scope="col" class="px-4 py-3">URL</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-200">
                                <?php if (empty($productos)) : ?>
                                    <tr>
                                        <td colspan="7" class="px-4 py-6 text-center text-sm text-slate-500">No se encontraron productos en la API.</td>
                                    </tr>
                                <?php else : ?>
                                    <?php foreach ($productos as $producto) : ?>
                                        <tr class="bg-white transition hover:bg-slate-50/60">
                                            <td class="px-4 py-3">
                                                <?php if (!empty($producto['image'])) : ?>
                                                    <img src="<?php echo htmlspecialchars($producto['image'], ENT_QUOTES, 'UTF-8'); ?>" alt="<?php echo htmlspecialchars($producto['name'], ENT_QUOTES, 'UTF-8'); ?>" class="product-image" />
                                                <?php else : ?>
                                                    <span class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-xs font-medium text-slate-400">Sin imagen</span>
                                                <?php endif; ?>
                                            </td>
                                            <td class="px-4 py-3 font-medium text-slate-900"><?php echo htmlspecialchars($producto['name'], ENT_QUOTES, 'UTF-8'); ?></td>
                                            <td class="px-4 py-3 text-slate-700"><?php echo htmlspecialchars($producto['price'], ENT_QUOTES, 'UTF-8'); ?></td>
                                            <td class="px-4 py-3">
                                                <span class="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                                                    <?php echo htmlspecialchars($producto['category'], ENT_QUOTES, 'UTF-8'); ?>
                                                </span>
                                            </td>
                                            <td class="px-4 py-3 text-slate-600">
                                                <div class="line-clamp-5 leading-relaxed">
                                                    <?php echo $producto['description']; ?>
                                                </div>
                                            </td>
                                            <td class="px-4 py-3 text-slate-600"><?php echo htmlspecialchars($producto['sku'], ENT_QUOTES, 'UTF-8'); ?></td>
                                            <td class="px-4 py-3">
                                                <?php if (!empty($producto['product_url'])) : ?>
                                                    <a href="<?php echo htmlspecialchars($producto['product_url'], ENT_QUOTES, 'UTF-8'); ?>" class="inline-flex items-center gap-2 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 transition hover:border-indigo-200 hover:bg-indigo-100" target="_blank" rel="noopener noreferrer">
                                                        Ver producto
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" class="h-3.5 w-3.5">
                                                            <path fill-rule="evenodd" d="M12.293 2.293a1 1 0 0 1 1.414 0l4 4a1 1 0 0 1-.707 1.707H16a2 2 0 0 0-2 2v2.586a1 1 0 0 1-2 0V8a4 4 0 0 1 4-4h.586l-2.293-2.293a1 1 0 0 1 0-1.414ZM8 4a2 2 0 0 1 2 2v8a2 2 0 1 1-4 0V6a2 2 0 0 1 2-2Z" clip-rule="evenodd" />
                                                        </svg>
                                                    </a>
                                                <?php else : ?>
                                                    <span class="text-xs text-slate-400">Sin URL</span>
                                                <?php endif; ?>
                                            </td>
                                        </tr>
                                    <?php endforeach; ?>
                                <?php endif; ?>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    </main>

    <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
    <script src="https://cdn.datatables.net/1.13.6/js/dataTables.tailwind.min.js"></script>
    <script src="https://cdn.datatables.net/responsive/2.5.0/js/dataTables.responsive.min.js"></script>
    <script>
        jQuery(function ($) {
            var idiomaDatatables = {
                decimal: ",",
                thousands: ".",
                processing: "Procesando...",
                search: "Buscar:",
                lengthMenu: "Mostrar _MENU_ registros",
                info: "Mostrando de _START_ a _END_ de _TOTAL_ productos",
                infoEmpty: "Mostrando 0 productos",
                infoFiltered: "(filtrado de _MAX_ productos totales)",
                loadingRecords: "Cargando...",
                zeroRecords: "No se encontraron productos",
                emptyTable: "No hay datos disponibles",
                paginate: {
                    first: "Primero",
                    previous: "Anterior",
                    next: "Siguiente",
                    last: "Último"
                },
                aria: {
                    sortAscending: ": activar para ordenar la columna de manera ascendente",
                    sortDescending: ": activar para ordenar la columna de manera descendente"
                }
            };

            $('#tabla-productos').DataTable({
                pageLength: 25,
                lengthMenu: [[25, 50, 100, -1], [25, 50, 100, 'Todos']],
                responsive: true,
                language: idiomaDatatables,
                order: [[1, 'asc']],
                dom: "<'flex flex-col gap-4 md:flex-row md:items-center md:justify-between'<'flex items-center gap-2'l><'flex-1 md:max-w-xs'f>>" +
                    "<'overflow-x-auto'rt>" +
                    "<'flex flex-col gap-4 md:flex-row md:items-center md:justify-between mt-4'<'text-sm text-slate-600'i><'flex justify-end'p>>",
                columnDefs: [
                    {
                        targets: 0,
                        orderable: false,
                        searchable: false
                    },
                    {
                        targets: 6,
                        orderable: false,
                        searchable: false
                    }
                ]
            });
        });
    </script>
</body>
</html>


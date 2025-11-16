<?php
/**
 * Script PHP para extraer datos de Google Sheets públicos
 * Extrae datos de las hojas de cálculo de Judith y Jordi
 * 
 * Uso: Acceder directamente desde el navegador o llamar desde otro script PHP
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

define('JUDITH_SHEET_URL', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=1117285211&single=true&output=csv');
define('JORDI_SHEET_URL', 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=402745514&single=true&output=csv');

/**
 * Parsea un CSV a un array de arrays asociativos
 */
function parseCSV($csvText) {
    $lines = array_filter(array_map('trim', explode("\n", $csvText)), function($line) {
        return !empty($line);
    });
    
    if (empty($lines)) {
        return [];
    }
    
    // Detectar delimitador (coma o punto y coma)
    $delimiter = strpos($csvText, ';') !== false ? ';' : ',';
    
    // Buscar la línea de headers
    $headerIndex = 0;
    $headers = [];
    
    for ($i = 0; $i < min(5, count($lines)); $i++) {
        $potentialHeaders = array_map('trim', str_getcsv($lines[$i], $delimiter));
        // Si encontramos headers que no están vacíos y tienen nombres descriptivos
        $hasValidHeaders = false;
        foreach ($potentialHeaders as $h) {
            if (!empty($h) && $h !== 'Horas') {
                $hasValidHeaders = true;
                break;
            }
        }
        
        if ($hasValidHeaders) {
            $headers = $potentialHeaders;
            $headerIndex = $i;
            break;
        }
    }
    
    // Si no encontramos headers, usar la primera línea
    if (empty($headers)) {
        $headers = array_map('trim', str_getcsv($lines[0], $delimiter));
        $headerIndex = 0;
    }
    
    // Si los headers están vacíos, usar nombres genéricos
    $allEmpty = true;
    foreach ($headers as $h) {
        if (!empty($h)) {
            $allEmpty = false;
            break;
        }
    }
    
    if ($allEmpty) {
        $headers = array_map(function($i) {
            return 'Columna' . ($i + 1);
        }, array_keys($headers));
    }
    
    $data = [];
    for ($i = $headerIndex + 1; $i < count($lines); $i++) {
        $values = array_map('trim', str_getcsv($lines[$i], $delimiter));
        $row = [];
        
        foreach ($headers as $index => $header) {
            $value = isset($values[$index]) ? $values[$index] : '';
            $key = !empty($header) ? $header : 'Columna' . ($index + 1);
            $row[$key] = $value;
        }
        
        // Solo agregar filas que tengan al menos un campo con contenido
        $hasContent = false;
        foreach ($row as $val) {
            if (!empty($val)) {
                $hasContent = true;
                break;
            }
        }
        
        if ($hasContent) {
            $data[] = $row;
        }
    }
    
    return $data;
}

/**
 * Extrae datos de una URL de Google Sheets
 */
function fetchSheetData($url, $name) {
    try {
        $context = stream_context_create([
            'http' => [
                'timeout' => 30,
                'user_agent' => 'Mozilla/5.0 (compatible; GoogleSheetsExtractor/1.0)',
            ]
        ]);
        
        $csvText = @file_get_contents($url, false, $context);
        
        if ($csvText === false) {
            throw new Exception("Error al descargar el archivo CSV");
        }
        
        $data = parseCSV($csvText);
        
        return [
            'name' => $name,
            'url' => $url,
            'data' => $data,
            'totalRows' => count($data),
        ];
    } catch (Exception $e) {
        return [
            'name' => $name,
            'url' => $url,
            'data' => [],
            'totalRows' => 0,
            'error' => $e->getMessage(),
        ];
    }
}

// Extraer datos de ambos sheets
$judithData = fetchSheetData(JUDITH_SHEET_URL, 'Judith');
$jordiData = fetchSheetData(JORDI_SHEET_URL, 'Jordi');

// Preparar respuesta
$response = [
    'success' => true,
    'data' => [
        'judith' => $judithData,
        'jordi' => $jordiData,
    ],
    'summary' => [
        'judithRows' => $judithData['totalRows'],
        'jordiRows' => $jordiData['totalRows'],
        'totalRows' => $judithData['totalRows'] + $jordiData['totalRows'],
    ],
];

// Si hay un parámetro 'format' con valor 'csv', devolver CSV en lugar de JSON
if (isset($_GET['format']) && $_GET['format'] === 'csv') {
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="google-sheets-data.csv"');
    
    // Combinar datos de ambos sheets
    $allData = array_merge($judithData['data'], $jordiData['data']);
    
    if (!empty($allData)) {
        // Headers
        $headers = array_keys($allData[0]);
        echo implode(',', array_map(function($h) {
            return '"' . str_replace('"', '""', $h) . '"';
        }, $headers)) . "\n";
        
        // Datos
        foreach ($allData as $row) {
            $values = [];
            foreach ($headers as $header) {
                $value = isset($row[$header]) ? $row[$header] : '';
                $values[] = '"' . str_replace('"', '""', $value) . '"';
            }
            echo implode(',', $values) . "\n";
        }
    }
} else {
    // Devolver JSON
    echo json_encode($response, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
}
?>




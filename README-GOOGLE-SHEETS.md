# Extracción de Datos de Google Sheets

Este script PHP extrae datos de los Google Sheets públicos de Judith y Jordi.

## Archivo

- `fetch-google-sheets.php` - Script PHP principal

## Uso

### 1. Acceso directo desde el navegador

Simplemente accede a la URL del script en tu servidor:

```
https://tudominio.com/fetch-google-sheets.php
```

Esto devolverá los datos en formato JSON.

### 2. Obtener datos en formato CSV

Agrega el parámetro `format=csv`:

```
https://tudominio.com/fetch-google-sheets.php?format=csv
```

Esto descargará un archivo CSV con todos los datos combinados.

### 3. Usar desde otro script PHP

```php
<?php
// Incluir el script
require_once 'fetch-google-sheets.php';

// O hacer una petición HTTP
$json = file_get_contents('https://tudominio.com/fetch-google-sheets.php');
$data = json_decode($json, true);

// Acceder a los datos
$judithData = $data['data']['judith']['data'];
$jordiData = $data['data']['jordi']['data'];
?>
```

### 4. Usar desde JavaScript (AJAX)

```javascript
fetch('https://tudominio.com/fetch-google-sheets.php')
  .then(response => response.json())
  .then(data => {
    console.log('Judith:', data.data.judith);
    console.log('Jordi:', data.data.jordi);
    console.log('Total filas:', data.summary.totalRows);
  });
```

## Estructura de la Respuesta JSON

```json
{
  "success": true,
  "data": {
    "judith": {
      "name": "Judith",
      "url": "...",
      "data": [
        {
          "Mes": "2025-08",
          "Fecha": "01/08/2025",
          "Proyecto": "Portal Especialista: 06-006-000004",
          "Tarea": "Wireframe flujo de paciente",
          "Horas": "8"
        }
      ],
      "totalRows": 154
    },
    "jordi": {
      "name": "Jordi",
      "url": "...",
      "data": [...],
      "totalRows": 157
    }
  },
  "summary": {
    "judithRows": 154,
    "jordiRows": 157,
    "totalRows": 311
  }
}
```

## Requisitos

- PHP 5.6 o superior
- Habilitada la función `file_get_contents()` con `allow_url_fopen=On`
- Conexión a internet para acceder a los Google Sheets

## Notas

- Los datos se extraen en tiempo real desde los Google Sheets públicos
- El script maneja automáticamente filas vacías y detecta los headers
- Los datos se parsean correctamente con las columnas: Mes, Fecha, Proyecto, Tarea, Horas




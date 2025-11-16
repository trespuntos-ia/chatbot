/**
 * Script para extraer datos de Google Sheets públicos
 * Extrae datos de las hojas de cálculo de Judith y Jordi
 */

const JUDITH_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=1117285211&single=true&output=csv';
const JORDI_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=402745514&single=true&output=csv';

/**
 * Parsea un CSV a un array de objetos
 */
function parseCSV(csvText) {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Detectar delimitador (coma o punto y coma)
  const delimiter = csvText.includes(';') ? ';' : ',';
  
  // Buscar la línea de headers (puede no ser la primera si hay filas vacías)
  let headerIndex = 0;
  let headers = [];
  
  for (let i = 0; i < Math.min(5, lines.length); i++) {
    const potentialHeaders = lines[i].split(delimiter).map(h => h.trim());
    // Si encontramos headers que no están vacíos y tienen nombres descriptivos
    if (potentialHeaders.some(h => h && h.length > 0 && h !== 'Horas')) {
      headers = potentialHeaders;
      headerIndex = i;
      break;
    }
  }
  
  // Si no encontramos headers, usar la primera línea
  if (headers.length === 0) {
    headers = lines[0].split(delimiter).map(h => h.trim());
    headerIndex = 0;
  }
  
  // Si los headers están vacíos, usar nombres genéricos
  if (headers.every(h => !h || h.length === 0)) {
    headers = headers.map((_, i) => `Columna${i + 1}`);
  }
  
  const data = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    const row = {};
    
    headers.forEach((header, index) => {
      const value = values[index]?.trim() || '';
      // Usar el header si existe, sino usar el índice
      const key = header && header.length > 0 ? header : `Columna${index + 1}`;
      row[key] = value;
    });
    
    // Solo agregar filas que tengan al menos un campo con contenido
    if (Object.values(row).some(val => val && val.length > 0)) {
      data.push(row);
    }
  }
  
  return data;
}

/**
 * Extrae datos de una URL de Google Sheets
 */
async function fetchSheetData(url, name) {
  try {
    console.log(`\n📊 Extrayendo datos de ${name}...`);
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const csvText = await response.text();
    const data = parseCSV(csvText);
    
    console.log(`✅ ${name}: ${data.length} filas extraídas`);
    
    return {
      name,
      url,
      data,
      totalRows: data.length,
      csvText
    };
  } catch (error) {
    console.error(`❌ Error al extraer datos de ${name}:`, error.message);
    return {
      name,
      url,
      data: [],
      totalRows: 0,
      error: error.message,
      csvText: ''
    };
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 Iniciando extracción de datos de Google Sheets...\n');
  
  // Extraer datos de ambos sheets
  const [judithData, jordiData] = await Promise.all([
    fetchSheetData(JUDITH_SHEET_URL, 'Judith'),
    fetchSheetData(JORDI_SHEET_URL, 'Jordi')
  ]);
  
  // Mostrar resumen
  console.log('\n📋 RESUMEN DE EXTRACCIÓN:');
  console.log('═'.repeat(50));
  console.log(`Judith: ${judithData.totalRows} filas`);
  console.log(`Jordi: ${jordiData.totalRows} filas`);
  console.log(`Total: ${judithData.totalRows + jordiData.totalRows} filas`);
  
  // Mostrar muestra de datos
  if (judithData.data.length > 0) {
    console.log('\n📄 MUESTRA DE DATOS - JUDITH (primeras 3 filas):');
    console.log(judithData.data.slice(0, 3));
  }
  
  if (jordiData.data.length > 0) {
    console.log('\n📄 MUESTRA DE DATOS - JORDI (primeras 3 filas):');
    console.log(jordiData.data.slice(0, 3));
  }
  
  // Retornar datos para uso posterior
  return {
    judith: judithData,
    jordi: jordiData
  };
}

// Ejecutar si se llama directamente
if (typeof window === 'undefined') {
  // Node.js - fetch está disponible nativamente en Node 18+
  main().then(data => {
    console.log('\n✅ Extracción completada');
    process.exit(0);
  }).catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
} else {
  // Browser - exportar función
  window.extractGoogleSheetsData = main;
}

// Exportar para uso en módulos ES6
export { main, fetchSheetData, parseCSV };


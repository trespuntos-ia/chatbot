import type { VercelRequest, VercelResponse } from '@vercel/node';

const JUDITH_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=1117285211&single=true&output=csv';
const JORDI_SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vRn-woiScJSo8wV0Njr6fotQiwJcjI8CllaTmP1Cu31cVazshX0dFeGBC2ShvaIlGe0ymke8AR5DZWY/pub?gid=402745514&single=true&output=csv';

interface SheetRow {
  [key: string]: string;
}

interface SheetData {
  name: string;
  url: string;
  data: SheetRow[];
  totalRows: number;
  error?: string;
}

function parseCSV(csvText: string): SheetRow[] {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // Detectar delimitador (coma o punto y coma)
  const delimiter = csvText.includes(';') ? ';' : ',';
  
  // Buscar la línea de headers (puede no ser la primera si hay filas vacías)
  let headerIndex = 0;
  let headers: string[] = [];
  
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
  
  const data: SheetRow[] = [];
  for (let i = headerIndex + 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    const row: SheetRow = {};
    
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

async function fetchSheetData(url: string, name: string): Promise<SheetData> {
  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`);
    }
    
    const csvText = await response.text();
    const data = parseCSV(csvText);
    
    return {
      name,
      url,
      data,
      totalRows: data.length,
    };
  } catch (error) {
    console.error(`Error al extraer datos de ${name}:`, error);
    return {
      name,
      url,
      data: [],
      totalRows: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Configurar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'GET') {
    res.status(405).json({ success: false, error: 'Method not allowed' });
    return;
  }

  try {
    // Extraer datos de ambos sheets en paralelo
    const [judithData, jordiData] = await Promise.all([
      fetchSheetData(JUDITH_SHEET_URL, 'Judith'),
      fetchSheetData(JORDI_SHEET_URL, 'Jordi'),
    ]);

    res.status(200).json({
      success: true,
      data: {
        judith: judithData,
        jordi: jordiData,
      },
      summary: {
        judithRows: judithData.totalRows,
        jordiRows: jordiData.totalRows,
        totalRows: judithData.totalRows + jordiData.totalRows,
      },
    });
  } catch (error) {
    console.error('[fetch-google-sheets] Error:', error);
    res.status(500).json({
      success: false,
      error: 'Error al extraer datos de Google Sheets',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}


/**
 * Obtiene información adicional de un producto desde su página web
 */
export async function scrapeProductPage(productUrl: string): Promise<{
  description?: string;
  features?: string[];
  specifications?: Record<string, string>;
  availableColors?: string[];
  error?: string;
}> {
  try {
    // Timeout de 5 segundos para no ralentizar demasiado
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(productUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; ChatbotProductScraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId);
    });

    if (!response.ok) {
      return { error: `HTTP ${response.status}` };
    }

    const html = await response.text();

    // Extraer información del HTML usando expresiones regulares simples
    // (En producción, usar una librería como cheerio o jsdom sería mejor)
    
    const result: {
      description?: string;
      features?: string[];
      specifications?: Record<string, string>;
      availableColors?: string[];
    } = {};

    // Extraer descripción completa (buscar meta description o contenido principal)
    const metaDescriptionMatch = html.match(/<meta\s+name=["']description["']\s+content=["']([^"']+)["']/i);
    if (metaDescriptionMatch) {
      result.description = metaDescriptionMatch[1].trim();
    }

    // Buscar descripción en contenido estructurado (JSON-LD)
    const jsonLdMatch = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>(.*?)<\/script>/is);
    if (jsonLdMatch) {
      try {
        const jsonLd = JSON.parse(jsonLdMatch[1]);
        if (jsonLd.description) {
          result.description = jsonLd.description;
        }
        if (jsonLd.offers && Array.isArray(jsonLd.offers)) {
          // Información adicional puede estar aquí
        }
      } catch (e) {
        // Ignorar errores de parsing JSON-LD
      }
    }

    // Extraer características/features (buscar listas con características)
    const features: string[] = [];
    
    // Buscar en listas <ul> o <ol> que contengan palabras clave
    const featureListMatch = html.match(/<(ul|ol)[^>]*>(.*?)<\/\1>/is);
    if (featureListMatch) {
      const listItems = featureListMatch[2].match(/<li[^>]*>(.*?)<\/li>/gis);
      if (listItems) {
        listItems.slice(0, 10).forEach((item: string) => {
          const text = item.replace(/<[^>]+>/g, '').trim();
          if (text.length > 10 && text.length < 200) {
            features.push(text);
          }
        });
      }
    }

    // Buscar colores disponibles (buscar palabras de colores comunes o atributos de color)
    const colors: string[] = [];
    const colorKeywords = ['rojo', 'azul', 'verde', 'amarillo', 'negro', 'blanco', 'gris', 'rosa', 'naranja', 'morado', 'marrón', 'beige'];
    const colorPattern = new RegExp(`(${colorKeywords.join('|')})`, 'gi');
    const colorMatches = html.match(colorPattern);
    if (colorMatches) {
      const uniqueColors = [...new Set(colorMatches.map(c => c.toLowerCase()))];
      colors.push(...uniqueColors.slice(0, 5));
    }

    // Buscar especificaciones técnicas (buscar tablas o divs con datos clave-valor)
    const specifications: Record<string, string> = {};
    
    // Buscar en tablas
    const tableMatch = html.match(/<table[^>]*>(.*?)<\/table>/is);
    if (tableMatch) {
      const rows = tableMatch[1].match(/<tr[^>]*>(.*?)<\/tr>/gis);
      if (rows) {
        rows.slice(0, 10).forEach((row: string) => {
          const cells = row.match(/<t[dh][^>]*>(.*?)<\/t[dh]>/gis);
          if (cells && cells.length >= 2) {
            const key = cells[0].replace(/<[^>]+>/g, '').trim();
            const value = cells[1].replace(/<[^>]+>/g, '').trim();
            if (key && value && key.length < 50 && value.length < 200) {
              specifications[key] = value;
            }
          }
        });
      }
    }

    if (features.length > 0) {
      result.features = features;
    }
    if (Object.keys(specifications).length > 0) {
      result.specifications = specifications;
    }
    if (colors.length > 0) {
      result.availableColors = colors;
    }

    return result;
  } catch (error) {
    // Manejar errores de forma segura
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        return { error: 'Timeout' };
      }
      // Errores de red o CORS
      if (error.message.includes('fetch') || error.message.includes('CORS')) {
        return { error: 'Network error' };
      }
      return { error: error.message };
    }
    return { error: 'Unknown error' };
  }
}


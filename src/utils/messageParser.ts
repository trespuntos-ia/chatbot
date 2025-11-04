import type { Product } from '../types';

export interface MessagePart {
  type: 'text' | 'product';
  content: string | Product;
  productIndex?: number;
}

/**
 * Encuentra productos mencionados específicamente en el texto (no en listas)
 * Útil para detectar cuando se recomienda un solo producto
 */
export function findRecommendedProduct(
  message: string,
  availableProducts: Product[]
): Product | null {
  if (!availableProducts || availableProducts.length === 0) {
    return null;
  }

  // Buscar patrones de recomendación específica
  const recommendationPatterns = [
    /recomendaría\s+(?:el\s+)?producto\s+"([^"]+)"/i,
    /te\s+recomiendo\s+(?:el\s+)?producto\s+"([^"]+)"/i,
    /recomiendo\s+(?:el\s+)?producto\s+"([^"]+)"/i,
    /producto\s+"([^"]+)"[^.]*recomend/i,
    /"([^"]+)"[^.]*es\s+(?:el\s+)?(?:producto\s+)?(?:ideal|perfecto|recomendado)/i
  ];

  for (const pattern of recommendationPatterns) {
    const match = message.match(pattern);
    if (match && match[1]) {
      const productName = match[1].trim();
      const product = availableProducts.find(p => 
        productName.toLowerCase() === p.name.toLowerCase() ||
        p.name.toLowerCase().includes(productName.toLowerCase()) ||
        productName.toLowerCase().includes(p.name.toLowerCase())
      );
      if (product) {
        return product;
      }
    }
  }

  // Si no encuentra patrón de recomendación, buscar si solo se menciona un producto
  const mentionedProducts = availableProducts.filter(p => {
    const nameWords = p.name.toLowerCase().split(/\s+/);
    const nameRegex = new RegExp(nameWords.slice(0, 3).join('\\s+'), 'i');
    return nameRegex.test(message) || message.includes(p.name);
  });

  // Si solo se menciona un producto, asumir que es el recomendado
  if (mentionedProducts.length === 1) {
    return mentionedProducts[0];
  }

  return null;
}

/**
 * Encuentra productos mencionados en el texto del mensaje
 */
export function findProductsInMessage(
  message: string,
  availableProducts: Product[]
): Map<number, Product> {
  const productMap = new Map<number, Product>();
  
  if (!availableProducts || availableProducts.length === 0) {
    return productMap;
  }

  // Buscar números de lista (1., 2., etc.) y asociar productos
  const listPattern = /(\d+)\.\s*\*\*(.+?)\*\*/g;
  let match;

  while ((match = listPattern.exec(message)) !== null) {
    const listNumber = parseInt(match[1]);
    const productName = match[2].trim();
    
    // Buscar el producto por nombre
    const product = availableProducts.find(p => 
      productName.toLowerCase().includes(p.name.toLowerCase()) ||
      p.name.toLowerCase().includes(productName.toLowerCase())
    );

    if (product) {
      productMap.set(listNumber, product);
    }
  }

  // Si no encuentra por patrón de lista, intentar por nombre directamente
  if (productMap.size === 0 && availableProducts.length > 0) {
    // Intentar asociar productos por orden de aparición
    availableProducts.forEach((product, idx) => {
      if (message.includes(product.name) || message.includes(product.sku)) {
        productMap.set(idx + 1, product);
      }
    });
  }

  return productMap;
}

/**
 * Divide el mensaje en partes (texto y productos) insertando tarjetas después de cada descripción
 */
export function splitMessageWithProducts(
  message: string,
  products: Product[]
): MessagePart[] {
  const parts: MessagePart[] = [];
  const productMap = findProductsInMessage(message, products);

  // Primero verificar si hay una recomendación específica de un solo producto
  const recommendedProduct = findRecommendedProduct(message, products);
  
  // Si hay una recomendación específica y hay múltiples productos, mostrar solo el recomendado
  const productsToShow = recommendedProduct && products.length > 1 
    ? [recommendedProduct] 
    : products;

  if (productMap.size === 0) {
    // Si no hay productos específicos en lista, verificar si hay recomendación
    if (recommendedProduct && products.length > 1) {
      // Mostrar solo el producto recomendado
      const result: MessagePart[] = [
        { type: 'text' as const, content: message },
        { 
          type: 'product' as const, 
          content: recommendedProduct, 
          productIndex: 0 
        }
      ];
      return result;
    }
    
    // Si no hay recomendación específica, mostrar todos los productos
    const result: MessagePart[] = [
      { type: 'text' as const, content: message }
    ];
    productsToShow.forEach((product, idx) => {
      result.push({ 
        type: 'product' as const, 
        content: product, 
        productIndex: idx 
      });
    });
    return result;
  }

  // Dividir el mensaje por secciones de productos
  const lines = message.split(/\n/);
  let currentText = '';

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex];
    
    // Detectar si esta línea es el inicio de un producto (número de lista)
    const listMatch = line.match(/^(\d+)\.\s*\*\*(.+?)\*\*/);
    
    if (listMatch) {
      const listNumber = parseInt(listMatch[1]);
      const product = productMap.get(listNumber);

      // Si hay texto acumulado, guardarlo
      if (currentText.trim()) {
        parts.push({ type: 'text', content: currentText.trim() });
        currentText = '';
      }

      // Si encontramos un producto, añadir el texto hasta encontrar el enlace/imagen
      // y luego insertar la tarjeta
      if (product) {
        // Buscar dónde termina la descripción de este producto (antes del siguiente producto o final)
        let productText = line + '\n';
        let nextLineIndex = lineIndex + 1;
        
        // Continuar hasta encontrar el siguiente producto o el final
        while (nextLineIndex < lines.length) {
          const nextListMatch = lines[nextLineIndex].match(/^(\d+)\.\s*\*\*/);
          if (nextListMatch) {
            break; // Encontramos otro producto
          }
          
          // Si encontramos un enlace "Ver más detalles", ese es el final de esta descripción
          if (lines[nextLineIndex].includes('[Ver') || lines[nextLineIndex].includes('Ver más')) {
            productText += lines[nextLineIndex] + '\n';
            nextLineIndex++;
            // Añadir imagen si existe
            if (nextLineIndex < lines.length && lines[nextLineIndex].includes('![')) {
              productText += lines[nextLineIndex] + '\n';
              nextLineIndex++;
            }
            break;
          }
          
          productText += lines[nextLineIndex] + '\n';
          nextLineIndex++;
        }

        // Añadir el texto del producto
        parts.push({ type: 'text', content: productText.trim() });
        
        // Insertar la tarjeta del producto
        parts.push({ type: 'product', content: product, productIndex: listNumber });

        // Saltar las líneas que ya procesamos
        lineIndex = nextLineIndex - 1;
      } else {
        currentText += line + '\n';
      }
    } else {
      // Si no es inicio de producto, acumular texto
      currentText += line + '\n';
    }
  }

  // Añadir texto restante
  if (currentText.trim()) {
    parts.push({ type: 'text', content: currentText.trim() });
  }

  // Añadir productos que no se insertaron
  products.forEach((product, idx) => {
    let found = false;
    for (const part of parts) {
      if (part.type === 'product' && part.content === product) {
        found = true;
        break;
      }
    }
    if (!found) {
      parts.push({ type: 'product', content: product, productIndex: idx });
    }
  });

  return parts;
}

/**
 * Convierte markdown a HTML con soporte para imágenes y enlaces mejorados
 */
export function parseMessageContent(
  message: string,
  products: Product[] = []
): { html: string; productPositions: Map<number, Product> } {
  let html = message;
  const productMap = findProductsInMessage(message, products);

  // Convertir imágenes markdown a <img> (mejor estilizado)
  html = html.replace(
    /!\[([^\]]*)\]\(([^)]+)\)/g,
    '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-3 shadow-sm" />'
  );

  // Convertir enlaces markdown que contengan "Ver" en botones estilizados
  html = html.replace(
    /-\s*\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => {
      // Si el texto contiene "Ver", convertir en botón
      if (text.toLowerCase().includes('ver') || text.toLowerCase().includes('más') || text.toLowerCase().includes('detalles')) {
        return `<div class="my-3">
          <a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm shadow-sm hover:shadow-md">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            ${text}
          </a>
        </div>`;
      }
      // Otros enlaces como enlaces normales
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-700 underline font-medium">${text}</a>`;
    }
  );

  // También convertir enlaces sin el guion inicial
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (match, text, url) => {
      // Si ya fue procesado como botón, no hacer nada
      if (match.includes('bg-indigo-600')) {
        return match;
      }
      // Si el texto contiene "Ver", convertir en botón
      if (text.toLowerCase().includes('ver') || text.toLowerCase().includes('más') || text.toLowerCase().includes('detalles')) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm my-2">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          ${text}
        </a>`;
      }
      // Otros enlaces como enlaces normales
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-indigo-600 hover:text-indigo-700 underline">${text}</a>`;
    }
  );

  // Convertir negrita markdown
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');

  // Convertir saltos de línea dobles en párrafos
  html = html.split(/\n\n+/).map(para => {
    if (para.trim()) {
      return `<p class="mb-2">${para.trim().replace(/\n/g, '<br />')}</p>`;
    }
    return '';
  }).join('');

  return { html, productPositions: productMap };
}


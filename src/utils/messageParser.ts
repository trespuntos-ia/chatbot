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
 * Detecta si el texto contiene información descriptiva de productos (listas numeradas con precios, descripciones)
 */
function hasProductDescriptiveContent(text: string): boolean {
  // Patrón para detectar listas numeradas con productos
  const numberedListPattern = /\d+\.\s*\*\*[^*]+\*\*/;
  
  // Patrón para detectar líneas con precios (€, EUR, etc.)
  const pricePattern = /(?:Precio|Price)[:\-]\s*[\d.,]+\s*€?/i;
  
  // Patrón para detectar descripciones de productos en listas
  const descriptionPattern = /(?:Descripción|Description)[:\-]/i;
  
  // Patrón para detectar "Ver más detalles" o botones
  const detailsPattern = /(?:Ver\s+más\s+detalles|View\s+details)/i;
  
  return numberedListPattern.test(text) || 
         (pricePattern.test(text) && descriptionPattern.test(text)) ||
         detailsPattern.test(text);
}

/**
 * Extrae solo el texto introductorio (antes de cualquier lista de productos)
 */
function extractIntroText(text: string): string {
  const lines = text.split('\n');
  const introLines: string[] = [];
  
  for (const line of lines) {
    // Si encontramos una lista numerada, parar
    if (/\d+\.\s*\*\*/.test(line)) {
      break;
    }
    // Si encontramos un precio o descripción, probablemente es parte de una lista
    if (/(?:Precio|Price)[:\-]/.test(line) || /(?:Descripción|Description)[:\-]/.test(line)) {
      break;
    }
    // Si encontramos "Ver más detalles", parar
    if (/(?:Ver\s+más\s+detalles|View\s+details)/i.test(line)) {
      break;
    }
    introLines.push(line);
  }
  
  return introLines.join('\n').trim();
}

/**
 * Divide el mensaje en partes (texto y productos) - texto primero, luego tarjetas
 */
export function splitMessageWithProducts(
  message: string,
  products: Product[]
): MessagePart[] {
  const productMap = findProductsInMessage(message, products);

  // Primero verificar si hay una recomendación específica de un solo producto
  const recommendedProduct = findRecommendedProduct(message, products);
  
  // Si hay una recomendación específica y hay múltiples productos, mostrar solo el recomendado
  const productsToShow = recommendedProduct && products.length > 1 
    ? [recommendedProduct] 
    : products;

  // Si hay productos, verificar si hay contenido descriptivo que debe ocultarse
  const hasDescriptiveContent = hasProductDescriptiveContent(message);
  
  // SIEMPRE mostrar primero el texto (solo intro si hay contenido descriptivo), luego las tarjetas
  if (productMap.size === 0) {
    // Si no hay productos específicos en lista, verificar si hay recomendación
    if (recommendedProduct && products.length > 1) {
      // Extraer solo el intro si hay contenido descriptivo
      const textContent = hasDescriptiveContent ? extractIntroText(message) : message;
      const result: MessagePart[] = [
        { type: 'text' as const, content: textContent },
        { 
          type: 'product' as const, 
          content: recommendedProduct, 
          productIndex: 0 
        }
      ];
      return result;
    }
    
    // Si no hay recomendación específica, mostrar texto primero, luego todos los productos
    const textContent = hasDescriptiveContent ? extractIntroText(message) : message;
    const result: MessagePart[] = [
      { type: 'text' as const, content: textContent }
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

  // Si hay productos en lista numerada, extraer solo el intro
  const textContent = hasDescriptiveContent ? extractIntroText(message) : message;
  const result: MessagePart[] = [
    { type: 'text' as const, content: textContent }
  ];
  
  // Añadir todos los productos al final
  productsToShow.forEach((product, idx) => {
    result.push({ 
      type: 'product' as const, 
      content: product, 
      productIndex: idx 
    });
  });
  
  return result;
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

  // Convertir negrita markdown primero (para no interferir con enlaces)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-slate-900">$1</strong>');

  // Convertir imágenes markdown a <img> (mejor estilizado)
  // PERO solo si no hay productos, porque si hay productos las imágenes ya están en las tarjetas
  if (products.length === 0) {
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      '<img src="$2" alt="$1" class="max-w-full h-auto rounded-lg my-3 shadow-sm" />'
    );
  } else {
    // Si hay productos, remover imágenes markdown del texto (ya están en las tarjetas)
    html = html.replace(
      /!\[([^\]]*)\]\(([^)]+)\)/g,
      ''
    );
    
    // También eliminar enlaces de texto que mencionen "imagen del producto" o variantes
    html = html.replace(
      /\[([^\]]*(?:imagen|image|Imagen|Image)[^\]]*)\]\([^)]+\)/gi,
      ''
    );
    
    // Eliminar líneas que solo contengan referencias a imágenes
    html = html.replace(/^\s*!\[.*?\]\(.*?\)\s*$/gm, '');
  }

  // Convertir saltos de línea dobles en párrafos
  html = html.split(/\n\n+/).map(para => {
    if (para.trim()) {
      return `<p class="mb-2">${para.trim().replace(/\n/g, '<br />')}</p>`;
    }
    return '';
  }).join('');

  // DESPUÉS de procesar párrafos: Convertir enlaces markdown a HTML
  // Todos los enlaces se muestran como texto con link, no como botones
  html = html.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    (_match, text, url) => {
      // Escapar HTML en el texto y URL para seguridad
      const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      
      // Todos los enlaces como links de texto normales con estilo
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-700 underline">${escapedText}</a>`;
    }
  );

  return { html, productPositions: productMap };
}

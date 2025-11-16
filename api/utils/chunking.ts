interface Chunk {
  content: string;
  metadata: {
    product_id: number;
    product_name: string;
    chunk_index: number;
    source: 'name' | 'description' | 'combined';
  };
}

interface Product {
  id: number;
  name: string;
  description: string;
  category?: string | null;
  subcategory?: string | null;
}

/**
 * Divide un producto en chunks para indexación
 */
export function chunkProduct(product: Product): Chunk[] {
  const chunks: Chunk[] = [];
  
  // Chunk 1: Nombre del producto
  if (product.name && product.name.trim().length > 0) {
    chunks.push({
      content: product.name,
      metadata: {
        product_id: product.id,
        product_name: product.name,
        chunk_index: 0,
        source: 'name',
      },
    });
  }
  
  // Chunk 2: Descripción (si es larga, dividirla)
  if (product.description && product.description.trim().length > 0) {
    const maxChunkSize = 500; // Caracteres por chunk
    const description = product.description.trim();
    
    if (description.length <= maxChunkSize) {
      chunks.push({
        content: description,
        metadata: {
          product_id: product.id,
          product_name: product.name,
          chunk_index: chunks.length,
          source: 'description',
        },
      });
    } else {
      // Dividir descripción en chunks más pequeños
      const words = description.split(/\s+/);
      let currentChunk = '';
      
      for (const word of words) {
        if ((currentChunk + ' ' + word).length > maxChunkSize && currentChunk.length > 0) {
          chunks.push({
            content: currentChunk.trim(),
            metadata: {
              product_id: product.id,
              product_name: product.name,
              chunk_index: chunks.length,
              source: 'description',
            },
          });
          currentChunk = word;
        } else {
          currentChunk = currentChunk ? currentChunk + ' ' + word : word;
        }
      }
      
      if (currentChunk.trim().length > 0) {
        chunks.push({
          content: currentChunk.trim(),
          metadata: {
            product_id: product.id,
            product_name: product.name,
            chunk_index: chunks.length,
            source: 'description',
          },
        });
      }
    }
  }
  
  // Chunk 3: Combinación nombre + categoría (si existe)
  if (product.category) {
    const combinedContent = `${product.name}${product.subcategory ? ` - ${product.subcategory}` : ''} - ${product.category}`;
    chunks.push({
      content: combinedContent,
      metadata: {
        product_id: product.id,
        product_name: product.name,
        chunk_index: chunks.length,
        source: 'combined',
      },
    });
  }
  
  return chunks;
}


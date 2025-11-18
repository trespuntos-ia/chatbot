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
 * Divide un producto en chunks para indexación (versión optimizada)
 * Usa chunks más grandes (1000-1500 caracteres) y chunking inteligente por párrafos
 */
export function chunkProduct(product: Product): Chunk[] {
  const chunks: Chunk[] = [];
  const maxChunkSize = 1200; // Aumentado de 500 a 1200 caracteres para mejor contexto
  const minChunkSize = 200; // Tamaño mínimo para evitar chunks muy pequeños
  
  // Chunk 1: Identificación completa (nombre + categoría + subcategoría)
  // Este chunk siempre se incluye para búsquedas por nombre/categoría
  let identificationChunk = product.name || '';
  if (product.category) {
    identificationChunk += ` - ${product.category}`;
  }
  if (product.subcategory) {
    identificationChunk += ` - ${product.subcategory}`;
  }
  
  if (identificationChunk.trim().length > 0) {
    chunks.push({
      content: identificationChunk.trim(),
      metadata: {
        product_id: product.id,
        product_name: product.name,
        chunk_index: 0,
        source: 'name',
      },
    });
  }
  
  // Chunk 2: Nombre + Descripción corta (si la descripción es corta)
  // Combinamos nombre y descripción para mantener contexto completo
  if (product.description && product.description.trim().length > 0) {
    const description = product.description.trim();
    const nameAndShortDesc = `${product.name}. ${description}`;
    
    // Si la descripción es corta, combinarla con el nombre en un solo chunk
    if (nameAndShortDesc.length <= maxChunkSize) {
      chunks.push({
        content: nameAndShortDesc,
        metadata: {
          product_id: product.id,
          product_name: product.name,
          chunk_index: chunks.length,
          source: 'combined',
        },
      });
    } else {
      // Si la descripción es larga, dividirla inteligentemente por párrafos
      // Primero intentar dividir por párrafos (saltos de línea dobles o puntos seguidos)
      const paragraphs = description.split(/\n\n+|\.\s+(?=[A-Z])/).filter(p => p.trim().length > 0);
      
      if (paragraphs.length > 1) {
        // Chunking por párrafos: agrupar párrafos hasta alcanzar maxChunkSize
        let currentChunk = '';
        
        for (const paragraph of paragraphs) {
          const trimmedPara = paragraph.trim();
          const testChunk = currentChunk 
            ? `${currentChunk}\n\n${trimmedPara}` 
            : trimmedPara;
          
          // Si agregar este párrafo excede el límite y ya tenemos contenido, guardar chunk actual
          if (testChunk.length > maxChunkSize && currentChunk.length >= minChunkSize) {
            chunks.push({
              content: currentChunk.trim(),
              metadata: {
                product_id: product.id,
                product_name: product.name,
                chunk_index: chunks.length,
                source: 'description',
              },
            });
            currentChunk = trimmedPara;
          } else {
            // Si el párrafo solo es muy largo, dividirlo por oraciones
            if (trimmedPara.length > maxChunkSize) {
              // Guardar chunk actual si existe
              if (currentChunk.length >= minChunkSize) {
                chunks.push({
                  content: currentChunk.trim(),
                  metadata: {
                    product_id: product.id,
                    product_name: product.name,
                    chunk_index: chunks.length,
                    source: 'description',
                  },
                });
                currentChunk = '';
              }
              
              // Dividir párrafo largo por oraciones
              const sentences = trimmedPara.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
              let sentenceChunk = '';
              
              for (const sentence of sentences) {
                const testSentenceChunk = sentenceChunk 
                  ? `${sentenceChunk}. ${sentence}` 
                  : sentence;
                
                if (testSentenceChunk.length > maxChunkSize && sentenceChunk.length >= minChunkSize) {
                  chunks.push({
                    content: sentenceChunk.trim() + '.',
                    metadata: {
                      product_id: product.id,
                      product_name: product.name,
                      chunk_index: chunks.length,
                      source: 'description',
                    },
                  });
                  sentenceChunk = sentence;
                } else {
                  sentenceChunk = testSentenceChunk;
                }
              }
              
              if (sentenceChunk.trim().length > 0) {
                currentChunk = sentenceChunk;
              }
            } else {
              currentChunk = testChunk;
            }
          }
        }
        
        // Guardar último chunk si tiene contenido
        if (currentChunk.trim().length >= minChunkSize) {
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
      } else {
        // Si no hay párrafos claros, dividir por oraciones
        const sentences = description.split(/[.!?]+\s+/).filter(s => s.trim().length > 0);
        let currentChunk = '';
        
        for (const sentence of sentences) {
          const testChunk = currentChunk 
            ? `${currentChunk}. ${sentence}` 
            : sentence;
          
          if (testChunk.length > maxChunkSize && currentChunk.length >= minChunkSize) {
            chunks.push({
              content: currentChunk.trim() + '.',
              metadata: {
                product_id: product.id,
                product_name: product.name,
                chunk_index: chunks.length,
                source: 'description',
              },
            });
            currentChunk = sentence;
          } else {
            currentChunk = testChunk;
          }
        }
        
        if (currentChunk.trim().length >= minChunkSize) {
          chunks.push({
            content: currentChunk.trim() + (currentChunk.trim().endsWith('.') ? '' : '.'),
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
  }
  
  return chunks;
}


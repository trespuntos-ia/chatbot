# Plan de Implementación RAG - Paso a Paso

## 🎯 Objetivo

Implementar sistema RAG completo según la propuesta técnica, empezando de cero con validación incremental, manteniendo el sistema actual funcionando hasta que el nuevo esté validado.

---

## 📋 Fase 0: Preparación y Backup (1 hora)

### Paso 1: Guardar código actual

```bash
# Crear estructura de backup
mkdir -p legacy/api
mkdir -p legacy/src/components
mkdir -p legacy/src/services
```

**Archivos a guardar:**
- `api/chat.ts` → `legacy/api/chat.ts`
- `src/services/chatService.ts` → `legacy/src/services/chatService.ts`
- Documentar funcionalidades actuales en `legacy/README.md`

### Paso 2: Crear flag de feature

Crear variable de entorno `USE_RAG_CHAT=false` para poder alternar entre implementaciones.

### Paso 3: Instalar dependencias

```bash
npm install langchain @langchain/openai @langchain/community
```

---

## 🔧 Fase 1: Infraestructura Base (2-3 horas)

### Paso 1.1: Habilitar pgvector en Supabase

**Archivo**: `supabase/migrations/001_enable_pgvector.sql`

```sql
-- Habilitar extensión pgvector
CREATE EXTENSION IF NOT EXISTS vector;

-- Verificar que está habilitada
SELECT * FROM pg_extension WHERE extname = 'vector';
```

**Ejecutar en Supabase SQL Editor**

### Paso 1.2: Crear tabla de embeddings

**Archivo**: `supabase/migrations/002_create_embeddings_table.sql`

```sql
-- Tabla para almacenar embeddings de productos
CREATE TABLE IF NOT EXISTS product_embeddings (
  id BIGSERIAL PRIMARY KEY,
  product_id BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  content TEXT NOT NULL, -- Texto original del chunk
  embedding vector(3072), -- Dimensión de text-embedding-3-large
  metadata JSONB DEFAULT '{}', -- Metadatos adicionales
  chunk_index INTEGER DEFAULT 0, -- Índice del chunk si el producto tiene múltiples
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índice vectorial HNSW para búsqueda rápida
CREATE INDEX IF NOT EXISTS product_embeddings_embedding_idx 
ON product_embeddings 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);

-- Índice para búsqueda por product_id
CREATE INDEX IF NOT EXISTS product_embeddings_product_id_idx 
ON product_embeddings(product_id);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION update_embeddings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_embeddings_updated_at 
  BEFORE UPDATE ON product_embeddings 
  FOR EACH ROW 
  EXECUTE FUNCTION update_embeddings_updated_at();

-- RLS Policies
ALTER TABLE product_embeddings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access" ON product_embeddings
  FOR SELECT USING (true);

CREATE POLICY "Allow public insert access" ON product_embeddings
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Allow public update access" ON product_embeddings
  FOR UPDATE USING (true);
```

### Paso 1.3: Crear función de búsqueda por similitud

**Archivo**: `supabase/migrations/003_create_similarity_search_function.sql`

```sql
-- Función para buscar chunks similares
CREATE OR REPLACE FUNCTION search_similar_chunks(
  query_embedding vector(3072),
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id bigint,
  product_id bigint,
  content text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    product_embeddings.id,
    product_embeddings.product_id,
    product_embeddings.content,
    1 - (product_embeddings.embedding <=> query_embedding) as similarity,
    product_embeddings.metadata
  FROM product_embeddings
  WHERE 1 - (product_embeddings.embedding <=> query_embedding) > match_threshold
  ORDER BY product_embeddings.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### Validación Fase 1

```bash
# Verificar extensión
# En Supabase SQL Editor:
SELECT * FROM pg_extension WHERE extname = 'vector';

# Verificar tabla
SELECT * FROM product_embeddings LIMIT 1;
```

---

## 📦 Fase 2: Pipeline de Indexación (4-6 horas)

### Paso 2.1: Crear utilidades de embeddings

**Archivo**: `api/utils/embeddings.ts`

```typescript
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const EMBEDDING_MODEL = 'text-embedding-3-large';
const EMBEDDING_DIMENSIONS = 3072;

export async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  return response.data[0].embedding;
}

export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: texts,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  
  return response.data.map(item => item.embedding);
}
```

### Paso 2.2: Crear utilidades de chunking

**Archivo**: `api/utils/chunking.ts`

```typescript
interface Chunk {
  content: string;
  metadata: {
    product_id: number;
    product_name: string;
    chunk_index: number;
    source: 'name' | 'description' | 'combined';
  };
}

export function chunkProduct(product: {
  id: number;
  name: string;
  description: string;
  category?: string;
  subcategory?: string;
}): Chunk[] {
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
```

### Paso 2.3: Crear endpoint de indexación

**Archivo**: `api/index-products-rag.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { generateEmbeddings } from './utils/embeddings';
import { chunkProduct } from './utils/chunking';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // Necesario para operaciones admin
  );

  try {
    // Obtener productos sin indexar o todos si se especifica
    const { force = false, limit = null } = req.body;
    
    let query = supabase.from('products').select('*');
    
    if (!force) {
      // Solo productos que no tienen embeddings
      query = query.not('id', 'in', 
        supabase.from('product_embeddings').select('product_id')
      );
    }
    
    if (limit) {
      query = query.limit(limit);
    }
    
    const { data: products, error } = await query;
    
    if (error) throw error;
    if (!products || products.length === 0) {
      return res.json({ 
        success: true, 
        message: 'No hay productos para indexar',
        indexed: 0 
      });
    }

    let indexed = 0;
    const batchSize = 10; // Procesar en lotes para evitar rate limits

    for (let i = 0; i < products.length; i += batchSize) {
      const batch = products.slice(i, i + batchSize);
      
      // Generar chunks para todos los productos del batch
      const allChunks = batch.flatMap(product => chunkProduct(product));
      
      // Generar embeddings para todos los chunks
      const embeddings = await generateEmbeddings(
        allChunks.map(chunk => chunk.content)
      );
      
      // Guardar embeddings en Supabase
      const embeddingsToInsert = allChunks.map((chunk, idx) => ({
        product_id: chunk.metadata.product_id,
        content: chunk.content,
        embedding: `[${embeddings[idx].join(',')}]`, // Formato para pgvector
        metadata: chunk.metadata,
        chunk_index: chunk.metadata.chunk_index,
      }));
      
      const { error: insertError } = await supabase
        .from('product_embeddings')
        .insert(embeddingsToInsert);
      
      if (insertError) throw insertError;
      
      indexed += batch.length;
      
      // Rate limiting: esperar un poco entre batches
      if (i + batchSize < products.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    return res.json({
      success: true,
      message: `Indexados ${indexed} productos`,
      indexed,
      total: products.length,
    });
  } catch (error) {
    console.error('Error indexing products:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Validación Fase 2

```bash
# Probar indexación de 10 productos
curl -X POST http://localhost:3000/api/index-products-rag \
  -H "Content-Type: application/json" \
  -d '{"limit": 10}'

# Verificar embeddings guardados
# En Supabase SQL Editor:
SELECT COUNT(*) FROM product_embeddings;
SELECT * FROM product_embeddings LIMIT 5;
```

---

## 🔍 Fase 3: RAG Retrieval Básico (3-4 horas)

### Paso 3.1: Crear función de retrieval

**Archivo**: `api/utils/vectorStore.ts`

```typescript
import { createClient } from '@supabase/supabase-js';
import { generateEmbedding } from './embeddings';

interface RetrievedChunk {
  id: number;
  product_id: number;
  content: string;
  similarity: number;
  metadata: any;
}

export async function retrieveRelevantChunks(
  query: string,
  limit: number = 10,
  threshold: number = 0.7
): Promise<RetrievedChunk[]> {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  // Generar embedding de la query
  const queryEmbedding = await generateEmbedding(query);
  
  // Buscar chunks similares usando la función SQL
  const { data, error } = await supabase.rpc('search_similar_chunks', {
    query_embedding: `[${queryEmbedding.join(',')}]`,
    match_threshold: threshold,
    match_count: limit,
  });

  if (error) {
    console.error('Error retrieving chunks:', error);
    return [];
  }

  return (data || []).map((item: any) => ({
    id: item.id,
    product_id: item.product_id,
    content: item.content,
    similarity: item.similarity,
    metadata: item.metadata,
  }));
}
```

### Paso 3.2: Crear endpoint de prueba

**Archivo**: `api/test-rag-retrieval.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { retrieveRelevantChunks } from './utils/vectorStore';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { query } = req.body;
  
  if (!query || typeof query !== 'string') {
    return res.status(400).json({ error: 'Query is required' });
  }

  try {
    const chunks = await retrieveRelevantChunks(query, 10);
    
    // Obtener información completa de los productos
    const supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_ANON_KEY!
    );
    
    const productIds = [...new Set(chunks.map(c => c.product_id))];
    const { data: products } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds);

    return res.json({
      success: true,
      query,
      chunks,
      products: products || [],
      count: chunks.length,
    });
  } catch (error) {
    console.error('Error testing RAG retrieval:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Validación Fase 3

```bash
# Probar retrieval
curl -X POST http://localhost:3000/api/test-rag-retrieval \
  -H "Content-Type: application/json" \
  -d '{"query": "ahumador portátil"}'

# Verificar que encuentra productos relevantes aunque no coincida texto exacto
```

---

## 🔗 Fase 4: Integración con LangChain (2-3 horas)

### Paso 4.1: Configurar LangChain

**Archivo**: `api/utils/langchain-setup.ts`

```typescript
import { ChatOpenAI } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import { RetrievalQAChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY!,
  modelName: 'text-embedding-3-large',
  dimensions: 3072,
});

export async function createRAGChain() {
  // Crear vector store desde Supabase
  const vectorStore = await SupabaseVectorStore.fromExistingIndex(
    embeddings,
    {
      client: supabase,
      tableName: 'product_embeddings',
      queryName: 'search_similar_chunks',
    }
  );

  // Configurar LLM
  const llm = new ChatOpenAI({
    openAIApiKey: process.env.OPENAI_API_KEY!,
    modelName: 'gpt-3.5-turbo',
    temperature: 0.7,
  });

  // Crear prompt del sistema según propuesta técnica
  const systemPrompt = PromptTemplate.fromTemplate(`
Eres ChefCopilot, un asistente experto en cocina profesional y productos de cocina.

Tu objetivo es ayudar a los usuarios a encontrar productos relevantes basándote en la información del catálogo.

INSTRUCCIONES:
1. Analiza la consulta del usuario cuidadosamente
2. Utiliza SOLO la información proporcionada en el contexto
3. Si encuentras productos relevantes, preséntalos de forma clara y útil
4. Si no encuentras productos relevantes, sé honesto y sugiere búsquedas alternativas
5. Mantén un tono profesional pero amigable
6. Proporciona información específica sobre productos cuando sea posible

CONTEXTO:
{context}

PREGUNTA DEL USUARIO:
{question}

RESPUESTA:
`);

  // Crear chain
  const chain = RetrievalQAChain.fromLLM(llm, vectorStore.asRetriever(), {
    prompt: systemPrompt,
    returnSourceDocuments: true,
  });

  return chain;
}
```

### Validación Fase 4

```bash
# Probar chain completo
# Crear endpoint de prueba que use el chain
```

---

## 💬 Fase 5: Actualizar Endpoint Chat (2-3 horas)

### Paso 5.1: Crear nuevo endpoint RAG

**Archivo**: `api/chat-rag.ts`

```typescript
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createRAGChain } from './utils/langchain-setup';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { message, conversationHistory = [] } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const chain = await createRAGChain();
    const result = await chain.call({
      query: message,
    });

    return res.json({
      success: true,
      message: result.text,
      sources: result.sourceDocuments?.map((doc: any) => doc.metadata) || [],
      conversation_history: [
        ...conversationHistory,
        { role: 'user', content: message },
        { role: 'assistant', content: result.text },
      ],
    });
  } catch (error) {
    console.error('Error in RAG chat:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
```

### Paso 5.2: Modificar endpoint actual para usar flag

**Modificar**: `api/chat.ts`

```typescript
// Al inicio del handler
const useRAG = process.env.USE_RAG_CHAT === 'true';

if (useRAG) {
  // Redirigir a chat-rag.ts o importar su lógica
  // Por ahora, mantener ambos endpoints separados
}
```

### Validación Fase 5

- Probar desde el frontend
- Verificar que las respuestas son mejores
- Medir tiempos de respuesta
- Comparar con implementación anterior

---

## ✅ Fase 6: Optimización y Testing (2-3 horas)

### Tareas:
1. Ajustar parámetros de retrieval (número de chunks, threshold)
2. Implementar caching de embeddings de queries comunes
3. Optimizar prompts
4. Testing exhaustivo
5. Documentación

---

## 🎯 Checklist de Validación Final

- [ ] pgvector habilitado en Supabase
- [ ] Tabla de embeddings creada
- [ ] 100% de productos indexados
- [ ] Búsqueda semántica funciona correctamente
- [ ] LangChain integrado
- [ ] Chat funciona con RAG
- [ ] Tiempos de respuesta < 3 segundos
- [ ] Fallback a búsqueda exacta funciona
- [ ] Documentación completa
- [ ] Testing con casos reales

---

## 📝 Notas

- Mantener ambos endpoints (`chat.ts` y `chat-rag.ts`) durante la transición
- Usar flag `USE_RAG_CHAT` para alternar
- Validar cada fase antes de continuar
- Hacer backup antes de cada cambio importante


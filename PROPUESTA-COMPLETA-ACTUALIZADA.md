# 🚀 PROPUESTA COMPLETA ACTUALIZADA: Sistema Chat Multi-Plataforma con RAG

## 📋 ÍNDICE
1. [Arquitectura General](#1-arquitectura-general)
2. [Multi-Plataforma (PrestaShop + WooCommerce)](#2-multi-plataforma-prestashop--woocommerce)
3. [Sistema de Documentos con RAG](#3-sistema-de-documentos-con-rag)
4. [Dashboard de Configuración de Prompts](#4-dashboard-de-configuración-de-prompts)
5. [Function Calling Actualizado](#5-function-calling-actualizado)
6. [Base de Datos Expandida](#6-base-de-datos-expandida)
7. [Implementación Técnica](#7-implementación-técnica)

---

## 1. ARQUITECTURA GENERAL

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (React)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Productos   │  │  Conexiones  │  │     Chat     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │  Documentos  │  │  Config AI  │  │  Prompts     │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────┐
│              API ENDPOINTS (Vercel)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │   /api/chat  │  │ /api/docs    │  │ /api/prompts │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐   │
│  │ /api/products│  │ /api/stores  │  │ /api/embedd  │   │
│  └──────────────┘  └──────────────┘  └──────────────┘   │
└─────────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┴─────────────────┐
        │                                   │
        ▼                                   ▼
┌──────────────────┐              ┌──────────────────┐
│   SUPABASE       │              │    OPENAI API    │
│  - Products      │              │  - Chat          │
│  - Documents     │              │  - Embeddings    │
│  - Embeddings    │              │  - Function Call │
│  - Prompts       │              └──────────────────┘
│  - Stores        │
└──────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────┐
│              TIENDAS (PrestaShop / WooCommerce)           │
│  ┌──────────────┐              ┌──────────────┐          │
│  │ PrestaShop   │              │  WooCommerce │          │
│  │   API        │              │    API       │          │
│  └──────────────┘              └──────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. MULTI-PLATAFORMA (PrestaShop + WooCommerce)

### 2.1. Estructura de Datos Unificada

```typescript
// src/types.ts

export type StorePlatform = 'prestashop' | 'woocommerce';

export interface StoreConnection {
  id: string;
  name: string;
  platform: StorePlatform;
  apiKey: string;
  apiUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: string;
  storeId: string;           // ID de la conexión de tienda
  platform: StorePlatform;    // PrestaShop o WooCommerce
  name: string;
  price: string;
  category: string;
  subcategory?: string;
  description: string;
  sku: string;
  image: string;
  product_url: string;
  date_add?: string;
  // Campos específicos de WooCommerce
  wc_product_id?: number;
  wc_variations?: any[];
  // Campos específicos de PrestaShop
  ps_product_id?: number;
  ps_combinations?: any[];
}

export interface ApiConfig {
  storeId: string;
  platform: StorePlatform;
  apiKey: string;
  storeUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}
```

### 2.2. Abstracción de APIs

```typescript
// src/services/storeApi.ts

interface StoreApiAdapter {
  fetchProducts(config: ApiConfig, progress?: (current: number, total: number | null) => void): Promise<Product[]>;
  getProductBySku(config: ApiConfig, sku: string): Promise<Product | null>;
  getCategories(config: ApiConfig): Promise<string[]>;
}

class PrestaShopAdapter implements StoreApiAdapter {
  // Implementación actual
}

class WooCommerceAdapter implements StoreApiAdapter {
  async fetchProducts(config: ApiConfig, progress?: (current: number, total: number | null) => void): Promise<Product[]> {
    // Implementación para WooCommerce REST API
    // WooCommerce usa: /wp-json/wc/v3/products
  }
}

// Factory
export function getStoreAdapter(platform: StorePlatform): StoreApiAdapter {
  switch (platform) {
    case 'prestashop':
      return new PrestaShopAdapter();
    case 'woocommerce':
      return new WooCommerceAdapter();
    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}
```

### 2.3. Componente de Conexiones Actualizado

```typescript
// src/components/Connections.tsx (actualizado)

export function Connections() {
  const [stores, setStores] = useState<StoreConnection[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<StorePlatform>('prestashop');

  return (
    <div>
      {/* Selector de plataforma */}
      <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value as StorePlatform)}>
        <option value="prestashop">PrestaShop</option>
        <option value="woocommerce">WooCommerce</option>
      </select>

      {/* Formulario de conexión (adaptado según plataforma) */}
      {selectedPlatform === 'prestashop' && <PrestaShopAuthForm />}
      {selectedPlatform === 'woocommerce' && <WooCommerceAuthForm />}

      {/* Lista de conexiones */}
      <StoreList stores={stores} />
    </div>
  );
}
```

---

## 3. SISTEMA DE DOCUMENTOS CON RAG

### 3.1. Base de Datos para Documentos

```sql
-- Tabla para almacenar documentos
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT, -- 'pdf', 'txt', 'md', 'html', 'url'
  file_url TEXT,  -- URL del archivo si está en storage
  source TEXT,    -- 'upload', 'web_scrape', 'manual'
  tags TEXT[],    -- Array de tags para categorización
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  is_active BOOLEAN DEFAULT true
);

-- Tabla para chunks (fragmentos de documentos)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL, -- Índice del chunk en el documento
  content TEXT NOT NULL,
  embedding vector(1536), -- Vector de embeddings (OpenAI usa 1536 dimensiones)
  metadata JSONB, -- Metadatos adicionales (página, sección, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices para búsqueda vectorial
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding 
  ON document_chunks USING ivfflat (embedding vector_cosine_ops);

CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id 
  ON document_chunks(document_id);

-- Índice full-text para búsqueda híbrida
CREATE INDEX IF NOT EXISTS idx_document_chunks_content 
  ON document_chunks USING gin(to_tsvector('spanish', content));

-- Tabla para configuración de web scraping
CREATE TABLE IF NOT EXISTS web_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  last_scraped TIMESTAMP WITH TIME ZONE,
  scrape_interval_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
```

### 3.2. Proceso de RAG (Retrieval Augmented Generation)

```typescript
// api/process-document.ts

import OpenAI from 'openai';
import { createClient } from '@supabase/supabase-js';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

export async function processDocument(documentId: string, content: string) {
  // 1. Dividir documento en chunks (fragmentos)
  const chunks = splitIntoChunks(content, {
    maxChunkSize: 1000,  // ~1000 tokens por chunk
    overlap: 200         // 200 tokens de solapamiento
  });

  // 2. Generar embeddings para cada chunk
  const embeddings = await Promise.all(
    chunks.map(chunk => 
      openai.embeddings.create({
        model: 'text-embedding-3-small', // o 'text-embedding-ada-002'
        input: chunk.content
      })
    )
  );

  // 3. Guardar chunks con embeddings en Supabase
  for (let i = 0; i < chunks.length; i++) {
    await supabase.from('document_chunks').insert({
      document_id: documentId,
      chunk_index: i,
      content: chunks[i].content,
      embedding: embeddings[i].data[0].embedding,
      metadata: chunks[i].metadata
    });
  }
}

function splitIntoChunks(text: string, options: { maxChunkSize: number; overlap: number }) {
  // Dividir texto en chunks inteligentes
  // Considerar párrafos, oraciones, etc.
}
```

### 3.3. Búsqueda Semántica en Documentos

```typescript
// api/search-documents.ts

export async function searchDocuments(query: string, limit: number = 5) {
  // 1. Generar embedding de la consulta
  const queryEmbedding = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: query
  });

  // 2. Búsqueda vectorial en Supabase
  const { data, error } = await supabase.rpc('match_document_chunks', {
    query_embedding: queryEmbedding.data[0].embedding,
    match_threshold: 0.7,  // Similitud mínima (0-1)
    match_count: limit
  });

  if (error) throw error;

  // 3. Devolver chunks relevantes con contexto
  return data.map(chunk => ({
    content: chunk.content,
    document_title: chunk.document_title,
    document_id: chunk.document_id,
    similarity: chunk.similarity,
    metadata: chunk.metadata
  }));
}

// Función SQL en Supabase (supabase-schema.sql)
CREATE OR REPLACE FUNCTION match_document_chunks(
  query_embedding vector(1536),
  match_threshold float,
  match_count int
)
RETURNS TABLE (
  id uuid,
  content text,
  document_id uuid,
  document_title text,
  similarity float,
  metadata jsonb
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    dc.id,
    dc.content,
    dc.document_id,
    d.title as document_title,
    1 - (dc.embedding <=> query_embedding) as similarity,
    dc.metadata
  FROM document_chunks dc
  JOIN documents d ON dc.document_id = d.id
  WHERE d.is_active = true
    AND 1 - (dc.embedding <=> query_embedding) > match_threshold
  ORDER BY dc.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;
```

### 3.4. Integración en Function Calling

```typescript
// Añadir función para buscar en documentos
{
  name: "search_documents",
  description: "Busca información en la documentación proporcionada. Usa esta función cuando el usuario pregunte sobre procesos, políticas, instrucciones, o cualquier información que pueda estar en los documentos.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Consulta de búsqueda. Buscará en el contenido de todos los documentos disponibles."
      },
      limit: {
        type: "number",
        description: "Número máximo de fragmentos de documentos a devolver. Por defecto: 5."
      }
    },
    required: ["query"]
  }
}
```

---

## 4. DASHBOARD DE CONFIGURACIÓN DE PROMPTS

### 4.1. Base de Datos para Prompts

```sql
-- Tabla para almacenar prompts del sistema
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla para versiones de prompts (historial)
CREATE TABLE IF NOT EXISTS prompt_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  version INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  created_by TEXT
);

-- Tabla para variables dinámicas en prompts
CREATE TABLE IF NOT EXISTS prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text', -- 'text', 'number', 'boolean', 'array'
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);
```

### 4.2. Componente de Configuración de Prompts

```typescript
// src/components/PromptConfig.tsx

export function PromptConfig() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [activePrompt, setActivePrompt] = useState<SystemPrompt | null>(null);
  const [promptText, setPromptText] = useState('');
  const [variables, setVariables] = useState<PromptVariable[]>([]);

  // Cargar prompts
  useEffect(() => {
    fetchPrompts();
  }, []);

  // Guardar prompt
  const handleSave = async () => {
    const response = await fetch('/api/prompts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: activePrompt?.name || 'Nuevo Prompt',
        prompt: promptText,
        variables: variables
      })
    });
    // ...
  };

  // Previsualizar prompt con variables
  const previewPrompt = () => {
    let preview = promptText;
    variables.forEach(v => {
      preview = preview.replace(`{{${v.variable_name}}}`, v.variable_value || '');
    });
    return preview;
  };

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Editor de Prompt */}
      <div>
        <h2>Editor de Prompt</h2>
        <textarea
          value={promptText}
          onChange={(e) => setPromptText(e.target.value)}
          className="w-full h-96 font-mono"
          placeholder="Escribe tu prompt del sistema aquí..."
        />
        
        {/* Variables dinámicas */}
        <div>
          <h3>Variables</h3>
          {variables.map(v => (
            <input
              key={v.id}
              value={v.variable_value}
              onChange={(e) => updateVariable(v.id, e.target.value)}
              placeholder={v.variable_name}
            />
          ))}
        </div>

        {/* Previsualización */}
        <div>
          <h3>Vista Previa</h3>
          <pre className="bg-gray-100 p-4">{previewPrompt()}</pre>
        </div>

        <button onClick={handleSave}>Guardar Prompt</button>
        <button onClick={() => setActivePrompt(null)}>Activar este Prompt</button>
      </div>

      {/* Lista de Prompts */}
      <div>
        <h2>Prompts Guardados</h2>
        <PromptList 
          prompts={prompts}
          onSelect={(p) => {
            setActivePrompt(p);
            setPromptText(p.prompt);
            loadVariables(p.id);
          }}
        />
      </div>
    </div>
  );
}
```

### 4.3. Variables Dinámicas en Prompts

```typescript
// Sistema de variables dinámicas
// Ejemplo de prompt con variables:

const PROMPT_TEMPLATE = `
Eres un asistente experto en productos de {{store_platform}}.

## CONTEXTO
- Base de datos: Supabase
- Plataforma: {{store_platform}}
- Total de productos: {{total_products}}
- Categorías disponibles: {{categories}}

## INSTRUCCIONES
{{instructions}}

## REGLAS
- Responde en {{language}}
- Formato de precios: {{price_format}}
`;

// Variables disponibles:
const DEFAULT_VARIABLES = [
  { name: 'store_platform', value: 'PrestaShop', type: 'text' },
  { name: 'total_products', value: '0', type: 'number' },
  { name: 'categories', value: '', type: 'array' },
  { name: 'language', value: 'español', type: 'text' },
  { name: 'price_format', value: 'EUR', type: 'text' },
  { name: 'instructions', value: '...', type: 'text' }
];
```

### 4.4. API para Gestión de Prompts

```typescript
// api/prompts.ts

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!
  );

  if (req.method === 'GET') {
    // Obtener prompts
    const { data, error } = await supabase
      .from('system_prompts')
      .select('*')
      .order('created_at', { ascending: false });

    res.json({ prompts: data });
  }

  if (req.method === 'POST') {
    // Crear/actualizar prompt
    const { name, prompt, variables, is_active } = req.body;

    // Guardar prompt
    const { data: promptData, error } = await supabase
      .from('system_prompts')
      .insert({
        name,
        prompt,
        is_active: is_active || false
      })
      .select()
      .single();

    // Guardar variables
    if (variables && variables.length > 0) {
      await supabase.from('prompt_variables').insert(
        variables.map((v: any) => ({
          prompt_id: promptData.id,
          ...v
        }))
      );
    }

    res.json({ success: true, prompt: promptData });
  }

  if (req.method === 'PUT') {
    // Activar un prompt
    const { id } = req.body;

    // Desactivar todos
    await supabase
      .from('system_prompts')
      .update({ is_active: false });

    // Activar el seleccionado
    await supabase
      .from('system_prompts')
      .update({ is_active: true })
      .eq('id', id);

    res.json({ success: true });
  }
}
```

---

## 5. FUNCTION CALLING ACTUALIZADO

### 5.1. Funciones Completas

```typescript
const FUNCTIONS = [
  // Búsqueda de productos (multi-plataforma)
  {
    name: "search_products",
    description: "Busca productos en las tiendas conectadas (PrestaShop y WooCommerce). Usa esta función cuando el usuario pregunte por productos, categorías, precios, SKUs o cualquier búsqueda de productos.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Texto de búsqueda" },
        category: { type: "string", description: "Filtrar por categoría" },
        platform: { 
          type: "string", 
          enum: ["prestashop", "woocommerce", "all"],
          description: "Plataforma específica o 'all' para todas" 
        },
        store_id: { type: "string", description: "ID de tienda específica" },
        min_price: { type: "number" },
        max_price: { type: "number" },
        limit: { type: "number", default: 20 }
      }
    }
  },

  // Búsqueda en documentos
  {
    name: "search_documents",
    description: "Busca información en la documentación proporcionada. Usa esta función cuando el usuario pregunte sobre procesos, políticas, instrucciones, configuración, o cualquier información que pueda estar documentada.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "Consulta de búsqueda semántica" },
        limit: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  },

  // Búsqueda en web propia (documentación web)
  {
    name: "search_web_documentation",
    description: "Busca información en la documentación web propia que ha sido indexada. Usa esta función cuando el usuario pregunte sobre información de la web, guías, tutoriales o contenido web documentado.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string" },
        limit: { type: "number", default: 5 }
      },
      required: ["query"]
    }
  },

  // Obtener producto por SKU
  {
    name: "get_product_by_sku",
    description: "Obtiene un producto específico por su SKU. Busca en todas las tiendas conectadas.",
    parameters: {
      type: "object",
      properties: {
        sku: { type: "string" },
        platform: { type: "string", enum: ["prestashop", "woocommerce", "all"] }
      },
      required: ["sku"]
    }
  },

  // Estadísticas
  {
    name: "get_category_stats",
    description: "Obtiene estadísticas sobre categorías de productos.",
    parameters: {
      type: "object",
      properties: {
        category: { type: "string" },
        platform: { type: "string" }
      }
    }
  }
];
```

---

## 6. BASE DE DATOS EXPANDIDA

### 6.1. Schema Completo

```sql
-- ============================================
-- TABLA DE TIENDAS (CONEXIONES)
-- ============================================
CREATE TABLE IF NOT EXISTS stores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('prestashop', 'woocommerce')),
  api_key TEXT NOT NULL,
  api_url TEXT NOT NULL,
  base_url TEXT,
  lang_code INTEGER,
  lang_slug TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLA DE PRODUCTOS (ACTUALIZADA)
-- ============================================
ALTER TABLE products ADD COLUMN IF NOT EXISTS store_id UUID REFERENCES stores(id);
ALTER TABLE products ADD COLUMN IF NOT EXISTS platform TEXT CHECK (platform IN ('prestashop', 'woocommerce'));

-- ============================================
-- TABLA DE DOCUMENTOS
-- ============================================
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  file_type TEXT,
  file_url TEXT,
  source TEXT DEFAULT 'upload',
  tags TEXT[],
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLA DE CHUNKS DE DOCUMENTOS
-- ============================================
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLA DE FUENTES WEB
-- ============================================
CREATE TABLE IF NOT EXISTS web_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  last_scraped TIMESTAMP WITH TIME ZONE,
  scrape_interval_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLA DE PROMPTS
-- ============================================
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- TABLA DE VARIABLES DE PROMPTS
-- ============================================
CREATE TABLE IF NOT EXISTS prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- ============================================
-- ÍNDICES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_store_id ON products(store_id);
CREATE INDEX IF NOT EXISTS idx_products_platform ON products(platform);
CREATE INDEX IF NOT EXISTS idx_document_chunks_embedding ON document_chunks USING ivfflat (embedding vector_cosine_ops);
CREATE INDEX IF NOT EXISTS idx_document_chunks_document_id ON document_chunks(document_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_content ON document_chunks USING gin(to_tsvector('spanish', content));
```

---

## 7. IMPLEMENTACIÓN TÉCNICA

### 7.1. Estructura de Archivos

```
api/
  ├── chat.ts                    # Endpoint principal del chat
  ├── query-products.ts          # Consultas a productos (multi-plataforma)
  ├── search-documents.ts        # Búsqueda en documentos (RAG)
  ├── search-web.ts              # Búsqueda en web propia
  ├── process-document.ts         # Procesar y vectorizar documentos
  ├── prompts.ts                 # Gestión de prompts
  ├── stores.ts                  # Gestión de tiendas
  └── embeddings.ts              # Generar embeddings

src/
  ├── components/
  │   ├── Dashboard.tsx          # Dashboard principal (actualizado)
  │   ├── Chat.tsx               # Componente del chat
  │   ├── ChatConfig.tsx         # Configuración de OpenAI
  │   ├── PromptConfig.tsx       # ⭐ NUEVO: Configuración de prompts
  │   ├── Documents.tsx          # ⭐ NUEVO: Gestión de documentos
  │   ├── WebSources.tsx         # ⭐ NUEVO: Gestión de fuentes web
  │   ├── Connections.tsx        # Actualizado: Multi-plataforma
  │   └── ProductsReport.tsx
  ├── services/
  │   ├── openaiService.ts       # Servicio de OpenAI
  │   ├── storeApi.ts            # ⭐ NUEVO: Abstracción de tiendas
  │   ├── prestashopApi.ts       # Actual
  │   ├── woocommerceApi.ts      # ⭐ NUEVO: API de WooCommerce
  │   ├── documentService.ts     # ⭐ NUEVO: Servicio de documentos
  │   └── promptService.ts       # ⭐ NUEVO: Servicio de prompts
  └── types.ts                   # Tipos actualizados
```

### 7.2. Dependencias Nuevas

```json
{
  "dependencies": {
    "openai": "^4.0.0",
    "@supabase/supabase-js": "^2.78.0",
    "zod": "^3.22.0",
    "node-cache": "^5.1.2",
    "pdf-parse": "^1.1.1",           // Para procesar PDFs
    "mammoth": "^1.6.0",            // Para procesar Word docs
    "cheerio": "^1.0.0",            // Para scraping web
    "puppeteer": "^21.0.0"          // Para scraping dinámico
  }
}
```

### 7.3. Variables de Entorno

```env
# OpenAI
OPENAI_API_KEY=sk-...
OPENAI_DEFAULT_MODEL=gpt-4
OPENAI_DEFAULT_TEMPERATURE=0.7
OPENAI_MAX_TOKENS=2000

# Supabase
SUPABASE_URL=https://...
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_KEY=...  # Para operaciones admin

# Storage (para documentos)
STORAGE_BUCKET=documents
```

---

## 🎯 RESUMEN DE MEJORAS

### ✅ Multi-Plataforma
- ✅ PrestaShop (ya implementado)
- ✅ WooCommerce (nuevo)
- ✅ Abstracción unificada de APIs
- ✅ Base de datos unificada

### ✅ Sistema de Documentos (RAG)
- ✅ Subida de documentos (PDF, TXT, MD, HTML)
- ✅ Procesamiento y vectorización
- ✅ Búsqueda semántica con embeddings
- ✅ Integración en Function Calling

### ✅ Consulta a Web Propia
- ✅ Configuración de URLs para scraping
- ✅ Indexación automática
- ✅ Búsqueda en contenido web

### ✅ Dashboard de Prompts
- ✅ Editor de prompts desde la UI
- ✅ Variables dinámicas
- ✅ Previsualización
- ✅ Activación/desactivación
- ✅ Historial de versiones

### ✅ Sin Búsquedas Externas
- ✅ Solo documentación propia
- ✅ Solo tiendas conectadas
- ✅ Sin acceso a internet abierto

---

## 📊 PRIORIDADES DE IMPLEMENTACIÓN

### Fase 1: Multi-Plataforma (Semana 1)
- [ ] Abstracción de APIs de tiendas
- [ ] Implementación de WooCommerce
- [ ] Actualización de base de datos
- [ ] Componente de conexiones actualizado

### Fase 2: Sistema de Documentos (Semana 2)
- [ ] Schema de base de datos para documentos
- [ ] Procesamiento de documentos
- [ ] Sistema de embeddings
- [ ] Búsqueda semántica
- [ ] Componente de gestión de documentos

### Fase 3: Dashboard de Prompts (Semana 3)
- [ ] Schema de base de datos para prompts
- [ ] API de gestión de prompts
- [ ] Componente de configuración
- [ ] Sistema de variables dinámicas
- [ ] Integración con chat

### Fase 4: Web Scraping (Semana 4)
- [ ] Configuración de fuentes web
- [ ] Scraping automático
- [ ] Procesamiento de contenido web
- [ ] Integración en búsquedas

### Fase 5: Testing y Optimización (Semana 5)
- [ ] Testing completo
- [ ] Optimización de performance
- [ ] Ajustes de prompts
- [ ] Documentación

---

## 💡 NOTAS IMPORTANTES

1. **RAG con Supabase**: Supabase soporta búsqueda vectorial con `pgvector`. Necesitas habilitar la extensión:
   ```sql
   CREATE EXTENSION IF NOT EXISTS vector;
   ```

2. **Embeddings**: Usar `text-embedding-3-small` (más económico) o `text-embedding-ada-002` (más preciso).

3. **Seguridad**: Los documentos y prompts deben tener control de acceso adecuado.

4. **Performance**: 
   - Caché de embeddings
   - Procesamiento asíncrono de documentos grandes
   - Límites en búsquedas vectoriales

5. **Costos**: 
   - Embeddings: ~$0.02 por 1M tokens
   - Chat: Depende del modelo
   - Considerar límites de rate

---

¿Quieres que comience con alguna fase específica o prefieres que implemente todo el sistema completo?


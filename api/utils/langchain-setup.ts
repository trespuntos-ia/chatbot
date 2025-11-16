import { ChatOpenAI } from '@langchain/openai';
import { SupabaseVectorStore } from '@langchain/community/vectorstores/supabase';
import { OpenAIEmbeddings } from '@langchain/openai';
import { createClient } from '@supabase/supabase-js';
import { RetrievalQAChain } from 'langchain/chains';
import { PromptTemplate } from '@langchain/core/prompts';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase configuration missing');
}

const supabase = createClient(supabaseUrl, supabaseKey);

const embeddings = new OpenAIEmbeddings({
  openAIApiKey: process.env.OPENAI_API_KEY!,
  modelName: 'text-embedding-3-small', // Cambiado a small para compatibilidad con HNSW en Supabase (máx 2000 dims)
  dimensions: 1536, // Especificar explícitamente para consistencia
});

/**
 * Crea un vector store desde Supabase
 */
export async function createVectorStore() {
  try {
    // Verificar conexión con Supabase primero
    const { error: testError } = await supabase
      .from('product_embeddings')
      .select('id')
      .limit(1);
    
    if (testError) {
      throw new Error(`Supabase connection failed: ${testError.message}`);
    }

    // Crear vector store desde la tabla existente con timeout
    const vectorStore = await Promise.race([
      SupabaseVectorStore.fromExistingIndex(
        embeddings,
        {
          client: supabase,
          tableName: 'product_embeddings',
          queryName: 'search_similar_chunks',
        }
      ),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout creating vector store (10s)')), 10000)
      )
    ]) as any;

    return vectorStore;
  } catch (error) {
    console.error('Error creating vector store:', error);
    throw error;
  }
}

/**
 * Crea un chain de RAG usando LangChain
 */
export async function createRAGChain() {
  try {
    // Crear vector store
    const vectorStore = await createVectorStore();

    // Configurar LLM
    const llm = new ChatOpenAI({
      openAIApiKey: process.env.OPENAI_API_KEY!,
      modelName: 'gpt-3.5-turbo', // Usar GPT-3.5 para mejor velocidad y costo
      temperature: 0.7,
      maxTokens: 800,
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
7. Si mencionas productos, incluye detalles como nombre, precio si está disponible, y características principales
8. Responde siempre en español

CONTEXTO (información de productos del catálogo):
{context}

PREGUNTA DEL USUARIO:
{question}

RESPUESTA (sé conciso pero útil):
`);

    // Crear retriever con configuración optimizada
    const retriever = vectorStore.asRetriever({
      k: 5, // Número de chunks a recuperar
      searchType: 'similarity',
    });

    // Crear chain
    const chain = RetrievalQAChain.fromLLM(llm, retriever, {
      prompt: systemPrompt,
      returnSourceDocuments: true,
      verbose: false,
    });

    return chain;
  } catch (error) {
    console.error('Error creating RAG chain:', error);
    throw error;
  }
}


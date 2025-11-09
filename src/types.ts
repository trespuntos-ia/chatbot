export interface CategoryInfo {
  category: string;
  subcategory: string | null;
  subsubcategory?: string | null;
  hierarchy: string[];
  category_id: number;
  is_primary: boolean;
}

export interface Product {
  name: string;
  price: string;
  category: string;
  subcategory?: string; // Subcategoría del producto
  description: string;
  sku: string;
  image: string;
  product_url: string;
  date_add?: string; // Fecha de creación en PrestaShop
  colors?: string[]; // Colores disponibles del producto
  all_categories?: CategoryInfo[] | null; // Todas las categorías del producto con jerarquía completa
}

export interface ApiConfig {
  apiKey: string;
  prestashopUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}

// Tipos para sistema de prompts (Fase 1)
export interface PromptVariable {
  id?: string;
  prompt_id?: string;
  variable_name: string;
  variable_value: string;
  variable_type?: 'text' | 'number' | 'boolean' | 'array';
  description?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SystemPrompt {
  id: string;
  name: string;
  prompt: string;
  description?: string;
  is_active: boolean;
  version?: number;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
  variables?: PromptVariable[];
}

// Tipos para Chat (Fase 2)
export type MessageSource = 'products_db' | 'web' | 'documents' | 'general';

export interface ResponseTimingStep {
  name: string;
  duration_ms: number;
}

export interface ResponseTimings {
  total_ms: number;
  steps: ResponseTimingStep[];
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  function_calls?: any[];
  function_result?: any;
  products?: Product[]; // Productos encontrados en esta respuesta
  sources?: MessageSource[]; // Fuentes de información utilizadas
  conversation_id?: string | null; // ID de la conversación para feedback
  feedback_submitted?: boolean; // Si el usuario ya envió feedback para este mensaje
  response_timings?: ResponseTimings; // Métricas de tiempo de respuesta asociadas al mensaje
}

export interface ChatConfig {
  model: string;
  temperature: number;
  max_tokens: number;
  top_p?: number;
  frequency_penalty?: number;
  presence_penalty?: number;
}

export interface ChatResponse {
  success: boolean;
  message?: string;
  function_called?: string;
  function_result?: any;
  conversation_history?: ChatMessage[];
  conversation_id?: string | null; // ID de la conversación guardada en analytics
  error?: string;
  details?: string;
  timings?: ResponseTimings;
}

// Tipos para Documentación
export interface Document {
  id: number;
  filename: string;
  original_filename: string;
  file_type: string;
  file_size: number;
  mime_type?: string;
  created_at?: string;
  updated_at?: string;
  has_extracted_text?: boolean; // Indica si el documento tiene texto extraído
}

export interface DocumentUploadResponse {
  success: boolean;
  document?: Document;
  error?: string;
  details?: string;
}

export interface DocumentSearchResult {
  id: number;
  filename: string;
  file_type: string;
  snippet: string;
  created_at?: string;
}


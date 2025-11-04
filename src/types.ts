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


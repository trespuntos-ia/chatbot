export interface Product {
  name: string;
  price: string;
  category: string;
  description: string;
  sku: string;
  image: string;
  product_url: string;
}

export interface ApiConfig {
  apiKey: string;
  prestashopUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}


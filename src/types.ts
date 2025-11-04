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


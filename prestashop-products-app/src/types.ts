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
  subcategory?: string;
  description: string;
  sku: string;
  image: string;
  product_url: string;
  date_add?: string;
  all_categories?: CategoryInfo[] | null;
}

export interface ApiConfig {
  apiKey: string;
  prestashopUrl: string;
  baseUrl?: string;
  langCode?: number;
  langSlug?: string;
}


import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';

export interface Product {
  id: string;
  name: string;
  price: string;
  category: string;
  description: string;
  sku: string;
  image: string;
  product_url: string;
}

export interface FetchProductsResponse {
  success: boolean;
  products: Product[];
  has_more: boolean;
  progress: {
    total: number;
    current: number;
    products: Product[];
  };
  session_id: string;
}

export interface ProgressResponse {
  progress: {
    total: number;
    current: number;
    products: Product[];
  };
}

export interface SaveProductsResponse {
  success: boolean;
  saved: number;
  errors: string[];
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProductService {
  private apiUrl = 'http://localhost:8000/api';
  private progressSubject = new BehaviorSubject<{ total: number; current: number; percentage: number }>({
    total: 0,
    current: 0,
    percentage: 0
  });
  public progress$ = this.progressSubject.asObservable();

  constructor(private http: HttpClient) {}

  fetchProducts(offset: number = 0, limit: number = 150, sessionId?: string): Observable<FetchProductsResponse> {
    let params = new HttpParams()
      .set('offset', offset.toString())
      .set('limit', limit.toString());
    
    if (sessionId) {
      params = params.set('session_id', sessionId);
    }

    return this.http.get<FetchProductsResponse>(`${this.apiUrl}/products/fetch`, {
      params,
      withCredentials: true
    });
  }

  getProgress(sessionId: string): Observable<ProgressResponse> {
    const params = new HttpParams().set('session_id', sessionId);
    return this.http.get<ProgressResponse>(`${this.apiUrl}/products/progress`, {
      params,
      withCredentials: true
    });
  }

  getAllProducts(sessionId: string): Observable<{ products: Product[]; total: number }> {
    const params = new HttpParams().set('session_id', sessionId);
    return this.http.get<{ products: Product[]; total: number }>(`${this.apiUrl}/products/all`, {
      params,
      withCredentials: true
    });
  }

  saveProducts(products: Product[]): Observable<SaveProductsResponse> {
    return this.http.post<SaveProductsResponse>(`${this.apiUrl}/products/save`, {
      products
    }, {
      withCredentials: true
    });
  }

  updateProgress(current: number, total: number) {
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;
    this.progressSubject.next({ current, total, percentage });
  }
}


import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ProductService, Product } from '../../services/product.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="min-h-screen bg-slate-100 py-10 px-4">
      <div class="max-w-7xl mx-auto">
        <!-- Header -->
        <div class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-6 mb-6">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 class="text-3xl font-bold text-slate-900 mb-2">Productos de PrestaShop</h1>
              <p class="text-slate-600">Total: {{ products.length }} productos</p>
            </div>
            <div class="flex gap-3">
              <button
                *ngIf="products.length > 0 && !saving"
                (click)="saveProducts()"
                class="px-6 py-3 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 transition"
              >
                Guardar Productos
              </button>
              <button
                (click)="logout()"
                class="px-6 py-3 bg-slate-600 text-white rounded-lg font-semibold hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-500 transition"
              >
                Cerrar Sesión
              </button>
            </div>
          </div>
        </div>

        <!-- Barra de Progreso -->
        <div *ngIf="loading" class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-6 mb-6">
          <div class="mb-4">
            <div class="flex justify-between items-center mb-2">
              <span class="text-sm font-medium text-slate-700">Obteniendo productos...</span>
              <span class="text-sm font-semibold text-indigo-600">{{ progress.current }} / {{ progress.total }}</span>
            </div>
            <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
              <div
                class="bg-indigo-600 h-3 rounded-full transition-all duration-300 ease-out"
                [style.width.%]="progress.percentage"
              ></div>
            </div>
          </div>
          <p class="text-sm text-slate-600">Porcentaje completado: {{ progress.percentage }}%</p>
        </div>

        <!-- Mensaje de éxito al guardar -->
        <div *ngIf="saveSuccess" class="bg-emerald-50 border border-emerald-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-emerald-800">{{ saveMessage }}</p>
        </div>

        <!-- Mensaje de error -->
        <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
          <p class="text-sm text-red-800">{{ error }}</p>
        </div>

        <!-- Tabla de Productos -->
        <div *ngIf="!loading && products.length > 0" class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 overflow-hidden">
          <div class="overflow-x-auto">
            <table class="min-w-full divide-y divide-slate-200">
              <thead class="bg-slate-50">
                <tr>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Imagen</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Nombre</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Precio</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Categoría</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Descripción</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">SKU</th>
                  <th class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">URL</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-200">
                <tr *ngFor="let product of products" class="hover:bg-slate-50 transition">
                  <td class="px-6 py-4 whitespace-nowrap">
                    <img
                      *ngIf="product.image"
                      [src]="product.image"
                      [alt]="product.name"
                      class="w-16 h-16 object-cover rounded-lg"
                      (error)="$event.target.style.display='none'"
                    />
                    <div *ngIf="!product.image" class="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center">
                      <span class="text-xs text-slate-400">Sin imagen</span>
                    </div>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm font-medium text-slate-900">{{ product.name }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-slate-700">{{ product.price }}</div>
                  </td>
                  <td class="px-6 py-4">
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-800">
                      {{ product.category || 'Sin categoría' }}
                    </span>
                  </td>
                  <td class="px-6 py-4">
                    <div class="text-sm text-slate-600 max-w-xs line-clamp-3" [innerHTML]="product.description"></div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <div class="text-sm text-slate-700">{{ product.sku || 'N/A' }}</div>
                  </td>
                  <td class="px-6 py-4 whitespace-nowrap">
                    <a
                      *ngIf="product.product_url"
                      [href]="product.product_url"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="inline-flex items-center px-3 py-1.5 border border-indigo-300 text-xs font-medium rounded-lg text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition"
                    >
                      Ver producto
                      <svg class="ml-1.5 w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <span *ngIf="!product.product_url" class="text-xs text-slate-400">Sin URL</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Estado vacío -->
        <div *ngIf="!loading && products.length === 0" class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-12 text-center">
          <p class="text-slate-600">No se encontraron productos.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .line-clamp-3 {
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
  `]
})
export class ProductsComponent implements OnInit, OnDestroy {
  products: Product[] = [];
  loading = false;
  saving = false;
  error: string | null = null;
  saveSuccess = false;
  saveMessage = '';
  progress = { current: 0, total: 0, percentage: 0 };
  private sessionId: string = '';
  private subscriptions = new Subscription();

  constructor(
    private productService: ProductService,
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.checkAuth();
    this.subscribeToProgress();
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
  }

  checkAuth(): void {
    this.authService.check().subscribe({
      next: (response) => {
        if (!response.authenticated) {
          this.router.navigate(['/login']);
        } else {
          this.startFetching();
        }
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }

  subscribeToProgress(): void {
    const sub = this.productService.progress$.subscribe(progress => {
      this.progress = progress;
    });
    this.subscriptions.add(sub);
  }

  startFetching(): void {
    this.loading = true;
    this.error = null;
    this.sessionId = this.generateSessionId();
    this.products = [];
    
    this.fetchProductsRecursive(0);
  }

  private generateSessionId(): string {
    return 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private fetchProductsRecursive(offset: number): void {
    this.productService.fetchProducts(offset, 150, this.sessionId).subscribe({
      next: (response) => {
        this.products = [...this.products, ...response.products];
        
        if (response.progress) {
          this.progress = {
            current: response.progress.current,
            total: response.progress.total || response.progress.current,
            percentage: response.progress.total > 0 
              ? Math.round((response.progress.current / response.progress.total) * 100)
              : 0
          };
        }

        if (response.has_more) {
          // Continuar obteniendo productos
          setTimeout(() => {
            this.fetchProductsRecursive(offset + response.products.length);
          }, 500);
        } else {
          // Finalizar
          this.loading = false;
          this.progress.percentage = 100;
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = err.error?.error || 'Error al obtener productos';
        console.error('Error:', err);
      }
    });
  }

  saveProducts(): void {
    if (this.products.length === 0) {
      return;
    }

    this.saving = true;
    this.saveSuccess = false;
    this.error = null;

    this.productService.saveProducts(this.products).subscribe({
      next: (response) => {
        this.saving = false;
        this.saveSuccess = true;
        this.saveMessage = response.message || `Se guardaron ${response.saved} productos exitosamente`;
      },
      error: (err) => {
        this.saving = false;
        this.error = err.error?.error || 'Error al guardar productos';
      }
    });
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.router.navigate(['/login']);
      },
      error: () => {
        this.router.navigate(['/login']);
      }
    });
  }
}


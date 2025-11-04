import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-cyan-50 px-4">
      <div class="w-full max-w-md">
        <div class="bg-white rounded-2xl shadow-xl ring-1 ring-slate-900/10 p-8">
          <div class="text-center mb-8">
            <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
              <svg class="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h1 class="text-3xl font-bold text-slate-900 mb-2">PrestaShop Products</h1>
            <p class="text-slate-600">Ingresa tus credenciales de API</p>
          </div>

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()" class="space-y-6">
            <div>
              <label for="prestashop_url" class="block text-sm font-medium text-slate-700 mb-2">
                URL de PrestaShop
              </label>
              <input
                id="prestashop_url"
                type="url"
                formControlName="prestashop_url"
                placeholder="https://tu-tienda.com/shop"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                [class.border-red-300]="loginForm.get('prestashop_url')?.invalid && loginForm.get('prestashop_url')?.touched"
              />
              <p *ngIf="loginForm.get('prestashop_url')?.invalid && loginForm.get('prestashop_url')?.touched" 
                 class="mt-1 text-sm text-red-600">
                URL requerida
              </p>
            </div>

            <div>
              <label for="api_key" class="block text-sm font-medium text-slate-700 mb-2">
                API Key
              </label>
              <input
                id="api_key"
                type="text"
                formControlName="api_key"
                placeholder="Tu API Key de PrestaShop"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                [class.border-red-300]="loginForm.get('api_key')?.invalid && loginForm.get('api_key')?.touched"
              />
              <p *ngIf="loginForm.get('api_key')?.invalid && loginForm.get('api_key')?.touched" 
                 class="mt-1 text-sm text-red-600">
                API Key requerida
              </p>
            </div>

            <div>
              <label for="password" class="block text-sm font-medium text-slate-700 mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                formControlName="password"
                placeholder="Tu contraseña"
                class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition"
                [class.border-red-300]="loginForm.get('password')?.invalid && loginForm.get('password')?.touched"
              />
              <p *ngIf="loginForm.get('password')?.invalid && loginForm.get('password')?.touched" 
                 class="mt-1 text-sm text-red-600">
                Contraseña requerida
              </p>
            </div>

            <div *ngIf="error" class="bg-red-50 border border-red-200 rounded-lg p-4">
              <p class="text-sm text-red-800">{{ error }}</p>
            </div>

            <button
              type="submit"
              [disabled]="loginForm.invalid || loading"
              class="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span *ngIf="!loading">Iniciar Sesión</span>
              <span *ngIf="loading">Cargando...</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: []
})
export class LoginComponent implements OnInit {
  loginForm: FormGroup;
  loading = false;
  error: string | null = null;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router
  ) {
    this.loginForm = this.fb.group({
      prestashop_url: ['', [Validators.required, Validators.pattern(/^https?:\/\/.+/)]],
      api_key: ['', Validators.required],
      password: ['', Validators.required]
    });
  }

  ngOnInit(): void {
    this.authService.check().subscribe({
      next: (response) => {
        if (response.authenticated) {
          this.router.navigate(['/products']);
        }
      }
    });
  }

  onSubmit(): void {
    if (this.loginForm.valid) {
      this.loading = true;
      this.error = null;

      this.authService.login(this.loginForm.value).subscribe({
        next: () => {
          this.loading = false;
          this.router.navigate(['/products']);
        },
        error: (err) => {
          this.loading = false;
          this.error = err.error?.message || 'Error al iniciar sesión. Verifica tus credenciales.';
        }
      });
    }
  }
}


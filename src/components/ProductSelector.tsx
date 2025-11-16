import { useEffect, useMemo, useState } from 'react';
import type { ProductSummary } from '../types';

interface ProductSelectorProps {
  label?: string;
  helperText?: string;
  placeholder?: string;
  selectedProduct?: ProductSummary | null;
  onChange: (product: ProductSummary | null) => void;
  inputName?: string;
  disabled?: boolean;
  minSearchLength?: number;
}

interface GetProductsResponse {
  success: boolean;
  products: Array<{
    id?: number;
    name?: string;
    sku?: string;
    product_url?: string | null;
    price?: string | null;
  }>;
}

export function ProductSelector({
  label,
  helperText,
  placeholder = 'Busca por nombre o SKU',
  selectedProduct = null,
  onChange,
  inputName,
  disabled = false,
  minSearchLength = 2,
}: ProductSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState<ProductSummary[]>([]);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const displayPlaceholder = useMemo(() => {
    if (disabled) return 'Seleccionar producto deshabilitado';
    return placeholder;
  }, [disabled, placeholder]);

  useEffect(() => {
    if (disabled) return;
    if (searchTerm.trim().length < minSearchLength) {
      setResults([]);
      setError(null);
      return;
    }

    const controller = new AbortController();
    const timeoutId = window.setTimeout(async () => {
      try {
        setIsLoading(true);
        setError(null);

        const response = await fetch(
          `/api/get-products?limit=10&search=${encodeURIComponent(searchTerm.trim())}`,
          { signal: controller.signal }
        );

        if (!response.ok) {
          setError(`Error al buscar productos (${response.status})`);
          setResults([]);
          return;
        }

        const data = (await response.json()) as GetProductsResponse;

        if (!data.success) {
          setError('No se pudieron cargar los productos');
          setResults([]);
          return;
        }

        const mapped = (data.products || [])
          .map((product) => {
            if (typeof product.id !== 'number' || !product.name || !product.sku) {
              return null;
            }

            return {
              id: product.id,
              name: product.name,
              sku: product.sku,
              product_url: product.product_url ?? null,
              price: product.price ?? null,
            } satisfies ProductSummary;
          })
          .filter(Boolean) as ProductSummary[];

        setResults(mapped);
        setIsDropdownOpen(true);
      } catch (fetchError) {
        if ((fetchError as Error).name === 'AbortError') {
          return;
        }
        console.error('Error buscando productos:', fetchError);
        setError('Error al conectarse con el servidor');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timeoutId);
    };
  }, [searchTerm, disabled, minSearchLength]);

  const handleSelectProduct = (product: ProductSummary | null) => {
    onChange(product);
    setSearchTerm('');
    setIsDropdownOpen(false);
    setResults([]);
    setError(null);
  };

  const handleInputFocus = () => {
    if (disabled) return;
    setIsDropdownOpen(true);
  };

  const handleInputBlur = () => {
    window.setTimeout(() => {
      setIsDropdownOpen(false);
    }, 120);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-slate-700" htmlFor={inputName}>
          {label}
        </label>
      )}

      <div className="space-y-2">
        {selectedProduct ? (
          <div className="flex items-center justify-between rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800">
            <div className="flex flex-col">
              <span className="font-semibold">{selectedProduct.name}</span>
              <span className="text-xs text-indigo-700/80">SKU: {selectedProduct.sku}</span>
            </div>
            <button
              type="button"
              onClick={() => handleSelectProduct(null)}
              className="text-xs font-semibold text-indigo-700 hover:text-indigo-900"
            >
              Quitar
            </button>
          </div>
        ) : (
          <div className="relative">
            <input
              id={inputName}
              name={inputName}
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              onFocus={handleInputFocus}
              onBlur={handleInputBlur}
              disabled={disabled}
              placeholder={displayPlaceholder}
              className="block w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 disabled:bg-slate-100"
            />

            {isDropdownOpen && !disabled && (
              <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                {isLoading ? (
                  <div className="px-4 py-3 text-sm text-slate-500">Buscando productos...</div>
                ) : results.length === 0 ? (
                  <div className="px-4 py-3 text-sm text-slate-500">
                    {searchTerm.trim().length < minSearchLength
                      ? `Escribe al menos ${minSearchLength} caracteres`
                      : 'No se encontraron productos'}
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {results.map((product) => (
                      <li key={product.id}>
                        <button
                          type="button"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => handleSelectProduct(product)}
                          className="flex w-full flex-col items-start gap-1 px-4 py-2 text-left text-sm hover:bg-indigo-50"
                        >
                          <span className="font-semibold text-slate-800">{product.name}</span>
                          <span className="text-xs text-slate-500">
                            SKU: {product.sku}
                            {product.price ? ` • ${product.price}` : ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {error && <div className="px-4 py-2 text-xs text-red-600">{error}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {helperText && <p className="text-xs text-slate-500">{helperText}</p>}
      {error && !isDropdownOpen && (
        <p className="text-xs font-medium text-red-600">{error}</p>
      )}
    </div>
  );
}


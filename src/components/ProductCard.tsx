import type { Product } from '../types';

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  // Formatear precio
  const formatPrice = (price: string) => {
    if (!price) return 'Precio no disponible';
    // Si ya tiene formato, devolverlo; si no, añadir €
    return price.includes('€') || price.includes('EUR') ? price : `${price} €`;
  };

  // Truncar descripción
  const truncateDescription = (text: string, maxLength: number = 80) => {
    if (!text) return '';
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden hover:shadow-lg transition-shadow">
      {/* Imagen del producto - más pequeña */}
      <div className="relative h-48 bg-slate-100 overflow-hidden">
        {product.image && product.image.trim() !== '' ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="16"%3ESin imagen%3C/text%3E%3C/svg%3E';
            }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-400">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        )}
        
        {/* Badge "NUEVO" si el producto es reciente */}
        {product.date_add && (() => {
          const dateAdded = new Date(product.date_add);
          const daysSinceAdded = (Date.now() - dateAdded.getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceAdded < 30) {
            return (
              <div className="absolute top-2 left-2 bg-black text-white px-2 py-1 text-xs font-bold uppercase rounded">
                Nuevo
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Contenido de la tarjeta */}
      <div className="p-4">
        {/* Título */}
        <h3 className="font-bold text-lg text-slate-900 mb-2 line-clamp-2">
          {product.name}
        </h3>

        {/* Descripción */}
        {product.description && (
          <p className="text-sm text-slate-600 mb-3 line-clamp-2">
            {truncateDescription(product.description)}
          </p>
        )}

        {/* Precio y categoría */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <span className="font-bold text-lg text-slate-900">
              {formatPrice(product.price)}
            </span>
            {product.category && (
              <span className="text-xs text-slate-500 mt-1">
                {product.category}
                {product.subcategory && ` • ${product.subcategory}`}
              </span>
            )}
            {/* Colores disponibles */}
            {product.colors && product.colors.length > 0 && (
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-slate-500">Colores:</span>
                <div className="flex gap-1.5 flex-wrap">
                  {product.colors.map((color, idx) => (
                    <span
                      key={idx}
                      className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-full"
                    >
                      {color}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Botón Ver Producto */}
        {product.product_url && (
          <a
            href={product.product_url}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium text-sm"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
            Ver Producto
          </a>
        )}

        {/* SKU (opcional, pequeño) */}
        {product.sku && (
          <p className="text-xs text-slate-400 mt-2 text-center font-mono">
            SKU: {product.sku}
          </p>
        )}
      </div>
    </div>
  );
}


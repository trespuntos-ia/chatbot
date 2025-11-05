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
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all duration-200 overflow-hidden flex flex-row">
      {/* Imagen del producto - a la izquierda */}
      <div className="relative w-48 min-w-[12rem] bg-slate-50 overflow-hidden flex items-center justify-center flex-shrink-0">
        {product.image && product.image.trim() !== '' ? (
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-full object-contain p-4"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="400" height="400"%3E%3Crect width="400" height="400" fill="%23f1f5f9"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="16"%3ESin imagen%3C/text%3E%3C/svg%3E';
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
              <div className="absolute top-3 left-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white px-3 py-1 text-xs font-bold uppercase rounded-full shadow-md">
                Nuevo
              </div>
            );
          }
          return null;
        })()}
      </div>

      {/* Contenido de la tarjeta - a la derecha */}
      <div className="p-4 flex-1 flex flex-col">
        {/* Título */}
        <h3 className="font-bold text-sm text-slate-900 mb-1.5 line-clamp-2 leading-tight">
          {product.name}
        </h3>

        {/* Descripción */}
        {product.description && (
          <p className="text-xs text-slate-600 mb-2 line-clamp-2 leading-relaxed">
            {truncateDescription(product.description, 120)}
          </p>
        )}

        {/* Precio destacado */}
        <div className="mb-2">
          <span className="font-bold text-lg text-slate-900">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Colores disponibles */}
        {product.colors && product.colors.length > 0 && (
          <div className="mb-3">
            <span className="text-xs text-slate-500 block mb-1 leading-tight">Colores:</span>
            <div className="flex gap-1.5 flex-wrap">
              {product.colors.map((color, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 bg-slate-100 text-slate-700 rounded-md font-medium"
                >
                  {color}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Botón Ver Producto */}
        <div className="mt-auto">
          {product.product_url && (
            <a
              href={product.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full text-center py-2 px-3 bg-black hover:bg-gray-800 text-white text-xs font-semibold rounded-lg transition-all duration-200 hover:shadow-md"
            >
              Ver Producto
            </a>
          )}
        </div>
      </div>
    </div>
  );
}


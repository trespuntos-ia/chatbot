import { useState } from 'react';
import type { Product } from '../types';
import { exportToCSV, exportToJSON } from '../utils/export';

interface ProductTableProps {
  products: Product[];
}

export function ProductTable({ products }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  const handleExportCSV = () => {
    exportToCSV(products);
  };

  const handleExportJSON = () => {
    exportToJSON(products);
  };

  return (
    <div className="space-y-6">
      {/* Header con estadísticas y botones de exportación */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">
            Productos ({products.length.toLocaleString()})
          </h2>
          <p className="text-sm text-slate-600 mt-1">
            {filteredProducts.length !== products.length
              ? `${filteredProducts.length} productos encontrados`
              : 'Todos los productos'}
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 transition font-medium text-sm"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Exportar CSV
          </button>
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 transition font-medium text-sm"
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
                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Exportar JSON
          </button>
        </div>
      </div>

      {/* Barra de búsqueda */}
      <div className="relative">
        <input
          type="text"
          placeholder="Buscar por nombre, categoría o SKU..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
            setCurrentPage(1);
          }}
          className="w-full px-4 py-3 pl-11 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
        />
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
      </div>

      {/* Tabla */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Imagen
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Nombre
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Precio
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Categoría
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  Descripción
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  SKU
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                  URL
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                    No se encontraron productos
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, index) => (
                  <tr
                    key={index}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      {product.image ? (
                        <img
                          src={product.image}
                          alt={product.name}
                          className="w-16 h-16 object-cover rounded-lg"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="64" height="64"%3E%3Crect width="64" height="64" fill="%23e2e8f0"/%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" fill="%2394a3b8" font-size="12"%3ESin imagen%3C/text%3E%3C/svg%3E';
                          }}
                        />
                      ) : (
                        <div className="w-16 h-16 bg-slate-100 rounded-lg flex items-center justify-center text-xs text-slate-400">
                          Sin imagen
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium text-slate-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-3 text-slate-700">
                      {product.price ? `${product.price} €` : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                        {product.category || '-'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-xs">
                      <div className="line-clamp-2 text-sm">
                        {product.description || '-'}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-600 font-mono text-sm">
                      {product.sku || '-'}
                    </td>
                    <td className="px-4 py-3">
                      {product.product_url ? (
                        <a
                          href={product.product_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-700 transition"
                        >
                          Ver
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-3.5 w-3.5"
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
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Paginación */}
        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
            <div className="text-sm text-slate-600">
              Mostrando {startIndex + 1} - {Math.min(endIndex, filteredProducts.length)} de{' '}
              {filteredProducts.length} productos
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Anterior
              </button>
              <span className="px-3 py-1.5 text-sm text-slate-600">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                Siguiente
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


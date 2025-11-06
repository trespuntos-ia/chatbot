import React, { useState } from 'react';
import type { Product } from '../types';
import { exportToCSV, exportToJSON } from '../utils/export';

interface ProductTableProps {
  products: Product[];
}

export function ProductTable({ products }: ProductTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<{ type: 'success' | 'error' | null; message: string }>({ type: null, message: '' });
  const itemsPerPage = 25;

  // Log para depuración: verificar si los productos tienen all_categories
  React.useEffect(() => {
    if (products.length > 0) {
      const withAllCategories = products.filter(p => p.all_categories && Array.isArray(p.all_categories) && p.all_categories.length > 0);
      console.log(`ProductTable: ${products.length} productos totales, ${withAllCategories.length} con all_categories`);
      if (withAllCategories.length > 0) {
        console.log('Ejemplo de producto con all_categories:', withAllCategories[0]);
      } else if (products.length > 0) {
        console.log('Ejemplo de producto sin all_categories:', products[0]);
        console.log('Estructura del producto:', Object.keys(products[0]));
      }
    }
  }, [products]);

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

  const handleSaveToDatabase = async () => {
    if (products.length === 0) {
      setSaveStatus({ type: 'error', message: 'No hay productos para guardar' });
      return;
    }

    setIsSaving(true);
    setSaveStatus({ type: null, message: '' });

    try {
      const response = await fetch('/api/save-products', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ products }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.message || 'Error al guardar productos');
      }

      setSaveStatus({ 
        type: 'success', 
        message: `¡Éxito! Se guardaron ${data.saved} productos en la base de datos.` 
      });
    } catch (error) {
      console.error('Error saving products:', error);
      setSaveStatus({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Error desconocido al guardar productos' 
      });
    } finally {
      setIsSaving(false);
    }
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
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSaveToDatabase}
            disabled={isSaving || products.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 transition font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Guardando...
              </>
            ) : (
              <>
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
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                Guardar en Base de Datos
              </>
            )}
          </button>
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

      {/* Mensaje de estado de guardado */}
      {saveStatus.type && (
        <div className={`rounded-lg p-4 ${
          saveStatus.type === 'success' 
            ? 'bg-green-50 border border-green-200 text-green-800' 
            : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          <div className="flex items-center gap-2">
            {saveStatus.type === 'success' ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            )}
            <span className="font-medium">{saveStatus.message}</span>
          </div>
        </div>
      )}

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
                      Todas las Categorías
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Categoría Nivel 1
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Categoría Nivel 2
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Categoría Nivel 3
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
                  <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
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
                      {(() => {
                        // Mostrar TODAS las categorías separadas por comas (como en tabla_productos_categorias.php)
                        // Si tiene all_categories, extraer todos los nombres únicos de todos los niveles
                        if (product.all_categories && Array.isArray(product.all_categories) && product.all_categories.length > 0) {
                          const allCategoryNames = new Set<string>();
                          
                          // Recopilar todos los nombres de categorías de todos los niveles
                          product.all_categories.forEach(cat => {
                            if (cat.category) allCategoryNames.add(cat.category);
                            if (cat.subcategory) allCategoryNames.add(cat.subcategory);
                            if (cat.subsubcategory) allCategoryNames.add(cat.subsubcategory);
                          });
                          
                          const categoryList = Array.from(allCategoryNames);
                          
                          if (categoryList.length > 0) {
                            return (
                              <div className="text-sm text-slate-700">
                                {categoryList.join(', ')}
                              </div>
                            );
                          }
                        }
                        
                        // Fallback: usar el campo category que ya contiene todas las categorías separadas por comas
                        return product.category ? (
                          <div className="text-sm text-slate-700">
                            {product.category}
                          </div>
                        ) : (
                          <span className="text-slate-400">-</span>
                        );
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        // Mostrar categorías de nivel 1
                        if (product.all_categories && Array.isArray(product.all_categories) && product.all_categories.length > 0) {
                          const level1Categories = product.all_categories
                            .map(cat => cat.category)
                            .filter((cat, index, self) => self.indexOf(cat) === index); // únicos
                          
                          return level1Categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {level1Categories.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          );
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        // Mostrar categorías de nivel 2
                        if (product.all_categories && Array.isArray(product.all_categories) && product.all_categories.length > 0) {
                          const level2Categories = product.all_categories
                            .map(cat => cat.subcategory)
                            .filter((cat): cat is string => !!cat && cat !== null)
                            .filter((cat, index, self) => self.indexOf(cat) === index); // únicos
                          
                          return level2Categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {level2Categories.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          );
                        }
                        // Si tiene subcategory en el formato antiguo (category > subcategory)
                        if (product.subcategory) {
                          return (
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                              {product.subcategory}
                            </span>
                          );
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
                    </td>
                    <td className="px-4 py-3">
                      {(() => {
                        if (product.all_categories && Array.isArray(product.all_categories) && product.all_categories.length > 0) {
                          const level3Categories = product.all_categories
                            .map(cat => cat.subsubcategory)
                            .filter((cat): cat is string => !!cat && cat !== null)
                            .filter((cat, index, self) => self.indexOf(cat) === index); // únicos
                          
                          return level3Categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {level3Categories.map((cat, idx) => (
                                <span
                                  key={idx}
                                  className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <span className="text-slate-400">-</span>
                          );
                        }
                        return <span className="text-slate-400">-</span>;
                      })()}
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


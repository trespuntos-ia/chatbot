import { useState, useEffect } from 'react';

interface CategoryInfo {
  category: string;
  subcategory: string | null;
  subsubcategory?: string | null;
  hierarchy: string[];
  category_id: number;
  is_primary: boolean;
}

interface ProductFromDB {
  id: number;
  name: string;
  price: string;
  category: string;
  description: string;
  sku: string;
  image_url: string;
  product_url: string;
  date_add: string | null;
  created_at: string;
  updated_at: string;
  all_categories?: CategoryInfo[] | null;
}

interface ProductStats {
  total: number;
  categories: number;
  uniqueSkus: number;
  firstProduct: string;
  lastUpdate: string;
}

export function ProductsReport() {
  const [products, setProducts] = useState<ProductFromDB[]>([]);
  const [stats, setStats] = useState<ProductStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [indexing, setIndexing] = useState(false);
  const [indexingProgress, setIndexingProgress] = useState<string>('');
  const [indexedStats, setIndexedStats] = useState<{ total: number; uniqueProducts: number } | null>(null);
  const itemsPerPage = 20;

  useEffect(() => {
    fetchProducts();
    fetchIndexedStats();
    
    // Auto-refresh de estadísticas cada 30 segundos para ver progreso del cron
    const statsInterval = setInterval(() => {
      fetchIndexedStats();
    }, 30000); // Actualizar cada 30 segundos
    
    return () => clearInterval(statsInterval);
  }, [currentPage, searchTerm, selectedCategory]);

  const fetchIndexedStats = async () => {
    try {
      const response = await fetch('/api/get-indexed-stats');
      if (response.ok) {
        const data = await response.json();
        setIndexedStats(data);
      }
    } catch (err) {
      console.error('Error fetching indexed stats:', err);
    }
  };

  // Log para depuración: verificar si los productos tienen all_categories
  useEffect(() => {
    if (products.length > 0) {
      const withAllCategories = products.filter(p => p.all_categories && Array.isArray(p.all_categories) && p.all_categories.length > 0);
      console.log(`ProductsReport: ${products.length} productos en página, ${withAllCategories.length} con all_categories`);
      if (withAllCategories.length > 0) {
        console.log('Ejemplo de producto con all_categories:', withAllCategories[0]);
      } else if (products.length > 0) {
        console.log('Ejemplo de producto sin all_categories:', products[0]);
        console.log('Estructura del producto:', Object.keys(products[0]));
      }
    }
  }, [products]);

  const fetchProducts = async () => {
    setLoading(true);
    setError('');

    try {
      const params = new URLSearchParams({
        limit: String(itemsPerPage),
        offset: String((currentPage - 1) * itemsPerPage),
      });

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (selectedCategory) {
        params.append('category', selectedCategory);
      }

      const response = await fetch(`/api/get-products?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        // Mostrar mensaje de error más detallado
        let errorMessage = data.error || 'Error al obtener productos';
        if (data.details) {
          errorMessage += `: ${data.details}`;
        }
        if (data.hint) {
          errorMessage += ` (${data.hint})`;
        }
        throw new Error(errorMessage);
      }

      // Los productos ya vienen con image_url desde Supabase
      setProducts(data.products || []);
      setStats({
        total: data.total || 0,
        categories: 0, // Se calculará después
        uniqueSkus: data.total || 0,
        firstProduct: '',
        lastUpdate: '',
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    if (products.length > 0 && stats) {
      const categories = new Set(products.map(p => p.category).filter(Boolean));
      setStats({
        ...stats,
        categories: categories.size,
      });
    }
  }, [products]);

  const totalPages = stats ? Math.ceil(stats.total / itemsPerPage) : 1;
  
  // Obtener todas las categorías únicas de TODOS los productos (no solo de la página actual)
  // Necesitamos hacer una llamada separada para obtener todas las categorías
  const [allCategoriesList, setAllCategoriesList] = useState<string[]>([]);
  
  useEffect(() => {
    // Obtener todas las categorías únicas de la base de datos
    const fetchAllCategories = async () => {
      try {
        // Hacer una llamada para obtener todas las categorías únicas
        // Usamos un límite alto para obtener todas las categorías
        const response = await fetch('/api/get-products?limit=10000&offset=0');
        const data = await response.json();
        
        if (data.products && Array.isArray(data.products)) {
          const categoriesSet = new Set<string>();
          
          // Extraer categorías de all_categories (nuevo formato)
          data.products.forEach((p: ProductFromDB) => {
            if (p.all_categories && Array.isArray(p.all_categories)) {
              p.all_categories.forEach((cat: CategoryInfo) => {
                if (cat.category) categoriesSet.add(cat.category);
                if (cat.subcategory) categoriesSet.add(cat.subcategory);
                if (cat.subsubcategory) categoriesSet.add(cat.subsubcategory);
              });
            }
            // También incluir categorías del formato antiguo
            if (p.category) {
              p.category.split(',').forEach(c => {
                const trimmed = c.trim();
                if (trimmed) categoriesSet.add(trimmed);
              });
            }
          });
          
          setAllCategoriesList(Array.from(categoriesSet).sort());
        }
      } catch (err) {
        console.error('Error obteniendo todas las categorías:', err);
      }
    };
    
    fetchAllCategories();
  }, [stats?.total]); // Re-ejecutar cuando cambie el total de productos
  
  // Para el filtro, usar todas las categorías obtenidas
  const categories = allCategoriesList.length > 0 ? allCategoriesList : 
    // Fallback: usar categorías de la página actual si no se han cargado todas
    Array.from(new Set(products
      .map(p => p.category)
      .filter(Boolean)
      .flatMap(cat => cat.split(',').map(c => c.trim()))
      .filter(Boolean)));

  const handleIndexProducts = async (limit?: number) => {
    setIndexing(true);
    setIndexingProgress('Iniciando indexación automática...');
    setError('');

    try {
      // Usar el endpoint automático que es más eficiente y cuenta correctamente
      const endpoint = limit 
        ? `/api/index-products-rag-auto?manual=true` 
        : `/api/index-products-rag-auto?manual=true`;
      
      const response = await fetch(endpoint, {
        method: 'GET', // El endpoint automático acepta GET
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || data.details || 'Error al indexar productos');
      }

      setIndexingProgress(`✅ ${data.message || `Indexados ${data.indexed || 0} productos`}`);
      
      // Actualizar estadísticas de indexación inmediatamente
      await fetchIndexedStats();
      
      // También actualizar después de 2 segundos para asegurar que se refleje el cambio
      setTimeout(() => {
        fetchIndexedStats();
      }, 2000);
      
      // Esperar un momento antes de ocultar el mensaje
      setTimeout(() => {
        setIndexingProgress('');
        setIndexing(false);
      }, 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al indexar productos');
      setIndexing(false);
      setIndexingProgress('');
    }
  };

  return (
    <div className="space-y-6">
      {/* Indexación RAG - Simplificado */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-slate-900 mb-2">
              Búsqueda Semántica (RAG)
            </h3>
            {indexedStats && (
              <div className="flex flex-wrap gap-4 text-sm mb-2">
                <span className="text-slate-700">
                  <strong>Chunks:</strong> {indexedStats.total.toLocaleString()}
                </span>
                <span className="text-slate-700">
                  <strong>Productos:</strong> {indexedStats.uniqueProducts.toLocaleString()}
                </span>
              </div>
            )}
            {indexingProgress && (
              <p className="text-sm text-indigo-700 font-medium">{indexingProgress}</p>
            )}
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => handleIndexProducts()}
              disabled={indexing}
              className="px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed text-base"
            >
              {indexing ? (
                <>
                  <svg className="animate-spin h-5 w-5 inline-block mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Indexando...
                </>
              ) : (
                <>
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 inline-block mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Indexar Productos
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Estadísticas */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Productos</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.total.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-indigo-100 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-indigo-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">Categorías</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.categories}</p>
              </div>
              <div className="h-12 w-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-green-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">SKUs Únicos</p>
                <p className="text-3xl font-bold text-slate-900 mt-2">{stats.uniqueSkus.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-purple-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-600">En Base de Datos</p>
                <p className="text-lg font-semibold text-green-600 mt-2">✓ Activo</p>
              </div>
              <div className="h-12 w-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-6 w-6 text-blue-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01"
                  />
                </svg>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filtros y búsqueda */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Buscar por nombre o SKU..."
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
          <select
            value={selectedCategory}
            onChange={(e) => {
              setSelectedCategory(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
          >
            <option value="">Todas las categorías</option>
            {categories.map((cat) => (
              <option key={cat} value={cat}>
                {cat}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabla de productos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600 mx-auto mb-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="text-slate-600">Cargando productos...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="text-red-600 mb-2">{error}</div>
            <button
              onClick={fetchProducts}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Reintentar
            </button>
          </div>
        ) : products.length === 0 ? (
          <div className="p-12 text-center text-slate-500">
            No se encontraron productos
          </div>
        ) : (
          <>
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
                      Categoría Nivel 1
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Categoría Nivel 2
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Categoría Nivel 3
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      SKU
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      URL
                    </th>
                    <th className="px-4 py-3 text-xs font-semibold text-slate-600 uppercase tracking-wider">
                      Fecha Creación
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {products.map((product, index) => (
                    <tr key={product.id || index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3">
                        {product.image_url ? (
                          <img
                            src={product.image_url}
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
                        {product.price || '-'}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
                          // Si tiene all_categories, mostrar todas las categorías nivel 1
                          if (product.all_categories && Array.isArray(product.all_categories) && product.all_categories.length > 0) {
                            const level1Categories = product.all_categories
                              .map(cat => cat.category)
                              .filter((cat, index, self) => self.indexOf(cat) === index); // únicos
                            
                            return (
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
                            );
                          }
                          // Fallback a category si no hay all_categories
                          return product.category ? (
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-slate-100 text-slate-700">
                              {product.category}
                            </span>
                          ) : (
                            <span className="text-slate-400">-</span>
                          );
                        })()}
                      </td>
                      <td className="px-4 py-3">
                        {(() => {
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
                          if (product.category && product.category.includes('>')) {
                            const parts = product.category.split('>');
                            if (parts.length >= 2) {
                              return (
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  {parts[1].trim()}
                                </span>
                              );
                            }
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
                          // Si tiene subcategory en el formato antiguo con 3 niveles (cat > sub > subsub)
                          if (product.category && product.category.includes('>')) {
                            const parts = product.category.split('>');
                            if (parts.length >= 3) {
                              return (
                                <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
                                  {parts[2].trim()}
                                </span>
                              );
                            }
                          }
                          return <span className="text-slate-400">-</span>;
                        })()}
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
                      <td className="px-4 py-3 text-slate-600 text-sm">
                        {product.date_add ? (
                          new Date(product.date_add).toLocaleDateString('es-ES', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric'
                          })
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between">
                <div className="text-sm text-slate-600">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, stats?.total || 0)} de {stats?.total || 0} productos
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
          </>
        )}
      </div>
    </div>
  );
}


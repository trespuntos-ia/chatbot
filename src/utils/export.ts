import type { Product } from '../types';

/**
 * Exporta los productos a CSV.
 */
export function exportToCSV(products: Product[]): void {
  const headers = ['Nombre', 'Precio', 'Categoría', 'Descripción', 'SKU', 'URL Producto'];
  const rows = products.map(product => [
    product.name,
    product.price,
    product.category,
    product.description.replace(/"/g, '""'),
    product.sku,
    product.product_url,
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(',')),
  ].join('\n');

  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `productos-prestashop-${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exporta los productos a JSON.
 */
export function exportToJSON(products: Product[]): void {
  const jsonContent = JSON.stringify(products, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `productos-prestashop-${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}


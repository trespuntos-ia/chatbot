#!/usr/bin/env node

/**
 * Script para indexar todos los productos con URLs
 * 
 * Uso:
 *   node scripts/index-all-products.js [limit] [offset]
 * 
 * Ejemplo:
 *   node scripts/index-all-products.js 50 0
 */

const limit = process.argv[2] ? parseInt(process.argv[2]) : 100;
const offset = process.argv[3] ? parseInt(process.argv[3]) : 0;

// Configurar la URL base de tu API
const API_BASE_URL = process.env.API_BASE_URL || 'https://tu-dominio.vercel.app';

async function indexAllProducts() {
  try {
    console.log('🔄 Indexando productos...');
    console.log(`   Límite: ${limit}`);
    console.log(`   Offset: ${offset}`);
    console.log('');

    const response = await fetch(`${API_BASE_URL}/api/index-all-products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        limit: limit,
        offset: offset,
        force: false
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ Error al indexar productos:');
      console.error(data);
      process.exit(1);
    }

    console.log('✅ Procesamiento completado');
    console.log(`   Total procesados: ${data.processed}`);
    console.log(`   Indexados: ${data.indexed}`);
    console.log(`   Sin cambios: ${data.skipped}`);
    console.log(`   Errores: ${data.errors}`);
    console.log('');

    if (data.errors > 0 && data.details) {
      console.log('⚠️  Productos con errores:');
      data.details
        .filter((d: any) => d.status === 'error')
        .slice(0, 5)
        .forEach((detail: any) => {
          console.log(`   - ${detail.product_name}: ${detail.error}`);
        });
      if (data.details.filter((d: any) => d.status === 'error').length > 5) {
        console.log(`   ... y ${data.details.filter((d: any) => d.status === 'error').length - 5} más`);
      }
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('fetch')) {
      console.error('\n💡 Asegúrate de que:');
      console.error('   1. La API esté desplegada');
      console.error('   2. API_BASE_URL esté configurado correctamente');
      console.error('   3. Estés conectado a internet');
    }
    process.exit(1);
  }
}

indexAllProducts();








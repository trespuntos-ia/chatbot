#!/usr/bin/env node

/**
 * Script para indexar un producto específico
 * 
 * Uso:
 *   node scripts/index-product.js <URL>
 * 
 * Ejemplo:
 *   node scripts/index-product.js "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"
 * 
 * O con product_id:
 *   node scripts/index-product.js "https://100x100chef.com/shop/..." 123
 */

const url = process.argv[2];
const productId = process.argv[3] ? parseInt(process.argv[3]) : null;

if (!url) {
  console.error('❌ Error: Debes proporcionar una URL');
  console.log('\nUso:');
  console.log('  node scripts/index-product.js <URL> [product_id]');
  console.log('\nEjemplo:');
  console.log('  node scripts/index-product.js "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"');
  process.exit(1);
}

// Configurar la URL base de tu API
// Si estás en desarrollo local, usar: http://localhost:3000
// Si está en producción, usar tu dominio de Vercel
const API_BASE_URL = process.env.API_BASE_URL || 'https://tu-dominio.vercel.app';

async function indexProduct() {
  try {
    console.log('🔄 Indexando producto...');
    console.log(`   URL: ${url}`);
    if (productId) {
      console.log(`   Product ID: ${productId}`);
    }
    console.log('');

    const response = await fetch(`${API_BASE_URL}/api/index-web-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: url,
        content_type: 'product_page',
        product_id: productId || undefined,
        force: false
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ Error al indexar:');
      console.error(data);
      process.exit(1);
    }

    if (data.unchanged) {
      console.log('✅ El contenido ya estaba indexado y no ha cambiado');
      console.log(`   Última actualización: ${data.last_scraped_at}`);
    } else {
      console.log('✅ Producto indexado correctamente');
      console.log(`   ID: ${data.content.id}`);
      console.log(`   Título: ${data.content.title}`);
      console.log(`   Hash: ${data.content.content_hash.substring(0, 16)}...`);
      if (data.changed) {
        console.log('   ⚠️  El contenido ha cambiado desde la última indexación');
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

indexProduct();







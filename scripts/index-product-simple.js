#!/usr/bin/env node

/**
 * Script SIMPLE para indexar un producto
 * 
 * PASOS:
 * 1. Abre este archivo y cambia la línea 45 con tu dominio de Vercel
 * 2. Ejecuta: node scripts/index-product-simple.js
 * 3. Cuando te pregunte, pega la URL del producto
 */

const readline = require('readline');

// ⚠️ IMPORTANTE: Cambia esto por tu dominio de Vercel
// Ejemplo: https://chatbot-v2-murex.vercel.app
// O déjalo vacío para usar localhost:3000 (desarrollo local)
const API_BASE_URL = process.env.API_BASE_URL || 'https://chatbot-v2-murex.vercel.app';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   🚀 Indexador de Productos Web                      ║');
  console.log('╚═══════════════════════════════════════════════════════╝');
  console.log('');
  
  // Verificar configuración
  console.log(`📍 API Base URL: ${API_BASE_URL}`);
  console.log('');
  
  // Pedir URL
  const url = await askQuestion('📝 Pega la URL del producto (o presiona Enter para usar ejemplo): ');
  
  const productUrl = url.trim() || 'https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html';
  
  // Opcional: Product ID
  const productIdInput = await askQuestion('🆔 Product ID (opcional, presiona Enter para omitir): ');
  const productId = productIdInput.trim() ? parseInt(productIdInput.trim()) : null;
  
  console.log('');
  console.log('🔄 Indexando producto...');
  console.log(`   URL: ${productUrl}`);
  if (productId) {
    console.log(`   Product ID: ${productId}`);
  }
  console.log('');
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/index-web-content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: productUrl,
        content_type: 'product_page',
        product_id: productId || undefined,
        force: false
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error('❌ Error al indexar:');
      console.error(JSON.stringify(data, null, 2));
      console.log('');
      console.log('💡 Posibles soluciones:');
      console.log('   1. Verifica que la API esté desplegada en Vercel');
      console.log('   2. Verifica que el dominio sea correcto (línea 45 del script)');
      console.log('   3. Verifica que las tablas estén creadas en Supabase');
      rl.close();
      process.exit(1);
    }

    if (data.unchanged) {
      console.log('✅ El contenido ya estaba indexado y no ha cambiado');
      console.log(`   Última actualización: ${data.last_scraped_at}`);
    } else {
      console.log('✅ ¡Producto indexado correctamente!');
      console.log(`   ID: ${data.content.id}`);
      console.log(`   Título: ${data.content.title}`);
      console.log(`   Hash: ${data.content.content_hash.substring(0, 16)}...`);
      if (data.changed) {
        console.log('   ⚠️  El contenido ha cambiado desde la última indexación');
      }
    }
    
    console.log('');
    console.log('🎉 ¡Listo! Ahora prueba hacer una pregunta en el chat sobre este producto.');

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('');
    console.log('💡 Posibles soluciones:');
    if (error.message.includes('fetch')) {
      console.log('   1. Verifica tu conexión a internet');
      console.log('   2. Verifica que la API esté desplegada');
      console.log('   3. Verifica que el dominio sea correcto (línea 45 del script)');
    } else {
      console.log('   1. Verifica los logs de error arriba');
      console.log('   2. Asegúrate de que las tablas estén creadas en Supabase');
    }
  }
  
  rl.close();
}

main();











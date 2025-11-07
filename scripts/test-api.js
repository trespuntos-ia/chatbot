#!/usr/bin/env node

/**
 * Script para probar si la API está disponible
 * 
 * Uso: node scripts/test-api.js [dominio]
 */

const domain = process.argv[2] || 'https://chatbot-v2-murex.vercel.app';

console.log('🔍 Probando conexión con la API...\n');
console.log(`Dominio: ${domain}\n`);

async function testEndpoint(endpoint, description) {
  try {
    console.log(`📡 Probando: ${description}...`);
    const url = `${domain}${endpoint}`;
    console.log(`   URL: ${url}`);
    
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
      signal: AbortSignal.timeout(10000) // 10 segundos timeout
    });

    if (response.ok) {
      console.log(`   ✅ OK (${response.status})\n`);
      return true;
    } else {
      console.log(`   ⚠️  Respuesta: ${response.status} ${response.statusText}\n`);
      return false;
    }
  } catch (error) {
    if (error.name === 'AbortError') {
      console.log(`   ❌ Timeout (no responde después de 10 segundos)\n`);
    } else if (error.message.includes('fetch')) {
      console.log(`   ❌ Error de red: ${error.message}\n`);
    } else {
      console.log(`   ❌ Error: ${error.message}\n`);
    }
    return false;
  }
}

async function testAPI() {
  console.log('═══════════════════════════════════════════════════════\n');
  
  // Probar endpoints comunes
  const endpoints = [
    { path: '/api/chat', desc: 'API Chat (POST requerido, probando si existe)' },
    { path: '/api/prompts', desc: 'API Prompts' },
    { path: '/api/get-products', desc: 'API Get Products' },
    { path: '/api/index-web-content', desc: 'API Index Web Content (POST requerido)' },
  ];

  let successCount = 0;
  
  for (const endpoint of endpoints) {
    const success = await testEndpoint(endpoint.path, endpoint.desc);
    if (success) successCount++;
    
    // Pequeña pausa entre requests
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('═══════════════════════════════════════════════════════\n');
  console.log(`Resultado: ${successCount}/${endpoints.length} endpoints respondieron\n`);

  if (successCount === 0) {
    console.log('❌ No se pudo conectar con ningún endpoint\n');
    console.log('💡 Posibles problemas:\n');
    console.log('   1. El dominio no es correcto');
    console.log('   2. Las APIs no están desplegadas en Vercel');
    console.log('   3. Las APIs están en otra ubicación');
    console.log('   4. Hay un problema de CORS o configuración\n');
    console.log('🔧 Soluciones:\n');
    console.log('   1. Verifica tu dominio en: https://vercel.com/dashboard');
    console.log('   2. Verifica que las APIs estén en la carpeta /api/');
    console.log('   3. Si el Root Directory está en prestashop-products-app/,');
    console.log('      las APIs deberían estar en prestashop-products-app/api/\n');
  } else if (successCount < endpoints.length) {
    console.log('⚠️  Algunos endpoints no respondieron\n');
    console.log('💡 Esto puede ser normal si algunos endpoints requieren POST\n');
  } else {
    console.log('✅ ¡Todo parece estar funcionando!\n');
  }
}

testAPI();







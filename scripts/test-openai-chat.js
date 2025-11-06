#!/usr/bin/env node

/**
 * Script para probar si OpenAI responde correctamente
 * 
 * Uso: node scripts/test-openai-chat.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'https://chatbot-v2-murex.vercel.app';

async function testChat() {
  console.log('🧪 Probando API de Chat...\n');
  console.log(`API: ${API_BASE_URL}\n`);

  try {
    const response = await fetch(`${API_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Hola, ¿qué productos tienes?',
        conversationHistory: [],
        config: {}
      })
    });

    const data = await response.json();

    console.log('📡 Respuesta HTTP:', response.status);
    console.log('');

    if (response.ok && data.success) {
      console.log('✅ OpenAI responde correctamente');
      console.log(`   Mensaje: ${data.message?.substring(0, 100)}...`);
      console.log(`   Función llamada: ${data.function_called || 'ninguna'}`);
      console.log(`   Fuentes: ${data.conversation_history?.[data.conversation_history.length - 1]?.sources?.join(', ') || 'N/A'}`);
    } else {
      console.log('❌ Error en la respuesta:');
      console.log(JSON.stringify(data, null, 2));
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('fetch')) {
      console.error('\n💡 Verifica que:');
      console.error('   1. La API esté desplegada');
      console.error('   2. El dominio sea correcto');
      console.error('   3. Estés conectado a internet');
    }
  }
}

testChat();



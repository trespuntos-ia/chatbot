/**
 * Chat Widget Standalone - Embeddable Script
 * 
 * Uso:
 * <script src="https://tu-dominio.vercel.app/chat-widget.js"></script>
 * <script>
 *   ChatWidget.init({
 *     apiUrl: 'https://tu-dominio.vercel.app/api',
 *     position: 'bottom-right',
 *     buttonColor: '#2563eb',
 *     theme: 'light'
 *   });
 * </script>
 */

(function() {
  'use strict';

  // Configuración por defecto
  const DEFAULT_CONFIG = {
    apiUrl: window.location.origin + '/api',
    position: 'bottom-right', // 'bottom-right' | 'bottom-left'
    buttonColor: '#2563eb',
    theme: 'light', // 'light' | 'dark'
    zIndex: 9999
  };

  // Estado global del widget
  let widgetConfig = {};
  let isOpen = false;
  let isMaximized = false;
  let messages = [];
  let isLoading = false;
  let chatConfig = {
    model: 'gpt-3.5-turbo',
    temperature: 0.7,
    max_tokens: 800
  };

  // Clave para localStorage
  const STORAGE_KEY = 'chatbot_conversation';

  // Escapar HTML para seguridad
  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // Cargar mensajes desde localStorage
  function loadMessages() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          messages = parsed.filter(msg => msg.role !== 'system');
        }
      }
    } catch (e) {
      console.error('Error loading messages:', e);
      messages = [];
    }
  }

  // Guardar mensajes en localStorage
  function saveMessages() {
    try {
      if (messages.length > 0) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (e) {
      console.error('Error saving messages:', e);
    }
  }

  // Limpiar mensajes
  function clearMessages() {
    messages = [];
    saveMessages();
    renderMessages();
  }

  // Enviar mensaje al API
  async function sendMessage(messageText) {
    if (isLoading || !messageText.trim()) return;

    isLoading = true;
    const userMessage = {
      role: 'user',
      content: messageText.trim()
    };

    messages.push(userMessage);
    renderMessages();
    updateLoadingState('Consultando...');

    try {
      const response = await fetch(`${widgetConfig.apiUrl}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: messageText.trim(),
          conversationHistory: messages.filter(m => m.role !== 'system'),
          config: chatConfig
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.statusText}`);
      }

      const data = await response.json();

      if (data.success && data.conversation_history) {
        // Asegurar que los productos se añadan correctamente al último mensaje
        const lastMessage = data.conversation_history[data.conversation_history.length - 1];
        if (lastMessage && data.function_result) {
          // Si hay productos en function_result, añadirlos al mensaje
          if (data.function_result.products && Array.isArray(data.function_result.products)) {
            lastMessage.products = data.function_result.products;
          } else if (data.function_result.product && data.function_result.found) {
            // Producto único por SKU
            lastMessage.products = [data.function_result.product];
          }
        }
        
        messages = data.conversation_history;
        saveMessages();
        renderMessages();
      } else {
        throw new Error(data.error || 'Error al obtener respuesta');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage = {
        role: 'assistant',
        content: `Lo siento, hubo un error: ${error.message}. Por favor, intenta de nuevo.`
      };
      messages.push(errorMessage);
      saveMessages();
      renderMessages();
    } finally {
      isLoading = false;
      updateLoadingState('');
    }
  }

  // Detectar si hay contenido descriptivo de productos (listas numeradas con precios, descripciones)
  function hasProductDescriptiveContent(text) {
    const numberedListPattern = /\d+\.\s*\*\*[^*]+\*\*/;
    const pricePattern = /(?:Precio|Price)[:\-]\s*[\d.,]+\s*€?/i;
    const descriptionPattern = /(?:Descripción|Description)[:\-]/i;
    const detailsPattern = /(?:Ver\s+más\s+detalles|View\s+details)/i;
    
    return numberedListPattern.test(text) || 
           (pricePattern.test(text) && descriptionPattern.test(text)) ||
           detailsPattern.test(text);
  }

  // Extraer solo el texto introductorio (antes de cualquier lista de productos)
  function extractIntroText(text) {
    const lines = text.split('\n');
    const introLines = [];
    
    for (const line of lines) {
      // Si encontramos una lista numerada, parar
      if (/\d+\.\s*\*\*/.test(line)) {
        break;
      }
      // Si encontramos un precio o descripción, probablemente es parte de una lista
      if (/(?:Precio|Price)[:\-]/.test(line) || /(?:Descripción|Description)[:\-]/.test(line)) {
        break;
      }
      // Si encontramos "Ver más detalles", parar
      if (/(?:Ver\s+más\s+detalles|View\s+details)/i.test(line)) {
        break;
      }
      introLines.push(line);
    }
    
    return introLines.join('\n').trim();
  }

  // Parsear markdown básico a HTML con mejor manejo
  function parseMarkdown(text, hasProducts = false) {
    if (!text) return '';
    
    let html = text;
    
    // Si hay productos, extraer solo el intro
    if (hasProducts && hasProductDescriptiveContent(html)) {
      html = extractIntroText(html);
    }
    
    // Convertir negrita markdown primero
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600; color: #0f172a;">$1</strong>');
    
    // Convertir enlaces markdown
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
      // Escapar HTML para seguridad
      const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const escapedUrl = url.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      return `<a href="${escapedUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">${escapedText}</a>`;
    });
    
    // Convertir saltos de línea dobles en párrafos
    html = html.split(/\n\n+/).map(para => {
      if (para.trim()) {
        return `<p style="margin-bottom: 8px;">${para.trim().replace(/\n/g, '<br />')}</p>`;
      }
      return '';
    }).join('');
    
    // Si no hay párrafos, convertir saltos simples
    if (!html.includes('<p')) {
      html = html.replace(/\n/g, '<br />');
    }
    
    return html;
  }

  // Renderizar tarjeta de producto
  function renderProductCard(product) {
    const formatPrice = (price) => {
      if (!price) return 'Precio no disponible';
      return price.includes('€') || price.includes('EUR') ? price : `${price} €`;
    };

    const truncateDescription = (text, maxLength = 120) => {
      if (!text) return '';
      if (text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    };

    const imageUrl = product.image || product.image_url || '';
    const hasImage = imageUrl && imageUrl.trim() !== '';

    return `
      <div style="width: 100%; background: white; border-radius: 12px; border: 1px solid #e2e8f0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; display: flex; flex-direction: row; margin-bottom: 12px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
        <div style="width: 192px; min-width: 192px; background: #f8fafc; overflow: hidden; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${hasImage ? `
            <img src="${imageUrl}" alt="${product.name}" style="width: 100%; height: 100%; object-fit: contain; padding: 16px;" 
                 onerror="this.src='data:image/svg+xml,%3Csvg xmlns=\\'http://www.w3.org/2000/svg\\' width=\\'400\\' height=\\'400\\'%3E%3Crect width=\\'400\\' height=\\'400\\' fill=\\'%23f1f5f9\\'/%3E%3Ctext x=\\'50%25\\' y=\\'50%25\\' dominant-baseline=\\'middle\\' text-anchor=\\'middle\\' fill=\\'%2394a3b8\\' font-size=\\'16\\'%3ESin imagen%3C/text%3E%3C/svg%3E';" />
          ` : `
            <div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #94a3b8;">
              <svg xmlns="http://www.w3.org/2000/svg" style="width: 64px; height: 64px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          `}
        </div>
        <div style="padding: 16px; flex: 1; display: flex; flex-direction: column;">
          <h3 style="font-weight: bold; font-size: 14px; color: #0f172a; margin-bottom: 6px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
            ${product.name}
          </h3>
          ${product.description ? `
            <p style="font-size: 12px; color: #475569; margin-bottom: 8px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
              ${truncateDescription(product.description, 120)}
            </p>
          ` : ''}
          <div style="margin-bottom: 8px;">
            <span style="font-weight: bold; font-size: 18px; color: #0f172a;">
              ${formatPrice(product.price)}
            </span>
          </div>
          ${product.colors && product.colors.length > 0 ? `
            <div style="margin-bottom: 12px;">
              <span style="font-size: 12px; color: #64748b; display: block; margin-bottom: 4px;">Colores:</span>
              <div style="display: flex; gap: 6px; flex-wrap: wrap;">
                ${product.colors.map(color => `
                  <span style="font-size: 12px; padding: 2px 8px; background: #f1f5f9; color: #334155; border-radius: 6px; font-weight: 500;">
                    ${color}
                  </span>
                `).join('')}
              </div>
            </div>
          ` : ''}
          ${product.product_url ? `
            <div style="margin-top: auto;">
              <a href="${product.product_url}" target="_blank" rel="noopener noreferrer" 
                 style="display: block; width: 100%; text-align: center; padding: 8px 12px; background: #000; color: white; font-size: 12px; font-weight: 600; border-radius: 8px; text-decoration: none; transition: background 0.2s;">
                Ver Producto
              </a>
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }

  // Renderizar mensajes
  function renderMessages() {
    const messagesContainer = document.getElementById('chat-widget-messages');
    if (!messagesContainer) return;

    // Limpiar contenedor
    messagesContainer.innerHTML = '';

    // Mensajes de bienvenida si no hay conversación
    if (messages.length === 0) {
      messagesContainer.innerHTML = `
        <div style="margin-bottom: 12px;">
          <div style="max-width: 85%; border-radius: 16px; padding: 12px 16px; background: #f1f5f9; color: #334155;">
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              👋 ¡Bienvenido a 100%Chef!
            </div>
          </div>
        </div>
        <div style="margin-bottom: 12px;">
          <div style="max-width: 85%; border-radius: 16px; padding: 12px 16px; background: #f1f5f9; color: #334155;">
            <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
              Si mezclas curiosidad con técnica, estás en el lugar correcto. Cuéntame tu receta… yo pongo la tecnología. ¿En qué puedo ayudarte hoy?
            </div>
          </div>
        </div>
      `;
      return;
    }

    // Renderizar mensajes
    messages.forEach((message, index) => {
      const isUser = message.role === 'user';
      const messageDiv = document.createElement('div');
      messageDiv.style.marginBottom = '12px';

      if (message.role === 'assistant' && message.products && message.products.length > 0) {
        // Mensaje con productos - separar texto introductorio de tarjetas
        const introText = parseMarkdown(message.content, true);
        
        let html = '';
        
        // Solo mostrar texto introductorio si hay contenido significativo (más de 10 caracteres)
        if (introText && introText.trim().length >= 10) {
          html += `<div style="display: flex; justify-content: flex-start; margin-bottom: 16px;">
            <div style="max-width: 90%; border-radius: 16px; padding: 12px 16px; background: #f1f5f9; color: #334155;">
              <div style="font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${introText}</div>
            </div>
          </div>`;
        }
        
        // Añadir tarjetas de productos en un contenedor separado con ancho completo
        html += '<div style="width: 100%; margin-top: 4px; padding: 0 4px;">';
        message.products.forEach(product => {
          html += renderProductCard(product);
        });
        html += '</div>';

        messageDiv.innerHTML = html;
      } else {
        // Mensaje normal
        messageDiv.innerHTML = `
          <div style="display: flex; ${isUser ? 'justify-content: flex-end;' : 'justify-content: flex-start;'}">
            <div style="max-width: 85%; border-radius: 16px; padding: 12px 16px; ${
              isUser 
                ? 'background: ' + widgetConfig.buttonColor + '; color: white;' 
                : 'background: #f1f5f9; color: #334155;'
            }">
              <div style="white-space: pre-wrap; font-size: 14px; line-height: 1.6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">${isUser ? escapeHtml(message.content) : parseMarkdown(message.content, false)}</div>
            </div>
          </div>
        `;
      }

      messagesContainer.appendChild(messageDiv);
    });

    // Scroll al final
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  // Actualizar estado de carga
  function updateLoadingState(stage) {
    const messagesContainer = document.getElementById('chat-widget-messages');
    if (!messagesContainer) return;

    // Remover loading anterior
    const oldLoading = document.getElementById('chat-widget-loading');
    if (oldLoading) oldLoading.remove();

    if (stage && isLoading) {
      const loadingDiv = document.createElement('div');
      loadingDiv.id = 'chat-widget-loading';
      loadingDiv.style.marginBottom = '12px';
      loadingDiv.innerHTML = `
        <div style="display: flex; justify-content: flex-start;">
          <div style="background: #f1f5f9; border-radius: 16px; padding: 12px 16px;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <svg style="animation: spin 1s linear infinite; width: 16px; height: 16px; color: #475569;" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle style="opacity: 0.25;" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path style="opacity: 0.75;" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span style="font-size: 14px; color: #475569;">${stage}</span>
            </div>
          </div>
        </div>
      `;
      messagesContainer.appendChild(loadingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
  }

  // Crear el widget
  function createWidget() {
    // Remover widget anterior si existe
    const existingWidget = document.getElementById('chat-widget-container');
    if (existingWidget) existingWidget.remove();

    // Determinar posición
    const isRight = widgetConfig.position === 'bottom-right';
    const positionStyle = isRight 
      ? 'bottom: 24px; right: 24px;' 
      : 'bottom: 24px; left: 24px;';

    // Crear contenedor principal
    const container = document.createElement('div');
    container.id = 'chat-widget-container';
    container.style.cssText = `
      position: fixed;
      ${positionStyle}
      z-index: ${widgetConfig.zIndex};
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    // Botón flotante
    const button = document.createElement('button');
    button.id = 'chat-widget-button';
    button.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" style="width: 32px; height: 32px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    `;
    button.style.cssText = `
      width: 64px;
      height: 64px;
      background: ${widgetConfig.buttonColor};
      color: white;
      border: none;
      border-radius: 50%;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s;
    `;
    button.addEventListener('mouseenter', () => {
      button.style.transform = 'scale(1.1)';
      button.style.background = adjustBrightness(widgetConfig.buttonColor, -10);
    });
    button.addEventListener('mouseleave', () => {
      button.style.transform = 'scale(1)';
      button.style.background = widgetConfig.buttonColor;
    });
    button.addEventListener('click', toggleWidget);

    // Overlay
    const overlay = document.createElement('div');
    overlay.id = 'chat-widget-overlay';
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.2);
      z-index: ${widgetConfig.zIndex - 1};
      opacity: 0;
      pointer-events: none;
      transition: opacity 0.3s;
    `;
    overlay.addEventListener('click', () => {
      if (isOpen) toggleWidget();
    });

    // Ventana del chat
    const chatWindow = document.createElement('div');
    chatWindow.id = 'chat-widget-window';
    chatWindow.style.cssText = `
      position: fixed;
      ${positionStyle}
      width: 100%;
      max-width: 448px;
      height: 85vh;
      max-height: 700px;
      background: white;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04);
      border-radius: 32px 32px 24px 24px;
      display: flex;
      flex-direction: column;
      overflow: hidden;
      opacity: 0;
      pointer-events: none;
      transform: translateY(20px);
      transition: all 0.3s;
      z-index: ${widgetConfig.zIndex};
      will-change: transform, opacity;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      visibility: hidden;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      border-bottom: 1px solid #f1f5f9;
    `;
    header.innerHTML = `
      <div style="display: flex; align-items: center; gap: 12px;">
        <button id="chat-widget-close" style="padding: 6px; background: transparent; border: none; cursor: pointer; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; color: #475569;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 style="font-size: 18px; font-weight: 600; color: #0f172a; margin: 0;">Hola, ¿qué tal? 👋</h2>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        <button id="chat-widget-clear" style="padding: 6px; background: transparent; border: none; cursor: pointer; border-radius: 8px; transition: background 0.2s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'" title="Limpiar conversación">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px; color: #475569;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    `;

    // Contenedor de mensajes
    const messagesContainer = document.createElement('div');
    messagesContainer.id = 'chat-widget-messages';
    messagesContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      overflow-x: hidden;
      padding: 16px;
      margin-bottom: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    `;

    // Input container
    const inputContainer = document.createElement('div');
    inputContainer.style.cssText = `
      border-top: 1px solid #f1f5f9;
      padding-top: 12px;
      padding-left: 16px;
      padding-right: 16px;
      padding-bottom: 8px;
    `;
    inputContainer.innerHTML = `
      <div style="display: flex; gap: 8px;">
        <textarea id="chat-widget-input" placeholder="Escribe tu pregunta..." style="
          flex: 1;
          padding: 10px 16px;
          border: 1px solid #cbd5e1;
          border-radius: 12px;
          resize: none;
          font-size: 14px;
          font-family: inherit;
          outline: none;
          transition: border-color 0.2s;
          background: white;
          color: #334155;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        " rows="2"></textarea>
        <button id="chat-widget-send" type="button" style="
          padding: 10px 16px;
          background: ${widgetConfig.buttonColor};
          color: white;
          border: none;
          border-radius: 12px;
          cursor: pointer;
          font-weight: 500;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: background 0.2s;
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" style="width: 20px; height: 20px;" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>
    `;

    // Añadir CSS para animación de spin y estilos adicionales
    if (!document.getElementById('chat-widget-styles')) {
      const style = document.createElement('style');
      style.id = 'chat-widget-styles';
      style.textContent = `
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        #chat-widget-window * {
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          text-rendering: optimizeLegibility;
        }
        #chat-widget-window input,
        #chat-widget-window textarea,
        #chat-widget-window button {
          -webkit-appearance: none;
          -moz-appearance: none;
          appearance: none;
        }
        #chat-widget-window textarea {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
        }
        #chat-widget-window {
          transform: translateZ(0);
          -webkit-transform: translateZ(0);
        }
        #chat-widget-window * {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
        #chat-widget-messages {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif !important;
        }
      `;
      document.head.appendChild(style);
    }

    // Ensamblar
    chatWindow.appendChild(header);
    chatWindow.appendChild(messagesContainer);
    chatWindow.appendChild(inputContainer);

    container.appendChild(button);
    document.body.appendChild(container);
    document.body.appendChild(overlay);
    document.body.appendChild(chatWindow);

    // Event listeners
    document.getElementById('chat-widget-close').addEventListener('click', toggleWidget);
    document.getElementById('chat-widget-clear').addEventListener('click', () => {
      if (confirm('¿Estás seguro de que quieres limpiar el historial de conversación?')) {
        clearMessages();
      }
    });
    document.getElementById('chat-widget-send').addEventListener('click', handleSend);
    
    const inputElement = document.getElementById('chat-widget-input');
    if (inputElement) {
      inputElement.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          handleSend();
        }
      });
      inputElement.addEventListener('focus', function() {
        this.style.borderColor = '#2563eb';
      });
      inputElement.addEventListener('blur', function() {
        this.style.borderColor = '#cbd5e1';
      });
    }

    // Cargar mensajes y renderizar
    loadMessages();
    renderMessages();
  }

  // Manejar envío de mensaje
  function handleSend() {
    const input = document.getElementById('chat-widget-input');
    if (!input) return;
    
    const message = input.value.trim();
    if (message && !isLoading) {
      input.value = '';
      sendMessage(message);
    }
  }

  // Toggle widget
  function toggleWidget() {
    isOpen = !isOpen;
    const button = document.getElementById('chat-widget-button');
    const overlay = document.getElementById('chat-widget-overlay');
    const window = document.getElementById('chat-widget-window');

    if (isOpen) {
      button.style.display = 'none';
      overlay.style.opacity = '1';
      overlay.style.pointerEvents = 'auto';
      window.style.opacity = '1';
      window.style.pointerEvents = 'auto';
      window.style.transform = 'translateY(0)';
      window.style.visibility = 'visible';
      
      // Focus en input después de que la animación termine
      setTimeout(() => {
        const input = document.getElementById('chat-widget-input');
        if (input) {
          input.focus();
          input.disabled = false;
        }
      }, 350);
    } else {
      button.style.display = 'flex';
      overlay.style.opacity = '0';
      overlay.style.pointerEvents = 'none';
      window.style.opacity = '0';
      window.style.pointerEvents = 'none';
      window.style.transform = 'translateY(20px)';
      // No ocultar completamente hasta que la animación termine
      setTimeout(() => {
        if (!isOpen) {
          window.style.visibility = 'hidden';
        }
      }, 300);
    }
  }

  // Ajustar brillo de color (helper)
  function adjustBrightness(color, percent) {
    const num = parseInt(color.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 +
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 +
      (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
  }

  // API pública
  window.ChatWidget = {
    init: function(config = {}) {
      widgetConfig = { ...DEFAULT_CONFIG, ...config };
      createWidget();
    },
    open: function() {
      if (!isOpen) toggleWidget();
    },
    close: function() {
      if (isOpen) toggleWidget();
    },
    clear: clearMessages,
    send: sendMessage
  };

  // Auto-inicializar si hay atributos data-*
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', checkAutoInit);
  } else {
    checkAutoInit();
  }

  function checkAutoInit() {
    const script = document.currentScript || document.querySelector('script[src*="chat-widget.js"]');
    if (script) {
      const apiUrl = script.getAttribute('data-api-url');
      const position = script.getAttribute('data-position');
      const buttonColor = script.getAttribute('data-button-color');
      
      if (apiUrl || position || buttonColor) {
        window.ChatWidget.init({
          apiUrl: apiUrl || DEFAULT_CONFIG.apiUrl,
          position: position || DEFAULT_CONFIG.position,
          buttonColor: buttonColor || DEFAULT_CONFIG.buttonColor
        });
      }
    }
  }
})();


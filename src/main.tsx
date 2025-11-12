import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Silenciar errores de Shadow DOM de extensiones del navegador (como poetry.js)
// Estos errores no afectan la funcionalidad de la aplicación
window.addEventListener('error', (event) => {
  const errorMessage = event.message || '';
  const errorSource = event.filename || '';
  
  // Silenciar errores específicos de Shadow DOM de extensiones externas
  if (
    errorMessage.includes('attachShadow') ||
    errorMessage.includes('Shadow root cannot be created') ||
    errorSource.includes('poetry.js') ||
    errorSource.includes('extension://')
  ) {
    event.preventDefault();
    return false;
  }
}, true);

// También capturar errores no manejados de promesas
window.addEventListener('unhandledrejection', (event) => {
  const reason = event.reason;
  const errorMessage = reason?.message || String(reason) || '';
  
  // Silenciar errores de Shadow DOM en promesas rechazadas
  if (
    errorMessage.includes('attachShadow') ||
    errorMessage.includes('Shadow root cannot be created')
  ) {
    event.preventDefault();
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

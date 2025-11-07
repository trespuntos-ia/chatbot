import { useState } from 'react';

export function WidgetIntegration() {
  const [copied, setCopied] = useState(false);
  const [apiUrl, setApiUrl] = useState(window.location.origin + '/api');
  const [position, setPosition] = useState<'bottom-right' | 'bottom-left'>('bottom-right');
  const [buttonColor, setButtonColor] = useState('#2563eb');

  // Generar código de integración
  const generateIntegrationCode = () => {
    return `<!-- Chat Widget - Añade esto antes del cierre de </body> -->
<script src="${window.location.origin}/chat-widget.js"></script>
<script>
  ChatWidget.init({
    apiUrl: '${apiUrl}',
    position: '${position}',
    buttonColor: '${buttonColor}',
    theme: 'light'
  });
</script>`;
  };

  const integrationCode = generateIntegrationCode();

  // Copiar al portapapeles
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(integrationCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Error copying to clipboard:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Integración del Chat Widget
        </h2>
        <p className="text-slate-600 mb-6">
          Añade el chat widget a cualquier web con un simple script. Copia el código y pégalo en tu HTML.
        </p>

        {/* Configuración */}
        <div className="mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              URL del API
            </label>
            <input
              type="text"
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              placeholder="https://tu-dominio.vercel.app/api"
            />
            <p className="mt-1 text-xs text-slate-500">
              Por defecto usa la URL actual del dashboard
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Posición
              </label>
              <select
                value={position}
                onChange={(e) => setPosition(e.target.value as 'bottom-right' | 'bottom-left')}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="bottom-right">Inferior Derecha</option>
                <option value="bottom-left">Inferior Izquierda</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Color del Botón
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="h-10 w-20 border border-slate-300 rounded-lg cursor-pointer"
                />
                <input
                  type="text"
                  value={buttonColor}
                  onChange={(e) => setButtonColor(e.target.value)}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  placeholder="#2563eb"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Código de integración */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-slate-700">
              Código de Integración
            </label>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-medium text-sm flex items-center gap-2"
            >
              {copied ? (
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
                  ¡Copiado!
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
                      d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                    />
                  </svg>
                  Copiar Código
                </>
              )}
            </button>
          </div>
          <pre className="bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm font-mono">
            <code>{integrationCode}</code>
          </pre>
        </div>

        {/* Instrucciones */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <h3 className="font-semibold text-blue-900 mb-2">📋 Instrucciones:</h3>
          <ol className="list-decimal list-inside space-y-2 text-sm text-blue-800">
            <li>Copia el código de arriba</li>
            <li>Pégalo justo antes del cierre de <code className="bg-blue-100 px-1 rounded">&lt;/body&gt;</code> en tu HTML</li>
            <li>El widget aparecerá automáticamente en tu web</li>
            <li>Los usuarios pueden hacer clic en el botón flotante para abrir el chat</li>
          </ol>
        </div>

        {/* Opciones avanzadas */}
        <details className="mt-6">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
            Opciones Avanzadas
          </summary>
          <div className="mt-4 p-4 bg-slate-50 rounded-lg space-y-3">
            <div>
              <h4 className="font-medium text-slate-900 mb-2">Atributos data-* (Auto-inicialización)</h4>
              <p className="text-sm text-slate-600 mb-2">
                También puedes usar atributos data-* en la etiqueta script para auto-inicializar:
              </p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <code>{`<script 
  src="${window.location.origin}/chat-widget.js"
  data-api-url="${apiUrl}"
  data-position="${position}"
  data-button-color="${buttonColor}">
</script>`}</code>
              </pre>
            </div>

            <div>
              <h4 className="font-medium text-slate-900 mb-2">API JavaScript</h4>
              <p className="text-sm text-slate-600 mb-2">
                Controla el widget programáticamente:
              </p>
              <pre className="bg-slate-900 text-slate-100 p-3 rounded text-xs font-mono overflow-x-auto">
                <code>{`// Abrir el chat
ChatWidget.open();

// Cerrar el chat
ChatWidget.close();

// Limpiar conversación
ChatWidget.clear();

// Enviar mensaje programáticamente
ChatWidget.send('Hola, ¿qué tal?');`}</code>
              </pre>
            </div>
          </div>
        </details>

        {/* Nota importante */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-start gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5 text-yellow-600 flex-shrink-0 mt-0.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <div>
              <h4 className="font-medium text-yellow-900 mb-1">⚠️ Importante</h4>
              <p className="text-sm text-yellow-800">
                Asegúrate de que el API esté configurado correctamente con CORS para permitir requests desde dominios externos. 
                El widget se conectará al endpoint <code className="bg-yellow-100 px-1 rounded">{apiUrl}/chat</code>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}







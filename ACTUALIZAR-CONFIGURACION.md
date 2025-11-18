# Actualizar Configuración del Dashboard

## Problema
El dashboard muestra valores antiguos (GPT-3.5 Turbo, temperatura 0.7, max tokens 800) aunque el código ya está actualizado.

## Soluciones

### Opción 1: Limpiar Caché del Navegador (Más Rápido)

1. **Abre las DevTools** (F12)
2. **Clic derecho en el botón de recargar** (en la barra de direcciones)
3. Selecciona **"Vaciar caché y recargar de forma forzada"**
   - O usa el atajo: **Ctrl+Shift+R** (Windows/Linux) o **Cmd+Shift+R** (Mac)

### Opción 2: Si Estás en Desarrollo Local

1. **Detén el servidor** (Ctrl+C en la terminal donde corre `npm run dev`)
2. **Reinicia el servidor:**
   ```bash
   npm run dev
   ```
3. **Recarga la página** en el navegador

### Opción 3: Si Estás en Producción (Vercel)

1. **Haz commit y push** de los cambios:
   ```bash
   git add src/services/chatService.ts src/components/ChatConfig.tsx
   git commit -m "Actualizar configuración por defecto a GPT-4o"
   git push
   ```
2. **Espera a que Vercel despliegue** automáticamente
3. **Recarga la página** después del deploy

### Opción 4: Verificar que los Cambios Están Aplicados

Ejecuta esto en la consola del navegador (F12 → Console):

```javascript
// Verificar la configuración por defecto
import { DEFAULT_CHAT_CONFIG } from './src/services/chatService';
console.log(DEFAULT_CHAT_CONFIG);
```

Debería mostrar:
```javascript
{
  model: 'gpt-4o',
  temperature: 0.2,
  max_tokens: 1000,
  ...
}
```

### Opción 5: Usar el Botón "Restaurar por defecto"

1. En el dashboard, haz clic en **"Restaurar por defecto"**
2. Esto debería cargar los nuevos valores por defecto

## Verificación

Después de aplicar cualquiera de las soluciones, deberías ver:

- ✅ **Modelo:** GPT-4o (no GPT-3.5 Turbo)
- ✅ **Temperatura:** 0.2 (no 0.7)
- ✅ **Max Tokens:** 1000 (no 800)

## Si Nada Funciona

1. Verifica que los archivos están guardados:
   - `src/services/chatService.ts` línea 84: `model: 'gpt-4o'`
   - `src/services/chatService.ts` línea 85: `temperature: 0.2`
   - `src/services/chatService.ts` línea 86: `max_tokens: 1000`

2. Si estás en Vercel, verifica que el deploy se completó correctamente

3. Si estás en desarrollo local, verifica que no hay errores en la consola del navegador


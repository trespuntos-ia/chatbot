# Instrucciones para hacer Push a GitHub

## Cambios realizados ✅

1. ✅ Eliminado `vercel.json` de la raíz
2. ✅ Creado `vercel.json` en `frontend-angular/` con configuración correcta
3. ✅ Commit realizado localmente

## Pasos para hacer Push

### Opción 1: Usar GitHub CLI o Autenticación

```bash
cd /Users/jordi/Documents/GitHub/chatbot2
git push
```

Si pide autenticación, usa un Personal Access Token de GitHub.

### Opción 2: Usar SSH (si tienes llaves configuradas)

```bash
cd /Users/jordi/Documents/GitHub/chatbot2
git remote set-url origin git@github.com:trespuntos-ia/chatbot.git
git push
```

### Opción 3: Push desde GitHub Desktop o VS Code

1. Abre GitHub Desktop o VS Code
2. Verás el commit pendiente
3. Haz click en "Push" o "Sync"

## Configuración en Vercel Dashboard

**IMPORTANTE**: Después del push, configura en Vercel:

1. Ve a https://vercel.com/dashboard
2. Selecciona tu proyecto
3. Settings → General
4. **Root Directory**: `frontend-angular`
5. Guarda

Vercel detectará automáticamente el `vercel.json` en `frontend-angular/` y hará el deploy correctamente.

## Verificación

Después del push y deploy:
- Los logs de build deben mostrar que se ejecutó `npm run build`
- El output debe estar en `dist/prestashop-products/browser`
- La aplicación debe funcionar sin errores 404


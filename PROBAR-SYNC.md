# 🧪 Cómo Probar la Sincronización

## ✅ Paso 1: Verificar que tienes una conexión guardada

1. Ve al Dashboard → pestaña **"Conexiones"**
2. Configura tu conexión de PrestaShop si no lo has hecho
3. Haz clic en **"Conectar y Obtener Productos"**
4. Debe aparecer "Conexión exitosa"
5. Esto guarda automáticamente la conexión en Supabase

## ✅ Paso 2: Espera el deploy (1-2 minutos)

El token CRON_SECRET que configuraste necesita que se despliegue una vez más.

## ✅ Paso 3: Probar Manualmente

Después del deploy, prueba con esta URL (reemplaza `tu-dominio.vercel.app` con tu dominio real):

```
https://tu-dominio.vercel.app/api/sync-products-cron?manual=true&token=0f961c45b91084e013501bfae25d99f195f8f083d082a7f9714c4474d44e64c4
```

**O más simple, solo para pruebas:**

```
https://tu-dominio.vercel.app/api/sync-products-cron?manual=true
```

## ✅ Paso 4: Ver los Resultados

1. Ve al Dashboard → pestaña **"Historial"**
2. Deberías ver una nueva entrada con:
   - Estado: Completado o Fallido
   - Productos escaneados
   - Productos nuevos encontrados
   - Productos importados
   - Logs detallados

## 📋 Posibles Errores y Soluciones

### Error: "No active PrestaShop connection found"
**Solución:** Ve a Conexiones y configura tu conexión de PrestaShop

### Error: 401 Unauthorized
**Solución:** Verifica que el token en la URL sea exactamente: `0f961c45b91084e013501bfae25d99f195f8f083d082a7f9714c4474d44e64c4`

### Error: 404 Not Found
**Solución:** Espera 1-2 minutos más para que termine el deploy

### Error: "Supabase configuration missing"
**Solución:** Verifica en Vercel que tengas configuradas:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

## 🎯 Una vez que funcione manualmente

El cron automático se ejecutará cada noche a las **23:50 UTC** (00:50 hora peninsular española) automáticamente.

# 🔧 Solución al Error "Load failed"

## ✅ Confirmado: La API está funcionando

He probado tu API y **está funcionando correctamente**. El dominio `https://chatbot-v2-murex.vercel.app` es correcto.

## 🎯 Solución Rápida: Usar el Script de Terminal

El error "Load failed" probablemente es un problema de CORS al abrir el HTML directamente. Usa este método en su lugar:

### Opción 1: Script Bash (MÁS FÁCIL)

```bash
# Desde la Terminal, en la carpeta del proyecto:
bash scripts/index-product-curl.sh
```

O con una URL específica:

```bash
bash scripts/index-product-curl.sh "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"
```

### Opción 2: Usar curl directamente

```bash
curl -X POST https://chatbot-v2-murex.vercel.app/api/index-web-content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
    "content_type": "product_page"
  }'
```

### Opción 3: Usar Node.js (si tienes Node instalado)

```bash
node scripts/index-product-simple.js
```

Cuando te pregunte, pega la URL del producto.

---

## 🔍 Verificar que Funcionó

### Método 1: Ver la respuesta

Si el comando fue exitoso, verás algo como:

```json
{
  "success": true,
  "message": "Content indexed successfully",
  "content": {
    "id": "...",
    "title": "...",
    ...
  }
}
```

### Método 2: Probar en el chat

1. Ve a tu chat
2. Pregunta: "¿Qué características tiene el Aromatic Rellenable?"
3. El bot debería responder con información detallada

### Método 3: Verificar en Supabase

1. Ve a tu proyecto en Supabase
2. Abre la tabla `web_content_index`
3. Deberías ver una fila con la URL indexada

---

## ❓ Si Aún No Funciona

### Error: "Supabase configuration missing"

**Solución:**
1. Ve a Vercel Dashboard → Tu Proyecto → Settings → Environment Variables
2. Asegúrate de tener:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_KEY` o `SUPABASE_ANON_KEY`
3. Redespliega el proyecto

### Error: "relation web_content_index does not exist"

**Solución:**
1. Ve a Supabase Dashboard → SQL Editor
2. Copia y pega el contenido de `supabase-web-content-schema.sql`
3. Ejecuta el SQL
4. Verifica que las tablas se crearon

### Error: "Failed to scrape content"

**Solución:**
- La URL puede no ser accesible
- Verifica que la URL sea correcta
- Prueba con otra URL de producto

---

## 📝 Ejemplo Completo

```bash
# 1. Ve a la carpeta del proyecto
cd /Users/jordi/Documents/GitHub/chatbot2

# 2. Ejecuta el script
bash scripts/index-product-curl.sh "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"

# 3. Verifica que funcionó (deberías ver "✅ ¡Producto indexado correctamente!")

# 4. Prueba en el chat
```

---

¿Necesitas más ayuda? Verifica los logs de Vercel para ver errores específicos.



# 📝 Cómo Indexar Productos - Guía Paso a Paso

## 🎯 Opción 1: Usar la Página HTML (MÁS FÁCIL)

### Paso 1: Abrir el archivo HTML

1. Abre el archivo `scripts/index-product.html` en tu navegador
   - Haz doble clic en el archivo, o
   - Arrastra el archivo al navegador

### Paso 2: Configurar tu dominio

1. En la página, verás un campo "URL de la API"
2. Cambia `https://chatbot-v2-murex.vercel.app` por tu dominio real de Vercel
   - Si no sabes tu dominio, ve a https://vercel.com/dashboard
   - Busca tu proyecto y copia la URL

### Paso 3: Indexar el producto

1. Pega la URL del producto en el campo "URL del Producto"
   - Ejemplo: `https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html`
2. (Opcional) Si conoces el Product ID, ingrésalo
3. Haz clic en "🔄 Indexar Producto"
4. Espera a que termine (verás un mensaje de éxito o error)

### Paso 4: Probar

1. Ve a tu chat
2. Pregunta: "¿Qué características tiene el Aromatic Rellenable?"
3. El bot debería responder con información detallada

---

## 🖥️ Opción 2: Usar el Script de Terminal (Node.js)

### Paso 1: Abrir la Terminal

1. Abre Terminal (Mac) o CMD/PowerShell (Windows)
2. Navega a la carpeta del proyecto:
   ```bash
   cd /Users/jordi/Documents/GitHub/chatbot2
   ```

### Paso 2: Editar el script (si es necesario)

1. Abre el archivo `scripts/index-product-simple.js`
2. En la línea 45, cambia:
   ```javascript
   const API_BASE_URL = 'https://chatbot-v2-murex.vercel.app';
   ```
   Por tu dominio real de Vercel

### Paso 3: Ejecutar el script

```bash
node scripts/index-product-simple.js
```

### Paso 4: Seguir las instrucciones

1. Cuando te pregunte, pega la URL del producto
2. (Opcional) Ingresa el Product ID si lo conoces
3. Espera a que termine

---

## 🌐 Opción 3: Usar curl (Terminal)

### Paso 1: Abrir Terminal

### Paso 2: Ejecutar este comando (cambia el dominio):

```bash
curl -X POST https://TU-DOMINIO.vercel.app/api/index-web-content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
    "content_type": "product_page"
  }'
```

**Reemplaza `TU-DOMINIO` por tu dominio real de Vercel**

---

## 🔍 ¿Cómo saber tu dominio de Vercel?

### Método 1: Desde Vercel Dashboard

1. Ve a https://vercel.com/dashboard
2. Busca tu proyecto (probablemente "chatbot-v2" o similar)
3. Haz clic en el proyecto
4. Verás la URL en la parte superior, algo como:
   - `https://chatbot-v2-murex.vercel.app`
   - O tu dominio personalizado

### Método 2: Desde el código

Si ya tienes el proyecto desplegado, la URL debería estar en:
- `README-DEPLOY.md` (menciona `chatbot-v2-murex.vercel.app`)
- O en la configuración de Vercel

---

## ✅ Verificar que Funcionó

### Método 1: Ver en Supabase

1. Ve a tu proyecto en Supabase
2. Abre la tabla `web_content_index`
3. Deberías ver una fila con la URL que indexaste

### Método 2: Probar en el Chat

1. Haz una pregunta sobre el producto indexado
2. El bot debería responder con información detallada

---

## 🐛 Solución de Problemas

### Error: "fetch failed" o "Network error"

**Solución:**
- Verifica que el dominio de Vercel sea correcto
- Verifica que la API esté desplegada (ve a la URL en el navegador)
- Verifica tu conexión a internet

### Error: "Supabase configuration missing"

**Solución:**
- Las variables de entorno no están configuradas en Vercel
- Ve a Vercel → Tu Proyecto → Settings → Environment Variables
- Asegúrate de tener:
  - `SUPABASE_URL`
  - `SUPABASE_SERVICE_KEY` o `SUPABASE_ANON_KEY`

### Error: "relation web_content_index does not exist"

**Solución:**
- Las tablas no están creadas en Supabase
- Ejecuta el archivo `supabase-web-content-schema.sql` en Supabase:
  1. Ve a Supabase Dashboard
  2. SQL Editor
  3. Pega el contenido de `supabase-web-content-schema.sql`
  4. Ejecuta

### El producto no aparece en el chat

**Solución:**
- Verifica que el producto esté indexado (revisa Supabase)
- Verifica que el `product_id` coincida si lo especificaste
- Prueba hacer una búsqueda más específica en el chat

---

## 📚 Indexar Todos los Productos

Si quieres indexar todos los productos de una vez:

### Opción 1: Script HTML (no disponible aún)

### Opción 2: Script de Terminal

```bash
# Edita scripts/index-all-products.js y cambia el dominio
# Luego ejecuta:
node scripts/index-all-products.js
```

### Opción 3: curl

```bash
curl -X POST https://TU-DOMINIO.vercel.app/api/index-all-products \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "offset": 0
  }'
```

---

## 🎉 ¡Listo!

Una vez indexado, el sistema:
- ✅ Guardará el contenido en Supabase
- ✅ Lo actualizará automáticamente cada noche (si hay cambios)
- ✅ El bot podrá usarlo para responder preguntas detalladas

**¿Necesitas ayuda?** Revisa la sección de "Solución de Problemas" arriba.











# Scripts para Indexar Contenido Web

## 📋 Scripts Disponibles

### 1. Indexar un Producto Específico

**Archivo:** `index-product.js`

**Uso:**
```bash
node scripts/index-product.js <URL> [product_id]
```

**Ejemplos:**
```bash
# Indexar un producto por URL
node scripts/index-product.js "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"

# Indexar con product_id
node scripts/index-product.js "https://100x100chef.com/shop/..." 123
```

**Configurar API_BASE_URL:**
```bash
# Desarrollo local
API_BASE_URL=http://localhost:3000 node scripts/index-product.js "..."

# Producción (Vercel)
API_BASE_URL=https://tu-dominio.vercel.app node scripts/index-product.js "..."
```

---

### 2. Indexar Todos los Productos

**Archivo:** `index-all-products.js`

**Uso:**
```bash
node scripts/index-all-products.js [limit] [offset]
```

**Ejemplos:**
```bash
# Indexar primeros 100 productos
node scripts/index-all-products.js

# Indexar 50 productos empezando desde el 0
node scripts/index-all-products.js 50 0

# Indexar siguientes 50 productos (paginación)
node scripts/index-all-products.js 50 50
```

**Configurar API_BASE_URL:**
```bash
API_BASE_URL=https://tu-dominio.vercel.app node scripts/index-all-products.js
```

---

## 🔧 Alternativas: Usar curl o Postman

### Opción 1: Usar curl (Terminal)

**Indexar un producto:**
```bash
curl -X POST https://tu-dominio.vercel.app/api/index-web-content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
    "content_type": "product_page",
    "product_id": 123
  }'
```

**Indexar todos los productos:**
```bash
curl -X POST https://tu-dominio.vercel.app/api/index-all-products \
  -H "Content-Type: application/json" \
  -d '{
    "limit": 100,
    "offset": 0
  }'
```

---

### Opción 2: Usar Postman

1. **Crear nueva request**
   - Method: `POST`
   - URL: `https://tu-dominio.vercel.app/api/index-web-content`

2. **Headers:**
   - `Content-Type: application/json`

3. **Body (raw JSON):**
```json
{
  "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
  "content_type": "product_page",
  "product_id": 123
}
```

4. **Enviar request**

---

### Opción 3: Usar el navegador (para pruebas)

Puedes crear un HTML simple para probar:

```html
<!DOCTYPE html>
<html>
<head>
    <title>Indexar Producto</title>
</head>
<body>
    <h1>Indexar Producto</h1>
    <input type="text" id="url" placeholder="URL del producto" style="width: 500px;">
    <button onclick="indexProduct()">Indexar</button>
    <pre id="result"></pre>

    <script>
        async function indexProduct() {
            const url = document.getElementById('url').value;
            const resultEl = document.getElementById('result');
            
            resultEl.textContent = 'Indexando...';
            
            try {
                const response = await fetch('https://tu-dominio.vercel.app/api/index-web-content', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        url: url,
                        content_type: 'product_page'
                    })
                });
                
                const data = await response.json();
                resultEl.textContent = JSON.stringify(data, null, 2);
            } catch (error) {
                resultEl.textContent = 'Error: ' + error.message;
            }
        }
    </script>
</body>
</html>
```

---

## 📝 Pasos Recomendados

### 1. Primero: Ejecutar el Schema SQL

Antes de indexar, asegúrate de haber creado las tablas en Supabase:

```sql
-- Ejecutar supabase-web-content-schema.sql en Supabase SQL Editor
```

### 2. Configurar API_BASE_URL

Si usas los scripts, edita el archivo y cambia:
```javascript
const API_BASE_URL = process.env.API_BASE_URL || 'https://tu-dominio.vercel.app';
```

Por tu dominio real de Vercel, o usa la variable de entorno:
```bash
export API_BASE_URL=https://tu-dominio.vercel.app
```

### 3. Indexar un Producto de Prueba

```bash
node scripts/index-product.js "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html"
```

### 4. Verificar que Funciona

Haz una pregunta en el chat sobre el producto indexado:
- "¿Qué características tiene el Aromatic Rellenable?"
- El bot debería responder con información detallada

### 5. Indexar Todos los Productos

```bash
node scripts/index-all-products.js
```

---

## ⚠️ Notas Importantes

1. **Dominio de Vercel**: Reemplaza `tu-dominio.vercel.app` con tu dominio real
2. **Variables de entorno**: Asegúrate de que `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` estén configuradas en Vercel
3. **Rate limiting**: Si indexas muchos productos, el script hace pausas de 500ms entre cada uno
4. **Cron automático**: Una vez indexado, el cron nocturno se encargará de mantener actualizado el contenido

---

## 🐛 Troubleshooting

### Error: "fetch failed"
- Verifica que la API esté desplegada
- Verifica que el dominio sea correcto
- Verifica la conexión a internet

### Error: "Supabase configuration missing"
- Verifica que las variables de entorno estén configuradas en Vercel
- Verifica que `SUPABASE_SERVICE_KEY` tenga permisos de escritura

### Error: "No products with URLs found"
- Verifica que los productos en Supabase tengan `product_url` configurado
- Verifica que no estés usando un offset muy alto











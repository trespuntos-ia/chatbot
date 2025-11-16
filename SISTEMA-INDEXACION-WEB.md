# 🌐 Sistema de Indexación Web - Documentación Completa

## 📋 Índice

1. [Resumen Ejecutivo](#resumen-ejecutivo)
2. [¿Qué es y para qué sirve?](#qué-es-y-para-qué-sirve)
3. [Cómo Funciona](#cómo-funciona)
4. [Flujo Completo](#flujo-completo)
5. [Implementación Técnica](#implementación-técnica)
6. [Base de Datos](#base-de-datos)
7. [APIs](#apis)
8. [Configuración](#configuración)
9. [Uso en el Chat](#uso-en-el-chat)

---

## 🎯 Resumen Ejecutivo

El **Sistema de Indexación Web** permite que OpenAI tenga conocimiento de contenido web (páginas de productos, documentación, etc.) **sin consultar la web cada vez**. El contenido se indexa y guarda en la base de datos, y cada noche se verifica si hay cambios. Esto permite respuestas más completas y detalladas sin depender de scraping en tiempo real.

### Características Clave:

- ✅ **Indexación automática**: El contenido web se scrapea y guarda en la base de datos
- ✅ **Actualización nocturna**: Cada noche se verifica si hay cambios (comparando hash)
- ✅ **Sin scraping en tiempo real**: OpenAI usa contenido ya indexado, mucho más rápido
- ✅ **Detección de cambios**: Solo actualiza si el contenido realmente cambió
- ✅ **Búsqueda integrada**: El chat puede buscar en contenido indexado automáticamente

---

## 💡 ¿Qué es y para qué sirve?

### ¿Qué es?

Es un sistema que:
1. **Indexa contenido web** (páginas de productos, documentación, etc.)
2. **Guarda el contenido** en Supabase con hash SHA256
3. **Verifica cambios cada noche** comparando hashes
4. **Permite búsqueda** en el contenido indexado desde el chat

### ¿Para qué sirve?

1. **Para el Bot**:
   - Tiene acceso a información detallada de productos (descripciones completas, características, especificaciones)
   - Puede responder preguntas específicas sin depender de scraping en tiempo real
   - Respuestas más rápidas y confiables

2. **Para el Cliente**:
   - El bot conoce detalles completos de productos automáticamente
   - No necesita configurar manualmente toda la información
   - La información se actualiza automáticamente cuando cambia en la web

### Ejemplo Práctico:

**Producto:** Aromatic Rellenable 007 Flavour

**Contenido indexado:**
- Descripción completa: "Descubre el Aromatic Rellenable, la opción perfecta para disfrutar de soluciones aromáticas sin nicotina..."
- Características: "Fácil Rellenado: Simplemente añade 5 ml de tu solución preferida..."
- Especificaciones: Material: Plástico, Dimensiones: 2x2x11cm, Pack: 10 unidades
- Advertencias: "Importante: No utilizar aceites esenciales"

**Cuando el usuario pregunta:**
- "¿Qué características tiene el Aromatic Rellenable?"
- El bot busca en el contenido indexado y responde con información detallada

---

## 🔄 Cómo Funciona

### Arquitectura General

```
1. Indexación Inicial (Manual o Automática)
   ↓
2. Scrapear URL → Extraer contenido → Calcular hash SHA256
   ↓
3. Guardar en Supabase (web_content_index)
   ↓
4. Cada noche (Cron): Verificar URLs que necesitan actualización
   ↓
5. Scrapear → Comparar hash → Actualizar solo si cambió
   ↓
6. Chat: Buscar en contenido indexado cuando el usuario pregunta
```

### Componentes Principales

1. **Tabla `web_content_index`**: Almacena contenido indexado con hash
2. **Tabla `web_content_sources`**: Configuración de URLs a indexar
3. **API `index-web-content`**: Indexa una URL manualmente
4. **API `sync-web-content-cron`**: Actualización nocturna automática
5. **API `search-web-content`**: Búsqueda en contenido indexado
6. **Función `search_web_content` en chat**: Integrada en OpenAI Function Calling

---

## 📝 Flujo Completo

### PASO 1: Indexar una URL por primera vez

```typescript
POST /api/index-web-content
{
  "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
  "content_type": "product_page",
  "product_id": 123  // Opcional: relacionar con producto
}
```

**Qué ocurre:**
1. Scrapea la URL
2. Extrae título, contenido, metadata
3. Calcula hash SHA256
4. Guarda en `web_content_index`

---

### PASO 2: Usuario pregunta en el chat

```
Usuario: "¿Qué características tiene el Aromatic Rellenable?"
```

---

### PASO 3: OpenAI busca en contenido indexado

```typescript
// OpenAI llama automáticamente a la función
search_web_content({
  query: "Aromatic Rellenable características",
  product_id: 123  // Si se conoce
})
```

---

### PASO 4: API busca en Supabase

```typescript
// Busca en web_content_index
SELECT * FROM web_content_index
WHERE status = 'active'
AND (title ILIKE '%Aromatic Rellenable%' OR content ILIKE '%características%')
AND product_id = 123
```

---

### PASO 5: OpenAI responde con información detallada

```
Bot: "El Aromatic Rellenable tiene las siguientes características:

- Fácil Rellenado: Simplemente añade 5 ml de tu solución preferida y ciérralo a presión
- Uso Único: Diseñado para un solo uso, asegurando frescura y calidad
- Pack de 10 unidades

Importante: No utilizar aceites esenciales.

Material: Plástico
Dimensiones: 2x2x11cm"
```

---

### PASO 6: Actualización nocturna (Cron)

Cada noche, el sistema:
1. Busca URLs con `next_check_at <= now()`
2. Scrapea cada URL
3. Compara hash con el guardado
4. Si cambió: Actualiza
5. Si no cambió: Solo actualiza `last_scraped_at`
6. Programa próxima verificación

---

## 🛠️ Implementación Técnica

### 1. Schema SQL

Ver archivo: `supabase-web-content-schema.sql`

**Tablas:**
- `web_content_index`: Contenido indexado
- `web_content_sources`: Configuración de URLs

### 2. API de Indexación

**Archivo:** `api/index-web-content.ts`

**Endpoint:** `POST /api/index-web-content`

**Body:**
```json
{
  "url": "https://...",
  "content_type": "product_page",
  "product_id": 123,
  "force": false
}
```

**Qué hace:**
- Scrapea la URL
- Calcula hash SHA256
- Si existe y hash no cambió: No actualiza (a menos que `force=true`)
- Si cambió o no existe: Guarda/actualiza

### 3. API de Sincronización Nocturna

**Archivo:** `api/sync-web-content-cron.ts`

**Endpoint:** `GET/POST /api/sync-web-content-cron`

**Query params:**
- `limit`: Máximo de URLs a procesar (default: 50)
- `force`: Forzar actualización aunque no haya cambios (default: false)

**Configurar en Vercel Cron:**
```json
{
  "crons": [
    {
      "path": "/api/sync-web-content-cron",
      "schedule": "0 2 * * *"  // Cada día a las 2 AM
    }
  ]
}
```

### 4. API de Búsqueda

**Archivo:** `api/search-web-content.ts`

**Endpoint:** `GET /api/search-web-content?query=texto&limit=10`

**Query params:**
- `query`: Texto de búsqueda (requerido)
- `limit`: Máximo de resultados (default: 10)
- `content_type`: Filtrar por tipo
- `product_id`: Filtrar por producto

### 5. Integración en Chat

**Archivo:** `api/chat.ts`

**Función añadida:** `search_web_content`

**Cuándo se usa:**
- Cuando el usuario pregunta por detalles específicos de un producto
- Cuando se necesita información más completa que la básica
- Automáticamente cuando se encuentra un producto (se busca contenido adicional)

---

## 🗄️ Base de Datos

### Tabla: `web_content_index`

```sql
CREATE TABLE web_content_index (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  title TEXT,
  content TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- SHA256 para detectar cambios
  content_type TEXT DEFAULT 'product_page',
  metadata JSONB,  -- Descripción, características, especificaciones
  source TEXT,  -- hostname
  product_id BIGINT REFERENCES products(id),
  last_scraped_at TIMESTAMP,
  next_check_at TIMESTAMP,  -- Próxima verificación
  scrape_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  error_message TEXT,
  created_at TIMESTAMP,
  last_updated_at TIMESTAMP
);
```

### Tabla: `web_content_sources`

```sql
CREATE TABLE web_content_sources (
  id UUID PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  content_type TEXT DEFAULT 'product_page',
  enabled BOOLEAN DEFAULT true,
  priority INTEGER DEFAULT 5,  -- 1-10
  scrape_interval_days INTEGER DEFAULT 1,
  last_scraped_at TIMESTAMP,
  next_scrape_at TIMESTAMP,
  product_id BIGINT REFERENCES products(id),
  metadata JSONB,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

---

## 🔌 APIs

### 1. Indexar Contenido Manualmente

```bash
POST /api/index-web-content
Content-Type: application/json

{
  "url": "https://100x100chef.com/shop/...",
  "content_type": "product_page",
  "product_id": 123
}
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Content indexed successfully",
  "content": {
    "id": "...",
    "url": "...",
    "title": "...",
    "content_hash": "...",
    ...
  }
}
```

### 2. Sincronización Nocturna (Cron)

```bash
GET /api/sync-web-content-cron?limit=50
```

**Respuesta:**
```json
{
  "success": true,
  "message": "Processed 25 URLs",
  "processed": 25,
  "updated": 3,
  "unchanged": 20,
  "errors": 2,
  "details": [...]
}
```

### 3. Buscar Contenido

```bash
GET /api/search-web-content?query=Aromatic%20Rellenable&limit=5
```

**Respuesta:**
```json
{
  "success": true,
  "query": "Aromatic Rellenable",
  "results": [
    {
      "id": "...",
      "url": "...",
      "title": "...",
      "snippet": "...",
      "metadata": {...}
    }
  ],
  "total": 1
}
```

---

## ⚙️ Configuración

### 1. Crear Tablas en Supabase

```bash
# Ejecutar el schema SQL
psql -h [host] -U [user] -d [database] -f supabase-web-content-schema.sql
```

O desde el dashboard de Supabase:
1. Ir a SQL Editor
2. Pegar el contenido de `supabase-web-content-schema.sql`
3. Ejecutar

### 2. Indexar URLs Iniciales

**Opción A: Desde código (recomendado para productos)**

```typescript
// Script para indexar todas las URLs de productos
const products = await supabase.from('products').select('id, product_url');

for (const product of products) {
  if (product.product_url) {
    await fetch('/api/index-web-content', {
      method: 'POST',
      body: JSON.stringify({
        url: product.product_url,
        content_type: 'product_page',
        product_id: product.id
      })
    });
  }
}
```

**Opción B: Usando web_content_sources**

```sql
INSERT INTO web_content_sources (url, content_type, product_id, enabled, priority)
VALUES 
  ('https://100x100chef.com/shop/...', 'product_page', 123, true, 10),
  ('https://100x100chef.com/shop/...', 'product_page', 124, true, 10);
```

### 3. Configurar Cron en Vercel

En `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/sync-web-content-cron",
      "schedule": "0 2 * * *"
    }
  ]
}
```

O desde el dashboard de Vercel:
1. Ir a Settings → Cron Jobs
2. Añadir nuevo cron
3. Path: `/api/sync-web-content-cron`
4. Schedule: `0 2 * * *` (cada día a las 2 AM)

---

## 💬 Uso en el Chat

### Automático

Cuando OpenAI encuentra un producto, automáticamente busca contenido web adicional:

```
Usuario: "¿Qué características tiene el Aromatic Rellenable?"

Bot internamente:
1. Busca producto → Encuentra "Aromatic Rellenable"
2. Busca contenido web → Encuentra descripción detallada
3. Responde con información completa
```

### Manual (Function Calling)

OpenAI puede llamar directamente a `search_web_content`:

```typescript
// OpenAI decide llamar a esta función cuando:
// - Usuario pregunta por detalles específicos
// - Necesita información más completa
search_web_content({
  query: "características especificaciones",
  product_id: 123
})
```

---

## 📊 Ejemplo Completo

### 1. Indexar Producto

```bash
curl -X POST https://tu-dominio.com/api/index-web-content \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://100x100chef.com/shop/espana/es/aromas/148-007-flavour-vap-rellenable---10-uds.html",
    "content_type": "product_page",
    "product_id": 123
  }'
```

### 2. Usuario Pregunta

```
Usuario: "¿Qué características tiene el Aromatic Rellenable y cómo se usa?"
```

### 3. OpenAI Busca

1. Busca producto → Encuentra "Aromatic Rellenable"
2. Busca contenido web → Encuentra descripción completa
3. Responde:

```
Bot: "El Aromatic Rellenable tiene las siguientes características:

**Características:**
- Fácil Rellenado: Simplemente añade 5 ml de tu solución preferida y ciérralo a presión
- Uso Único: Diseñado para un solo uso, asegurando frescura y calidad en cada experiencia

**Especificaciones:**
- Material: Plástico
- Dimensiones: 2x2x11cm
- Unidades por caja: 10

**Uso:**
Perfecto para rellenar con aromas alimentarios Hot & Cold Flavour 007, disponibles en 19 variedades.

**⚠️ Importante:** No utilizar aceites esenciales."
```

### 4. Actualización Nocturna

Cada noche a las 2 AM:
- Verifica si la página cambió
- Si cambió: Actualiza contenido
- Si no cambió: Solo actualiza timestamp

---

## ✅ Checklist de Implementación

### Backend:
- [x] Crear schema SQL (`supabase-web-content-schema.sql`)
- [x] Crear API de indexación (`api/index-web-content.ts`)
- [x] Crear API de sincronización (`api/sync-web-content-cron.ts`)
- [x] Crear API de búsqueda (`api/search-web-content.ts`)
- [x] Integrar en chat (`api/chat.ts`)
- [ ] Ejecutar schema SQL en Supabase
- [ ] Configurar cron en Vercel
- [ ] Indexar URLs iniciales

### Testing:
- [ ] Probar indexación manual de una URL
- [ ] Probar búsqueda de contenido indexado
- [ ] Probar actualización nocturna (cron)
- [ ] Probar que OpenAI usa el contenido en respuestas
- [ ] Verificar que solo actualiza si hay cambios

---

## 🔧 Troubleshooting

### Problema: El contenido no se indexa

**Solución:**
- Verificar que la URL sea accesible
- Revisar logs de error en `error_message`
- Verificar que `SUPABASE_SERVICE_KEY` esté configurado

### Problema: El contenido no se actualiza

**Solución:**
- Verificar que `next_check_at` sea <= ahora
- Verificar que el cron esté configurado en Vercel
- Revisar logs del cron

### Problema: OpenAI no encuentra contenido

**Solución:**
- Verificar que el contenido esté indexado (`status = 'active'`)
- Verificar que la búsqueda coincida con título/contenido
- Revisar que `product_id` coincida si se filtra por producto

---

**Última actualización:** 2025-01-15  
**Versión:** 1.0











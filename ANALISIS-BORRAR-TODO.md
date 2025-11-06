# 🔍 Análisis: ¿Qué se perdería al borrar toda la base de datos?

## ⚠️ ADVERTENCIA IMPORTANTE

Si borras **TODA** la base de datos de Supabase, perderás **TODO** de forma **IRREVERSIBLE**.

## 📊 Tablas en Supabase

### 1. **`products`** - Productos de PrestaShop
**Se perdería:**
- ✅ Todos los productos guardados (598 productos según la imagen)
- ✅ Categorías asignadas
- ✅ Precios, descripciones, imágenes
- ✅ Fechas de creación

**Se puede recuperar:**
- ✅ SÍ - Puedes volver a escanear desde PrestaShop
- ✅ Los productos están en tu tienda PrestaShop, no se pierden

---

### 2. **`chat_conversations`** - Conversaciones del Chat
**Se perdería:**
- ✅ Historial de conversaciones con usuarios
- ✅ Mensajes de usuarios y respuestas del bot
- ✅ Productos consultados en cada conversación
- ✅ Categorías consultadas
- ✅ Métricas de rendimiento (tiempo de respuesta, tokens usados)
- ✅ Datos de analytics

**Se puede recuperar:**
- ❌ NO - Este historial es único e irrecuperable
- ⚠️ **IMPORTANTE**: Si borras esto, pierdes todo el historial de interacciones

---

### 3. **`chat_analytics_summaries`** - Resúmenes de Analytics
**Se perdería:**
- ✅ Resúmenes generados de conversaciones
- ✅ Insights y recomendaciones
- ✅ Estadísticas acumuladas

**Se puede recuperar:**
- ⚠️ Parcialmente - Se pueden regenerar, pero perderás los históricos

---

### 4. **`system_prompts`** - Prompts del Sistema
**Se perdería:**
- ✅ Configuración de prompts personalizados
- ✅ Versiones de prompts
- ✅ Prompts activos

**Se puede recuperar:**
- ⚠️ Depende - Si tienes backups o los guardaste, puedes restaurarlos
- Si no, tendrás que volver a configurarlos

---

### 5. **`prompt_variables`** - Variables de Prompts
**Se perdería:**
- ✅ Variables personalizadas de prompts
- ✅ Valores configurados

**Se puede recuperar:**
- ⚠️ Depende - Solo si tienes backups

---

### 6. **`prestashop_connections`** - Conexiones PrestaShop
**Se perdería:**
- ✅ Configuración de conexiones guardadas
- ✅ URLs de API, API Keys
- ✅ Configuraciones de idioma

**Se puede recuperar:**
- ✅ SÍ - Puedes volver a configurarlas en el dashboard

---

### 7. **`product_sync_history`** - Historial de Sincronizaciones
**Se perdería:**
- ✅ Historial de sincronizaciones de productos
- ✅ Logs de errores y éxitos
- ✅ Estadísticas de sincronización

**Se puede recuperar:**
- ✅ SÍ - Se generará nuevo historial al sincronizar de nuevo

---

### 8. **`documents`** - Documentos Subidos
**Se perdería:**
- ✅ Documentos PDF subidos
- ✅ Texto extraído de documentos
- ✅ Índices de búsqueda

**Se puede recuperar:**
- ⚠️ Depende - Solo si tienes los archivos originales para volver a subirlos

---

### 9. **`web_content_index`** - Contenido Web Indexado
**Se perdería:**
- ✅ Contenido web indexado
- ✅ Fuentes de contenido web

**Se puede recuperar:**
- ✅ SÍ - Puedes volver a indexar el contenido web

---

## 🎯 Recomendación: **NO borrar toda la base de datos**

### ⚠️ ¿Por qué NO borrar toda la base de datos?

Si borras toda la base de datos perderás:
- ❌ **TODAS las conversaciones del chat** (historial completo de usuarios)
- ❌ **TODO el historial de analytics** (insights sobre comportamiento)
- ❌ **TODOS los prompts configurados** (tendrás que reconfigurarlos)
- ❌ **TODAS las conexiones guardadas** (tendrás que volver a configurarlas)

### Opción 1: Solo actualizar productos (RECOMENDADO) ✅
1. Ejecutar el script SQL para agregar `all_categories`
2. Ejecutar la sincronización completa desde el cron
3. Los productos se actualizarán con las nuevas categorías
4. No pierdes nada

### Opción 2: Solo borrar productos (si es necesario) ⚠️
Si realmente quieres empezar de cero con productos:

```sql
-- SOLO borrar productos
TRUNCATE TABLE products CASCADE;
```

**Esto mantendrá:**
- ✅ Conversaciones del chat
- ✅ Analytics
- ✅ Prompts configurados
- ✅ Conexiones guardadas
- ✅ Documentos
- ✅ Todo lo demás

---

## ✅ Solución Recomendada: Script de Migración

En lugar de borrar todo, ejecuta este script para actualizar la estructura:

```sql
-- 1. Agregar columna all_categories si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'products' AND column_name = 'all_categories'
    ) THEN
        ALTER TABLE products ADD COLUMN all_categories JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- 2. Agregar índices
CREATE INDEX IF NOT EXISTS idx_products_all_categories ON products USING gin(all_categories);

-- 3. Los productos se actualizarán en la próxima sincronización
```

Luego ejecuta la sincronización completa desde `/api/sync-products-cron.ts` y todos los productos se actualizarán con `all_categories`.

---

## 📝 Resumen

| Datos | Se pierde | Se puede recuperar | Importancia |
|-------|-----------|-------------------|-------------|
| **Productos** | ✅ | ✅ Sí (re-escaneo) | Media |
| **Conversaciones Chat** | ✅ | ❌ NO | **ALTA** ⚠️ |
| **Analytics** | ✅ | ⚠️ Parcial | Media |
| **Prompts** | ✅ | ⚠️ Depende | Media-Alta |
| **Conexiones** | ✅ | ✅ Sí (re-configurar) | Baja |
| **Documentos** | ✅ | ⚠️ Si tienes backups | Media |
| **Historial Sync** | ✅ | ✅ Sí (se regenera) | Baja |

---

## 🚨 ADVERTENCIA

Si borras `chat_conversations`, perderás:
- Todo el historial de interacciones con usuarios
- Datos de analytics históricos
- Insights sobre qué buscan los usuarios
- **Esto es IRRECUPERABLE**

---

## 🚨 SI DECIDES BORRAR TODA LA BASE DE DATOS

### Scripts creados:

1. **`script-borrar-toda-base-datos.sql`** - Borra TODAS las tablas
2. **`script-recrear-toda-base-datos.sql`** - Recrea todas las tablas desde cero

### Pasos a seguir:

1. **Ejecutar script de borrado:**
   ```sql
   -- Ejecutar script-borrar-toda-base-datos.sql en Supabase SQL Editor
   ```

2. **Ejecutar script de recreación:**
   ```sql
   -- Ejecutar script-recrear-toda-base-datos.sql en Supabase SQL Editor
   ```

3. **Reconfigurar todo:**
   - Configurar conexión PrestaShop en el dashboard
   - Configurar prompts del sistema
   - Volver a subir documentos si los necesitas
   - Escanear productos desde PrestaShop

---

## 💡 Recomendación Final

### ✅ **NO borres toda la base de datos** a menos que sea absolutamente necesario

**Mejor opción: Solo actualizar productos**

1. Ejecuta `supabase-add-all-categories.sql` para agregar la columna
2. Ejecuta la sincronización completa desde el cron (`/api/sync-products-cron.ts`)
3. Los productos se actualizarán automáticamente con `all_categories`
4. **NO pierdes conversaciones, analytics ni configuración**

**Si realmente necesitas empezar de cero con productos:**
```sql
-- Solo borrar productos, mantener todo lo demás
TRUNCATE TABLE products CASCADE;
```

**Pero mantén el resto de las tablas intactas** (conversaciones, analytics, prompts, etc.)

---

## 📋 Checklist antes de borrar toda la BD

Antes de ejecutar `script-borrar-toda-base-datos.sql`, verifica:

- [ ] ¿Tienes backups de los prompts configurados?
- [ ] ¿Tienes backups de los documentos subidos?
- [ ] ¿Tienes anotadas las conexiones PrestaShop (URL, API Key)?
- [ ] ¿Estás seguro de que no necesitas el historial de conversaciones?
- [ ] ¿Estás seguro de que no necesitas los analytics históricos?
- [ ] ¿Tienes tiempo para reconfigurar todo desde cero?

Si respondiste "NO" a alguna de estas preguntas, **NO borres toda la base de datos**.


# 📋 Instrucciones para Actualizar la Base de Datos

## ⚠️ IMPORTANTE: Actualizar Schema de Supabase

Antes de usar las nuevas funcionalidades, necesitas ejecutar el script SQL en Supabase:

### 1. Actualizar el Schema

1. Ve a tu proyecto en Supabase: https://supabase.com/dashboard/project/nfazwtpxrzadzrumqtnz
2. Ve a **SQL Editor**
3. Click en **"New query"**
4. Abre el archivo `supabase-update-schema.sql`
5. Copia TODO el contenido
6. Pégalo en el editor SQL
7. Click en **"Run"**

Esto agregará:
- Columna `date_add` para la fecha de creación en PrestaShop
- Índice para ordenar por fecha

### 2. Limpiar Productos Existentes (Opcional)

Si quieres empezar de cero con las nuevas mejoras:

1. Ve a la pestaña **"Conexiones"** en el dashboard
2. Click en **"Limpiar Base de Datos"** (botón rojo)
3. Confirma la acción
4. Espera a que se eliminen todos los productos

### 3. Reimportar Productos

Después de limpiar:

1. Click en **"Escanear Productos"**
2. Espera a que termine el escaneo
3. Verás todos los productos (ya que la BD está vacía)
4. Click en **"Guardar en Base de Datos"**

## ✨ Mejoras Implementadas

### 1. Categorías Mejoradas
- Ahora se obtienen **TODAS las categorías** de cada producto (no solo la default)
- Las categorías se muestran separadas por comas
- El filtro funciona con múltiples categorías

### 2. Fecha de Creación
- Se obtiene la fecha de creación desde PrestaShop (`date_add`)
- Se muestra en la tabla de productos
- Los productos se ordenan por fecha de creación (más recientes primero)

### 3. Botón Limpiar Base de Datos
- Permite eliminar todos los productos para reimportar desde cero
- Útil para empezar con los nuevos campos

## 🔍 Verificar que Funciona

1. **Categorías**: Deberías ver más de 2 categorías en el filtro
2. **Fecha**: Deberías ver una columna "Fecha Creación" en la tabla
3. **Orden**: Los productos más recientes aparecen primero

## 📝 Notas

- La fecha se obtiene directamente de PrestaShop
- Si un producto no tiene fecha en PrestaShop, se mostrará "-"
- Las categorías se guardan como texto separado por comas (ej: "Categoría 1, Categoría 2")


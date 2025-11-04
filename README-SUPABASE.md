# Configuración de Supabase

## Pasos para configurar Supabase

### 1. Crear cuenta y proyecto en Supabase

1. Ve a [https://supabase.com](https://supabase.com)
2. Crea una cuenta o inicia sesión
3. Crea un nuevo proyecto
4. Anota tu **Project URL** y **anon/public key**

### 2. Crear la tabla en Supabase

1. Ve a tu proyecto en Supabase
2. Navega a **SQL Editor** en el menú lateral
3. Abre el archivo `supabase-schema.sql` de este proyecto
4. Copia y pega todo el contenido en el editor SQL
5. Ejecuta el script (botón "Run")

Esto creará:
- La tabla `products` con todos los campos necesarios
- Índices para búsquedas rápidas
- Políticas RLS (Row Level Security) configuradas

### 3. Configurar variables de entorno en Vercel

1. Ve a tu proyecto en Vercel: https://vercel.com/tres-puntos-projects/chatbot-v2/settings/environment-variables
2. Agrega las siguientes variables de entorno:

   ```
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key-aqui
   ```

3. Para obtener estos valores:
   - Ve a tu proyecto en Supabase
   - Ve a **Settings** > **API**
   - Copia el **Project URL** → `SUPABASE_URL`
   - Copia el **anon/public key** → `SUPABASE_ANON_KEY`

### 4. Redesplegar la aplicación

Después de agregar las variables de entorno, necesitas redesplegar:

```bash
vercel --prod
```

O desde el dashboard de Vercel, haz clic en "Redeploy".

## Estructura de la tabla

La tabla `products` tiene los siguientes campos:

- `id` - BIGSERIAL (auto-incremento)
- `name` - TEXT (nombre del producto)
- `price` - TEXT (precio)
- `category` - TEXT (categoría)
- `description` - TEXT (descripción)
- `sku` - TEXT UNIQUE (SKU único, usado para upsert)
- `image_url` - TEXT (URL de la imagen)
- `product_url` - TEXT (URL del producto en PrestaShop)
- `created_at` - TIMESTAMP (fecha de creación)
- `updated_at` - TIMESTAMP (fecha de actualización)

## Funcionalidades

- **Upsert automático**: Los productos se actualizan si ya existen (basado en SKU)
- **Búsqueda full-text**: Índices para búsqueda rápida por nombre y descripción
- **Búsqueda por categoría**: Índice para filtrar por categoría
- **Actualización automática**: `updated_at` se actualiza automáticamente

## Uso

Una vez configurado:

1. Carga los productos desde PrestaShop en la aplicación
2. Haz clic en el botón **"Guardar en Base de Datos"**
3. Los productos se guardarán/actualizarán en Supabase
4. Podrás consultarlos desde tu IA usando la API de Supabase

## Consulta desde IA

Para consultar los productos desde tu IA, puedes usar:

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

// Buscar productos por nombre
const { data } = await supabase
  .from('products')
  .select('*')
  .ilike('name', `%${searchTerm}%`)
  .limit(10);

// Búsqueda full-text
const { data } = await supabase
  .from('products')
  .select('*')
  .textSearch('name', searchTerm)
  .limit(10);
```


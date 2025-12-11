# Ejecutar SQL en Supabase - Instrucciones

## ⚠️ Limitación del MCP de Supabase

El MCP (Model Context Protocol) de Supabase **no puede ejecutar comandos DDL** (ALTER TABLE, CREATE INDEX, etc.) directamente. Solo puede ejecutar consultas SELECT a través de PostgREST.

## ✅ Opciones para Ejecutar el SQL

### Opción 1: Ejecutar Manualmente en Supabase Dashboard (RECOMENDADO)

1. Ve a [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecciona tu proyecto
3. Ve a **SQL Editor** (en el menú lateral)
4. Copia y pega el contenido del archivo: `supabase-add-last-indexed-at.sql`
5. Haz clic en **Run** o presiona `Ctrl+Enter` (o `Cmd+Enter` en Mac)

**Archivo a ejecutar:** `supabase-add-last-indexed-at.sql`

### Opción 2: Usar Supabase CLI (si está configurado)

```bash
# Si tienes Supabase CLI configurado localmente
supabase db push

# O ejecutar la migración directamente
supabase migration up
```

### Opción 3: Usar el Script Node.js (requiere credenciales)

```bash
# Configurar variables de entorno
export SUPABASE_URL="https://tu-proyecto.supabase.co"
export SUPABASE_SERVICE_ROLE_KEY="tu-service-role-key"

# Ejecutar el script
node scripts/execute-add-last-indexed-at.js
```

**Nota:** Este script requiere acceso a la API de Management de Supabase, que puede requerir un access token adicional.

## 📋 Contenido del SQL a Ejecutar

El archivo `supabase-add-last-indexed-at.sql` contiene:

1. **ALTER TABLE**: Añade la columna `last_indexed_at`
2. **CREATE INDEX**: Crea índice para búsquedas rápidas
3. **UPDATE**: Marca productos ya indexados
4. **COMMENT**: Añade documentación a la columna

## ✅ Verificación

Después de ejecutar el SQL, verifica que funcionó:

```sql
-- Verificar que la columna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'products' 
AND column_name = 'last_indexed_at';

-- Verificar cuántos productos están marcados como indexados
SELECT 
  COUNT(*) as total,
  COUNT(last_indexed_at) as indexados,
  COUNT(*) - COUNT(last_indexed_at) as pendientes
FROM products;
```

## 🚀 Después de Ejecutar

Una vez ejecutado el SQL:
1. El script de indexación (`api/index-products-rag-auto.ts`) usará automáticamente la nueva columna
2. El cron job continuará indexando productos automáticamente
3. No necesitas hacer nada más, todo funcionará automáticamente


# Solución: Error de Dimensiones en pgvector

## ❌ Error Encontrado

```
ERROR: 54000: column cannot have more than 2000 dimensions for hnsw index
```

## 🔍 Causa del Problema

Supabase tiene un límite de **2000 dimensiones** para índices HNSW en pgvector. Estábamos usando:
- `text-embedding-3-large` con **3072 dimensiones** ❌

## ✅ Solución Aplicada

Cambiamos a `text-embedding-3-small` con **1536 dimensiones**, que:
- ✅ Está dentro del límite de Supabase (< 2000)
- ✅ Mantiene excelente calidad de embeddings
- ✅ Es más rápido y económico
- ✅ Suficiente para búsqueda semántica de productos

## 📝 Archivos Actualizados

1. ✅ `supabase/migrations/002_create_embeddings_table.sql` - Cambiado a `vector(1536)`
2. ✅ `supabase/migrations/003_create_similarity_search_function.sql` - Cambiado a `vector(1536)`
3. ✅ `api/utils/embeddings.ts` - Cambiado a `text-embedding-3-small`
4. ✅ `api/utils/langchain-setup.ts` - Cambiado a `text-embedding-3-small`

## 🔄 Qué Hacer Ahora

### Si ya ejecutaste las migraciones anteriores:

1. **Eliminar la tabla existente** (si la creaste):
   ```sql
   DROP TABLE IF EXISTS product_embeddings CASCADE;
   ```

2. **Ejecutar las migraciones actualizadas**:
   - `001_enable_pgvector.sql`
   - `002_create_embeddings_table.sql` (actualizado)
   - `003_create_similarity_search_function.sql` (actualizado)

### Si aún no has ejecutado las migraciones:

Simplemente ejecuta las migraciones actualizadas en orden:
1. `001_enable_pgvector.sql`
2. `002_create_embeddings_table.sql`
3. `003_create_similarity_search_function.sql`

## 📊 Comparación de Modelos

| Modelo | Dimensiones | Calidad | Velocidad | Costo | Compatible Supabase |
|--------|-------------|---------|-----------|-------|---------------------|
| text-embedding-3-large | 3072 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐ | ❌ |
| text-embedding-3-small | 1536 | ⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ✅ |

**Conclusión**: `text-embedding-3-small` es la mejor opción para este caso de uso.

## ✅ Validación

Después de ejecutar las migraciones actualizadas, verifica:

```sql
-- Verificar que la tabla tiene la dimensión correcta
SELECT 
  column_name, 
  data_type,
  udt_name
FROM information_schema.columns 
WHERE table_name = 'product_embeddings' 
AND column_name = 'embedding';

-- Deberías ver: vector(1536)
```

## 💡 Nota

`text-embedding-3-small` con 1536 dimensiones es más que suficiente para búsqueda semántica de productos. La diferencia de calidad con `text-embedding-3-large` es mínima para este caso de uso, pero los beneficios en velocidad y costo son significativos.


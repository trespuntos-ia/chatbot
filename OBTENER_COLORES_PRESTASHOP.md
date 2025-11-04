# 📋 Cómo Obtener Colores de Productos desde PrestaShop

## Problema Actual

Actualmente, la API **NO** está obteniendo información sobre colores de los productos. Los colores en PrestaShop se almacenan en las **combinaciones** (combinations) de atributos, que requieren consultas adicionales.

## Solución

Para obtener los colores de los productos, necesitamos:

### Opción 1: Consultar Combinaciones por Producto (Recomendado)

1. **Obtener combinaciones de cada producto:**
   ```
   GET /api/products/{id}/combinations
   ```

2. **Para cada combinación, obtener sus atributos:**
   ```
   GET /api/combinations/{combination_id}
   ```

3. **Extraer el color de los atributos:**
   - Buscar el atributo con `id_attribute_group` correspondiente a "Color"
   - Extraer el nombre del color desde `id_attribute`

### Opción 2: Incluir en la consulta principal (si PrestaShop lo permite)

Modificar la consulta de productos para incluir información de combinaciones:
```javascript
display: '[id,id_default_image,name,price,reference,link_rewrite,ean13,id_category_default,description_short,associations]'
```

Y luego procesar `associations.combinations` si está disponible.

### Opción 3: Extraer colores de la descripción o nombre

Si los colores están mencionados en el nombre o descripción del producto, podemos extraerlos usando expresiones regulares.

## Implementación Sugerida

1. **Crear función auxiliar** en `api/prestashop-proxy.ts` o crear nuevo endpoint:
   ```typescript
   async function getProductColors(productId: number, config: ApiConfig): Promise<string[]> {
     // Consultar combinaciones
     // Extraer colores
     // Devolver array de nombres de colores
   }
   ```

2. **Modificar el proceso de obtención de productos** para incluir colores:
   - Opción A: Consultar colores durante la obtención inicial (más lento, pero completo)
   - Opción B: Consultar colores bajo demanda cuando se necesiten (más rápido, pero lazy)

3. **Actualizar el tipo Product** para incluir `colors?: string[]`

4. **Mostrar colores en ProductCard** como badges o chips

## Nota Importante

⚠️ **Consideración de rendimiento**: Consultar combinaciones para cada producto puede ser muy lento si hay muchos productos. Se recomienda:
- Hacerlo en lotes
- Cachear resultados
- O hacerlo de forma asíncrona después de obtener los productos básicos

## Endpoint de PrestaShop para Combinaciones

```
GET /api/products/{id}/combinations?ws_key={api_key}&output_format=JSON
```

Respuesta ejemplo:
```json
{
  "combinations": {
    "combination": [
      {
        "id": "123",
        "associations": {
          "product_option_values": {
            "product_option_value": [
              {
                "id": "456"
              }
            ]
          }
        }
      }
    ]
  }
}
```

Luego necesitarías consultar el `product_option_value` para obtener el nombre del color.


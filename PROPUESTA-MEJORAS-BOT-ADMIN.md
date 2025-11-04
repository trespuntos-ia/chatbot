# 🚀 PROPUESTA: Mejoras para Chatbot y Panel de Administración

## 🎯 Objetivo
Definir funcionalidades para mejorar tanto la experiencia del usuario en el chat como las capacidades del panel de administración, con el objetivo de crear un producto comercializable para instalar en múltiples webs.

---

## 📋 ÍNDICE
1. [Mejoras del Chatbot](#1-mejoras-del-chatbot)
2. [Mejoras del Panel Admin](#2-mejoras-del-panel-admin)
3. [Lista de Funcionalidades con Dificultad](#3-lista-de-funcionalidades-con-dificultad)

---

## 1. MEJORAS DEL CHATBOT

### 🎨 Enfoque Principal: Mejora en la Presentación de Respuestas

El objetivo es hacer que las respuestas del bot sean más visuales, interactivas y útiles, especialmente cuando se trata de mostrar productos.

---

### 1.1 Tarjetas de Productos en Respuestas

**Descripción:**
Cuando el bot encuentra un producto que el usuario está buscando, en lugar de solo mostrar texto, mostrar una tarjeta visual atractiva con:

- **Imagen del producto** (thumbnail)
- **Nombre del producto**
- **Precio** destacado
- **Descripción corta** (primeras 2-3 líneas)
- **Botón "Ver Producto"** que lleva al link de compra
- **Botón "Añadir al Carrito"** - Añade directamente al carrito de PrestaShop
- **Botón "Comprar Ahora"** (opcional, directo al checkout si es posible)
- **SKU** (opcional, en texto pequeño)

**Opciones de Interacción:**
- **Opción A (Recomendada)**: Click en botón "Añadir al Carrito" → Añade al carrito
- **Opción B (Avanzada)**: Click en toda la tarjeta → Añade al carrito (con confirmación)
- **Opción C (Híbrida)**: Click en tarjeta → Ver detalles, Botón específico → Añadir al carrito

**Casos de uso:**
- Usuario pregunta: "¿Tienes aceite de oliva?"
- Usuario pregunta: "Muéstrame productos de cocina"
- Usuario pregunta: "¿Cuál es el precio del producto ABC123?"

**Ejemplo de respuesta:**
```
Bot: "¡Sí! Encontré estos productos que pueden interesarte:"

[Mostrar 1-3 tarjetas de productos en grid horizontal]

"¿Te gustaría saber más sobre algún producto en particular?"
```

**Ventajas:**
- Mejora significativamente la experiencia visual
- Facilita la conversión (botones directos)
- Hace el chat más profesional y moderno
- Reduce fricción para llegar al producto
- **Añadir al carrito directamente aumenta conversión significativamente**

---

### 1.1.1 Añadir al Carrito desde Tarjeta (NUEVA FUNCIONALIDAD)

**Descripción:**
Permitir añadir productos al carrito de PrestaShop directamente desde las tarjetas del chat, sin salir de la conversación.

**¿Es buena funcionalidad?** 
✅ **SÍ, muy buena** - Aumenta significativamente la conversión porque:
- Reduce fricción (no tiene que buscar el producto manualmente)
- Impulso de compra (el usuario está en "modo compra" cuando consulta)
- Experiencia fluida (todo desde el chat)
- Reduce abandono de carrito

**⚠️ Consideraciones de UX:**
- **NO hacer click en toda la tarjeta** = añadir al carrito (riesgo de añadir accidentalmente)
- **SÍ hacer botón específico** "Añadir al Carrito" (más seguro)
- Mostrar confirmación visual después de añadir ("✓ Añadido al carrito")
- Opción de "Ver carrito" o continuar navegando

**Requisitos Técnicos:**

1. **API de PrestaShop para añadir al carrito:**
   - PrestaShop tiene API REST pero añadir al carrito requiere:
     - **Opción 1 (Recomendada)**: Usar el endpoint de PrestaShop vía AJAX
       - Endpoint: `POST /index.php?controller=cart&action=add`
       - Parámetros: `id_product`, `id_product_attribute`, `qty`, `token` (CSRF)
     - **Opción 2**: Usar la API REST de PrestaShop (si está disponible en la versión)
       - Requiere autenticación y manejo de sesiones
     - **Opción 3**: Integración con JavaScript nativo de PrestaShop
       - Si el chat está embebido en la web, puede usar el JavaScript de PrestaShop

2. **Manejo de Sesión:**
   - PrestaShop usa sesiones PHP/cookies para identificar el carrito
   - Necesitamos mantener la sesión del usuario
   - Si el chat está en iframe o widget, necesitamos compartir cookies

3. **Frontend (Componente React/JS):**
   
   **Función completa para añadir al carrito:**
   ```typescript
   // types.ts - Tipos necesarios
   interface AddToCartParams {
     productId: number;
     quantity?: number;
     productAttributeId?: number; // Para variantes (tallas, colores)
     prestashopUrl: string;
     csrfToken?: string;
   }
   
   interface AddToCartResponse {
     success: boolean;
     message?: string;
     error?: string;
     cartCount?: number;
   }
   
   // Función para obtener token CSRF (si es necesario)
   async function getCsrfToken(prestashopUrl: string): Promise<string | null> {
     try {
       const response = await fetch(`${prestashopUrl}/index.php`, {
         credentials: 'include',
       });
       const html = await response.text();
       // Extraer token del HTML (depende de cómo PrestaShop lo genere)
       const match = html.match(/token['"]\s*:\s*['"]([^'"]+)['"]/);
       return match ? match[1] : null;
     } catch (error) {
       console.error('Error obteniendo token CSRF:', error);
       return null;
     }
   }
   
   // Función principal para añadir al carrito
   async function addToCart(params: AddToCartParams): Promise<AddToCartResponse> {
     const {
       productId,
       quantity = 1,
       productAttributeId,
       prestashopUrl,
       csrfToken,
     } = params;
   
     try {
       // Obtener token CSRF si no se proporciona
       let token = csrfToken;
       if (!token) {
         token = await getCsrfToken(prestashopUrl) || '';
       }
   
       // Preparar parámetros
       const bodyParams = new URLSearchParams({
         id_product: productId.toString(),
         qty: quantity.toString(),
         token: token,
       });
   
       // Añadir atributo de producto si existe (variantes)
       if (productAttributeId) {
         bodyParams.append('id_product_attribute', productAttributeId.toString());
       }
   
       // Realizar petición a PrestaShop
       const response = await fetch(
         `${prestashopUrl}/index.php?controller=cart&action=add&ajax=1`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
             'X-Requested-With': 'XMLHttpRequest', // Para identificar como AJAX
           },
           credentials: 'include', // CRÍTICO: Para mantener cookies de sesión
           body: bodyParams,
         }
       );
   
       if (!response.ok) {
         throw new Error(`HTTP error! status: ${response.status}`);
       }
   
       const data = await response.json();
   
       // PrestaShop devuelve diferentes formatos según la versión
       // Ajustar según la respuesta real
       if (data.hasError === false || data.success) {
         return {
           success: true,
           message: 'Producto añadido al carrito',
           cartCount: data.cart?.products_count || data.productsCount,
         };
       } else {
         return {
           success: false,
           error: data.errors?.[0] || data.message || 'Error desconocido',
         };
       }
     } catch (error) {
       console.error('Error añadiendo al carrito:', error);
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Error al añadir al carrito',
       };
     }
   }
   
   // Hook de React para usar en componentes
   import { useState, useCallback } from 'react';
   
   export function useAddToCart(prestashopUrl: string) {
     const [loading, setLoading] = useState(false);
     const [error, setError] = useState<string | null>(null);
   
     const addProduct = useCallback(
       async (
         productId: number,
         quantity: number = 1,
         productAttributeId?: number
       ) => {
         setLoading(true);
         setError(null);
   
         try {
           const result = await addToCart({
             productId,
             quantity,
             productAttributeId,
             prestashopUrl,
           });
   
           if (result.success) {
             // Mostrar notificación de éxito
             // Puedes usar tu sistema de notificaciones (toast, etc.)
             return { success: true, cartCount: result.cartCount };
           } else {
             setError(result.error || 'Error al añadir al carrito');
             return { success: false, error: result.error };
           }
         } catch (err) {
           const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
           setError(errorMessage);
           return { success: false, error: errorMessage };
         } finally {
           setLoading(false);
         }
       },
       [prestashopUrl]
     );
   
     return { addProduct, loading, error };
   }
   
   // Ejemplo de uso en componente React
   function ProductCard({ product, prestashopUrl }: { product: Product; prestashopUrl: string }) {
     const { addProduct, loading } = useAddToCart(prestashopUrl);
     const [added, setAdded] = useState(false);
   
     const handleAddToCart = async () => {
       const result = await addProduct(product.id, 1);
       if (result.success) {
         setAdded(true);
         // Mostrar confirmación visual
         setTimeout(() => setAdded(false), 3000);
       }
     };
   
     return (
       <div className="product-card">
         <img src={product.image_url} alt={product.name} />
         <h3>{product.name}</h3>
         <p className="price">{product.price}</p>
         <button
           onClick={handleAddToCart}
           disabled={loading || added}
           className={added ? 'added' : ''}
         >
           {loading ? 'Añadiendo...' : added ? '✓ Añadido' : 'Añadir al Carrito'}
         </button>
       </div>
     );
   }
   ```
   
   **Alternativa: Usando API Proxy (Recomendado para producción):**
   ```typescript
   // Si prefieres usar tu propio backend como proxy
   async function addToCartViaProxy(
     productId: number,
     quantity: number = 1,
     productAttributeId?: number
   ): Promise<AddToCartResponse> {
     try {
       const response = await fetch('/api/cart/add', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
         },
         credentials: 'include',
         body: JSON.stringify({
           productId,
           quantity,
           productAttributeId,
         }),
       });
   
       const data = await response.json();
       return data;
     } catch (error) {
       return {
         success: false,
         error: error instanceof Error ? error.message : 'Error desconocido',
       };
     }
   }
   ```

4. **Backend (API Proxy - Opcional pero recomendado):**
   
   **Código del endpoint API (Vercel/Serverless):**
   ```typescript
   // api/cart-add.ts (Vercel Serverless Function)
   import type { VercelRequest, VercelResponse } from '@vercel/node';
   
   export default async function handler(
     req: VercelRequest,
     res: VercelResponse
   ) {
     // Permitir CORS
     res.setHeader('Access-Control-Allow-Credentials', 'true');
     res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
     res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
     res.setHeader(
       'Access-Control-Allow-Headers',
       'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
     );
   
     // Manejar preflight
     if (req.method === 'OPTIONS') {
       res.status(200).end();
       return;
     }
   
     if (req.method !== 'POST') {
       res.status(405).json({ error: 'Method not allowed' });
       return;
     }
   
     try {
       const { productId, quantity = 1, productAttributeId, prestashopUrl } = req.body;
   
       if (!productId || !prestashopUrl) {
         res.status(400).json({ 
           success: false,
           error: 'productId y prestashopUrl son requeridos' 
         });
         return;
       }
   
       // Obtener token CSRF de PrestaShop
       const csrfResponse = await fetch(`${prestashopUrl}/index.php`, {
         headers: {
           'Cookie': req.headers.cookie || '', // Pasar cookies de sesión
         },
       });
       
       const csrfHtml = await csrfResponse.text();
       const csrfMatch = csrfHtml.match(/token['"]\s*:\s*['"]([^'"]+)['"]/);
       const csrfToken = csrfMatch ? csrfMatch[1] : '';
   
       // Preparar parámetros para añadir al carrito
       const params = new URLSearchParams({
         id_product: productId.toString(),
         qty: quantity.toString(),
         token: csrfToken,
       });
   
       if (productAttributeId) {
         params.append('id_product_attribute', productAttributeId.toString());
       }
   
       // Realizar petición a PrestaShop
       const cartResponse = await fetch(
         `${prestashopUrl}/index.php?controller=cart&action=add&ajax=1`,
         {
           method: 'POST',
           headers: {
             'Content-Type': 'application/x-www-form-urlencoded',
             'X-Requested-With': 'XMLHttpRequest',
             'Cookie': req.headers.cookie || '', // Pasar cookies de sesión
           },
           body: params,
         }
       );
   
       if (!cartResponse.ok) {
         throw new Error(`PrestaShop error: ${cartResponse.status}`);
       }
   
       const cartData = await cartResponse.json();
   
       // Retornar respuesta estructurada
       if (cartData.hasError === false || cartData.success) {
         res.status(200).json({
           success: true,
           message: 'Producto añadido al carrito',
           cartCount: cartData.cart?.products_count || cartData.productsCount,
           data: cartData,
         });
       } else {
         res.status(400).json({
           success: false,
           error: cartData.errors?.[0] || cartData.message || 'Error desconocido',
           data: cartData,
         });
       }
     } catch (error) {
       console.error('Error añadiendo al carrito:', error);
       res.status(500).json({
         success: false,
         error: error instanceof Error ? error.message : 'Error al añadir al carrito',
       });
     }
   }
   ```
   
   **Alternativa con Laravel (si usas backend Laravel):**
   ```php
   // app/Http/Controllers/CartController.php
   namespace App\Http\Controllers;
   
   use Illuminate\Http\Request;
   use Illuminate\Http\JsonResponse;
   use GuzzleHttp\Client;
   
   class CartController extends Controller
   {
       public function addToCart(Request $request): JsonResponse
       {
           $request->validate([
               'product_id' => 'required|integer',
               'quantity' => 'integer|min:1',
               'product_attribute_id' => 'integer|nullable',
           ]);
   
           $prestashopUrl = session('prestashop_url') ?? $request->input('prestashop_url');
           $productId = $request->input('product_id');
           $quantity = $request->input('quantity', 1);
           $productAttributeId = $request->input('product_attribute_id');
   
           try {
               $client = new Client([
                   'cookies' => true,
                   'allow_redirects' => true,
               ]);
   
               // Obtener token CSRF
               $csrfResponse = $client->get("{$prestashopUrl}/index.php");
               $csrfHtml = $csrfResponse->getBody()->getContents();
               preg_match('/token["\']\s*:\s*["\']([^"\']+)["\']/', $csrfHtml, $matches);
               $csrfToken = $matches[1] ?? '';
   
               // Preparar parámetros
               $params = [
                   'id_product' => $productId,
                   'qty' => $quantity,
                   'token' => $csrfToken,
               ];
   
               if ($productAttributeId) {
                   $params['id_product_attribute'] = $productAttributeId;
               }
   
               // Añadir al carrito
               $response = $client->post(
                   "{$prestashopUrl}/index.php?controller=cart&action=add&ajax=1",
                   [
                       'form_params' => $params,
                       'headers' => [
                           'X-Requested-With' => 'XMLHttpRequest',
                       ],
                   ]
               );
   
               $data = json_decode($response->getBody()->getContents(), true);
   
               if (isset($data['hasError']) && $data['hasError'] === false) {
                   return response()->json([
                       'success' => true,
                       'message' => 'Producto añadido al carrito',
                       'cart_count' => $data['cart']['products_count'] ?? null,
                       'data' => $data,
                   ]);
               } else {
                   return response()->json([
                       'success' => false,
                       'error' => $data['errors'][0] ?? 'Error desconocido',
                       'data' => $data,
                   ], 400);
               }
           } catch (\Exception $e) {
               return response()->json([
                   'success' => false,
                   'error' => $e->getMessage(),
               ], 500);
           }
       }
   }
   
   // routes/api.php
   Route::post('/cart/add', [CartController::class, 'addToCart']);
   ```

5. **Token CSRF:**
   - PrestaShop requiere token CSRF para seguridad
   - Necesitamos obtenerlo del frontend o generarlo
   - Se puede obtener del HTML de la página o vía API

6. **Variables/Atributos del Producto:**
   - Si el producto tiene variantes (tallas, colores), necesitamos:
     - `id_product_attribute` además de `id_product`
     - Mostrar selector de variantes antes de añadir

**Implementación Sugerida:**

**Fase 1 - Básico:**
- Botón "Añadir al Carrito" en cada tarjeta
- Click → Añade producto (cantidad 1)
- Muestra confirmación visual
- Si hay error, muestra mensaje

**Fase 2 - Avanzado:**
- Selector de cantidad antes de añadir
- Manejo de variantes (tallas, colores)
- Actualización en tiempo real del contador del carrito
- Botón "Ver Carrito" después de añadir

**Fase 3 - Premium:**
- Añadir múltiples productos a la vez
- Sugerencias de productos relacionados después de añadir
- "¿Añadir también...?" después de añadir un producto

**Dificultad:** 🟡 **Media-Alta**
- Requiere integración con PrestaShop (API o endpoints)
- Manejo de sesiones/cookies
- Tokens CSRF
- Manejo de errores robusto

**Valor:** 🔥🔥🔥🔥🔥 **Muy Alto**
- Aumenta conversión significativamente
- Diferenciador clave vs otros chatbots
- Experiencia de usuario premium

**Alternativa si es muy complejo:**
- En lugar de añadir directamente, usar link especial:
  - `https://tienda.com/producto?id_product=123&add=1`
  - Esto añade al carrito y redirige (más simple pero menos fluido)

---

### 1.2 Respuestas con Múltiples Productos (Grid)

**Descripción:**
Cuando hay múltiples productos que coinciden, mostrarlos en un grid de tarjetas (2-3 columnas según el tamaño de pantalla).

**Características:**
- Máximo 6 productos mostrados inicialmente
- Botón "Ver más productos" si hay más resultados
- Scroll horizontal en móvil
- Grid responsive (2 columnas en móvil, 3 en desktop)

---

### 1.3 Comparación de Productos

**Descripción:**
Si el usuario pregunta por comparaciones ("¿Cuál es mejor entre X e Y?"), mostrar tarjetas lado a lado para comparar.

**Ejemplo:**
```
Usuario: "¿Qué diferencia hay entre el aceite de oliva virgen extra y el normal?"

Bot: [Mostrar 2 tarjetas lado a lado con información comparativa]
```

---

### 1.4 Respuestas con Imágenes Contextuales

**Descripción:**
No solo productos, sino también:
- Imágenes de categorías cuando se habla de ellas
- Diagramas o infografías cuando se explica algo complejo
- GIFs animados para instrucciones paso a paso

---

### 1.5 Botones de Acción Rápida

**Descripción:**
Después de mostrar un producto, ofrecer botones de acción rápida:
- "Ver detalles completos"
- "Añadir al carrito"
- "Comparar con otros"
- "¿Tienes más preguntas?"

Esto hace el chat más interactivo y reduce la necesidad de escribir.

---

### 1.6 Feedback de Utilidad

**Descripción:**
Al finalizar una conversación (después de X mensajes o cuando el usuario cierra el chat), mostrar un popup discreto:

**Pregunta:** "¿Te ha resultado útil esta conversación?"
**Opciones:**
- 👍 Sí
- 👎 No  
- ⚠️ Más o menos

Si responde negativamente, opcionalmente pedir:
- "¿Qué podríamos mejorar?" (campo de texto opcional)

**Características:**
- No intrusivo (se puede cerrar sin responder)
- Solo se muestra una vez por conversación
- Guarda el feedback en la base de datos para estadísticas

---

### 1.7 Respuestas con Formato Enriquecido

**Descripción:**
Mejorar el formato de las respuestas de texto:
- **Negrita** para destacar información importante
- Listas numeradas o con viñetas
- Código formateado para SKUs, precios, etc.
- Emojis contextuales (💰 para precios, 📦 para productos, etc.)

---

### 1.8 Indicador de "Escribiendo..."

**Descripción:**
Mostrar un indicador visual cuando el bot está procesando la respuesta (especialmente útil si tarda unos segundos).

**Animación:**
- Puntos animados "..." o
- Indicador de "Pensando..." con animación

---

### 1.9 Sugerencias de Preguntas

**Descripción:**
Después de una respuesta, mostrar sugerencias de preguntas relacionadas como botones clickeables:

**Ejemplo:**
```
Bot: "Encontré 5 productos de aceite de oliva. ¿Te gustaría ver más detalles?"

[Botones sugeridos:]
- "¿Cuál es el más barato?"
- "Muéstrame el más vendido"
- "¿Tienes descuentos?"
```

---

### 1.10 Historial de Conversación Visible

**Descripción:**
Mostrar un pequeño historial de la conversación actual (últimos 3-5 mensajes) con posibilidad de:
- Hacer clic en un mensaje anterior para ver el contexto
- Copiar mensajes
- Reenviar una pregunta

---

## 2. MEJORAS DEL PANEL ADMIN

### 2.1 Panel de Nivel de Conocimiento del Bot

**Descripción:**
Dashboard que muestra visualmente cómo evoluciona el conocimiento del bot basado en las conversaciones.

**Métricas:**
- **Total de conversaciones** procesadas
- **Tasa de éxito de respuestas** (basado en feedback)
- **Nivel de conocimiento** (0-100%): Calculado con:
  - Número de preguntas únicas respondidas
  - Tasa de satisfacción promedio
  - Cobertura de temas (categorías consultadas)
  - Resolución de consultas
- **Evolución temporal**: Gráfico de línea (últimos 30 días)
- **Temas más consultados**: Lista de categorías frecuentes
- **Áreas de mejora**: Temas con baja satisfacción

**Visualización:**
- Cards de métricas principales
- Gráfico de evolución temporal
- Indicador de progreso visual (barra circular)
- Lista de temas con nivel de conocimiento

---

### 2.2 Panel de Preguntas Más Repetidas

**Descripción:**
Identificar las preguntas más frecuentes para mejorar el bot y optimizar respuestas.

**Funcionalidades:**
- **Top 20 preguntas más frecuentes** con:
  - Texto de la pregunta
  - Número de veces formulada
  - Tasa de satisfacción asociada
  - Tiempo promedio de respuesta
  - Categoría/tema asociado
- **Filtros:**
  - Por rango de fechas
  - Por categoría de producto
  - Por nivel de satisfacción
- **Agrupación inteligente**: Agrupar preguntas similares (NLP)
- **Exportación**: CSV/JSON
- **Acciones rápidas:**
  - Ver conversaciones relacionadas
  - Marcar como "optimizar respuesta"
  - Añadir a FAQ

**Visualización:**
- Tabla ordenable con ranking
- Gráfico de barras horizontal
- Nube de palabras
- Filtros y búsqueda

---

### 2.3 Panel de Conversiones (Respuestas → Compra)

**Descripción:**
Medir la efectividad del bot en términos de conversión a ventas.

**Métricas:**
- **Tasa de conversión general**: % de usuarios que compran después del chat
- **Número promedio de respuestas hasta compra**: Distribución
- **Funnel de conversión**:
  - Usuarios que iniciaron chat
  - Usuarios que recibieron respuesta útil
  - Usuarios que visitaron producto
  - Usuarios que añadieron al carrito
  - Usuarios que completaron compra
- **Productos más consultados antes de compra**
- **Tiempo promedio hasta compra**
- **Valor promedio de compra** tras usar el chat

**Funcionalidades:**
- **Marcado manual**: Marcar conversaciones que resultaron en compra
- **Integración con PrestaShop**: Tracking automático (si es posible)
- **Segmentación**: Por categoría, tipo de pregunta, hora, día

**Visualización:**
- Dashboard con métricas principales
- Gráfico de funnel
- Gráfico de distribución de respuestas hasta compra
- Tabla de productos más vendidos tras consulta
- Gráficos de evolución temporal

---

### 2.4 Editor Visual de Respuestas

**Descripción:**
Permitir al admin editar o crear respuestas personalizadas para preguntas frecuentes.

**Funcionalidades:**
- Editor WYSIWYG para respuestas
- Inserción de productos en respuestas
- Plantillas de respuestas
- Preview de cómo se verá la respuesta
- A/B testing de respuestas

---

### 2.5 Configuración de Comportamiento del Chat

**Descripción:**
Panel de configuración para personalizar el comportamiento del bot:
- Tiempo antes de mostrar feedback
- Número de productos a mostrar por defecto
- Estilo de las tarjetas (colores, tamaño)
- Habilitar/deshabilitar sugerencias
- Configurar mensajes de bienvenida

---

## 3. LISTA DE FUNCIONALIDADES CON DIFICULTAD

### 📊 Tabla de Funcionalidades

| # | Funcionalidad | Categoría | Dificultad | Prioridad | Estado | Notas |
|---|---------------|-----------|------------|-----------|--------|-------|
| 1 | **Tarjetas de productos en respuestas** | Chat - Presentación | 🟡 Media | 🔴 Alta | ❌ No implementado | Mostrar productos encontrados como tarjetas con imagen, info y link |
| 1.1 | **Añadir al carrito desde tarjeta** | Chat - Conversión | 🟡 Media-Alta | 🔴 Alta | ❌ No implementado | Botón para añadir producto al carrito directamente desde el chat |
| 2 | **Grid de múltiples productos** | Chat - Presentación | 🟡 Media | 🔴 Alta | ❌ No implementado | Grid responsive para mostrar varios productos |
| 3 | **Comparación de productos** | Chat - Presentación | 🟠 Alta | 🟡 Media | ❌ No implementado | Mostrar productos lado a lado para comparar |
| 4 | **Imágenes contextuales** | Chat - Presentación | 🟢 Baja | 🟡 Media | ❌ No implementado | Imágenes de categorías, diagramas, etc. |
| 5 | **Botones de acción rápida** | Chat - Interacción | 🟢 Baja | 🔴 Alta | ❌ No implementado | Botones "Ver detalles", "Añadir al carrito", etc. |
| 6 | **Feedback de utilidad** | Chat - Analytics | 🟢 Baja | 🔴 Alta | ❌ No implementado | Popup al finalizar conversación |
| 7 | **Formato enriquecido en respuestas** | Chat - Presentación | 🟢 Baja | 🟡 Media | ❌ No implementado | Negrita, listas, emojis, código formateado |
| 8 | **Indicador "Escribiendo..."** | Chat - UX | 🟢 Baja | 🟡 Media | ❌ No implementado | Animación mientras procesa |
| 9 | **Sugerencias de preguntas** | Chat - Interacción | 🟡 Media | 🟡 Media | ❌ No implementado | Botones con preguntas sugeridas |
| 10 | **Historial de conversación** | Chat - UX | 🟡 Media | 🟡 Media | ❌ No implementado | Mostrar últimos mensajes con acciones |
| 11 | **Panel de nivel de conocimiento** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Dashboard con métricas de conocimiento |
| 12 | **Panel de preguntas repetidas** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Top preguntas con filtros y análisis |
| 13 | **Panel de conversiones** | Admin - Analytics | 🟠 Alta | 🔴 Alta | ❌ No implementado | Tracking de respuestas → compra |
| 14 | **Editor visual de respuestas** | Admin - Configuración | 🟠 Alta | 🟡 Media | ❌ No implementado | Editor WYSIWYG para personalizar respuestas |
| 15 | **Configuración de comportamiento** | Admin - Configuración | 🟡 Media | 🟡 Media | ❌ No implementado | Panel para configurar comportamiento del bot |

---

### 📝 Leyenda

**Dificultad:**
- 🟢 **Baja**: Implementación sencilla, < 1 día
- 🟡 **Media**: Requiere varias partes, 2-4 días
- 🟠 **Alta**: Complejo, requiere múltiples componentes, 5+ días

**Prioridad:**
- 🔴 **Alta**: Funcionalidad core, impacta directamente en la experiencia
- 🟡 **Media**: Mejora la experiencia pero no es crítica
- 🟢 **Baja**: Nice to have, puede esperar

**Estado:**
- ✅ **Implementado**: Completado y funcionando
- 🚧 **En progreso**: Actualmente en desarrollo
- ❌ **No implementado**: Pendiente de implementar

---

## 4. PRIORIZACIÓN SUGERIDA

### Fase 1 - MVP Core (Semanas 1-2)
1. Tarjetas de productos en respuestas (#1)
2. Grid de múltiples productos (#2)
3. Botones de acción rápida (#5)
4. Feedback de utilidad (#6)
5. Panel de nivel de conocimiento (#11)
6. Panel de preguntas repetidas (#12)
7. Panel de conversiones (#13)

### Fase 2 - Mejoras UX (Semanas 3-4)
1. Formato enriquecido (#7)
2. Indicador "Escribiendo..." (#8)
3. Sugerencias de preguntas (#9)
4. Historial de conversación (#10)

### Fase 3 - Funcionalidades Avanzadas (Semanas 5-6)
1. Comparación de productos (#3)
2. Imágenes contextuales (#4)
3. Editor visual de respuestas (#14)
4. Configuración de comportamiento (#15)

---

## 5. CONSIDERACIONES TÉCNICAS

### 5.1 Para las Tarjetas de Productos

**Requisitos:**
- El bot debe detectar cuando encuentra productos en la respuesta
- Necesita extraer datos del producto (imagen, precio, URL, etc.)
- Formato de respuesta estructurado (JSON o similar) para que el frontend pueda renderizar tarjetas
- Componente React/Vue para renderizar las tarjetas

**Implementación sugerida:**
- El bot devuelve un objeto estructurado además del texto
- El frontend detecta si hay productos en la respuesta
- Renderiza tarjetas en lugar de solo texto
- Fallback a texto si no hay estructura

### 5.2 Para el Sistema de Analytics

**Requisitos:**
- Base de datos para almacenar conversaciones y mensajes
- Tracking de eventos (feedback, clicks, compras)
- APIs para consultar estadísticas
- Componentes de visualización (gráficos, tablas)

**Estructura sugerida:**
- Tabla `conversations` - Sesiones de chat
- Tabla `messages` - Mensajes individuales
- Tabla `questions_analytics` - Preguntas analizadas
- Tabla `bot_knowledge_metrics` - Métricas diarias
- Tabla `conversation_products` - Productos consultados/completados

---

## 6. PRÓXIMOS PASOS

1. **Revisar y priorizar** esta lista de funcionalidades
2. **Confirmar qué funcionalidades** queremos implementar primero
3. **Crear issues/tareas** para cada funcionalidad
4. **Empezar con Fase 1** (MVP Core)

---

## 7. NOTAS ADICIONALES

- **Multi-tenancy**: Si se vende a múltiples clientes, considerar `tenant_id` en todas las tablas
- **Integración PrestaShop**: Para tracking automático de compras, necesitar webhooks o polling
- **Privacidad**: Respetar GDPR, permitir anonimización de datos
- **Performance**: Cachear métricas calculadas, usar índices apropiados
- **Responsive**: Todas las mejoras deben funcionar bien en móvil

---

## 8. RECOMENDACIONES: ¿Qué Implementar Primero?

Basándome en **impacto visual**, **valor comercial** y **facilidad de implementación**, estas son mis recomendaciones:

### 🎯 TOP 5 - Implementar PRIMERO (Mayor ROI)

#### 1. **Tarjetas de Productos en Respuestas (#1)** ⭐⭐⭐
**Por qué:**
- **Impacto visual inmediato**: Cambia completamente la experiencia del usuario
- **Aumenta conversión**: Botones directos a compra = más ventas
- **Diferencia competitiva**: La mayoría de chatbots solo muestran texto
- **Dificultad media pero vale la pena**: Requiere estructura de datos pero no es complejo

**ROI**: 🔥🔥🔥🔥🔥 (Máximo)

---

#### 1.1. **Añadir al Carrito desde Tarjeta (#1.1)** ⭐⭐⭐
**Por qué:**
- **Aumenta conversión exponencialmente**: El usuario compra sin salir del chat
- **Diferenciador clave**: Muy pocos chatbots lo hacen
- **Experiencia premium**: Todo fluido desde el chat
- **Dificultad media-alta pero vale MUCHO la pena**: Requiere integración con PrestaShop

**ROI**: 🔥🔥🔥🔥🔥 (Máximo - Aún más alto que tarjetas básicas)

**Nota**: Esta funcionalidad convierte las tarjetas de visualización en una herramienta de conversión directa.

---

#### 2. **Feedback de Utilidad (#6)** ⭐⭐⭐
**Por qué:**
- **Muy fácil de implementar** (🟢 Baja dificultad)
- **Base para todas las analíticas**: Sin feedback no hay datos
- **Valor comercial**: Los clientes quieren ver métricas de satisfacción
- **Mejora continua**: Permite identificar problemas rápidamente

**ROI**: 🔥🔥🔥🔥🔥 (Máximo - y es fácil)

---

#### 3. **Botones de Acción Rápida (#5)** ⭐⭐⭐
**Por qué:**
- **Reduce fricción**: El usuario no tiene que escribir "quiero comprar"
- **Aumenta conversión**: Un click vs escribir y buscar
- **Fácil de implementar** (🟢 Baja dificultad)
- **Complementa perfectamente** las tarjetas de productos

**ROI**: 🔥🔥🔥🔥 (Muy alto y fácil)

---

#### 4. **Panel de Preguntas Más Repetidas (#12)** ⭐⭐
**Por qué:**
- **Valor comercial alto**: Los clientes quieren saber qué preguntan sus usuarios
- **Mejora el producto**: Identifica qué optimizar
- **Diferencia competitiva**: No todos los chatbots ofrecen esto
- **Base para optimizaciones**: Permite mejorar respuestas específicas

**ROI**: 🔥🔥🔥🔥 (Alto valor comercial)

---

#### 5. **Panel de Conversiones (#13)** ⭐⭐
**Por qué:**
- **Valor comercial crítico**: "¿Cuánto vendo gracias al chat?" es la pregunta #1
- **Justificación de precio**: Permite mostrar ROI a clientes
- **Diferencia competitiva**: Muy pocos chatbots miden esto bien

**ROI**: 🔥🔥🔥🔥 (Alto valor comercial)

---

### 🟢 Quick Wins (Fáciles y con Impacto)

Estas son fáciles de implementar y mejoran la experiencia:

#### 6. **Formato Enriquecido (#7)** 
- Muy fácil (🟢 Baja)
- Mejora la legibilidad
- Hace el chat más profesional
- **Implementar junto con las tarjetas**

#### 7. **Indicador "Escribiendo..." (#8)**
- Muy fácil (🟢 Baja)
- Mejora la percepción de velocidad
- Estándar en chats modernos
- **Implementar en paralelo con otras funciones**

---

### 🟡 Segunda Ola (Después del MVP)

Una vez tengas el core funcionando, añade estas:

#### 8. **Grid de Múltiples Productos (#2)**
- Complementa las tarjetas (#1)
- Necesario cuando hay muchos resultados
- **Implementar después de #1**

#### 9. **Panel de Nivel de Conocimiento (#11)**
- Visualmente atractivo para clientes
- Muestra evolución del bot
- **Implementar después de tener feedback (#6)**

#### 10. **Sugerencias de Preguntas (#9)**
- Reduce fricción (no tienen que escribir)
- Guía al usuario
- **Implementar después del feedback**

---

### 🔴 Diferir (Para Más Tarde)

Estas son útiles pero no críticas para el MVP:

- **Comparación de productos (#3)**: Útil pero menos frecuente
- **Imágenes contextuales (#4)**: Nice to have
- **Historial de conversación (#10)**: Ya está implícito en el chat
- **Editor visual (#14)**: Avanzado, para después
- **Configuración de comportamiento (#15)**: Puede esperar

---

## 9. PLAN DE ACCIÓN RECOMENDADO

### 🚀 Sprint 1 (Semana 1-2): MVP Core
**Objetivo**: Producto vendible con funcionalidades diferenciadoras

1. ✅ **Tarjetas de Productos (#1)** - El diferenciador principal
2. ✅ **Añadir al Carrito desde Tarjeta (#1.1)** - ⚡ CRÍTICO para conversión
3. ✅ **Botones de Acción Rápida (#5)** - Complementa tarjetas
4. ✅ **Feedback de Utilidad (#6)** - Base de datos
5. ✅ **Formato Enriquecido (#7)** - Quick win
6. ✅ **Indicador "Escribiendo..." (#8)** - Quick win

**Resultado**: Chat funcional y visualmente atractivo con capacidad de añadir al carrito y feedback básico

---

### 📊 Sprint 2 (Semana 3-4): Analytics
**Objetivo**: Dashboard con métricas valiosas

1. ✅ **Panel de Preguntas Repetidas (#12)**
2. ✅ **Panel de Conversiones (#13)**
3. ✅ **Grid de Múltiples Productos (#2)**

**Resultado**: Dashboard completo con métricas comerciales

---

### 🎨 Sprint 3 (Semana 5+): Mejoras y Refinamiento
**Objetivo**: Pulir y añadir funciones avanzadas

1. ✅ **Panel de Nivel de Conocimiento (#11)**
2. ✅ **Sugerencias de Preguntas (#9)**
3. ✅ **Comparación de productos (#3)** (si hay demanda)

**Resultado**: Producto completo y pulido

---

## 10. RESUMEN DE RECOMENDACIÓN

### 🎯 Prioridad ABSOLUTA (Empezar YA):
1. **Tarjetas de Productos** - Tu diferenciador principal
2. **Añadir al Carrito desde Tarjeta** - ⚡ EL MÁS IMPORTANTE para conversión
3. **Feedback de Utilidad** - Base para todo lo demás
4. **Botones de Acción Rápida** - Aumenta conversión

### 📈 Segunda Prioridad (Después del MVP):
4. **Panel de Preguntas Repetidas** - Valor comercial alto
5. **Panel de Conversiones** - Valor comercial crítico

### ⚡ Quick Wins (Implementar en paralelo):
- Formato enriquecido
- Indicador "Escribiendo..."

---

**Conclusión**: Si implementas las **Top 5** tendrás un producto **vendible y diferenciado**. El resto son mejoras que puedes añadir según el feedback de clientes.

---

¿Qué te parece esta propuesta? ¿Quieres añadir, modificar o priorizar alguna funcionalidad?


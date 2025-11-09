# 📝 Cómo Responde OpenAI – Versión 2 (Baseline simple)

**Última actualización:** 2025-11-09  
**Archivo principal:** `api/chat.ts`

> Esta versión describe el flujo reducido con el que retomamos las pruebas. A partir de aquí iremos añadiendo capas (semántica, quick responses, etc.) y actualizaremos el doc con cada hito.

---

## 1. Flujo general

1. Validar request (`POST`, message string, entorno configurado).  
2. Cargar prompt activo desde Supabase y procesar variables.  
3. Limitar historial a los dos últimos mensajes cuando hay seguimiento.  
4. Detectar rápidamente si el mensaje pide productos (`detectProductQuery`) y extraer un término (`extractSearchTermFromMessage`).  
5. Construir mensajes para OpenAI: system prompt + historial reducido + mensaje del usuario (sin instrucciones extra).  
6. Llamada a OpenAI con `tool_choice: 'auto'` permitiendo que el modelo decida qué función usar.  
7. Ejecutar la función elegida (`search_products`, `get_product_by_sku`, etc.) y enviar el resultado tal cual.  
8. Segunda llamada a OpenAI solo si es necesario (sin contexto enriquecido adicional).  
9. Devolver la respuesta final y guardar analytics básicos.

---

## 2. Reglas del system prompt

- Prompt base definido en Supabase (`system_prompts`).  
- Se mantiene una única instrucción extra: *no respondas sobre disponibilidad sin consultar la función apropiada*.  
- No se añaden bloques extra de instrucciones ni avisos de categoría.

---

## 3. Detección mínima

- **`detectProductQuery(message)`**: heurística con palabras clave (tienes, buscamos, precio, etc.).  
- **`extractSearchTermFromMessage(message)`**: regex simples que devuelven el término más probable; si falla, el mensaje limpio completo.  
- Si la heurística dice “sí, es de productos”, el término de búsqueda se adjunta como comentario al mensaje del usuario (`[IMPORTANTE: Busca productos relacionados con "X" usando search_products]`).

> No hay comprensión semántica ni detector de categorías en esta versión.

---

## 4. Functions disponibles

Se exponen las funciones históricas (`search_products`, `get_product_by_sku`, `search_products_by_category`, etc.), pero ninguna se fuerza desde backend salvo el recordatorio de usar `search_products` cuando se detecta una query de productos.

---

## 5. Respuesta final

- Si OpenAI devuelve un mensaje directo (sin función), se responde tal cual.  
- Si llama a una función, ejecutamos la función y volvemos a llamarlo con: system + historial limitado + respuesta de la función sin adornos.  
- No hay quick responses ni formateo backend; el modelo genera el mensaje final libremente.  
- Analytics guardan: mensaje usuario, respuesta, función llamada, productos (si hay) y tiempo de respuesta.

---

## 6. Próximos pasos

1. Reintroducir comprensión semántica (flag `enableSemanticUnderstanding`).  
2. Añadir detector de categorías con scoring (flag aparte).  
3. Definir formato estructurado opcional para listados (quick response / structured response).  
4. Crear playbook de pruebas con mensajes representativos.

> Cada paso que activemos debe quedar documentado en esta V2 con fecha y exactamente qué hace.

# 📋 PLAN DE IMPLEMENTACIÓN PASO A PASO

## 🎯 RECOMENDACIÓN: Orden de Implementación

### **FASE 1: Base de Datos y Configuración de Prompts** ⭐ EMPEZAR AQUÍ
**Prioridad: ALTA** | **Tiempo estimado: 4-6 horas**

**¿Por qué empezar aquí?**
- Es la base de todo el sistema
- Los prompts son necesarios para que el chat funcione correctamente
- Permite probar y ajustar prompts sin depender de otras funcionalidades
- Es relativamente independiente y se puede hacer rápido

**Tareas:**
1. ✅ Crear schema de base de datos para prompts
2. ✅ API para gestionar prompts (CRUD)
3. ✅ Componente Dashboard con nueva pestaña "Configuración AI"
4. ✅ Componente Editor de Prompts
5. ✅ Sistema de variables dinámicas
6. ✅ Activación/desactivación de prompts

**Resultado:** Puedes crear, editar y activar prompts desde la UI sin tocar código.

---

### **FASE 2: Chat Básico con OpenAI**
**Prioridad: ALTA** | **Tiempo estimado: 6-8 horas**

**¿Por qué después?**
- Necesita los prompts de la Fase 1 para funcionar bien
- Es la funcionalidad principal que el usuario quiere probar
- Permite validar que todo funciona antes de añadir complejidad

**Tareas:**
1. ✅ Instalar dependencias (openai SDK)
2. ✅ Crear endpoint `/api/chat`
3. ✅ Integrar con sistema de prompts (cargar prompt activo)
4. ✅ Function Calling básico (solo productos por ahora)
5. ✅ Componente Chat en el Dashboard
6. ✅ Configuración rápida de OpenAI (modelo, temperatura, etc.)
7. ✅ Historial de conversación

**Resultado:** Chat funcional que consulta productos de PrestaShop usando prompts configurables.

---

### **FASE 3: Sistema de Documentos (RAG)**
**Prioridad: MEDIA** | **Tiempo estimado: 8-10 horas**

**¿Por qué después?**
- El chat básico debe funcionar primero
- RAG añade complejidad (embeddings, vectorización)
- Necesita habilitar pgvector en Supabase

**Tareas:**
1. ✅ Habilitar extensión pgvector en Supabase
2. ✅ Crear schema para documentos y chunks
3. ✅ API para subir documentos
4. ✅ Procesamiento de documentos (PDF, TXT, MD)
5. ✅ Generación de embeddings
6. ✅ Búsqueda vectorial
7. ✅ Componente de gestión de documentos
8. ✅ Integrar en Function Calling del chat

**Resultado:** Puedes subir documentos y el chat los consulta automáticamente.

---

### **FASE 4: Multi-Plataforma (WooCommerce)**
**Prioridad: MEDIA** | **Tiempo estimado: 6-8 horas**

**¿Por qué después?**
- El sistema debe funcionar bien con PrestaShop primero
- Es una extensión del sistema actual
- No bloquea otras funcionalidades

**Tareas:**
1. ✅ Crear schema para stores (conexiones)
2. ✅ Abstracción de APIs de tiendas
3. ✅ Implementar WooCommerce API adapter
4. ✅ Actualizar componente de conexiones
5. ✅ Actualizar función search_products para multi-plataforma
6. ✅ Actualizar tabla products con store_id y platform

**Resultado:** Sistema soporta PrestaShop y WooCommerce simultáneamente.

---

### **FASE 5: Web Scraping y Fuentes Web**
**Prioridad: BAJA** | **Tiempo estimado: 6-8 horas**

**¿Por qué al final?**
- Es una funcionalidad "nice to have"
- Requiere scraping y procesamiento adicional
- El sistema ya funciona sin esto

**Tareas:**
1. ✅ Crear schema para web_sources
2. ✅ API para gestionar URLs
3. ✅ Sistema de scraping (Puppeteer/Cheerio)
4. ✅ Procesamiento de contenido web
5. ✅ Integración con sistema de documentos
6. ✅ Componente de gestión de fuentes web
7. ✅ Scraping programado (cron jobs)

**Resultado:** Puedes indexar contenido web automáticamente.

---

## 📊 DIAGRAMA DE DEPENDENCIAS

```
FASE 1: Base de Datos + Prompts
    │
    ├─→ FASE 2: Chat Básico
    │       │
    │       ├─→ FASE 3: Documentos (RAG)
    │       │       │
    │       │       └─→ FASE 5: Web Scraping
    │       │
    │       └─→ FASE 4: Multi-Plataforma
    │
    └─→ (Todas las fases dependen de FASE 1)
```

---

## 🚀 EMPEZAR: FASE 1 DETALLADA

### Paso 1.1: Schema de Base de Datos (30 min)

```sql
-- Habilitar UUID si no está habilitado
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de prompts
CREATE TABLE IF NOT EXISTS system_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  prompt TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Tabla de variables de prompts
CREATE TABLE IF NOT EXISTS prompt_variables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prompt_id UUID REFERENCES system_prompts(id) ON DELETE CASCADE,
  variable_name TEXT NOT NULL,
  variable_value TEXT,
  variable_type TEXT DEFAULT 'text',
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_system_prompts_active ON system_prompts(is_active);
CREATE INDEX IF NOT EXISTS idx_prompt_variables_prompt_id ON prompt_variables(prompt_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc', NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_system_prompts_updated_at 
  BEFORE UPDATE ON system_prompts 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

### Paso 1.2: API para Prompts (1 hora)

```typescript
// api/prompts.ts
```

### Paso 1.3: Componente Dashboard Actualizado (1 hora)

```typescript
// src/components/Dashboard.tsx
// Añadir nueva pestaña "Configuración AI"
```

### Paso 1.4: Componente Editor de Prompts (2-3 horas)

```typescript
// src/components/PromptConfig.tsx
// Editor completo con variables
```

---

## ✅ CHECKLIST FASE 1

- [ ] Crear schema en Supabase
- [ ] Crear endpoint `/api/prompts` (GET, POST, PUT, DELETE)
- [ ] Crear servicio `promptService.ts`
- [ ] Actualizar `Dashboard.tsx` con nueva pestaña
- [ ] Crear componente `PromptConfig.tsx`
- [ ] Crear componente `PromptEditor.tsx`
- [ ] Sistema de variables dinámicas
- [ ] Vista previa de prompts
- [ ] Activación/desactivación de prompts
- [ ] Testing básico

---

## 🎯 VENTAJAS DE ESTE ORDEN

1. **Fase 1 es independiente**: No depende de nada más
2. **Fase 2 es inmediatamente útil**: Chat funcional rápido
3. **Fase 3 añade valor**: RAG mejora significativamente las respuestas
4. **Fase 4 extiende**: Multi-plataforma sin romper lo existente
5. **Fase 5 complementa**: Web scraping es opcional

---

## 💡 MI RECOMENDACIÓN FINAL

**Empieza con FASE 1: Base de Datos y Configuración de Prompts**

**Razones:**
1. ✅ Es la base de todo
2. ✅ Es rápido de implementar (4-6 horas)
3. ✅ Permite probar y ajustar inmediatamente
4. ✅ No bloquea otras funcionalidades
5. ✅ El usuario puede empezar a configurar prompts mientras desarrollas el chat

**Siguiente paso:** ¿Quieres que empiece con la Fase 1 ahora mismo?


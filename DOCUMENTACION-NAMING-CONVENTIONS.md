# 📋 Documentación Completa de Convenciones de Nombres del Proyecto

Este documento contiene todas las entidades nombradas del proyecto para facilitar la búsqueda de convenciones de nombres (naming conventions).

---

## 📁 Estructura de Carpetas y Archivos

### Carpetas Principales
- `api/` - Endpoints API de Vercel
- `src/` - Código fuente principal (React)
- `backend-laravel/` - Backend Laravel
- `prestashop-products-app/` - Aplicación React independiente
- `frontend-angular/` - Frontend Angular
- `conexion-prestashop/` - Scripts PHP para PrestaShop

### Archivos de Configuración
- `package.json` - Configuración Node.js principal
- `vite.config.ts` - Configuración Vite
- `tailwind.config.js` - Configuración Tailwind CSS
- `tsconfig.json` - Configuración TypeScript
- `vercel.json` - Configuración Vercel
- `eslint.config.js` - Configuración ESLint
- `composer.json` - Configuración PHP/Laravel

---

## 🎨 Componentes React (TypeScript/TSX)

### Componentes Principales (`src/components/`)
- `AuthForm` - Formulario de autenticación
- `Chat` - Componente de chat principal
- `ChatConfig` - Configuración del chat
- `Connections` - Gestión de conexiones
- `Dashboard` - Panel principal
- `Documentation` - Gestión de documentación
- `ProductCard` - Tarjeta de producto
- `ProductTable` - Tabla de productos
- `ProductsReport` - Reporte de productos
- `ProgressBar` - Barra de progreso
- `PromptConfig` - Configuración de prompts

### Componentes PrestaShop App (`prestashop-products-app/src/components/`)
- `AuthForm` - Formulario de autenticación
- `ProductTable` - Tabla de productos
- `ProgressBar` - Barra de progreso

### Props Interfaces (Patrón: `{Component}Props`)
- `AuthFormProps`
- `ChatProps`
- `ChatConfigProps`
- `ProductCardProps`
- `ProductTableProps`
- `ProgressBarProps`

---

## 🔧 Servicios (TypeScript)

### Servicios Frontend (`src/services/`)
- `chatService.ts`
  - `sendChatMessage()` - Función para enviar mensajes al chat
  - `DEFAULT_CHAT_CONFIG` - Configuración por defecto del chat
  - `AVAILABLE_MODELS` - Array de modelos disponibles

- `prestashopApi.ts`
  - `fetchAllProducts()` - Obtener todos los productos

- `promptService.ts`
  - `getPrompts()` - Obtener prompts
  - `getPromptById()` - Obtener prompt por ID
  - `getActivePrompt()` - Obtener prompt activo
  - `createPrompt()` - Crear nuevo prompt
  - `updatePrompt()` - Actualizar prompt
  - `activatePrompt()` - Activar prompt
  - `deletePrompt()` - Eliminar prompt
  - `processPrompt()` - Procesar prompt con variables
  - `extractVariablesFromPrompt()` - Extraer variables del prompt

---

## 🌐 API Endpoints (Vercel - TypeScript)

### Endpoints (`api/*.ts`)
Todos los endpoints siguen el patrón `export default async function handler()`

- `chat.ts` - Endpoint principal de chat
- `clear-products.ts` - Limpiar productos
- `delete-document.ts` - Eliminar documento
- `extract-document-text.ts` - Extraer texto de documento
- `get-documents.ts` - Obtener documentos
- `get-existing-skus.ts` - Obtener SKUs existentes
- `get-products.ts` - Obtener productos
- `prestashop-category.ts` - Gestión de categorías PrestaShop
- `prestashop-proxy.ts` - Proxy para PrestaShop
- `prompts.ts` - Gestión de prompts
- `save-products.ts` - Guardar productos
- `search-documents.ts` - Buscar documentos
- `test-supabase.ts` - Test de conexión Supabase
- `upload-document.ts` - Subir documento

### Utilidades API (`api/utils/`)
- `productScraper.ts` - Scraper de productos

---

## 📊 Tipos e Interfaces (TypeScript)

### Tipos Principales (`src/types.ts`)

#### Productos
- `Product` - Interface de producto
  - `name: string`
  - `price: string`
  - `category: string`
  - `subcategory?: string`
  - `description: string`
  - `sku: string`
  - `image: string`
  - `product_url: string`
  - `date_add?: string`
  - `colors?: string[]`

- `ApiConfig` - Configuración de API
  - `apiKey: string`
  - `prestashopUrl: string`
  - `baseUrl?: string`
  - `langCode?: number`
  - `langSlug?: string`

#### Prompts
- `PromptVariable` - Variable de prompt
- `SystemPrompt` - Prompt del sistema

#### Chat
- `MessageSource` - Tipo union: `'products_db' | 'web' | 'documents' | 'general'`
- `ChatMessage` - Mensaje de chat
- `ChatConfig` - Configuración del chat
- `ChatResponse` - Respuesta del chat

#### Documentos
- `Document` - Documento
- `DocumentUploadResponse` - Respuesta de subida de documento
- `DocumentSearchResult` - Resultado de búsqueda de documento

---

## 🔙 Backend Laravel (PHP)

### Controladores (`backend-laravel/app/Http/Controllers/`)
- `AuthController` - Controlador de autenticación
  - `login()` - Método de login
  - `check()` - Verificar sesión
  - `logout()` - Cerrar sesión

- `ProductController` - Controlador de productos
  - `fetchProducts()` - Obtener productos
  - `getProgress()` - Obtener progreso
  - `getAllProducts()` - Obtener todos los productos
  - `saveProducts()` - Guardar productos
  - `getSavedProducts()` - Obtener productos guardados

### Servicios (`backend-laravel/app/Services/`)
- `PrestaShopService` - Servicio de PrestaShop

### Modelos (`backend-laravel/app/Models/`)
- `Product` - Modelo de producto

### Rutas (`backend-laravel/routes/api.php`)
- `POST /api/auth/login`
- `GET /api/auth/check`
- `POST /api/auth/logout`
- `GET /api/products/fetch`
- `GET /api/products/progress`
- `GET /api/products/all`
- `POST /api/products/save`
- `GET /api/products/saved`

---

## 🎯 Convenciones de Nomenclatura Identificadas

### React/TypeScript
- **Componentes**: PascalCase (`ProductTable`, `ChatConfig`)
- **Funciones**: camelCase (`fetchAllProducts`, `sendChatMessage`)
- **Interfaces/Tipos**: PascalCase (`Product`, `ChatMessage`, `ApiConfig`)
- **Props Interfaces**: `{Component}Props` (`ProductTableProps`, `ChatConfigProps`)
- **Constantes**: UPPER_SNAKE_CASE (`DEFAULT_CHAT_CONFIG`, `AVAILABLE_MODELS`)
- **Variables**: camelCase (`searchTerm`, `currentPage`)
- **Archivos de componentes**: PascalCase (`ProductTable.tsx`, `Chat.tsx`)
- **Archivos de servicios**: camelCase (`chatService.ts`, `prestashopApi.ts`)

### API Endpoints (Vercel)
- **Archivos**: kebab-case (`chat.ts`, `get-products.ts`, `save-products.ts`)
- **Funciones handler**: `handler()` (default export)

### Laravel (PHP)
- **Controladores**: PascalCase + sufijo `Controller` (`AuthController`, `ProductController`)
- **Métodos**: camelCase (`fetchProducts`, `saveProducts`)
- **Servicios**: PascalCase + sufijo `Service` (`PrestaShopService`)
- **Modelos**: PascalCase singular (`Product`)
- **Rutas**: snake_case en URLs (`/products/fetch`, `/auth/login`)

---

## 📊 Variables de Estado Comunes (React Hooks)

### Estados de UI
- `loading` / `isLoading` - Estado de carga
- `error` - Mensaje de error
- `success` / `saveSuccess` - Estado de éxito
- `connectionStatus` - Estado de conexión
- `state` - Estado general del componente

### Estados de Datos
- `messages` - Array de mensajes de chat
- `products` - Array de productos
- `inputMessage` - Mensaje de entrada
- `searchTerm` - Término de búsqueda
- `currentPage` - Página actual
- `config` - Configuración del componente

### Estados de Progreso
- `progress` - Objeto de progreso (current, total, percentage)
- `loadingStage` - Etapa actual de carga

---

## 🔗 Endpoints API (Rutas)

### Vercel API Routes
- `/api/chat` - Chat principal
- `/api/get-products` - Obtener productos
- `/api/save-products` - Guardar productos
- `/api/clear-products` - Limpiar productos
- `/api/get-documents` - Obtener documentos
- `/api/upload-document` - Subir documento
- `/api/delete-document` - Eliminar documento
- `/api/search-documents` - Buscar documentos
- `/api/extract-document-text` - Extraer texto
- `/api/get-existing-skus` - Obtener SKUs existentes
- `/api/prompts` - Gestión de prompts
- `/api/prestashop-proxy` - Proxy de PrestaShop
- `/api/prestashop-category` - Categorías de PrestaShop
- `/api/test-supabase` - Test de Supabase

---

## 📋 Tablas de Base de Datos (Supabase)

### Tablas Principales
- `products` - Productos
- `prompts` - Prompts del sistema
- `prompt_variables` - Variables de prompts
- `documents` - Documentos subidos
- `document_texts` - Textos extraídos de documentos

---

## 🔄 Funciones y Métodos Comunes

### Handlers de Eventos
- `handleSubmit()` - Manejar envío de formulario
- `handleSendMessage()` - Enviar mensaje
- `handleExportCSV()` - Exportar a CSV
- `handleExportJSON()` - Exportar a JSON
- `handleAuthenticate()` - Autenticar
- `onAuthenticate()` - Callback de autenticación
- `onConfigChange()` - Callback de cambio de configuración

### Funciones CRUD
- `get{Entity}()` - Obtener
- `create{Entity}()` - Crear
- `update{Entity}()` - Actualizar
- `delete{Entity}()` - Eliminar
- `fetch{Entity}()` - Obtener (async)

---

**Última actualización**: Generado automáticamente basado en la estructura del proyecto actual.


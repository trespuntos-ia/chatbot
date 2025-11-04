# Configuración de Documentación

Esta guía explica cómo configurar y usar la funcionalidad de documentación en el chatbot.

## Requisitos Previos

1. **Base de datos Supabase**: Debes tener configurada tu base de datos Supabase con las variables de entorno necesarias.

## Paso 1: Crear la tabla de documentos en Supabase

1. Ve a tu proyecto en Supabase Dashboard
2. Navega a **SQL Editor**
3. Abre el archivo `supabase-documents-schema.sql`
4. Copia y pega el contenido completo en el editor SQL
5. Ejecuta el script

Esto creará:
- La tabla `documents` para almacenar los documentos
- Índices para búsquedas rápidas
- Políticas RLS (Row Level Security) para acceso público

## Paso 2: Verificar variables de entorno

Asegúrate de tener configuradas estas variables en Vercel:

- `SUPABASE_URL`: URL de tu proyecto Supabase
- `SUPABASE_ANON_KEY`: Clave anónima de Supabase
- `OPENAI_API_KEY`: Clave API de OpenAI (ya debería estar configurada)

## Paso 3: Usar la funcionalidad

### Subir documentos

1. Ve a la pestaña **"Documentación"** en el Dashboard
2. Haz clic en el área de subida de archivos
3. Selecciona un archivo (PDF, DOC, DOCX, TXT, MD)
4. El archivo debe ser menor a 10MB
5. El archivo se subirá y se extraerá el texto automáticamente

### Eliminar documentos

1. En la lista de documentos subidos
2. Haz clic en el botón **"Eliminar"** del documento que quieras eliminar
3. Confirma la eliminación

### Consultar documentos en el Chat

El chatbot puede consultar automáticamente los documentos subidos cuando:
- El usuario pregunta sobre información que podría estar en documentos
- El usuario menciona términos relacionados con manuales, guías, políticas, etc.
- OpenAI detecta que la información puede estar en documentos

La IA usará la función `search_documents` automáticamente cuando sea relevante.

## Limitaciones Actuales

### Extracción de texto

La extracción de texto funciona para todos los formatos soportados:
- ✅ Archivos de texto plano (.txt)
- ✅ Archivos Markdown (.md)
- ✅ Archivos PDF (.pdf) - usando `pdf-parse`
- ✅ Archivos Word (.docx) - usando `mammoth`
- ⚠️ Archivos Word antiguos (.doc) - soporte limitado (mammoth puede no funcionar con .doc muy antiguos)

**Nota**: Las bibliotecas `pdf-parse` y `mammoth` ya están instaladas y configuradas. Si encuentras problemas con archivos específicos, verifica:
- Que el PDF no esté protegido con contraseña
- Que el archivo .docx no esté corrupto
- Los logs del servidor para ver errores específicos de extracción

## Estructura de la Base de Datos

La tabla `documents` contiene:

- `id`: ID único del documento
- `filename`: Nombre del archivo almacenado
- `original_filename`: Nombre original del archivo
- `file_type`: Tipo de archivo (pdf, docx, txt, etc.)
- `file_size`: Tamaño en bytes
- `file_content`: Contenido binario del archivo (BYTEA)
- `extracted_text`: Texto extraído para búsqueda
- `mime_type`: Tipo MIME del archivo
- `created_at`: Fecha de creación
- `updated_at`: Fecha de última actualización

## API Endpoints

### POST /api/upload-document
Sube un nuevo documento.

**Body:**
```json
{
  "file": "base64_encoded_file",
  "filename": "documento.pdf",
  "mimeType": "application/pdf"
}
```

### GET /api/get-documents
Obtiene la lista de todos los documentos.

### DELETE /api/delete-document?id={id}
Elimina un documento por su ID.

### POST /api/search-documents
Busca en los documentos (usado internamente por el chat).

**Body:**
```json
{
  "query": "término de búsqueda",
  "limit": 5
}
```

## Troubleshooting

### Error: "Table not found"
- Verifica que hayas ejecutado el script SQL `supabase-documents-schema.sql`
- Verifica que la tabla `documents` existe en Supabase

### Error: "Permission denied"
- Verifica las políticas RLS en Supabase
- Asegúrate de que las políticas permiten lectura y escritura pública

### El texto extraído está vacío para PDF/Word
- Esto es normal si no has instalado las bibliotecas de extracción
- Ver la sección "Limitaciones Actuales" arriba

### El chatbot no consulta los documentos
- Verifica que hay documentos subidos
- Asegúrate de que los documentos tienen texto extraído (no esté vacío)
- El chatbot decide automáticamente cuándo consultar documentos basándose en la pregunta del usuario


import { useState, useEffect, useRef } from 'react';
import type { Document } from '../types';

// Vercel tiene un límite de 4.5MB para el body de las requests
// Base64 aumenta el tamaño ~33%, más overhead del JSON
// Usamos 3MB para el archivo original para estar seguros (~4MB en base64 + JSON)
const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB (original), ~4MB en base64
const ALLOWED_TYPES = ['.pdf', '.doc', '.docx', '.txt', '.md'];

export function Documentation() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Cargar documentos al montar el componente
  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    setIsLoading(true);
    setError('');
    try {
      const response = await fetch('/api/get-documents');
      const data = await response.json();
      
      if (data.success) {
        setDocuments(data.documents || []);
      } else {
        setError(data.error || 'Error al cargar documentos');
      }
    } catch (err) {
      setError('Error al conectarse con el servidor');
      console.error('Error loading documents:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validar tipo de archivo
    const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();
    if (!ALLOWED_TYPES.includes(fileExtension)) {
      setError(`Tipo de archivo no permitido. Permitidos: ${ALLOWED_TYPES.join(', ')}`);
      return;
    }

    // Validar tamaño ANTES de procesar
    // Base64 aumenta el tamaño ~33%, más el overhead del JSON
    // Calculamos el tamaño aproximado en base64
    const estimatedBase64Size = file.size * 1.37; // 1.33 para base64 + 0.04 para overhead JSON
    const maxBodySize = 4.2 * 1024 * 1024; // 4.2MB para dejar margen del límite de 4.5MB
    
    if (file.size > MAX_FILE_SIZE || estimatedBase64Size > maxBodySize) {
      const actualSize = estimatedBase64Size > maxBodySize ? estimatedBase64Size : file.size;
      const sizeType = estimatedBase64Size > maxBodySize ? 'tamaño estimado en base64' : 'tamaño';
      setError(`El archivo es demasiado grande (${(actualSize / 1024 / 1024).toFixed(2)}MB ${sizeType}). Máximo permitido: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB (archivo original).`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    // Convertir archivo a base64
    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = e.target?.result as string;
          if (!base64String) {
            throw new Error('No se pudo leer el archivo');
          }

          // Extraer solo la parte base64 (sin el prefijo data:mime;base64,)
          const base64Data = base64String.includes(',') 
            ? base64String.split(',')[1] 
            : base64String;

          // Validar que tenemos datos
          if (!base64Data || base64Data.length === 0) {
            throw new Error('El archivo está vacío después de la codificación');
          }

          console.log('Preparing upload:', {
            filename: file.name,
            mimeType: file.type,
            originalSize: file.size,
            base64Length: base64Data.length,
            estimatedPayloadSize: (base64Data.length + file.name.length + (file.type?.length || 0) + 100) // +100 para overhead JSON
          });

          const requestBody = {
            file: base64Data,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream'
          };

          const response = await fetch('/api/upload-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody)
          });

          // Verificar si la respuesta es JSON válida
          let data;
          const responseText = await response.text();
          
          try {
            if (!responseText) {
              throw new Error('Respuesta vacía del servidor');
            }
            data = JSON.parse(responseText);
          } catch (parseError) {
            // Si no es JSON, puede ser un error 413 u otro error HTTP
            console.error('Error parsing response:', parseError);
            console.error('Response status:', response.status);
            console.error('Response text:', responseText);
            
            if (response.status === 413) {
              setError(`El archivo es demasiado grande. El límite máximo es ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB (archivo original). Tu archivo tiene ${(file.size / 1024 / 1024).toFixed(2)}MB. Nota: Base64 aumenta el tamaño ~33%.`);
            } else if (response.status === 400) {
              setError(`Error en la petición: ${response.statusText}. El archivo puede ser demasiado grande o tener un formato incorrecto.`);
            } else if (response.status === 504 || response.status === 503) {
              setError('Timeout del servidor. El archivo puede ser demasiado grande para procesar. Intenta con un archivo más pequeño.');
            } else if (response.status >= 500) {
              setError(`Error del servidor (${response.status}). Por favor, intenta de nuevo más tarde. Si el problema persiste, el archivo puede ser demasiado grande.`);
            } else {
              setError(`Error al subir el archivo (${response.status}): ${response.statusText || responseText || 'Error desconocido'}`);
            }
            setIsUploading(false);
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
            return;
          }

          if (response.ok && data.success) {
            setSuccess(`Archivo "${file.name}" subido correctamente`);
            // Recargar lista de documentos
            await loadDocuments();
            // Limpiar input
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }
          } else {
            setError(data.error || data.details || 'Error al subir el archivo');
          }
        } catch (err) {
          // Manejar errores de red u otros errores
          console.error('Error uploading file:', err);
          if (err instanceof TypeError && err.message.includes('fetch')) {
            setError('Error de conexión. Verifica tu conexión a internet.');
          } else if (err instanceof Error && err.message.includes('Failed to fetch')) {
            setError('Error de conexión o timeout. El archivo puede ser demasiado grande o la conexión es lenta.');
          } else {
            const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
            setError(`Error al procesar el archivo: ${errorMsg}. Verifica la consola para más detalles.`);
          }
        } finally {
          setIsUploading(false);
        }
      };

      reader.onerror = () => {
        setError('Error al leer el archivo');
        setIsUploading(false);
      };

      reader.readAsDataURL(file);
    } catch (err) {
      setError('Error al leer el archivo');
      setIsUploading(false);
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`¿Estás seguro de que quieres eliminar "${filename}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/delete-document?id=${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        setSuccess(`Archivo "${filename}" eliminado correctamente`);
        await loadDocuments();
      } else {
        setError(data.error || data.details || 'Error al eliminar el archivo');
      }
    } catch (err) {
      setError('Error al conectarse con el servidor');
      console.error('Error deleting document:', err);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getFileIcon = (fileType: string) => {
    switch (fileType.toLowerCase()) {
      case 'pdf':
        return (
          <svg className="h-6 w-6 text-red-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      case 'docx':
      case 'doc':
        return (
          <svg className="h-6 w-6 text-blue-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
      default:
        return (
          <svg className="h-6 w-6 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Documentación
        </h2>
        <p className="text-slate-600">
          Sube documentos (PDF, Word, TXT) para que la IA pueda consultarlos al responder preguntas. Máximo 3MB por archivo (debido a limitaciones de Vercel).
        </p>
      </div>

      {/* Mensajes de estado */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{success}</span>
          </div>
        </div>
      )}

      {/* Zona de subida */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Subir nuevo documento
          </h3>
        </div>
        
        <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center hover:border-indigo-400 transition">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.md"
            onChange={handleFileSelect}
            disabled={isUploading}
            className="hidden"
            id="file-upload"
          />
          <label
            htmlFor="file-upload"
            className={`cursor-pointer flex flex-col items-center gap-2 ${
              isUploading ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            {isUploading ? (
              <>
                <svg
                  className="animate-spin h-12 w-12 text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span className="text-slate-600">Subiendo archivo...</span>
              </>
            ) : (
              <>
                <svg
                  className="h-12 w-12 text-slate-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                  />
                </svg>
                <span className="text-slate-700 font-medium">
                  Haz clic para seleccionar un archivo
                </span>
                <span className="text-sm text-slate-500">
                  PDF, DOC, DOCX, TXT, MD (máx. 3MB)
                </span>
              </>
            )}
          </label>
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-slate-900">
            Documentos subidos ({documents.length})
          </h3>
          <button
            onClick={loadDocuments}
            disabled={isLoading}
            className="px-3 py-1.5 text-sm text-slate-600 hover:text-slate-900 border border-slate-300 rounded-lg hover:bg-slate-50 transition disabled:opacity-50"
          >
            <div className="flex items-center gap-2">
              <svg
                className="h-4 w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              Actualizar
            </div>
          </button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <svg
              className="animate-spin h-8 w-8 text-indigo-600 mx-auto"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              ></circle>
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
            <p className="mt-2 text-slate-500">Cargando documentos...</p>
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <svg
              className="h-12 w-12 mx-auto mb-4 text-slate-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p>No hay documentos subidos todavía</p>
            <p className="text-sm mt-1">Sube tu primer documento usando el área de arriba</p>
          </div>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:bg-slate-50 transition"
              >
                <div className="flex items-center gap-4 flex-1 min-w-0">
                  {getFileIcon(doc.file_type)}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-900 truncate">
                      {doc.original_filename}
                    </p>
                    <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span>•</span>
                      <span>{doc.file_type.toUpperCase()}</span>
                      <span>•</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id, doc.original_filename)}
                  className="px-3 py-1.5 text-sm text-red-600 hover:text-red-700 hover:bg-red-50 border border-red-200 rounded-lg transition"
                >
                  <div className="flex items-center gap-2">
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Eliminar
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}


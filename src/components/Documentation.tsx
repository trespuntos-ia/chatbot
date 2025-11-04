import { useState, useEffect, useRef } from 'react';
import type { Document } from '../types';

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

export function Documentation() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingDocs, setProcessingDocs] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    if (file.size > MAX_FILE_SIZE) {
      setError(`El archivo es demasiado grande. Máximo: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
      return;
    }

    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const base64String = e.target?.result as string;
          const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;

          console.log('Sending request:', {
            filename: file.name,
            size: file.size,
            base64Length: base64Data.length,
            estimatedSize: (base64Data.length * 0.75 / 1024 / 1024).toFixed(2) + 'MB'
          });

          const response = await fetch('/api/upload-document', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file: base64Data,
              filename: file.name,
              mimeType: file.type || ''
            })
          });

          console.log('Response status:', response.status);
          const responseText = await response.text();
          console.log('Response text:', responseText.substring(0, 200));

          let data;
          try {
            data = JSON.parse(responseText);
          } catch (parseErr) {
            console.error('Error parsing JSON:', parseErr);
            setError(`Error del servidor (${response.status}): ${responseText.substring(0, 100)}`);
            setIsUploading(false);
            return;
          }

          if (response.ok && data.success) {
            setSuccess(`Archivo "${file.name}" subido correctamente`);
            const documentId = data.document?.id;
            
            if (fileInputRef.current) {
              fileInputRef.current.value = '';
            }

            // Recargar documentos para mostrar el nuevo
            await loadDocuments();

            // Extraer texto del documento en segundo plano
            if (documentId) {
              console.log('Starting text extraction for document:', documentId);
              extractDocumentText(documentId);
            } else {
              console.warn('No document ID returned from upload');
            }
          } else {
            setError(data.error || data.details || `Error al subir el archivo (${response.status})`);
          }
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : 'Error desconocido';
          setError(`Error: ${errorMsg}`);
          console.error('Error uploading file:', err);
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
      setError('Error al procesar el archivo');
      setIsUploading(false);
    }
  };

  const extractDocumentText = async (documentId: number) => {
    console.log('extractDocumentText called for:', documentId);
    
    // Marcar como procesando
    setProcessingDocs(prev => {
      const newSet = new Set(prev);
      newSet.add(documentId);
      console.log('Processing docs set:', Array.from(newSet));
      return newSet;
    });

    try {
      console.log('Calling extract-document-text endpoint...');
      const response = await fetch('/api/extract-document-text', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ documentId })
      });

      console.log('Extract response status:', response.status);
      
      // Leer respuesta como texto primero para manejar errores no-JSON
      const responseText = await response.text();
      console.log('Extract response text:', responseText.substring(0, 200));
      
      let data;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Error parsing JSON response:', parseErr);
        setError(`Error del servidor (${response.status}): ${responseText.substring(0, 100)}`);
        return;
      }
      
      console.log('Extract response data:', data);

      if (response.ok && data.success) {
        console.log('Text extraction successful, reloading documents...');
        // Recargar documentos para mostrar el texto extraído
        await loadDocuments();
        setSuccess('Texto extraído correctamente');
      } else {
        console.error('Error extracting text:', data.error);
        setError(data.error || 'Error al extraer el texto');
      }
    } catch (err) {
      console.error('Error extracting document text:', err);
      setError('Error al conectarse con el servidor para extraer texto');
    } finally {
      // Quitar de procesando
      setProcessingDocs(prev => {
        const newSet = new Set(prev);
        newSet.delete(documentId);
        console.log('Removed from processing, remaining:', Array.from(newSet));
        return newSet;
      });
    }
  };

  const handleDelete = async (id: number, filename: string) => {
    if (!confirm(`¿Eliminar "${filename}"?`)) return;

    try {
      const response = await fetch(`/api/delete-document?id=${id}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setSuccess(`Archivo eliminado`);
        await loadDocuments();
      } else {
        setError(data.error || 'Error al eliminar');
      }
    } catch (err) {
      setError('Error al conectarse con el servidor');
    }
  };

  const getDocumentStatus = (doc: Document) => {
    // Si está procesando
    if (processingDocs.has(doc.id)) {
      return { text: 'Procesando...', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
    }
    
    // Si tiene texto extraído, está listo
    if (doc.has_extracted_text) {
      return { text: 'Listo', color: 'bg-green-100 text-green-800 border-green-200' };
    }
    
    // Si no tiene texto extraído y no está procesando, está pendiente
    return { text: 'Pendiente', color: 'bg-gray-100 text-gray-800 border-gray-200' };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const formatDate = (dateString?: string): string => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleDateString('es-ES');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">Documentación</h2>
        <p className="text-slate-600">Sube documentos (máx. 3MB)</p>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          {success}
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Subir documento</h3>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.txt,.md"
          onChange={handleFileSelect}
          disabled={isUploading}
          className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
        />
        {isUploading && <p className="mt-2 text-slate-600">Subiendo...</p>}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Documentos ({documents.length})</h3>
        
        {isLoading ? (
          <p className="text-slate-500">Cargando...</p>
        ) : documents.length === 0 ? (
          <p className="text-slate-500">No hay documentos</p>
        ) : (
          <div className="space-y-3">
            {documents.map((doc) => {
              const status = getDocumentStatus(doc);
              return (
                <div key={doc.id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{doc.original_filename}</p>
                    <p className="text-sm text-slate-500">
                      {formatFileSize(doc.file_size)} • {doc.file_type} • {formatDate(doc.created_at)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-1 text-xs font-medium rounded border ${status.color}`}>
                      {status.text}
                    </span>
                    {!doc.has_extracted_text && !processingDocs.has(doc.id) && (
                      <button
                        onClick={() => extractDocumentText(doc.id)}
                        className="px-3 py-1 text-xs text-blue-600 hover:bg-blue-50 border border-blue-200 rounded-lg"
                        title="Procesar documento para extraer texto"
                      >
                        Procesar
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id, doc.original_filename)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import type { Document, ProductSummary, ProductVideo } from '../types';
import * as pdfjsLib from 'pdfjs-dist';
import { ProductSelector } from './ProductSelector';

// Configurar worker para pdf.js usando unpkg CDN (más confiable)
if (typeof window !== 'undefined') {
  const version = pdfjsLib.version || '4.0.379';
  pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
}

const MAX_FILE_SIZE = 3 * 1024 * 1024; // 3MB

interface GetDocumentsResponse {
  success: boolean;
  documents?: Document[];
  error?: string;
  details?: string;
}

interface GetVideosResponse {
  success: boolean;
  videos?: ProductVideo[];
  error?: string;
  details?: string;
}

export function Documentation() {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [videos, setVideos] = useState<ProductVideo[]>([]);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isLoadingVideos, setIsLoadingVideos] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [processingDocs] = useState<Set<number>>(new Set());
  const [documentProductSavingId, setDocumentProductSavingId] = useState<number | null>(null);
  const [videoProductSavingId, setVideoProductSavingId] = useState<number | null>(null);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [videoError, setVideoError] = useState<string>('');
  const [videoSuccess, setVideoSuccess] = useState<string>('');
  const [selectedProductForUpload, setSelectedProductForUpload] = useState<ProductSummary | null>(null);
  const [selectedFileForUpload, setSelectedFileForUpload] = useState<File | null>(null);
  const [selectedProductForVideo, setSelectedProductForVideo] = useState<ProductSummary | null>(null);
  const [activeDocumentEditor, setActiveDocumentEditor] = useState<number | null>(null);
  const [activeVideoEditor, setActiveVideoEditor] = useState<number | null>(null);
  const [newVideoUrl, setNewVideoUrl] = useState('');
  const [newVideoTitle, setNewVideoTitle] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void loadDocuments();
    void loadVideos();
  }, []);

  const loadDocuments = async () => {
    setIsLoadingDocuments(true);
    setError('');
    try {
      const response = await fetch('/api/get-documents');
      const data = (await response.json()) as GetDocumentsResponse;
      if (data.success) {
        setDocuments(data.documents || []);
      } else {
        setError(data.error || data.details || 'Error al cargar documentos');
      }
    } catch (err) {
      setError('Error al conectarse con el servidor');
      console.error('Error loading documents:', err);
    } finally {
      setIsLoadingDocuments(false);
    }
  };

  const loadVideos = async () => {
    setIsLoadingVideos(true);
    setVideoError('');
    try {
      const response = await fetch('/api/get-product-videos');
      const data = (await response.json()) as GetVideosResponse;
      if (data.success) {
        setVideos(data.videos || []);
      } else {
        setVideoError(data.error || data.details || 'Error al cargar videos');
      }
    } catch (err) {
      setVideoError('Error al conectarse con el servidor');
      console.error('Error loading videos:', err);
    } finally {
      setIsLoadingVideos(false);
    }
  };

  // Función para extraer texto de PDF en el cliente
  const extractTextFromPDF = async (file: File): Promise<string> => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let fullText = '';

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ');
        fullText += pageText + '\n';
      }

      return fullText;
    } catch (error) {
      console.error('Error extracting PDF text:', error);
      throw new Error('No se pudo extraer el texto del PDF');
    }
  };

  // Función para extraer texto de archivos de texto
  const extractTextFromTextFile = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        resolve(text);
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsText(file);
    });
  };

  const resetSelectedFile = () => {
    setSelectedFileForUpload(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileAsDataURL = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result !== 'string') {
          reject(new Error('No se pudo leer el archivo'));
          return;
        }
        resolve(result);
      };
      reader.onerror = () => reject(new Error('Error al leer el archivo'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      setError(`El archivo es demasiado grande. Máximo: ${(MAX_FILE_SIZE / 1024 / 1024).toFixed(0)}MB`);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      return;
    }

    setError('');
    setSuccess('');
    setSelectedFileForUpload(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleUploadSelectedFile = async () => {
    if (!selectedFileForUpload) {
      setError('Selecciona un archivo antes de subir.');
      return;
    }

    const file = selectedFileForUpload;
    setIsUploading(true);
    setError('');
    setSuccess('');

    try {
      // Extraer texto en el cliente antes de subir
      let extractedText = '';
      const extension = file.name.split('.').pop()?.toLowerCase() || '';
      const mimeType = file.type || '';

      try {
        if (extension === 'pdf' || mimeType.includes('pdf')) {
          console.log('Extracting text from PDF in client...');
          extractedText = await extractTextFromPDF(file);
          console.log('PDF text extracted:', extractedText.length, 'characters');
        } else if (
          extension === 'txt' ||
          extension === 'md' ||
          mimeType.includes('text/plain') ||
          mimeType.includes('text/markdown')
        ) {
          console.log('Extracting text from text file...');
          extractedText = await extractTextFromTextFile(file);
          console.log('Text file extracted:', extractedText.length, 'characters');
        }
      } catch (extractError) {
        console.warn('Error extracting text, continuing without it:', extractError);
        // Continuar sin texto extraído
      }

      // Limitar texto extraído a 50KB
      const maxTextLength = 50 * 1024;
      if (extractedText.length > maxTextLength) {
        extractedText = extractedText.substring(0, maxTextLength) + '...[truncado]';
      }

      const base64String = await readFileAsDataURL(file);
      const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;

      console.log('Sending request:', {
        filename: file.name,
        size: file.size,
        extractedTextLength: extractedText.length
      });

      const response = await fetch('/api/upload-document', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file: base64Data,
          filename: file.name,
          mimeType: file.type || '',
          extractedText: extractedText, // Enviar texto extraído
          productId: selectedProductForUpload?.id ?? null,
        })
      });

      console.log('Response status:', response.status);
      const responseText = await response.text();
      console.log('Response text:', responseText.substring(0, 200));

      let data: any;
      try {
        data = JSON.parse(responseText);
      } catch (parseErr) {
        console.error('Error parsing JSON:', parseErr);
        setError(`Error del servidor (${response.status}): ${responseText.substring(0, 100)}`);
        return;
      }

      if (response.ok && data.success) {
        setSuccess(`Archivo "${file.name}" subido correctamente${extractedText ? ' con texto extraído' : ''}`);
        resetSelectedFile();
        setSelectedProductForUpload(null);

        // Recargar documentos para mostrar el nuevo
        await loadDocuments();
      } else {
        // Manejar errores específicos de timeout o conexión
        let errorMessage = data.error || 'Error al subir el archivo';
        
        if (data.details) {
          errorMessage += `: ${data.details}`;
        }
        
        // Mensajes más amigables para errores comunes
        if (errorMessage.includes('timeout') || errorMessage.includes('520') || errorMessage.includes('conexión')) {
          errorMessage = 'Error de conexión: El archivo es demasiado grande o hay un problema temporal con el servidor. Por favor, intenta de nuevo en unos momentos o con un archivo más pequeño.';
        } else if (errorMessage.includes('Database error')) {
          errorMessage = 'Error al guardar en la base de datos. Por favor, verifica que Supabase Storage esté configurado correctamente.';
        }
        
        const extraDetails = [data.code, data.hint].filter(Boolean);
        if (extraDetails.length > 0) {
          errorMessage += ` (${extraDetails.join(' • ')})`;
        }
        
        setError(errorMessage || `Error al subir el archivo (${response.status})`);
      }
    } catch (err) {
      let errorMessage = 'Error al procesar el archivo';
      
      if (err instanceof Error) {
        errorMessage = err.message;
        
        // Mensajes más específicos para errores de red
        if (err.message.includes('Failed to fetch') || err.message.includes('NetworkError')) {
          errorMessage = 'Error de conexión: No se pudo conectar con el servidor. Por favor, verifica tu conexión a internet e intenta de nuevo.';
        } else if (err.message.includes('timeout')) {
          errorMessage = 'Timeout: El archivo es demasiado grande o la conexión es lenta. Por favor, intenta con un archivo más pequeño.';
        }
      }
      
      setError(errorMessage);
      console.error('Error uploading file:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Esta función ya no es necesaria porque extraemos el texto en el cliente
  // Pero la mantenemos por si acaso algún documento antiguo necesita procesarse
  const extractDocumentText = async (_documentId: number) => {
    setError('La extracción de texto ahora se hace en el cliente. Por favor, vuelve a subir el documento.');
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

  const handleAssignProductToDocument = async (documentId: number, product: ProductSummary | null) => {
    setDocumentProductSavingId(documentId);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/update-document', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: documentId,
          productId: product?.id ?? null
        })
      });

      const data = await response.json();
      if (data.success) {
        setDocuments(prev =>
          prev.map(doc =>
            doc.id === documentId
              ? {
                  ...doc,
                  product_id: product?.id ?? null,
                  product_name: product?.name ?? null,
                  product_sku: product?.sku ?? null,
                  product_url: product?.product_url ?? null
                }
              : doc
          )
        );
        setSuccess(product ? 'Producto asignado al documento correctamente' : 'Se eliminó la asignación de producto del documento');
        setActiveDocumentEditor(null);
      } else {
        setError(data.error || data.details || 'No se pudo asignar el producto al documento');
      }
    } catch (err) {
      console.error('Error asignando producto al documento:', err);
      setError('Error al conectarse con el servidor al asignar el producto');
    } finally {
      setDocumentProductSavingId(null);
    }
  };

  const handleCreateVideo = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const url = newVideoUrl.trim();
    const title = newVideoTitle.trim();

    if (!url) {
      setVideoError('La URL de YouTube es obligatoria');
      return;
    }

    setVideoError('');
    setVideoSuccess('');

    try {
      const response = await fetch('/api/create-product-video', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          youtubeUrl: url,
          title: title || null,
          productId: selectedProductForVideo?.id ?? null
        })
      });

      const data = await response.json();
      if (data.success) {
        setVideoSuccess('Video de YouTube guardado correctamente');
        setNewVideoUrl('');
        setNewVideoTitle('');
        setSelectedProductForVideo(null);
        await loadVideos();
      } else {
        setVideoError(data.error || data.details || 'No se pudo guardar el video');
      }
    } catch (err) {
      console.error('Error creando video:', err);
      setVideoError('Error al conectarse con el servidor al crear el video');
    }
  };

  const handleDeleteVideo = async (videoId: number, title: string) => {
    if (!confirm(`¿Eliminar el video "${title}"?`)) return;
    try {
      const response = await fetch(`/api/delete-product-video?id=${videoId}`, {
        method: 'DELETE'
      });
      const data = await response.json();
      if (data.success) {
        setVideoSuccess('Video eliminado correctamente');
        await loadVideos();
      } else {
        setVideoError(data.error || data.details || 'No se pudo eliminar el video');
      }
    } catch (err) {
      console.error('Error eliminando video:', err);
      setVideoError('Error al conectarse con el servidor al eliminar el video');
    }
  };

  const handleAssignProductToVideo = async (videoId: number, product: ProductSummary | null) => {
    setVideoProductSavingId(videoId);
    setVideoError('');
    setVideoSuccess('');
    try {
      const response = await fetch('/api/update-product-video', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          id: videoId,
          productId: product?.id ?? null
        })
      });

      const data = await response.json();
      if (data.success) {
        setVideos(prev =>
          prev.map(video =>
            video.id === videoId
              ? {
                  ...video,
                  product_id: product?.id ?? null,
                  product_name: product?.name ?? null,
                  product_sku: product?.sku ?? null,
                  product_url: product?.product_url ?? null
                }
              : video
          )
        );
        setVideoSuccess(product ? 'Producto asignado al video correctamente' : 'Se eliminó la asignación de producto del video');
        setActiveVideoEditor(null);
      } else {
        setVideoError(data.error || data.details || 'No se pudo asignar el producto al video');
      }
    } catch (err) {
      console.error('Error asignando producto al video:', err);
      setVideoError('Error al conectarse con el servidor al asignar el producto');
    } finally {
      setVideoProductSavingId(null);
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

      {videoError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          {videoError}
        </div>
      )}

      {videoSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          {videoSuccess}
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
        {selectedFileForUpload && (
          <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium text-slate-900">{selectedFileForUpload.name}</p>
              <p className="text-xs text-slate-500">
                {formatFileSize(selectedFileForUpload.size)} •{' '}
                {selectedFileForUpload.type || 'Tipo desconocido'}
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-2">
              <button
                type="button"
                onClick={() => void handleUploadSelectedFile()}
                disabled={isUploading}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-400"
              >
                {isUploading ? 'Subiendo...' : 'Subir documento'}
              </button>
              <button
                type="button"
                onClick={resetSelectedFile}
                disabled={isUploading}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Quitar archivo
              </button>
            </div>
          </div>
        )}
        <div className="mt-4">
          <ProductSelector
            label="Asignar a un producto"
            helperText="Opcional: vincula el documento a un producto para que la IA pueda usarlo como contexto."
            selectedProduct={selectedProductForUpload}
            onChange={setSelectedProductForUpload}
            inputName="document-product-search"
            disabled={isUploading}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold mb-4">Documentos ({documents.length})</h3>
        {isLoadingDocuments ? (
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
                    <div className="mt-2 space-y-1">
                      {doc.product_id && doc.product_name && doc.product_sku ? (
                        <p className="text-sm text-slate-600">
                          Producto vinculado:{' '}
                          <span className="font-semibold text-slate-800">{doc.product_name}</span>{' '}
                          <span className="text-xs text-slate-500">(SKU: {doc.product_sku})</span>{' '}
                          {doc.product_url && (
                            <a
                              href={doc.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Ver producto
                            </a>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Sin producto asignado</p>
                      )}
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() =>
                          setActiveDocumentEditor((current) => (current === doc.id ? null : doc.id))
                        }
                      >
                        {activeDocumentEditor === doc.id ? 'Cerrar selector' : 'Asignar / editar producto'}
                      </button>
                      {activeDocumentEditor === doc.id && (
                        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
                          <ProductSelector
                            selectedProduct={
                              doc.product_id && doc.product_name && doc.product_sku
                                ? {
                                    id: doc.product_id,
                                    name: doc.product_name,
                                    sku: doc.product_sku,
                                    product_url: doc.product_url ?? undefined,
                                  }
                                : null
                            }
                            onChange={(product) => {
                              void handleAssignProductToDocument(doc.id, product);
                            }}
                            disabled={documentProductSavingId === doc.id}
                            inputName={`document-selector-${doc.id}`}
                            helperText="Busca y selecciona el producto correspondiente o quita la asignación."
                          />
                          {documentProductSavingId === doc.id && (
                            <p className="text-xs text-slate-500">Guardando asignación...</p>
                          )}
                        </div>
                      )}
                    </div>
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

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-lg font-semibold">Videos de YouTube ({videos.length})</h3>
        </div>

        <form className="mt-4 space-y-4" onSubmit={handleCreateVideo}>
          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="youtube-url">
              URL de YouTube
            </label>
            <input
              id="youtube-url"
              type="url"
              value={newVideoUrl}
              onChange={(event) => setNewVideoUrl(event.target.value)}
              placeholder="https://www.youtube.com/watch?v=..."
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700" htmlFor="youtube-title">
              Título (opcional)
            </label>
            <input
              id="youtube-title"
              type="text"
              value={newVideoTitle}
              onChange={(event) => setNewVideoTitle(event.target.value)}
              placeholder="Título descriptivo para identificar el video"
              className="mt-1 block w-full rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/40"
            />
          </div>

          <ProductSelector
            label="Asignar a un producto"
            helperText="Opcional: vincula el video a un producto para que la IA lo tenga en cuenta."
            selectedProduct={selectedProductForVideo}
            onChange={setSelectedProductForVideo}
            inputName="video-product-search"
          />

          <button
            type="submit"
            className="inline-flex items-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
          >
            Guardar video
          </button>
        </form>

        <div className="mt-6">
          {isLoadingVideos ? (
            <p className="text-slate-500">Cargando videos...</p>
          ) : videos.length === 0 ? (
            <p className="text-slate-500">No hay videos registrados</p>
          ) : (
            <div className="space-y-3">
              {videos.map((video) => (
                <div
                  key={video.id}
                  className="flex flex-col gap-3 rounded-lg border border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex-1 space-y-1">
                    <p className="font-medium text-slate-900">{video.title || 'Sin título'}</p>
                    <a
                      href={video.youtube_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
                    >
                      {video.youtube_url}
                    </a>
                    <p className="text-xs text-slate-500">Creado el {formatDate(video.created_at)}</p>
                    <div className="mt-2 space-y-1">
                      {video.product_id && video.product_name && video.product_sku ? (
                        <p className="text-sm text-slate-600">
                          Producto vinculado:{' '}
                          <span className="font-semibold text-slate-800">{video.product_name}</span>{' '}
                          <span className="text-xs text-slate-500">(SKU: {video.product_sku})</span>{' '}
                          {video.product_url && (
                            <a
                              href={video.product_url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              Ver producto
                            </a>
                          )}
                        </p>
                      ) : (
                        <p className="text-sm text-slate-500">Sin producto asignado</p>
                      )}
                      <button
                        type="button"
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                        onClick={() =>
                          setActiveVideoEditor((current) => (current === video.id ? null : video.id))
                        }
                      >
                        {activeVideoEditor === video.id ? 'Cerrar selector' : 'Asignar / editar producto'}
                      </button>
                      {activeVideoEditor === video.id && (
                        <div className="mt-2 space-y-2 rounded-lg border border-slate-200 p-3">
                          <ProductSelector
                            selectedProduct={
                              video.product_id && video.product_name && video.product_sku
                                ? {
                                    id: video.product_id,
                                    name: video.product_name,
                                    sku: video.product_sku,
                                    product_url: video.product_url ?? undefined,
                                  }
                                : null
                            }
                            onChange={(product) => {
                              void handleAssignProductToVideo(video.id, product);
                            }}
                            disabled={videoProductSavingId === video.id}
                            inputName={`video-selector-${video.id}`}
                            helperText="Busca y selecciona el producto correspondiente o quita la asignación."
                          />
                          {videoProductSavingId === video.id && (
                            <p className="text-xs text-slate-500">Guardando asignación...</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleDeleteVideo(video.id, video.title || video.youtube_url)}
                      className="px-3 py-1 text-sm text-red-600 hover:bg-red-50 border border-red-200 rounded-lg"
                      type="button"
                    >
                      Eliminar
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  activatePrompt,
  processPrompt,
  extractVariablesFromPrompt,
  type SystemPrompt,
  type PromptVariable
} from '../services/promptService';

export function PromptConfig() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [promptDescription, setPromptDescription] = useState('');
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');

  // Cargar prompts al montar
  useEffect(() => {
    loadPrompts();
  }, []);

  // Cuando se selecciona un prompt, cargar sus datos
  useEffect(() => {
    if (selectedPrompt) {
      setPromptName(selectedPrompt.name);
      setPromptText(selectedPrompt.prompt);
      setPromptDescription(selectedPrompt.description || '');
      
      // Extraer variables del prompt y cargar las existentes
      const extractedVars = extractVariablesFromPrompt(selectedPrompt.prompt);
      const existingVars = selectedPrompt.variables || [];
      
      // Combinar variables extraídas con las existentes
      const allVars = extractedVars.map(varName => {
        const existing = existingVars.find(v => v.variable_name === varName);
        return existing || {
          variable_name: varName,
          variable_value: '',
          variable_type: 'text' as const
        };
      });
      
      setVariables(allVars);
    } else {
      // Reset al crear nuevo
      setPromptName('');
      setPromptText('');
      setPromptDescription('');
      setVariables([]);
    }
  }, [selectedPrompt]);

  const loadPrompts = async () => {
    try {
      setIsLoading(true);
      const data = await getPrompts();
      setPrompts(data);
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar prompts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!promptName.trim() || !promptText.trim()) {
      setError('El nombre y el prompt son obligatorios');
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      setSuccess('');

      if (selectedPrompt) {
        // Actualizar
        await updatePrompt(selectedPrompt.id, {
          name: promptName,
          prompt: promptText,
          description: promptDescription || undefined,
          variables: variables.filter(v => v.variable_value.trim() !== '')
        });
        setSuccess('Prompt actualizado correctamente');
      } else {
        // Crear nuevo
        await createPrompt(
          promptName,
          promptText,
          promptDescription || undefined,
          variables.filter(v => v.variable_value.trim() !== ''),
          false
        );
        setSuccess('Prompt creado correctamente');
        setSelectedPrompt(null);
      }

      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al guardar prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivate = async () => {
    if (!selectedPrompt) return;

    try {
      setIsLoading(true);
      setError('');
      await activatePrompt(selectedPrompt.id);
      setSuccess('Prompt activado correctamente');
      await loadPrompts();
      
      // Actualizar el prompt seleccionado
      const updated = await getPrompts();
      const active = updated.find(p => p.is_active);
      if (active) setSelectedPrompt(active);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al activar prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedPrompt) return;
    
    if (!confirm(`¿Estás seguro de que quieres eliminar el prompt "${selectedPrompt.name}"?`)) {
      return;
    }

    try {
      setIsLoading(true);
      setError('');
      await deletePrompt(selectedPrompt.id);
      setSuccess('Prompt eliminado correctamente');
      setSelectedPrompt(null);
      await loadPrompts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar prompt');
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewPrompt = () => {
    setSelectedPrompt(null);
    setPromptName('');
    setPromptText('');
    setPromptDescription('');
    setVariables([]);
    setError('');
    setSuccess('');
  };

  // Extraer variables del texto cuando cambia
  const handlePromptTextChange = (text: string) => {
    setPromptText(text);
    const extractedVars = extractVariablesFromPrompt(text);
    
    // Mantener valores existentes de variables que ya están en el prompt
    const newVars = extractedVars.map(varName => {
      const existing = variables.find(v => v.variable_name === varName);
      return existing || {
        variable_name: varName,
        variable_value: '',
        variable_type: 'text' as const
      };
    });
    
    // Eliminar variables que ya no están en el prompt
    setVariables(newVars.filter(v => extractedVars.includes(v.variable_name)));
  };

  const updateVariable = (index: number, updates: Partial<PromptVariable>) => {
    const newVars = [...variables];
    newVars[index] = { ...newVars[index], ...updates };
    setVariables(newVars);
  };

  // Generar preview del prompt procesado
  const getPreviewText = (): string => {
    if (!promptText) return '';
    
    // Si hay un prompt seleccionado, usar sus datos
    if (selectedPrompt) {
      const tempPrompt: SystemPrompt = {
        ...selectedPrompt,
        prompt: promptText,
        variables: variables
      };
      return processPrompt(tempPrompt);
    }
    
    // Si no hay prompt seleccionado pero hay texto, crear uno temporal
    const tempPrompt: SystemPrompt = {
      id: 'temp',
      name: promptName || 'Preview',
      prompt: promptText,
      variables: variables
    };
    return processPrompt(tempPrompt);
  };

  const previewText = getPreviewText();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Configuración de Prompts
        </h2>
        <p className="text-slate-600">
          Crea y gestiona los prompts del sistema. Los prompts activos se usan en el chat.
        </p>
      </div>

      {/* Mensajes de error/éxito */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            <span>{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800">
          <div className="flex items-center gap-2">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            <span>{success}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Lista de Prompts */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-900">Prompts Guardados</h3>
            <button
              onClick={handleNewPrompt}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-medium"
            >
              + Nuevo Prompt
            </button>
          </div>

          {isLoading && prompts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">Cargando...</div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              No hay prompts guardados. Crea uno nuevo.
            </div>
          ) : (
            <div className="space-y-2">
              {prompts.map((prompt) => (
                <div
                  key={prompt.id}
                  onClick={() => setSelectedPrompt(prompt)}
                  className={`p-4 rounded-lg border cursor-pointer transition ${
                    selectedPrompt?.id === prompt.id
                      ? 'border-indigo-500 bg-indigo-50'
                      : 'border-slate-200 hover:border-slate-300'
                  } ${prompt.is_active ? 'ring-2 ring-green-500 ring-opacity-50' : ''}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-slate-900">{prompt.name}</h4>
                        {prompt.is_active && (
                          <span className="px-2 py-0.5 bg-green-100 text-green-800 text-xs font-medium rounded">
                            Activo
                          </span>
                        )}
                      </div>
                      {prompt.description && (
                        <p className="text-sm text-slate-600 mb-2">{prompt.description}</p>
                      )}
                      <p className="text-xs text-slate-500">
                        {prompt.variables?.length || 0} variables
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Editor de Prompt */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">
            {selectedPrompt ? 'Editar Prompt' : 'Nuevo Prompt'}
          </h3>

          <div className="space-y-4">
            {/* Nombre */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Nombre del Prompt
              </label>
              <input
                type="text"
                value={promptName}
                onChange={(e) => setPromptName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Ej: Prompt para E-commerce"
              />
            </div>

            {/* Descripción */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Descripción (opcional)
              </label>
              <input
                type="text"
                value={promptDescription}
                onChange={(e) => setPromptDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Descripción del prompt"
              />
            </div>

            {/* Texto del Prompt */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Prompt del Sistema
                <span className="text-xs text-slate-500 ml-2">
                  Usa {'{{variable_name}}'} para variables dinámicas
                </span>
              </label>
              <textarea
                value={promptText}
                onChange={(e) => handlePromptTextChange(e.target.value)}
                rows={12}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                placeholder="Escribe tu prompt aquí..."
              />
            </div>

            {/* Variables */}
            {variables.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Variables
                </label>
                <div className="space-y-2">
                  {variables.map((variable, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <span className="text-sm font-mono text-slate-600 min-w-[120px]">
                        {'{{' + variable.variable_name + '}}'}
                      </span>
                      <input
                        type="text"
                        value={variable.variable_value}
                        onChange={(e) => updateVariable(index, { variable_value: e.target.value })}
                        className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                        placeholder="Valor de la variable"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Vista Previa */}
            {previewText && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Vista Previa
                </label>
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                  <pre className="text-sm text-slate-700 whitespace-pre-wrap font-mono">
                    {previewText}
                  </pre>
                </div>
              </div>
            )}

            {/* Botones */}
            <div className="flex gap-2 pt-4">
              <button
                onClick={handleSave}
                disabled={isLoading || !promptName.trim() || !promptText.trim()}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {selectedPrompt ? 'Guardar Cambios' : 'Crear Prompt'}
              </button>
              
              {selectedPrompt && (
                <>
                  <button
                    onClick={handleActivate}
                    disabled={isLoading || selectedPrompt.is_active}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {selectedPrompt.is_active ? 'Activo' : 'Activar'}
                  </button>
                  
                  <button
                    onClick={handleDelete}
                    disabled={isLoading}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Eliminar
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


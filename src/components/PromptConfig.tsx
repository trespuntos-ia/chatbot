import { useState, useEffect, useMemo } from 'react';
import {
  getPrompts,
  createPrompt,
  updatePrompt,
  deletePrompt,
  activatePrompt,
  processPrompt,
  extractVariablesFromPrompt,
  generateSystemPrompt
} from '../services/promptService';
import {
  getAllSuggestedQueries,
  updateSuggestedQueries,
  type SuggestedQuery
} from '../services/suggestedQueriesService';
import type {
  SystemPrompt,
  PromptVariable,
  PromptStructuredFields
} from '../types';

const createEmptyStructuredFields = (): PromptStructuredFields => ({
  component: '',
  purpose: '',
  role: '',
  objective: '',
  context: '',
  audience: '',
  task: '',
  restrictions: '',
  tone: ''
});

export function PromptConfig() {
  const [prompts, setPrompts] = useState<SystemPrompt[]>([]);
  const [selectedPrompt, setSelectedPrompt] = useState<SystemPrompt | null>(null);
  const [promptName, setPromptName] = useState('');
  const [promptText, setPromptText] = useState('');
  const [structuredFields, setStructuredFields] = useState<PromptStructuredFields>(() => createEmptyStructuredFields());
  const [variables, setVariables] = useState<PromptVariable[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);
  const structuredFieldConfig = useMemo(
    () => ([
      {
        key: 'component' as const,
        label: 'Componente que debe generar la IA',
        placeholder: 'Ej: Manual de uso del Dashboard de Analytics',
        multiline: false
      },
      {
        key: 'purpose' as const,
        label: 'Descripción y propósito',
        placeholder: 'Explica qué se busca conseguir con este prompt y por qué es importante',
        multiline: true
      },
      {
        key: 'role' as const,
        label: 'Rol',
        placeholder: 'Ej: Actúa como un profesional del growth marketing especializado en ecommerce',
        multiline: false
      },
      {
        key: 'objective' as const,
        label: 'Objetivo',
        placeholder: 'Define el objetivo central de la interacción que debe guiar al modelo',
        multiline: true
      },
      {
        key: 'context' as const,
        label: 'Contexto',
        placeholder: 'Describe el escenario, negocio o condiciones de partida',
        multiline: true
      },
      {
        key: 'audience' as const,
        label: 'Audiencia',
        placeholder: '¿Para quién es la respuesta o a quién se dirige la marca?',
        multiline: true
      },
      {
        key: 'task' as const,
        label: 'Tarea',
        placeholder: 'Detalla las acciones específicas y el formato de salida esperado',
        multiline: true
      },
      {
        key: 'restrictions' as const,
        label: 'Restricciones',
        placeholder: 'Incluye límites obligatorios: extensión, temas prohibidos, etc.',
        multiline: true
      },
      {
        key: 'tone' as const,
        label: 'Tono',
        placeholder: 'Define el estilo de la respuesta: profesional, cercano, técnico, etc.',
        multiline: false
      }
    ]),
    []
  );

  const structuredFieldLabels = useMemo(
    () => ({
      component: 'Componente que debe generar la IA',
      purpose: 'Descripción y propósito',
      role: 'Rol',
      objective: 'Objetivo',
      context: 'Contexto',
      audience: 'Audiencia',
      task: 'Tarea',
      restrictions: 'Restricciones',
      tone: 'Tono'
    }),
    []
  );

  const handleStructuredFieldChange = (field: keyof PromptStructuredFields, value: string) => {
    setStructuredFields((prev) => ({
      ...prev,
      [field]: value
    }));
  };
  
  // Estado para sugerencias
  const [suggestedQueries, setSuggestedQueries] = useState<SuggestedQuery[]>([]);
  const [isLoadingQueries, setIsLoadingQueries] = useState(false);
  const [queriesError, setQueriesError] = useState<string>('');
  const [queriesSuccess, setQueriesSuccess] = useState<string>('');

  // Cargar prompts y sugerencias al montar
  useEffect(() => {
    loadPrompts();
    loadSuggestedQueries();
  }, []);

  // Cuando se selecciona un prompt, cargar sus datos
  useEffect(() => {
    if (selectedPrompt) {
      setPromptName(selectedPrompt.name);
      setPromptText(selectedPrompt.prompt);
      const baseFields = createEmptyStructuredFields();
      const promptFields = selectedPrompt.structured_fields || null;
      const mergedFields: PromptStructuredFields = {
        ...baseFields,
        ...(promptFields ?? {}),
        purpose: promptFields?.purpose ?? selectedPrompt.description ?? ''
      };
      setStructuredFields(mergedFields);
      
      // Extraer variables del prompt y cargar las existentes
      const extractedVars = extractVariablesFromPrompt(selectedPrompt.prompt);
      const existingVars = selectedPrompt.variables || [];
      
      // Combinar variables extraídas con las existentes
      const allVars = extractedVars.map((varName: string) => {
        const existing = existingVars.find((v: PromptVariable) => v.variable_name === varName);
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
      setStructuredFields(createEmptyStructuredFields());
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

    const missingFields = (Object.keys(structuredFieldLabels) as Array<keyof PromptStructuredFields>)
      .filter((field) => !structuredFields[field]?.trim());

    if (missingFields.length > 0) {
      setError(
        `Completa todos los campos obligatorios: ${missingFields
          .map((field) => structuredFieldLabels[field])
          .join(', ')}`
      );
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
          description: structuredFields.purpose || undefined,
          variables: variables.filter(v => v.variable_value.trim() !== ''),
          structured_fields: structuredFields
        });
        setSuccess('Prompt actualizado correctamente');
      } else {
        // Crear nuevo
        await createPrompt(
          promptName,
          promptText,
          structuredFields.purpose || undefined,
          variables.filter(v => v.variable_value.trim() !== ''),
          false,
          structuredFields
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
    setStructuredFields(createEmptyStructuredFields());
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

  const handleGeneratePrompt = async () => {
    const missingFields = (Object.keys(structuredFieldLabels) as Array<keyof PromptStructuredFields>)
      .filter((field) => !structuredFields[field]?.trim());

    if (missingFields.length > 0) {
      setError(
        `Para generar el prompt completa: ${missingFields
          .map((field) => structuredFieldLabels[field])
          .join(', ')}`
      );
      return;
    }

    try {
      setIsGeneratingPrompt(true);
      setError('');
      setSuccess('');

      const generatedPrompt = await generateSystemPrompt(structuredFields);
      handlePromptTextChange(generatedPrompt);
      setSuccess('Prompt generado con IA correctamente');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo generar el prompt con IA');
    } finally {
      setIsGeneratingPrompt(false);
    }
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
      is_active: false,
      variables: variables
    };
    return processPrompt(tempPrompt);
  };

  const loadSuggestedQueries = async () => {
    try {
      setIsLoadingQueries(true);
      setQueriesError('');
      const queries = await getAllSuggestedQueries();
      // Ordenar por display_order
      queries.sort((a, b) => a.display_order - b.display_order);
      setSuggestedQueries(queries);
    } catch (err) {
      setQueriesError(err instanceof Error ? err.message : 'Error al cargar sugerencias');
    } finally {
      setIsLoadingQueries(false);
    }
  };

  const handleSaveQueries = async () => {
    try {
      setIsLoadingQueries(true);
      setQueriesError('');
      setQueriesSuccess('');
      
      // Preparar queries para guardar (sin id, created_at, updated_at)
      const queriesToSave = suggestedQueries.map((q, index) => ({
        query_text: q.query_text,
        display_order: index + 1,
        is_active: q.is_active
      }));

      await updateSuggestedQueries(queriesToSave);
      setQueriesSuccess('Sugerencias guardadas correctamente');
      await loadSuggestedQueries();
    } catch (err) {
      setQueriesError(err instanceof Error ? err.message : 'Error al guardar sugerencias');
    } finally {
      setIsLoadingQueries(false);
    }
  };

  const handleAddQuery = () => {
    setSuggestedQueries([
      ...suggestedQueries,
      {
        id: `temp-${Date.now()}`,
        query_text: '',
        display_order: suggestedQueries.length + 1,
        is_active: true
      }
    ]);
  };

  const handleRemoveQuery = (index: number) => {
    const newQueries = suggestedQueries.filter((_, i) => i !== index);
    // Reordenar
    newQueries.forEach((q, i) => {
      q.display_order = i + 1;
    });
    setSuggestedQueries(newQueries);
  };

  const handleUpdateQuery = (index: number, updates: Partial<SuggestedQuery>) => {
    const newQueries = [...suggestedQueries];
    newQueries[index] = { ...newQueries[index], ...updates };
    setSuggestedQueries(newQueries);
  };

  const handleMoveQuery = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === suggestedQueries.length - 1)
    ) {
      return;
    }

    const newQueries = [...suggestedQueries];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    [newQueries[index], newQueries[targetIndex]] = [newQueries[targetIndex], newQueries[index]];
    
    // Actualizar display_order
    newQueries.forEach((q, i) => {
      q.display_order = i + 1;
    });
    
    setSuggestedQueries(newQueries);
  };

  const previewText = getPreviewText();

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-2">
          Configuración AI
        </h2>
        <p className="text-slate-600">
          Crea y gestiona los prompts del sistema y las sugerencias de búsqueda del chat.
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

            {/* Campos estructurados */}
            <div className="grid grid-cols-1 gap-4">
              {structuredFieldConfig.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    {field.label}
                  </label>
                  {field.multiline ? (
                    <textarea
                      value={structuredFields[field.key]}
                      onChange={(e) => handleStructuredFieldChange(field.key, e.target.value)}
                      rows={field.key === 'task' ? 4 : 3}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={field.placeholder}
                    />
                  ) : (
                    <input
                      type="text"
                      value={structuredFields[field.key]}
                      onChange={(e) => handleStructuredFieldChange(field.key, e.target.value)}
                      className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                      placeholder={field.placeholder}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Texto del Prompt */}
            <div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3 mb-2">
                <div>
                  <label className="block text-sm font-medium text-slate-700">
                    Prompt del Sistema
                  </label>
                  <p className="text-xs text-slate-500">
                    Usa {'{{variable_name}}'} para variables dinámicas
                  </p>
                </div>
                <button
                  onClick={handleGeneratePrompt}
                  type="button"
                  disabled={isGeneratingPrompt}
                  className="inline-flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition text-sm font-medium disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isGeneratingPrompt ? 'Generando...' : 'Generar prompt con IA'}
                </button>
              </div>
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

      {/* Sección de Sugerencias de Búsqueda */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Sugerencias de Búsqueda
          </h3>
          <p className="text-sm text-slate-600">
            Gestiona las sugerencias que aparecen debajo del input en el estado inicial del chat.
          </p>
        </div>

        {/* Mensajes de error/éxito para sugerencias */}
        {queriesError && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-800 mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
              <span>{queriesError}</span>
            </div>
          </div>
        )}

        {queriesSuccess && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-green-800 mb-4">
            <div className="flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              <span>{queriesSuccess}</span>
            </div>
          </div>
        )}

        {isLoadingQueries && suggestedQueries.length === 0 ? (
          <div className="text-center py-8 text-slate-500">Cargando sugerencias...</div>
        ) : (
          <div className="space-y-4">
            {suggestedQueries.map((query, index) => (
              <div key={query.id} className="flex items-center gap-3 p-4 border border-slate-200 rounded-lg">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveQuery(index, 'up')}
                    disabled={index === 0}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover arriba"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleMoveQuery(index, 'down')}
                    disabled={index === suggestedQueries.length - 1}
                    className="p-1 text-slate-400 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Mover abajo"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                <div className="flex-1">
                  <input
                    type="text"
                    value={query.query_text}
                    onChange={(e) => handleUpdateQuery(index, { query_text: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                    placeholder="Texto de la sugerencia..."
                  />
                </div>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={query.is_active}
                    onChange={(e) => handleUpdateQuery(index, { is_active: e.target.checked })}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500"
                  />
                  <span className="text-sm text-slate-600">Activa</span>
                </label>

                <button
                  onClick={() => handleRemoveQuery(index)}
                  className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg transition"
                  title="Eliminar"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            ))}

            <div className="flex gap-2">
              <button
                onClick={handleAddQuery}
                className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition text-sm font-medium"
              >
                + Añadir Sugerencia
              </button>
              <button
                onClick={handleSaveQueries}
                disabled={isLoadingQueries}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingQueries ? 'Guardando...' : 'Guardar Sugerencias'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


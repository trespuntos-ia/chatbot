import { useState, useEffect } from 'react';
import { DEFAULT_CHAT_CONFIG, AVAILABLE_MODELS } from '../services/chatService';
import type { ChatConfig } from '../types';

interface ChatConfigProps {
  config: ChatConfig;
  onConfigChange: (config: ChatConfig) => void;
}

export function ChatConfig({ config, onConfigChange }: ChatConfigProps) {
  const [localConfig, setLocalConfig] = useState<ChatConfig>(config);

  useEffect(() => {
    // Si el config recibido es diferente al local, actualizar
    // Esto asegura que si DEFAULT_CHAT_CONFIG cambia, se actualice el componente
    if (JSON.stringify(config) !== JSON.stringify(localConfig)) {
      setLocalConfig(config);
    }
  }, [config]);

  const handleChange = (updates: Partial<ChatConfig>) => {
    const newConfig = { ...localConfig, ...updates };
    setLocalConfig(newConfig);
    onConfigChange(newConfig);
  };

  const handleReset = () => {
    const defaultConfig = DEFAULT_CHAT_CONFIG;
    setLocalConfig(defaultConfig);
    onConfigChange(defaultConfig);
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-slate-900">
          ⚙️ Configuración Rápida
        </h3>
        <button
          onClick={handleReset}
          className="text-sm text-slate-600 hover:text-slate-900"
        >
          Restaurar por defecto
        </button>
      </div>

      <div className="space-y-4">
        {/* Modelo */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Modelo
          </label>
          <select
            value={localConfig.model}
            onChange={(e) => handleChange({ model: e.target.value })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          >
            {AVAILABLE_MODELS.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        {/* Temperatura */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Temperatura: {localConfig.temperature}
            <span className="text-xs text-slate-500 ml-2">
              (0 = Determinista, 2 = Muy creativo)
            </span>
          </label>
          <input
            type="range"
            min="0"
            max="2"
            step="0.1"
            value={localConfig.temperature}
            onChange={(e) => handleChange({ temperature: parseFloat(e.target.value) })}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-slate-500 mt-1">
            <span>0</span>
            <span>1</span>
            <span>2</span>
          </div>
        </div>

        {/* Max Tokens */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">
            Max Tokens
          </label>
          <input
            type="number"
            min="100"
            max="4000"
            step="100"
            value={localConfig.max_tokens}
            onChange={(e) => handleChange({ max_tokens: parseInt(e.target.value) })}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
          />
        </div>

        {/* Advanced Options (Collapsible) */}
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-700 hover:text-slate-900">
            Opciones Avanzadas
          </summary>
          <div className="mt-3 space-y-4 pl-4 border-l-2 border-slate-200">
            {/* Top P */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Top P: {localConfig.top_p || 1.0}
              </label>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={localConfig.top_p || 1.0}
                onChange={(e) => handleChange({ top_p: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Frequency Penalty */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Frequency Penalty: {localConfig.frequency_penalty || 0.0}
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={localConfig.frequency_penalty || 0.0}
                onChange={(e) => handleChange({ frequency_penalty: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>

            {/* Presence Penalty */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Presence Penalty: {localConfig.presence_penalty || 0.0}
              </label>
              <input
                type="range"
                min="-2"
                max="2"
                step="0.1"
                value={localConfig.presence_penalty || 0.0}
                onChange={(e) => handleChange({ presence_penalty: parseFloat(e.target.value) })}
                className="w-full"
              />
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}


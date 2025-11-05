import type { MessageSource } from '../types';

/**
 * Etiquetas traducidas para las fuentes de información
 */
export const SOURCE_LABELS: Record<MessageSource, string> = {
  'products_db': 'Base de datos de productos',
  'web': 'Información de la web',
  'documents': 'Documentación',
  'general': 'Información general'
};

/**
 * Iconos para cada fuente
 */
export const SOURCE_ICONS: Record<MessageSource, string> = {
  'products_db': '📦',
  'web': '🌐',
  'documents': '📄',
  'general': '💬'
};

/**
 * Obtener etiqueta formateada para una fuente
 */
export function getSourceLabel(source: MessageSource): string {
  return SOURCE_LABELS[source] || source;
}

/**
 * Obtener icono para una fuente
 */
export function getSourceIcon(source: MessageSource): string {
  return SOURCE_ICONS[source] || '📋';
}

/**
 * Formatear múltiples fuentes
 */
export function formatSources(sources: MessageSource[]): string {
  if (!sources || sources.length === 0) {
    return '';
  }

  if (sources.length === 1) {
    const icon = getSourceIcon(sources[0]);
    const label = getSourceLabel(sources[0]);
    return `${icon} ${label}`;
  }

  // Si hay múltiples fuentes, enumerarlas de forma más clara
  const formattedSources = sources.map((source) => {
    const icon = getSourceIcon(source);
    const label = getSourceLabel(source);
    return `${icon} ${label}`;
  });

  return formattedSources.join(', ');
}

/**
 * Obtener texto descriptivo para las fuentes
 */
export function getSourcesDescription(sources: MessageSource[]): string {
  if (!sources || sources.length === 0) {
    return 'Información general';
  }

  if (sources.length === 1) {
    return `Obtuve esta información de: ${formatSources(sources)}`;
  }

  return `Obtuve esta información de: ${formatSources(sources)}`;
}


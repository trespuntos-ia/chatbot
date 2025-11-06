const API_BASE = '/api';

export interface SuggestedQuery {
  id: string;
  query_text: string;
  display_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SuggestedQueriesResponse {
  success: boolean;
  queries?: SuggestedQuery[];
  query?: SuggestedQuery;
  message?: string;
  error?: string;
}

/**
 * Obtener todas las sugerencias activas
 */
export async function getSuggestedQueries(): Promise<SuggestedQuery[]> {
  try {
    const response = await fetch(`${API_BASE}/suggested-queries`);
    
    if (!response.ok) {
      throw new Error(`Error fetching suggested queries: ${response.statusText}`);
    }

    const data: SuggestedQueriesResponse = await response.json();
    
    if (data.success && data.queries) {
      return data.queries;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting suggested queries:', error);
    return [];
  }
}

/**
 * Obtener todas las sugerencias (incluyendo inactivas) - para admin
 */
export async function getAllSuggestedQueries(): Promise<SuggestedQuery[]> {
  try {
    const response = await fetch(`${API_BASE}/suggested-queries?all=true`);
    
    if (!response.ok) {
      throw new Error(`Error fetching suggested queries: ${response.statusText}`);
    }

    const data: SuggestedQueriesResponse = await response.json();
    
    if (data.success && data.queries) {
      return data.queries;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting all suggested queries:', error);
    return [];
  }
}

/**
 * Crear una nueva sugerencia
 */
export async function createSuggestedQuery(
  queryText: string,
  displayOrder: number = 0,
  isActive: boolean = true
): Promise<SuggestedQuery> {
  try {
    const response = await fetch(`${API_BASE}/suggested-queries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query_text: queryText,
        display_order: displayOrder,
        is_active: isActive
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error creating suggested query: ${response.statusText}`);
    }

    const data: SuggestedQueriesResponse = await response.json();
    
    if (data.success && data.query) {
      return data.query;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error creating suggested query:', error);
    throw error;
  }
}

/**
 * Actualizar todas las sugerencias (reemplaza todas)
 */
export async function updateSuggestedQueries(
  queries: Omit<SuggestedQuery, 'id' | 'created_at' | 'updated_at'>[]
): Promise<SuggestedQuery[]> {
  try {
    const response = await fetch(`${API_BASE}/suggested-queries`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        queries: queries
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error updating suggested queries: ${response.statusText}`);
    }

    const data: SuggestedQueriesResponse = await response.json();
    
    if (data.success && data.queries) {
      return data.queries;
    }
    
    throw new Error('Invalid response format');
  } catch (error) {
    console.error('Error updating suggested queries:', error);
    throw error;
  }
}

/**
 * Eliminar una sugerencia
 */
export async function deleteSuggestedQuery(id: string): Promise<void> {
  try {
    const response = await fetch(`${API_BASE}/suggested-queries?id=${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `Error deleting suggested query: ${response.statusText}`);
    }
  } catch (error) {
    console.error('Error deleting suggested query:', error);
    throw error;
  }
}


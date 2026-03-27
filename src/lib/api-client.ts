import { useAuthStore } from './auth-store';

const API_URL = '/api';

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const store = useAuthStore.getState();
  const token = store.token;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (response.status === 401 && store.refreshToken && !endpoint.includes('/auth/refresh')) {
    // Attempt to refresh token
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: store.refreshToken }),
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        store.setTokens(data.accessToken, data.refreshToken);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
        });
      } else {
        store.logout();
        throw new Error('Session expired. Please log in again.');
      }
    } catch (refreshError) {
      store.logout();
      throw refreshError;
    }
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: 'An error occurred' }));
    if (response.status === 401) store.logout();
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }

  return response.json();
}

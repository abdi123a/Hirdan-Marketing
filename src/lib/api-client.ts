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
    credentials: 'include', // Ensure cookies are sent (for refresh token)
  });

  if (response.status === 401 && store.isAuthenticated && !endpoint.includes('/auth/refresh')) {
    // Attempt to refresh token using HttpOnly cookie
    try {
      const refreshRes = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        store.setToken(data.accessToken);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(`${API_URL}${endpoint}`, {
          ...options,
          headers,
          credentials: 'include',
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

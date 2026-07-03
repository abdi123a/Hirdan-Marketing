import { useAuthStore } from './auth-store';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

// Helper to ensure path concatenation is safe (no double slashes, ensures leading slash)
function getFullUrl(endpoint: string): string {
  // If the endpoint is already an absolute URL, return it
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;

  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
  
  // If it starts with /uploads, it's a root-relative path serving binary/static content
  // We keep it as is unless we need to prepends the host (in development)
  if (endpoint.startsWith('/uploads/')) {
    // If base is an absolute URL (like http://localhost:3000/api), 
    // we extract the host to correctly point to the backend's /uploads
    try {
      if (base.startsWith('http')) {
        const url = new URL(base);
        return `${url.origin}${endpoint}`;
      }
    } catch (e) {
      // Fallback to relative
    }
    return endpoint;
  }
  
  // Check if API_BASE ends with '/api' and endpoint starts with '/api' or 'api'
  // to prevent double prefixing like /api/api/...
  let cleanEndpoint = endpoint;
  if (base.toLowerCase().endsWith('/api')) {
    cleanEndpoint = endpoint.replace(/^(\/)?api\//i, '/');
  }
  
  const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  return `${base}${path}`;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const store = useAuthStore.getState();
  const token = store.token;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...((options.headers as any) || {}),
  };

  if (headers['Content-Type'] === 'SKIP') {
    delete headers['Content-Type'];
  }

  const url = getFullUrl(endpoint);
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include', // Ensure cookies are sent (for refresh token)
  });

  if (response.status === 401 && store.isAuthenticated && !endpoint.includes('/auth/refresh')) {
    // Attempt to refresh token using HttpOnly cookie
    try {
      const refreshRes = await fetch(getFullUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        store.setToken(data.accessToken);
        
        // Retry original request with new token
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(url, {
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
    const errorData = await response.json().catch(() => ({ message: 'An error occurred' }));
    if (response.status === 401) store.logout();
    const errorMsg = typeof errorData.message === 'string' ? errorData.message : 
                    (typeof errorData.error === 'string' ? errorData.error : `HTTP error! status: ${response.status}`);
    throw new Error(errorMsg);
  }

  return response.json();
}

/**
 * Fetches a file as a Blob with authentication.
 * Useful for protected files that need to be previewed or downloaded securely.
 */
export async function apiFetchBlob(endpoint: string, options: RequestInit = {}): Promise<Blob> {
  const store = useAuthStore.getState();
  const token = store.token;
  
  const headers: Record<string, string> = {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...((options.headers as any) || {}),
  };

  const url = getFullUrl(endpoint);
  let response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (response.status === 401 && store.isAuthenticated && !endpoint.includes('/auth/refresh')) {
    try {
      const refreshRes = await fetch(getFullUrl('/auth/refresh'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
      });

      if (refreshRes.ok) {
        const data = await refreshRes.json();
        store.setToken(data.accessToken);
        
        headers['Authorization'] = `Bearer ${data.accessToken}`;
        response = await fetch(url, {
          ...options,
          headers,
          credentials: 'include',
        });
      } else {
        store.logout();
        throw new Error('Session expired');
      }
    } catch (refreshError) {
      store.logout();
      throw refreshError;
    }
  }

  if (!response.ok) {
    const errorMsg = `Failed to fetch file: ${response.status} ${response.statusText}`;
    throw new Error(errorMsg);
  }

  return response.blob();
}

/**
 * Triggers a secure download for a protected file.
 */
export async function downloadProtectedFile(url: string, filename: string) {
  try {
    const endpoint = url.startsWith('/api') ? url.substring(4) : url;
    const blob = await apiFetchBlob(endpoint);
    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(blobUrl);
  } catch (err) {
    console.error("Secure download failed:", err);
    throw err;
  }
}

export function apiUpload<T>(
  endpoint: string, 
  formData: FormData, 
  onProgress?: (progress: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const store = useAuthStore.getState();
    const token = store.token;

    const xhr = new XMLHttpRequest();
    xhr.open('POST', getFullUrl(endpoint));

    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          const percentComplete = Math.round((event.loaded / event.total) * 100);
          onProgress(percentComplete);
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch (e) {
          resolve({} as T);
        }
      } else if (xhr.status === 401 && store.isAuthenticated && !endpoint.includes('/auth/refresh')) {
        // Attempt to refresh token using HttpOnly cookie (using fetch for the refresh)
        try {
          const refreshRes = await fetch(getFullUrl('/auth/refresh'), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
          });

          if (refreshRes.ok) {
            const data = await refreshRes.json();
            store.setToken(data.accessToken);
            
            // Retry original upload with new token
            apiUpload<T>(endpoint, formData, onProgress).then(resolve).catch(reject);
          } else {
            store.logout();
            reject(new Error('Session expired. Please log in again.'));
          }
        } catch (refreshError) {
          store.logout();
          reject(refreshError);
        }
      } else {
        try {
          const errorData = JSON.parse(xhr.responseText);
          const errorMsg = errorData.message || errorData.error || `HTTP error! status: ${xhr.status}`;
          reject(new Error(errorMsg));
        } catch (e) {
          reject(new Error(`HTTP error! status: ${xhr.status}`));
        }
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.onabort = () => reject(new Error('Upload aborted'));

    xhr.withCredentials = true;
    xhr.send(formData);
  });
}

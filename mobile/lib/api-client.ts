import {
  getAccessToken,
  getRefreshToken,
  setTokens,
  clearTokens,
} from './secure-storage';

const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || 'https://api.hirdanmarketing.com/api';

export function getApiBase(): string {
  return API_BASE.replace(/\/$/, '');
}

export function getFullUrl(endpoint: string): string {
  if (!endpoint) return getApiBase();
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) return endpoint;

  let normalized = endpoint;
  if (normalized.includes('/api/files/branding/')) {
    normalized = normalized.replace('/api/files/branding/', '/uploads/branding/');
  }

  const base = getApiBase();

  if (normalized.startsWith('/uploads/')) {
    try {
      const url = new URL(base);
      return `${url.origin}${normalized}`;
    } catch {
      return normalized;
    }
  }

  let cleanEndpoint = endpoint;
  if (base.toLowerCase().endsWith('/api')) {
    cleanEndpoint = endpoint.replace(/^(\/)?api\//i, '/');
  }
  const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
  return `${base}${path}`;
}

type LogoutHandler = () => void;
let onUnauthorized: LogoutHandler | null = null;

export function setUnauthorizedHandler(handler: LogoutHandler) {
  onUnauthorized = handler;
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshPromise) {
    refreshPromise = (async () => {
      try {
        const refreshToken = await getRefreshToken();
        if (!refreshToken) {
          onUnauthorized?.();
          return null;
        }

        const res = await fetch(getFullUrl('/auth/refresh'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Client-Platform': 'mobile',
          },
          body: JSON.stringify({ refreshToken }),
        });

        if (!res.ok) {
          await clearTokens();
          onUnauthorized?.();
          return null;
        }

        const data = await res.json();
        await setTokens(data.accessToken, data.refreshToken || refreshToken);
        return data.accessToken as string;
      } catch {
        await clearTokens();
        onUnauthorized?.();
        return null;
      } finally {
        refreshPromise = null;
      }
    })();
  }
  return refreshPromise;
}

export async function apiFetch<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  if (headers['Content-Type'] === 'SKIP') {
    delete headers['Content-Type'];
  }

  const url = getFullUrl(endpoint);
  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !endpoint.includes('/auth/refresh') && !endpoint.includes('/auth/login')) {
    const newToken = await refreshAccessToken();
    if (!newToken) {
      throw new Error('Session expired. Please log in again.');
    }
    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(url, { ...options, headers });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: 'An error occurred' }));
    if (response.status === 401) onUnauthorized?.();
    const errorMsg =
      typeof errorData.message === 'string'
        ? errorData.message
        : typeof errorData.error === 'string'
          ? errorData.error
          : `HTTP error! status: ${response.status}`;
    throw new Error(errorMsg);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export async function apiFetchBlob(endpoint: string): Promise<Blob> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'X-Client-Platform': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const url = getFullUrl(endpoint);
  let response = await fetch(url, { headers });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error('Session expired');
    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(url, { headers });
  }

  if (!response.ok) {
    throw new Error(`Download failed: ${response.status}`);
  }
  return response.blob();
}

export async function apiUpload<T>(
  endpoint: string,
  formData: FormData,
  onProgress?: (progress: number) => void
): Promise<T> {
  const token = await getAccessToken();
  const url = getFullUrl(endpoint);

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('X-Client-Platform', 'mobile');
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    if (onProgress) {
      xhr.upload.onprogress = (event) => {
        if (event.lengthComputable) {
          onProgress(Math.round((event.loaded / event.total) * 100));
        }
      };
    }

    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          resolve(JSON.parse(xhr.responseText));
        } catch {
          resolve({} as T);
        }
        return;
      }

      if (xhr.status === 401) {
        try {
          const newToken = await refreshAccessToken();
          if (!newToken) {
            reject(new Error('Session expired'));
            return;
          }
          apiUpload<T>(endpoint, formData, onProgress).then(resolve).catch(reject);
        } catch (e) {
          reject(e);
        }
        return;
      }

      try {
        const errorData = JSON.parse(xhr.responseText);
        reject(new Error(errorData.message || errorData.error || `HTTP ${xhr.status}`));
      } catch {
        reject(new Error(`HTTP ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(formData);
  });
}

export async function downloadAndSharePdf(endpoint: string, filename: string) {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const token = await getAccessToken();
  const url = getFullUrl(endpoint);
  const dest = `${FileSystem.cacheDirectory}${filename}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Client-Platform': 'mobile',
    },
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/pdf',
      UTI: 'com.adobe.pdf',
    });
  }
  return result.uri;
}

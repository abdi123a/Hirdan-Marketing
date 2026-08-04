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

export async function apiFetchBlob(
  endpoint: string,
  options: RequestInit = {}
): Promise<Blob> {
  const token = await getAccessToken();
  const headers: Record<string, string> = {
    'X-Client-Platform': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) || {}),
  };

  const url = getFullUrl(endpoint);
  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && !endpoint.includes('/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error('Session expired');
    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(url, { ...options, headers });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg =
      (errorData && (errorData.message || errorData.error)) ||
      `Download failed: ${response.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Download failed: ${response.status}`);
  }
  return response.blob();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

/** POST JSON body, save response PDF to cache, then open the share sheet. */
export async function postAndSharePdf(
  endpoint: string,
  filename: string,
  body: unknown
): Promise<string> {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const token = await getAccessToken();
  const url = getFullUrl(endpoint);
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'mobile',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  let response = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (response.status === 401) {
    const newToken = await refreshAccessToken();
    if (!newToken) throw new Error('Session expired');
    headers.Authorization = `Bearer ${newToken}`;
    response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const msg =
      (errorData && (errorData.message || errorData.error)) ||
      `Export failed: ${response.status}`;
    throw new Error(typeof msg === 'string' ? msg : `Export failed: ${response.status}`);
  }

  const buffer = await response.arrayBuffer();
  const base64 = arrayBufferToBase64(buffer);
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 180) || 'export.pdf';
  const dest = `${FileSystem.cacheDirectory}${safeName.endsWith('.pdf') ? safeName : `${safeName}.pdf`}`;

  await FileSystem.writeAsStringAsync(dest, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(dest, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
  }
  return dest;
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
  return downloadAndShareFile(endpoint, filename, 'application/pdf');
}

export async function downloadAndShareFile(
  endpoint: string,
  filename: string,
  mimeType = 'application/octet-stream'
) {
  const FileSystem = await import('expo-file-system/legacy');
  const Sharing = await import('expo-sharing');
  const token = await getAccessToken();
  const url = getFullUrl(endpoint);
  const safeName = filename.replace(/[^\w.\-]+/g, '_').slice(0, 180) || 'download';
  const dest = `${FileSystem.cacheDirectory}${safeName}`;

  const result = await FileSystem.downloadAsync(url, dest, {
    headers: {
      Authorization: token ? `Bearer ${token}` : '',
      'X-Client-Platform': 'mobile',
    },
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, { mimeType });
  }
  return result.uri;
}

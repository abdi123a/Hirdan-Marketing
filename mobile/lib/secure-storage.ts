import * as SecureStore from 'expo-secure-store';

const ACCESS_KEY = 'hirdan_access_token';
const REFRESH_KEY = 'hirdan_refresh_token';
const USER_KEY = 'hirdan_user_json';
const CREDENTIALS_KEY = 'hirdan_saved_credentials';
const BIOMETRIC_KEY = 'hirdan_biometric_enabled';

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(ACCESS_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_KEY);
}

export async function setTokens(accessToken: string, refreshToken?: string | null) {
  await SecureStore.setItemAsync(ACCESS_KEY, accessToken);
  if (refreshToken) {
    await SecureStore.setItemAsync(REFRESH_KEY, refreshToken);
  }
}

export async function clearTokens() {
  await SecureStore.deleteItemAsync(ACCESS_KEY);
  await SecureStore.deleteItemAsync(REFRESH_KEY);
  await SecureStore.deleteItemAsync(USER_KEY);
}

export async function saveUserJson(user: unknown) {
  await SecureStore.setItemAsync(USER_KEY, JSON.stringify(user));
}

export async function loadUserJson<T>(): Promise<T | null> {
  const raw = await SecureStore.getItemAsync(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export type SavedCredentials = { email: string; password: string };

export async function saveCredentials(email: string, password: string) {
  const payload: SavedCredentials = {
    email: email.trim(),
    password,
  };
  await SecureStore.setItemAsync(CREDENTIALS_KEY, JSON.stringify(payload));
}

export async function loadCredentials(): Promise<SavedCredentials | null> {
  const raw = await SecureStore.getItemAsync(CREDENTIALS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<SavedCredentials>;
    if (!parsed?.email || typeof parsed.password !== 'string') return null;
    return { email: String(parsed.email), password: String(parsed.password) };
  } catch {
    return null;
  }
}

export async function clearCredentials() {
  await SecureStore.deleteItemAsync(CREDENTIALS_KEY);
}

export async function setBiometricPreference(enabled: boolean) {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? '1' : '0');
}

export async function getBiometricPreference(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return raw === '1';
}

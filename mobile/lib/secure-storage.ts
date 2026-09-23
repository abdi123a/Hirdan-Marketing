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

/** Last signed-in email, kept only to prefill the login form. */
const EMAIL_KEY = 'hirdan_saved_email';
/** Password for biometric sign-in; only written while biometrics are enabled. */
const BIO_PASSWORD_KEY = 'hirdan_bio_password';
/** Plain marker so we can know a biometric password exists without prompting. */
const BIO_PASSWORD_FLAG_KEY = 'hirdan_bio_password_set';
/** Legacy key that stored email + plaintext password unconditionally. */
const LEGACY_CREDENTIALS_KEY = CREDENTIALS_KEY;

/**
 * Password from the current app session's successful login, held in memory
 * only. It lets the user turn biometrics on right after signing in without the
 * password ever being persisted unless they do.
 */
let sessionPassword: string | null = null;

function biometricStoreOptions(): SecureStore.SecureStoreOptions {
  let requireAuthentication = false;
  try {
    requireAuthentication = SecureStore.canUseBiometricAuthentication();
  } catch {
    requireAuthentication = false;
  }
  return {
    requireAuthentication,
    authenticationPrompt: 'Unlock Hirdan',
    keychainAccessible: SecureStore.WHEN_PASSCODE_SET_THIS_DEVICE_ONLY,
  };
}

/** True when the biometric password is stored behind the OS biometric prompt. */
export function isStoreBiometricProtected(): boolean {
  return Boolean(biometricStoreOptions().requireAuthentication);
}

export async function saveEmail(email: string) {
  await SecureStore.setItemAsync(EMAIL_KEY, email.trim());
}

export async function loadSavedEmail(): Promise<string | null> {
  return SecureStore.getItemAsync(EMAIL_KEY);
}

/**
 * Remember the email for prefill and keep the password in memory for this
 * app session only. Call `persistBiometricPassword` to store it for biometrics.
 */
export async function saveCredentials(email: string, password: string) {
  await saveEmail(email);
  sessionPassword = password || null;
}

/** Store the in-memory password behind device biometrics (when supported). */
export async function persistBiometricPassword(): Promise<boolean> {
  if (!sessionPassword) return false;
  try {
    await SecureStore.setItemAsync(BIO_PASSWORD_KEY, sessionPassword, biometricStoreOptions());
    await SecureStore.setItemAsync(BIO_PASSWORD_FLAG_KEY, '1');
    return true;
  } catch {
    return false;
  }
}

export async function hasBiometricPassword(): Promise<boolean> {
  return (await SecureStore.getItemAsync(BIO_PASSWORD_FLAG_KEY)) === '1';
}

/**
 * Email + password for sign-in. The password comes from memory (this app
 * session) or, when biometrics saved one, from the protected store — which
 * shows the system biometric prompt where supported.
 */
export async function loadCredentials(): Promise<SavedCredentials | null> {
  const email = await loadSavedEmail();
  if (!email) return null;
  if (sessionPassword) return { email, password: sessionPassword };
  if (!(await hasBiometricPassword())) return { email, password: '' };
  try {
    const password = await SecureStore.getItemAsync(BIO_PASSWORD_KEY, biometricStoreOptions());
    return { email, password: password || '' };
  } catch {
    // Cancelled prompt, or the key was invalidated (biometrics changed).
    return { email, password: '' };
  }
}

/** Remove the biometric password from the device (in-memory copy is kept). */
export async function clearBiometricPassword() {
  await SecureStore.deleteItemAsync(BIO_PASSWORD_KEY);
  await SecureStore.deleteItemAsync(BIO_PASSWORD_FLAG_KEY);
}

/** Forget any stored/remembered password (email prefill is kept). */
export async function clearCredentials() {
  sessionPassword = null;
  await clearBiometricPassword();
  await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY);
}

/**
 * One-time migration from the old format that stored the password in plain
 * SecureStore for every user: keep the email, drop the password.
 */
export async function migrateLegacyCredentials() {
  try {
    const raw = await SecureStore.getItemAsync(LEGACY_CREDENTIALS_KEY);
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Partial<SavedCredentials>;
        if (parsed?.email && !(await loadSavedEmail())) await saveEmail(String(parsed.email));
      } catch {
        // ignore malformed legacy value
      }
      await SecureStore.deleteItemAsync(LEGACY_CREDENTIALS_KEY);
    }
    const legacyEmail = await SecureStore.getItemAsync('hirdan_remember_email');
    if (legacyEmail) {
      if (!(await loadSavedEmail())) await saveEmail(legacyEmail);
      await SecureStore.deleteItemAsync('hirdan_remember_email');
    }
  } catch {
    // ignore
  }
}

export async function setBiometricPreference(enabled: boolean) {
  await SecureStore.setItemAsync(BIOMETRIC_KEY, enabled ? '1' : '0');
}

export async function getBiometricPreference(): Promise<boolean> {
  const raw = await SecureStore.getItemAsync(BIOMETRIC_KEY);
  return raw === '1';
}

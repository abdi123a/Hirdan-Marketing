import { create } from 'zustand';
import {
  AccessLevel,
  ModuleKey,
  PermissionMap,
  resolvePermissions,
} from '@hirdan/shared';
import { endpoints } from '@hirdan/shared';
import { apiFetch, setUnauthorizedHandler } from './api-client';
import {
  clearBiometricPassword,
  clearCredentials,
  clearTokens,
  getAccessToken,
  getBiometricPreference,
  loadUserJson,
  migrateLegacyCredentials,
  persistBiometricPassword,
  saveCredentials,
  saveUserJson,
  setBiometricPreference,
  setTokens,
} from './secure-storage';

export type UserRole = 'admin' | 'manager' | 'staff' | 'client';

export interface AuthUser {
  id?: string;
  email: string;
  name: string;
  role: UserRole;
  permissions?: Record<ModuleKey, AccessLevel> | null;
  company?: string;
  clientId?: string;
  /** Temporary/admin-set password: the API refuses everything but a change until replaced. */
  mustChangePassword?: boolean;
}

/** Self-service password change (any role). Not in the shared endpoint map yet. */
const CHANGE_PASSWORD_ENDPOINT = '/auth/change-password';

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isHydrated: boolean;
  /** When true, a valid session exists but Face ID / biometrics must unlock it. */
  isLocked: boolean;
  biometricEnabled: boolean;
  login: (
    email: string,
    password: string,
    recaptchaToken?: string,
    options?: { fromBiometric?: boolean }
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ) => Promise<{ success: boolean; message?: string }>;
  hydrate: () => Promise<void>;
  unlock: () => void;
  setBiometricEnabled: (enabled: boolean) => Promise<void>;
  can: (module: ModuleKey, minimum?: AccessLevel) => boolean;
}

function normalizeUser(apiUser: any): AuthUser {
  // Accept either a bare user object or `{ user: {...} }` from /auth/me
  const raw = apiUser?.user && !apiUser?.role ? apiUser.user : apiUser;
  const role = String(raw?.role || '').toLowerCase() as UserRole;
  const upperRole = String(raw?.role || 'STAFF').toUpperCase() as
    | 'ADMIN'
    | 'MANAGER'
    | 'STAFF'
    | 'CLIENT';
  const permissions =
    raw?.resolvedPermissions ||
    resolvePermissions(upperRole, (raw?.permissions as PermissionMap) || null);

  const email = String(raw?.email || '').trim();
  const name =
    String(raw?.name || '').trim() ||
    (email ? email.split('@')[0] : '') ||
    'User';

  return {
    id: raw?.id ? String(raw.id) : undefined,
    email,
    name,
    role: (['admin', 'manager', 'staff', 'client'].includes(role) ? role : 'staff') as UserRole,
    permissions,
    company: raw?.company || raw?.client?.company,
    clientId: raw?.clientId || raw?.client?.id,
    mustChangePassword: Boolean(raw?.mustChangePassword || raw?.requiresPasswordChange),
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  isLocked: false,
  biometricEnabled: false,

  unlock: () => set({ isLocked: false }),

  setBiometricEnabled: async (enabled) => {
    if (enabled) {
      // Store this session's password behind biometrics (if we have it).
      await persistBiometricPassword();
    } else {
      await clearBiometricPassword().catch(() => undefined);
    }
    await setBiometricPreference(enabled);
    set({ biometricEnabled: enabled, isLocked: enabled ? get().isLocked : false });
  },

  can: (module, minimum = 'READ') => {
    const { user } = get();
    if (!user) return false;
    if (user.role === 'admin') return true;
    const level = (user.permissions?.[module] || 'NONE') as AccessLevel;
    const rank: Record<AccessLevel, number> = { NONE: 0, READ: 1, WRITE: 2, MANAGE: 3 };
    return rank[level] >= rank[minimum];
  },

  login: async (email, password, recaptchaToken, options) => {
    try {
      const data = await apiFetch<{
        accessToken: string;
        refreshToken?: string;
        user: any;
        message?: string;
      }>(endpoints.auth.login, {
        method: 'POST',
        body: JSON.stringify({ email, password, recaptchaToken }),
      });

      if (!data.accessToken) {
        return { success: false, message: data.message || 'Login failed' };
      }

      const role = String(data.user?.role || '').toUpperCase();
      if (role === 'CLIENT') {
        return { success: false, message: 'Client accounts are not supported in this app yet.' };
      }
      await setTokens(data.accessToken, data.refreshToken);
      const user = normalizeUser(data.user);
      await saveUserJson(user);
      // Email is remembered for prefill; the password stays in memory and is
      // only persisted (behind biometrics) when biometric sign-in is enabled.
      await saveCredentials(email, password).catch(() => undefined);
      // A temporary password is never stored for biometrics; the new one is,
      // once changePassword succeeds.
      if (get().biometricEnabled && !options?.fromBiometric && !user.mustChangePassword) {
        await persistBiometricPassword().catch(() => undefined);
      }
      set({ user, isAuthenticated: true, isLocked: false });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Login failed' };
    }
  },

  changePassword: async (currentPassword, newPassword, confirmPassword) => {
    try {
      const data = await apiFetch<{ accessToken?: string; refreshToken?: string; message?: string }>(
        CHANGE_PASSWORD_ENDPOINT,
        {
          method: 'POST',
          body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
        }
      );
      // Every other session was revoked server-side; this device continues on
      // the fresh session returned here.
      if (data.accessToken) await setTokens(data.accessToken, data.refreshToken);

      const current = get().user;
      if (current) {
        const user = { ...current, mustChangePassword: false };
        await saveUserJson(user);
        await saveCredentials(user.email, newPassword).catch(() => undefined);
        if (get().biometricEnabled) await persistBiometricPassword().catch(() => undefined);
        set({ user });
      }
      return { success: true, message: data.message };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Could not change password' };
    }
  },

  logout: async () => {
    try {
      const refreshToken = await import('./secure-storage').then((m) => m.getRefreshToken());
      await apiFetch(endpoints.auth.logout, {
        method: 'POST',
        body: JSON.stringify({ refreshToken }),
      }).catch(() => undefined);
    } finally {
      await clearTokens();
      await clearCredentials().catch(() => undefined);
      set({ user: null, isAuthenticated: false, isLocked: false });
    }
  },

  hydrate: async () => {
    setUnauthorizedHandler(() => {
      set({ user: null, isAuthenticated: false, isLocked: false });
    });

    try {
      // Older installs stored the password in plain SecureStore; keep only the email.
      await migrateLegacyCredentials();

      const [token, cached, biometricEnabled] = await Promise.all([
        getAccessToken(),
        loadUserJson<AuthUser>(),
        getBiometricPreference(),
      ]);

      if (!token || !cached) {
        set({
          isHydrated: true,
          isAuthenticated: false,
          user: null,
          isLocked: false,
          biometricEnabled,
        });
        return;
      }

      const user = normalizeUser(cached);
      const shouldLock = biometricEnabled;

      // Hydrated as soon as the cached session is restored. Awaiting /auth/me
      // here held the splash up for a full network round-trip on every cold
      // start — on a slow connection, seconds — even though everything needed
      // to render was already on disk.
      set({
        user,
        isAuthenticated: true,
        isLocked: shouldLock,
        biometricEnabled,
        isHydrated: true,
      });

      // Refresh in the background. A 401 is handled by the unauthorized
      // handler registered above, which clears the session.
      void apiFetch<{ user?: any } & Record<string, unknown>>(endpoints.auth.me)
        .then(async (me) => {
          const fresh = normalizeUser(me.user ?? me);
          await saveUserJson(fresh);
          set({ user: fresh, isAuthenticated: true });
        })
        .catch(() => {
          // Keep the cached session; refresh runs again on the next request.
        });
    } catch {
      set({
        isHydrated: true,
        isAuthenticated: false,
        user: null,
        isLocked: false,
      });
    }
  },
}));

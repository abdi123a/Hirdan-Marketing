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
  clearTokens,
  getAccessToken,
  getBiometricPreference,
  loadCredentials,
  loadUserJson,
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
}

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
    recaptchaToken?: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
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

  login: async (email, password, recaptchaToken) => {
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
      // Always persist credentials so autofill + biometrics work next time.
      await saveCredentials(email, password).catch(() => undefined);
      set({ user, isAuthenticated: true, isLocked: false });
      return { success: true };
    } catch (e: any) {
      return { success: false, message: e?.message || 'Login failed' };
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
      set({ user: null, isAuthenticated: false, isLocked: false });
    }
  },

  hydrate: async () => {
    setUnauthorizedHandler(() => {
      set({ user: null, isAuthenticated: false, isLocked: false });
    });

    try {
      const [token, cached, biometricEnabled, savedCreds] = await Promise.all([
        getAccessToken(),
        loadUserJson<AuthUser>(),
        getBiometricPreference(),
        loadCredentials(),
      ]);

      // Migrate older "remember email" installs into the credentials shape if needed.
      if (!savedCreds) {
        try {
          const legacy = await import('expo-secure-store').then((m) =>
            m.getItemAsync('hirdan_remember_email'),
          );
          if (legacy) {
            await saveCredentials(legacy, '');
          }
        } catch {
          // ignore
        }
      }

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

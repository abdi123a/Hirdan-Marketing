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
  loadUserJson,
  saveUserJson,
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
  biometricEnabled: boolean;
  login: (
    email: string,
    password: string,
    recaptchaToken?: string
  ) => Promise<{ success: boolean; message?: string }>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setBiometricEnabled: (enabled: boolean) => void;
  can: (module: ModuleKey, minimum?: AccessLevel) => boolean;
}

function normalizeUser(apiUser: any): AuthUser {
  const role = String(apiUser.role || '').toLowerCase() as UserRole;
  const upperRole = String(apiUser.role || 'STAFF').toUpperCase() as
    | 'ADMIN'
    | 'MANAGER'
    | 'STAFF'
    | 'CLIENT';
  const permissions =
    apiUser.resolvedPermissions ||
    resolvePermissions(upperRole, (apiUser.permissions as PermissionMap) || null);

  return {
    id: apiUser.id,
    email: apiUser.email,
    name: apiUser.name,
    role: (['admin', 'manager', 'staff', 'client'].includes(role) ? role : 'staff') as UserRole,
    permissions,
    company: apiUser.company,
    clientId: apiUser.clientId,
  };
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isHydrated: false,
  biometricEnabled: false,

  setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),

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
      set({ user, isAuthenticated: true });
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
      set({ user: null, isAuthenticated: false });
    }
  },

  hydrate: async () => {
    setUnauthorizedHandler(() => {
      set({ user: null, isAuthenticated: false });
    });

    try {
      const token = await getAccessToken();
      const cached = await loadUserJson<AuthUser>();
      if (!token || !cached) {
        set({ isHydrated: true, isAuthenticated: false, user: null });
        return;
      }

      set({ user: cached, isAuthenticated: true });

      try {
        const me = await apiFetch<any>(endpoints.auth.me);
        const user = normalizeUser(me);
        await saveUserJson(user);
        set({ user, isAuthenticated: true, isHydrated: true });
      } catch {
        // Keep cached session; refresh will run on next request
        set({ isHydrated: true });
      }
    } catch {
      set({ isHydrated: true, isAuthenticated: false, user: null });
    }
  },
}));

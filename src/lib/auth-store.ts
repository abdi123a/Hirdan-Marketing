import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleKey, AccessLevel, PermissionMap } from '@/lib/permissions';
import { resolvePermissions } from '@/lib/permissions';

export type UserRole = 'admin' | 'manager' | 'staff' | 'client';

export interface AuthUserBase {
  id?: string;
  email: string;
  name: string;
  /** Server requires a password change before anything else (temp/provisioned password). */
  requiresPasswordChange?: boolean;
  /** Resolved effective permissions (role defaults + overrides) */
  permissions?: Record<ModuleKey, AccessLevel> | null;
}

export interface AdminUser extends AuthUserBase {
  role: 'admin';
}

export interface ManagerUser extends AuthUserBase {
  role: 'manager';
}

export interface StaffUser extends AuthUserBase {
  role: 'staff';
}

export interface ClientUser extends AuthUserBase {
  role: 'client';
  company: string;
  clientId: string;
}

export type AuthUser = AdminUser | ManagerUser | StaffUser | ClientUser;

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;

  loginAdmin: (email: string, password: string, recaptchaToken?: string) => Promise<{ success: boolean; message?: string }>;
  loginClient: (email: string, password: string, recaptchaToken?: string) => Promise<boolean>;
  setToken: (accessToken: string) => void;
  setClientPasswordChangeRequired: (required: boolean) => void;
  setPasswordChangeRequired: (required: boolean) => void;
  setUserFromApi: (apiUser: any) => void;
  logout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

type OneSignalLike = { login: (id: string) => Promise<void>; logout: () => Promise<void> };

/**
 * Bind (or unbind) this browser's OneSignal subscription to the signed-in user,
 * so the server can target web pushes by external_id instead of broadcasting
 * to every subscriber. No-op when OneSignal isn't loaded.
 */
function syncPushIdentity(userId: string | null | undefined) {
  if (typeof window === 'undefined') return;
  const w = window as unknown as { OneSignalDeferred?: Array<(os: OneSignalLike) => unknown> };
  w.OneSignalDeferred = w.OneSignalDeferred || [];
  w.OneSignalDeferred.push(async (os) => {
    try {
      if (userId) await os.login(userId);
      else await os.logout();
    } catch (err) {
      console.warn('[OneSignal] identity sync failed:', err);
    }
  });
}

/** Revoke the refresh-token cookie server-side (best effort; never blocks logout). */
function revokeServerSession(accessToken: string | null) {
  try {
    void fetch(`${API_URL}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      keepalive: true,
      headers: {
        'Content-Type': 'application/json',
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
    }).catch(() => undefined);
  } catch {
    // ignore — local state is cleared regardless
  }
}

function normalizeStaffUser(apiUser: any): AuthUser {
  const role = String(apiUser.role || '').toLowerCase() as UserRole;
  const upperRole = String(apiUser.role || 'STAFF').toUpperCase() as 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';

  const permissions =
    apiUser.resolvedPermissions ||
    resolvePermissions(upperRole, (apiUser.permissions as PermissionMap) || null);
  const requiresPasswordChange = !!apiUser.requiresPasswordChange || !!apiUser.mustChangePassword;
  const id = apiUser.id ? String(apiUser.id) : undefined;

  if (role === 'client') {
    return {
      role: 'client',
      id,
      email: apiUser.email,
      name: apiUser.name,
      company: apiUser.company || apiUser.client?.company || '',
      clientId: apiUser.clientId || apiUser.client?.id || '',
      requiresPasswordChange,
      permissions,
    };
  }

  return {
    role: (['admin', 'manager', 'staff'].includes(role) ? role : 'staff') as 'admin' | 'manager' | 'staff',
    id,
    email: apiUser.email,
    name: apiUser.name,
    requiresPasswordChange,
    permissions,
  };
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      setToken: (accessToken: string) => {
        set({ token: accessToken });
      },

      setUserFromApi: (apiUser: any) => {
        const user = normalizeStaffUser(apiUser);
        set({
          user,
          isAuthenticated: true,
        });
        syncPushIdentity(user.id);
      },

      setClientPasswordChangeRequired: (required: boolean) => {
        get().setPasswordChangeRequired(required);
      },

      setPasswordChangeRequired: (required: boolean) => {
        set((state) => {
          if (!state.user) return state;
          return {
            user: {
              ...state.user,
              requiresPasswordChange: required,
            },
          };
        });
      },

      loginAdmin: async (email: string, password: string, recaptchaToken?: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, recaptchaToken }),
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            const user = normalizeStaffUser(data.user);
            set({
              user,
              isAuthenticated: true,
              token: data.accessToken,
            });
            syncPushIdentity(user.id);
            return { success: true };
          }
          return { success: false, message: data.message };
        } catch (error) {
          console.error("Admin login failed:", error);
          return { success: false, message: 'An unexpected error occurred. Please try again.' };
        }
      },

      loginClient: async (email: string, password: string, recaptchaToken?: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/client-login`, {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, recaptchaToken }),
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            const user = normalizeStaffUser({ ...data.user, role: 'CLIENT' });
            set({
              user,
              isAuthenticated: true,
              token: data.accessToken,
            });
            syncPushIdentity(user.id);
            return true;
          }
        } catch (error) {
          console.error("Client login failed:", error);
        }
        return false;
      },

      logout: () => {
        const { isAuthenticated, token } = get();
        // Only hit the server when there was a session to end (this also runs
        // on failed refreshes / anonymous page loads).
        if (isAuthenticated || token) {
          revokeServerSession(token);
          syncPushIdentity(null);
        }
        set({
          user: null,
          isAuthenticated: false,
          token: null,
        });
      },
    }),
    {
      name: 'hirdan-auth-storage',
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

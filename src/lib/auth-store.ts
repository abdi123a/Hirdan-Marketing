import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ModuleKey, AccessLevel, PermissionMap } from '@/lib/permissions';
import { resolvePermissions } from '@/lib/permissions';

export type UserRole = 'admin' | 'manager' | 'staff' | 'client';

export interface AuthUserBase {
  email: string;
  name: string;
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
  requiresPasswordChange?: boolean;
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
  setUserFromApi: (apiUser: any) => void;
  logout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

function normalizeStaffUser(apiUser: any): AuthUser {
  const role = String(apiUser.role || '').toLowerCase() as UserRole;
  const upperRole = String(apiUser.role || 'STAFF').toUpperCase() as 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';

  const permissions =
    apiUser.resolvedPermissions ||
    resolvePermissions(upperRole, (apiUser.permissions as PermissionMap) || null);

  if (role === 'client') {
    return {
      role: 'client',
      email: apiUser.email,
      name: apiUser.name,
      company: apiUser.company || apiUser.client?.company || '',
      clientId: apiUser.clientId || apiUser.client?.id || '',
      requiresPasswordChange: !!apiUser.requiresPasswordChange || !!apiUser.mustChangePassword,
      permissions,
    };
  }

  return {
    role: (['admin', 'manager', 'staff'].includes(role) ? role : 'staff') as 'admin' | 'manager' | 'staff',
    email: apiUser.email,
    name: apiUser.name,
    permissions,
  };
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      setToken: (accessToken: string) => {
        set({ token: accessToken });
      },

      setUserFromApi: (apiUser: any) => {
        set({
          user: normalizeStaffUser(apiUser),
          isAuthenticated: true,
        });
      },

      setClientPasswordChangeRequired: (required: boolean) => {
        set((state) => {
          if (!state.user || state.user.role !== 'client') return state;
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
            set({
              user: normalizeStaffUser(data.user),
              isAuthenticated: true,
              token: data.accessToken,
            });
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
            set({
              user: normalizeStaffUser({ ...data.user, role: 'CLIENT' }),
              isAuthenticated: true,
              token: data.accessToken,
            });
            return true;
          }
        } catch (error) {
          console.error("Client login failed:", error);
        }
        return false;
      },

      logout: () => {
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

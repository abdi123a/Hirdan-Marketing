import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'manager' | 'staff' | 'client';

export interface AdminUser {
  role: 'admin';
  email: string;
  name: string;
}

export interface ManagerUser {
  role: 'manager';
  email: string;
  name: string;
}

export interface StaffUser {
  role: 'staff';
  email: string;
  name: string;
}

export interface ClientUser {
  role: 'client';
  email: string;
  name: string;
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
  logout: () => void;
}

const API_URL = import.meta.env.VITE_API_URL || '/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      setToken: (accessToken: string) => {
        set({ token: accessToken });
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
            credentials: 'include', // Needed for cookies
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, recaptchaToken }),
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            set({
              user: {
                role: data.user.role.toLowerCase() as UserRole,
                email: data.user.email,
                name: data.user.name,
              } as AuthUser,
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
            credentials: 'include', // Needed for cookies
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password, recaptchaToken }),
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            set({
              user: {
                role: 'client',
                email: data.user.email,
                name: data.user.name,
                company: data.user.company,
                clientId: data.user.clientId,
                requiresPasswordChange: !!data.user.requiresPasswordChange,
              },
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
        isAuthenticated: state.isAuthenticated 
      }), // Security fix: Don't persist tokens to localStorage
    }
  )
);

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type UserRole = 'admin' | 'client';

export interface AdminUser {
  role: 'admin';
  email: string;
  name: string;
}

export interface ClientUser {
  role: 'client';
  email: string;
  name: string;
  company: string;
  clientId: string;
}

export type AuthUser = AdminUser | ClientUser;

interface AuthStore {
  user: AuthUser | null;
  isAuthenticated: boolean;
  token: string | null;

  loginAdmin: (email: string, password: string) => Promise<boolean>;
  loginClient: (email: string, accessCode: string) => Promise<boolean>;
  setToken: (accessToken: string) => void;
  logout: () => void;
}

const API_URL = '/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,

      setToken: (accessToken: string) => {
        set({ token: accessToken });
      },

      loginAdmin: async (email: string, password: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            credentials: 'include', // Needed for cookies
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
          });
          const data = await res.json();
          if (res.ok && data.accessToken) {
            set({
              user: {
                role: 'admin',
                email: data.user.email,
                name: data.user.name,
              },
              isAuthenticated: true,
              token: data.accessToken,
            });
            return true;
          }
        } catch (error) {
          console.error("Admin login failed:", error);
        }
        return false;
      },

      loginClient: async (email: string, accessCode: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/client-login`, {
            method: 'POST',
            credentials: 'include', // Needed for cookies
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, accessCode }),
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
      name: 'agency-auth-storage',
      partialize: (state) => ({ 
        user: state.user, 
        isAuthenticated: state.isAuthenticated 
      }), // Security fix: Don't persist tokens to localStorage
    }
  )
);

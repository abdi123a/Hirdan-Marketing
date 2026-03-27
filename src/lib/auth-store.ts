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
  refreshToken: string | null;

  loginAdmin: (email: string, password: string) => Promise<boolean>;
  loginClient: (email: string, accessCode: string) => Promise<boolean>;
  setTokens: (accessToken: string, refreshToken: string) => void;
  logout: () => void;
}

const API_URL = '/api';

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      token: null,
      refreshToken: null,

      setTokens: (accessToken: string, refreshToken: string) => {
        set({ token: accessToken, refreshToken });
      },

      loginAdmin: async (email: string, password: string) => {
        try {
          const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
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
              refreshToken: data.refreshToken,
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
              refreshToken: data.refreshToken,
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
          refreshToken: null,
        });
      },
    }),
    {
      name: 'agency-auth-storage',
    }
  )
);

/**
 * Typed API endpoint map shared by web and mobile clients.
 * Paths are relative to the API base (e.g. /api or https://api.example.com/api).
 */

export const endpoints = {
  auth: {
    login: '/auth/login',
    clientLogin: '/auth/client-login',
    refresh: '/auth/refresh',
    logout: '/auth/logout',
    me: '/auth/me',
    forgotPassword: '/auth/forgot-password',
    resetPassword: '/auth/reset-password',
  },
  clients: {
    list: '/clients',
    byId: (id: string) => `/clients/${id}`,
    create: '/clients',
    update: (id: string) => `/clients/${id}`,
  },
  invoices: {
    list: '/invoices',
    byId: (id: string) => `/invoices/${id}`,
    exportPdf: (id: string) => `/invoices/${id}/export-pdf`,
    markPaid: (id: string) => `/invoices/${id}/mark-paid`,
  },
  proformas: {
    list: '/proformas',
    byId: (id: string) => `/proformas/${id}`,
    exportPdf: (id: string) => `/proformas/${id}/export-pdf`,
  },
  expenses: {
    list: '/expenses',
    byId: (id: string) => `/expenses/${id}`,
    create: '/expenses',
  },
  notifications: {
    list: '/notifications',
    counts: '/notifications/counts',
    markRead: (id: string) => `/notifications/${id}/read`,
    markAllRead: '/notifications/mark-all-read',
  },
  team: {
    list: '/team',
    byId: (id: string) => `/team/${id}`,
  },
  hr: {
    list: '/hr/documents',
    byId: (id: string) => `/hr/documents/${id}`,
    exportPdf: (id: string) => `/hr/documents/${id}/export-pdf`,
  },
  transfer: {
    list: '/transfer',
    byShareId: (shareId: string) => `/transfer/${shareId}`,
    download: (shareId: string) => `/transfer/${shareId}/download`,
  },
  social: {
    accounts: '/social/accounts',
    posts: '/social/posts',
    analytics: '/social/analytics',
  },
  email: {
    mailboxes: '/email/mailboxes',
    messages: '/email/messages',
    streamTicket: '/email/stream/ticket',
    stream: '/email/stream',
  },
  devices: {
    register: '/devices',
    unregister: (token: string) => `/devices/${encodeURIComponent(token)}`,
  },
  settings: {
    public: '/settings/public',
  },
} as const;

export type Endpoints = typeof endpoints;

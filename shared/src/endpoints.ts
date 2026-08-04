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
    delete: (id: string) => `/clients/${id}`,
    meetings: (id: string) => `/clients/${id}/meetings`,
    meetingById: (id: string, meetingId: string) => `/clients/${id}/meetings/${meetingId}`,
    documents: (id: string) => `/clients/${id}/documents`,
    documentById: (id: string, docId: string) => `/clients/${id}/documents/${docId}`,
    portalAccess: (id: string) => `/clients/${id}/portal-access`,
    sendWelcomeEmail: (id: string) => `/clients/${id}/send-welcome-email`,
    contentPosts: (id: string) => `/clients/${id}/content-posts`,
    contentPostById: (id: string, postId: string) => `/clients/${id}/content-posts/${postId}`,
    contentPostsDuplicate: (id: string) => `/clients/${id}/content-posts/duplicate`,
  },
  invoices: {
    list: '/invoices',
    byId: (id: string) => `/invoices/${id}`,
    create: '/invoices',
    update: (id: string) => `/invoices/${id}`,
    delete: (id: string) => `/invoices/${id}`,
    exportPdf: (id: string) => `/invoices/${id}/export-pdf`,
    sendEmail: (id: string) => `/invoices/${id}/send-email`,
  },
  proformas: {
    list: '/proformas',
    byId: (id: string) => `/proformas/${id}`,
    create: '/proformas',
    update: (id: string) => `/proformas/${id}`,
    delete: (id: string) => `/proformas/${id}`,
    exportPdf: (id: string) => `/proformas/${id}/export-pdf`,
    sendEmail: (id: string) => `/proformas/${id}/send-email`,
  },
  expenses: {
    list: '/expenses',
    byId: (id: string) => `/expenses/${id}`,
    create: '/expenses',
    update: (id: string) => `/expenses/${id}`,
    delete: (id: string) => `/expenses/${id}`,
    summary: '/expenses/summary',
    uploadReceipt: '/expenses/upload-receipt',
    scan: '/expenses/scan',
  },
  accounts: {
    list: '/accounts',
  },
  services: {
    list: '/services',
  },
  packages: {
    list: '/packages',
  },
  projects: {
    list: '/projects',
    byId: (id: string) => `/projects/${id}`,
    create: '/projects',
    update: (id: string) => `/projects/${id}`,
    delete: (id: string) => `/projects/${id}`,
  },
  subscriptions: {
    list: '/subscriptions',
    byId: (id: string) => `/subscriptions/${id}`,
  },
  leads: {
    list: '/leads',
  },
  tasks: {
    analyticsDashboard: '/tasks/analytics/dashboard',
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
    upload: '/transfer/upload',
    byId: (id: string) => `/transfer/${id}`,
    byShareId: (shareId: string) => `/transfer/${shareId}`,
    download: (shareId: string, preview = false) =>
      `/transfer/${shareId}/download${preview ? '?preview=true' : ''}`,
    send: (id: string) => `/transfer/${id}/send`,
    events: (id: string) => `/transfer/${id}/events`,
    renew: (id: string) => `/transfer/${id}/renew`,
  },
  social: {
    accounts: '/social/accounts',
    accountsByClient: (clientId: string) => `/social/accounts/by-client/${clientId}`,
    accountById: (id: string) => `/social/accounts/${id}`,
    accountAvatar: (id: string) => `/social/accounts/${id}/avatar`,
    accountSync: (id: string) => `/social/accounts/${id}/sync`,
    accountActivity: (id: string) => `/social/accounts/${id}/activity`,
    workspaceSummary: '/social/accounts/workspace-summary',
    platformStatus: '/social/platform-status',
    oauthConnect: '/social/oauth/connect',
    oauthPending: (sessionId: string) => `/social/oauth/pending/${sessionId}`,
    oauthSelectAccount: '/social/oauth/select-account',
    posts: '/social/posts',
    postById: (id: string) => `/social/posts/${id}`,
    publishNow: (id: string) => `/social/posts/${id}/publish-now`,
    retryPost: (id: string) => `/social/posts/${id}/retry`,
    submitPost: (id: string) => `/social/posts/${id}/submit`,
    approvePost: (id: string) => `/social/posts/${id}/approve`,
    rejectPost: (id: string) => `/social/posts/${id}/reject`,
    mediaUpload: '/social/media/upload',
    aiCaption: '/social/ai/caption',
    campaigns: '/social/campaigns',
    campaignById: (id: string) => `/social/campaigns/${id}`,
    analytics: '/social/analytics',
    analyticsFull: (clientId: string) => `/social/analytics/${clientId}/full`,
    analyticsPosts: (clientId: string) => `/social/analytics/${clientId}/posts`,
    analyticsRefresh: (clientId: string) => `/social/analytics/${clientId}/refresh`,
    analyticsPost: (id: string) => `/social/analytics/post/${id}`,
    importTiktok: (accountId: string) => `/social/import/tiktok/${accountId}`,
  },
  ai: {
    generatePlan: '/ai/generate-plan',
  },
  reports: {
    contentPlan: '/reports/content-plan',
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
    get: '/settings',
    public: '/settings/public',
  },
} as const;

export type Endpoints = typeof endpoints;

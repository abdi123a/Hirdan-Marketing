/**
 * Shared permission catalog used by web and mobile clients.
 * Keep in sync with server/src/lib/permissions.ts
 */

export const ACCESS_LEVELS = ['NONE', 'READ', 'WRITE', 'MANAGE'] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number];

export const ACCESS_RANK: Record<AccessLevel, number> = {
  NONE: 0,
  READ: 1,
  WRITE: 2,
  MANAGE: 3,
};

export const ACCESS_LEVEL_LABELS: Record<AccessLevel, string> = {
  NONE: 'No access',
  READ: 'Read',
  WRITE: 'Read & write',
  MANAGE: 'Full access',
};

export const PERMISSION_MODULES = [
  { key: 'dashboard', label: 'Overview', description: 'Main dashboard home', group: 'Core', pathPrefix: '/dashboard' },
  { key: 'ai_assistant', label: 'AI Assistant', description: 'Agency AI tools', group: 'Core', pathPrefix: '/dashboard/ai-assistant' },
  { key: 'clients', label: 'Clients', description: 'Client directory & profiles', group: 'CRM', pathPrefix: '/dashboard/clients' },
  { key: 'projects', label: 'Projects', description: 'Project management', group: 'CRM', pathPrefix: '/dashboard/projects' },
  { key: 'team', label: 'Team', description: 'Employees & org chart', group: 'People', pathPrefix: '/dashboard/team' },
  { key: 'hr', label: 'HR Documents', description: 'HR document generator', group: 'People', pathPrefix: '/dashboard/hr' },
  { key: 'email', label: 'Email Center', description: 'Shared mailboxes & inbox', group: 'Communication', pathPrefix: '/dashboard/email' },
  { key: 'leads', label: 'Email List', description: 'Lead / email list', group: 'Communication', pathPrefix: '/dashboard/leads' },
  { key: 'proforma', label: 'Proforma', description: 'Proforma invoices', group: 'Finance', pathPrefix: '/dashboard/proforma' },
  { key: 'invoices', label: 'Invoices', description: 'Billing invoices', group: 'Finance', pathPrefix: '/dashboard/invoices' },
  { key: 'subscriptions', label: 'Subscriptions', description: 'Recurring billing', group: 'Finance', pathPrefix: '/dashboard/subscriptions' },
  { key: 'expenses', label: 'Expenses', description: 'Expense tracking', group: 'Finance', pathPrefix: '/dashboard/expenses' },
  { key: 'financial_reports', label: 'Financial Reports', description: 'Finance reporting', group: 'Finance', pathPrefix: '/dashboard/reports/financial' },
  { key: 'packages', label: 'Packages', description: 'Service packages', group: 'Catalog', pathPrefix: '/dashboard/packages' },
  { key: 'services', label: 'Services', description: 'Service catalog', group: 'Catalog', pathPrefix: '/dashboard/services' },
  { key: 'social_media', label: 'Social Media', description: 'Analyze, publish, accounts', group: 'Marketing', pathPrefix: '/dashboard/social-media' },
  { key: 'strategy_decks', label: 'Strategy Decks', description: 'Social strategy presentations', group: 'Marketing', pathPrefix: '/dashboard/social-media/presentation' },
  { key: 'monthly_reports', label: 'Monthly Reports', description: 'Client monthly report studio', group: 'Marketing', pathPrefix: '/dashboard/reports/monthly' },
  { key: 'transfers', label: 'File Transfer', description: 'Secure file sharing', group: 'Tools', pathPrefix: '/dashboard/transfers' },
  { key: 'calendar', label: 'Calendar', description: 'Agency calendar', group: 'Tools', pathPrefix: '/dashboard/calendar' },
  { key: 'users', label: 'User Access', description: 'Manage users & permissions', group: 'Admin', pathPrefix: '/dashboard/users' },
  { key: 'settings', label: 'Settings', description: 'Agency settings & plugins', group: 'Admin', pathPrefix: '/dashboard/settings' },
] as const;

export type ModuleKey = (typeof PERMISSION_MODULES)[number]['key'];
export type PermissionMap = Partial<Record<ModuleKey, AccessLevel>>;

const ALL_MANAGE = Object.fromEntries(
  PERMISSION_MODULES.map((m) => [m.key, 'MANAGE'])
) as Record<ModuleKey, AccessLevel>;

export const ROLE_DEFAULT_PERMISSIONS: Record<'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT', PermissionMap> = {
  ADMIN: { ...ALL_MANAGE },
  MANAGER: {
    dashboard: 'READ',
    ai_assistant: 'WRITE',
    clients: 'MANAGE',
    projects: 'MANAGE',
    team: 'WRITE',
    hr: 'WRITE',
    email: 'WRITE',
    leads: 'WRITE',
    proforma: 'WRITE',
    invoices: 'WRITE',
    subscriptions: 'WRITE',
    expenses: 'WRITE',
    financial_reports: 'READ',
    packages: 'WRITE',
    services: 'WRITE',
    social_media: 'WRITE',
    strategy_decks: 'WRITE',
    monthly_reports: 'WRITE',
    transfers: 'WRITE',
    calendar: 'WRITE',
    users: 'NONE',
    settings: 'READ',
  },
  STAFF: {
    dashboard: 'READ',
    ai_assistant: 'READ',
    clients: 'READ',
    projects: 'WRITE',
    team: 'READ',
    hr: 'NONE',
    email: 'WRITE',
    leads: 'READ',
    proforma: 'READ',
    invoices: 'READ',
    subscriptions: 'READ',
    expenses: 'WRITE',
    financial_reports: 'NONE',
    packages: 'READ',
    services: 'READ',
    social_media: 'WRITE',
    strategy_decks: 'READ',
    monthly_reports: 'WRITE',
    transfers: 'WRITE',
    calendar: 'WRITE',
    users: 'NONE',
    settings: 'NONE',
  },
  CLIENT: Object.fromEntries(
    PERMISSION_MODULES.map((m) => [m.key, 'NONE'])
  ) as Record<ModuleKey, AccessLevel>,
};

export function isAccessLevel(value: unknown): value is AccessLevel {
  return typeof value === 'string' && (ACCESS_LEVELS as readonly string[]).includes(value);
}

export function resolvePermissions(
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT',
  overrides?: PermissionMap | null
): Record<ModuleKey, AccessLevel> {
  if (role === 'ADMIN') {
    return { ...ALL_MANAGE };
  }

  const base = { ...(ROLE_DEFAULT_PERMISSIONS[role] || ROLE_DEFAULT_PERMISSIONS.STAFF) } as Record<ModuleKey, AccessLevel>;

  for (const mod of PERMISSION_MODULES) {
    if (!base[mod.key]) base[mod.key] = 'NONE';
  }

  if (overrides && typeof overrides === 'object') {
    for (const mod of PERMISSION_MODULES) {
      const level = overrides[mod.key];
      if (isAccessLevel(level)) {
        base[mod.key] = level;
      }
    }
  }

  return base;
}

export function hasPermission(
  permissions: PermissionMap | null | undefined,
  module: ModuleKey,
  minimum: AccessLevel = 'READ'
): boolean {
  const level = (permissions?.[module] || 'NONE') as AccessLevel;
  return ACCESS_RANK[level] >= ACCESS_RANK[minimum];
}

export function moduleForPath(pathname: string): ModuleKey | null {
  const normalized = pathname.replace(/\/+$/, '') || '/dashboard';
  const sorted = [...PERMISSION_MODULES].sort((a, b) => b.pathPrefix.length - a.pathPrefix.length);
  for (const mod of sorted) {
    if (mod.key === 'dashboard') {
      if (normalized === '/dashboard') return 'dashboard';
      continue;
    }
    if (normalized === mod.pathPrefix || normalized.startsWith(`${mod.pathPrefix}/`)) {
      return mod.key;
    }
  }
  return null;
}

/** Sidebar URL → module key */
export const SIDEBAR_MODULE_MAP: Record<string, ModuleKey> = {
  '/dashboard': 'dashboard',
  '/dashboard/ai-assistant': 'ai_assistant',
  '/dashboard/clients': 'clients',
  '/dashboard/projects': 'projects',
  '/dashboard/team': 'team',
  '/dashboard/email': 'email',
  '/dashboard/hr': 'hr',
  '/dashboard/proforma': 'proforma',
  '/dashboard/invoices': 'invoices',
  '/dashboard/subscriptions': 'subscriptions',
  '/dashboard/social-media': 'social_media',
  '/dashboard/social-media/presentation': 'strategy_decks',
  '/dashboard/transfers': 'transfers',
  '/dashboard/reports/monthly': 'monthly_reports',
  '/dashboard/reports/financial': 'financial_reports',
  '/dashboard/expenses': 'expenses',
  '/dashboard/packages': 'packages',
  '/dashboard/services': 'services',
  '/dashboard/leads': 'leads',
  '/dashboard/calendar': 'calendar',
  '/dashboard/settings': 'settings',
  '/dashboard/users': 'users',
};

export function groupModules() {
  const groups: { name: string; modules: typeof PERMISSION_MODULES[number][] }[] = [];
  for (const mod of PERMISSION_MODULES) {
    let group = groups.find((g) => g.name === mod.group);
    if (!group) {
      group = { name: mod.group, modules: [] };
      groups.push(group);
    }
    group.modules.push(mod);
  }
  return groups;
}

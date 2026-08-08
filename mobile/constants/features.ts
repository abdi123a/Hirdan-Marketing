import type { IconName } from '../components/ui/Icon';
import type { ModuleKey } from '../hooks/usePermissions';

export type DockItem = {
  label: string;
  icon: IconName;
  /** Route this dock entry navigates to. */
  href: string;
  /**
   * Routes that should light this entry up. A detail screen pushed from a
   * dock entry still belongs to it, so matching only the exact href would
   * leave the dock looking unselected while you're inside the feature.
   */
  match?: string[];
};

export type Feature = {
  key: string;
  label: string;
  /** One-line description shown on the launcher tile. */
  blurb: string;
  icon: IconName;
  href: string;
  /** Hidden when the signed-in user can't read anything behind it. */
  isVisible: (canRead: (module: ModuleKey) => boolean) => boolean;
  /**
   * Kept out of the launcher grid. Used by the home entry, which exists only
   * to own the root dock — showing a "Home" tile on the home screen would be
   * a link to the page you're already on.
   */
  hiddenFromLauncher?: boolean;
  /**
   * Bottom navigation shown *inside* this feature. Omitted for features that
   * are a single screen — a dock with one entry is just chrome.
   */
  dock?: DockItem[];
  group: 'work' | 'money' | 'growth' | 'org';
};

/**
 * Every feature in the app, in launcher order.
 *
 * This is the single source of truth: the launcher renders tiles from it and
 * each feature's dock reads its own entry, so adding a screen means editing
 * one list rather than hunting for a nav config.
 */
export const FEATURES: Feature[] = [
  {
    key: 'home',
    label: 'Home',
    blurb: 'Everything at a glance',
    icon: 'home',
    href: '/(tabs)/home',
    group: 'work',
    hiddenFromLauncher: true,
    isVisible: () => true,
    // The root dock. Five entries is the practical ceiling — past that the
    // labels truncate and the targets drop under the 44pt minimum.
    dock: [
      { label: 'Home', icon: 'home', href: '/(tabs)/home' },
      { label: 'Clients', icon: 'group', href: '/(tabs)/clients' },
      { label: 'Money', icon: 'account_balance_wallet', href: '/(tabs)/money' },
      { label: 'Inbox', icon: 'inbox', href: '/(tabs)/more/email' },
      { label: 'Account', icon: 'account_circle', href: '/settings' },
    ],
  },
  {
    key: 'dashboard',
    label: 'Dashboard',
    blurb: 'Today at a glance',
    icon: 'space_dashboard',
    href: '/(tabs)/home/dashboard',
    group: 'work',
    isVisible: (canRead) => canRead('dashboard'),
  },
  {
    key: 'clients',
    label: 'Clients',
    blurb: 'Accounts and contacts',
    icon: 'group',
    href: '/(tabs)/clients',
    group: 'work',
    isVisible: (canRead) => canRead('clients'),
  },
  {
    key: 'social',
    label: 'Social',
    blurb: 'Plan and publish posts',
    icon: 'campaign',
    href: '/(tabs)/social',
    group: 'growth',
    isVisible: (canRead) => canRead('social_media'),
    dock: [
      {
        label: 'Posts',
        icon: 'grid_view',
        href: '/(tabs)/social',
        match: ['/(tabs)/social', '/post'],
      },
      { label: 'Accounts', icon: 'link', href: '/(tabs)/social/accounts' },
      { label: 'Analyze', icon: 'analytics', href: '/(tabs)/social/analyze' },
      { label: 'Compose', icon: 'edit_square', href: '/compose' },
    ],
  },
  {
    key: 'money',
    label: 'Money',
    blurb: 'Invoices, quotes, expenses',
    icon: 'account_balance_wallet',
    href: '/(tabs)/money',
    group: 'money',
    isVisible: (canRead) =>
      canRead('invoices') || canRead('proforma') || canRead('expenses'),
    dock: [
      {
        label: 'Overview',
        icon: 'receipt_long',
        href: '/(tabs)/money',
        match: ['/(tabs)/money', '/invoice', '/proforma', '/expense'],
      },
      { label: 'Expenses', icon: 'payments', href: '/(tabs)/money/expenses' },
      { label: 'Subscriptions', icon: 'autorenew', href: '/(tabs)/more/subscriptions' },
    ],
  },
  {
    key: 'email',
    label: 'Email',
    blurb: 'Shared inbox and templates',
    icon: 'mail',
    href: '/(tabs)/more/email',
    group: 'growth',
    isVisible: (canRead) => canRead('email'),
    dock: [
      {
        label: 'Inbox',
        icon: 'inbox',
        href: '/(tabs)/more/email',
        match: ['/(tabs)/more/email'],
      },
      { label: 'Templates', icon: 'description', href: '/(tabs)/more/email/templates' },
      { label: 'Mailboxes', icon: 'alternate_email', href: '/(tabs)/more/email/mailboxes' },
      { label: 'Analytics', icon: 'monitoring', href: '/(tabs)/more/email/analytics' },
    ],
  },
  {
    key: 'projects',
    label: 'Projects',
    blurb: 'Delivery and milestones',
    icon: 'folder_open',
    href: '/(tabs)/more/projects',
    group: 'work',
    isVisible: (canRead) => canRead('projects'),
  },
  {
    key: 'tasks',
    label: 'Tasks',
    blurb: 'Your work queue',
    icon: 'checklist',
    href: '/(tabs)/more/tasks',
    group: 'work',
    isVisible: (canRead) => canRead('social_media'),
  },
  {
    key: 'calendar',
    label: 'Calendar',
    blurb: 'Meetings and deadlines',
    icon: 'calendar_month',
    href: '/(tabs)/more/calendar',
    group: 'work',
    isVisible: (canRead) => canRead('calendar'),
  },
  {
    key: 'leads',
    label: 'Leads',
    blurb: 'Inbound enquiries',
    icon: 'person_add',
    href: '/(tabs)/more/leads',
    group: 'growth',
    isVisible: (canRead) => canRead('leads'),
  },
  {
    key: 'reports',
    label: 'Reports',
    blurb: 'Performance and revenue',
    icon: 'bar_chart',
    href: '/(tabs)/more/reports',
    group: 'money',
    isVisible: (canRead) => canRead('financial_reports'),
  },
  {
    key: 'catalog',
    label: 'Catalog',
    blurb: 'Packages and pricing',
    icon: 'inventory_2',
    href: '/(tabs)/more/catalog',
    group: 'money',
    isVisible: (canRead) => canRead('packages'),
  },
  {
    key: 'team',
    label: 'Team',
    blurb: 'People and roles',
    icon: 'badge',
    href: '/(tabs)/more/team',
    group: 'org',
    isVisible: (canRead) => canRead('team'),
  },
  {
    key: 'hr',
    label: 'HR Docs',
    blurb: 'Contracts and letters',
    icon: 'contract',
    href: '/(tabs)/more/hr',
    group: 'org',
    isVisible: (canRead) => canRead('hr'),
  },
  {
    key: 'transfers',
    label: 'File Transfer',
    blurb: 'Send large files securely',
    icon: 'cloud_upload',
    href: '/(tabs)/more/transfers',
    group: 'org',
    isVisible: (canRead) => canRead('transfers'),
  },
  {
    key: 'ai',
    label: 'AI Assistant',
    blurb: 'Draft and summarise',
    icon: 'auto_awesome',
    href: '/(tabs)/more/ai',
    group: 'growth',
    isVisible: () => true,
  },
  {
    key: 'settings',
    label: 'Settings',
    blurb: 'Account and preferences',
    icon: 'settings',
    href: '/settings',
    group: 'org',
    isVisible: () => true,
  },
];

/**
 * Per-feature icon colour.
 *
 * Each feature gets its own hue rather than a single brand tint, which is what
 * makes a dense grid scannable — you learn a tile by its colour and stop
 * reading labels. Values are held at a similar saturation and lightness so the
 * grid still reads as one set rather than a bag of stickers.
 */
export const FEATURE_TINTS: Record<string, string> = {
  dashboard: '#5A428A',
  clients: '#2F6FB5',
  social: '#C0397B',
  money: '#0F8A6D',
  email: '#3E5CC4',
  projects: '#B5762F',
  tasks: '#7A3E9D',
  calendar: '#C05621',
  leads: '#1F8A99',
  reports: '#2E7D32',
  catalog: '#8A6D1F',
  team: '#4A5CA8',
  hr: '#8A4A3E',
  transfers: '#3E7A8A',
  ai: '#9333EA',
  settings: '#5B6470',
};

export const FEATURE_GROUPS: { key: Feature['group']; label: string }[] = [
  { key: 'work', label: 'Work' },
  { key: 'growth', label: 'Growth' },
  { key: 'money', label: 'Money' },
  { key: 'org', label: 'Organisation' },
];

/**
 * The dock shown on screens whose feature defines none of its own, so the
 * primary destinations stay reachable from anywhere.
 */
export const ROOT_DOCK: DockItem[] =
  FEATURES.find((f) => f.key === 'home')?.dock ?? [];

/**
 * The feature a pathname belongs to, so a screen can render its own dock.
 *
 * Longest match wins, compared against the winning *candidate* rather than the
 * feature's href — `/home` and `/home/dashboard` are both matched by the home
 * entry's own href, so comparing hrefs alone would let the shorter one win and
 * show the root dock on the dashboard.
 */
export function featureForPath(pathname: string): Feature | undefined {
  let best: Feature | undefined;
  let bestLength = -1;

  for (const feature of FEATURES) {
    const candidates = [
      feature.href,
      ...(feature.dock?.flatMap((d) => [d.href, ...(d.match ?? [])]) ?? []),
    ];
    for (const candidate of candidates) {
      const hit = pathname === candidate || pathname.startsWith(`${candidate}/`);
      if (hit && candidate.length > bestLength) {
        best = feature;
        bestLength = candidate.length;
      }
    }
  }
  return best;
}

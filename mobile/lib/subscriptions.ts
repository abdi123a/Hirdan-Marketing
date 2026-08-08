/** Normalize subscription status/billing between API enums and display labels. */

export const SUBSCRIPTION_STATUSES = [
  { label: 'Active', value: 'ACTIVE' },
  { label: 'Paused', value: 'PAUSED' },
  { label: 'Cancelled', value: 'CANCELLED' },
  { label: 'Trial', value: 'TRIAL' },
] as const;

export const BILLING_CYCLES = [
  { label: 'Monthly', value: 'MONTHLY' },
  { label: 'Quarterly', value: 'QUARTERLY' },
  { label: 'Annual', value: 'ANNUAL' },
] as const;

export function normalizeStatus(raw?: string | null): string {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (s === 'ACTIVE' || s === 'PAUSED' || s === 'CANCELLED' || s === 'TRIAL') return s;
  return 'ACTIVE';
}

export function normalizeBillingCycle(raw?: string | null): string {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (s === 'MONTHLY' || s === 'QUARTERLY' || s === 'ANNUAL') return s;
  return 'MONTHLY';
}

export function statusLabel(raw?: string | null): string {
  const s = normalizeStatus(raw);
  const known = SUBSCRIPTION_STATUSES.find((x) => x.value === s);
  return known?.label ?? '—';
}

export function billingCycleLabel(raw?: string | null): string {
  const s = normalizeBillingCycle(raw);
  const known = BILLING_CYCLES.find((x) => x.value === s);
  return known?.label ?? '—';
}

/** Active/Trial subs past endDate show as Ended in lists and KPIs. */
export function displayStatus(
  status?: string | null,
  endDate?: string | null
): string {
  const base = statusLabel(status);
  const norm = normalizeStatus(status);
  if ((norm === 'ACTIVE' || norm === 'TRIAL') && endDate) {
    const endStr = String(endDate).split('T')[0];
    const todayStr = new Date().toISOString().split('T')[0];
    if (endStr < todayStr) return 'Ended';
  }
  return base;
}

export function statusTone(
  status?: string | null,
  endDate?: string | null
): 'default' | 'success' | 'warning' | 'destructive' | 'gold' {
  const label = displayStatus(status, endDate);
  if (label === 'Ended') return 'default';
  const s = normalizeStatus(status);
  if (s === 'ACTIVE') return 'success';
  if (s === 'TRIAL') return 'gold';
  if (s === 'PAUSED') return 'warning';
  if (s === 'CANCELLED') return 'destructive';
  return 'default';
}

export function isoDateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

export type SubscriptionCycleRow = {
  id: string;
  cycleStart: string;
  cycleEnd: string;
  label: string;
  tasksGenerated?: boolean;
  taskCount?: number;
};

export type SubscriptionRow = {
  id: string;
  clientId?: string | null;
  packageId?: string | null;
  plan: string;
  amount: number;
  billingCycle?: string | null;
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  features?: string | null;
  notes?: string | null;
  client?: { id?: string; name?: string; company?: string | null } | null;
  package?: { id?: string; name?: string } | null;
  cycles?: SubscriptionCycleRow[];
  cycleCount?: number;
};

export function subscriptionClientLabel(s: SubscriptionRow): string {
  return s.client?.company || s.client?.name || '—';
}

export function subscriptionPlanLabel(s: SubscriptionRow): string {
  return s.package?.name || s.plan || 'Plan';
}

export function subscriptionFromApi(raw: any): SubscriptionRow {
  return {
    id: String(raw.id),
    clientId: raw.clientId ?? raw.client?.id ?? null,
    packageId: raw.packageId ?? raw.package?.id ?? null,
    plan: String(raw.plan || raw.package?.name || 'Custom'),
    amount: typeof raw.amount === 'number' ? raw.amount : Number(raw.amount) || 0,
    billingCycle: raw.billingCycle ?? null,
    startDate: raw.startDate ?? null,
    endDate: raw.endDate ?? null,
    status: raw.status ?? null,
    features: raw.features ?? null,
    notes: raw.notes ?? null,
    client: raw.client ?? null,
    package: raw.package ?? null,
    cycles: Array.isArray(raw.cycles)
      ? raw.cycles.map((c: any) => ({
          id: String(c.id),
          cycleStart: c.cycleStart ?? '',
          cycleEnd: c.cycleEnd ?? '',
          label: String(c.label || ''),
          tasksGenerated: c.tasksGenerated ?? false,
          taskCount: c._count?.deliverableTasks ?? 0,
        }))
      : undefined,
    cycleCount: raw._count?.cycles ?? raw.cycles?.length ?? 0,
  };
}

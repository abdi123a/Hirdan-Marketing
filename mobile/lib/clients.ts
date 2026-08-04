import type { ClientSummary } from '@hirdan/shared';

export type ClientFormValues = {
  name: string;
  company: string;
  email: string;
  phone: string;
  website: string;
  address: string;
  city: string;
  country: string;
  industry: string;
  notes: string;
  status: 'Active' | 'Paused' | 'Churned';
  type: 'Business' | 'Individual';
  invoiceGenerationDay: string;
  paymentReminderDelay: string;
  overdueNoticeDelay: string;
};

export const emptyClientForm = (): ClientFormValues => ({
  name: '',
  company: '',
  email: '',
  phone: '',
  website: '',
  address: '',
  city: '',
  country: '',
  industry: '',
  notes: '',
  status: 'Active',
  type: 'Business',
  invoiceGenerationDay: '1',
  paymentReminderDelay: '5',
  overdueNoticeDelay: '10',
});

export function clientFromApi(raw: Partial<ClientSummary> & Record<string, any>): ClientSummary {
  const name = raw.name || raw.contactName || '';
  return {
    id: raw.id!,
    name,
    company: raw.company || name || '',
    contactName: raw.contactName ?? name,
    email: raw.email ?? null,
    phone: raw.phone ?? null,
    website: raw.website ?? null,
    address: raw.address ?? null,
    city: raw.city ?? null,
    country: raw.country ?? null,
    industry: raw.industry ?? null,
    notes: raw.notes ?? null,
    type: raw.type ?? null,
    status: raw.status || 'ACTIVE',
    initials:
      raw.initials ||
      (raw.company || name || '?')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((p: string) => p[0]?.toUpperCase())
        .join(''),
    logoUrl: raw.logoUrl ?? null,
    revenue: raw.revenue ?? 0,
    invoiceGenerationDay: raw.invoiceGenerationDay ?? null,
    paymentReminderDelay: raw.paymentReminderDelay ?? null,
    overdueNoticeDelay: raw.overdueNoticeDelay ?? null,
    portalAccess: raw.portalAccess ?? null,
    userId: raw.userId ?? null,
    _count: raw._count,
    createdAt: raw.createdAt || '',
    updatedAt: raw.updatedAt,
  };
}

export function formFromClient(c: ClientSummary): ClientFormValues {
  const statusRaw = String(c.status || 'ACTIVE').toUpperCase();
  const status =
    statusRaw === 'PAUSED' ? 'Paused' : statusRaw === 'CHURNED' ? 'Churned' : 'Active';
  const typeRaw = String(c.type || 'BUSINESS').toUpperCase();
  return {
    name: c.name || c.contactName || '',
    company: c.company || '',
    email: c.email || '',
    phone: c.phone || '',
    website: c.website || '',
    address: c.address || '',
    city: c.city || '',
    country: c.country || '',
    industry: c.industry || '',
    notes: c.notes || '',
    status,
    type: typeRaw === 'INDIVIDUAL' ? 'Individual' : 'Business',
    invoiceGenerationDay: String(c.invoiceGenerationDay ?? 1),
    paymentReminderDelay: String(c.paymentReminderDelay ?? 5),
    overdueNoticeDelay: String(c.overdueNoticeDelay ?? 10),
  };
}

export function clientPayload(form: ClientFormValues) {
  const initials = form.name
    .split(/\s+/)
    .filter(Boolean)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
  return {
    name: form.name.trim(),
    company: form.company.trim() || form.name.trim(),
    email: form.email.trim() || null,
    phone: form.phone.trim() || null,
    website: form.website.trim() || null,
    address: form.address.trim() || null,
    city: form.city.trim() || null,
    country: form.country.trim() || null,
    industry: form.industry.trim() || null,
    notes: form.notes.trim() || null,
    status: form.status.toUpperCase(),
    type: form.type.toUpperCase(),
    initials: initials || undefined,
    invoiceGenerationDay: form.invoiceGenerationDay
      ? parseInt(form.invoiceGenerationDay, 10)
      : null,
    paymentReminderDelay: form.paymentReminderDelay
      ? parseInt(form.paymentReminderDelay, 10)
      : null,
    overdueNoticeDelay: form.overdueNoticeDelay
      ? parseInt(form.overdueNoticeDelay, 10)
      : null,
  };
}

export function validateClientForm(form: ClientFormValues): Record<string, string> {
  const e: Record<string, string> = {};
  if (!form.name.trim()) e.name = 'Contact name is required';
  if (form.type === 'Business' && !form.company.trim()) e.company = 'Company name is required';
  if (form.email.trim() && !/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email address';
  return e;
}

export function clientDisplayName(c: Pick<ClientSummary, 'company' | 'name' | 'contactName'>): string {
  return c.company || c.name || c.contactName || 'Client';
}

export function clientStatusLabel(status?: string | null): string {
  const s = String(status || 'ACTIVE').toUpperCase();
  if (s === 'PAUSED') return 'Paused';
  if (s === 'CHURNED') return 'Churned';
  if (s === 'ACTIVE') return 'Active';
  return String(status || 'Active')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function clientStatusTone(
  status?: string | null
): 'success' | 'warning' | 'destructive' | 'default' {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'PAUSED') return 'warning';
  if (s === 'CHURNED') return 'destructive';
  return 'default';
}

export function clientLocation(c: Pick<ClientSummary, 'city' | 'country'>): string {
  if (c.city && c.country) return `${c.city}, ${c.country}`;
  return c.city || c.country || '—';
}

export function isIndividual(c: Pick<ClientSummary, 'type'>): boolean {
  return String(c.type || '').toUpperCase() === 'INDIVIDUAL';
}

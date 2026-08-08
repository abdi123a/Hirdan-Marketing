/** Normalize project status/priority between API enums and display labels. */

export const PROJECT_STATUSES = [
  { label: 'In Progress', value: 'IN_PROGRESS' },
  { label: 'Completed', value: 'COMPLETED' },
  { label: 'On Hold', value: 'ON_HOLD' },
  { label: 'Archived', value: 'ARCHIVED' },
] as const;

export const PROJECT_PRIORITIES = [
  { label: 'Low', value: 'LOW' },
  { label: 'Medium', value: 'MEDIUM' },
  { label: 'High', value: 'HIGH' },
  { label: 'Urgent', value: 'URGENT' },
] as const;

export function titleCaseStatus(raw?: string | null): string {
  const s = String(raw || '')
    .replace(/_/g, ' ')
    .trim();
  if (!s) return '—';
  const upper = s.toUpperCase().replace(/\s+/g, '_');
  const known = PROJECT_STATUSES.find((x) => x.value === upper);
  if (known) return known.label;
  return s
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function titleCasePriority(raw?: string | null): string {
  const s = String(raw || '').trim();
  if (!s) return '—';
  const upper = s.toUpperCase();
  const known = PROJECT_PRIORITIES.find((x) => x.value === upper);
  if (known) return known.label;
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

export function normalizeStatus(raw?: string | null): string {
  const s = String(raw || '')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, '_');
  if (s === 'IN_PROGRESS' || s === 'COMPLETED' || s === 'ON_HOLD' || s === 'ARCHIVED') return s;
  if (s === 'INPROGRESS') return 'IN_PROGRESS';
  return 'IN_PROGRESS';
}

export function normalizePriority(raw?: string | null): string {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'LOW' || s === 'MEDIUM' || s === 'HIGH' || s === 'URGENT') return s;
  return 'MEDIUM';
}

export function statusTone(
  status?: string | null
): 'default' | 'success' | 'warning' | 'destructive' | 'gold' {
  const s = normalizeStatus(status);
  if (s === 'COMPLETED') return 'success';
  if (s === 'ON_HOLD') return 'warning';
  if (s === 'ARCHIVED') return 'default';
  return 'gold';
}

export function isoDateOnly(value?: string | null): string {
  if (!value) return '';
  return String(value).split('T')[0];
}

export type ProjectRow = {
  id: string;
  name: string;
  description?: string | null;
  status?: string | null;
  priority?: string | null;
  progress?: number | null;
  budget?: number | null;
  startDate?: string | null;
  dueDate?: string | null;
  clientId?: string | null;
  client?: { id?: string; name?: string; company?: string | null } | null;
  teamMembers?: { id: string; name: string }[];
};

export function projectClientLabel(p: ProjectRow): string {
  return p.client?.company || p.client?.name || '—';
}

export function projectFromApi(raw: any): ProjectRow {
  return {
    id: String(raw.id),
    name: String(raw.name || 'Untitled'),
    description: raw.description ?? null,
    status: raw.status ?? null,
    priority: raw.priority ?? null,
    progress: typeof raw.progress === 'number' ? raw.progress : Number(raw.progress) || 0,
    budget: raw.budget != null ? Number(raw.budget) : null,
    startDate: raw.startDate ?? null,
    dueDate: raw.dueDate ?? null,
    clientId: raw.clientId ?? raw.client?.id ?? null,
    client: raw.client ?? null,
    teamMembers: Array.isArray(raw.teamMembers)
      ? raw.teamMembers.map((m: any) => ({
          id: String(m.id || m.teamMemberId || m.userId),
          name: String(m.name || m.teamMember?.name || 'Member'),
        }))
      : [],
  };
}

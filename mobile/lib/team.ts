import type { TeamMemberSummary } from '@hirdan/shared';

export const TEAM_STATUSES = [
  'DRAFT',
  'PENDING_DOCUMENTS',
  'ACTIVE',
  'ON_LEAVE',
  'TERMINATED',
] as const;

export type TeamStatus = (typeof TEAM_STATUSES)[number];

export type TeamMemberRow = TeamMemberSummary & {
  phone?: string | null;
  startDate?: string | null;
  bio?: string | null;
};

export function titleCase(raw?: string | null) {
  return String(raw || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function normalizeTeamStatus(raw?: string | null): TeamStatus {
  const s = String(raw || 'ACTIVE').toUpperCase().replace(/\s+/g, '_');
  return (TEAM_STATUSES as readonly string[]).includes(s) ? (s as TeamStatus) : 'ACTIVE';
}

export function teamStatusTone(
  status?: string | null
): 'default' | 'success' | 'warning' | 'destructive' | 'gold' {
  const s = normalizeTeamStatus(status);
  if (s === 'ACTIVE') return 'success';
  if (s === 'ON_LEAVE') return 'warning';
  if (s === 'TERMINATED') return 'destructive';
  if (s === 'PENDING_DOCUMENTS') return 'gold';
  return 'default';
}

export function teamFromApi(raw: Record<string, unknown>): TeamMemberRow {
  return {
    id: String(raw.id),
    name: String(raw.name || ''),
    email: (raw.email as string | null) ?? null,
    phone: (raw.phone as string | null) ?? null,
    role: (raw.role as string | null) ?? null,
    department: (raw.department as string | null) ?? null,
    photoUrl: (raw.photoUrl as string | null) ?? (raw.avatar as string | null) ?? null,
    status: normalizeTeamStatus(raw.status as string),
    startDate: (raw.startDate as string | null) ?? null,
    bio: (raw.bio as string | null) ?? null,
  };
}

export function isoDateOnly(value?: string | null) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toISOString().slice(0, 10);
}

export type TeamFormValues = {
  name: string;
  email: string;
  phone: string;
  role: string;
  department: string;
  status: TeamStatus;
  startDate: string;
  bio: string;
};

export function emptyTeamForm(): TeamFormValues {
  return {
    name: '',
    email: '',
    phone: '',
    role: '',
    department: '',
    status: 'ACTIVE',
    startDate: '',
    bio: '',
  };
}

export function teamFormFromMember(member: TeamMemberRow): TeamFormValues {
  return {
    name: member.name || '',
    email: member.email || '',
    phone: member.phone || '',
    role: member.role || '',
    department: member.department || '',
    status: normalizeTeamStatus(member.status),
    startDate: isoDateOnly(member.startDate),
    bio: member.bio || '',
  };
}

export function validateTeamForm(form: TeamFormValues): Record<string, string> {
  const errors: Record<string, string> = {};
  if (!form.name.trim()) errors.name = 'Name is required';
  if (!form.email.trim()) errors.email = 'Email is required';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
    errors.email = 'Enter a valid email';
  }
  if (!form.role.trim()) errors.role = 'Role is required';
  return errors;
}

export function teamPayload(form: TeamFormValues) {
  return {
    name: form.name.trim(),
    email: form.email.trim(),
    phone: form.phone.trim() || null,
    role: form.role.trim(),
    department: form.department.trim() || null,
    status: form.status,
    startDate: form.startDate || null,
    bio: form.bio.trim() || null,
  };
}

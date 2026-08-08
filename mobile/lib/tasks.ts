export const TASK_STATUSES = [
  'PENDING',
  'PLANNED',
  'IN_PROGRESS',
  'WAITING_APPROVAL',
  'COMPLETED',
  'CANCELLED',
] as const;

export type TaskStatus = (typeof TASK_STATUSES)[number];

export function taskStatusLabel(status?: string | null) {
  return String(status || 'UNKNOWN')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export function taskStatusTone(
  status?: string | null
): 'default' | 'success' | 'warning' | 'destructive' | 'gold' {
  const s = String(status || '').toUpperCase();
  if (s === 'COMPLETED') return 'success';
  if (s === 'IN_PROGRESS' || s === 'WAITING_APPROVAL') return 'warning';
  if (s === 'CANCELLED') return 'destructive';
  if (s === 'PLANNED') return 'gold';
  return 'default';
}

export type DeliverableTaskRow = {
  id: string;
  title: string;
  type?: string;
  status: string;
  dueDate?: string | null;
  client?: { id: string; name: string; company?: string | null };
  platforms?: { id?: string; platform: string }[];
  assignee?: { id: string; name: string } | null;
  cycle?: { id: string; label: string } | null;
};

export function taskFromApi(raw: Record<string, unknown>): DeliverableTaskRow {
  return {
    id: String(raw.id),
    title: String(raw.title || ''),
    type: raw.type as string | undefined,
    status: String(raw.status || 'PENDING'),
    dueDate: (raw.dueDate as string | null) ?? null,
    client: raw.client as DeliverableTaskRow['client'],
    platforms: (raw.platforms as DeliverableTaskRow['platforms']) || [],
    assignee: raw.assignee as DeliverableTaskRow['assignee'],
    cycle: raw.cycle as DeliverableTaskRow['cycle'],
  };
}

export function taskClientLabel(task: DeliverableTaskRow) {
  return task.client?.company || task.client?.name || 'Unknown client';
}

export function taskPlatformsLabel(task: DeliverableTaskRow) {
  const list = (task.platforms || []).map((p) => p.platform);
  if (!list.length) return 'No platforms';
  if (list.length <= 2) return list.join(', ');
  return `${list.slice(0, 2).join(', ')} +${list.length - 2}`;
}

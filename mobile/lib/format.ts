/** Normalize list payloads: raw arrays, `{ data: [] }`, or `{ clients: [] }` style wrappers. */
export function unwrapList<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    if (Array.isArray(obj.data)) return obj.data as T[];
    for (const value of Object.values(obj)) {
      if (Array.isArray(value)) return value as T[];
    }
  }
  return [];
}

/** Pick a single entity from `{ invoice: ... }` style responses. */
export function unwrapOne<T>(data: unknown, ...keys: string[]): T | undefined {
  if (!data || typeof data !== 'object') return data as T | undefined;
  const obj = data as Record<string, unknown>;
  for (const key of keys) {
    if (obj[key] != null) return obj[key] as T;
  }
  return data as T;
}

export function formatMoney(amount: number, currency = 'USD'): string {
  const value = Number.isFinite(amount) ? amount / 100 : 0;
  return formatMajorMoney(value, currency);
}

/** Format an amount already in major currency units (not cents). */
export function formatMajorMoney(amount: number, currency = 'USD'): string {
  const value = Number.isFinite(amount) ? amount : 0;
  try {
    return new Intl.NumberFormat('en-DJ', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString()}`;
  }
}

/** Hermes-safe relative time (no `Intl.RelativeTimeFormat`). */
export function relativeTime(date: Date | string | number): string {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return '';
  const seconds = Math.round((Date.now() - d.getTime()) / 1000);
  const past = seconds >= 0;
  const abs = Math.abs(seconds);
  const phrase = (n: number, unit: string) => {
    const label = `${n} ${unit}${n === 1 ? '' : 's'}`;
    return past ? `${label} ago` : `in ${label}`;
  };
  if (abs < 60) return past ? 'just now' : 'in a moment';
  const minutes = Math.round(abs / 60);
  if (minutes < 60) return phrase(minutes, 'min');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return phrase(hours, 'hour');
  const days = Math.round(hours / 24);
  if (days < 30) return phrase(days, 'day');
  const months = Math.round(days / 30);
  if (months < 12) return phrase(months, 'month');
  return phrase(Math.round(months / 12), 'year');
}

export function formatDate(value?: string | null, options?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, options ?? { year: 'numeric', month: 'short', day: 'numeric' });
}

/** API may return `total` or `amount` (cents). */
export function moneyAmount(item: { total?: number; amount?: number }): number {
  return item.total ?? item.amount ?? 0;
}

/** API may return `issueDate` or `date`. */
export function recordDate(item: { issueDate?: string | null; date?: string | null }): string | undefined {
  return item.issueDate ?? item.date ?? undefined;
}

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
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
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

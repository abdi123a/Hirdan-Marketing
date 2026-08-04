import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { unwrapList } from '../lib/format';

export type Account = {
  id: string;
  name: string;
  type?: string;
  currency?: string;
  balance?: number;
};

/**
 * Bank / cash / wallet accounts managed in web Settings → Accounts.
 * Every screen must go through this hook: the `['accounts']` cache entry is
 * shared, so a screen fetching the raw `{ accounts: [] }` envelope would hand
 * a non-array to the next screen that reads it.
 */
export function useAccounts(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['accounts'],
    enabled: options?.enabled ?? true,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.accounts.list);
      return unwrapList<Account>(res);
    },
  });
}

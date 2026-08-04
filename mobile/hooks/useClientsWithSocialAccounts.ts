import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { unwrapList } from '../lib/format';
import { fetchSocialAccounts } from '../lib/social';

export type SocialClientOpt = {
  id: string;
  name: string;
  company?: string;
  _count?: { socialAccounts?: number };
};

/**
 * Clients that have at least one connected social account — same rule as the
 * web Publish / Analyze client pickers (`clientsWithAccounts`).
 */
export function useClientsWithSocialAccounts(opts?: {
  /** Keep this client in the list even if accounts haven't loaded yet (edit flows). */
  includeClientId?: string;
  enabled?: boolean;
}) {
  const enabled = opts?.enabled !== false;

  const clientsQ = useQuery({
    queryKey: ['clients-social-picker'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=500`);
      return unwrapList<SocialClientOpt>(res);
    },
    enabled,
  });

  const accountsQ = useQuery({
    queryKey: ['social-accounts'],
    queryFn: () => fetchSocialAccounts(1000),
    enabled,
  });

  const clientIdsWithAccounts = useMemo(() => {
    const set = new Set<string>();
    for (const a of accountsQ.data || []) {
      if (a.clientId) set.add(a.clientId);
    }
    return set;
  }, [accountsQ.data]);

  const clients = useMemo(() => {
    const list = clientsQ.data || [];
    const filtered = list.filter((c) => {
      if (opts?.includeClientId && c.id === opts.includeClientId) return true;
      if (clientIdsWithAccounts.has(c.id)) return true;
      const count = c._count?.socialAccounts;
      return typeof count === 'number' && count > 0;
    });
    return [...filtered].sort((a, b) =>
      (a.company || a.name).localeCompare(b.company || b.name)
    );
  }, [clientsQ.data, clientIdsWithAccounts, opts?.includeClientId]);

  const options = useMemo(
    () =>
      clients.map((c) => ({
        label: c.company || c.name,
        value: c.id,
      })),
    [clients]
  );

  return {
    clients,
    options,
    accounts: accountsQ.data || [],
    clientIdsWithAccounts,
    isLoading: clientsQ.isLoading || accountsQ.isLoading,
    isError: clientsQ.isError || accountsQ.isError,
    refetch: async () => {
      await Promise.all([clientsQ.refetch(), accountsQ.refetch()]);
    },
  };
}

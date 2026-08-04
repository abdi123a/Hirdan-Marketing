import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { unwrapList } from '../lib/format';

/** Services + packages as selectable line-item sources (prices in major units). */
export function useInventory() {
  const servicesQ = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<unknown>(endpoints.services.list),
  });
  const packagesQ = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiFetch<unknown>(endpoints.packages.list),
  });

  const inventory = useMemo(() => {
    const services = unwrapList<{ id: string; name: string; basePrice?: number }>(servicesQ.data);
    const packages = unwrapList<{ id: string; name: string; price?: number }>(packagesQ.data);
    return [
      ...services.map((s) => ({
        label: s.name,
        value: `service:${s.id}`,
        unitPrice: (s.basePrice || 0) / 100,
      })),
      ...packages.map((p) => ({
        label: p.name,
        value: `package:${p.id}`,
        unitPrice: (p.price || 0) / 100,
      })),
    ];
  }, [servicesQ.data, packagesQ.data]);

  return { inventory, isLoading: servicesQ.isLoading || packagesQ.isLoading };
}

import React, { useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { FlashList } from '@shopify/flash-list';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatMoney, unwrapList } from '../../../../lib/format';
import {
  Badge,
  Card,
  EmptyState,
  ListSkeleton,
  SearchBar,
  SegmentedControl,
} from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, spacing } from '../../../../constants/theme';

type CatalogTab = 'packages' | 'services';

type PackageRow = {
  id: string;
  name: string;
  price?: number;
  type?: string | null;
  description?: string | null;
};

type ServiceRow = {
  id: string;
  name: string;
  basePrice?: number;
  category?: string | null;
  status?: string | null;
  description?: string | null;
};

function titleCaseType(value?: string | null): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function CatalogScreen() {
  const t = useTheme();
  const [tab, setTab] = useState<CatalogTab>('packages');
  const [query, setQuery] = useState('');

  const packagesQ = useQuery({
    queryKey: ['packages'],
    queryFn: () => apiFetch<unknown>(endpoints.packages.list),
  });

  const servicesQ = useQuery({
    queryKey: ['services'],
    queryFn: () => apiFetch<unknown>(endpoints.services.list),
  });

  const packages = useMemo(
    () => unwrapList<PackageRow>(packagesQ.data),
    [packagesQ.data],
  );
  const services = useMemo(
    () => unwrapList<ServiceRow>(servicesQ.data),
    [servicesQ.data],
  );

  const isLoading = tab === 'packages' ? packagesQ.isLoading : servicesQ.isLoading;
  const isRefetching = tab === 'packages' ? packagesQ.isRefetching : servicesQ.isRefetching;
  const refetch = tab === 'packages' ? packagesQ.refetch : servicesQ.refetch;
  const error = tab === 'packages' ? packagesQ.error : servicesQ.error;

  const filteredPackages = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        titleCaseType(p.type).toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q),
    );
  }, [packages, query]);

  const filteredServices = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return services;
    return services.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.category || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q),
    );
  }, [services, query]);

  const data = tab === 'packages' ? filteredPackages : filteredServices;

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <View style={styles.controls}>
        <SegmentedControl
          options={[
            { label: 'Packages', value: 'packages' as const },
            { label: 'Services', value: 'services' as const },
          ]}
          value={tab}
          onChange={setTab}
        />
        <SearchBar
          value={query}
          onChangeText={setQuery}
          placeholder={tab === 'packages' ? 'Search packages…' : 'Search services…'}
        />
      </View>

      {isLoading ? (
        <ListSkeleton rows={6} />
      ) : error ? (
        <EmptyState
          icon="grid-outline"
          title="Could not load catalog"
          description={(error as Error).message}
          actionLabel="Retry"
          onAction={() => refetch()}
        />
      ) : (
        <FlashList
          data={data}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
          }
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="grid-outline"
              title={tab === 'packages' ? 'No packages yet' : 'No services yet'}
              description={
                query.trim()
                  ? 'Try a different search term.'
                  : 'Packages and services from your catalog appear here.'
              }
            />
          }
          renderItem={({ item }) =>
            tab === 'packages' ? (
              <PackageCard pkg={item as PackageRow} />
            ) : (
              <ServiceCard service={item as ServiceRow} />
            )
          }
        />
      )}
    </View>
  );
}

function PackageCard({ pkg }: { pkg: PackageRow }) {
  const t = useTheme();
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: t.primary + '14' }]}>
          <Ionicons name="cube-outline" size={20} color={t.primary} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }} numberOfLines={2}>
            {pkg.name}
          </Text>
          <Badge label={titleCaseType(pkg.type)} tone="gold" />
        </View>
        <Text style={{ color: t.primary, fontWeight: '800', fontSize: fontSize.md }}>
          {formatMoney(pkg.price || 0)}
        </Text>
      </View>
      {pkg.description ? (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, marginTop: spacing.sm }} numberOfLines={3}>
          {pkg.description}
        </Text>
      ) : null}
    </Card>
  );
}

function ServiceCard({ service }: { service: ServiceRow }) {
  const t = useTheme();
  const unavailable = String(service.status || '').toUpperCase() === 'UNAVAILABLE';
  return (
    <Card style={styles.card}>
      <View style={styles.cardTop}>
        <View style={[styles.iconWrap, { backgroundColor: t.accent + '22' }]}>
          <Ionicons name="construct-outline" size={20} color={t.accentForeground} />
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }} numberOfLines={2}>
            {service.name}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
            {service.category ? <Badge label={service.category} /> : null}
            {unavailable ? <Badge label="Unavailable" tone="warning" /> : null}
          </View>
        </View>
        <Text style={{ color: t.primary, fontWeight: '800', fontSize: fontSize.md }}>
          {formatMoney(service.basePrice || 0)}
        </Text>
      </View>
      {service.description ? (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, marginTop: spacing.sm }} numberOfLines={3}>
          {service.description}
        </Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  controls: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  card: {
    marginBottom: spacing.md,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

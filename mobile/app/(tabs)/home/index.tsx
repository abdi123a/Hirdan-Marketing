import React from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import Svg, { Polyline, Rect } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { useAuthStore } from '../../../lib/auth-store';
import { Card, Skeleton, Badge } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { useResponsive } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

export default function HomeScreen() {
  const t = useTheme();
  const { isTablet } = useResponsive();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const clients = useQuery({
    queryKey: ['clients-count'],
    queryFn: () => apiFetch<any[]>(endpoints.clients.list),
  });
  const invoices = useQuery({
    queryKey: ['invoices-home'],
    queryFn: () => apiFetch<any[]>(endpoints.invoices.list),
  });
  const counts = useQuery({
    queryKey: ['notif-counts'],
    queryFn: () => apiFetch<{ total: number; unread: number }>(endpoints.notifications.counts),
  });

  const refreshing = clients.isRefetching || invoices.isRefetching;
  const onRefresh = () => {
    clients.refetch();
    invoices.refetch();
    counts.refetch();
  };

  const invoiceList = Array.isArray(invoices.data) ? invoices.data : (invoices.data as any)?.data || [];
  const clientList = Array.isArray(clients.data) ? clients.data : (clients.data as any)?.data || [];
  const paid = invoiceList.filter((i: any) => String(i.status).toUpperCase() === 'PAID').length;
  const outstanding = invoiceList.filter((i: any) => String(i.status).toUpperCase() !== 'PAID').length;
  const chartPoints = invoiceList.slice(0, 8).map((inv: any, idx: number) => {
    const x = 10 + idx * 36;
    const y = 90 - Math.min(80, (Number(inv.total) || 0) / 100);
    return `${x},${y}`;
  });

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={t.primary} />}
    >
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>Welcome back</Text>
          <Text style={{ color: t.foreground, fontSize: fontSize.xxl, fontWeight: '800' }}>
            {user?.name || 'Team'}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/(tabs)/home/notifications')}
          style={[styles.bell, { backgroundColor: t.card, borderColor: t.border }]}
        >
          <Ionicons name="notifications-outline" size={22} color={t.foreground} />
          {(counts.data?.unread || 0) > 0 ? (
            <View style={[styles.dot, { backgroundColor: t.destructive }]}>
              <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>
                {Math.min(99, counts.data!.unread)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      <View style={[styles.kpiGrid, isTablet && { flexDirection: 'row' }]}>
        <KpiCard title="Clients" value={String(clientList.length)} loading={clients.isLoading} />
        <KpiCard title="Invoices" value={String(invoiceList.length)} loading={invoices.isLoading} />
        <KpiCard title="Paid" value={String(paid)} loading={invoices.isLoading} tone="success" />
        <KpiCard title="Open" value={String(outstanding)} loading={invoices.isLoading} tone="warning" />
      </View>

      <Card>
        <Text style={{ color: t.foreground, fontWeight: '700', marginBottom: spacing.md }}>
          Recent invoice totals
        </Text>
        {invoices.isLoading ? (
          <Skeleton height={100} />
        ) : chartPoints.length ? (
          <Svg width="100%" height={100} viewBox="0 0 300 100">
            <Rect x={0} y={0} width={300} height={100} fill={t.muted} rx={8} />
            <Polyline
              points={chartPoints.join(' ')}
              fill="none"
              stroke={t.primary}
              strokeWidth={3}
            />
          </Svg>
        ) : (
          <Text style={{ color: t.mutedForeground }}>No invoice data yet</Text>
        )}
      </Card>

      <Card>
        <Text style={{ color: t.foreground, fontWeight: '700', marginBottom: spacing.sm }}>
          Quick tip
        </Text>
        <Text style={{ color: t.mutedForeground, lineHeight: 20 }}>
          Agency settings, users, and plugins stay on the web dashboard. Open them from More → Open
          dashboard.
        </Text>
      </Card>
    </ScrollView>
  );
}

function KpiCard({
  title,
  value,
  loading,
  tone,
}: {
  title: string;
  value: string;
  loading?: boolean;
  tone?: 'success' | 'warning';
}) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, minWidth: '45%' }}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>{title}</Text>
      {loading ? (
        <Skeleton height={28} width={48} style={{ marginTop: 8 }} />
      ) : (
        <Text style={{ color: t.foreground, fontSize: 28, fontWeight: '800', marginTop: 4 }}>
          {value}
        </Text>
      )}
      {tone ? <Badge label={tone === 'success' ? 'Healthy' : 'Attention'} tone={tone} /> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
});

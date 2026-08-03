import React, { useState } from 'react';
import { Linking, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { endpoints, type ClientSummary } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, unwrapOne } from '../../../lib/format';
import { Badge, Card, EmptyState, Skeleton, Tabs } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize } from '../../../constants/theme';

function statusTone(status?: string): 'default' | 'success' | 'warning' | 'destructive' {
  const s = String(status || '').toUpperCase();
  if (s === 'ACTIVE') return 'success';
  if (s === 'INACTIVE' || s === 'CHURNED') return 'destructive';
  if (s === 'LEAD' || s === 'PROSPECT') return 'warning';
  return 'default';
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const [tab, setTab] = useState('overview');

  const { data, isLoading, isRefetching, refetch, error } = useQuery({
    queryKey: ['client', id],
    queryFn: () => apiFetch<unknown>(endpoints.clients.byId(id!)),
    enabled: !!id,
  });

  const client = unwrapOne<ClientSummary>(data, 'client', 'data');

  if (isLoading) {
    return (
      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        <Skeleton height={120} />
        <Skeleton height={80} />
      </View>
    );
  }

  if (error || !client) {
    return (
      <EmptyState
        title="Client not found"
        description={(error as Error)?.message || 'This client may have been removed.'}
        actionLabel="Retry"
        onAction={() => refetch()}
        icon="person-outline"
      />
    );
  }

  const notes = (client as ClientSummary & { notes?: string | null }).notes;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />}
    >
      <Card>
        <View style={styles.header}>
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800', flex: 1 }}>
            {client.company}
          </Text>
          <Badge label={client.status || 'Active'} tone={statusTone(client.status)} />
        </View>
        {client.contactName || (client as ClientSummary & { name?: string }).name ? (
          <Text style={{ color: t.mutedForeground, marginTop: spacing.xs }}>
            {client.contactName || (client as ClientSummary & { name?: string }).name}
          </Text>
        ) : null}
      </Card>

      <Tabs
        tabs={[
          { key: 'overview', label: 'Overview' },
          { key: 'notes', label: 'Notes' },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'overview' ? (
        <Card style={{ gap: spacing.md }}>
          <Field label="Email" value={client.email} onPress={client.email ? () => Linking.openURL(`mailto:${client.email}`) : undefined} />
          <Field label="Phone" value={client.phone} onPress={client.phone ? () => Linking.openURL(`tel:${client.phone}`) : undefined} />
          <Field label="Industry" value={client.industry} />
          <Field label="Created" value={formatDate(client.createdAt)} />
        </Card>
      ) : (
        <Card>
          {notes ? (
            <Text style={{ color: t.foreground, lineHeight: 22 }}>{notes}</Text>
          ) : (
            <Text style={{ color: t.mutedForeground, lineHeight: 22 }}>
              No notes on file for this client yet.
            </Text>
          )}
        </Card>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onPress,
}: {
  label: string;
  value?: string | null;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <View>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600', marginBottom: 2 }}>
        {label}
      </Text>
      <Text
        style={{
          color: onPress ? t.primary : t.foreground,
          fontSize: fontSize.md,
          fontWeight: onPress ? '600' : '500',
        }}
        onPress={onPress}
      >
        {value || '—'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
});

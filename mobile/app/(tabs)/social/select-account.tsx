import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList } from '../../../lib/format';
import {
  fetchOAuthPending,
  platformLabel,
  selectOAuthAccounts,
} from '../../../lib/social';
import { PlatformIcon } from '../../../components/social/PlatformIcon';
import { SocialAccountAvatar } from '../../../components/social/SocialAccountAvatar';
import {
  Badge,
  Button,
  EmptyState,
  Select,
  ListSkeleton,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../constants/theme';

type ClientOpt = { id: string; name: string; company?: string };

/**
 * Meta (and similar) multi-page OAuth picker — mirrors web
 * /dashboard/social-media/select-account?session=&platform=
 */
export default function SocialSelectAccountScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ session?: string; platform?: string }>();
  const sessionId = typeof params.session === 'string' ? params.session : '';

  const [selected, setSelected] = useState<Record<string, string>>({});
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);

  const pendingQ = useQuery({
    queryKey: ['oauth-pending', sessionId],
    queryFn: () => fetchOAuthPending(sessionId),
    enabled: !!sessionId,
  });

  const clientsQ = useQuery({
    queryKey: ['clients-mini'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList<ClientOpt>(res);
    },
  });

  useEffect(() => {
    if (!pendingQ.data) return;
    setSecondsLeft(pendingQ.data.expiresIn);
    const defaults: Record<string, string> = {};
    for (const acc of pendingQ.data.accounts) {
      defaults[acc.id] =
        acc.ownedBy?.clientId || pendingQ.data.clientId || '';
    }
    setSelected(defaults);
  }, [pendingQ.data]);

  useEffect(() => {
    if (secondsLeft == null) return;
    if (secondsLeft <= 0) return;
    const tmr = setInterval(() => setSecondsLeft((s) => (s == null ? s : s - 1)), 1000);
    return () => clearInterval(tmr);
  }, [secondsLeft != null]);

  const clientOptions = useMemo(
    () =>
      (clientsQ.data || []).map((c) => ({
        label: c.company || c.name,
        value: c.id,
      })),
    [clientsQ.data]
  );

  const selectM = useMutation({
    mutationFn: async () => {
      const assignments = Object.entries(selected)
        .filter(([, clientId]) => !!clientId)
        .map(([id, clientId]) => ({ id, clientId }));
      if (!assignments.length) throw new Error('Select at least one account');
      return selectOAuthAccounts(sessionId, assignments);
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['social-workspace-summary'] });
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['social-by-client'] });
      toast(res.message || 'Accounts connected', 'success');
      router.replace('/(tabs)/social/accounts');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (!sessionId) {
    return (
      <EmptyState
        title="Missing session"
        description="Start connecting an account from Social → Accounts."
        actionLabel="Accounts"
        onAction={() => router.replace('/(tabs)/social/accounts')}
        icon="link-outline"
      />
    );
  }

  if (pendingQ.isLoading) {
    return <ListSkeleton rows={4} />;
  }

  if (pendingQ.error || !pendingQ.data) {
    return (
      <EmptyState
        title="Session expired"
        description={(pendingQ.error as Error)?.message || 'Start the connection again.'}
        actionLabel="Back to Accounts"
        onAction={() => router.replace('/(tabs)/social/accounts')}
        icon="alert-circle-outline"
      />
    );
  }

  const data = pendingQ.data;
  const allSelected = data.accounts.every((a) => !!selected[a.id]);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <PlatformIcon platform={data.platform} size={28} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.lg }}>
            Select accounts
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Assign each page/profile to a client
          </Text>
        </View>
        {secondsLeft != null ? (
          <Badge
            label={`${Math.max(0, Math.floor(secondsLeft / 60))}:${String(Math.max(0, secondsLeft % 60)).padStart(2, '0')}`}
            tone={secondsLeft < 60 ? 'destructive' : 'warning'}
          />
        ) : null}
      </View>

      {(data.platform === 'facebook' || data.platform === 'instagram') ? (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
          One Meta login can connect multiple Pages. Pick a client for each Page below.
        </Text>
      ) : null}

      <Button
        title={allSelected ? 'Clear all' : 'Select all'}
        variant="outline"
        onPress={() => {
          if (allSelected) {
            setSelected({});
            return;
          }
          const next: Record<string, string> = {};
          for (const acc of data.accounts) {
            next[acc.id] = acc.ownedBy?.clientId || data.clientId || clientOptions[0]?.value || '';
          }
          setSelected(next);
        }}
      />

      {data.accounts.map((acc) => {
        const checked = !!selected[acc.id];
        const lockedClient = acc.ownedBy?.clientId;
        return (
          <Pressable
            key={acc.id}
            onPress={() => {
              setSelected((prev) => {
                if (prev[acc.id]) {
                  const copy = { ...prev };
                  delete copy[acc.id];
                  return copy;
                }
                return {
                  ...prev,
                  [acc.id]: lockedClient || data.clientId || clientOptions[0]?.value || '',
                };
              });
            }}
            style={[
              styles.row,
              {
                borderColor: checked ? t.primary : t.border,
                backgroundColor: checked ? t.accent : t.card,
              },
            ]}
          >
            <SocialAccountAvatar
              avatarUrl={acc.avatarUrl}
              name={acc.name}
              platform={data.platform}
              size={48}
            />
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.foreground, fontWeight: '700' }}>{acc.name}</Text>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {acc.username ? `@${acc.username}` : platformLabel(data.platform)}
                {acc.followers != null ? ` · ${acc.followers.toLocaleString()} followers` : ''}
              </Text>
              {acc.ownedBy ? (
                <Badge label={`Already ${acc.ownedBy.clientName}`} tone="warning" />
              ) : null}
              {checked && !lockedClient ? (
                <Select
                  value={selected[acc.id]}
                  options={clientOptions}
                  onChange={(clientId) =>
                    setSelected((prev) => ({ ...prev, [acc.id]: clientId }))
                  }
                  placeholder="Assign client"
                />
              ) : null}
            </View>
          </Pressable>
        );
      })}

      <Button
        title="Connect selected"
        loading={selectM.isPending}
        disabled={Object.keys(selected).length === 0 || (secondsLeft != null && secondsLeft <= 0)}
        onPress={() => selectM.mutate()}
      />
      <Button
        title="Cancel"
        variant="outline"
        onPress={() => router.replace('/(tabs)/social/accounts')}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
});

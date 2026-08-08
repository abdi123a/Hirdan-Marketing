import React, { useMemo, useState } from 'react';
import { Linking, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { useRouter } from 'expo-router';
import { apiFetch } from '../lib/api-client';
import {
  SOCIAL_PLATFORMS,
  accountDisplayName,
  disconnectSocialAccount,
  getOAuthConnectUrl,
  healthTone,
  platformLabel,
  type SocialAccount,
} from '../lib/social';
import { PlatformIcon } from './social/PlatformIcon';
import { SocialAccountAvatar } from './social/SocialAccountAvatar';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Sheet,
  SkeletonListRow,
  useToast,
} from './ui';
import { useTheme } from '../hooks/useTheme';
import { fontSize, radius, spacing } from '../constants/theme';

export function ClientSocialSection({ clientId }: { clientId: string }) {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [platform, setPlatform] = useState('');
  const [disconnectTarget, setDisconnectTarget] = useState<SocialAccount | null>(null);

  const accountsQ = useQuery({
    queryKey: ['social-by-client', clientId],
    queryFn: async () => {
      const [accs, status] = await Promise.all([
        apiFetch<SocialAccount[] | { accounts: SocialAccount[] }>(
          endpoints.social.accountsByClient(clientId)
        ),
        apiFetch<Record<string, { configured: boolean; enabled: boolean }>>(
          endpoints.social.platformStatus
        ).catch(() => ({})),
      ]);
      const list = Array.isArray(accs) ? accs : (accs as { accounts?: SocialAccount[] }).accounts || [];
      return { accounts: list as SocialAccount[], platformStatus: status || {} };
    },
  });

  const accounts = accountsQ.data?.accounts || [];
  const platformStatus = accountsQ.data?.platformStatus || {};
  const connected = useMemo(
    () => new Set(accounts.map((a) => a.platform.toLowerCase())),
    [accounts]
  );

  const availablePlatforms = SOCIAL_PLATFORMS.filter((p) => {
    if (connected.has(p.id)) return false;
    const st = (platformStatus as Record<string, { configured?: boolean; enabled?: boolean }>)[p.id];
    if (st && st.configured === false) return false;
    if (st && st.enabled === false) return false;
    return true;
  }).map((p) => ({ label: p.label, value: p.id }));

  const connectM = useMutation({
    mutationFn: (plat: string) => getOAuthConnectUrl(plat, clientId),
    onSuccess: async (url) => {
      setShowAdd(false);
      setPlatform('');
      const can = await Linking.canOpenURL(url);
      if (can) await Linking.openURL(url);
      else toast('Cannot open OAuth URL', 'error');
      toast('Complete connection in the browser, then pull to refresh', 'default');
    },
    onError: (e: Error) => toast(e.message || 'Connection failed', 'error'),
  });

  const disconnectM = useMutation({
    mutationFn: (accountId: string) => disconnectSocialAccount(accountId),
    onSuccess: () => {
      toast('Disconnected', 'success');
      setDisconnectTarget(null);
      queryClient.invalidateQueries({ queryKey: ['social-by-client', clientId] });
      queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
      queryClient.invalidateQueries({ queryKey: ['clients-social-picker'] });
      queryClient.invalidateQueries({ queryKey: ['social-workspace-summary'] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to disconnect', 'error'),
  });

  if (accountsQ.isLoading) {
    return (
      <View>
        <SkeletonListRow />
        <SkeletonListRow />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
            Social profiles
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Connected accounts for this client
          </Text>
        </View>
        <Button
          title="Connect"
          size="sm"
          onPress={() => setShowAdd(true)}
          disabled={availablePlatforms.length === 0}
        />
      </View>

      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Button
          title="Compose"
          size="sm"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() =>
            router.push({ pathname: '/compose', params: { clientId } })
          }
        />
        <Button
          title="Analyze"
          size="sm"
          variant="outline"
          style={{ flex: 1 }}
          onPress={() =>
            router.push({ pathname: '/(tabs)/social/analyze', params: { clientId } })
          }
        />
      </View>

      {accounts.length === 0 ? (
        <EmptyState
          title="No social accounts connected yet"
          description="Connect Facebook, Instagram, and more for this client."
          icon="share-social-outline"
          actionLabel="Connect account"
          onAction={() => setShowAdd(true)}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {accounts.map((a, i) => (
            <View
              key={a.id}
              style={[
                styles.row,
                i < accounts.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: t.border,
                },
              ]}
            >
              <SocialAccountAvatar
                accountId={a.id}
                avatarUrl={a.avatarUrl}
                name={accountDisplayName(a)}
                platform={a.platform}
                size={40}
              />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }}>
                  {accountDisplayName(a)}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  {platformLabel(a.platform)}
                  {a.platformUsername ? ` · @${a.platformUsername}` : ''}
                </Text>
                <Badge label={a.healthStatus || (a.isActive ? 'Active' : 'Inactive')} tone={healthTone(a.healthStatus)} />
                {a.healthMessage ? (
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={2}>
                    {a.healthMessage}
                  </Text>
                ) : null}
              </View>
              <Pressable onPress={() => setDisconnectTarget(a)} hitSlop={8}>
                <Ionicons name="unlink-outline" size={20} color={t.destructive} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={showAdd} onClose={() => setShowAdd(false)} title="Connect platform">
        <View style={{ gap: spacing.md }}>
          <View style={styles.platformGrid}>
            {availablePlatforms.map((p) => {
              const selected = platform === p.value;
              return (
                <Pressable
                  key={p.value}
                  onPress={() => setPlatform(p.value)}
                  style={[
                    styles.platformTile,
                    {
                      borderColor: selected ? t.primary : t.border,
                      backgroundColor: selected ? t.accent : t.background,
                    },
                  ]}
                >
                  <PlatformIcon platform={p.value} size={24} />
                  <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }} numberOfLines={2}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {(platform === 'facebook' || platform === 'instagram') ? (
            <Text style={{ color: t.warning, fontSize: fontSize.xs }}>
              Meta may ask you to choose Pages after login. Finish selection, then return here.
            </Text>
          ) : null}
          <Button
            title={connectM.isPending ? 'Opening…' : 'Continue with OAuth'}
            loading={connectM.isPending}
            disabled={!platform || connectM.isPending}
            onPress={() => connectM.mutate(platform)}
          />
        </View>
      </Sheet>

      <Dialog
        visible={!!disconnectTarget}
        title="Disconnect account"
        message={`Disconnect ${disconnectTarget?.displayName || disconnectTarget?.platformUsername || 'this account'}? Scheduled posts to this account will stop.`}
        confirmLabel="Disconnect"
        destructive
        onCancel={() => setDisconnectTarget(null)}
        onConfirm={() => disconnectTarget && disconnectM.mutate(disconnectTarget.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  platformGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  platformTile: {
    width: '30%',
    flexGrow: 1,
    minWidth: 96,
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
    gap: 6,
  },
});

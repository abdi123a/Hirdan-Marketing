import React, { useMemo, useState } from 'react';
import {
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, relativeTime, unwrapList } from '../../../lib/format';
import { importTiktokStudio } from '../../../lib/social-analytics';
import {
  PLATFORM_CAPABILITIES,
  SOCIAL_PLATFORMS,
  accountDisplayName,
  disconnectSocialAccount,
  fetchAccountActivity,
  fetchPlatformStatus,
  fetchWorkspaceSummary,
  getOAuthConnectUrl,
  healthTone,
  platformLabel,
  syncSocialAccount,
  type AccountActivityEvent,
  type SocialAccount,
  type SocialWorkspace,
} from '../../../lib/social';
import { PlatformIcon, PlatformIconStack } from '../../../components/social/PlatformIcon';
import { SocialAccountAvatar } from '../../../components/social/SocialAccountAvatar';
import {
  Badge,
  Button,
  Card,
  Chip,
  Dialog,
  EmptyState,
  KpiCard,
  KpiGrid,
  SearchBar,
  Select,
  Sheet,
  ListSkeleton,
  SkeletonCard,
  SkeletonListRow,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { usePermissions } from '../../../hooks/usePermissions';
import { fontSize, radius, spacing } from '../../../constants/theme';

type ClientOpt = { id: string; name: string; company?: string };
type HealthFilter = 'all' | 'healthy' | 'warning' | 'critical';

export default function SocialAccountsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();

  const [search, setSearch] = useState('');
  const [healthFilter, setHealthFilter] = useState<HealthFilter>('all');
  const [sort, setSort] = useState<'az' | 'sync' | 'publish'>('az');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [showConnect, setShowConnect] = useState(false);
  const [connectStep, setConnectStep] = useState<1 | 2>(1);
  const [connectClientId, setConnectClientId] = useState('');
  const [connectPlatform, setConnectPlatform] = useState('');
  const [disconnectTarget, setDisconnectTarget] = useState<SocialAccount | null>(null);
  const [activityAccount, setActivityAccount] = useState<SocialAccount | null>(null);
  const [showImport, setShowImport] = useState(false);
  const [importClientId, setImportClientId] = useState('');
  const [importAccountId, setImportAccountId] = useState('');

  const workspaceQ = useQuery({
    queryKey: ['social-workspace-summary'],
    queryFn: fetchWorkspaceSummary,
  });

  const clientsQ = useQuery({
    queryKey: ['clients-mini'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList<ClientOpt>(res);
    },
  });

  const statusQ = useQuery({
    queryKey: ['social-platform-status'],
    queryFn: fetchPlatformStatus,
  });

  const activityQ = useQuery({
    queryKey: ['social-account-activity', activityAccount?.id],
    queryFn: () => fetchAccountActivity(activityAccount!.id),
    enabled: !!activityAccount,
  });

  const summary = workspaceQ.data?.summary;
  const workspaces = workspaceQ.data?.workspaces || [];

  const filtered = useMemo(() => {
    let list = [...workspaces];
    if (healthFilter !== 'all') {
      list = list.filter((w) => w.healthStatus === healthFilter);
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((w) => {
        const hay = [
          w.clientCompany,
          w.clientName,
          ...w.accounts.map((a) => `${a.displayName} ${a.platformUsername} ${a.platform}`),
        ]
          .join(' ')
          .toLowerCase();
        return hay.includes(q);
      });
    }
    list.sort((a, b) => {
      if (sort === 'sync') {
        return new Date(b.lastSync || 0).getTime() - new Date(a.lastSync || 0).getTime();
      }
      if (sort === 'publish') {
        return new Date(b.lastPublish || 0).getTime() - new Date(a.lastPublish || 0).getTime();
      }
      return (a.clientCompany || a.clientName).localeCompare(b.clientCompany || b.clientName);
    });
    return list;
  }, [workspaces, healthFilter, search, sort]);

  const platformStatus = statusQ.data || {};
  const clientOptions = useMemo(
    () =>
      (clientsQ.data || []).map((c) => ({
        label: c.company || c.name,
        value: c.id,
      })),
    [clientsQ.data]
  );

  const tiktokAccounts = useMemo(() => {
    const ws = workspaces.find((w) => w.clientId === importClientId);
    return (ws?.accounts || []).filter((a) => a.platform.toLowerCase() === 'tiktok');
  }, [workspaces, importClientId]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['social-workspace-summary'] });
    queryClient.invalidateQueries({ queryKey: ['social-accounts'] });
    queryClient.invalidateQueries({ queryKey: ['social-by-client'] });
    queryClient.invalidateQueries({ queryKey: ['clients-social-picker'] });
  };

  const connectM = useMutation({
    mutationFn: async () => {
      if (!connectClientId) throw new Error('Select a client');
      if (!connectPlatform) throw new Error('Select a platform');
      return getOAuthConnectUrl(connectPlatform, connectClientId);
    },
    onSuccess: async (url) => {
      setShowConnect(false);
      setConnectStep(1);
      setConnectPlatform('');
      await Linking.openURL(url);
      toast('Finish OAuth in the browser, then pull to refresh', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const syncM = useMutation({
    mutationFn: (id: string) => syncSocialAccount(id),
    onSuccess: () => {
      invalidate();
      toast('Account synced', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const disconnectM = useMutation({
    mutationFn: (id: string) => disconnectSocialAccount(id),
    onSuccess: () => {
      setDisconnectTarget(null);
      invalidate();
      toast('Account disconnected', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const importM = useMutation({
    mutationFn: async () => {
      if (!importAccountId) throw new Error('Select a TikTok account');
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: true,
        copyToCacheDirectory: true,
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
        ],
      });
      if (picked.canceled || !picked.assets?.length) throw new Error('No files selected');
      return importTiktokStudio(
        importAccountId,
        picked.assets.map((a) => ({
          uri: a.uri,
          name: a.name || `tiktok-${Date.now()}.xlsx`,
          type: a.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }))
      );
    },
    onSuccess: (res) => {
      setShowImport(false);
      toast(res.message || `Imported ${res.imported ?? 0} rows`, 'success');
      invalidate();
    },
    onError: (e: Error) => {
      if (e.message !== 'No files selected') toast(e.message, 'error');
    },
  });

  const openConnect = (clientId?: string, platform?: string) => {
    setConnectClientId(clientId || '');
    setConnectPlatform(platform || '');
    setConnectStep(clientId ? 2 : 1);
    setShowConnect(true);
  };

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={workspaceQ.isRefetching}
            onRefresh={() => workspaceQ.refetch()}
            tintColor={t.primary}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.lg }}>
              Social Account Management
            </Text>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              Connect, monitor, and sync brand workspaces
            </Text>
          </View>
        </View>

        {canWrite('social_media') ? (
          <View style={styles.actions}>
            <Button
              title="Import data"
              variant="tonal"
              icon="cloud-download-outline"
              style={styles.headerAction}
              onPress={() => setShowImport(true)}
            />
            <Button
              title="Connect account"
              icon="add"
              style={styles.headerAction}
              onPress={() => openConnect()}
            />
          </View>
        ) : null}

        {workspaceQ.isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}>
                <SkeletonCard height={118} />
              </View>
              <View style={{ flex: 1 }}>
                <SkeletonCard height={118} />
              </View>
            </View>
            <ListSkeleton rows={4} padding={0} />
          </View>
        ) : workspaceQ.error ? (
          <EmptyState
            title="Could not load accounts"
            description={(workspaceQ.error as Error).message}
            actionLabel="Retry"
            onAction={() => workspaceQ.refetch()}
            icon="alert-circle-outline"
          />
        ) : (
          <>
            <KpiGrid>
              <KpiCard
                label="Workspaces"
                value={String(summary?.totalWorkspaces ?? 0)}
                hint="Brand clients"
                icon="business-outline"
                tone="purple"
              />
              <KpiCard
                label="Accounts"
                value={String(summary?.totalAccounts ?? 0)}
                hint="Connected profiles"
                icon="link-outline"
                tone="gold"
              />
              <KpiCard
                label="Platforms"
                value={String(summary?.activePlatforms ?? 0)}
                hint="Active integrations"
                icon="apps-outline"
                tone="neutral"
              />
              <KpiCard
                label="Needs attention"
                value={String(summary?.needsAttention ?? 0)}
                hint={(summary?.needsAttention ?? 0) > 0 ? 'Review health' : 'All clear'}
                hintTone={(summary?.needsAttention ?? 0) > 0 ? 'warning' : 'success'}
                icon="warning-outline"
                tone={(summary?.needsAttention ?? 0) > 0 ? 'warning' : 'success'}
              />
            </KpiGrid>

            <Card style={{ gap: spacing.md }}>
              <Text style={[styles.cardTitle, { color: t.foreground }]}>API integrations</Text>
              <View style={styles.platformGrid}>
                {SOCIAL_PLATFORMS.map((p) => {
                  const st = platformStatus[p.id];
                  const enabled = st?.enabled !== false && st?.configured !== false;
                  const count = workspaces.reduce(
                    (n, w) => n + w.accounts.filter((a) => a.platform.toLowerCase() === p.id).length,
                    0
                  );
                  return (
                    <View
                      key={p.id}
                      style={[
                        styles.platformTile,
                        { borderColor: t.border, backgroundColor: t.background, opacity: enabled ? 1 : 0.55 },
                      ]}
                    >
                      <PlatformIcon platform={p.id} size={22} />
                      <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }} numberOfLines={1}>
                        {p.label}
                      </Text>
                      <Badge
                        label={!st?.configured ? 'Not set' : enabled ? 'Active' : 'Disabled'}
                        tone={!st?.configured ? 'default' : enabled ? 'success' : 'warning'}
                      />
                      <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{count} connected</Text>
                    </View>
                  );
                })}
              </View>
            </Card>

            <SearchBar value={search} onChangeText={setSearch} placeholder="Search workspaces…" />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {(
                [
                  ['all', 'All'],
                  ['healthy', 'Healthy'],
                  ['warning', 'Warning'],
                  ['critical', 'Critical'],
                ] as const
              ).map(([k, label]) => (
                <Chip key={k} label={label} selected={healthFilter === k} onPress={() => setHealthFilter(k)} />
              ))}
            </ScrollView>
            <Select
              label="Sort"
              value={sort}
              options={[
                { label: 'A → Z', value: 'az' },
                { label: 'Recent sync', value: 'sync' },
                { label: 'Recent publish', value: 'publish' },
              ]}
              onChange={(v) => setSort(v as typeof sort)}
            />

            {filtered.length === 0 ? (
              <EmptyState
                title="No brand workspaces"
                description="Connect a social account to create your first workspace."
                actionLabel={canWrite('social_media') ? 'Connect' : undefined}
                onAction={canWrite('social_media') ? () => openConnect() : undefined}
                icon="link-outline"
              />
            ) : (
              filtered.map((ws) => (
                <WorkspaceCard
                  key={ws.clientId}
                  workspace={ws}
                  expanded={!!expanded[ws.clientId]}
                  canWrite={canWrite('social_media')}
                  syncing={syncM.isPending}
                  onToggle={() =>
                    setExpanded((prev) => ({ ...prev, [ws.clientId]: !prev[ws.clientId] }))
                  }
                  onConnect={(platform) => openConnect(ws.clientId, platform)}
                  onSync={(id) => syncM.mutate(id)}
                  onLogs={(acc) => setActivityAccount(acc)}
                  onDisconnect={(acc) => setDisconnectTarget(acc)}
                  onOpenClient={() => router.push(`/client/${ws.clientId}`)}
                />
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Connect wizard */}
      <Sheet
        visible={showConnect}
        onClose={() => {
          setShowConnect(false);
          setConnectStep(1);
        }}
        title={connectStep === 1 ? 'Select client' : 'Choose platform'}
      >
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Step {connectStep} of 2
          </Text>
          {connectStep === 1 ? (
            <>
              <Select
                label="Client"
                value={connectClientId}
                options={clientOptions}
                onChange={setConnectClientId}
                placeholder="Select client"
              />
              <Button
                title="Next"
                disabled={!connectClientId}
                onPress={() => setConnectStep(2)}
              />
            </>
          ) : (
            <>
              <View style={styles.platformGrid}>
                {SOCIAL_PLATFORMS.map((p) => {
                  const st = platformStatus[p.id];
                  const enabled = st?.enabled !== false && st?.configured !== false;
                  const selected = connectPlatform === p.id;
                  return (
                    <Pressable
                      key={p.id}
                      disabled={!enabled}
                      onPress={() => setConnectPlatform(p.id)}
                      style={[
                        styles.platformTile,
                        {
                          borderColor: selected ? t.primary : t.border,
                          backgroundColor: selected ? t.accent : t.background,
                          opacity: enabled ? 1 : 0.4,
                        },
                      ]}
                    >
                      <PlatformIcon platform={p.id} size={24} />
                      <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }} numberOfLines={2}>
                        {p.label}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              {(connectPlatform === 'facebook' || connectPlatform === 'instagram') ? (
                <Text style={{ color: t.warning, fontSize: fontSize.xs }}>
                  Meta may ask you to pick pages after login. If multiple pages appear, finish selection
                  in the browser (or open Select Account in the app), then return here.
                </Text>
              ) : null}
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button title="Back" variant="outline" style={{ flex: 1 }} onPress={() => setConnectStep(1)} />
                <Button
                  title="Authenticate"
                  style={{ flex: 1 }}
                  loading={connectM.isPending}
                  disabled={!connectPlatform}
                  onPress={() => connectM.mutate()}
                />
              </View>
            </>
          )}
        </View>
      </Sheet>

      {/* Activity */}
      <Sheet
        visible={!!activityAccount}
        onClose={() => setActivityAccount(null)}
        title={activityAccount ? `${accountDisplayName(activityAccount)} logs` : 'Activity'}
      >
        {activityQ.isLoading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
          </View>
        ) : (activityQ.data || []).length === 0 ? (
          <Text style={{ color: t.mutedForeground }}>No recent activity</Text>
        ) : (
          <View style={{ gap: spacing.md }}>
            {(activityQ.data || []).map((ev, i) => (
              <ActivityRow key={`${ev.type}-${i}`} event={ev} />
            ))}
          </View>
        )}
      </Sheet>

      {/* TikTok import */}
      <Sheet visible={showImport} onClose={() => setShowImport(false)} title="Import TikTok Studio">
        <View style={{ gap: spacing.md }}>
          <Select
            label="Client"
            value={importClientId}
            options={clientOptions}
            onChange={(id) => {
              setImportClientId(id);
              setImportAccountId('');
            }}
          />
          <Select
            label="TikTok account"
            value={importAccountId}
            options={tiktokAccounts.map((a) => ({
              label: accountDisplayName(a),
              value: a.id,
            }))}
            onChange={setImportAccountId}
            placeholder={importClientId ? 'Select account' : 'Pick a client first'}
          />
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Upload TikTok Studio XLSX/CSV exports (Overview, Content, Viewers, etc.).
          </Text>
          <Button
            title="Choose files & import"
            loading={importM.isPending}
            disabled={!importAccountId}
            onPress={() => importM.mutate()}
          />
        </View>
      </Sheet>

      <Dialog
        visible={!!disconnectTarget}
        title="Disconnect account?"
        message={
          disconnectTarget
            ? `Remove ${accountDisplayName(disconnectTarget)}? Scheduled posts to this account will stop. History is preserved.`
            : undefined
        }
        confirmLabel="Disconnect"
        destructive
        onConfirm={() => disconnectTarget && disconnectM.mutate(disconnectTarget.id)}
        onCancel={() => setDisconnectTarget(null)}
      />
    </View>
  );
}

function WorkspaceCard({
  workspace: ws,
  expanded,
  canWrite,
  syncing,
  onToggle,
  onConnect,
  onSync,
  onLogs,
  onDisconnect,
  onOpenClient,
}: {
  workspace: SocialWorkspace;
  expanded: boolean;
  canWrite: boolean;
  syncing: boolean;
  onToggle: () => void;
  onConnect: (platform?: string) => void;
  onSync: (id: string) => void;
  onLogs: (acc: SocialAccount) => void;
  onDisconnect: (acc: SocialAccount) => void;
  onOpenClient: () => void;
}) {
  const t = useTheme();
  return (
    <Card style={{ gap: spacing.md }}>
      <Pressable onPress={onToggle} style={styles.wsHead}>
        <View style={[styles.wsAvatar, { backgroundColor: t.primary }]}>
          <Text style={{ color: t.primaryForeground, fontWeight: '800' }}>
            {(ws.clientCompany || ws.clientName || '?').slice(0, 1).toUpperCase()}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800' }} numberOfLines={1}>
            {ws.clientCompany || ws.clientName}
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
            {ws.clientName} · {ws.accountCount} accounts · {fmtN(ws.totalFollowers)} followers
          </Text>
        </View>
        <Badge
          label={ws.healthStatus}
          tone={
            ws.healthStatus === 'healthy'
              ? 'success'
              : ws.healthStatus === 'warning'
                ? 'warning'
                : 'destructive'
          }
        />
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={18}
          color={t.mutedForeground}
        />
      </Pressable>

      <View style={styles.rowBetween}>
        <PlatformIconStack platforms={ws.connectedPlatforms} size={14} max={6} />
        <Text style={{ color: t.mutedForeground, fontSize: 10 }}>
          Sync {ws.lastSync ? relativeTime(ws.lastSync) : 'never'} · Pub{' '}
          {ws.lastPublish ? relativeTime(ws.lastPublish) : 'never'}
        </Text>
      </View>

      {ws.missingPlatforms.length > 0 && canWrite ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {ws.missingPlatforms.slice(0, 4).map((p) => (
            <Pressable
              key={p}
              onPress={() => onConnect(p)}
              style={[styles.recommendChip, { borderColor: t.border, backgroundColor: t.muted }]}
            >
              <PlatformIcon platform={p} size={12} />
              <Text style={{ color: t.foreground, fontSize: 11, fontWeight: '600' }}>
                + {platformLabel(p)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.cardActions}>
        {canWrite ? (
          <Button
            title="Connect"
            size="sm"
            variant="tonal"
            icon="add-circle-outline"
            style={styles.cardAction}
            onPress={() => onConnect()}
          />
        ) : null}
        {/* "Client" named the noun, not the action. */}
        <Button
          title="Open client"
          size="sm"
          variant="ghost"
          icon="arrow-forward"
          iconTrailing
          style={styles.cardAction}
          onPress={onOpenClient}
        />
      </View>

      {expanded ? (
        <View style={{ gap: spacing.md }}>
          {ws.accounts.map((acc) => (
            <AccountRow
              key={acc.id}
              account={acc}
              canWrite={canWrite}
              syncing={syncing}
              onSync={() => onSync(acc.id)}
              onLogs={() => onLogs(acc)}
              onDisconnect={() => onDisconnect(acc)}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}

function AccountRow({
  account,
  canWrite,
  syncing,
  onSync,
  onLogs,
  onDisconnect,
}: {
  account: SocialAccount;
  canWrite: boolean;
  syncing: boolean;
  onSync: () => void;
  onLogs: () => void;
  onDisconnect: () => void;
}) {
  const t = useTheme();
  const caps = account.capabilities || PLATFORM_CAPABILITIES[account.platform.toLowerCase()] || {};
  const daysLeft =
    account.tokenExpiresAt != null
      ? Math.ceil((new Date(account.tokenExpiresAt).getTime() - Date.now()) / 86400000)
      : null;

  return (
    <View style={[styles.accountRow, { borderColor: t.border, backgroundColor: t.background }]}>
      <View style={styles.accountTop}>
        <SocialAccountAvatar
          accountId={account.id}
          avatarUrl={account.avatarUrl}
          name={accountDisplayName(account)}
          platform={account.platform}
          size={44}
        />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '700' }} numberOfLines={1}>
            {accountDisplayName(account)}
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
            {platformLabel(account.platform)}
            {account.platformUsername ? ` · @${account.platformUsername}` : ''}
          </Text>
          <Badge
            label={account.healthStatus || 'active'}
            tone={healthTone(account.healthStatus)}
          />
        </View>
      </View>

      {daysLeft != null && daysLeft < 7 ? (
        <Text style={{ color: t.warning, fontSize: fontSize.xs, fontWeight: '700' }}>
          TOKEN EXPIRES {daysLeft}d
        </Text>
      ) : null}

      <View style={styles.capRow}>
        {Object.entries(caps).map(([name, on]) => (
          <Text
            key={name}
            style={{
              color: on ? t.foreground : t.mutedForeground,
              fontSize: 10,
              textDecorationLine: on ? 'none' : 'line-through',
            }}
          >
            {name}
          </Text>
        ))}
      </View>

      {account.healthMessage ? (
        <Text style={{ color: t.warning, fontSize: fontSize.xs }}>{account.healthMessage}</Text>
      ) : null}

      {canWrite ? (
        <View style={styles.accActions}>
          <Pressable onPress={onLogs} style={styles.accAction}>
            <Ionicons name="list-outline" size={14} color={t.primary} />
            <Text style={actionText(t)}>Logs</Text>
          </Pressable>
          <Pressable onPress={onSync} disabled={syncing} style={styles.accAction}>
            <Ionicons name="refresh-outline" size={14} color={t.primary} />
            <Text style={actionText(t)}>Sync</Text>
          </Pressable>
          <Pressable onPress={onDisconnect} style={styles.accAction}>
            <Ionicons name="unlink-outline" size={14} color={t.destructive} />
            <Text style={[actionText(t), { color: t.destructive }]}>Disconnect</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

function ActivityRow({ event }: { event: AccountActivityEvent }) {
  const t = useTheme();
  const icon =
    event.type === 'published'
      ? 'checkmark-circle'
      : event.type === 'failed'
        ? 'close-circle'
        : event.type === 'synced'
          ? 'sync'
          : event.type === 'token_refreshed'
            ? 'key'
            : 'link';
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md }}>
      <Ionicons name={icon as any} size={18} color={t.primary} />
      <View style={{ flex: 1 }}>
        <Text style={{ color: t.foreground, fontWeight: '600' }}>{event.label}</Text>
        {event.detail ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={2}>
            {event.detail}
          </Text>
        ) : null}
        <Text style={{ color: t.mutedForeground, fontSize: 10 }}>
          {formatDate(event.date, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
          })}
        </Text>
      </View>
    </View>
  );
}

function fmtN(n?: number | null) {
  if (n == null) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function actionText(t: ReturnType<typeof useTheme>) {
  return { color: t.primary, fontWeight: '700' as const, fontSize: fontSize.xs as number };
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { flexDirection: 'row', alignItems: 'center' },
  actions: { flexDirection: 'row', gap: spacing.sm },
  headerAction: { flex: 1 },
  cardActions: { flexDirection: 'row', gap: spacing.sm },
  cardAction: { flex: 1 },
  cardTitle: { fontWeight: '700' },
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
  chips: { flexDirection: 'row', gap: spacing.sm },
  wsHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  wsAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  recommendChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderStyle: 'dashed',
  },
  accountRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  accountTop: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  capRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  accActions: { flexDirection: 'row', gap: spacing.lg },
  accAction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

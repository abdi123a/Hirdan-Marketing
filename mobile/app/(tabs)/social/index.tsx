import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getFullUrl } from '../../../lib/api-client';
import { formatDate } from '../../../lib/format';
import {
  deleteSocialPost,
  fetchCampaigns,
  fetchSocialPosts,
  postPlatforms,
  postPreview,
  postStatusTone,
  updateSocialPost,
  type SocialPost,
} from '../../../lib/social';
import { PlatformIconStack } from '../../../components/social/PlatformIcon';
import {
  ActionBar,
  Badge,
  Button,
  Chip,
  EmptyState,
  PressableScale,
  SearchBar,
  SegmentedControl,
  Select,
  PostFeedSkeleton,
  useToast,
  withAlpha,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { usePermissions } from '../../../hooks/usePermissions';
import { useClientsWithSocialAccounts } from '../../../hooks/useClientsWithSocialAccounts';
import { fontSize, radius, spacing } from '../../../constants/theme';
import { pressScale } from '../../../constants/motion';

/** Relative nudges for a batch of scheduled posts. */
const SHIFTS = [
  { label: '−1 day', days: -1 },
  { label: '+1 day', days: 1 },
  { label: '+7 days', days: 7 },
] as const;

type ViewMode = 'posts' | 'calendar';

const STATUS_CHIPS = [
  { label: 'All', value: '' },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Awaiting', value: 'AWAITING_APPROVAL' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Partial', value: 'PARTIAL' },
  { label: 'Failed', value: 'FAILED' },
];

export default function SocialPublishScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const canCompose = canWrite('social_media');

  const [view, setView] = useState<ViewMode>('posts');
  const [status, setStatus] = useState('');
  const [clientId, setClientId] = useState('');
  const [platform, setPlatform] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [search, setSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const socialClients = useClientsWithSocialAccounts();

  const campaignsQ = useQuery({
    queryKey: ['social-campaigns-all'],
    queryFn: () => fetchCampaigns(),
  });

  const postsQ = useQuery({
    queryKey: ['social-posts', clientId, status],
    queryFn: () =>
      fetchSocialPosts({
        clientId: clientId || undefined,
        status: status || undefined,
        limit: 500,
      }),
  });

  const clientMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of socialClients.clients) map.set(c.id, c.company || c.name);
    for (const a of socialClients.accounts) {
      if (!map.has(a.clientId)) {
        map.set(
          a.clientId,
          a.client?.company || a.client?.name || a.displayName || a.clientId
        );
      }
    }
    return map;
  }, [socialClients.clients, socialClients.accounts]);

  const campaignMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of campaignsQ.data || []) map.set(c.id, c.name);
    return map;
  }, [campaignsQ.data]);

  const posts = useMemo(() => {
    let list = postsQ.data?.posts || [];
    if (platform) {
      list = list.filter((p) =>
        postPlatforms(p).some((pl) => pl === platform.toLowerCase())
      );
    }
    if (campaignId) list = list.filter((p) => p.campaignId === campaignId);
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const hay = `${p.caption} ${clientMap.get(p.clientId) || ''} ${campaignMap.get(p.campaignId || '') || ''} ${postPlatforms(p).join(' ')}`.toLowerCase();
        return hay.includes(q);
      });
    }
    return list;
  }, [postsQ.data?.posts, platform, campaignId, search, clientMap, campaignMap]);

  const drafts = useMemo(
    () => posts.filter((p) => String(p.status).toUpperCase() === 'DRAFT' && !p.scheduledFor),
    [posts]
  );

  const calendarGroups = useMemo(() => {
    const y = calMonth.getFullYear();
    const m = calMonth.getMonth();
    const groups = new Map<string, SocialPost[]>();
    for (const p of posts) {
      const when = p.scheduledFor || p.publishedAt;
      if (!when) continue;
      const d = new Date(when);
      if (d.getFullYear() !== y || d.getMonth() !== m) continue;
      const key = d.toISOString().slice(0, 10);
      const arr = groups.get(key) || [];
      arr.push(p);
      groups.set(key, arr);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [posts, calMonth]);

  const clientOptions = useMemo(
    () => [{ label: 'All clients', value: '' }, ...socialClients.options],
    [socialClients.options]
  );

  const campaignOptions = useMemo(
    () => [
      { label: 'All campaigns', value: '' },
      ...(campaignsQ.data || [])
        .filter((c) => !clientId || c.clientId === clientId)
        .map((c) => ({ label: c.name, value: c.id })),
    ],
    [campaignsQ.data, clientId]
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const bulkDeleteM = useMutation({
    mutationFn: async () => {
      await Promise.all(selected.map((id) => deleteSocialPost(id)));
    },
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast('Posts deleted', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const bulkStatusM = useMutation({
    mutationFn: async (next: string) => {
      await Promise.all(
        selected.map((id) => {
          const post = posts.find((p) => p.id === id);
          if (!post) return Promise.resolve(null);
          return updateSocialPost(id, {
            caption: post.caption,
            accountIds: post.destinations.map((d) => d.socialAccountId),
            status: next,
            scheduledFor: post.scheduledFor,
            mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
            mediaType: post.mediaType || undefined,
            campaignId: post.campaignId,
          });
        })
      );
    },
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast('Status updated', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const bulkShiftM = useMutation({
    mutationFn: async (daysDelta: number) => {
      await Promise.all(
        selected.map((id) => {
          const post = posts.find((p) => p.id === id);
          if (!post?.scheduledFor) return Promise.resolve(null);
          const d = new Date(post.scheduledFor);
          d.setDate(d.getDate() + daysDelta);
          return updateSocialPost(id, {
            caption: post.caption,
            accountIds: post.destinations.map((x) => x.socialAccountId),
            status: post.status,
            scheduledFor: d.toISOString(),
            mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
            mediaType: post.mediaType || undefined,
            campaignId: post.campaignId,
          });
        })
      );
    },
    onSuccess: () => {
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast('Schedule shifted', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={postsQ.isRefetching}
            onRefresh={() => postsQ.refetch()}
            tintColor={t.primary}
          />
        }
      >
        {/* Four across a phone leaves ~80pt per tile, which an icon and label
            side by side overrun — "Accounts" alone is wider than the space
            left beside the glyph. Stacking them gives the label the tile's
            full width. */}
        <View style={styles.topNav}>
          <NavTile
            icon="stats-chart-outline"
            label="Analyze"
            onPress={() => router.push('/(tabs)/social/analyze')}
          />
          <NavTile
            icon="checkbox-outline"
            label="Tasks"
            onPress={() => router.push('/(tabs)/more/tasks')}
          />
          <NavTile
            icon="link-outline"
            label="Accounts"
            onPress={() => router.push('/(tabs)/social/accounts')}
          />
          {canCompose ? (
            <NavTile
              icon="add"
              label="Compose"
              primary
              onPress={() => router.push('/compose')}
            />
          ) : null}
        </View>

        <Text variant="h2">Content Publisher</Text>

        <SegmentedControl
          options={[
            { label: 'Posts', value: 'posts' },
            { label: 'Calendar', value: 'calendar' },
          ]}
          value={view}
          onChange={setView}
        />

        <SearchBar value={search} onChangeText={setSearch} placeholder="Search posts…" />

        <Pressable
          onPress={() => setShowFilters((v) => !v)}
          style={[styles.filterToggle, { borderColor: t.border, backgroundColor: t.card }]}
        >
          <Ionicons name="options-outline" size={16} color={t.primary} />
          <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.sm }}>
            Filters
          </Text>
          <Ionicons
            name={showFilters ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={t.mutedForeground}
          />
        </Pressable>

        {showFilters ? (
          <View style={[styles.filterPanel, { backgroundColor: t.card, borderColor: t.border }]}>
            <Select label="Client" value={clientId} options={clientOptions} onChange={setClientId} />
            <Select
              label="Campaign"
              value={campaignId}
              options={campaignOptions}
              onChange={setCampaignId}
            />
            <Select
              label="Platform"
              value={platform}
              options={[
                { label: 'All platforms', value: '' },
                { label: 'Instagram', value: 'instagram' },
                { label: 'Facebook', value: 'facebook' },
                { label: 'TikTok', value: 'tiktok' },
                { label: 'YouTube', value: 'youtube' },
                { label: 'LinkedIn', value: 'linkedin' },
                { label: 'X', value: 'x' },
                { label: 'Threads', value: 'threads' },
                { label: 'Pinterest', value: 'pinterest' },
              ]}
              onChange={setPlatform}
            />
            <View style={styles.chips}>
              {STATUS_CHIPS.map((chip) => (
                <Chip
                  key={chip.value || 'all'}
                  label={chip.label}
                  selected={status === chip.value}
                  onPress={() => setStatus(chip.value)}
                />
              ))}
            </View>
          </View>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {STATUS_CHIPS.slice(0, 5).map((chip) => (
              <Chip
                key={chip.value || 'all'}
                label={chip.label}
                selected={status === chip.value}
                onPress={() => setStatus(chip.value)}
              />
            ))}
          </ScrollView>
        )}

        {drafts.length > 0 && view === 'posts' ? (
          <View style={[styles.draftsBox, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.foreground, fontWeight: '700' }}>
              Unscheduled drafts ({drafts.length})
            </Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {drafts.slice(0, 12).map((p) => (
                <Pressable
                  key={p.id}
                  onPress={() => router.push(`/post/${p.id}`)}
                  style={[styles.draftChip, { backgroundColor: t.muted }]}
                >
                  <PlatformIconStack platforms={postPlatforms(p)} size={12} />
                  <Text style={{ color: t.foreground, fontSize: 11, fontWeight: '600', maxWidth: 100 }} numberOfLines={1}>
                    {postPreview(p)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {postsQ.isLoading ? (
          <PostFeedSkeleton padding={0} />
        ) : postsQ.error ? (
          <EmptyState
            title="Could not load posts"
            description={(postsQ.error as Error).message}
            actionLabel="Retry"
            onAction={() => postsQ.refetch()}
            icon="alert-circle-outline"
          />
        ) : view === 'calendar' ? (
          <CalendarView
            month={calMonth}
            onPrev={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1))}
            onNext={() => setCalMonth(new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1))}
            onToday={() => {
              const d = new Date();
              setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
            }}
            groups={calendarGroups}
            clientMap={clientMap}
            onOpen={(id) => router.push(`/post/${id}`)}
          />
        ) : posts.length === 0 ? (
          <EmptyState
            title="No posts yet"
            description={
              canCompose
                ? 'Compose a draft, schedule it, or publish now.'
                : 'No posts match your filters.'
            }
            actionLabel={canCompose ? 'Compose' : undefined}
            onAction={canCompose ? () => router.push('/compose') : undefined}
            icon="share-social-outline"
          />
        ) : (
          <View style={{ gap: spacing.md }}>
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                clientName={clientMap.get(post.clientId)}
                campaignName={post.campaignId ? campaignMap.get(post.campaignId) : undefined}
                selected={selected.includes(post.id)}
                selectable={canCompose}
                onToggleSelect={() => toggleSelect(post.id)}
                onPress={() => router.push(`/post/${post.id}`)}
                onEdit={() =>
                  router.push({
                    pathname: '/compose',
                    params: { editId: post.id },
                  })
                }
              />
            ))}
          </View>
        )}
      </ScrollView>

      {selected.length > 0 ? (
        <View style={styles.bulkBar} pointerEvents="box-none">
          <View style={styles.shiftRow} pointerEvents="box-none">
            <Text variant="caption" color="muted" style={styles.shiftLabel}>
              Shift date
            </Text>
            {SHIFTS.map((s) => (
              <Chip
                key={s.days}
                label={s.label}
                disabled={bulkShiftM.isPending}
                onPress={() => bulkShiftM.mutate(s.days)}
              />
            ))}
          </View>

          <ActionBar
            variant="floating"
            caption={
              <>
                <Text variant="bodyStrong">
                  {selected.length} {selected.length === 1 ? 'post' : 'posts'} selected
                </Text>
                <Pressable onPress={() => setSelected([])} hitSlop={8}>
                  <Text variant="label" color="primary">
                    Clear
                  </Text>
                </Pressable>
              </>
            }
          >
            {/* Status changes are the common case, so they get real buttons.
                Date nudges are modifiers and read better as chips. */}
            <Button
              title="Draft"
              size="sm"
              variant="tonal"
              loading={bulkStatusM.isPending}
              onPress={() => bulkStatusM.mutate('DRAFT')}
              style={styles.bulkAction}
            />
            <Button
              title="Schedule"
              size="sm"
              variant="primary"
              loading={bulkStatusM.isPending}
              onPress={() => bulkStatusM.mutate('SCHEDULED')}
              style={styles.bulkAction}
            />
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`Delete ${selected.length} selected posts`}
              scaleTo={pressScale.icon}
              haptic="medium"
              onPress={() => bulkDeleteM.mutate()}
              disabled={bulkDeleteM.isPending}
              style={[styles.bulkIcon, { backgroundColor: withAlpha(t.destructive, 0.12) }]}
            >
              <Ionicons name="trash-outline" size={18} color={t.destructive} />
            </PressableScale>
          </ActionBar>
        </View>
      ) : null}
    </View>
  );
}

/**
 * One tile in the quick-nav row.
 *
 * `adjustsFontSizeToFit` is the safety net rather than the layout: the label
 * is sized to fit at rest, but a user running a large display scale would
 * otherwise clip it, and truncating "Accounts" to "Acco…" reads as a bug.
 */
function NavTile({
  icon,
  label,
  primary,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const fg = primary ? t.primaryForeground : t.foreground;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={pressScale.card}
      haptic="none"
      onPress={onPress}
      style={[
        styles.navBtn,
        {
          backgroundColor: primary ? t.primary : t.card,
          borderColor: primary ? t.primary : t.borderSubtle,
        },
      ]}
    >
      <View
        style={[
          styles.navIcon,
          { backgroundColor: primary ? 'rgba(255,255,255,0.2)' : t.accent },
        ]}
      >
        <Ionicons name={icon} size={17} color={primary ? fg : t.accentForeground} />
      </View>
      <Text
        variant="caption"
        style={[styles.navLabel, { color: fg }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.85}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

function PostCard({
  post,
  clientName,
  campaignName,
  selected,
  selectable,
  onToggleSelect,
  onPress,
  onEdit,
}: {
  post: SocialPost;
  clientName?: string;
  campaignName?: string;
  selected: boolean;
  selectable: boolean;
  onToggleSelect: () => void;
  onPress: () => void;
  onEdit: () => void;
}) {
  const t = useTheme();
  const media = Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null;
  const when = post.scheduledFor || post.publishedAt || post.createdAt;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={selectable ? onToggleSelect : undefined}
      style={[
        styles.card,
        {
          backgroundColor: t.card,
          borderColor: selected ? t.primary : t.border,
        },
      ]}
    >
      <View style={styles.mediaWrap}>
        {media ? (
          <Image source={{ uri: getFullUrl(media) }} style={styles.media} />
        ) : (
          <View style={[styles.media, { backgroundColor: t.muted, alignItems: 'center', justifyContent: 'center' }]}>
            <Ionicons
              name={
                post.mediaType === 'video' || post.mediaType === 'reel'
                  ? 'videocam'
                  : 'image-outline'
              }
              size={28}
              color={t.mutedForeground}
            />
          </View>
        )}
        {post.mediaType ? (
          <View style={[styles.typeBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
            <Text style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>{post.mediaType}</Text>
          </View>
        ) : null}
        {selectable ? (
          <Pressable
            onPress={onToggleSelect}
            style={[styles.check, { backgroundColor: selected ? t.primary : t.card, borderColor: t.border }]}
          >
            {selected ? <Ionicons name="checkmark" size={14} color={t.primaryForeground} /> : null}
          </Pressable>
        ) : null}
      </View>

      <View style={styles.cardBody}>
        <View style={styles.rowBetween}>
          <Text style={{ color: t.foreground, fontWeight: '700', flex: 1 }} numberOfLines={1}>
            {clientName || 'Client'}
            {campaignName ? ` · ${campaignName}` : ''}
          </Text>
          <Badge label={post.status} tone={postStatusTone(post.status)} />
        </View>
        <Text style={{ color: t.foreground }} numberOfLines={2}>
          {postPreview(post)}
        </Text>
        <View style={styles.rowBetween}>
          <PlatformIconStack platforms={postPlatforms(post)} size={14} />
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            {formatDate(when, {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </Text>
        </View>
        {/* Tapping the card already opens the post, so a second "Open"
            button was only competing with it. Edit is the one action that
            isn't reachable any other way. */}
        <View style={styles.cardActions}>
          <Button
            title="Edit"
            size="sm"
            variant="tonal"
            icon="create-outline"
            onPress={onEdit}
          />
        </View>
      </View>
    </Pressable>
  );
}

function CalendarView({
  month,
  onPrev,
  onNext,
  onToday,
  groups,
  clientMap,
  onOpen,
}: {
  month: Date;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  groups: Array<[string, SocialPost[]]>;
  clientMap: Map<string, string>;
  onOpen: (id: string) => void;
}) {
  const t = useTheme();
  const label = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.rowBetween}>
        <Pressable onPress={onPrev}>
          <Ionicons name="chevron-back" size={22} color={t.foreground} />
        </Pressable>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: t.foreground, fontWeight: '800' }}>{label}</Text>
          <Pressable onPress={onToday}>
            <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '700' }}>Today</Text>
          </Pressable>
        </View>
        <Pressable onPress={onNext}>
          <Ionicons name="chevron-forward" size={22} color={t.foreground} />
        </Pressable>
      </View>

      {groups.length === 0 ? (
        <EmptyState title="Nothing scheduled" description="No posts in this month." icon="calendar-outline" />
      ) : (
        groups.map(([day, dayPosts]) => (
          <View key={day} style={[styles.dayBlock, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.foreground, fontWeight: '800' }}>
              {formatDate(day, { weekday: 'short', month: 'short', day: 'numeric' })}
            </Text>
            {dayPosts
              .sort(
                (a, b) =>
                  new Date(a.scheduledFor || a.publishedAt || 0).getTime() -
                  new Date(b.scheduledFor || b.publishedAt || 0).getTime()
              )
              .map((p) => (
                <Pressable key={p.id} onPress={() => onOpen(p.id)} style={styles.dayRow}>
                  <PlatformIconStack platforms={postPlatforms(p)} size={12} />
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.foreground, fontWeight: '600' }} numberOfLines={1}>
                      {postPreview(p)}
                    </Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 10 }}>
                      {clientMap.get(p.clientId) || 'Client'} ·{' '}
                      {formatDate(p.scheduledFor || p.publishedAt, {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                    </Text>
                  </View>
                  <Badge label={p.status} tone={postStatusTone(p.status)} />
                </Pressable>
              ))}
          </View>
        ))
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  // Bottom padding clears the bulk-action bar, which overlays the list
  // whenever a selection is active.
  content: { padding: spacing.gutter, gap: spacing.md, paddingBottom: 190 },
  topNav: { flexDirection: 'row', gap: spacing.sm },
  navBtn: {
    flex: 1,
    // Column, not row: the label sits under the glyph and gets the whole
    // tile width instead of competing with it.
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: spacing.md,
    paddingHorizontal: 4,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 74,
  },
  navIcon: {
    width: 30,
    height: 30,
    borderRadius: radius.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navLabel: {
    textAlign: 'center',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  filterPanel: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  draftsBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  draftChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radius.full,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  card: {
    borderWidth: 1.5,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  mediaWrap: { position: 'relative' },
  media: { width: '100%', height: 160 },
  typeBadge: {
    position: 'absolute',
    left: 8,
    bottom: 8,
    borderRadius: radius.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  check: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardBody: { padding: spacing.lg, gap: spacing.sm },
  cardActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: spacing.xs,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  bulkBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: spacing.sm,
  },
  bulkAction: {
    flex: 1,
  },
  bulkIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.sm,
    paddingHorizontal: spacing.gutter + spacing.lg,
  },
  shiftLabel: {
    marginRight: spacing.xs,
  },
  dayBlock: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});

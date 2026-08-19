import React, { useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { Text } from '../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { formatDate, unwrapList } from '../../lib/format';
import {
  accountDisplayName,
  createSocialPost,
  deleteSocialPost,
  fetchSocialPost,
  platformLabel,
  postStatusTone,
  publishSocialPostNow,
  retrySocialPost,
  updateSocialPost,
} from '../../lib/social';
import { SocialAccountAvatar } from '../../components/social/SocialAccountAvatar';
import {
  ActionBar,
  Badge,
  Button,
  Card,
  DatePickerField,
  Dialog,
  EmptyState,
  Input,
  ListGroup,
  ListRow,
  DetailSkeleton,
  useToast,
  withAlpha,
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { usePermissions } from '../../hooks/usePermissions';
import { fontSize, radius, spacing } from '../../constants/theme';

type ClientOpt = { id: string; name: string; company?: string };

/** Tinted glyph for the secondary action list. */
function ActionIcon({
  name,
  destructive,
}: {
  name: keyof typeof Ionicons.glyphMap;
  destructive?: boolean;
}) {
  const t = useTheme();
  const tone = destructive ? t.destructive : t.primary;
  return (
    <View style={[styles.actionIcon, { backgroundColor: withAlpha(tone, 0.11) }]}>
      <Ionicons name={name} size={17} color={tone} />
    </View>
  );
}

export default function SocialPostDetailScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { canWrite } = usePermissions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('10:00');

  const postQ = useQuery({
    queryKey: ['social-post', id],
    queryFn: () => fetchSocialPost(id!),
    enabled: !!id,
  });

  const clientsQ = useQuery({
    queryKey: ['clients-mini'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList<ClientOpt>(res);
    },
  });

  const post = postQ.data;
  const clientName =
    clientsQ.data?.find((c) => c.id === post?.clientId)?.company ||
    clientsQ.data?.find((c) => c.id === post?.clientId)?.name;

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['social-post', id] });
    queryClient.invalidateQueries({ queryKey: ['social-posts'] });
  };

  const publishM = useMutation({
    mutationFn: () => publishSocialPostNow(id!),
    onSuccess: () => {
      invalidate();
      toast('Publish complete', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const retryM = useMutation({
    mutationFn: () => retrySocialPost(id!),
    onSuccess: () => {
      invalidate();
      toast('Retry complete', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const deleteM = useMutation({
    mutationFn: () => deleteSocialPost(id!),
    onSuccess: () => {
      invalidate();
      toast('Post deleted', 'success');
      router.replace('/(tabs)/social');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const duplicateM = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error('Post not loaded');
      return createSocialPost({
        clientId: post.clientId,
        accountIds: post.destinations.map((d) => d.socialAccountId),
        caption: post.caption || '',
        mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
        mediaType: post.mediaType || 'text',
        status: 'DRAFT',
        scheduledFor: null,
        campaignId: post.campaignId,
        platformContent: (post.platformContent as Record<string, unknown>) || {},
      });
    },
    onSuccess: (created) => {
      invalidate();
      toast('Duplicated as draft', 'success');
      router.replace(`/post/${created.id}`);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const rescheduleM = useMutation({
    mutationFn: async () => {
      if (!post || !rescheduleDate) throw new Error('Pick a date');
      const [y, m, d] = rescheduleDate.split('-').map(Number);
      const [hh, mm] = (rescheduleTime || '10:00').split(':').map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
      // Send only what changes. Resending accountIds used to make the server
      // rebuild every destination, wiping retry state and re-queueing FAILED ones.
      return updateSocialPost(post.id, {
        status: 'SCHEDULED',
        scheduledFor: dt.toISOString(),
      });
    },
    onSuccess: () => {
      setRescheduleOpen(false);
      invalidate();
      toast('Rescheduled', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const unscheduleM = useMutation({
    mutationFn: async () => {
      if (!post) throw new Error('Post not loaded');
      return updateSocialPost(post.id, {
        status: 'DRAFT',
        scheduledFor: null,
      });
    },
    onSuccess: () => {
      invalidate();
      toast('Moved to drafts', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  if (postQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (postQ.error || !post) {
    return (
      <EmptyState
        title="Post not found"
        description={(postQ.error as Error)?.message || 'This post may have been deleted.'}
        actionLabel="Back"
        onAction={() => router.back()}
        icon="alert-circle-outline"
      />
    );
  }

  const mediaUrls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
  const canRetry = post.destinations?.some((d) => d.status === 'FAILED');
  const canPublish =
    canWrite('social_media') &&
    ['DRAFT', 'SCHEDULED', 'FAILED', 'PARTIAL', 'AWAITING_APPROVAL'].includes(
      String(post.status).toUpperCase()
    );

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={postQ.isRefetching}
            onRefresh={() => postQ.refetch()}
            tintColor={t.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <Badge label={post.status} tone={postStatusTone(post.status)} />
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            {clientName || 'Client'}
          </Text>
        </View>

        <Text style={[styles.caption, { color: t.foreground }]}>
          {post.caption?.trim() || 'No caption'}
        </Text>

        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
          {post.scheduledFor
            ? `Scheduled ${formatDate(post.scheduledFor, {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}`
            : post.publishedAt
              ? `Published ${formatDate(post.publishedAt, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}`
              : 'Not scheduled'}
        </Text>

        {post.errorMessage ? (
          <Card>
            <Text style={{ color: t.destructive, fontWeight: '600' }}>Error</Text>
            <Text style={{ color: t.mutedForeground, marginTop: spacing.xs }}>
              {post.errorMessage}
            </Text>
          </Card>
        ) : null}

        {mediaUrls.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {mediaUrls.map((uri) => (
              <Image key={uri} source={{ uri }} style={styles.media} />
            ))}
          </ScrollView>
        ) : null}

        {post.campaignId ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            Campaign linked
          </Text>
        ) : null}

        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Destinations</Text>
        {(post.destinations || []).map((d) => {
          const destName = d.socialAccount
            ? accountDisplayName({
                id: d.socialAccountId,
                clientId: post.clientId,
                platform: d.platform,
                displayName: d.socialAccount.displayName || '',
                platformUsername: d.socialAccount.platformUsername || '',
                avatarUrl: d.socialAccount.avatarUrl,
              })
            : platformLabel(d.platform);
          return (
          <Card key={d.id}>
            <View style={styles.destRow}>
              <SocialAccountAvatar
                accountId={d.socialAccountId}
                avatarUrl={d.socialAccount?.avatarUrl}
                name={destName}
                platform={d.platform}
                size={40}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.foreground, fontWeight: '600' }}>
                  {destName}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
                  {platformLabel(d.platform)}
                  {d.status === 'DRAFT' && d.platform.toLowerCase() === 'tiktok'
                    ? ' · Saved to TikTok drafts'
                    : ''}
                </Text>
                {d.lastError ? (
                  <Text style={{ color: t.destructive, fontSize: fontSize.xs, marginTop: 4 }}>
                    {d.lastError}
                  </Text>
                ) : null}
              </View>
              <Badge label={d.status} tone={postStatusTone(d.status)} />
            </View>
            {d.platformPostUrl ? (
              <Pressable
                onPress={() => Linking.openURL(d.platformPostUrl!)}
                style={styles.linkRow}
              >
                <Ionicons name="open-outline" size={16} color={t.primary} />
                <Text style={{ color: t.primary, fontWeight: '600' }}>View on platform</Text>
              </Pressable>
            ) : null}
          </Card>
          );
        })}

        {/* Seven equally-weighted full-width buttons gave no clue which one
            mattered. The action that advances the post is pinned below; the
            rest read as a settings-style list, with delete set apart. */}
        {canWrite('social_media') ? (
          <ListGroup style={styles.actionGroup}>
            <ListRow
              title="Edit post"
              left={<ActionIcon name="create-outline" />}
              onPress={() =>
                router.push({
                  pathname: '/compose',
                  params: { editId: post.id },
                })
              }
            />
            <ListRow
              title="Duplicate as draft"
              left={<ActionIcon name="copy-outline" />}
              right={duplicateM.isPending ? <ActivityIndicator color={t.mutedForeground} /> : undefined}
              onPress={() => duplicateM.mutate()}
            />
            <ListRow
              title="Reschedule"
              subtitle={
                post.scheduledFor
                  ? formatDate(post.scheduledFor, {
                      month: 'short',
                      day: 'numeric',
                      hour: 'numeric',
                      minute: '2-digit',
                    })
                  : undefined
              }
              left={<ActionIcon name="calendar-outline" />}
              onPress={() => {
                const d = post.scheduledFor ? new Date(post.scheduledFor) : new Date();
                setRescheduleDate(d.toISOString().slice(0, 10));
                setRescheduleTime(
                  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
                );
                setRescheduleOpen(true);
              }}
            />
            {post.scheduledFor ? (
              <ListRow
                title="Unschedule"
                left={<ActionIcon name="close-circle-outline" />}
                right={unscheduleM.isPending ? <ActivityIndicator color={t.mutedForeground} /> : undefined}
                onPress={() => unscheduleM.mutate()}
              />
            ) : null}
            <ListRow
              title="Delete post"
              destructive
              divider={false}
              left={<ActionIcon name="trash-outline" destructive />}
              onPress={() => setConfirmDelete(true)}
            />
          </ListGroup>
        ) : null}

        {rescheduleOpen ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700' }}>Reschedule</Text>
            <DatePickerField label="Date" value={rescheduleDate} onChange={setRescheduleDate} />
            <Input label="Time (HH:mm)" value={rescheduleTime} onChangeText={setRescheduleTime} />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Button title="Cancel" variant="outline" style={{ flex: 1 }} onPress={() => setRescheduleOpen(false)} />
              <Button
                title="Save"
                style={{ flex: 1 }}
                loading={rescheduleM.isPending}
                onPress={() => rescheduleM.mutate()}
              />
            </View>
          </Card>
        ) : null}
      </ScrollView>

      {canWrite('social_media') && (canPublish || canRetry) ? (
        <ActionBar>
          {canPublish ? (
            <Button
              title="Publish now"
              icon="send"
              block
              haptic="medium"
              loading={publishM.isPending}
              onPress={() => publishM.mutate()}
              style={styles.primaryAction}
            />
          ) : null}
          {canRetry ? (
            <Button
              title="Retry failed"
              icon="refresh"
              variant={canPublish ? 'tonal' : 'primary'}
              block={!canPublish}
              loading={retryM.isPending}
              onPress={() => retryM.mutate()}
              style={styles.primaryAction}
            />
          ) : null}
        </ActionBar>
      ) : null}

      <Dialog
        visible={confirmDelete}
        title="Delete post?"
        message="This permanently removes the post and its destinations."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          setConfirmDelete(false);
          deleteM.mutate();
        }}
        onCancel={() => setConfirmDelete(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.gutter, gap: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  caption: { fontSize: fontSize.lg, fontWeight: '600', lineHeight: 26 },
  sectionTitle: { fontSize: fontSize.md, fontWeight: '700', marginTop: spacing.sm },
  media: { width: 160, height: 160, borderRadius: radius.md, marginRight: spacing.sm },
  destRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: spacing.sm,
  },
  actionGroup: { marginTop: spacing.md },
  primaryAction: { flex: 1 },
  actionIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

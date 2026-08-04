import React, { useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatDate, unwrapList } from '../../../../lib/format';
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
} from '../../../../lib/social';
import { SocialAccountAvatar } from '../../../../components/social/SocialAccountAvatar';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  DetailSkeleton,
  useToast,
} from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { usePermissions } from '../../../../hooks/usePermissions';
import { fontSize, radius, spacing } from '../../../../constants/theme';

type ClientOpt = { id: string; name: string; company?: string };

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
      router.replace(`/(tabs)/social/post/${created.id}`);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const rescheduleM = useMutation({
    mutationFn: async () => {
      if (!post || !rescheduleDate) throw new Error('Pick a date');
      const [y, m, d] = rescheduleDate.split('-').map(Number);
      const [hh, mm] = (rescheduleTime || '10:00').split(':').map(Number);
      const dt = new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0, 0, 0);
      return updateSocialPost(post.id, {
        caption: post.caption,
        accountIds: post.destinations.map((x) => x.socialAccountId),
        status: 'SCHEDULED',
        scheduledFor: dt.toISOString(),
        mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
        mediaType: post.mediaType || undefined,
        campaignId: post.campaignId,
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
        caption: post.caption,
        accountIds: post.destinations.map((x) => x.socialAccountId),
        status: 'DRAFT',
        scheduledFor: null,
        mediaUrls: Array.isArray(post.mediaUrls) ? post.mediaUrls : [],
        mediaType: post.mediaType || undefined,
        campaignId: post.campaignId,
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

        {canWrite('social_media') ? (
          <View style={styles.actions}>
            {canPublish ? (
              <Button
                title="Publish now"
                loading={publishM.isPending}
                onPress={() => publishM.mutate()}
              />
            ) : null}
            {canRetry ? (
              <Button
                title="Retry failed"
                variant="secondary"
                loading={retryM.isPending}
                onPress={() => retryM.mutate()}
              />
            ) : null}
            <Button
              title="Edit"
              variant="outline"
              onPress={() =>
                router.push({
                  pathname: '/(tabs)/social/compose',
                  params: { editId: post.id },
                })
              }
            />
            <Button
              title="Duplicate as draft"
              variant="outline"
              loading={duplicateM.isPending}
              onPress={() => duplicateM.mutate()}
            />
            <Button
              title="Reschedule"
              variant="outline"
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
              <Button
                title="Unschedule"
                variant="outline"
                loading={unscheduleM.isPending}
                onPress={() => unscheduleM.mutate()}
              />
            ) : null}
            <Button
              title="Delete"
              variant="destructive"
              onPress={() => setConfirmDelete(true)}
            />
          </View>
        ) : null}

        {rescheduleOpen ? (
          <Card style={{ gap: spacing.sm }}>
            <Text style={{ color: t.foreground, fontWeight: '700' }}>Reschedule</Text>
            <Input label="Date (YYYY-MM-DD)" value={rescheduleDate} onChangeText={setRescheduleDate} />
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
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
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
  actions: { gap: spacing.sm, marginTop: spacing.md },
});

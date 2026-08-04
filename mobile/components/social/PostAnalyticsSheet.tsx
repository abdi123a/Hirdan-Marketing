import React from 'react';
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getFullUrl } from '../../lib/api-client';
import { formatDate } from '../../lib/format';
import { platformIconSource, platformLabel } from '../../lib/social';
import {
  fetchAnalyticsPostDetail,
  fmtN,
  fmtPct,
} from '../../lib/social-analytics';
import { Badge, Button, DetailSkeleton, Sheet } from '../ui';
import { useTheme } from '../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../constants/theme';

export function PostAnalyticsSheet({
  postId,
  onClose,
}: {
  postId: string | null;
  onClose: () => void;
}) {
  const t = useTheme();
  const detailQ = useQuery({
    queryKey: ['analytics-post', postId],
    queryFn: () => fetchAnalyticsPostDetail(postId!),
    enabled: !!postId,
  });

  const detail = detailQ.data;
  const media =
    detail?.thumbnailUrl ||
    (Array.isArray(detail?.mediaUrls) ? detail?.mediaUrls?.[0] : null);

  return (
    <Sheet visible={!!postId} onClose={onClose} title="Post Performance">
      {detailQ.isLoading ? (
        <DetailSkeleton padding={0} />
      ) : detailQ.error || !detail ? (
        <Text style={{ color: t.destructive }}>
          {(detailQ.error as Error)?.message || 'Could not load post detail'}
        </Text>
      ) : (
        <ScrollView contentContainerStyle={{ gap: spacing.md, paddingBottom: spacing.xl }}>
          <View style={styles.identity}>
            {media ? (
              <Image source={{ uri: getFullUrl(media) }} style={styles.thumb} />
            ) : (
              <View style={[styles.thumb, { backgroundColor: t.muted, alignItems: 'center', justifyContent: 'center' }]}>
                <Ionicons name="image-outline" size={28} color={t.mutedForeground} />
              </View>
            )}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={{ color: t.foreground, fontWeight: '700' }} numberOfLines={4}>
                {detail.caption?.trim() || 'Untitled post'}
              </Text>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {formatDate(detail.publishedAt, {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </Text>
              {detail.source === 'both' ? (
                <Badge label="Verified by export" tone="success" />
              ) : detail.source === 'imported' ? (
                <Badge label="Imported" />
              ) : null}
            </View>
          </View>

          {detail.link ? (
            <Button
              title="Open on platform"
              onPress={() => Linking.openURL(detail.link!)}
            />
          ) : (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
              No public link yet
              {String(detail.breakdown?.[0]?.platform || '').toLowerCase() === 'tiktok'
                ? ' — TikTok links may need Studio import.'
                : '.'}
            </Text>
          )}

          <View style={styles.metricGrid}>
            {[
              ['Views', detail.totals.views],
              ['Likes', detail.totals.likes],
              ['Comments', detail.totals.comments],
              ['Shares', detail.totals.shares],
              ['Reach', detail.totals.reach],
              ['Impressions', detail.totals.impressions],
              ['Saves', detail.totals.saved],
              ['Eng. rate', detail.totals.engagementRate, true],
            ].map(([label, value, isRate]) => (
              <View key={String(label)} style={[styles.metricCell, { backgroundColor: t.muted }]}>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{label as string}</Text>
                <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
                  {isRate ? fmtPct(value as number) : fmtN(value as number)}
                </Text>
              </View>
            ))}
          </View>

          <Text style={{ color: t.foreground, fontWeight: '700' }}>By platform</Text>
          {(detail.breakdown || []).map((row, i) => {
            const icon = platformIconSource(row.platform);
            const m = row.metrics || {};
            const handle = row.accountHandle || row.handle;
            const views = row.views ?? m.views;
            const likes = row.likes ?? m.likes;
            const comments = row.comments ?? m.comments;
            const shares = row.shares ?? m.shares;
            const reach = row.reach ?? m.reach;
            return (
              <View key={`${row.platform}-${i}`} style={[styles.breakCard, { borderColor: t.border }]}>
                <View style={styles.breakHead}>
                  {icon ? <Image source={icon} style={{ width: 16, height: 16 }} /> : null}
                  <Text style={{ color: t.foreground, fontWeight: '700', flex: 1 }}>
                    {platformLabel(row.platform)}
                    {handle ? ` · @${handle}` : ''}
                  </Text>
                  <Badge
                    label={
                      String(row.source || '').toLowerCase().includes('import') ||
                      String(row.source || '').toLowerCase() === 'export'
                        ? 'From export'
                        : 'Live API'
                    }
                  />
                </View>
                <View style={styles.breakMetrics}>
                  <Text style={meta(t)}>Views {fmtN(views)}</Text>
                  <Text style={meta(t)}>Likes {fmtN(likes)}</Text>
                  <Text style={meta(t)}>Comments {fmtN(comments)}</Text>
                  <Text style={meta(t)}>Shares {fmtN(shares)}</Text>
                  {reach != null ? <Text style={meta(t)}>Reach {fmtN(reach)}</Text> : null}
                </View>
                {row.error ? (
                  <Text style={{ color: t.destructive, fontSize: fontSize.xs }}>{row.error}</Text>
                ) : null}
                {row.link ? (
                  <Pressable onPress={() => Linking.openURL(row.link!)} style={styles.linkRow}>
                    <Ionicons name="open-outline" size={14} color={t.primary} />
                    <Text style={{ color: t.primary, fontWeight: '600', fontSize: fontSize.sm }}>
                      Open
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </ScrollView>
      )}
    </Sheet>
  );
}

function meta(t: ReturnType<typeof useTheme>) {
  return { color: t.mutedForeground, fontSize: fontSize.xs as number, fontWeight: '600' as const };
}

const styles = StyleSheet.create({
  identity: { flexDirection: 'row', gap: spacing.md },
  thumb: { width: 96, height: 96, borderRadius: radius.md },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  metricCell: {
    width: '23%',
    flexGrow: 1,
    minWidth: 72,
    borderRadius: radius.md,
    padding: spacing.sm,
    gap: 2,
  },
  breakCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  breakHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  breakMetrics: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});

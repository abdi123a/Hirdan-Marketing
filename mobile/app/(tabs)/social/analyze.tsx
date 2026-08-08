import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { getFullUrl } from '../../../lib/api-client';
import { formatDate } from '../../../lib/format';
import {
  healthTone,
  platformIconSource,
  platformLabel,
} from '../../../lib/social';
import { SocialAccountAvatar } from '../../../components/social/SocialAccountAvatar';
import {
  ANALYTICS_TABS,
  CONTENT_TYPES,
  POST_SORTS,
  type AnalyticsPost,
  type FullAnalytics,
  type MetricKey,
  capOf,
  capStatus,
  deltaTone,
  fetchAnalyticsPosts,
  fetchFullAnalytics,
  fmtN,
  fmtPct,
  importTiktokStudio,
  postsToCsv,
  refreshAnalytics,
  renderInsightParts,
} from '../../../lib/social-analytics';
import {
  AreaLineChart,
  BarChartSimple,
  DonutChart,
  EmptyChart,
  HeatmapGrid,
  platformColor,
} from '../../../components/social/AnalyticsCharts';
import { PostAnalyticsSheet } from '../../../components/social/PostAnalyticsSheet';
import {
  Badge,
  Button,
  Card,
  Chip,
  DatePickerField,
  EmptyState,
  Input,
  ProgressBar,
  SearchBar,
  Select,
  DashboardSkeleton,
  FormSkeleton,
  SkeletonListRow,
  Tabs,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { useClientsWithSocialAccounts } from '../../../hooks/useClientsWithSocialAccounts';
import { fontSize, radius, spacing } from '../../../constants/theme';

type EngFocus = 'total' | 'likes' | 'comments' | 'shares' | 'saved' | 'score';

const DAY_OPTIONS = [
  { label: '7D', value: '7' },
  { label: '30D', value: '30' },
  { label: '90D', value: '90' },
];

export default function SocialAnalyzeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ clientId?: string }>();

  const [clientId, setClientId] = useState(
    typeof params.clientId === 'string' ? params.clientId : ''
  );
  const [days, setDays] = useState('30');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustom, setUseCustom] = useState(false);
  const [platform, setPlatform] = useState('ALL');
  const [contentType, setContentType] = useState('ALL');
  const [tab, setTab] = useState('overview');
  const [showFilters, setShowFilters] = useState(false);
  const [chartMetric, setChartMetric] = useState<
    'followers' | 'reach' | 'impressions' | 'engagementRate'
  >('followers');
  const [engFocus, setEngFocus] = useState<EngFocus>('total');
  const [engShowAvg, setEngShowAvg] = useState(true);
  const [postSearch, setPostSearch] = useState('');
  const [postSort, setPostSort] = useState('engagement');
  const [postPage, setPostPage] = useState(1);
  const [detailId, setDetailId] = useState<string | null>(null);

  const queryOpts = useMemo(
    () => ({
      days: Number(days) || 30,
      startDate: useCustom ? customStart || undefined : undefined,
      endDate: useCustom ? customEnd || undefined : undefined,
      platform,
      contentType,
    }),
    [days, useCustom, customStart, customEnd, platform, contentType]
  );

  const dateRangeText = useCustom && customStart && customEnd
    ? `${customStart} → ${customEnd}`
    : `${days} days`;

  const socialClients = useClientsWithSocialAccounts({
    includeClientId: typeof params.clientId === 'string' ? params.clientId : undefined,
  });
  const clientOptions = socialClients.options;

  useEffect(() => {
    if (clientId || clientOptions.length === 0) return;
    setClientId(clientOptions[0].value);
  }, [clientId, clientOptions]);

  // If a deep-linked client has no social accounts, fall back to the first connected client.
  useEffect(() => {
    if (!clientId || socialClients.isLoading || clientOptions.length === 0) return;
    if (!clientOptions.some((c) => c.value === clientId)) {
      setClientId(clientOptions[0].value);
    }
  }, [clientId, socialClients.isLoading, clientOptions]);

  const connectedPlatforms = useMemo(() => {
    const set = new Set(
      socialClients.accounts
        .filter((a) => a.clientId === clientId)
        .map((a) => a.platform.toLowerCase())
    );
    return Array.from(set);
  }, [socialClients.accounts, clientId]);

  const platformFilters = useMemo(
    () => [
      { label: 'All', value: 'ALL' },
      ...connectedPlatforms.map((p) => ({
        label: platformLabel(p),
        value: p.toUpperCase(),
      })),
    ],
    [connectedPlatforms]
  );

  const analyticsQ = useQuery({
    queryKey: ['social-analytics', clientId, queryOpts],
    queryFn: () => fetchFullAnalytics(clientId, queryOpts),
    enabled: !!clientId,
  });

  const postsQ = useQuery({
    queryKey: ['social-analytics-posts', clientId, queryOpts, postPage, postSort, postSearch],
    queryFn: () =>
      fetchAnalyticsPosts(clientId, {
        ...queryOpts,
        page: postPage,
        limit: 10,
        sortBy: postSort,
        search: postSearch,
      }),
    enabled: !!clientId && (tab === 'content' || tab === 'export'),
  });

  const refreshM = useMutation({
    mutationFn: () => refreshAnalytics(clientId),
    onSuccess: async () => {
      toast('Metrics synced', 'success');
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['social-analytics', clientId] }),
        queryClient.invalidateQueries({ queryKey: ['social-analytics-posts', clientId] }),
      ]);
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const tiktokAccount = useMemo(
    () =>
      socialClients.accounts.find(
        (a) => a.clientId === clientId && a.platform.toLowerCase() === 'tiktok'
      ),
    [socialClients.accounts, clientId]
  );

  const importM = useMutation({
    mutationFn: async () => {
      if (!tiktokAccount) throw new Error('No TikTok account for this client');
      const picked = await DocumentPicker.getDocumentAsync({
        multiple: true,
        type: [
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'application/vnd.ms-excel',
          'text/csv',
          'application/csv',
        ],
        copyToCacheDirectory: true,
      });
      if (picked.canceled || !picked.assets?.length) throw new Error('No files selected');
      return importTiktokStudio(
        tiktokAccount.id,
        picked.assets.map((a) => ({
          uri: a.uri,
          name: a.name || `tiktok-${Date.now()}.xlsx`,
          type: a.mimeType || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        }))
      );
    },
    onSuccess: async (res) => {
      toast(res.message || `Imported ${res.imported ?? 0} rows`, 'success');
      await refreshM.mutateAsync();
    },
    onError: (e: Error) => {
      if (e.message !== 'No files selected') toast(e.message, 'error');
    },
  });

  const exportCsv = async () => {
    try {
      let posts = postsQ.data?.posts || [];
      if (!posts.length && clientId) {
        const res = await fetchAnalyticsPosts(clientId, {
          ...queryOpts,
          page: 1,
          limit: 50,
          sortBy: postSort,
          search: postSearch,
        });
        posts = res.posts;
      }
      if (!posts.length) {
        toast('No posts to export', 'error');
        return;
      }
      const csv = postsToCsv(posts);
      const path = `${FileSystem.cacheDirectory}social-analytics-${Date.now()}.csv`;
      await FileSystem.writeAsStringAsync(path, csv, {
        encoding: FileSystem.EncodingType.UTF8,
      });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(path, { mimeType: 'text/csv', UTI: 'public.comma-separated-values-text' });
      }
      toast('CSV ready', 'success');
    } catch (e) {
      toast((e as Error).message, 'error');
    }
  };

  const data = analyticsQ.data;
  const caps = data?.capabilities;
  const kpis = data?.kpis;
  const isYoutube = platform === 'YOUTUBE';
  const tabs = ANALYTICS_TABS.map((x) =>
    x.key === 'followers' && isYoutube
      ? { key: x.key, label: 'Subscribers' }
      : { key: x.key, label: x.label }
  );

  const activeFilterCount =
    (platform !== 'ALL' ? 1 : 0) +
    (contentType !== 'ALL' ? 1 : 0) +
    (useCustom ? 1 : 0);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={analyticsQ.isRefetching || refreshM.isPending}
            onRefresh={() => {
              analyticsQ.refetch();
              if (tab === 'content' || tab === 'export') postsQ.refetch();
            }}
            tintColor={t.primary}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.lg }}>
              Analytics Dashboard
            </Text>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              {dateRangeText}
            </Text>
          </View>
          <Pressable
            onPress={() => setShowFilters((v) => !v)}
            style={[styles.filterBtn, { borderColor: t.border, backgroundColor: t.card }]}
          >
            <Ionicons name="options-outline" size={16} color={t.primary} />
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.xs }}>
              Filters{activeFilterCount ? ` · ${activeFilterCount}` : ''}
            </Text>
          </Pressable>
        </View>

        {socialClients.isLoading ? (
          <FormSkeleton fields={1} padding={0} />
        ) : (
          <Select
            label="Client"
            value={clientId}
            options={clientOptions}
            onChange={(id) => {
              setClientId(id);
              setPostPage(1);
              setPlatform('ALL');
            }}
            placeholder="Select client"
          />
        )}
        <View style={styles.actionsRow}>
          <Button
            title="Sync metrics"
            variant="outline"
            loading={refreshM.isPending}
            disabled={!clientId}
            onPress={() => refreshM.mutate()}
            style={{ flex: 1 }}
          />
          <Button
            title="Export CSV"
            variant="outline"
            disabled={!clientId}
            onPress={exportCsv}
            style={{ flex: 1 }}
          />
        </View>

        {showFilters ? (
          <Card style={{ gap: spacing.md }}>
            <Text style={[styles.sectionLabel, { color: t.foreground }]}>Date range</Text>
            <View style={styles.chips}>
              {DAY_OPTIONS.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={!useCustom && days === opt.value}
                  onPress={() => {
                    setUseCustom(false);
                    setDays(opt.value);
                    setPostPage(1);
                  }}
                />
              ))}
              <Chip
                label="Custom"
                selected={useCustom}
                onPress={() => setUseCustom(true)}
              />
            </View>
            {useCustom ? (
              <View style={styles.row2}>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="Start" value={customStart} onChange={setCustomStart} />
                </View>
                <View style={{ flex: 1 }}>
                  <DatePickerField label="End" value={customEnd} onChange={setCustomEnd} />
                </View>
              </View>
            ) : null}

            <Text style={[styles.sectionLabel, { color: t.foreground }]}>Platform</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              {platformFilters.map((opt) => (
                <Chip
                  key={opt.value}
                  label={opt.label}
                  selected={platform === opt.value}
                  onPress={() => {
                    setPlatform(opt.value);
                    setPostPage(1);
                  }}
                />
              ))}
            </ScrollView>

            <Select
              label="Content type"
              value={contentType}
              options={CONTENT_TYPES.map((c) => ({ label: c.label, value: c.value }))}
              onChange={(v) => {
                setContentType(v);
                setPostPage(1);
              }}
            />
          </Card>
        ) : null}

        {!socialClients.isLoading && clientOptions.length === 0 ? (
          <EmptyState
            title="No clients with social accounts"
            description="Connect a platform under Social → Accounts, then return to Analyze."
            icon="link-outline"
            actionLabel="Open Accounts"
            onAction={() => router.push('/(tabs)/social/accounts')}
          />
        ) : !clientId ? (
          <EmptyState
            title="Select a client"
            description="Pick a client with connected social accounts."
            icon="stats-chart-outline"
          />
        ) : analyticsQ.isLoading ? (
          <DashboardSkeleton padding={0} />
        ) : analyticsQ.error ? (
          <EmptyState
            title="Could not load analytics"
            description={(analyticsQ.error as Error).message}
            actionLabel="Retry"
            onAction={() => analyticsQ.refetch()}
            icon="alert-circle-outline"
          />
        ) : data?.empty ? (
          <EmptyState
            title="No connected accounts"
            description="Connect social accounts for this client to see analytics."
            icon="link-outline"
          />
        ) : (
          <>
            <Tabs tabs={[...tabs]} value={tab} onChange={setTab} />

            {tab === 'overview' && (
              <OverviewTab
                data={data}
                caps={caps}
                kpis={kpis}
                isYoutube={isYoutube}
                dateRangeText={dateRangeText}
                chartMetric={chartMetric}
                setChartMetric={setChartMetric}
              />
            )}
            {tab === 'engagement' && (
              <EngagementTab
                data={data}
                engFocus={engFocus}
                setEngFocus={setEngFocus}
                engShowAvg={engShowAvg}
                setEngShowAvg={setEngShowAvg}
              />
            )}
            {tab === 'followers' && (
              <FollowersTab data={data} isYoutube={isYoutube} />
            )}
            {tab === 'reach' && <ReachTab data={data} />}
            {tab === 'content' && (
              <ContentTab
                data={data}
                posts={postsQ.data?.posts || []}
                total={postsQ.data?.total || 0}
                loading={postsQ.isLoading}
                page={postPage}
                sort={postSort}
                search={postSearch}
                onSearch={setPostSearch}
                onSort={setPostSort}
                onPage={setPostPage}
                onOpenPost={setDetailId}
              />
            )}
            {tab === 'video' && <VideoTab data={data} caps={caps} />}
            {tab === 'audience' && <AudienceTab data={data} caps={caps} />}
            {tab === 'besttime' && <BestTimeTab data={data} />}
            {tab === 'platforms' && <PlatformsTab data={data} />}
            {tab === 'publishing' && <PublishingTab data={data} />}
            {tab === 'accounts' && <AccountsTab data={data} />}
            {tab === 'ai' && (
              <AiTab
                data={data}
                onSync={() => refreshM.mutate()}
                syncing={refreshM.isPending}
              />
            )}
            {tab === 'export' && (
              <ExportTab
                postsCount={postsQ.data?.posts?.length || 0}
                provenance={data?.provenance}
                hasTiktok={!!tiktokAccount}
                importing={importM.isPending}
                onExport={exportCsv}
                onImport={() => importM.mutate()}
              />
            )}
          </>
        )}
      </ScrollView>

      <PostAnalyticsSheet postId={detailId} onClose={() => setDetailId(null)} />
    </View>
  );
}

/* ───────────────────────────── Tab panels ───────────────────────────── */

function OverviewTab({
  data,
  caps,
  kpis,
  isYoutube,
  dateRangeText,
  chartMetric,
  setChartMetric,
}: {
  data?: FullAnalytics;
  caps: FullAnalytics['capabilities'];
  kpis: FullAnalytics['kpis'];
  isYoutube: boolean;
  dateRangeText: string;
  chartMetric: 'followers' | 'reach' | 'impressions' | 'engagementRate';
  setChartMetric: (m: 'followers' | 'reach' | 'impressions' | 'engagementRate') => void;
}) {
  const t = useTheme();
  const cards = [
    kpiCard(caps, 'followers', isYoutube ? 'Subscribers' : 'Followers', kpis?.followers, 'people-outline'),
    kpiCard(caps, 'reach', 'Reach', kpis?.reach, 'trending-up-outline'),
    kpiCard(caps, 'impressions', 'Impressions', kpis?.impressions, 'eye-outline'),
    kpiCard(caps, 'profileVisits', 'Profile visits', kpis?.profileVisits, 'person-add-outline'),
    kpiCard(caps, 'videoViews', 'Video views', kpis?.videoViews, 'play-outline'),
    kpiCard(
      caps,
      'engagementRate',
      'Eng. rate',
      kpis?.engagementRate
        ? {
            current: kpis.engagementRate.current,
            change: kpis.engagementRate.change,
            growth: kpis.engagementRate.change,
          }
        : null,
      'pulse-outline',
      true
    ),
    {
      label: 'Posts published',
      value: fmtN(kpis?.publishing.published),
      sub: undefined as string | undefined,
      icon: 'flash-outline' as const,
      locked: false,
    },
  ].filter(Boolean) as Array<{
    label: string;
    value: string;
    sub?: string;
    icon: keyof typeof Ionicons.glyphMap;
    locked?: boolean;
    note?: string;
  }>;

  const pieData = (data?.platformBreakdown || [])
    .map((p) => ({
      label: p.platform || p.name || 'other',
      value: Number(p.followers ?? p.reach ?? p.value ?? 0),
      color: platformColor(p.platform || p.name),
    }))
    .filter((p) => p.value > 0);

  const mc = data?.monthlyComparison;

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Overview" subtitle={`Key performance for ${dateRangeText}`} />
      <KpiGrid items={cards} />

      <Card>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Performance over time</Text>
        </View>
        <View style={styles.chips}>
          {(['followers', 'reach', 'impressions', 'engagementRate'] as const).map((m) => (
            <Chip
              key={m}
              label={m === 'engagementRate' ? 'Eng.Rate' : m[0].toUpperCase() + m.slice(1)}
              selected={chartMetric === m}
              onPress={() => setChartMetric(m)}
            />
          ))}
        </View>
        {(data?.chartData || []).length ? (
          <AreaLineChart data={data!.chartData!} dataKey={chartMetric} />
        ) : (
          <EmptyChart />
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>
          {isYoutube ? 'Subscriber split' : 'Audience split'}
        </Text>
        {pieData.length ? <DonutChart segments={pieData} /> : <EmptyChart msg="No follower data yet — sync metrics" />}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Period comparison</Text>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginBottom: spacing.sm }}>
          Current ({dateRangeText}) vs previous period
        </Text>
        {mc ? (
          <View style={{ gap: spacing.sm }}>
            <CompareRow label={isYoutube ? 'Subscribers' : 'Followers'} curr={mc.current.followers} prev={mc.previous.followers} />
            <CompareRow label="Reach" curr={mc.current.reach} prev={mc.previous.reach} />
            <CompareRow label="Impressions" curr={mc.current.impressions} prev={mc.previous.impressions} />
            <CompareRow label="Engagement" curr={mc.current.engagement} prev={mc.previous.engagement} />
            <CompareRow label="Posts" curr={mc.current.posts} prev={mc.previous.posts} />
            <CompareRow label="Video views" curr={mc.current.views} prev={mc.previous.views} />
          </View>
        ) : (
          <EmptyChart />
        )}
      </Card>
    </View>
  );
}

function EngagementTab({
  data,
  engFocus,
  setEngFocus,
  engShowAvg,
  setEngShowAvg,
}: {
  data?: FullAnalytics;
  engFocus: EngFocus;
  setEngFocus: (f: EngFocus) => void;
  engShowAvg: boolean;
  setEngShowAvg: (v: boolean) => void;
}) {
  const t = useTheme();
  const eng = data?.kpis?.engagement;
  const trend = useMemo(() => {
    return (data?.engagementTrend || []).map((row) => {
      const likes = Number(row.likes) || 0;
      const comments = Number(row.comments) || 0;
      const shares = Number(row.shares) || 0;
      const saved = Number(row.saved) || 0;
      const total = likes + comments + shares + saved;
      const score = likes * 1 + comments * 2 + shares * 3 + saved * 2;
      return { ...row, likes, comments, shares, saved, total, score };
    });
  }, [data?.engagementTrend]);

  const withAvg = useMemo(() => {
    return trend.map((row, i) => {
      const window = trend.slice(Math.max(0, i - 6), i + 1);
      const avg =
        window.reduce((s, r) => s + (Number((r as Record<string, number | string>)[engFocus]) || 0), 0) /
        Math.max(window.length, 1);
      return { ...row, avg };
    });
  }, [trend, engFocus]);

  const focusVals = withAvg.map((r) => Number((r as Record<string, number | string>)[engFocus]) || 0);
  const focusTotal = focusVals.reduce((s, v) => s + v, 0);
  const peak = Math.max(...focusVals, 0);
  const dailyAvg = focusVals.length ? focusTotal / focusVals.length : 0;
  const mixTotal = (eng?.likes || 0) + (eng?.comments || 0) + (eng?.shares || 0) + (eng?.saved || 0) || 1;

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Engagement" subtitle="Interactions across your content" />
      <KpiGrid
        items={[
          { label: 'Likes', value: fmtN(eng?.likes), icon: 'heart-outline' },
          { label: 'Comments', value: fmtN(eng?.comments), icon: 'chatbubble-outline' },
          { label: 'Shares', value: fmtN(eng?.shares), icon: 'share-outline' },
          { label: 'Saves', value: fmtN(eng?.saved), icon: 'bookmark-outline' },
          { label: 'Views', value: fmtN(eng?.views), icon: 'play-outline' },
          { label: 'Total', value: fmtN(eng?.total), icon: 'flash-outline' },
        ]}
      />

      <Card>
        <View style={styles.cardHead}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Engagement trend</Text>
          <Chip
            label={engShowAvg ? '7d avg on' : '7d avg off'}
            selected={engShowAvg}
            onPress={() => setEngShowAvg(!engShowAvg)}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(
            [
              ['total', 'Total'],
              ['likes', 'Likes'],
              ['comments', 'Comments'],
              ['shares', 'Shares'],
              ['saved', 'Saves'],
              ['score', 'Score'],
            ] as const
          ).map(([k, label]) => (
            <Chip key={k} label={label} selected={engFocus === k} onPress={() => setEngFocus(k)} />
          ))}
        </ScrollView>
        <View style={styles.statTriple}>
          <MiniStat label="Focus total" value={fmtN(focusTotal)} />
          <MiniStat label="Peak day" value={fmtN(peak)} />
          <MiniStat label="Daily avg" value={fmtN(dailyAvg)} />
        </View>
        {withAvg.length ? (
          <AreaLineChart data={withAvg} dataKey={engShowAvg ? 'avg' : engFocus} />
        ) : (
          <EmptyChart />
        )}
        {engFocus === 'score' ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Weighted score = likes×1 + comments×2 + shares×3 + saves×2
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Engagement rate</Text>
        <Text style={{ color: t.foreground, fontSize: 32, fontWeight: '900' }}>
          {fmtPct(data?.kpis?.engagementRate?.current)}
        </Text>
        <Delta value={data?.kpis?.engagementRate?.change} />
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginTop: 4 }}>
          vs {fmtPct(data?.kpis?.engagementRate?.previous)} previous period
        </Text>
        <ProgressBar
          progress={Math.min((data?.kpis?.engagementRate?.current || 0) * 10, 100)}
          height={8}
        />
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Engagement mix</Text>
        {[
          { label: 'Likes', val: eng?.likes || 0, color: '#ef4444' },
          { label: 'Comments', val: eng?.comments || 0, color: '#3b82f6' },
          { label: 'Shares', val: eng?.shares || 0, color: '#10b981' },
          { label: 'Saves', val: eng?.saved || 0, color: '#f59e0b' },
        ].map((item) => {
          const pct = (item.val / mixTotal) * 100;
          return (
            <Pressable key={item.label} onPress={() => setEngFocus(item.label.toLowerCase() as EngFocus)} style={{ gap: 4, marginBottom: spacing.sm }}>
              <View style={styles.rowBetween}>
                <Text style={{ color: t.foreground, fontWeight: '600' }}>{item.label}</Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  {fmtN(item.val)} · {pct.toFixed(1)}%
                </Text>
              </View>
              <ProgressBar progress={pct} color={item.color} height={8} />
            </Pressable>
          );
        })}
      </Card>
    </View>
  );
}

function FollowersTab({ data, isYoutube }: { data?: FullAnalytics; isYoutube: boolean }) {
  const t = useTheme();
  const f = data?.kpis?.followers;
  const bars = (data?.platformBreakdown || []).map((p) => ({
    label: p.platform || p.name || 'other',
    value: Number(p.followers ?? 0),
  }));

  return (
    <View style={styles.tabBody}>
      <SectionTitle
        title={isYoutube ? 'Subscribers' : 'Followers'}
        subtitle="Audience size and growth"
      />
      <KpiGrid
        items={[
          { label: isYoutube ? 'Current subscribers' : 'Current followers', value: fmtN(f?.current), icon: 'people-outline' },
          { label: 'Net change', value: fmtN(f?.change != null ? Math.abs(f.change) : null), icon: (f?.change ?? 0) >= 0 ? 'arrow-up' : 'arrow-down' },
          { label: 'Growth', value: fmtPct(f?.growth != null ? Math.abs(f.growth) : null), icon: 'trending-up-outline' },
          ...(f?.isNew
            ? []
            : [{ label: 'Prev. period', value: fmtN(f?.previous), icon: 'time-outline' as const }]),
        ]}
      />
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Growth over time</Text>
        {(data?.chartData || []).length ? (
          <AreaLineChart data={data!.chartData!} dataKey="followers" />
        ) : (
          <EmptyChart />
        )}
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Audience distribution</Text>
        {bars.length ? (
          <BarChartSimple data={bars} labelKey="label" valueKey="value" horizontal />
        ) : (
          <EmptyChart />
        )}
      </Card>
    </View>
  );
}

function ReachTab({ data }: { data?: FullAnalytics }) {
  const t = useTheme();
  const reach = data?.kpis?.reach;
  const impressions = data?.kpis?.impressions;
  const freq =
    reach?.current && reach.current > 0
      ? Number(((impressions?.current || 0) / reach.current).toFixed(2))
      : 0;

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Reach" subtitle="How many people saw your content" />
      <KpiGrid
        items={[
          { label: 'Total reach', value: fmtN(reach?.current), sub: deltaSub(reach?.growth), icon: 'trending-up-outline' },
          { label: 'Impressions', value: fmtN(impressions?.current), sub: deltaSub(impressions?.growth), icon: 'eye-outline' },
          { label: 'Reach change', value: fmtN(reach?.change != null ? Math.abs(reach.change) : null), icon: (reach?.change ?? 0) >= 0 ? 'arrow-up' : 'arrow-down' },
          { label: 'Frequency', value: fmtN(freq), icon: 'repeat-outline' },
        ]}
      />
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Reach vs impressions</Text>
        {(data?.chartData || []).length ? (
          <BarChartSimple
            data={(data?.chartData || []).map((d) => ({
              label: String(d.date || '').slice(5),
              value: Number(d.reach) || 0,
            }))}
            labelKey="label"
            valueKey="value"
          />
        ) : (
          <EmptyChart />
        )}
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Daily reach trend</Text>
        {(data?.chartData || []).length ? (
          <AreaLineChart data={data!.chartData!} dataKey="reach" color="#10b981" />
        ) : (
          <EmptyChart />
        )}
      </Card>
    </View>
  );
}

function ContentTab({
  data,
  posts,
  total,
  loading,
  page,
  sort,
  search,
  onSearch,
  onSort,
  onPage,
  onOpenPost,
}: {
  data?: FullAnalytics;
  posts: AnalyticsPost[];
  total: number;
  loading: boolean;
  page: number;
  sort: string;
  search: string;
  onSearch: (v: string) => void;
  onSort: (v: string) => void;
  onPage: (n: number) => void;
  onOpenPost: (id: string) => void;
}) {
  const t = useTheme();
  const types = data?.contentTypePerformance || [];
  const pages = Math.max(1, Math.ceil(total / 10));

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Content" subtitle="What formats and posts perform best" />
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Content type performance</Text>
        {types.length === 0 ? (
          <EmptyChart msg="No content-type data yet" />
        ) : (
          types.map((row, i) => (
            <View key={row.type} style={[styles.typeRow, { borderBottomColor: t.border }]}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.foreground, fontWeight: '700', textTransform: 'capitalize' }}>
                  {i === 0 ? '🏆 ' : ''}
                  {row.type}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  {row.count} posts · avg reach {fmtN(row.avgReach)} · avg eng {fmtN(row.avgEngagement)}
                </Text>
              </View>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {fmtN(row.avgViews)} views
              </Text>
            </View>
          ))
        )}
      </Card>

      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Top performing posts</Text>
        <SearchBar value={search} onChangeText={onSearch} placeholder="Search captions…" />
        <Select
          label="Sort by"
          value={sort}
          options={POST_SORTS.map((s) => ({ label: s.label, value: s.value }))}
          onChange={(v) => {
            onSort(v);
            onPage(1);
          }}
        />
        {loading ? (
          <View style={{ gap: spacing.sm }}>
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
          </View>
        ) : posts.length === 0 ? (
          <EmptyChart msg="No posts in this range" />
        ) : (
          posts.map((p) => <PostRow key={p.id} post={p} onPress={() => onOpenPost(p.id)} />)
        )}
        {total > 10 ? (
          <View style={styles.pager}>
            <Button
              title="Prev"
              variant="outline"
              size="sm"
              disabled={page <= 1}
              onPress={() => onPage(page - 1)}
            />
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
              {page} / {pages}
            </Text>
            <Button
              title="Next"
              variant="outline"
              size="sm"
              disabled={page >= pages}
              onPress={() => onPage(page + 1)}
            />
          </View>
        ) : null}
      </Card>
    </View>
  );
}

function VideoTab({
  data,
  caps,
}: {
  data?: FullAnalytics;
  caps: FullAnalytics['capabilities'];
}) {
  const eng = data?.kpis?.engagement;
  const storyStatus = capStatus(caps, 'story');
  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Video & Story" subtitle="Views and interactions on video content" />
      <KpiGrid
        items={[
          { label: 'Video views', value: fmtN(eng?.views), icon: 'play-outline' },
          { label: 'Saves', value: fmtN(eng?.saved), icon: 'bookmark-outline' },
          { label: 'Shares', value: fmtN(eng?.shares), icon: 'share-outline' },
          { label: 'Comments', value: fmtN(eng?.comments), icon: 'chatbubble-outline' },
        ]}
      />
      {storyStatus === 'locked' || storyStatus === 'importable' ? (
        <SectionLock
          title="Story analytics unavailable"
          desc={
            storyStatus === 'importable'
              ? 'Import platform data to unlock story metrics for the selected accounts.'
              : 'Story insights are not available for the platforms in this view.'
          }
        />
      ) : null}
    </View>
  );
}

function AudienceTab({
  data,
  caps,
}: {
  data?: FullAnalytics;
  caps: FullAnalytics['capabilities'];
}) {
  const t = useTheme();
  const genderStatus = capStatus(caps, 'demoGender');
  const countryStatus = capStatus(caps, 'demoCountry');
  const gender = data?.demographics?.gender || [];
  const country = (data?.demographics?.country || []).slice(0, 10);

  if (!capOf(caps, 'demoGender') && !capOf(caps, 'demoCountry')) {
    return (
      <View style={styles.tabBody}>
        <EmptyState
          title="No audience demographics"
          description="Connect platforms that provide audience insights, or import Studio data."
          icon="globe-outline"
        />
      </View>
    );
  }

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Audience" subtitle="Who is engaging with your brand" />
      {genderStatus === 'available' ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Gender distribution</Text>
          {gender.map((g) => (
            <View key={g.label} style={{ gap: 4, marginBottom: spacing.sm }}>
              <View style={styles.rowBetween}>
                <Text style={{ color: t.foreground, fontWeight: '600' }}>{g.label}</Text>
                <Text style={{ color: t.mutedForeground }}>{fmtPct((g.fraction || 0) * 100)}</Text>
              </View>
              <ProgressBar progress={(g.fraction || 0) * 100} height={8} />
            </View>
          ))}
        </Card>
      ) : (
        <SectionLock
          title="Gender data locked"
          desc={
            genderStatus === 'importable'
              ? 'Import analytics to unlock gender demographics.'
              : 'Gender demographics are not available for these platforms.'
          }
        />
      )}

      {countryStatus === 'available' ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Top countries</Text>
          {country.map((c) => (
            <View key={c.label} style={{ gap: 4, marginBottom: spacing.sm }}>
              <View style={styles.rowBetween}>
                <Text style={{ color: t.foreground, fontWeight: '600' }}>{c.label}</Text>
                <Text style={{ color: t.mutedForeground }}>{fmtPct((c.fraction || 0) * 100)}</Text>
              </View>
              <ProgressBar progress={(c.fraction || 0) * 100} height={8} />
            </View>
          ))}
        </Card>
      ) : (
        <SectionLock
          title="Country data locked"
          desc={
            countryStatus === 'importable'
              ? 'Import analytics to unlock country demographics.'
              : 'Country demographics are not available for these platforms.'
          }
        />
      )}
    </View>
  );
}

function BestTimeTab({ data }: { data?: FullAnalytics }) {
  const t = useTheme();
  const heat = data?.activityHeatmap || [];
  const best = data?.bestTimes || [];
  const cells =
    heat.length > 0
      ? heat.map((c) => ({ weekday: c.weekday, hour: c.hour, value: c.activeFollowers }))
      : best.map((c) => ({
          weekday: Number(c.day ?? c.weekday ?? 0),
          hour: Number(c.hour ?? 0),
          value: Number(c.engagement ?? c.activeFollowers ?? 0),
        }));
  const source = heat.length > 0 ? 'import' : 'posts';
  const top = [...cells].sort((a, b) => b.value - a.value).slice(0, 5);

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Best time" subtitle="When your audience is most active" />
      <Card>
        {cells.length ? <HeatmapGrid cells={cells} source={source} /> : <EmptyChart />}
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Top 5 slots</Text>
        {top.length === 0 ? (
          <EmptyChart />
        ) : (
          top.map((slot, i) => (
            <View key={`${slot.weekday}-${slot.hour}-${i}`} style={styles.rowBetween}>
              <Text style={{ color: t.foreground, fontWeight: '600' }}>
                #{i + 1} {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][slot.weekday] || 'Day'}{' '}
                {String(slot.hour).padStart(2, '0')}:00
              </Text>
              <Text style={{ color: t.mutedForeground }}>{fmtN(slot.value)}</Text>
            </View>
          ))
        )}
      </Card>
    </View>
  );
}

function PlatformsTab({ data }: { data?: FullAnalytics }) {
  const t = useTheme();
  const rows = data?.platformComparison || [];
  const bars = (data?.platformBreakdown || []).map((p) => ({
    label: p.platform || p.name || 'other',
    value: Number(p.followers ?? 0),
  }));

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Platforms" subtitle="Compare performance across networks" />
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Comparison</Text>
        {rows.length === 0 ? (
          <EmptyChart />
        ) : (
          rows.map((r) => (
            <View key={r.platform} style={[styles.platformRow, { borderBottomColor: t.border }]}>
              <View style={styles.rowBetween}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  {platformIconSource(r.platform) ? (
                    <Image source={platformIconSource(r.platform)!} style={{ width: 16, height: 16 }} />
                  ) : null}
                  <Text style={{ color: t.foreground, fontWeight: '700' }}>
                    {platformLabel(r.platform)}
                  </Text>
                </View>
                <Delta value={r.growth} />
              </View>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {fmtN(r.followers)} fol · {fmtN(r.reach)} reach · {fmtN(r.impressions)} impr ·{' '}
                {fmtN(r.engagement)} eng · {fmtN(r.posts)} posts
              </Text>
            </View>
          ))
        )}
      </Card>
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Followers by platform</Text>
        {bars.length ? (
          <BarChartSimple data={bars} labelKey="label" valueKey="value" horizontal />
        ) : (
          <EmptyChart />
        )}
      </Card>
    </View>
  );
}

function PublishingTab({ data }: { data?: FullAnalytics }) {
  const t = useTheme();
  const pub = data?.publishing;
  const attempted = (pub?.published || 0) + (pub?.failed || 0);
  const success = pub?.successRate ?? 0;
  const successColor = success >= 95 ? '#16A34A' : success >= 80 ? '#D97706' : '#E53E3E';

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Publishing" subtitle="Pipeline health and output" />
      <KpiGrid
        items={[
          { label: 'Published', value: fmtN(pub?.published), icon: 'checkmark-circle-outline' },
          { label: 'Scheduled', value: fmtN(pub?.scheduled), icon: 'calendar-outline' },
          { label: 'Draft', value: fmtN(pub?.draft), icon: 'document-outline' },
          { label: 'Failed', value: fmtN(pub?.failed), icon: 'close-circle-outline' },
          { label: 'Awaiting', value: fmtN(pub?.pendingApproval), icon: 'hourglass-outline' },
          { label: 'Success rate', value: fmtPct(pub?.successRate), icon: 'trophy-outline' },
        ]}
      />
      <Card>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>Success rate</Text>
        <DonutChart
          size={150}
          centerLabel="success"
          centerValue={fmtPct(success, 0)}
          segments={[
            { label: 'Published', value: pub?.published || 0, color: successColor },
            { label: 'Failed', value: pub?.failed || 0, color: '#E53E3E' },
            {
              label: 'Other',
              value: Math.max(attempted === 0 ? 1 : 0, (pub?.scheduled || 0) + (pub?.draft || 0)),
              color: '#9B94AB',
            },
          ]}
        />
      </Card>
      {(pub?.weeklyActivity || []).length ? (
        <Card>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Weekly publishing activity</Text>
          <BarChartSimple
            data={(pub?.weeklyActivity || []).map((w) => ({
              label: w.week,
              value: w.posts,
            }))}
            labelKey="label"
            valueKey="value"
          />
        </Card>
      ) : null}
    </View>
  );
}

function AccountsTab({ data }: { data?: FullAnalytics }) {
  const t = useTheme();
  const accounts = data?.accounts || [];
  if (!accounts.length) {
    return (
      <EmptyState title="No accounts" description="Connect accounts to see per-account metrics." icon="link-outline" />
    );
  }

  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Accounts" subtitle="Health and latest metrics per connection" />
      {accounts.map((a) => {
        const reachStatus = a.metricStatus?.reach || 'available';
        const imprStatus = a.metricStatus?.impressions || 'available';
        return (
          <Card key={a.id} style={{ gap: spacing.sm }}>
            <View style={styles.accountHead}>
              <SocialAccountAvatar
                accountId={a.id}
                avatarUrl={a.avatarUrl}
                name={a.displayName}
                platform={a.platform}
                size={44}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }}>{a.displayName}</Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  {platformLabel(a.platform)}
                  {a.platformUsername ? ` · @${a.platformUsername}` : ''}
                </Text>
              </View>
              <Badge
                label={
                  String(a.healthStatus || '').toUpperCase() === 'HEALTHY' ||
                  String(a.healthStatus || '').toUpperCase() === 'OK'
                    ? 'Connected'
                    : 'Issue'
                }
                tone={healthTone(a.healthStatus)}
              />
            </View>

            <View style={styles.metricRow3}>
              <AccountMetric label="Followers" value={fmtN(a.latestMetrics?.followers)} />
              <AccountMetric
                label="Reach"
                value={
                  reachStatus === 'available'
                    ? fmtN(a.latestMetrics?.reach)
                    : reachStatus === 'importable'
                      ? 'Import'
                      : 'Locked'
                }
                locked={reachStatus !== 'available'}
              />
              <AccountMetric
                label="Impressions"
                value={
                  imprStatus === 'available'
                    ? fmtN(a.latestMetrics?.impressions)
                    : imprStatus === 'importable'
                      ? 'Import'
                      : 'Locked'
                }
                locked={imprStatus !== 'available'}
              />
            </View>

            {(a.latestMetrics?.engagementRate || 0) > 0 ? (
              <View style={{ gap: 4 }}>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  Engagement rate {fmtPct(a.latestMetrics?.engagementRate)}
                </Text>
                <ProgressBar
                  progress={Math.min((a.latestMetrics?.engagementRate || 0) * 10, 100)}
                  height={6}
                />
              </View>
            ) : null}

            {(reachStatus === 'locked' ||
              String(a.healthMessage || '').toLowerCase().includes('insight')) &&
            a.platform.toLowerCase() === 'instagram' ? (
              <Text style={{ color: t.warning, fontSize: fontSize.xs }}>
                Instagram insights may need Business/Creator access enabled.
              </Text>
            ) : null}

            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              Last sync {formatDate(a.latestMetrics?.date || a.updatedAt)}
              {a.lastImportedAt ? ` · Studio ${formatDate(a.lastImportedAt)}` : ''}
            </Text>
            {a.healthMessage ? (
              <Text style={{ color: t.warning, fontSize: fontSize.xs }}>{a.healthMessage}</Text>
            ) : null}
          </Card>
        );
      })}
    </View>
  );
}

function AiTab({
  data,
  onSync,
  syncing,
}: {
  data?: FullAnalytics;
  onSync: () => void;
  syncing: boolean;
}) {
  const t = useTheme();
  const insights = data?.aiInsights || [];
  if (!insights.length) {
    return (
      <EmptyState
        title="No AI insights yet"
        description="Sync metrics after enough data is available."
        actionLabel="Sync metrics"
        onAction={onSync}
        icon="bulb-outline"
      />
    );
  }
  return (
    <View style={styles.tabBody}>
      <SectionTitle title="AI Insights" subtitle="Automated takeaways from this period" />
      {insights.map((line, i) => (
        <Card key={`${i}-${line.slice(0, 16)}`}>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Ionicons name="sparkles-outline" size={18} color={t.secondary} />
            <Text style={{ color: t.foreground, flex: 1, lineHeight: 20 }}>
              {renderInsightParts(line).map((p, idx) => (
                <Text key={idx} style={{ fontWeight: p.bold ? '800' : '400', color: t.foreground }}>
                  {p.text}
                </Text>
              ))}
            </Text>
          </View>
        </Card>
      ))}
      <Button title="Sync metrics" variant="outline" loading={syncing} onPress={onSync} />
    </View>
  );
}

function ExportTab({
  postsCount,
  provenance,
  hasTiktok,
  importing,
  onExport,
  onImport,
}: {
  postsCount: number;
  provenance?: FullAnalytics['provenance'];
  hasTiktok: boolean;
  importing: boolean;
  onExport: () => void;
  onImport: () => void;
}) {
  const t = useTheme();
  return (
    <View style={styles.tabBody}>
      <SectionTitle title="Export & Import" subtitle="Download reports or enrich TikTok data" />
      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.cardTitle, { color: t.foreground }]}>CSV export</Text>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
          Includes caption, platforms, date, type, likes, comments, shares, saved, views, reach,
          impressions, engagement, and ER%.
        </Text>
        <Button title={`Download CSV (${postsCount || '…'})`} onPress={onExport} />
      </Card>

      {hasTiktok ? (
        <Card style={{ gap: spacing.md }}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Import TikTok Studio</Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            Upload TikTok Studio XLSX/CSV exports to unlock reach, audience, and verified video metrics.
          </Text>
          {provenance?.lastImportedAt ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              Last import {formatDate(provenance.lastImportedAt)}
              {provenance.imported?.length ? ` · ${provenance.imported.join(', ')}` : ''}
            </Text>
          ) : null}
          <Button title="Import files" loading={importing} onPress={onImport} />
        </Card>
      ) : (
        <Card>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            Connect a TikTok account to enable Studio imports.
          </Text>
        </Card>
      )}
    </View>
  );
}

/* ───────────────────────────── Shared bits ───────────────────────────── */

function kpiCard(
  caps: FullAnalytics['capabilities'],
  key: MetricKey,
  label: string,
  kpi: { current: number; growth?: number | null; change?: number | null } | null | undefined,
  icon: keyof typeof Ionicons.glyphMap,
  isRate = false
) {
  const cap = capOf(caps, key);
  if (cap == null && kpi == null) return null;
  const status = cap?.status;
  if (status === 'locked' || status === 'importable') {
    return {
      label,
      value: '—',
      sub: status === 'importable' ? 'Import to view' : 'Locked',
      icon: 'lock-closed-outline' as const,
      locked: true,
      note: cap?.note,
    };
  }
  if (!kpi) return null;
  return {
    label,
    value: isRate ? fmtPct(kpi.current) : fmtN(kpi.current),
    sub: deltaSub(kpi.growth ?? kpi.change),
    icon,
    locked: false,
  };
}

function KpiGrid({
  items,
}: {
  items: Array<{
    label: string;
    value: string;
    sub?: string;
    icon: keyof typeof Ionicons.glyphMap;
    locked?: boolean;
    note?: string;
  }>;
}) {
  const t = useTheme();
  return (
    <View style={styles.kpiGrid}>
      {items.map((item) => (
        <View
          key={item.label}
          style={[
            styles.kpiCard,
            {
              backgroundColor: t.card,
              borderColor: t.border,
              opacity: item.locked ? 0.7 : 1,
            },
          ]}
        >
          <View style={styles.kpiTop}>
            <Ionicons name={item.icon} size={16} color={item.locked ? t.mutedForeground : t.primary} />
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{item.label}</Text>
          </View>
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '700' }}>
            {item.value}
          </Text>
          {item.sub ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{item.sub}</Text>
          ) : null}
          {item.note ? (
            <Text style={{ color: t.mutedForeground, fontSize: 10 }} numberOfLines={2}>
              {item.note}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.lg }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{subtitle}</Text>
      ) : null}
    </View>
  );
}

function SectionLock({ title, desc }: { title: string; desc: string }) {
  const t = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: spacing.sm, borderStyle: 'dashed' }}>
      <Ionicons name="alert-circle-outline" size={28} color={t.warning} />
      <Text style={{ color: t.foreground, fontWeight: '700' }}>{title}</Text>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center' }}>
        {desc}
      </Text>
    </Card>
  );
}

function CompareRow({
  label,
  curr,
  prev,
}: {
  label: string;
  curr?: number;
  prev?: number;
}) {
  const t = useTheme();
  const c = curr ?? 0;
  const p = prev ?? 0;
  const growth = p === 0 ? (c > 0 ? 100 : 0) : ((c - p) / Math.abs(p)) * 100;
  return (
    <View style={[styles.compareRow, { borderBottomColor: t.border }]}>
      <Text style={{ color: t.foreground, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Text style={{ color: t.mutedForeground, width: 56, textAlign: 'right' }}>{fmtN(p)}</Text>
      <Text style={{ color: t.foreground, fontWeight: '700', width: 56, textAlign: 'right' }}>
        {fmtN(c)}
      </Text>
      <View style={{ width: 64, alignItems: 'flex-end' }}>
        <Delta value={growth} />
      </View>
    </View>
  );
}

function Delta({ value }: { value?: number | null }) {
  const t = useTheme();
  if (value == null || !Number.isFinite(value)) return null;
  const tone = deltaTone(value);
  const color =
    tone === 'success' ? t.success : tone === 'destructive' ? t.destructive : t.mutedForeground;
  const icon = value > 0 ? 'arrow-up' : value < 0 ? 'arrow-down' : 'remove';
  return (
    <View style={[styles.delta, { backgroundColor: color + '22' }]}>
      <Ionicons name={icon as any} size={10} color={color} />
      <Text style={{ color, fontSize: 10, fontWeight: '800' }}>
        {Math.abs(value).toFixed(1)}%
      </Text>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{label}</Text>
      <Text style={{ color: t.foreground, fontWeight: '800' }}>{value}</Text>
    </View>
  );
}

function AccountMetric({
  label,
  value,
  locked,
}: {
  label: string;
  value: string;
  locked?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
        {locked ? <Ionicons name="lock-closed-outline" size={12} color={t.mutedForeground} /> : null}
        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.sm }}>{value}</Text>
      </View>
    </View>
  );
}

function PostRow({ post, onPress }: { post: AnalyticsPost; onPress: () => void }) {
  const t = useTheme();
  const thumb =
    post.thumbnailUrl || (Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : null);
  return (
    <Pressable onPress={onPress} style={[styles.postRow, { borderBottomColor: t.border }]}>
      {thumb ? (
        <Image source={{ uri: getFullUrl(thumb) }} style={styles.postThumb} />
      ) : (
        <View style={[styles.postThumb, { backgroundColor: t.muted, alignItems: 'center', justifyContent: 'center' }]}>
          <Ionicons
            name={post.mediaType === 'video' || post.mediaType === 'reel' ? 'play' : 'image-outline'}
            size={18}
            color={t.mutedForeground}
          />
        </View>
      )}
      <View style={{ flex: 1, gap: 4 }}>
        <Text style={{ color: t.foreground, fontWeight: '600' }} numberOfLines={2}>
          {post.caption?.trim() || 'Untitled post'}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, alignItems: 'center' }}>
          {(post.destinations || []).slice(0, 4).map((d, i) => {
            const icon = platformIconSource(d.platform);
            return icon ? (
              <Image key={`${d.platform}-${i}`} source={icon} style={{ width: 12, height: 12 }} />
            ) : null;
          })}
          {post.mediaType ? <Badge label={post.mediaType} /> : null}
          {post.isVerified ? <Badge label="Verified" tone="success" /> : null}
          {post.source === 'both' ? <Badge label="Verified by export" tone="success" /> : null}
          {post.source === 'imported' ? <Badge label="Imported" /> : null}
        </View>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={1}>
          {formatDate(post.publishedAt)} · {fmtN(post.likes)} likes · {fmtN(post.comments)} comments
          · {fmtN(post.engagement)} eng · {fmtPct(post.engagementRate)}
        </Text>
      </View>
      <View style={{ gap: 8, alignItems: 'center' }}>
        {post.link ? (
          <Pressable onPress={() => Linking.openURL(post.link!)} hitSlop={8}>
            <Ionicons name="open-outline" size={18} color={t.primary} />
          </Pressable>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
      </View>
    </Pressable>
  );
}

function deltaSub(n?: number | null): string | undefined {
  if (n == null || !Number.isFinite(n)) return undefined;
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(1)}% vs prev`;
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  filterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  actionsRow: { flexDirection: 'row', gap: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row2: { flexDirection: 'row', gap: spacing.sm },
  tabBody: { gap: spacing.md, marginTop: spacing.md },
  sectionLabel: { fontWeight: '700', fontSize: fontSize.sm },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpiCard: {
    width: '48%',
    flexGrow: 1,
    minWidth: 140,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    gap: 4,
  },
  kpiTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardTitle: { fontWeight: '700', marginBottom: spacing.sm },
  cardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  compareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  delta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: radius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statTriple: { flexDirection: 'row', gap: spacing.md, marginVertical: spacing.sm },
  typeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  platformRow: {
    gap: 4,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  metricRow3: { flexDirection: 'row', gap: spacing.sm },
  postRow: {
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
  },
  postThumb: { width: 56, height: 56, borderRadius: radius.md },
});

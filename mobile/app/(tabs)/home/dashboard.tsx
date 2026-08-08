import React, { useCallback, useState } from 'react';
import {
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient as SvgGrad,
  Path,
  Stop,
  Text as SvgTextEl,
} from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Badge,
  Button,
  Card,
  ProgressBar,
  SegmentedControl,
  DashboardSkeleton,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { dueLabel, parseLocalDate, type TrajectoryView } from '../../../lib/dashboard-math';
import { formatDate, formatMajorMoney, relativeTime } from '../../../lib/format';
import { brand, fontSize, radius, spacing } from '../../../constants/theme';
import { pressScale } from '../../../constants/motion';
import { type } from '../../../constants/typography';
import { PressableScale } from '../../../components/ui/PressableScale';

export default function HomeScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const dash = useDashboardData();
  const m = dash.metrics;
  const money = (n: number) => formatMajorMoney(n, dash.currency);
  const isNarrow = width < 420;
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await dash.refresh();
    } finally {
      setRefreshing(false);
    }
  }, [dash.refresh]);

  const refreshControl = (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      tintColor="#FFFFFF"
      colors={[brand.purple]}
      progressBackgroundColor="#FFFFFF"
      progressViewOffset={Platform.OS === 'android' ? insets.top : undefined}
    />
  );

  if (dash.isLoading) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={{ paddingTop: insets.top + spacing.md }}
      >
        <DashboardSkeleton />
      </ScrollView>
    );
  }

  if (dash.isStaffView) {
    return (
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={{
          paddingBottom: spacing.xxl + insets.bottom + 8,
          gap: 28,
        }}
        alwaysBounceVertical
        refreshControl={refreshControl}
      >
        <Hero
          greeting={dash.greeting}
          firstName={dash.firstName}
          todayLabel={dash.todayLabel}
          roleLabel={dash.roleLabel}
          unread={dash.unread}
          onBell={() => router.navigate('/(tabs)/home/notifications')}
          topInset={insets.top}
        />

        <Section title="At a glance" pad>
          <View style={styles.kpiGrid}>
            {dash.permissions.canReadProjects ? (
              <KpiCard
                label="Projects"
                value={String(m.activeProjectsCount)}
                hint="Active now"
                icon="briefcase-outline"
                tone="purple"
              />
            ) : null}
            {dash.permissions.canReadCalendar ? (
              <KpiCard
                label="Coming up"
                value={String(m.upcomingEvents.length)}
                hint="Next 14 days"
                icon="calendar-outline"
                tone="gold"
              />
            ) : null}
            {dash.permissions.canReadClients ? (
              <KpiCard
                label="Clients"
                value={String(m.activeClientsCount)}
                hint="In your book"
                icon="people-outline"
                tone="purple"
              />
            ) : dash.permissions.canReadTeam ? (
              <KpiCard
                label="Team"
                value={String(m.activeTeamCount)}
                hint="Available"
                icon="person-outline"
                tone="gold"
              />
            ) : null}
          </View>
        </Section>

        <QuickActions
          actions={[
            dash.permissions.canReadProjects && {
              label: 'Projects',
              icon: 'folder-outline' as const,
              onPress: () => router.navigate('/(tabs)/more/projects'),
            },
            dash.permissions.canReadCalendar && {
              label: 'Calendar',
              icon: 'calendar-outline' as const,
              onPress: () => router.navigate('/(tabs)/more/calendar'),
            },
            dash.permissions.canWriteEmail && {
              label: 'Email',
              icon: 'mail-outline' as const,
              onPress: () => router.navigate('/(tabs)/more/email'),
            },
            dash.permissions.canWriteSocial && {
              label: 'Social',
              icon: 'share-social-outline' as const,
              onPress: () => router.navigate('/(tabs)/social'),
            },
            dash.permissions.canWriteTransfer && {
              label: 'Files',
              icon: 'cloud-upload-outline' as const,
              onPress: () => router.navigate('/(tabs)/more/transfers'),
            },
            dash.permissions.canWriteExpense && {
              label: 'Add Expense',
              icon: 'wallet-outline' as const,
              onPress: () => router.push('/expense/add'),
            },
            dash.permissions.canReadClients && {
              label: 'Clients',
              icon: 'people-outline' as const,
              onPress: () => router.navigate('/(tabs)/clients'),
            },
          ].filter(Boolean) as ActionItem[]}
        />

        <NeedsAttention
          upcoming={m.upcomingEvents}
          projects={m.activeProjects}
          warnings={[]}
          quarterly={null}
          money={money}
          onInvoice={(id) => router.push(`/invoice/${id}`)}
        />

        {dash.permissions.canReadTeam ? (
          <Section title="Team" pad>
            <Card style={styles.surfaceCard}>
              <View style={styles.statRow}>
                <MiniStat label="Active" value={m.teamSnapshot.active} />
                <MiniStat label="On leave" value={m.teamSnapshot.onLeave} />
                <MiniStat label="Pending" value={m.teamSnapshot.pending} />
              </View>
              {m.teamSnapshot.workload.length > 0 ? (
                <View style={[styles.listStack, { marginTop: spacing.lg }]}>
                  {m.teamSnapshot.workload.map((w) => (
                    <View key={w.id} style={{ gap: 6 }}>
                      <View style={styles.rowBetween}>
                        <Text style={[styles.listTitle, { flex: 1, color: t.foreground }]} numberOfLines={1}>
                          {w.name}
                        </Text>
                        <Text style={[styles.listMeta, { color: t.mutedForeground }]}>{w.count}</Text>
                      </View>
                      <ProgressBar
                        progress={
                          m.teamSnapshot.maxLoad > 0 ? (w.count / m.teamSnapshot.maxLoad) * 100 : 0
                        }
                        height={5}
                      />
                    </View>
                  ))}
                </View>
              ) : null}
            </Card>
          </Section>
        ) : null}

        <ActivityFeed activities={m.activities} onInvoice={(id) => router.push(`/invoice/${id}`)} />
      </ScrollView>
    );
  }

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: t.background }}
      contentContainerStyle={{
        paddingBottom: spacing.xxl + insets.bottom + 8,
        gap: 28,
      }}
      alwaysBounceVertical
      refreshControl={refreshControl}
    >
      <Hero
        greeting={dash.greeting}
        firstName={dash.firstName}
        todayLabel={dash.todayLabel}
        roleLabel={dash.roleLabel}
        unread={dash.unread}
        onBell={() => router.navigate('/(tabs)/home/notifications')}
        topInset={insets.top}
        primaryAction={
          dash.permissions.canWriteInvoice
            ? {
                label: 'New Invoice',
                onPress: () => router.push('/invoice/add'),
              }
            : undefined
        }
      />

      <Section title="This month" pad>
        <FeaturedMetric
          label="Revenue"
          value={money(m.monthlyRevenue)}
          hint={
            m.monthlyRevenue === 0 && m.lastMonthRevenue > 0
              ? `Last month ${money(m.lastMonthRevenue)}`
              : `${m.growthRate >= 0 ? '+' : ''}${m.growthRate}% vs last month`
          }
          hintTone={m.growthRate >= 0 ? 'success' : 'destructive'}
          onPress={() => router.navigate('/(tabs)/money')}
        />
        <View style={styles.kpiGrid}>
          {dash.expensesAvailable ? (
            <KpiCard
              label="Expenses"
              value={money(m.monthlyExpenses)}
              hint={`${money(m.last3MonthsExpenses)}/mo avg`}
              icon="trending-down-outline"
              tone="danger"
              onPress={() => router.navigate('/(tabs)/money')}
            />
          ) : (
            <KpiCard
              label="MRR"
              value={money(m.activeMrr)}
              hint="Active plans"
              icon="trending-up-outline"
              tone="purple"
            />
          )}
          <KpiCard
            label={dash.expensesAvailable ? 'Net profit' : 'Rev + MRR'}
            value={`${m.netProfitValue < 0 ? '-' : ''}${money(Math.abs(m.netProfitValue))}`}
            hint={
              dash.expensesAvailable
                ? `${Math.abs(m.profitMarginValue)}% margin`
                : 'No expense access'
            }
            hintTone={m.netProfitValue >= 0 ? 'success' : 'destructive'}
            icon="cash-outline"
            tone={m.netProfitValue >= 0 ? 'success' : 'danger'}
            onPress={() => router.navigate('/(tabs)/money')}
          />
          <KpiCard
            label="Outstanding"
            value={money(m.outstandingAmount)}
            hint={m.unpaidCount > 0 ? `${m.unpaidCount} unpaid` : 'All clear'}
            hintTone={m.unpaidCount > 0 ? 'warning' : 'success'}
            icon="time-outline"
            tone="gold"
            onPress={() => router.navigate('/(tabs)/money')}
          />
          {dash.expensesAvailable ? (
            <KpiCard
              label="MRR"
              value={money(m.activeMrr)}
              hint="Recurring"
              icon="repeat-outline"
              tone="purple"
            />
          ) : (
            <KpiCard
              label="Clients"
              value={String(m.activeClientsCount)}
              hint="Active"
              icon="people-outline"
              tone="purple"
              onPress={() => router.navigate('/(tabs)/clients')}
            />
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.chipRow}
        >
          <StatChip
            label="Clients"
            value={String(m.activeClientsCount)}
            onPress={() => router.navigate('/(tabs)/clients')}
          />
          <StatChip label="Projects" value={String(m.activeProjectsCount)} />
          <StatChip label="Subs" value={String(m.activeSubsCount)} />
          {dash.showTeamStat ? (
            <StatChip
              label="Team"
              value={String(m.activeTeamCount)}
              onPress={() => router.navigate('/(tabs)/more/team')}
            />
          ) : null}
          {dash.showLeadsStat ? (
            <StatChip label="Leads" value={String(m.newLeadsThisMonth)} />
          ) : null}
        </ScrollView>
      </Section>

      <QuickActions
        actions={[
          {
            label: 'New Invoice',
            icon: 'document-text-outline' as const,
            tone: 'gold' as const,
            onPress: () => router.push('/invoice/add'),
            enabled: dash.permissions.canWriteInvoice,
          },
          {
            label: 'New Proforma',
            icon: 'create-outline' as const,
            tone: 'orange' as const,
            onPress: () => router.push('/proforma/add'),
            enabled: dash.permissions.canWriteProforma,
          },
          {
            label: 'Add Client',
            icon: 'person-add-outline' as const,
            tone: 'purple' as const,
            onPress: () => router.push('/client/add'),
            enabled: dash.permissions.canWriteClient,
          },
          {
            label: 'New Project',
            icon: 'folder-outline' as const,
            tone: 'purple' as const,
            onPress: () => router.push('/project/add'),
            enabled: dash.permissions.canWriteProject,
          },
          {
            label: 'Add Expense',
            icon: 'wallet-outline' as const,
            tone: 'red' as const,
            onPress: () => router.push('/expense/add'),
            enabled: dash.permissions.canWriteExpense,
          },
          {
            label: 'Schedule Post',
            icon: 'share-social-outline' as const,
            tone: 'purple' as const,
            onPress: () => router.push('/compose'),
            enabled: dash.permissions.canWriteSocial,
          },
          {
            label: 'Analytics',
            icon: 'stats-chart-outline' as const,
            tone: 'gold' as const,
            onPress: () => router.navigate('/(tabs)/social/analyze'),
            enabled: dash.canRead('social_media'),
          },
          {
            label: 'Reports',
            icon: 'bar-chart-outline' as const,
            tone: 'gold' as const,
            onPress: () => router.navigate('/(tabs)/money'),
            enabled: dash.permissions.canReadReports,
          },
        ].filter((a) => a.enabled)}
      />

      <Section
        title="Performance"
        pad
        action={
          dash.permissions.canReadReports ? (
            <Pressable onPress={() => router.navigate('/(tabs)/money')} hitSlop={8}>
              <Text style={styles.linkAction}>See all</Text>
            </Pressable>
          ) : undefined
        }
      >
        <Card style={styles.surfaceCard}>
          <SegmentedControl
            options={[
              { label: 'Day', value: 'daily' },
              { label: 'Week', value: 'weekly' },
              { label: 'Month', value: 'monthly' },
              { label: 'Year', value: 'yearly' },
            ]}
            value={dash.trajectoryView}
            onChange={(v) => dash.setTrajectoryView(v as TrajectoryView)}
          />
          <View style={{ marginTop: spacing.lg }}>
            <TrendChart
              data={m.revenueTrend}
              primary={brand.purple}
              secondary={brand.gold}
              destructive={t.destructive}
              muted={t.muted}
              foreground={t.mutedForeground}
            />
          </View>
          <View style={styles.legend}>
            <LegendDot color={brand.purple} label="Paid" />
            <LegendDot color={t.destructive} label="Expenses" />
            <LegendDot color={brand.gold} label="Recurring" />
          </View>
        </Card>

        <Card style={[styles.surfaceCard, { marginTop: spacing.md }]}>
          <View style={[styles.rowBetween, { marginBottom: spacing.sm }]}>
            <Text style={[styles.cardTitle, { color: t.foreground }]}>Receivables</Text>
            <Text style={[styles.countLabel, { color: t.mutedForeground }]}>{m.unpaidCount}</Text>
          </View>
          {m.receivables.length === 0 ? (
            <View style={styles.emptyBlock}>
              <Ionicons name="checkmark-circle" size={28} color={t.success} />
              <Text style={{ color: t.success, fontWeight: '700', marginTop: spacing.sm }}>
                Nothing outstanding
              </Text>
            </View>
          ) : (
            <View style={styles.listStack}>
              {m.receivables.map((inv, index) => {
                const overdue = inv.status === 'Overdue';
                return (
                  <Pressable
                    key={inv.id}
                    onPress={() => router.push(`/invoice/${inv.id}`)}
                    style={[
                      styles.listRow,
                      index < m.receivables.length - 1 && styles.listRowBorder,
                      { borderBottomColor: t.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.rowIcon,
                        { backgroundColor: overdue ? t.destructive + '14' : t.accent },
                      ]}
                    >
                      <Ionicons
                        name="document-text-outline"
                        size={16}
                        color={overdue ? t.destructive : brand.purple}
                      />
                    </View>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={[styles.listTitle, { color: t.foreground }]} numberOfLines={1}>
                        {inv.client}
                      </Text>
                      <Text
                        style={[
                          styles.listMeta,
                          { color: overdue ? t.destructive : t.mutedForeground },
                        ]}
                      >
                        Due {formatDate(inv.dueDate)}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={[styles.listValue, { color: t.foreground }]}>{money(inv.amount)}</Text>
                      <Badge label={inv.status} tone={overdue ? 'destructive' : 'default'} />
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
          <Pressable
            onPress={() => router.navigate('/(tabs)/money')}
            style={[styles.cardFooter, { borderTopColor: t.border }]}
          >
            <Text style={styles.linkAction}>View all invoices</Text>
            <Ionicons name="chevron-forward" size={16} color={brand.purple} />
          </Pressable>
        </Card>
      </Section>

      <NeedsAttention
        upcoming={m.upcomingEvents}
        projects={m.activeProjects}
        warnings={m.warnings}
        quarterly={m.quarterlyTarget}
        money={money}
        onInvoice={(id) => {
          const invId = id.replace(/^inv-/, '');
          if (id.startsWith('inv-')) router.push(`/invoice/${invId}`);
        }}
      />

      <ActivityFeed
        activities={m.activities}
        onInvoice={(id) => router.push(`/invoice/${id}`)}
        onClient={(id) => router.push(`/client/${id}`)}
      />
    </ScrollView>
  );
}

/* ─── Building blocks ─────────────────────────────────────────────── */

function Hero({
  greeting,
  firstName,
  todayLabel,
  roleLabel,
  unread,
  onBell,
  topInset,
  primaryAction,
}: {
  greeting: string;
  firstName: string;
  todayLabel: string;
  roleLabel: string;
  unread: number;
  onBell: () => void;
  topInset: number;
  primaryAction?: { label: string; onPress: () => void };
}) {
  const t = useTheme();

  /*
   * Plain header on the page background rather than a full-bleed gradient
   * panel. The gradient was the loudest thing on a screen whose job is to
   * report numbers, and it pushed the first real content most of a
   * screenful down. Hierarchy now comes from type size, and the brand colour
   * is spent on the action instead of the backdrop.
   */
  return (
    <View style={[styles.hero, { paddingTop: topInset + spacing.lg }]}>
      <View style={styles.heroBar}>
        <View style={styles.heroGreetingBlock}>
          <Text variant="subtext" color="muted" numberOfLines={1}>
            {greeting} · {todayLabel}
          </Text>
          <Text variant="h1" numberOfLines={1}>
            {firstName}
          </Text>
          <Text variant="caption" color="subtle" numberOfLines={1}>
            {roleLabel}
          </Text>
        </View>

        <Pressable
          onPress={onBell}
          style={[styles.bell, { backgroundColor: t.card, borderColor: t.borderSubtle }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        >
          <Ionicons name="notifications-outline" size={20} color={t.foreground} />
          {unread > 0 ? (
            <View style={[styles.dot, { borderColor: t.background }]}>
              <Text style={styles.dotText}>{unread > 99 ? '99+' : unread}</Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {primaryAction ? (
        <Button
          title={primaryAction.label}
          icon="add"
          size="sm"
          onPress={primaryAction.onPress}
          style={styles.heroCta}
        />
      ) : null}
    </View>
  );
}

type MetricTone = 'purple' | 'gold' | 'success' | 'danger' | 'warning';

function toneColors(tone: MetricTone) {
  switch (tone) {
    case 'gold':
      return { fg: brand.gold, bg: 'rgba(245, 184, 36, 0.16)' };
    case 'success':
      return { fg: '#16A34A', bg: 'rgba(22, 163, 74, 0.12)' };
    case 'danger':
      return { fg: '#E53E3E', bg: 'rgba(229, 62, 62, 0.12)' };
    case 'warning':
      return { fg: '#D97706', bg: 'rgba(217, 119, 6, 0.14)' };
    case 'purple':
    default:
      return { fg: brand.purple, bg: 'rgba(90, 66, 138, 0.12)' };
  }
}

function Section({
  title,
  children,
  pad,
  action,
}: {
  title: string;
  children: React.ReactNode;
  pad?: boolean;
  action?: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.section, pad && styles.sectionPad]}>
      <View style={styles.sectionHeader}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>{title}</Text>
        {action}
      </View>
      {children}
    </View>
  );
}

function FeaturedMetric({
  label,
  value,
  hint,
  hintTone,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'success' | 'destructive' | 'warning';
  onPress?: () => void;
}) {
  const t = useTheme();
  const hintColor =
    hintTone === 'success'
      ? t.success
      : hintTone === 'destructive'
        ? t.destructive
        : hintTone === 'warning'
          ? t.warning
          : t.subtleForeground;

  /*
   * A card like any other, with the figure carrying the emphasis. The purple
   * fill made this the loudest element on screen regardless of what the number
   * said — a headline metric should stand out by being larger, not by being
   * painted a different colour from everything around it.
   */
  return (
    <Card onPress={onPress} style={styles.featuredMetric}>
      <View style={styles.featuredTop}>
        <Text variant="label" color="muted">
          {label}
        </Text>
        <View style={[styles.featuredBadge, { backgroundColor: t.accent }]}>
          <Ionicons name="wallet-outline" size={14} color={t.accentForeground} />
        </View>
      </View>
      <Text style={styles.featuredValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </Text>
      {hint ? (
        <Text variant="caption" style={{ color: hintColor }} numberOfLines={1}>
          {hint}
        </Text>
      ) : null}
    </Card>
  );
}

function KpiCard({
  label,
  value,
  hint,
  hintTone,
  icon,
  tone,
  onPress,
}: {
  label: string;
  value: string;
  hint?: string;
  hintTone?: 'success' | 'destructive' | 'warning';
  icon: keyof typeof Ionicons.glyphMap;
  tone: MetricTone;
  onPress?: () => void;
}) {
  const t = useTheme();
  const colors = toneColors(tone);
  const hintColor =
    hintTone === 'success'
      ? t.success
      : hintTone === 'destructive'
        ? t.destructive
        : hintTone === 'warning'
          ? t.warning
          : t.mutedForeground;

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [styles.kpiPress, pressed && onPress ? { opacity: 0.92 } : null]}
    >
      <View style={[styles.kpiCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[styles.kpiIcon, { backgroundColor: colors.bg }]}>
          <Ionicons name={icon} size={16} color={colors.fg} />
        </View>
        <Text style={[styles.kpiValue, { color: t.foreground }]} numberOfLines={1}>
          {value}
        </Text>
        <Text style={[styles.kpiLabel, { color: t.mutedForeground }]} numberOfLines={1}>
          {label}
        </Text>
        {hint ? (
          <Text style={[styles.kpiHint, { color: hintColor }]} numberOfLines={1}>
            {hint}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function StatChip({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress?: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={[styles.statChip, { backgroundColor: t.card, borderColor: t.border }]}
    >
      <Text style={[styles.statChipValue, { color: t.foreground }]}>{value}</Text>
      <Text style={[styles.statChipLabel, { color: t.mutedForeground }]}>{label}</Text>
    </Pressable>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={styles.miniStat}>
      <Text style={[styles.miniStatValue, { color: t.foreground }]}>{value}</Text>
      <Text style={[styles.miniStatLabel, { color: t.mutedForeground }]}>{label}</Text>
    </View>
  );
}

type ActionItem = {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: MetricTone | 'blue' | 'orange' | 'red' | 'green';
  enabled?: boolean;
};

function actionTone(tone: ActionItem['tone']): MetricTone {
  if (tone === 'red') return 'danger';
  if (tone === 'green') return 'success';
  if (tone === 'gold') return 'gold';
  if (tone === 'orange') return 'warning';
  if (tone === 'purple') return 'purple';
  return 'purple';
}

function QuickActions({ actions }: { actions: ActionItem[] }) {
  const t = useTheme();
  if (!actions.length) return null;
  return (
    <Section title="Shortcuts" pad>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.actionsRail}
      >
        {actions.map((a) => {
          const colors = toneColors(actionTone(a.tone));
          return (
            <Pressable
              key={a.label}
              onPress={a.onPress}
              style={({ pressed }) => [styles.actionItem, pressed && { opacity: 0.85 }]}
            >
              <View style={[styles.actionIcon, { backgroundColor: colors.bg }]}>
                <Ionicons name={a.icon} size={20} color={colors.fg} />
              </View>
              <Text style={[styles.actionLabel, { color: t.foreground }]} numberOfLines={2}>
                {a.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </Section>
  );
}

function NeedsAttention({
  upcoming,
  projects,
  warnings,
  quarterly,
  money,
  onInvoice,
}: {
  upcoming: {
    id: string;
    title: string;
    subtitle: string;
    date: Date;
    tone: string;
  }[];
  projects: { id: string; name: string; dueDate?: string; progress: number }[];
  warnings: {
    id: string;
    client: string;
    progress: number;
    plan: string;
    label: string;
  }[];
  quarterly: {
    progress: number;
    target: number;
    label: string;
    trendText: string;
  } | null;
  money: (n: number) => string;
  onInvoice: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <Section title="Needs attention" pad>
      <Card style={styles.surfaceCard}>
        <View style={styles.blockHeader}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Upcoming</Text>
          <Text style={[styles.countLabel, { color: t.mutedForeground }]}>14 days</Text>
        </View>
        {upcoming.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="calendar-outline" size={22} color={t.mutedForeground} />
            <Text style={[styles.emptyText, { color: t.mutedForeground }]}>Nothing due soon</Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {upcoming.slice(0, 5).map((ev, index) => {
              const due = dueLabel(ev.date);
              return (
                <Pressable
                  key={ev.id}
                  onPress={() => (ev.id.startsWith('inv-') ? onInvoice(ev.id) : undefined)}
                  style={[
                    styles.listRow,
                    index < Math.min(upcoming.length, 5) - 1 && styles.listRowBorder,
                    { borderBottomColor: t.border },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0, marginRight: spacing.sm }}>
                    <Text style={[styles.listTitle, { color: t.foreground }]} numberOfLines={1}>
                      {ev.title}
                    </Text>
                    <Text style={[styles.listMeta, { color: t.mutedForeground }]} numberOfLines={1}>
                      {ev.subtitle}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.dueChip,
                      { backgroundColor: due.overdue ? t.destructive + '14' : t.muted },
                    ]}
                  >
                    <Text
                      style={{
                        color: due.overdue ? t.destructive : t.mutedForeground,
                        fontSize: 11,
                        fontWeight: '700',
                      }}
                    >
                      {due.text}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card style={[styles.surfaceCard, { marginTop: spacing.md }]}>
        <View style={styles.blockHeader}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Projects</Text>
        </View>
        {projects.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="briefcase-outline" size={22} color={t.mutedForeground} />
            <Text style={[styles.emptyText, { color: t.mutedForeground }]}>No active projects</Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {projects.slice(0, 4).map((proj) => {
              const due = proj.dueDate ? dueLabel(parseLocalDate(proj.dueDate) || new Date()) : null;
              const barColor =
                proj.progress >= 50 ? brand.purple : proj.progress < 30 ? t.destructive : brand.gold;
              return (
                <View key={proj.id} style={{ gap: 8 }}>
                  <View style={styles.rowBetween}>
                    <Text style={[styles.listTitle, { flex: 1, color: t.foreground }]} numberOfLines={1}>
                      {proj.name}
                    </Text>
                    {due ? (
                      <Text
                        style={{
                          color: due.overdue ? t.destructive : t.mutedForeground,
                          fontSize: 11,
                          fontWeight: '700',
                        }}
                      >
                        {due.text}
                      </Text>
                    ) : null}
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                    <View style={{ flex: 1 }}>
                      <ProgressBar progress={proj.progress} color={barColor} height={5} />
                    </View>
                    <Text style={[styles.pctLabel, { color: t.mutedForeground }]}>{proj.progress}%</Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </Card>

      <Card style={[styles.surfaceCard, { marginTop: spacing.md }]}>
        <View style={styles.blockHeader}>
          <Text style={[styles.cardTitle, { color: t.foreground }]}>Delivery risks</Text>
        </View>
        {warnings.length === 0 ? (
          <View style={styles.emptyBlock}>
            <Ionicons name="checkmark-circle" size={22} color={t.success} />
            <Text style={[styles.emptyText, { color: t.success }]}>On track</Text>
          </View>
        ) : (
          <View style={styles.listStack}>
            {warnings.map((w) => (
              <View key={w.id} style={{ gap: 6 }}>
                <View style={styles.rowBetween}>
                  <Text style={[styles.listTitle, { flex: 1, color: t.foreground }]} numberOfLines={1}>
                    {w.client}
                  </Text>
                  <Text style={{ color: t.destructive, fontSize: 11, fontWeight: '700' }}>
                    {w.progress}%
                  </Text>
                </View>
                <ProgressBar progress={w.progress} color={t.destructive} height={5} />
                <Text style={[styles.listMeta, { color: t.mutedForeground }]} numberOfLines={1}>
                  {w.plan} · {w.label}
                </Text>
              </View>
            ))}
          </View>
        )}
      </Card>

      {quarterly ? (
        <Card style={[styles.targetCard, { marginTop: spacing.md }]}>
          <View style={styles.rowBetween}>
            <Text variant="h3">Revenue target</Text>
            <Badge label={quarterly.label} tone="default" size="sm" />
          </View>
          <View style={styles.targetValueRow}>
            <Text style={styles.targetPct}>{quarterly.progress}%</Text>
            <Text variant="caption" color="muted" style={styles.targetOf}>
              of {money(quarterly.target)}
            </Text>
          </View>
          <ProgressBar progress={quarterly.progress} height={7} />
          <Text variant="caption" color="muted">
            {quarterly.trendText}
          </Text>
        </Card>
      ) : null}
    </Section>
  );
}

function ActivityFeed({
  activities,
  onInvoice,
  onClient,
}: {
  activities: {
    colorType: string;
    action: string;
    subject: string;
    time: Date;
    invoiceId?: string;
    clientId?: string;
  }[];
  onInvoice?: (id: string) => void;
  onClient?: (id: string) => void;
}) {
  const t = useTheme();
  return (
    <Section title="Activity" pad>
      <Card style={[styles.surfaceCard, { paddingVertical: spacing.xs, paddingHorizontal: 0 }]}>
        {activities.length === 0 ? (
          <Text style={[styles.emptyText, { color: t.mutedForeground, textAlign: 'center', padding: spacing.xl }]}>
            No recent activity yet
          </Text>
        ) : (
          activities.map((act, i) => {
            const isClient = act.colorType === 'primary';
            return (
              <Pressable
                key={`${act.subject}-${i}`}
                onPress={() => {
                  if (act.invoiceId && onInvoice) onInvoice(act.invoiceId);
                  else if (act.clientId && onClient) onClient(act.clientId);
                }}
                style={[
                  styles.activityRow,
                  i < activities.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: t.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.rowIcon,
                    {
                      borderRadius: 999,
                      backgroundColor: isClient ? 'rgba(90, 66, 138, 0.12)' : 'rgba(245, 184, 36, 0.16)',
                    },
                  ]}
                >
                  <Ionicons
                    name={isClient ? 'person-add-outline' : 'checkmark-circle'}
                    size={16}
                    color={isClient ? brand.purple : brand.gold}
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.listTitle, { color: t.foreground }]} numberOfLines={1}>
                    {act.subject}
                  </Text>
                  <Text style={[styles.listMeta, { color: t.mutedForeground }]}>{act.action}</Text>
                </View>
                <Text style={[styles.timeLabel, { color: t.mutedForeground }]}>
                  {relativeTime(act.time)}
                </Text>
              </Pressable>
            );
          })
        )}
      </Card>
    </Section>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
      <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '600' }}>{label}</Text>
    </View>
  );
}

function TrendChart({
  data,
  primary,
  secondary,
  destructive,
  muted,
  foreground,
}: {
  data: { label: string; paid: number; recurring: number; expenses: number }[];
  primary: string;
  secondary: string;
  destructive: string;
  muted: string;
  foreground: string;
}) {
  const w = 340;
  const h = 200;
  const padL = 36;
  const padR = 10;
  const padT = 14;
  const padB = 28;
  const innerW = w - padL - padR;
  const innerH = h - padT - padB;

  const rawMax = Math.max(1, ...data.flatMap((d) => [d.paid, d.recurring, d.expenses]));
  // Nice ceiling so Y ticks read cleanly (e.g. 400k for a 280k peak)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
  const maxVal = Math.ceil(rawMax / magnitude) * magnitude || 1;

  const formatTick = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(v % 1_000_000 === 0 ? 0 : 1)}M`;
    if (v >= 1000) return `${Math.round(v / 1000)}k`;
    return String(Math.round(v));
  };

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
    p,
    label: formatTick(maxVal * p),
    y: padT + innerH * (1 - p),
  }));

  const xAt = (i: number) =>
    padL + (data.length <= 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padT + innerH - (v / maxVal) * innerH;

  const toPath = (key: 'paid' | 'recurring' | 'expenses') => {
    if (!data.length) return '';
    return data
      .map((d, i) => {
        const x = xAt(i);
        const y = yAt(d[key]);
        return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const areaPath = (() => {
    if (!data.length) return '';
    const line = toPath('paid');
    const lastX = xAt(data.length - 1);
    const firstX = xAt(0);
    return `${line} L${lastX},${padT + innerH} L${firstX},${padT + innerH} Z`;
  })();

  // Show every month label when monthly (≤12), otherwise ends + mid
  const labels =
    data.length <= 12
      ? data.map((d, i) => ({ label: d.label, i }))
      : [0, Math.floor(data.length / 2), data.length - 1].map((i) => ({
          label: data[i]?.label || '',
          i,
        }));

  return (
    <Svg width="100%" height={h} viewBox={`0 0 ${w} ${h}`}>
      <Defs>
        <SvgGrad id="paidFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={primary} stopOpacity={0.18} />
          <Stop offset="100%" stopColor={primary} stopOpacity={0} />
        </SvgGrad>
        <SvgGrad id="expFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor={destructive} stopOpacity={0.12} />
          <Stop offset="100%" stopColor={destructive} stopOpacity={0} />
        </SvgGrad>
      </Defs>
      {yTicks.map(({ p, label, y }) => (
        <G key={p}>
          <Path
            d={`M${padL},${y} L${padL + innerW},${y}`}
            stroke={muted}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
          <SvgTextEl
            x={padL - 6}
            y={y + 3}
            fill={foreground}
            fontSize={9}
            fontWeight="600"
            textAnchor="end"
            opacity={0.55}
          >
            {label}
          </SvgTextEl>
        </G>
      ))}
      {areaPath ? <Path d={areaPath} fill="url(#paidFill)" /> : null}
      <Path d={toPath('paid')} stroke={primary} strokeWidth={2.5} fill="none" />
      <Path d={toPath('expenses')} stroke={destructive} strokeWidth={2} fill="none" />
      <Path
        d={toPath('recurring')}
        stroke={secondary}
        strokeWidth={2}
        fill="none"
        strokeDasharray="4 4"
      />
      {labels.map(({ label, i }) => (
        <SvgTextEl
          key={`${label}-${i}`}
          x={xAt(i)}
          y={h - 8}
          fill={foreground}
          fontSize={9}
          fontWeight="600"
          textAnchor="middle"
          opacity={0.55}
        >
          {label}
        </SvgTextEl>
      ))}
      {data.length > 0 ? (
        <Circle
          cx={xAt(data.length - 1)}
          cy={yAt(data[data.length - 1].paid)}
          r={3.5}
          fill={primary}
        />
      ) : null}
    </Svg>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingHorizontal: spacing.gutter,
    paddingBottom: spacing.md,
    gap: spacing.lg,
  },
  heroBar: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  heroGreetingBlock: {
    flex: 1,
    gap: 2,
    paddingRight: spacing.md,
  },
  heroCta: {
    alignSelf: 'flex-start',
  },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  dot: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    // Ringed in the page colour so the badge reads as sitting on the bell.
    borderWidth: 2,
  },
  dotText: {
    ...type.overline,
    color: brand.ink,
    fontSize: 10,
    letterSpacing: 0,
  },
  section: { gap: spacing.md },
  sectionPad: { paddingHorizontal: spacing.gutter },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 28,
  },
  sectionTitle: {
    ...type.h3,
  },
  linkAction: {
    ...type.label,
    color: brand.purple,
  },
  featuredMetric: {
    gap: 8,
  },
  featuredTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  featuredBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  featuredValue: {
    ...type.display,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  kpiPress: {
    width: '48%',
    flexGrow: 1,
    flexBasis: '47%',
  },
  kpiCard: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    gap: 6,
    minHeight: 118,
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  kpiLabel: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  kpiHint: {
    fontSize: 11,
    fontWeight: '600',
  },
  chipRow: {
    gap: 10,
    paddingRight: spacing.lg,
  },
  statChip: {
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
    gap: 2,
  },
  statChipValue: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  statChipLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  actionsRail: {
    gap: 14,
    paddingRight: spacing.lg,
  },
  actionItem: {
    width: 76,
    alignItems: 'center',
    gap: 8,
  },
  actionIcon: {
    width: 54,
    height: 54,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 14,
  },
  surfaceCard: {
    borderRadius: 18,
    padding: spacing.lg,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  blockHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  countLabel: {
    fontSize: 12,
    fontWeight: '700',
  },
  listStack: { gap: spacing.md },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: 2,
  },
  listRowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingBottom: spacing.md,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  listTitle: {
    fontWeight: '700',
    fontSize: fontSize.sm,
  },
  listMeta: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  listValue: {
    fontWeight: '800',
    fontSize: fontSize.sm,
  },
  dueChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.full,
  },
  pctLabel: {
    fontSize: 11,
    fontWeight: '700',
    width: 34,
    textAlign: 'right',
  },
  cardFooter: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: 6,
  },
  emptyText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
  },
  targetCard: {
    gap: spacing.md,
  },
  targetValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  targetPct: {
    ...type.display,
  },
  targetOf: {
    marginBottom: 7,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
  },
  timeLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  miniStat: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  miniStatValue: {
    fontWeight: '800',
    fontSize: fontSize.xl,
  },
  miniStatLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  statRow: { flexDirection: 'row', gap: spacing.md },
});

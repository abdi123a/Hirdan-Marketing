import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from '../../../components/ui/ScrollView';
import {
  Badge,
  Card,
  FadeIn,
  Icon,
  ListRow,
  PressableScale,
  SearchBar,
  Text,
  type IconName,
} from '../../../components/ui';
import {
  FEATURES,
  FEATURE_GROUPS,
  FEATURE_TINTS,
  type Feature,
} from '../../../constants/features';
import { brand, radius, spacing } from '../../../constants/theme';
import { pressScale } from '../../../constants/motion';
import { type } from '../../../constants/typography';
import { useElevation, useTheme } from '../../../hooks/useTheme';
import { usePermissions } from '../../../hooks/usePermissions';
import { useDashboardData } from '../../../hooks/useDashboardData';
import { formatMajorMoney } from '../../../lib/format';
import { dueLabel } from '../../../lib/dashboard-math';

/** Columns in the service grid. Four is what makes the pattern scannable. */
const COLUMNS = 4;
/** Panel side padding, kept small so the grid spans the full width. */
const PANEL_PAD = 6;
/** How far the card sits into the coloured header. */
const CARD_OVERLAP = 56;
/**
 * Super-app home.
 *
 * Follows the anatomy the pattern has converged on — coloured header with
 * greeting and search, a money card straddling its lower edge, a dense grid of
 * services, then content below. The overlap is what makes it read as one
 * composition rather than a header with a card under it, and it puts the
 * number people open the app for above the fold.
 *
 * Unlike the rest of the app this screen keeps its own dock (see the `home`
 * entry in `constants/features.ts`), so the primary destinations stay reachable
 * from the root.
 */
export default function HomeScreen() {
  const t = useTheme();
  const shadows = useElevation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { canRead } = usePermissions();
  const dash = useDashboardData();
  const [query, setQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const m = dash.metrics;
  const money = (n: number) => formatMajorMoney(n, dash.currency);

  const visible = useMemo(
    () => FEATURES.filter((f) => !f.hiddenFromLauncher && f.isVisible(canRead)),
    [canRead],
  );

  const needle = query.trim().toLowerCase();
  const matches = useMemo(
    () =>
      needle
        ? visible.filter(
            (f) =>
              f.label.toLowerCase().includes(needle) ||
              f.blurb.toLowerCase().includes(needle),
          )
        : [],
    [visible, needle],
  );

  const groups = useMemo(
    () =>
      FEATURE_GROUPS.map((g) => ({
        ...g,
        items: visible.filter((f) => f.group === g.key),
      })).filter((g) => g.items.length > 0),
    [visible],
  );

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await dash.refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const open = (feature: Feature) => router.push(feature.href as never);
  const canSeeMoney = canRead('invoices');

  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor="#FFFFFF"
            colors={[brand.purple]}
            progressViewOffset={insets.top}
          />
        }
      >
        {/* One flat brand colour — no gradient blend — running deep enough
            for the card to sit into rather than merely below it. */}
        <View
          style={[
            styles.headerWrap,
            { paddingTop: insets.top + spacing.lg, backgroundColor: brand.purple },
          ]}
        >
          <View style={styles.headerRow}>
            <View style={styles.headerText}>
              <Text variant="subtext" style={styles.headerGreeting} numberOfLines={1}>
                {dash.greeting}
              </Text>
              <Text variant="h1" style={styles.headerName} numberOfLines={1}>
                {dash.firstName}
              </Text>
            </View>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                dash.unread > 0 ? `Notifications, ${dash.unread} unread` : 'Notifications'
              }
              hitSlop={10}
              onPress={() => router.push('/(tabs)/home/notifications')}
              style={styles.bell}
            >
              <Icon name="notifications" size={21} color="#FFFFFF" />
              {dash.unread > 0 ? (
                <View style={[styles.bellDot, { borderColor: brand.purple }]}>
                  <Text style={styles.bellDotText}>
                    {dash.unread > 99 ? '99+' : dash.unread}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          </View>

          <SearchBar
            value={query}
            onChangeText={setQuery}
            placeholder="Search features…"
          />
        </View>

        {/* The screen's anchor: taller, with room for the figure to breathe
            and the actions to sit as a proper row rather than a cramped strip. */}
        <View style={styles.cardLayer}>
          <Card elevation="lg" style={styles.moneyCard}>
            <View style={styles.moneyTop}>
              <View style={styles.moneyHeading}>
                <Text variant="label" color="muted" uppercase>
                  Revenue this month
                </Text>
                <Text style={[styles.moneyValue, { color: t.foreground }]} numberOfLines={1} adjustsFontSizeToFit>
                  {canSeeMoney ? money(m.monthlyRevenue) : '—'}
                </Text>
              </View>
              {canSeeMoney && Number.isFinite(m.growthRate) && m.growthRate !== 0 ? (
                <Badge
                  label={`${m.growthRate > 0 ? '+' : ''}${Math.round(m.growthRate)}%`}
                  tone={m.growthRate >= 0 ? 'success' : 'destructive'}
                  icon={m.growthRate >= 0 ? 'trending-up' : 'trending-down'}
                  size="sm"
                />
              ) : null}
            </View>

            <View style={[styles.moneyStats, { borderTopColor: t.borderSubtle }]}>
              <MoneyStat label="Outstanding" value={canSeeMoney ? money(m.outstandingAmount) : '—'} />
              <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />
              <MoneyStat label="Expenses" value={canSeeMoney ? money(m.monthlyExpenses) : '—'} />
              <View style={[styles.divider, { backgroundColor: t.borderSubtle }]} />
              <MoneyStat
                label="Unpaid"
                value={canSeeMoney ? String(m.unpaidCount) : '—'}
                tone={m.unpaidCount > 0 ? 'warning' : undefined}
              />
            </View>

            <View style={[styles.quickRow, { borderTopColor: t.borderSubtle }]}>
              <QuickAction
                icon="receipt_long"
                label="Invoice"
                onPress={() => router.push('/invoice/add')}
              />
              <QuickAction
                icon="payments"
                label="Expense"
                onPress={() => router.push('/expense/add')}
              />
              <QuickAction
                icon="bar_chart"
                label="Reports"
                onPress={() => router.push('/(tabs)/more/reports')}
              />
              <QuickAction
                icon="space_dashboard"
                label="Dashboard"
                onPress={() => router.push('/(tabs)/home/dashboard')}
              />
            </View>
          </Card>
        </View>

        {/* Services */}
        {needle ? (
          <View style={styles.section}>
            <Panel>
              {matches.length > 0 ? (
                <Grid items={matches} onOpen={open} />
              ) : (
                <View style={styles.noResults}>
                  <Text variant="body" color="muted" center>
                    Nothing matches “{query.trim()}”.
                  </Text>
                </View>
              )}
            </Panel>
          </View>
        ) : (
          groups.map((group, gi) => (
            <FadeIn key={group.key} index={gi} style={styles.section}>
              <Text variant="overline" color="muted" uppercase style={styles.sectionTitle}>
                {group.label}
              </Text>
              <Panel>
                <Grid items={group.items} onOpen={open} />
              </Panel>
            </FadeIn>
          ))
        )}

        {/* Content feed — the part that makes a home screen worth returning to
            rather than a menu you pass through. */}
        {!needle && m.upcomingEvents.length > 0 ? (
          <FadeIn index={groups.length} style={styles.section}>
            <View style={styles.sectionHead}>
              <Text variant="overline" color="muted" uppercase>
                Coming up
              </Text>
              <Pressable onPress={() => router.push('/(tabs)/more/calendar')} hitSlop={8}>
                <Text variant="label" color="primary">
                  See all
                </Text>
              </Pressable>
            </View>
            <Card padded={false} style={styles.feedCard}>
              {m.upcomingEvents.slice(0, 3).map((event, i, arr) => {
                const due = dueLabel(event.date);
                return (
                  <ListRow
                    key={event.id}
                    title={event.title}
                    subtitle={event.subtitle || undefined}
                    divider={i < arr.length - 1}
                    left={
                      <View style={[styles.feedIcon, { backgroundColor: t.accent }]}>
                        <Icon name="event" size={18} color={t.accentForeground} />
                      </View>
                    }
                    right={
                      <Badge
                        label={due.text}
                        tone={due.overdue ? 'destructive' : 'neutral'}
                        size="sm"
                      />
                    }
                    onPress={() => router.push('/(tabs)/more/calendar')}
                  />
                );
              })}
            </Card>
          </FadeIn>
        ) : null}
      </ScrollView>
    </View>
  );

  function Panel({ children }: { children: React.ReactNode }) {
    return (
      <View
        style={[
          styles.panel,
          { backgroundColor: t.card, borderColor: t.borderSubtle },
          shadows.sm,
        ]}
      >
        {children}
      </View>
    );
  }
}

function MoneyStat({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: 'warning';
}) {
  return (
    <View style={styles.moneyStat}>
      <Text
        variant="bodyStrong"
        color={tone === 'warning' ? 'warning' : 'default'}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      <Text variant="caption" color="subtle" numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      scaleTo={pressScale.control}
      onPress={onPress}
      style={styles.quickAction}
    >
      <View style={[styles.quickIcon, { backgroundColor: t.accent }]}>
        <Icon name={icon} size={20} color={t.accentForeground} />
      </View>
      <Text variant="caption" color="muted" numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

function Grid({ items, onOpen }: { items: Feature[]; onOpen: (f: Feature) => void }) {
  const { width } = useWindowDimensions();
  // Derived rather than a percentage, so a partly-filled last row still lines
  // up with the columns above it.
  const cell = Math.floor((width - spacing.gutter * 2 - PANEL_PAD * 2) / COLUMNS);

  return (
    <View style={styles.grid}>
      {items.map((feature) => (
        <FeatureTile
          key={feature.key}
          feature={feature}
          width={cell}
          onPress={() => onOpen(feature)}
        />
      ))}
    </View>
  );
}

function FeatureTile({
  feature,
  width,
  onPress,
}: {
  feature: Feature;
  width: number;
  onPress: () => void;
}) {
  const tint = FEATURE_TINTS[feature.key] ?? brand.purple;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${feature.label}. ${feature.blurb}`}
      scaleTo={pressScale.control}
      onPress={onPress}
      style={[styles.tile, { width }]}
    >
      <View style={[styles.tileGlow, { shadowColor: tint, backgroundColor: tint }]}>
        <View style={[styles.tileIcon, { backgroundColor: tint }]}>
          {/* Specular highlight across the top edge. */}
          <View pointerEvents="none" style={styles.tileSheen} />
          <Icon name={feature.icon} size={27} color="#FFFFFF" />
        </View>
      </View>

      <Text variant="caption" center numberOfLines={2} style={styles.tileLabel}>
        {feature.label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    // Clears the dock, which floats over the content.
    paddingBottom: 148,
  },
  headerWrap: {
    paddingHorizontal: spacing.gutter,
    // Runs well past the search field so the card overlaps colour, not edge.
    paddingBottom: CARD_OVERLAP + spacing.xxl,
    gap: spacing.lg,
    borderBottomLeftRadius: radius.xxl,
    borderBottomRightRadius: radius.xxl,
  },
  headerGreeting: { color: 'rgba(255,255,255,0.8)' },
  headerName: { color: '#FFFFFF' },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  headerText: { flex: 1, gap: 1 },
  bell: {
    width: 44,
    height: 44,
    borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    backgroundColor: brand.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  bellDotText: {
    ...type.overline,
    color: brand.ink,
    fontSize: 10,
    letterSpacing: 0,
  },
  cardLayer: {
    paddingHorizontal: spacing.gutter,
    marginTop: -CARD_OVERLAP,
  },
  moneyCard: {
    gap: spacing.xl,
    paddingVertical: spacing.xl,
  },
  moneyHeading: { flex: 1, gap: 3 },
  moneyTop: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  moneyValue: { ...type.display },
  moneyStats: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
  },
  moneyStat: { flex: 1, gap: 1 },
  divider: { width: StyleSheet.hairlineWidth, height: 34 },
  quickRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.lg,
  },
  quickAction: { alignItems: 'center', gap: 6, flex: 1 },
  quickIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  section: {
    marginTop: spacing.xl,
    paddingHorizontal: spacing.gutter,
    gap: spacing.sm,
  },
  sectionTitle: { paddingHorizontal: spacing.xs },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
  panel: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.lg,
    // Tight, so the four columns use the full panel width instead of
    // leaving a dead margin down each side.
    paddingHorizontal: PANEL_PAD,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  tile: { alignItems: 'center', gap: spacing.sm },
  tileGlow: {
    width: 56,
    height: 56,
    borderRadius: 18,
    // Coloured drop shadow, so each tile sits on its own pool of light.
    shadowOpacity: 0.34,
    shadowRadius: 9,
    shadowOffset: { width: 0, height: 4 },
    elevation: 5,
  },
  tileIcon: {
    width: 56,
    height: 56,
    // Squircle rather than a circle — closer to a real app icon.
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  tileSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '46%',
    backgroundColor: 'rgba(255,255,255,0.17)',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
  },
  tileLabel: { paddingHorizontal: 2 },
  feedCard: { overflow: 'hidden' },
  feedIcon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  noResults: { paddingVertical: spacing.xl },
});

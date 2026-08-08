import React, { useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useRouter } from 'expo-router';
import { useQueries } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { formatDate, formatMoney, moneyAmount, unwrapList } from '../../../lib/format';
import { projectClientLabel, projectFromApi } from '../../../lib/projects';
import { Badge, EmptyState, ListSkeleton, Sheet } from '../../../components/ui';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../constants/theme';

type CalEvent = {
  id: string;
  entityId: string;
  title: string;
  subtitle: string;
  date: string;
  type: 'Deadline' | 'Invoice' | 'Subscription End';
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}

function typeTone(type: CalEvent['type']): 'destructive' | 'warning' | 'gold' | 'default' {
  if (type === 'Deadline') return 'destructive';
  if (type === 'Invoice') return 'warning';
  return 'gold';
}

export default function CalendarScreen() {
  const t = useTheme();
  const router = useRouter();
  const { canRead, canWrite } = usePermissions();
  const [cursor, setCursor] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);

  const results = useQueries({
    queries: [
      {
        queryKey: ['calendar-projects'],
        enabled: canRead('projects') || canRead('calendar'),
        queryFn: async () => {
          const res = await apiFetch<unknown>(`${endpoints.projects.list}?take=200`);
          return unwrapList(res).map((p) => projectFromApi(p));
        },
      },
      {
        queryKey: ['calendar-invoices'],
        enabled: canRead('invoices') || canRead('calendar'),
        queryFn: async () => {
          const res = await apiFetch<unknown>(`${endpoints.invoices.list}?take=200`);
          return unwrapList(res);
        },
      },
      {
        queryKey: ['calendar-subscriptions'],
        enabled: canRead('subscriptions') || canRead('calendar'),
        queryFn: async () => {
          const res = await apiFetch<unknown>(`${endpoints.subscriptions.list}?take=200`);
          return unwrapList(res);
        },
      },
    ],
  });

  const [projectsQ, invoicesQ, subscriptionsQ] = results;
  const isLoading = results.some((q) => q.isLoading);
  const isRefetching = results.some((q) => q.isRefetching);
  const error = results.find((q) => q.error)?.error;

  const events = useMemo(() => {
    const all: CalEvent[] = [];
    for (const p of projectsQ.data || []) {
      const status = String(p.status || '')
        .toUpperCase()
        .replace(/\s+/g, '_');
      if (!p.dueDate || status === 'COMPLETED' || status === 'ARCHIVED') continue;
      all.push({
        id: `proj-${p.id}`,
        entityId: p.id,
        title: p.name,
        subtitle: projectClientLabel(p),
        date: String(p.dueDate).split('T')[0],
        type: 'Deadline',
      });
    }
    for (const inv of (invoicesQ.data || []) as any[]) {
      const status = String(inv.status || '');
      if (!inv.dueDate || status.toLowerCase() === 'paid') continue;
      const client =
        inv.client?.company || inv.client?.name || inv.clientName || 'Client';
      all.push({
        id: `inv-${inv.id}`,
        entityId: inv.id,
        title: `Invoice due · ${formatMoney(moneyAmount(inv))}`,
        subtitle: String(client),
        date: String(inv.dueDate).split('T')[0],
        type: 'Invoice',
      });
    }
    for (const sub of (subscriptionsQ.data || []) as any[]) {
      const status = String(sub.status || '');
      if (!sub.endDate || sub.endDate === 'N/A' || status.toLowerCase() !== 'active') continue;
      const client =
        sub.client?.company || sub.client?.name || sub.clientName || 'Client';
      all.push({
        id: `sub-${sub.id}`,
        entityId: sub.id,
        title: `Subscription ends · ${sub.plan || sub.package?.name || 'Plan'}`,
        subtitle: String(client),
        date: String(sub.endDate).split('T')[0],
        type: 'Subscription End',
      });
    }
    return all.sort((a, b) => a.date.localeCompare(b.date));
  }, [projectsQ.data, invoicesQ.data, subscriptionsQ.data]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startBlank = new Date(year, month, 1).getDay();
  const todayIso = isoDay(new Date());
  const monthPrefix = `${year}-${String(month + 1).padStart(2, '0')}`;

  const monthEvents = useMemo(
    () => events.filter((e) => e.date.startsWith(monthPrefix)),
    [events, monthPrefix]
  );

  const selectedEvents = selectedDay
    ? events.filter((e) => e.date === selectedDay)
    : [];

  const openEvent = (ev: CalEvent) => {
    setSelectedDay(null);
    if (ev.type === 'Deadline') {
      router.push(`/project/${ev.entityId}`);
    } else if (ev.type === 'Invoice') {
      router.push(`/invoice/${ev.entityId}`);
    } else {
      router.push(`/subscription/${ev.entityId}`);
    }
  };

  const refetch = () => {
    projectsQ.refetch();
    invoicesQ.refetch();
    subscriptionsQ.refetch();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <ListSkeleton rows={8} padding={spacing.lg} />
      </View>
    );
  }

  if (error) {
    return (
      <EmptyState
        title="Could not load calendar"
        description={(error as Error).message}
        actionLabel="Retry"
        onAction={refetch}
        icon="calendar-outline"
      />
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: t.background }]}>
      <ScrollView
        contentContainerStyle={{ paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
        }
      >
        <View style={styles.toolbar}>
          <Pressable
            onPress={() => setCursor(new Date(year, month - 1, 1))}
            style={[styles.navBtn, { borderColor: t.border, backgroundColor: t.card }]}
          >
            <Ionicons name="chevron-back" size={18} color={t.foreground} />
          </Pressable>
          <Text style={{ color: t.foreground, fontSize: fontSize.lg, fontWeight: '800', flex: 1, textAlign: 'center' }}>
            {monthLabel(cursor)}
          </Text>
          <Pressable
            onPress={() => setCursor(new Date(year, month + 1, 1))}
            style={[styles.navBtn, { borderColor: t.border, backgroundColor: t.card }]}
          >
            <Ionicons name="chevron-forward" size={18} color={t.foreground} />
          </Pressable>
          {(canWrite('projects') || canWrite('invoices') || canWrite('subscriptions')) && (
            <Pressable
              onPress={() => setAddOpen(true)}
              style={[styles.addBtn, { backgroundColor: t.primary }]}
            >
              <Ionicons name="add" size={18} color={t.primaryForeground} />
            </Pressable>
          )}
        </View>

        <View style={[styles.gridCard, { backgroundColor: t.card, borderColor: t.border }]}>
          <View style={styles.weekRow}>
            {DAYS.map((d) => (
              <Text key={d} style={[styles.weekLabel, { color: t.mutedForeground }]}>
                {d}
              </Text>
            ))}
          </View>
          <View style={styles.daysGrid}>
            {Array.from({ length: startBlank }).map((_, i) => (
              <View key={`b-${i}`} style={styles.dayCell} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => {
              const day = i + 1;
              const dateStr = `${monthPrefix}-${String(day).padStart(2, '0')}`;
              const dayEvents = events.filter((e) => e.date === dateStr);
              const isToday = dateStr === todayIso;
              const isSelected = dateStr === selectedDay;
              return (
                <Pressable
                  key={dateStr}
                  onPress={() => setSelectedDay(dateStr)}
                  style={[
                    styles.dayCell,
                    isSelected && { backgroundColor: t.primary + '18', borderRadius: radius.md },
                  ]}
                >
                  <View
                    style={[
                      styles.dayNumWrap,
                      isToday && { backgroundColor: t.primary, borderRadius: radius.full },
                    ]}
                  >
                    <Text
                      style={{
                        color: isToday ? t.primaryForeground : t.foreground,
                        fontWeight: isToday || isSelected ? '800' : '600',
                        fontSize: fontSize.sm,
                      }}
                    >
                      {day}
                    </Text>
                  </View>
                  <View style={styles.dots}>
                    {dayEvents.slice(0, 3).map((ev) => (
                      <View
                        key={ev.id}
                        style={[
                          styles.dot,
                          {
                            backgroundColor:
                              ev.type === 'Deadline'
                                ? t.destructive
                                : ev.type === 'Invoice'
                                  ? t.warning
                                  : t.primary,
                          },
                        ]}
                      />
                    ))}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.sectionHead}>
          <Text style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '800' }}>
            {selectedDay ? formatDate(selectedDay) : 'This month'}
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            {(selectedDay ? selectedEvents : monthEvents).length} events
          </Text>
        </View>

        {(selectedDay ? selectedEvents : monthEvents).length === 0 ? (
          <EmptyState
            title="No events"
            description="Project deadlines, unpaid invoices, and active subscription ends appear here."
            icon="calendar-outline"
          />
        ) : (
          (selectedDay ? selectedEvents : monthEvents).map((ev) => (
            <Pressable
              key={ev.id}
              onPress={() => openEvent(ev)}
              style={[styles.eventRow, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }} numberOfLines={2}>
                  {ev.title}
                </Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
                  {ev.subtitle} · {formatDate(ev.date)}
                </Text>
              </View>
              <Badge label={ev.type} tone={typeTone(ev.type)} />
            </Pressable>
          ))
        )}
      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="Add event">
        <View style={{ gap: spacing.sm }}>
          {canWrite('projects') ? (
            <AddRow
              icon="briefcase-outline"
              label="Project deadline"
              onPress={() => {
                setAddOpen(false);
                router.push('/project/add');
              }}
            />
          ) : null}
          {canWrite('invoices') ? (
            <AddRow
              icon="document-text-outline"
              label="Invoice"
              onPress={() => {
                setAddOpen(false);
                router.push('/invoice/add');
              }}
            />
          ) : null}
          {canWrite('subscriptions') ? (
            <AddRow
              icon="layers-outline"
              label="Subscription"
              onPress={() => {
                setAddOpen(false);
                router.push('/subscription/add');
              }}
            />
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

function AddRow({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionRow, { borderColor: t.border, backgroundColor: t.background }]}
    >
      <Ionicons name={icon} size={20} color={t.primary} />
      <Text style={{ color: t.foreground, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Ionicons name="chevron-forward" size={16} color={t.mutedForeground} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  navBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gridCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
  },
  weekRow: { flexDirection: 'row', marginBottom: spacing.sm },
  weekLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  daysGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  dayCell: {
    width: `${100 / 7}%`,
    minHeight: 48,
    alignItems: 'center',
    paddingVertical: 4,
  },
  dayNumWrap: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dots: { flexDirection: 'row', gap: 2, marginTop: 2, minHeight: 6 },
  dot: { width: 5, height: 5, borderRadius: 3 },
  sectionHead: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  eventRow: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
  },
});

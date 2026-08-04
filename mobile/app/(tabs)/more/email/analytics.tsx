import React, { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SegmentedControl, Select, GridSkeleton } from '../../../../components/ui';
import { ChartEmpty, GroupedBars, VolumeChart } from '../../../../components/email/EmailCharts';
import { EmailAvatar } from '../../../../components/email/EmailAvatar';
import { StatusBadge } from '../../../../components/email/StatusBadge';
import {
  useActivity,
  useAgents,
  useAnalyticsByMailbox,
  useAnalyticsOverview,
  useAnalyticsVolume,
  useDepartments,
  useMailboxes,
  useTopSenders,
} from '../../../../lib/email/hooks';
import { listTime } from '../../../../lib/email/format';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

const RANGE_OPTIONS = [
  { label: 'Last 7 days', value: '7' },
  { label: '30 days', value: '30' },
  { label: '90 days', value: '90' },
];

function formatDuration(minutes: number): string {
  if (!minutes) return '—';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}m` : `${hours}h`;
}

export default function EmailAnalyticsScreen() {
  const t = useTheme();
  const [mailboxId, setMailboxId] = useState<string | undefined>();
  const [days, setDays] = useState('30');

  const { data: mailboxes = [] } = useMailboxes();
  const { data: overview, isLoading } = useAnalyticsOverview(mailboxId);
  const { data: volume = [] } = useAnalyticsVolume(Number(days), mailboxId);
  const { data: byMailbox = [] } = useAnalyticsByMailbox();
  const { data: topSenders = [] } = useTopSenders(mailboxId);
  const { data: agents = [] } = useAgents(mailboxId);
  const { data: departments = [] } = useDepartments();
  const { data: activity = [] } = useActivity(mailboxId);

  const cards = overview?.cards;

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen options={{ title: 'Email analytics' }} />

      <ScrollView contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}>
        <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
          <Select
            value={mailboxId ?? 'all'}
            options={[
              { value: 'all', label: 'All mailboxes' },
              ...mailboxes.map((m) => ({ value: m.id, label: m.displayName })),
            ]}
            onChange={(value) => setMailboxId(value === 'all' ? undefined : value)}
          />
          <SegmentedControl options={RANGE_OPTIONS} value={days} onChange={setDays} />
        </View>

        {isLoading || !cards ? (
          <GridSkeleton padding={0} />
        ) : (
          <>
            <View style={styles.kpiGrid}>
              <Kpi icon="mail-outline" label="Inbox" value={cards.inbox} />
              <Kpi icon="mail-unread-outline" label="Unread" value={cards.unread} accent={cards.unread > 0} />
              <Kpi icon="paper-plane-outline" label="Sent today" value={cards.todaySent} />
              <Kpi icon="arrow-undo-outline" label="Replies" value={cards.replies} />
              <Kpi icon="eye-outline" label="Open rate" value={`${cards.openRate}%`} />
              <Kpi icon="hand-left-outline" label="Click rate" value={`${cards.clickRate}%`} />
              <Kpi icon="warning-outline" label="Bounce rate" value={`${cards.bounceRate}%`} />
              <Kpi
                icon="time-outline"
                label="Avg response"
                value={formatDuration(cards.avgResponseMinutes)}
              />
            </View>

            <Panel title="Volume — sent vs received">
              <VolumeChart data={volume} />
            </Panel>

            <Panel title="By mailbox">
              <GroupedBars
                data={byMailbox.map((m) => ({
                  label: m.displayName,
                  sent: m.sent,
                  received: m.received,
                }))}
              />
            </Panel>

            <Panel title="Top senders">
              {topSenders.length === 0 ? (
                <ChartEmpty message="No inbound mail yet" />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {topSenders.map((sender) => (
                    <View key={sender.email} style={styles.row}>
                      <EmailAvatar email={sender.email} size={28} />
                      <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>
                        {sender.email}
                      </Text>
                      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>
                        {sender.count}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Panel>

            <Panel
              title="Who's sending"
              subtitle="Emails sent per team member across accessible mailboxes."
            >
              {agents.length === 0 ? (
                <ChartEmpty message="No sent emails yet" />
              ) : (
                <View style={{ gap: spacing.sm }}>
                  {agents.map((agent) => (
                    <View
                      key={agent.userId ?? 'automated'}
                      style={[styles.agentRow, { borderColor: t.border }]}
                    >
                      {agent.automated ? (
                        <View style={[styles.botAvatar, { backgroundColor: t.muted }]}>
                          <Ionicons name="hardware-chip-outline" size={14} color={t.mutedForeground} />
                        </View>
                      ) : (
                        <EmailAvatar name={agent.name} size={28} />
                      )}
                      <Text
                        numberOfLines={1}
                        style={{
                          flex: 1,
                          color: agent.automated ? t.mutedForeground : t.foreground,
                          fontSize: fontSize.sm,
                        }}
                      >
                        {agent.name}
                      </Text>
                      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                        {agent.openRate}% open
                      </Text>
                      <Text
                        style={{
                          color: t.foreground,
                          fontSize: fontSize.sm,
                          fontWeight: '700',
                          width: 34,
                          textAlign: 'right',
                        }}
                      >
                        {agent.sent}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </Panel>

            <Panel title="By department">
              <GroupedBars
                data={departments.map((d) => ({
                  label: d.department,
                  sent: d.sent,
                  received: d.received,
                }))}
              />
            </Panel>

            <Panel
              title="Recent sent — by whom"
              subtitle="Audit log of outgoing messages and the team member who sent each."
            >
              {activity.length === 0 ? (
                <ChartEmpty message="No activity yet" />
              ) : (
                <View style={{ gap: spacing.md }}>
                  {activity.map((item) => (
                    <View key={item.id} style={[styles.activityRow, { borderTopColor: t.border }]}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
                        {item.automated ? (
                          <Ionicons name="hardware-chip-outline" size={13} color={t.mutedForeground} />
                        ) : null}
                        <Text
                          numberOfLines={1}
                          style={{
                            flex: 1,
                            color: item.automated ? t.mutedForeground : t.foreground,
                            fontSize: fontSize.sm,
                            fontWeight: item.automated ? '500' : '700',
                          }}
                        >
                          {item.agent}
                        </Text>
                        <StatusBadge status={item.status} small />
                      </View>
                      <Text numberOfLines={1} style={{ color: t.foreground, fontSize: 13 }}>
                        {item.subject || '(no subject)'}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                        <View
                          style={[
                            styles.mailboxDot,
                            { backgroundColor: item.mailbox?.color || '#6366f1' },
                          ]}
                        />
                        <Text numberOfLines={1} style={{ flex: 1, color: t.mutedForeground, fontSize: 11 }}>
                          {item.mailbox?.displayName} → {item.to}
                        </Text>
                        <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
                          {listTime(item.at)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </Panel>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string | number;
  accent?: boolean;
}) {
  const t = useTheme();
  return (
    <View style={[styles.kpi, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
        <Ionicons name={icon} size={13} color={t.mutedForeground} />
        <Text style={{ color: t.mutedForeground, fontSize: 11, fontWeight: '600' }}>{label}</Text>
      </View>
      <Text
        style={{
          color: accent ? t.primary : t.foreground,
          fontSize: 22,
          fontWeight: '700',
          marginTop: 4,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  const t = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '700' }}>{title}</Text>
      {subtitle ? (
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{subtitle}</Text>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  kpiGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  kpi: {
    flexGrow: 1,
    flexBasis: '46%',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  agentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
  },
  botAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  activityRow: { gap: 3, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.sm },
  mailboxDot: { width: 7, height: 7, borderRadius: 4 },
});

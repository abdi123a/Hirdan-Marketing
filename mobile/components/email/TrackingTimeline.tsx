import React, { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Skeleton } from '../ui';
import { fullTime } from '../../lib/email/format';
import { eventStyle } from '../../lib/email/status';
import type { EmailEvent, EmailEventType, EmailStatus } from '../../lib/email/types';

const EVENT_ORDER: Record<EmailEventType, number> = {
  QUEUED: 1,
  SCHEDULED: 1,
  SENT: 2,
  DELIVERY_DELAYED: 3,
  DELIVERED: 4,
  OPENED: 5,
  CLICKED: 6,
  RECEIVED: 7,
  REPLIED: 8,
  BOUNCED: 99,
  COMPLAINED: 99,
  FAILED: 99,
  CANCELED: 99,
};

const SINGLE_INSTANCE_TYPES = new Set<EmailEventType>([
  'QUEUED', 'SCHEDULED', 'SENT', 'DELIVERY_DELAYED', 'DELIVERED',
  'RECEIVED', 'REPLIED', 'BOUNCED', 'COMPLAINED', 'FAILED', 'CANCELED',
]);

type PipelineKey = 'SENT' | 'DELIVERED' | 'OPENED' | 'CLICKED' | 'REPLIED';

type PipelineStep = { key: PipelineKey; label: string; done: boolean; at?: string };

const PIPELINE_ICONS: Record<PipelineKey, keyof typeof Ionicons.glyphMap> = {
  SENT: 'paper-plane',
  DELIVERED: 'checkmark-circle',
  OPENED: 'eye',
  CLICKED: 'hand-left',
  REPLIED: 'arrow-undo',
};

function eventIcon(type: EmailEventType): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case 'QUEUED':
    case 'SCHEDULED':
      return 'time-outline';
    case 'SENT':
      return 'paper-plane';
    case 'DELIVERED':
      return 'checkmark-circle';
    case 'OPENED':
      return 'eye';
    case 'CLICKED':
      return 'hand-left';
    case 'REPLIED':
      return 'arrow-undo';
    case 'RECEIVED':
      return 'download';
    case 'BOUNCED':
    case 'COMPLAINED':
      return 'warning';
    case 'FAILED':
    case 'CANCELED':
      return 'close-circle';
    default:
      return 'ellipse';
  }
}

function payloadMeta(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') return null;
  const p = payload as Record<string, unknown>;
  const open = (p.open ?? p.click) as Record<string, unknown> | undefined;
  const parts: string[] = [];
  const ua = (open?.userAgent ?? p.userAgent ?? p.user_agent) as string | undefined;
  const ip = (open?.ipAddress ?? open?.ip_address ?? p.ipAddress ?? p.ip) as string | undefined;
  if (ip) parts.push(ip);
  if (ua) parts.push(ua.length > 72 ? `${ua.slice(0, 72)}…` : ua);
  if (typeof p.error === 'string') parts.push(p.error);
  return parts.length ? parts.join(' · ') : null;
}

function sortEvents(events: EmailEvent[]): EmailEvent[] {
  const seen = new Set<EmailEventType>();
  const filtered: EmailEvent[] = [];
  for (const ev of events) {
    if (SINGLE_INSTANCE_TYPES.has(ev.type)) {
      if (seen.has(ev.type)) continue;
      seen.add(ev.type);
    }
    filtered.push(ev);
  }
  return [...filtered].sort((a, b) => {
    const ta = new Date(a.occurredAt).getTime();
    const tb = new Date(b.occurredAt).getTime();
    if (Math.abs(ta - tb) > 2000) return ta - tb;
    return (EVENT_ORDER[a.type] ?? 50) - (EVENT_ORDER[b.type] ?? 50);
  });
}

function buildPipeline(
  events: EmailEvent[],
  status: EmailStatus,
  sentAt?: string | null
): PipelineStep[] {
  const byType = (type: EmailEventType) => events.filter((e) => e.type === type);
  const first = (type: EmailEventType) => byType(type)[0];
  const rank: Record<string, number> = {
    DRAFT: 0, QUEUED: 1, SCHEDULED: 1, SENT: 2, DELIVERY_DELAYED: 2,
    DELIVERED: 3, OPENED: 4, CLICKED: 5, RECEIVED: 5,
    BOUNCED: 100, COMPLAINED: 100, FAILED: 100, CANCELED: 100,
  };
  const statusRank = rank[status] ?? 0;
  const failed = statusRank >= 100;

  const sentEv = first('SENT') || first('SCHEDULED') || first('QUEUED');
  const deliveredEv = first('DELIVERED');
  const opened = byType('OPENED');
  const clicked = byType('CLICKED');
  const repliedEv = first('REPLIED');

  return [
    {
      key: 'SENT',
      label: 'Sent',
      done: !!sentEv || statusRank >= 2 || !!sentAt,
      at: sentEv?.occurredAt || sentAt || undefined,
    },
    {
      key: 'DELIVERED',
      label: 'Delivered',
      done: !failed && (!!deliveredEv || statusRank >= 3),
      at: deliveredEv?.occurredAt,
    },
    {
      key: 'OPENED',
      label: opened.length > 1 ? `Opened ×${opened.length}` : 'Opened',
      done: !failed && (!!opened.length || statusRank >= 4),
      at: opened[0]?.occurredAt,
    },
    {
      key: 'CLICKED',
      label: clicked.length > 1 ? `Clicked ×${clicked.length}` : 'Clicked',
      done: !failed && (!!clicked.length || statusRank >= 5),
      at: clicked[0]?.occurredAt,
    },
    { key: 'REPLIED', label: 'Replied', done: !!repliedEv, at: repliedEv?.occurredAt },
  ];
}

interface Props {
  events: EmailEvent[];
  status?: EmailStatus;
  sentAt?: string | null;
  loading?: boolean;
}

/**
 * Real delivery timeline driven by EmailEvent rows (Resend webhooks + open
 * pixel): a Sent → Delivered → Opened → Clicked → Replied pipeline plus the
 * chronological event log with timestamps and metadata.
 */
export function TrackingTimeline({ events, status = 'SENT', sentAt, loading }: Props) {
  const t = useTheme();
  const sorted = useMemo(() => sortEvents(events ?? []), [events]);
  const pipeline = useMemo(() => buildPipeline(events ?? [], status, sentAt), [events, status, sentAt]);
  const terminal = sorted.find(
    (e) => e.type === 'BOUNCED' || e.type === 'FAILED' || e.type === 'COMPLAINED' || e.type === 'CANCELED'
  );

  if (loading && !events?.length) {
    return (
      <View style={styles.loadingRow}>
        <Skeleton height={10} width="70%" />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.pipeline}>
        {pipeline.map((step, i) => {
          const style = eventStyle(step.key);
          return (
            <React.Fragment key={step.key}>
              <View style={styles.pipelineStep}>
                <View
                  style={[
                    styles.pipelineDot,
                    { backgroundColor: step.done ? style.dot : t.muted },
                  ]}
                >
                  <Ionicons
                    name={PIPELINE_ICONS[step.key]}
                    size={13}
                    color={step.done ? '#fff' : t.mutedForeground}
                  />
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    color: step.done ? t.foreground : t.mutedForeground,
                    fontSize: 10,
                    fontWeight: '600',
                    textAlign: 'center',
                  }}
                >
                  {step.label}
                </Text>
                <Text
                  numberOfLines={1}
                  style={{ color: t.mutedForeground, fontSize: 9, textAlign: 'center' }}
                >
                  {step.at ? fullTime(step.at) : step.done ? '' : 'Waiting'}
                </Text>
              </View>
              {i < pipeline.length - 1 ? (
                <View
                  style={[
                    styles.connector,
                    { backgroundColor: step.done && pipeline[i + 1].done ? t.primary : t.border },
                  ]}
                />
              ) : null}
            </React.Fragment>
          );
        })}
      </View>

      {terminal ? (
        <View style={[styles.terminal, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
          <Ionicons name="warning" size={14} color="#B91C1C" />
          <View style={{ flex: 1 }}>
            <Text style={{ color: '#B91C1C', fontSize: fontSize.xs, fontWeight: '700' }}>
              {eventStyle(terminal.type).label}
            </Text>
            <Text style={{ color: '#B91C1C', fontSize: 11, opacity: 0.85 }}>
              {fullTime(terminal.occurredAt)}
            </Text>
            {payloadMeta(terminal.payload) ? (
              <Text style={{ color: '#B91C1C', fontSize: 11, opacity: 0.85 }}>
                {payloadMeta(terminal.payload)}
              </Text>
            ) : null}
          </View>
        </View>
      ) : null}

      <View style={[styles.log, { borderTopColor: t.border }]}>
        {sorted.length === 0 ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            No delivery events yet — tracking updates when Resend confirms delivery, opens, and clicks.
          </Text>
        ) : (
          sorted.map((ev, idx) => {
            const style = eventStyle(ev.type);
            const meta = payloadMeta(ev.payload);
            const isLast = idx === sorted.length - 1;
            return (
              <View key={ev.id} style={styles.logRow}>
                <View style={styles.logRail}>
                  <View style={[styles.logDot, { backgroundColor: style.dot }]}>
                    <Ionicons name={eventIcon(ev.type)} size={10} color="#fff" />
                  </View>
                  {!isLast ? <View style={[styles.logLine, { backgroundColor: t.border }]} /> : null}
                </View>
                <View style={{ flex: 1, paddingBottom: isLast ? 0 : spacing.md }}>
                  <Text style={{ color: t.foreground, fontSize: fontSize.xs, fontWeight: '700' }}>
                    {style.label}
                  </Text>
                  <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
                    {fullTime(ev.occurredAt)}
                  </Text>
                  {ev.link ? (
                    <Pressable onPress={() => Linking.openURL(ev.link as string).catch(() => undefined)}>
                      <Text numberOfLines={1} style={{ color: t.primary, fontSize: 11 }}>
                        {ev.link}
                      </Text>
                    </Pressable>
                  ) : null}
                  {meta ? (
                    <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{meta}</Text>
                  ) : null}
                </View>
              </View>
            );
          })
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  pipeline: { flexDirection: 'row', alignItems: 'flex-start' },
  pipelineStep: { flex: 1, alignItems: 'center', gap: 3 },
  pipelineDot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  connector: { height: 2, width: 8, marginTop: 12, borderRadius: 1 },
  terminal: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  log: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  logRow: { flexDirection: 'row', gap: spacing.md },
  logRail: { alignItems: 'center', width: 20 },
  logDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logLine: { width: 1, flex: 1, marginTop: 4 },
});

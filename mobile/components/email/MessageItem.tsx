import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { displayName, fullTime, listTime } from '../../lib/email/format';
import { useEmailEvents } from '../../lib/email/hooks';
import type { Attachment, EmailMessage } from '../../lib/email/types';
import { AttachmentChip } from './AttachmentChip';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';
import { EmailAvatar } from './EmailAvatar';
import { EmailBody } from './EmailBody';
import { StatusBadge } from './StatusBadge';
import { TrackingTimeline } from './TrackingTimeline';

export function MessageItem({
  email,
  defaultOpen,
}: {
  email: EmailMessage;
  defaultOpen: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(defaultOpen);
  const [trackingOpen, setTrackingOpen] = useState(false);
  const [preview, setPreview] = useState<Attachment | null>(null);
  const outbound = email.direction === 'OUTBOUND';

  const { data: liveTracking, isFetching: trackingLoading } = useEmailEvents(
    outbound && open && trackingOpen ? email.id : null,
    trackingOpen
  );
  const events = liveTracking?.events ?? email.events ?? [];
  const trackingStatus = liveTracking?.status ?? email.status;
  const attachments = email.attachments ?? [];

  return (
    <View style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}>
      <Pressable onPress={() => setOpen((v) => !v)} style={styles.header}>
        <EmailAvatar name={email.fromName} email={email.fromEmail} size={36} />

        <View style={{ flex: 1, gap: 2 }}>
          <View style={styles.headerLine}>
            <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm, fontWeight: '700' }}>
              {displayName(email.fromName, email.fromEmail)}
            </Text>
            {outbound ? <StatusBadge status={trackingStatus} small /> : null}
            {email.status === 'FAILED' && email.errorMessage ? (
              <Ionicons name="alert-circle" size={13} color={t.destructive} />
            ) : null}
            <Text style={{ color: t.mutedForeground, fontSize: 11 }}>
              {open ? fullTime(email.sentAt || email.createdAt) : listTime(email.sentAt || email.createdAt)}
            </Text>
          </View>

          {open ? (
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              To: {(email.toEmails ?? []).join(', ')}
              {email.ccEmails?.length ? ` · Cc: ${email.ccEmails.join(', ')}` : ''}
              {outbound
                ? email.sentBy
                  ? ` · Sent by ${email.sentBy.name}`
                  : ' · Sent automatically'
                : ''}
            </Text>
          ) : (
            <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              {outbound ? `${email.sentBy ? email.sentBy.name : 'Automated'} · ` : ''}
              {email.snippet || ' '}
            </Text>
          )}
        </View>

        <View style={styles.headerIcons}>
          {attachments.length > 0 ? (
            <Ionicons name="attach" size={14} color={t.mutedForeground} />
          ) : null}
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={16}
            color={t.mutedForeground}
          />
        </View>
      </Pressable>

      {open ? (
        <View style={styles.content}>
          <EmailBody html={email.html} text={email.text} />

          {email.status === 'FAILED' && email.errorMessage ? (
            <View style={[styles.error, { borderColor: '#FECACA', backgroundColor: '#FEF2F2' }]}>
              <Ionicons name="warning" size={14} color="#B91C1C" />
              <Text style={{ flex: 1, color: '#B91C1C', fontSize: fontSize.xs }}>
                {email.errorMessage}
              </Text>
            </View>
          ) : null}

          {attachments.length > 0 ? (
            <View style={[styles.attachments, { borderTopColor: t.border }]}>
              {attachments.map((a) => (
                <AttachmentChip
                  key={a.id}
                  attachment={a}
                  conversationId={email.conversationId}
                  onPreview={setPreview}
                />
              ))}
            </View>
          ) : null}

          {outbound ? (
            <View style={[styles.tracking, { borderTopColor: t.border }]}>
              <Pressable onPress={() => setTrackingOpen((v) => !v)} style={styles.trackingToggle}>
                <Ionicons name="pulse-outline" size={14} color={t.mutedForeground} />
                <Text style={{ flex: 1, color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '600' }}>
                  Delivery tracking
                </Text>
                <Ionicons
                  name={trackingOpen ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={t.mutedForeground}
                />
              </Pressable>
              {trackingOpen ? (
                <View style={{ marginTop: spacing.md }}>
                  <TrackingTimeline
                    events={events}
                    status={trackingStatus}
                    sentAt={email.sentAt}
                    loading={trackingLoading && !events.length}
                  />
                </View>
              ) : null}
            </View>
          ) : null}
        </View>
      ) : null}

      <AttachmentPreviewModal attachment={preview} onClose={() => setPreview(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    alignItems: 'flex-start',
  },
  headerLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  headerIcons: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingTop: 2 },
  content: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.md },
  attachments: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  tracking: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md },
  trackingToggle: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  error: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
});

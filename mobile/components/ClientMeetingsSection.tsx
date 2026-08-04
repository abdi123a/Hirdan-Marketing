import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { formatDate, relativeTime } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Sheet,
  useToast,
} from './ui';
import { useTheme } from '../hooks/useTheme';
import { fontSize, spacing } from '../constants/theme';

export type ClientMeeting = {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  notes?: string | null;
};

type MeetingForm = {
  title: string;
  date: string;
  time: string;
  location: string;
  notes: string;
};

const emptyForm = (): MeetingForm => ({
  title: '',
  date: '',
  time: '09:00',
  location: '',
  notes: '',
});

export function ClientMeetingsSection({
  clientId,
  clientName,
  meetings,
}: {
  clientId: string;
  clientName: string;
  meetings: ClientMeeting[];
}) {
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<ClientMeeting | null>(null);
  const [form, setForm] = useState<MeetingForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<ClientMeeting | null>(null);

  const sorted = useMemo(
    () =>
      [...meetings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [meetings]
  );

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: ['meetings-for-client', clientId] });

  const saveM = useMutation({
    mutationFn: async () => {
      const isoDate = new Date(`${form.date}T${form.time || '09:00'}:00`).toISOString();
      const body = {
        title: form.title.trim(),
        date: isoDate,
        location: form.location.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (editing) {
        return apiFetch(endpoints.clients.meetingById(clientId, editing.id), {
          method: 'PUT',
          body: JSON.stringify(body),
        });
      }
      return apiFetch(endpoints.clients.meetings(clientId), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => {
      toast(editing ? 'Meeting updated' : 'Meeting scheduled', 'success');
      setSheetOpen(false);
      setEditing(null);
      setForm(emptyForm());
      invalidate();
    },
    onError: (e: Error) => toast(e.message || 'Failed to save meeting', 'error'),
  });

  const deleteM = useMutation({
    mutationFn: (meetingId: string) =>
      apiFetch(endpoints.clients.meetingById(clientId, meetingId), { method: 'DELETE' }),
    onSuccess: () => {
      toast('Meeting deleted', 'success');
      setDeleteTarget(null);
      invalidate();
    },
    onError: (e: Error) => toast(e.message || 'Failed to delete', 'error'),
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const openEdit = (m: ClientMeeting) => {
    const dt = new Date(m.date);
    setEditing(m);
    setForm({
      title: m.title,
      date: dt.toISOString().slice(0, 10),
      time: dt.toTimeString().slice(0, 5),
      location: m.location || '',
      notes: m.notes || '',
    });
    setSheetOpen(true);
  };

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>Meetings</Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Face-to-face meetings with this client
          </Text>
        </View>
        <Button title="Schedule" size="sm" onPress={openCreate} />
      </View>

      {sorted.length === 0 ? (
        <EmptyState
          title="No meetings scheduled"
          description="Schedule a face-to-face meeting with this client."
          icon="calendar-outline"
          actionLabel="Schedule first meeting"
          onAction={openCreate}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {sorted.map((m, i) => {
            const d = new Date(m.date);
            const isPast = d < new Date();
            return (
              <View
                key={m.id}
                style={[
                  styles.row,
                  { opacity: isPast ? 0.55 : 1 },
                  i < sorted.length - 1 && {
                    borderBottomWidth: StyleSheet.hairlineWidth,
                    borderBottomColor: t.border,
                  },
                ]}
              >
                <View style={{ flex: 1, gap: 4 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={{ color: t.foreground, fontWeight: '700', flexShrink: 1 }}>{m.title}</Text>
                    {!isPast ? <Badge label="Upcoming" tone="success" /> : null}
                  </View>
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {formatDate(m.date)}
                    {m.location ? ` · ${m.location}` : ''}
                  </Text>
                  {m.notes ? (
                    <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={2}>
                      {m.notes}
                    </Text>
                  ) : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 8 }}>
                  <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{relativeTime(m.date)}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <Pressable onPress={() => openEdit(m)} hitSlop={8}>
                      <Ionicons name="pencil-outline" size={18} color={t.primary} />
                    </Pressable>
                    <Pressable onPress={() => setDeleteTarget(m)} hitSlop={8}>
                      <Ionicons name="trash-outline" size={18} color={t.destructive} />
                    </Pressable>
                  </View>
                </View>
              </View>
            );
          })}
        </Card>
      )}

      <Sheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        title={editing ? 'Edit meeting' : 'Schedule meeting'}
      >
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginBottom: spacing.md }}>
          Face-to-face meeting with {clientName}
        </Text>
        <View style={{ gap: spacing.md }}>
          <Input
            label="Meeting title"
            placeholder="e.g. Monthly Review"
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          />
          <Input
            label="Date (YYYY-MM-DD)"
            placeholder="2026-08-15"
            value={form.date}
            onChangeText={(v) => setForm((p) => ({ ...p, date: v }))}
            autoCapitalize="none"
          />
          <Input
            label="Time (HH:MM)"
            placeholder="09:00"
            value={form.time}
            onChangeText={(v) => setForm((p) => ({ ...p, time: v }))}
            autoCapitalize="none"
          />
          <Input
            label="Location (optional)"
            placeholder="Office, café, address"
            value={form.location}
            onChangeText={(v) => setForm((p) => ({ ...p, location: v }))}
          />
          <Input
            label="Notes (optional)"
            placeholder="Agenda, talking points…"
            value={form.notes}
            onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
            multiline
            style={{ minHeight: 80, textAlignVertical: 'top' }}
          />
          <Button
            title={saveM.isPending ? 'Saving…' : editing ? 'Update meeting' : 'Schedule meeting'}
            loading={saveM.isPending}
            disabled={!form.title.trim() || !form.date.trim() || saveM.isPending}
            onPress={() => saveM.mutate()}
          />
        </View>
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete meeting"
        message={`Remove “${deleteTarget?.title || 'this meeting'}”?`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteM.mutate(deleteTarget.id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
  },
});

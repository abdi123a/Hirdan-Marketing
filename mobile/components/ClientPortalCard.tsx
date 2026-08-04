import React, { useMemo, useState } from 'react';
import { Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints, type ClientSummary } from '@hirdan/shared';
import { apiFetch } from '../lib/api-client';
import { Badge, Button, Card, SwitchRow, useToast } from './ui';
import { useTheme } from '../hooks/useTheme';
import { fontSize, radius, spacing } from '../constants/theme';

const TOGGLES = [
  { id: 'financials', label: 'Financials' },
  { id: 'projects', label: 'Projects' },
  { id: 'subscriptions', label: 'Subscriptions' },
  { id: 'social', label: 'Social Media' },
  { id: 'planner', label: 'Planner' },
  { id: 'documents', label: 'Documents' },
] as const;

type PortalAccessMap = Record<string, boolean>;

function normalizeAccess(raw: ClientSummary['portalAccess']): PortalAccessMap {
  const base: PortalAccessMap = {
    financials: true,
    projects: true,
    subscriptions: true,
    social: true,
    planner: true,
    documents: true,
  };
  if (!raw || typeof raw !== 'object') return base;
  for (const key of Object.keys(base)) {
    if (key in raw) base[key] = (raw as Record<string, unknown>)[key] !== false;
  }
  return base;
}

export function ClientPortalCard({ client }: { client: ClientSummary }) {
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [access, setAccess] = useState(() => normalizeAccess(client.portalAccess));

  const hasAccess = !!client.userId;

  const generateM = useMutation({
    mutationFn: () =>
      apiFetch<{ tempPassword: string }>(endpoints.clients.portalAccess(client.id), {
        method: 'POST',
      }),
    onSuccess: async (res) => {
      setTempPassword(res.tempPassword);
      setShowPassword(true);
      await queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      await queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast(hasAccess ? 'Password reset' : 'Password generated', 'success');
    },
    onError: (e: Error) => toast(e.message || 'Could not manage portal access', 'error'),
  });

  const welcomeM = useMutation({
    mutationFn: (password?: string) => {
      const body: Record<string, string> = {};
      if (password) body.tempPassword = password;
      return apiFetch(endpoints.clients.sendWelcomeEmail(client.id), {
        method: 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => toast(`Welcome email sent to ${client.email}`, 'success'),
    onError: (e: Error) => toast(e.message || 'Failed to send email', 'error'),
  });

  const toggleM = useMutation({
    mutationFn: async (next: PortalAccessMap) => {
      const res = await apiFetch<{ client: ClientSummary }>(endpoints.clients.portalAccess(client.id), {
        method: 'PATCH',
        body: JSON.stringify({ portalAccess: next }),
      });
      return res.client;
    },
    onSuccess: (updated) => {
      setAccess(normalizeAccess(updated.portalAccess));
      queryClient.invalidateQueries({ queryKey: ['client', client.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Portal access updated', 'success');
    },
    onError: (e: Error) => {
      setAccess(normalizeAccess(client.portalAccess));
      toast(e.message || 'Error updating access', 'error');
    },
  });

  const handleToggle = (section: string, checked: boolean) => {
    const next = { ...access, [section]: checked };
    setAccess(next);
    toggleM.mutate(next);
  };

  const statusLabel = useMemo(() => (hasAccess ? 'Enabled' : 'Not set'), [hasAccess]);

  return (
    <Card style={{ gap: spacing.md }}>
      <View style={styles.headerRow}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          <Ionicons name="key-outline" size={18} color={hasAccess ? t.success : t.secondary} />
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
            Portal access
          </Text>
        </View>
        {hasAccess ? <Badge label={statusLabel} tone="success" /> : null}
      </View>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
        {hasAccess
          ? 'Manage or reset client login password'
          : 'Create initial login password for the client portal'}
      </Text>

      {tempPassword ? (
        <View style={{ gap: spacing.sm }}>
          <View style={[styles.box, { backgroundColor: t.muted, borderColor: t.border }]}>
            <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>
              TEMPORARY PASSWORD
            </Text>
            <View style={styles.pwRow}>
              <Text style={{ color: t.foreground, fontFamily: 'monospace', fontSize: fontSize.lg, fontWeight: '800' }}>
                {showPassword ? tempPassword : '••••••••••'}
              </Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                <Pressable onPress={() => setShowPassword((v) => !v)} hitSlop={8}>
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={t.mutedForeground}
                  />
                </Pressable>
                <Pressable
                  onPress={() => Share.share({ message: tempPassword })}
                  hitSlop={8}
                >
                  <Ionicons name="share-outline" size={18} color={t.mutedForeground} />
                </Pressable>
              </View>
            </View>
          </View>
          <View style={[styles.box, { backgroundColor: t.muted, borderColor: t.border }]}>
            <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>LOGIN EMAIL</Text>
            <Text style={{ color: t.foreground, fontWeight: '600' }}>{client.email || '—'}</Text>
          </View>
          <Text style={{ color: t.warning, fontSize: fontSize.xs, lineHeight: 18 }}>
            This temporary password is shown only once. Ask the client to log in and change it from
            their portal account.
          </Text>
          <Button
            title={welcomeM.isPending ? 'Sending…' : 'Send welcome email'}
            size="sm"
            loading={welcomeM.isPending}
            disabled={!client.email || welcomeM.isPending}
            onPress={() => welcomeM.mutate(tempPassword)}
          />
        </View>
      ) : hasAccess ? (
        <View style={{ gap: spacing.sm }}>
          <View style={[styles.box, { backgroundColor: t.muted, borderColor: t.border }]}>
            <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>LINKED EMAIL</Text>
            <Text style={{ color: t.foreground, fontWeight: '700' }} numberOfLines={1}>
              {client.email || '—'}
            </Text>
          </View>
          <Button
            title={generateM.isPending ? 'Resetting…' : 'Reset password'}
            variant="outline"
            size="sm"
            loading={generateM.isPending}
            onPress={() => generateM.mutate()}
          />
          <Button
            title={welcomeM.isPending ? 'Sending…' : 'Resend welcome email'}
            variant="outline"
            size="sm"
            loading={welcomeM.isPending}
            disabled={!client.email}
            onPress={() => welcomeM.mutate(undefined)}
          />
        </View>
      ) : (
        <View style={{ gap: spacing.sm, alignItems: 'center', paddingVertical: spacing.sm }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, textAlign: 'center' }}>
            Client currently has no portal password set.
          </Text>
          <Button
            title={generateM.isPending ? 'Generating…' : 'Generate password'}
            size="sm"
            loading={generateM.isPending}
            onPress={() => generateM.mutate()}
            style={{ alignSelf: 'stretch' }}
          />
        </View>
      )}

      <View style={[styles.divider, { borderTopColor: t.border }]}>
        <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.sm, marginBottom: 4 }}>
          Portal sections
        </Text>
        <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, marginBottom: spacing.sm }}>
          Toggle which sections this client can see in their portal.
        </Text>
        {TOGGLES.map((toggle) => (
          <SwitchRow
            key={toggle.id}
            label={toggle.label}
            value={access[toggle.id] !== false}
            onValueChange={(v) => handleToggle(toggle.id, v)}
          />
        ))}
        <SwitchRow label="Overview" value disabled onValueChange={() => undefined} />
        <SwitchRow label="Account" value disabled onValueChange={() => undefined} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  box: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: 4,
  },
  pwRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: spacing.md, gap: 2 },
});

import React, { useCallback, useState } from 'react';
import { Linking, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as LocalAuthentication from 'expo-local-authentication';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../lib/auth-store';
import { loadCredentials } from '../../../lib/secure-storage';
import { Avatar, ListRow, SwitchRow, useToast } from '../../../components/ui';
import { useMailboxes } from '../../../lib/email/hooks';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../constants/theme';

const DASHBOARD_URL =
  process.env.EXPO_PUBLIC_DASHBOARD_URL || 'https://app.hirdanmarketing.com/dashboard/settings';

function roleLabel(role?: string | null) {
  const r = String(role || '').toLowerCase();
  if (r === 'admin') return 'Admin';
  if (r === 'manager') return 'Manager';
  if (r === 'staff') return 'Staff';
  if (r === 'client') return 'Client';
  return 'Team';
}

export default function MoreScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);
  const [bioBusy, setBioBusy] = useState(false);
  const { data: mailboxes = [] } = useMailboxes();
  const unread = mailboxes.reduce((sum, m) => sum + (m.unreadCount ?? 0), 0);

  const displayName = (user?.name || '').trim() || user?.email?.split('@')[0] || 'Account';
  const displayEmail = (user?.email || '').trim() || 'Signed in';

  const openDashboard = async () => {
    try {
      const supported = await Linking.canOpenURL(DASHBOARD_URL);
      if (!supported) throw new Error('Cannot open dashboard URL');
      await Linking.openURL(DASHBOARD_URL);
    } catch (e: any) {
      toast(e?.message || 'Could not open dashboard', 'error');
    }
  };

  const handleLogout = async () => {
    await logout();
    router.replace('/(auth)/login');
  };

  const onToggleBiometrics = useCallback(
    async (next: boolean) => {
      if (bioBusy) return;
      setBioBusy(true);
      try {
        if (!next) {
          await setBiometricEnabled(false);
          toast('Biometrics turned off', 'success');
          return;
        }

        const hasHardware = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        if (!hasHardware || !enrolled) {
          toast('Set up Face ID or a fingerprint in your device settings first.', 'error');
          return;
        }

        const saved = await loadCredentials();
        if (!saved?.password) {
          toast('Log out and sign in once so your password can be saved for biometrics.', 'error');
          return;
        }

        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Enable biometric unlock',
          fallbackLabel: 'Cancel',
        });
        if (!result.success) {
          toast('Biometrics not enabled', 'error');
          return;
        }

        await setBiometricEnabled(true);
        toast('Biometrics enabled', 'success');
      } finally {
        setBioBusy(false);
      }
    },
    [bioBusy, setBiometricEnabled, toast],
  );

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={styles.content}>
      <View style={[styles.profileCard, { backgroundColor: t.card, borderColor: t.border }]}>
        <Avatar name={displayName} size={56} />
        <View style={styles.profileText}>
          <Text style={{ color: t.foreground, fontSize: fontSize.lg, fontWeight: '700' }} numberOfLines={1}>
            {displayName}
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }} numberOfLines={1}>
            {displayEmail}
          </Text>
          <Text style={[styles.rolePill, { color: t.primary, backgroundColor: t.primary + '14' }]}>
            {roleLabel(user?.role)}
          </Text>
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <MenuItem
          icon="mail-outline"
          title="Email"
          onPress={() => router.push('/(tabs)/more/email')}
          badge={unread}
        />
        <MenuItem icon="calendar-outline" title="Calendar" onPress={() => router.push('/(tabs)/more/calendar')} />
        <MenuItem icon="people-outline" title="Team" onPress={() => router.push('/(tabs)/more/team')} />
        <MenuItem icon="document-text-outline" title="HR Docs" onPress={() => router.push('/(tabs)/more/hr')} />
        <MenuItem icon="cloud-upload-outline" title="File Transfer" onPress={() => router.push('/(tabs)/more/transfers')} />
      </View>

      <Text style={[styles.sectionLabel, { color: t.mutedForeground }]}>Security</Text>
      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border, marginTop: spacing.sm }]}>
        <View style={styles.switchPad}>
          <SwitchRow
            label="Unlock with biometrics"
            description="Use Face ID or fingerprint to open the app"
            value={biometricEnabled}
            onValueChange={onToggleBiometrics}
            disabled={bioBusy}
          />
        </View>
      </View>

      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <MenuItem icon="open-outline" title="Open dashboard" onPress={openDashboard} />
        <MenuItem icon="log-out-outline" title="Log out" onPress={handleLogout} destructive />
      </View>
    </ScrollView>
  );
}

function MenuItem({
  icon,
  title,
  onPress,
  destructive,
  badge = 0,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  destructive?: boolean;
  badge?: number;
}) {
  const t = useTheme();
  return (
    <ListRow
      title={title}
      left={<Ionicons name={icon} size={22} color={destructive ? t.destructive : t.primary} />}
      onPress={onPress}
      right={
        badge > 0 ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <View style={[styles.badge, { backgroundColor: t.primary }]}>
              <Text style={{ color: t.primaryForeground, fontSize: 11, fontWeight: '700' }}>
                {badge > 99 ? '99+' : badge}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.mutedForeground} />
          </View>
        ) : undefined
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  profileCard: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  profileText: { flex: 1, gap: 4 },
  rolePill: {
    alignSelf: 'flex-start',
    marginTop: 4,
    overflow: 'hidden',
    borderRadius: radius.full,
    paddingHorizontal: 10,
    paddingVertical: 3,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  sectionLabel: {
    marginTop: spacing.lg,
    marginHorizontal: spacing.lg,
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  section: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  switchPad: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badge: {
    minWidth: 22,
    borderRadius: radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    alignItems: 'center',
  },
});

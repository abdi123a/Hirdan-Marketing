import React, { useEffect, useState } from 'react';
import { Linking, StyleSheet, View, useColorScheme } from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { ScrollView } from '../components/ui/ScrollView';
import {
  Avatar,
  Badge,
  Card,
  Dialog,
  Icon,
  ListGroup,
  ListRow,
  Section,
  SwitchRow,
  Text,
  useToast,
  withAlpha,
  type IconName,
} from '../components/ui';
import { radius, spacing } from '../constants/theme';
import { useTheme } from '../hooks/useTheme';
import { useAuthStore } from '../lib/auth-store';

/**
 * Account and device preferences.
 *
 * Only exposes settings this app can actually honour: biometric unlock is
 * backed by the auth store, and appearance follows the OS rather than offering
 * an in-app theme switch the store has no way to persist. Anything that would
 * need a profile-write endpoint is linked out to the dashboard instead of
 * being shown as a field that silently fails to save.
 */
export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const scheme = useColorScheme();

  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const biometricEnabled = useAuthStore((s) => s.biometricEnabled);
  const setBiometricEnabled = useAuthStore((s) => s.setBiometricEnabled);

  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('Biometric unlock');
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();
      const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
      if (cancelled) return;

      setBiometricAvailable(hasHardware && enrolled);
      // Name the actual sensor — "Biometric unlock" reads as boilerplate next
      // to a device that says Face ID.
      if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
        setBiometricLabel('Face unlock');
      } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
        setBiometricLabel('Fingerprint unlock');
      }
    })().catch(() => undefined);

    return () => {
      cancelled = true;
    };
  }, []);

  const onToggleBiometric = async (next: boolean) => {
    try {
      if (next) {
        // Prove the sensor works before storing the preference, so the setting
        // can never be on while unlock is impossible.
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: `Enable ${biometricLabel.toLowerCase()}`,
        });
        if (!result.success) return;
      }
      await setBiometricEnabled(next);
      toast(next ? `${biometricLabel} enabled` : `${biometricLabel} disabled`, 'success');
    } catch {
      toast('Could not update that setting', 'error');
    }
  };

  const dashboardUrl = String(
    (Constants.expoConfig?.extra as Record<string, unknown> | undefined)?.dashboardUrl ??
      process.env.EXPO_PUBLIC_DASHBOARD_URL ??
      '',
  );

  const roleLabel = user?.role ? user.role[0].toUpperCase() + user.role.slice(1) : 'Member';

  return (
    <View style={[styles.screen, { backgroundColor: t.background }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.profile}>
          <Avatar name={user?.name} size={58} />
          <View style={styles.profileText}>
            <Text variant="h3" numberOfLines={1}>
              {user?.name || 'Signed in'}
            </Text>
            <Text variant="subtext" color="muted" numberOfLines={1}>
              {user?.email}
            </Text>
            <View style={styles.badges}>
              <Badge label={roleLabel} tone="default" size="sm" />
              {user?.company ? <Badge label={user.company} tone="neutral" size="sm" /> : null}
            </View>
          </View>
        </Card>

        <Section title="Security">
          <ListGroup>
            {biometricAvailable ? (
              <View style={styles.switchRow}>
                <SwitchRow
                  label={biometricLabel}
                  description="Require it when reopening the app"
                  value={biometricEnabled}
                  onValueChange={(v) => void onToggleBiometric(v)}
                />
              </View>
            ) : (
              <ListRow
                title="Biometric unlock"
                subtitle="No enrolled biometrics on this device"
                left={<SettingIcon name="fingerprint" />}
                divider={false}
                hideChevron
              />
            )}
          </ListGroup>
        </Section>

        <Section title="Appearance">
          <ListGroup>
            <ListRow
              title="Theme"
              subtitle={`Following your device — currently ${scheme === 'dark' ? 'dark' : 'light'}`}
              left={<SettingIcon name={scheme === 'dark' ? 'dark_mode' : 'light_mode'} />}
              divider={false}
              hideChevron
            />
          </ListGroup>
        </Section>

        <Section title="Account">
          <ListGroup>
            <ListRow
              title="Notifications"
              subtitle="Manage in system settings"
              left={<SettingIcon name="notifications" />}
              onPress={() => void Linking.openSettings()}
            />
            <ListRow
              title="Edit profile"
              subtitle="Opens the web dashboard"
              left={<SettingIcon name="manage_accounts" />}
              divider={false}
              onPress={() => {
                if (!dashboardUrl) {
                  toast('Dashboard URL is not configured', 'error');
                  return;
                }
                void Linking.openURL(`${dashboardUrl.replace(/\/$/, '')}/settings`);
              }}
            />
          </ListGroup>
        </Section>

        <Section title="About">
          <ListGroup>
            <ListRow
              title="Version"
              subtitle={`${Constants.expoConfig?.version ?? '—'}`}
              left={<SettingIcon name="info" />}
              divider={false}
              hideChevron
            />
          </ListGroup>
        </Section>

        <ListGroup>
          <ListRow
            title="Sign out"
            destructive
            divider={false}
            left={<SettingIcon name="logout" destructive />}
            onPress={() => setConfirmLogout(true)}
          />
        </ListGroup>
      </ScrollView>

      <Dialog
        visible={confirmLogout}
        icon="log-out-outline"
        title="Sign out?"
        message="You'll need to sign in again to reach your workspace."
        confirmLabel="Sign out"
        destructive
        loading={loggingOut}
        onConfirm={async () => {
          setLoggingOut(true);
          try {
            await logout();
            setConfirmLogout(false);
            router.replace('/(auth)/login');
          } finally {
            setLoggingOut(false);
          }
        }}
        onCancel={() => setConfirmLogout(false)}
      />
    </View>
  );
}

function SettingIcon({
  name,
  destructive,
}: {
  name: IconName;
  destructive?: boolean;
}) {
  const t = useTheme();
  const tone = destructive ? t.destructive : t.primary;
  return (
    <View style={[styles.icon, { backgroundColor: withAlpha(tone, 0.11) }]}>
      <Icon name={name} size={19} color={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    padding: spacing.gutter,
    paddingBottom: spacing.xxl,
    gap: spacing.section,
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  profileText: { flex: 1, gap: 3 },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  switchRow: { paddingHorizontal: spacing.lg },
  icon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

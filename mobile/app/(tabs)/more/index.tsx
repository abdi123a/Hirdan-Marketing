import React from 'react';
import { Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuthStore } from '../../../lib/auth-store';
import { Avatar, ListRow, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

const DASHBOARD_URL =
  process.env.EXPO_PUBLIC_DASHBOARD_URL || 'https://app.hirdanmarketing.com/dashboard/settings';

export default function MoreScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

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

  return (
    <ScrollView style={{ flex: 1, backgroundColor: t.background }} contentContainerStyle={styles.content}>
      {user ? (
        <ListRow
          title={user.name}
          subtitle={user.email}
          left={<Avatar name={user.name} size={44} />}
        />
      ) : null}

      <View style={[styles.section, { backgroundColor: t.card, borderColor: t.border }]}>
        <MenuItem icon="mail-outline" title="Email" onPress={() => router.push('/(tabs)/more/email')} />
        <MenuItem icon="calendar-outline" title="Calendar" onPress={() => router.push('/(tabs)/more/calendar')} />
        <MenuItem icon="people-outline" title="Team" onPress={() => router.push('/(tabs)/more/team')} />
        <MenuItem icon="document-text-outline" title="HR Docs" onPress={() => router.push('/(tabs)/more/hr')} />
        <MenuItem icon="cloud-upload-outline" title="Transfers" onPress={() => router.push('/(tabs)/more/transfers')} />
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
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  const t = useTheme();
  return (
    <ListRow
      title={title}
      left={<Ionicons name={icon} size={22} color={destructive ? t.destructive : t.primary} />}
      onPress={onPress}
    />
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  section: {
    marginTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});

import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function MoreLayout() {
  const t = useTheme();
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: t.card },
        headerTintColor: t.foreground,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: t.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: 'More' }} />
      <Stack.Screen name="email" options={{ title: 'Email' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="hr" options={{ title: 'HR Documents' }} />
      <Stack.Screen name="transfers" options={{ title: 'Transfers' }} />
    </Stack>
  );
}

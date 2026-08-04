import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function HomeStack() {
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
      <Stack.Screen name="index" options={{ title: 'Overview', headerShown: false }} />
      <Stack.Screen name="notifications" options={{ title: 'Notifications' }} />
    </Stack>
  );
}

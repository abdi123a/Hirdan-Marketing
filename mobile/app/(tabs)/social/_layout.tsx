import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function SocialLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Social' }} />
      <Stack.Screen name="planner" options={{ title: 'Planner' }} />
      <Stack.Screen name="compose" options={{ title: 'Compose' }} />
    </Stack>
  );
}

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
      <Stack.Screen name="index" options={{ title: 'Publish' }} />
      <Stack.Screen name="analyze" options={{ title: 'Analyze' }} />
      <Stack.Screen name="accounts" options={{ title: 'Accounts' }} />
      <Stack.Screen name="select-account" options={{ title: 'Select account' }} />
      <Stack.Screen name="planner" options={{ title: 'Posts' }} />
    </Stack>
  );
}

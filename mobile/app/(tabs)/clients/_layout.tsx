import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function ClientsLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Clients', headerShown: false }} />
      <Stack.Screen name="[id]" options={{ title: 'Client' }} />
      <Stack.Screen name="add" options={{ title: 'Add Client', presentation: 'modal' }} />
      <Stack.Screen name="edit/[id]" options={{ title: 'Edit Client', presentation: 'modal' }} />
    </Stack>
  );
}

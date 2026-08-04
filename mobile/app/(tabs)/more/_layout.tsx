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
      <Stack.Screen name="email/index" options={{ title: 'Inbox' }} />
      <Stack.Screen name="email/[id]" options={{ title: 'Conversation' }} />
      <Stack.Screen
        name="email/compose"
        options={{ title: 'New message', presentation: 'modal' }}
      />
      <Stack.Screen name="email/mailboxes" options={{ title: 'Mailboxes' }} />
      <Stack.Screen name="email/templates" options={{ title: 'Templates' }} />
      <Stack.Screen name="email/analytics" options={{ title: 'Email analytics' }} />
      <Stack.Screen name="calendar" options={{ title: 'Calendar' }} />
      <Stack.Screen name="team" options={{ title: 'Team' }} />
      <Stack.Screen name="hr" options={{ title: 'HR Documents' }} />
      <Stack.Screen name="transfers" options={{ title: 'File Transfer' }} />
      <Stack.Screen name="transfer-add" options={{ title: 'Upload file', presentation: 'modal' }} />
      <Stack.Screen name="transfer/[id]" options={{ title: 'Transfer' }} />
      <Stack.Screen
        name="transfer-preview/[id]"
        options={{ title: 'Preview', presentation: 'fullScreenModal' }}
      />
      <Stack.Screen name="projects/add" options={{ title: 'New Project', presentation: 'modal' }} />
      <Stack.Screen name="projects/[id]" options={{ title: 'Project' }} />
    </Stack>
  );
}

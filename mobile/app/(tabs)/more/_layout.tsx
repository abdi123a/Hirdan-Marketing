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
      <Stack.Screen name="projects/index" options={{ title: 'Projects', headerShown: false }} />
      <Stack.Screen name="subscriptions/index" options={{ title: 'Subscriptions', headerShown: false }} />
      <Stack.Screen name="tasks/index" options={{ title: 'Deliverables', headerShown: false }} />
      <Stack.Screen name="team/index" options={{ title: 'Team', headerShown: false }} />
      <Stack.Screen name="team/[id]" options={{ title: 'Team member' }} />
      <Stack.Screen name="team/add" options={{ title: 'Add employee', presentation: 'modal' }} />
      <Stack.Screen name="team/edit/[id]" options={{ title: 'Edit employee', presentation: 'modal' }} />
      <Stack.Screen name="hr/index" options={{ title: 'HR Documents', headerShown: false }} />
      <Stack.Screen name="hr/generate" options={{ title: 'Generate HR doc', presentation: 'modal' }} />
      <Stack.Screen name="catalog/index" options={{ title: 'Catalog' }} />
      <Stack.Screen name="leads" options={{ title: 'Leads' }} />
      <Stack.Screen name="reports" options={{ title: 'Financial reports' }} />
      <Stack.Screen name="ai" options={{ title: 'AI Assistant' }} />
      <Stack.Screen name="transfers" options={{ title: 'File Transfer' }} />
    </Stack>
  );
}

import { Stack } from 'expo-router';
import { useTheme } from '../../../hooks/useTheme';

export default function MoneyLayout() {
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
      <Stack.Screen name="index" options={{ title: 'Money' }} />
      <Stack.Screen name="invoice/[id]" options={{ title: 'Invoice' }} />
      <Stack.Screen name="proforma/[id]" options={{ title: 'Proforma' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
      <Stack.Screen name="expense-add" options={{ title: 'Add Expense', presentation: 'modal' }} />
    </Stack>
  );
}

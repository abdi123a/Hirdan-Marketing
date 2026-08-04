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
      <Stack.Screen name="invoice-add" options={{ title: 'New Invoice', presentation: 'modal' }} />
      <Stack.Screen name="invoice-edit/[id]" options={{ title: 'Edit Invoice', presentation: 'modal' }} />
      <Stack.Screen name="proforma/[id]" options={{ title: 'Proforma' }} />
      <Stack.Screen name="proforma-add" options={{ title: 'New Proforma', presentation: 'modal' }} />
      <Stack.Screen name="proforma-edit/[id]" options={{ title: 'Edit Proforma', presentation: 'modal' }} />
      <Stack.Screen name="expense/[id]" options={{ title: 'Expense' }} />
      <Stack.Screen name="expense-add" options={{ title: 'Add Expense', presentation: 'modal' }} />
      <Stack.Screen name="expense-edit/[id]" options={{ title: 'Edit Expense', presentation: 'modal' }} />
      <Stack.Screen name="expenses" options={{ title: 'Expenses' }} />
    </Stack>
  );
}

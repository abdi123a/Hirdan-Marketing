import { Redirect } from 'expo-router';

/** Legacy route — expenses live under Money → Expenses tab. */
export default function ExpensesRedirect() {
  return <Redirect href="/(tabs)/money" />;
}

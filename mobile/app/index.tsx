import { Redirect } from 'expo-router';
import { useAuthStore } from '../lib/auth-store';

export default function Index() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLocked = useAuthStore((s) => s.isLocked);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const mustChangePassword = useAuthStore((s) => Boolean(s.user?.mustChangePassword));

  if (!isHydrated) return null;

  if (isAuthenticated && !isLocked && mustChangePassword) {
    return <Redirect href="/change-password" />;
  }

  if (isAuthenticated && !isLocked) {
    return <Redirect href="/(tabs)/home" />;
  }

  return <Redirect href="/(auth)/login" />;
}

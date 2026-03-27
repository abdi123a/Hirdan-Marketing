import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/lib/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRole: UserRole;
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    // Redirect to the appropriate login page
    if (allowedRole === 'admin') {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/client/login" state={{ from: location }} replace />;
  }

  if (user.role !== allowedRole) {
    // Wrong role — redirect to the correct area
    if (user.role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/client/portal" replace />;
  }

  return <>{children}</>;
}

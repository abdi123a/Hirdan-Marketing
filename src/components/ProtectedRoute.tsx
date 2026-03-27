import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore, type UserRole } from '@/lib/auth-store';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: UserRole | UserRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

  if (!isAuthenticated || !user) {
    // Redirect to the appropriate login page
    if (roles.includes('admin') || roles.includes('manager') || roles.includes('staff')) {
      return <Navigate to="/login" state={{ from: location }} replace />;
    }
    return <Navigate to="/client/login" state={{ from: location }} replace />;
  }

  if (!roles.includes(user.role)) {
    // Wrong role — redirect to the correct area
    if (['admin', 'manager', 'staff'].includes(user.role)) {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/client/portal" replace />;
  }

  return <>{children}</>;
}

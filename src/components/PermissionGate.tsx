import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/lib/auth-store';
import {
  type AccessLevel,
  type ModuleKey,
  PERMISSION_MODULES,
  hasPermission,
  moduleForPath,
  resolvePermissions,
} from '@/lib/permissions';

interface PermissionGateProps {
  module?: ModuleKey;
  minimum?: AccessLevel;
  children: React.ReactNode;
  /** When true, redirects instead of rendering nothing */
  fallback?: 'redirect' | 'hide';
}

/**
 * Gate UI / routes by module permission.
 * If `module` is omitted, derives it from the current pathname.
 */
export function PermissionGate({
  module,
  minimum = 'READ',
  children,
  fallback = 'redirect',
}: PermissionGateProps) {
  const { user, isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Clients don't use agency modules
  if (user.role === 'client') {
    return <Navigate to="/client/portal" replace />;
  }

  // Admins always pass
  if (user.role === 'admin') {
    return <>{children}</>;
  }

  const permissions =
    user.permissions ??
    resolvePermissions(user.role.toUpperCase() as 'ADMIN' | 'MANAGER' | 'STAFF');

  const mod = module || moduleForPath(location.pathname);

  // Find a safe fallback home (first module they can read)
  const home =
    PERMISSION_MODULES.find((m) => hasPermission(permissions, m.key, 'READ'))?.pathPrefix ||
    '/dashboard';

  if (!mod) {
    return <>{children}</>;
  }

  const allowed = hasPermission(permissions, mod, minimum);
  if (allowed) {
    return <>{children}</>;
  }

  if (fallback === 'hide') return null;

  // Avoid redirect loops when /dashboard itself is denied
  if (location.pathname === home || (mod === 'dashboard' && home === '/dashboard')) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center px-6">
        <p className="text-lg font-semibold text-foreground">No modules available</p>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Your account does not have access to this area. Ask an administrator to grant module permissions.
        </p>
      </div>
    );
  }

  return <Navigate to={home} replace />;
}

import { useCallback, useMemo } from 'react';
import { useAuthStore } from '@/lib/auth-store';
import {
  type AccessLevel,
  type ModuleKey,
  PERMISSION_MODULES,
  hasPermission,
  resolvePermissions,
} from '@/lib/permissions';

/**
 * Hook for checking the current user's module permissions.
 * Always resolves role defaults + overrides so the sidebar/UI stay accurate.
 */
export function usePermissions() {
  const user = useAuthStore((s) => s.user);

  const permissions = useMemo(() => {
    if (!user || user.role === 'client') return null;
    if (user.permissions) return user.permissions;
    return resolvePermissions(user.role.toUpperCase() as 'ADMIN' | 'MANAGER' | 'STAFF');
  }, [user]);

  const can = useCallback(
    (module: ModuleKey, minimum: AccessLevel = 'READ') => {
      if (!user) return false;
      if (user.role === 'admin') return true;
      if (user.role === 'client') return false;
      return hasPermission(permissions, module, minimum);
    },
    [user, permissions]
  );

  const canRead = useCallback((module: ModuleKey) => can(module, 'READ'), [can]);
  const canWrite = useCallback((module: ModuleKey) => can(module, 'WRITE'), [can]);
  const canManage = useCallback((module: ModuleKey) => can(module, 'MANAGE'), [can]);

  /** First sidebar module this user can open (used for redirects). */
  const homePath = useMemo(() => {
    if (!user || user.role === 'client') return '/client/portal';
    if (user.role === 'admin') return '/dashboard';
    for (const mod of PERMISSION_MODULES) {
      if (hasPermission(permissions, mod.key, 'READ')) {
        return mod.pathPrefix;
      }
    }
    return '/dashboard';
  }, [user, permissions]);

  return {
    permissions,
    can,
    canRead,
    canWrite,
    canManage,
    homePath,
    isAdmin: user?.role === 'admin',
    isManager: user?.role === 'manager',
    isStaff: user?.role === 'staff',
  };
}

import { useAuthStore } from '../lib/auth-store';
import type { AccessLevel, ModuleKey } from '@hirdan/shared';

export function usePermissions() {
  const user = useAuthStore((s) => s.user);
  const can = useAuthStore((s) => s.can);

  return {
    user,
    can,
    canRead: (module: ModuleKey) => can(module, 'READ'),
    canWrite: (module: ModuleKey) => can(module, 'WRITE'),
    canManage: (module: ModuleKey) => can(module, 'MANAGE'),
    isAdmin: user?.role === 'admin',
    isStaff: user?.role === 'staff' || user?.role === 'manager' || user?.role === 'admin',
  };
}

export type { AccessLevel, ModuleKey };

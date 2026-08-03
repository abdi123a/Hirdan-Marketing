import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ACCESS_LEVELS,
  ACCESS_LEVEL_LABELS,
  type AccessLevel,
  type ModuleKey,
  type PermissionMap,
  groupModules,
  resolvePermissions,
} from '@/lib/permissions';
import { Shield, RotateCcw } from 'lucide-react';

interface PermissionMatrixProps {
  role: 'ADMIN' | 'MANAGER' | 'STAFF' | 'CLIENT';
  value: PermissionMap;
  onChange: (next: PermissionMap) => void;
  disabled?: boolean;
}

const LEVEL_STYLES: Record<AccessLevel, string> = {
  NONE: 'text-muted-foreground',
  READ: 'text-sky-700',
  WRITE: 'text-amber-700',
  MANAGE: 'text-emerald-700',
};

export function PermissionMatrix({ role, value, onChange, disabled }: PermissionMatrixProps) {
  const isAdmin = role === 'ADMIN';
  const groups = groupModules();
  const effective = resolvePermissions(role, isAdmin ? null : value);

  const setLevel = (key: ModuleKey, level: AccessLevel) => {
    onChange({ ...value, [key]: level });
  };

  const setGroupLevel = (groupName: string, level: AccessLevel) => {
    const group = groups.find((g) => g.name === groupName);
    if (!group) return;
    const next = { ...value };
    for (const mod of group.modules) {
      next[mod.key] = level;
    }
    onChange(next);
  };

  const resetToRoleDefaults = () => {
    onChange({ ...resolvePermissions(role, null) });
  };

  if (isAdmin) {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/60 px-4 py-5 text-sm text-rose-800">
        <div className="flex items-start gap-3">
          <Shield className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">Administrator — full system access</p>
            <p className="text-xs mt-1 text-rose-700/80 leading-relaxed">
              Admins automatically receive <strong>Full access</strong> to every module, sidebar item, and dashboard.
              Individual permissions cannot be restricted for this role.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">Module access</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose what this user can see in the sidebar and what they can do on each page.
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs"
          onClick={resetToRoleDefaults}
          disabled={disabled}
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset to {role} defaults
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 text-[10px] uppercase tracking-wider font-semibold">
        {ACCESS_LEVELS.map((level) => (
          <Badge key={level} variant="outline" className={`${LEVEL_STYLES[level]} border-border/60`}>
            {ACCESS_LEVEL_LABELS[level]}
          </Badge>
        ))}
      </div>

      <div className="space-y-5">
        {groups.map((group) => (
          <div key={group.name} className="rounded-xl border border-border/60 overflow-hidden">
            <div className="flex items-center justify-between gap-3 bg-muted/40 px-4 py-2.5 border-b border-border/50">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">
                {group.name}
              </p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-muted-foreground hidden sm:inline">Set all</span>
                <Select
                  disabled={disabled}
                  onValueChange={(v) => setGroupLevel(group.name, v as AccessLevel)}
                >
                  <SelectTrigger className="h-7 w-[120px] text-[11px] bg-background">
                    <SelectValue placeholder="Bulk…" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCESS_LEVELS.map((level) => (
                      <SelectItem key={level} value={level} className="text-xs">
                        {ACCESS_LEVEL_LABELS[level]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="divide-y divide-border/40">
              {group.modules.map((mod) => {
                const level = effective[mod.key];
                return (
                  <div
                    key={mod.key}
                    className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-4 py-3 hover:bg-muted/20 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{mod.label}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{mod.description}</p>
                    </div>
                    <Select
                      value={level}
                      onValueChange={(v) => setLevel(mod.key, v as AccessLevel)}
                      disabled={disabled}
                    >
                      <SelectTrigger className={`h-9 w-full sm:w-[160px] text-xs font-medium ${LEVEL_STYLES[level]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ACCESS_LEVELS.map((l) => (
                          <SelectItem key={l} value={l} className="text-xs">
                            {ACCESS_LEVEL_LABELS[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

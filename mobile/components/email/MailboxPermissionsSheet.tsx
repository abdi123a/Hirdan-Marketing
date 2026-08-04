import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, Select, Sheet, SkeletonListRow } from '../ui';
import {
  useDirectoryUsers,
  useMailboxPermissions,
  usePermissionMutations,
} from '../../lib/email/hooks';
import type { Mailbox } from '../../lib/email/types';
import { EmailAvatar } from './EmailAvatar';

type Level = 'READ' | 'WRITE' | 'MANAGE';

const LEVEL_LABEL: Record<Level, string> = {
  READ: 'Read only',
  WRITE: 'Read & send',
  MANAGE: 'Manage',
};

const LEVEL_OPTIONS = (Object.keys(LEVEL_LABEL) as Level[]).map((level) => ({
  value: level,
  label: LEVEL_LABEL[level],
}));

export function MailboxPermissionsSheet({
  visible,
  onClose,
  mailbox,
}: {
  visible: boolean;
  onClose: () => void;
  mailbox: Mailbox;
}) {
  const t = useTheme();
  const { data: permissions = [], isLoading } = useMailboxPermissions(visible ? mailbox.id : null);
  const { data: users = [] } = useDirectoryUsers(visible);
  const { grant, revoke } = usePermissionMutations(mailbox.id);
  const [newUser, setNewUser] = useState('');
  const [newLevel, setNewLevel] = useState<Level>('WRITE');

  // Admins already have full access; clients never get mailbox access.
  const grantable = useMemo(() => {
    const granted = new Set(permissions.map((p) => p.userId));
    return users.filter((u) => u.role !== 'CLIENT' && u.role !== 'ADMIN' && !granted.has(u.id));
  }, [users, permissions]);

  const add = async () => {
    if (!newUser) return;
    await grant.mutateAsync({ userId: newUser, accessLevel: newLevel });
    setNewUser('');
    setNewLevel('WRITE');
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={`Access · ${mailbox.displayName}`}>
      <View style={{ gap: spacing.lg }}>
        <View style={[styles.note, { borderColor: t.border, backgroundColor: t.muted }]}>
          <Ionicons name="shield-checkmark-outline" size={15} color={t.mutedForeground} />
          <Text style={{ flex: 1, color: t.mutedForeground, fontSize: fontSize.xs }}>
            Admins automatically have full access to every mailbox. Grant access to specific managers
            or staff below.
          </Text>
        </View>

        {isLoading ? (
          <View>
            <SkeletonListRow />
            <SkeletonListRow />
            <SkeletonListRow />
          </View>
        ) : permissions.length === 0 ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center' }}>
            No staff granted yet.
          </Text>
        ) : (
          <View style={{ gap: spacing.sm }}>
            {permissions.map((permission) => (
              <View key={permission.id} style={[styles.row, { borderColor: t.border }]}>
                <EmailAvatar name={permission.user.name} email={permission.user.email} size={32} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
                    {permission.user.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {permission.user.email} · {permission.user.role}
                  </Text>
                  <View style={{ marginTop: spacing.xs }}>
                    <Select
                      value={permission.accessLevel}
                      options={LEVEL_OPTIONS}
                      onChange={(value) =>
                        grant.mutate({ userId: permission.userId, accessLevel: value as Level })
                      }
                    />
                  </View>
                </View>
                <Pressable
                  hitSlop={8}
                  onPress={() => revoke.mutate(permission.userId)}
                  accessibilityLabel={`Revoke access for ${permission.user.name}`}
                >
                  <Ionicons name="close" size={18} color={t.mutedForeground} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.addBlock, { borderTopColor: t.border }]}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            Grant access
          </Text>
          <Select
            value={newUser}
            placeholder={grantable.length ? 'Add a team member…' : 'No more staff to add'}
            options={grantable.map((user) => ({ value: user.id, label: `${user.name} (${user.role})` }))}
            onChange={setNewUser}
          />
          <Select
            value={newLevel}
            options={LEVEL_OPTIONS}
            onChange={(value) => setNewLevel(value as Level)}
          />
          <Button
            title="Grant access"
            size="sm"
            onPress={add}
            disabled={!newUser}
            loading={grant.isPending}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  note: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  addBlock: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
});

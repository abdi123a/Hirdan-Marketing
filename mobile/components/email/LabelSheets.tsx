import React, { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button, Sheet, SkeletonListRow } from '../ui';
import { useConversationLabels, useLabelMutations, useLabels } from '../../lib/email/hooks';

const PRESET = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#6366f1', '#8b5cf6', '#ec4899', '#64748b'];

/** Apply or remove labels on one conversation. */
export function LabelPickerSheet({
  visible,
  onClose,
  conversationId,
  appliedLabelIds,
  onManage,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
  appliedLabelIds: string[];
  onManage: () => void;
}) {
  const t = useTheme();
  const { data: labels = [] } = useLabels();
  const { add, remove } = useConversationLabels(conversationId);
  const applied = new Set(appliedLabelIds);

  return (
    <Sheet visible={visible} onClose={onClose} title="Apply labels">
      {labels.length === 0 ? (
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            No labels defined yet.
          </Text>
          <Button
            title="Manage labels"
            variant="outline"
            onPress={() => {
              onClose();
              onManage();
            }}
          />
        </View>
      ) : (
        <View style={{ gap: 2 }}>
          {labels.map((label) => {
            const on = applied.has(label.id);
            return (
              <Pressable
                key={label.id}
                onPress={() => (on ? remove.mutate(label.id) : add.mutate(label.id))}
                style={({ pressed }) => [
                  styles.pickRow,
                  { backgroundColor: pressed ? t.accent : 'transparent' },
                ]}
              >
                <View style={[styles.dot, { backgroundColor: label.color }]} />
                <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.md }}>
                  {label.name}
                </Text>
                {on ? <Ionicons name="checkmark" size={18} color={t.primary} /> : null}
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              onClose();
              onManage();
            }}
            style={({ pressed }) => [styles.pickRow, { backgroundColor: pressed ? t.accent : 'transparent' }]}
          >
            <Ionicons name="settings-outline" size={18} color={t.mutedForeground} />
            <Text style={{ flex: 1, color: t.mutedForeground, fontSize: fontSize.sm }}>
              Manage labels
            </Text>
          </Pressable>
        </View>
      )}
    </Sheet>
  );
}

/** Create, rename, recolour and delete labels. */
export function LabelManagerSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data: labels = [], isLoading } = useLabels();
  const { create, update, remove } = useLabelMutations();
  const [name, setName] = useState('');
  const [color, setColor] = useState(PRESET[4]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');

  const add = async () => {
    if (!name.trim()) return;
    await create.mutateAsync({ name: name.trim(), color });
    setName('');
  };

  const commitRename = (id: string, original: string) => {
    const next = editingName.trim();
    setEditingId(null);
    if (next && next !== original) update.mutate({ id, data: { name: next } });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Labels">
      <View style={{ gap: spacing.md }}>
        {isLoading ? (
          <View>
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
          </View>
        ) : labels.length === 0 ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>No labels yet.</Text>
        ) : (
          <View style={{ gap: spacing.xs }}>
            {labels.map((label) => (
              <View key={label.id} style={[styles.manageRow, { borderColor: t.border }]}>
                <ColorSwatches
                  value={label.color}
                  compact
                  onChange={(next) => update.mutate({ id: label.id, data: { color: next } })}
                />
                {editingId === label.id ? (
                  <TextInput
                    value={editingName}
                    onChangeText={setEditingName}
                    onBlur={() => commitRename(label.id, label.name)}
                    onSubmitEditing={() => commitRename(label.id, label.name)}
                    autoFocus
                    style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}
                  />
                ) : (
                  <Pressable
                    style={{ flex: 1 }}
                    onPress={() => {
                      setEditingId(label.id);
                      setEditingName(label.name);
                    }}
                  >
                    <Text style={{ color: t.foreground, fontSize: fontSize.sm }}>{label.name}</Text>
                  </Pressable>
                )}
                {typeof label.count === 'number' && label.count > 0 ? (
                  <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{label.count}</Text>
                ) : null}
                <Pressable hitSlop={8} onPress={() => remove.mutate(label.id)} accessibilityLabel="Delete label">
                  <Ionicons name="trash-outline" size={16} color={t.destructive} />
                </Pressable>
              </View>
            ))}
          </View>
        )}

        <View style={[styles.addBlock, { borderTopColor: t.border }]}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
            New label
          </Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Label name"
            placeholderTextColor={t.mutedForeground}
            style={[styles.input, { color: t.foreground, borderColor: t.border, backgroundColor: t.card }]}
          />
          <ColorSwatches value={color} onChange={setColor} />
          <Button
            title="Create label"
            onPress={add}
            disabled={!name.trim()}
            loading={create.isPending}
            size="sm"
          />
        </View>
      </View>
    </Sheet>
  );
}

function ColorSwatches({
  value,
  onChange,
  compact,
}: {
  value: string;
  onChange: (color: string) => void;
  compact?: boolean;
}) {
  const size = compact ? 16 : 26;
  if (compact) {
    // Cycle through the palette on tap — a colour picker would need a whole sheet.
    const next = () => {
      const index = PRESET.indexOf(value);
      onChange(PRESET[(index + 1) % PRESET.length]);
    };
    return (
      <Pressable onPress={next} accessibilityLabel="Change label colour">
        <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: value }} />
      </Pressable>
    );
  }
  return (
    <View style={styles.swatches}>
      {PRESET.map((preset) => (
        <Pressable key={preset} onPress={() => onChange(preset)} accessibilityLabel={`Colour ${preset}`}>
          <View
            style={{
              width: size,
              height: size,
              borderRadius: size / 2,
              backgroundColor: preset,
              borderWidth: value === preset ? 3 : 0,
              borderColor: '#ffffff',
              opacity: value === preset ? 1 : 0.85,
            }}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  pickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  manageRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  addBlock: {
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
    minHeight: 44,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});

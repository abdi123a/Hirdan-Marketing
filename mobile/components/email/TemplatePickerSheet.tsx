import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { SearchBar, Sheet, SkeletonListRow } from '../ui';
import { useTemplates } from '../../lib/email/hooks';
import { TEMPLATE_CATEGORY_LABELS } from '../../lib/email/status';
import { htmlToPlainText } from '../../lib/email/format';
import type { EmailTemplate, TemplateCategory } from '../../lib/email/types';

export function TemplatePickerSheet({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (template: EmailTemplate) => void;
}) {
  const t = useTheme();
  const [query, setQuery] = useState('');
  const { data: templates = [], isLoading } = useTemplates();

  const grouped = useMemo(() => {
    const term = query.trim().toLowerCase();
    const matching = term
      ? templates.filter(
          (tpl) =>
            tpl.name.toLowerCase().includes(term) || (tpl.subject ?? '').toLowerCase().includes(term)
        )
      : templates;
    return matching.reduce<Record<string, EmailTemplate[]>>((acc, tpl) => {
      (acc[tpl.category] ??= []).push(tpl);
      return acc;
    }, {});
  }, [templates, query]);

  const categories = Object.keys(grouped);

  return (
    <Sheet visible={visible} onClose={onClose} title="Insert template">
      <View style={{ gap: spacing.md }}>
        <SearchBar value={query} onChangeText={setQuery} placeholder="Search templates…" />

        {isLoading ? (
          <View>
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
            <SkeletonListRow avatar={false} />
          </View>
        ) : categories.length === 0 ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, paddingVertical: spacing.md }}>
            No templates found.
          </Text>
        ) : (
          categories.map((category) => (
            <View key={category} style={{ gap: spacing.xs }}>
              <Text style={[styles.groupLabel, { color: t.mutedForeground }]}>
                {TEMPLATE_CATEGORY_LABELS[category as TemplateCategory] ?? category}
              </Text>
              {grouped[category].map((tpl) => (
                <Pressable
                  key={tpl.id}
                  onPress={() => {
                    onSelect(tpl);
                    onClose();
                  }}
                  style={({ pressed }) => [
                    styles.row,
                    { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
                  ]}
                >
                  <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
                    {tpl.name}
                  </Text>
                  {tpl.subject ? (
                    <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                      {tpl.subject}
                    </Text>
                  ) : null}
                  <Text numberOfLines={2} style={{ color: t.mutedForeground, fontSize: 11 }}>
                    {htmlToPlainText(tpl.body).slice(0, 140)}
                  </Text>
                </Pressable>
              ))}
            </View>
          ))
        )}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  groupLabel: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: spacing.sm,
  },
  row: {
    gap: 2,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});

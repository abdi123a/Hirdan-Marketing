import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Button, EmptyState, Input, Select, Sheet, SkeletonCard } from '../../../../components/ui';
import { EmailBody } from '../../../../components/email/EmailBody';
import { useTemplateMutations, useTemplates } from '../../../../lib/email/hooks';
import { TEMPLATE_CATEGORY_LABELS } from '../../../../lib/email/status';
import { applyTemplateVars } from '../../../../lib/email/templateVars';
import { htmlToPlainText } from '../../../../lib/email/format';
import type { EmailTemplate, TemplateCategory } from '../../../../lib/email/types';
import { fontSize, radius, spacing } from '../../../../constants/theme';
import { useTheme } from '../../../../hooks/useTheme';

const CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABELS) as TemplateCategory[];
const CATEGORY_OPTIONS = CATEGORIES.map((category) => ({
  value: category,
  label: TEMPLATE_CATEGORY_LABELS[category],
}));
const VARIABLES = ['{{customer}}', '{{company}}', '{{invoice}}', '{{employee}}', '{{today}}'];

export default function TemplatesScreen() {
  const t = useTheme();
  const { data: templates = [], isLoading, isRefetching, refetch } = useTemplates();
  const { remove } = useTemplateMutations();
  const [filter, setFilter] = useState<TemplateCategory | 'ALL'>('ALL');
  const [editing, setEditing] = useState<EmailTemplate | null | undefined>(undefined);

  const shown = useMemo(
    () => (filter === 'ALL' ? templates : templates.filter((tpl) => tpl.category === filter)),
    [templates, filter]
  );

  const confirmDelete = (template: EmailTemplate) =>
    Alert.alert(`Delete “${template.name}”?`, 'This template will be permanently removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => remove.mutate(template.id) },
    ]);

  return (
    <View style={{ flex: 1, backgroundColor: t.background }}>
      <Stack.Screen
        options={{
          title: 'Templates',
          headerRight: () => (
            <Pressable
              hitSlop={8}
              onPress={() => setEditing(null)}
              accessibilityLabel="New template"
              style={{ paddingHorizontal: spacing.sm }}
            >
              <Ionicons name="add" size={26} color={t.primary} />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.filterBar, { backgroundColor: t.card, borderBottomColor: t.border }]}
        contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.lg }}
      >
        {(['ALL', ...CATEGORIES] as const).map((category) => {
          const active = filter === category;
          return (
            <Pressable
              key={category}
              onPress={() => setFilter(category as TemplateCategory | 'ALL')}
              style={[
                styles.filterChip,
                {
                  backgroundColor: active ? t.primary : 'transparent',
                  borderColor: active ? t.primary : t.border,
                },
              ]}
            >
              <Text
                style={{
                  color: active ? t.primaryForeground : t.mutedForeground,
                  fontSize: fontSize.xs,
                  fontWeight: '600',
                }}
              >
                {category === 'ALL' ? 'All' : TEMPLATE_CATEGORY_LABELS[category as TemplateCategory]}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView
        contentContainerStyle={{ padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={t.primary} />
        }
      >
        {isLoading ? (
          <View style={{ gap: spacing.md }}>
            <SkeletonCard height={96} />
            <SkeletonCard height={96} />
            <SkeletonCard height={96} />
          </View>
        ) : shown.length === 0 ? (
          <EmptyState
            title="No templates here yet"
            description="Reusable replies with {{variables}} you can insert while composing."
            actionLabel="New template"
            onAction={() => setEditing(null)}
            icon="document-text-outline"
          />
        ) : (
          shown.map((template) => (
            <View
              key={template.id}
              style={[styles.card, { backgroundColor: t.card, borderColor: t.border }]}
            >
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700' }}>
                    {template.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {template.subject || '(no subject)'}
                  </Text>
                </View>
                <View style={[styles.tag, { backgroundColor: t.muted }]}>
                  <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700' }}>
                    {TEMPLATE_CATEGORY_LABELS[template.category]}
                  </Text>
                </View>
              </View>

              <Text numberOfLines={2} style={{ color: t.mutedForeground, fontSize: fontSize.xs, lineHeight: 17 }}>
                {htmlToPlainText(template.body).slice(0, 160)}
              </Text>

              {template.variables?.length ? (
                <View style={styles.varRow}>
                  {template.variables.map((variable) => (
                    <View key={variable} style={[styles.varChip, { backgroundColor: t.muted }]}>
                      <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{`{{${variable}}}`}</Text>
                    </View>
                  ))}
                </View>
              ) : null}

              <View style={[styles.cardFooter, { borderTopColor: t.border }]}>
                <Pressable onPress={() => setEditing(template)} style={styles.cardAction}>
                  <Ionicons name="create-outline" size={15} color={t.primary} />
                  <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '600' }}>Edit</Text>
                </Pressable>
                <Pressable onPress={() => confirmDelete(template)} style={styles.cardAction}>
                  <Ionicons name="trash-outline" size={15} color={t.destructive} />
                  <Text style={{ color: t.destructive, fontSize: fontSize.xs, fontWeight: '600' }}>
                    Delete
                  </Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      <TemplateFormSheet
        visible={editing !== undefined}
        onClose={() => setEditing(undefined)}
        template={editing ?? null}
      />
    </View>
  );
}

function TemplateFormSheet({
  visible,
  onClose,
  template,
}: {
  visible: boolean;
  onClose: () => void;
  template: EmailTemplate | null;
}) {
  const t = useTheme();
  const editing = !!template;
  const { create, update } = useTemplateMutations();
  const [name, setName] = useState('');
  const [category, setCategory] = useState<TemplateCategory>('SUPPORT');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [preview, setPreview] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setName(template?.name ?? '');
    setCategory(template?.category ?? 'SUPPORT');
    setSubject(template?.subject ?? '');
    setBody(template?.body ?? '');
    setPreview(false);
  }, [visible, template]);

  const submit = async () => {
    const data = { name: name.trim(), category, subject, body };
    try {
      if (editing) await update.mutateAsync({ id: template!.id, data });
      else await create.mutateAsync(data);
      onClose();
    } catch {
      /* toast handled in the hook */
    }
  };

  const busy = create.isPending || update.isPending;

  return (
    <Sheet visible={visible} onClose={onClose} title={editing ? 'Edit template' : 'New template'}>
      <View style={{ gap: spacing.lg }}>
        <Input label="Name *" value={name} onChangeText={setName} placeholder="Quote follow-up" />
        <Select label="Category" value={category} options={CATEGORY_OPTIONS} onChange={(v) => setCategory(v as TemplateCategory)} />
        <Input
          label="Subject"
          value={subject}
          onChangeText={setSubject}
          placeholder="Following up on {{invoice}}"
        />

        <View style={{ gap: spacing.xs }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>
              Body (HTML allowed)
            </Text>
            <Pressable onPress={() => setPreview((v) => !v)} style={styles.previewToggle}>
              <Ionicons name={preview ? 'create-outline' : 'eye-outline'} size={14} color={t.primary} />
              <Text style={{ color: t.primary, fontSize: fontSize.xs, fontWeight: '600' }}>
                {preview ? 'Edit' : 'Preview'}
              </Text>
            </Pressable>
          </View>

          {preview ? (
            <View style={[styles.previewBox, { borderColor: t.border, backgroundColor: t.card }]}>
              <EmailBody html={applyTemplateVars(body)} />
            </View>
          ) : (
            <TextInput
              value={body}
              onChangeText={setBody}
              placeholder={'Hi {{customer}},\n\nThanks for reaching out…'}
              placeholderTextColor={t.mutedForeground}
              multiline
              style={[
                styles.textarea,
                { color: t.foreground, borderColor: t.border, backgroundColor: t.card },
              ]}
            />
          )}
        </View>

        <View style={styles.varRow}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Insert:</Text>
          {VARIABLES.map((variable) => (
            <Pressable
              key={variable}
              onPress={() => setBody((prev) => `${prev}${variable}`)}
              style={[styles.varChip, { backgroundColor: t.muted }]}
            >
              <Text style={{ color: t.mutedForeground, fontSize: 11 }}>{variable}</Text>
            </Pressable>
          ))}
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button title="Cancel" variant="outline" onPress={onClose} disabled={busy} style={{ flex: 1 }} />
          <Button
            title={editing ? 'Save changes' : 'Create template'}
            onPress={submit}
            loading={busy}
            disabled={!name.trim()}
            style={{ flex: 1 }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  filterBar: {
    flexGrow: 0,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
  },
  card: {
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  tag: { alignSelf: 'flex-start', borderRadius: radius.sm, paddingHorizontal: 7, paddingVertical: 3 },
  varRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  varChip: { borderRadius: radius.sm, paddingHorizontal: 6, paddingVertical: 3 },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
  },
  cardAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 4 },
  previewToggle: { flexDirection: 'row', alignItems: 'center', gap: 4, padding: 4 },
  previewBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.sm,
    minHeight: 140,
  },
  textarea: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 160,
    textAlignVertical: 'top',
  },
});

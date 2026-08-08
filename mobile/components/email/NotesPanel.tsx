import React, { useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View, useColorScheme } from 'react-native';
import { Text } from '../ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from '../ui';
import { relativeTime } from '../../lib/email/format';
import { useMentionableUsers, useNoteMutations } from '../../lib/email/hooks';
import type { ConversationNote, DirectoryUser } from '../../lib/email/types';
import { EmailAvatar } from './EmailAvatar';

/** Amber "private note" palette, matching the web panel in both schemes. */
const NOTE_COLORS = {
  light: {
    border: '#FCD34D',
    background: '#FFFBEB',
    divider: '#FDE68A',
    icon: '#B45309',
    heading: '#92400E',
    meta: '#A16207',
    author: '#78350F',
    countBg: '#FDE68A',
    countText: '#78350F',
    inputBg: '#FFFFFF',
  },
  dark: {
    border: '#78350F',
    background: '#251803',
    divider: '#78350F',
    icon: '#FBBF24',
    heading: '#FCD34D',
    meta: '#D97706',
    author: '#FCD34D',
    countBg: '#78350F',
    countText: '#FDE68A',
    inputBg: '#1A1206',
  },
} as const;

/** Render a note body with @mentions emphasised. */
function NoteBody({ body }: { body: string }) {
  const t = useTheme();
  const parts = body.split(/(@[\w][\w .'-]*)/g);
  return (
    <Text style={{ color: t.foreground, fontSize: fontSize.sm, lineHeight: 20 }}>
      {parts.map((part, i) =>
        part.startsWith('@') ? (
          <Text key={i} style={{ color: t.primary, fontWeight: '600' }}>
            {part}
          </Text>
        ) : (
          <Text key={i}>{part}</Text>
        )
      )}
    </Text>
  );
}

export function NotesPanel({
  conversationId,
  notes,
}: {
  conversationId: string;
  notes: ConversationNote[];
}) {
  const t = useTheme();
  const note = NOTE_COLORS[useColorScheme() === 'dark' ? 'dark' : 'light'];
  const inputRef = useRef<TextInput>(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [mentions, setMentions] = useState<Record<string, string>>({}); // name → userId
  const [query, setQuery] = useState<string | null>(null);
  const { data: users = [] } = useMentionableUsers(open);
  const { add, remove } = useNoteMutations(conversationId);

  const suggestions = useMemo(() => {
    if (query === null) return [];
    const q = query.toLowerCase();
    return users.filter((u) => u.name.toLowerCase().includes(q)).slice(0, 6);
  }, [query, users]);

  // A native TextInput reports no caret with the text change, so the mention
  // token is read from the end of the value — where notes are actually typed.
  const onChangeText = (value: string) => {
    setText(value);
    const match = value.match(/@(\w*)$/);
    setQuery(match ? match[1] : null);
  };

  const pickMention = (user: DirectoryUser) => {
    setText((prev) => prev.replace(/@(\w*)$/, `@${user.name} `));
    setMentions((prev) => ({ ...prev, [user.name]: user.id }));
    setQuery(null);
    inputRef.current?.focus();
  };

  const submit = async () => {
    if (!text.trim()) return;
    const ids = Object.entries(mentions)
      .filter(([name]) => text.includes(`@${name}`))
      .map(([, id]) => id);
    await add.mutateAsync({ body: text.trim(), mentions: ids });
    setText('');
    setMentions({});
    setQuery(null);
  };

  return (
    <View
      style={[
        styles.card,
        open
          ? { borderColor: note.border, backgroundColor: note.background }
          : { borderColor: t.border, backgroundColor: t.card },
      ]}
    >
      <Pressable
        onPress={() => setOpen((v) => !v)}
        style={[
          styles.header,
          open && { borderBottomColor: note.divider, borderBottomWidth: StyleSheet.hairlineWidth },
        ]}
      >
        <Ionicons name="reader-outline" size={16} color={open ? note.icon : t.mutedForeground} />
        <Text
          style={{
            flex: 1,
            color: open ? note.heading : t.foreground,
            fontSize: fontSize.sm,
            fontWeight: '700',
          }}
        >
          Internal notes
        </Text>
        {notes.length > 0 ? (
          <View style={[styles.count, { backgroundColor: note.countBg }]}>
            <Text style={{ color: note.countText, fontSize: 10, fontWeight: '700' }}>
              {notes.length}
            </Text>
          </View>
        ) : null}
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          color={open ? note.icon : t.mutedForeground}
        />
      </Pressable>

      {open ? (
        <View style={{ padding: spacing.md, gap: spacing.md }}>
          {notes.map((item) => (
            <View key={item.id} style={styles.noteRow}>
              <EmailAvatar name={item.author.name} size={26} />
              <View style={{ flex: 1, gap: 2 }}>
                <View style={styles.noteMeta}>
                  <Text style={{ color: note.author, fontSize: fontSize.xs, fontWeight: '600' }}>
                    {item.author.name}
                  </Text>
                  <Text style={{ flex: 1, color: note.meta, fontSize: 10 }}>
                    {relativeTime(item.createdAt)}
                  </Text>
                  <Pressable hitSlop={8} onPress={() => remove.mutate(item.id)} accessibilityLabel="Delete note">
                    <Ionicons name="trash-outline" size={13} color={note.icon} />
                  </Pressable>
                </View>
                <NoteBody body={item.body} />
              </View>
            </View>
          ))}

          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: note.meta, fontSize: 11 }}>
              Private — never sent to the customer. Use @ to mention a teammate.
            </Text>

            {query !== null && suggestions.length > 0 ? (
              <View style={[styles.suggestions, { backgroundColor: t.card, borderColor: t.border }]}>
                {suggestions.map((user) => (
                  <Pressable
                    key={user.id}
                    onPress={() => pickMention(user)}
                    style={({ pressed }) => [
                      styles.suggestion,
                      { backgroundColor: pressed ? t.accent : 'transparent' },
                    ]}
                  >
                    <Ionicons name="at-outline" size={14} color={t.mutedForeground} />
                    <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.sm }}>{user.name}</Text>
                    <Text style={{ color: t.mutedForeground, fontSize: 10 }}>{user.role}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={onChangeText}
              placeholder="Add a private note…"
              placeholderTextColor={t.mutedForeground}
              multiline
              style={[
                styles.input,
                { color: t.foreground, borderColor: note.divider, backgroundColor: note.inputBg },
              ]}
            />

            <Button
              title="Add note"
              size="sm"
              onPress={submit}
              disabled={!text.trim()}
              loading={add.isPending}
              style={{ alignSelf: 'flex-end', paddingHorizontal: spacing.lg }}
            />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  count: { borderRadius: radius.full, paddingHorizontal: 6, paddingVertical: 1 },
  noteRow: { flexDirection: 'row', gap: spacing.sm },
  noteMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  suggestions: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  suggestion: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.sm,
    minHeight: 64,
    textAlignVertical: 'top',
  },
});

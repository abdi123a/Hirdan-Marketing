import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface EmailChipsInputHandle {
  /**
   * Commit whatever is still typed in the field (e.g. right before Send) and
   * return the resulting address list. React state updates are async, so callers
   * must use the returned array rather than the current `value` prop.
   */
  commitPending: () => string[];
}

interface Props {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

/**
 * Recipient field that turns typed addresses into chips. Commas, semicolons and
 * spaces commit the current address, matching the web composer.
 */
export const EmailChipsInput = forwardRef<EmailChipsInputHandle, Props>(function EmailChipsInput(
  { value, onChange, placeholder, autoFocus },
  ref
) {
  const t = useTheme();
  const [input, setInput] = useState('');
  const [invalid, setInvalid] = useState(false);

  const commit = (raw: string, base: string[] = value): string[] => {
    const parts = raw
      .split(/[,;\s]+/)
      .map((part) => part.trim().toLowerCase())
      .filter(Boolean);
    const valid = parts.filter((part) => EMAIL_RE.test(part) && !base.includes(part));
    const rejected = parts.filter((part) => !EMAIL_RE.test(part));
    const next = valid.length ? [...base, ...valid] : base;
    if (valid.length) onChange(next);
    setInvalid(rejected.length > 0);
    setInput(rejected.join(' '));
    return next;
  };

  useImperativeHandle(
    ref,
    () => ({
      commitPending: () => {
        if (!input.trim()) return value;
        return commit(`${input} `, value);
      },
    }),
    [input, value]
  );

  const onChangeText = (next: string) => {
    if (/[,;\s]$/.test(next)) {
      commit(next);
      return;
    }
    setInvalid(false);
    setInput(next);
  };

  return (
    <View>
      <View style={styles.wrap}>
        {value.map((email) => (
          <View key={email} style={[styles.chip, { backgroundColor: t.muted, borderColor: t.border }]}>
            <Text style={{ color: t.foreground, fontSize: fontSize.xs }}>{email}</Text>
            <Pressable
              hitSlop={8}
              onPress={() => onChange(value.filter((v) => v !== email))}
              accessibilityLabel={`Remove ${email}`}
            >
              <Ionicons name="close" size={13} color={t.mutedForeground} />
            </Pressable>
          </View>
        ))}
        <TextInput
          value={input}
          onChangeText={onChangeText}
          onSubmitEditing={() => input.trim() && commit(`${input} `)}
          onBlur={() => input.trim() && commit(`${input} `)}
          onKeyPress={(e) => {
            if (e.nativeEvent.key === 'Backspace' && !input && value.length) {
              onChange(value.slice(0, -1));
            }
          }}
          placeholder={value.length ? '' : placeholder}
          placeholderTextColor={t.mutedForeground}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          autoFocus={autoFocus}
          blurOnSubmit={false}
          style={[styles.input, { color: t.foreground }]}
        />
      </View>
      {invalid ? (
        <Text style={{ color: t.destructive, fontSize: 11 }}>
          That doesn’t look like an email address.
        </Text>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  input: {
    flexGrow: 1,
    minWidth: 140,
    fontSize: fontSize.sm,
    paddingVertical: 6,
  },
});

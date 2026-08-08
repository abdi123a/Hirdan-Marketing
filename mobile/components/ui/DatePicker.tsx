import React, { useMemo, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';
import { Text } from './Text';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { spacing, fontSize, radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Button } from './Button';
import { Sheet } from './Sheet';

function parseIsoDate(value?: string | null): Date {
  if (!value) return new Date();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
  if (m) {
    return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12, 0, 0);
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDisplay(value?: string | null): string {
  if (!value) return 'Select date';
  const d = parseIsoDate(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function DatePickerField({
  label,
  value,
  onChange,
  placeholder = 'Select date',
  minimumDate,
  maximumDate,
  error,
  optional,
}: {
  label: string;
  value: string;
  onChange: (isoDate: string) => void;
  placeholder?: string;
  minimumDate?: Date;
  maximumDate?: Date;
  error?: string;
  /** When true, shows a Clear action in the sheet */
  optional?: boolean;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(() => parseIsoDate(value));

  const display = useMemo(() => (value ? formatDisplay(value) : placeholder), [value, placeholder]);

  const openPicker = () => {
    setDraft(parseIsoDate(value));
    setOpen(true);
  };

  const commit = (d: Date) => {
    onChange(toIsoDate(d));
    setOpen(false);
  };

  const onAndroidChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (event.type === 'dismissed') {
      setOpen(false);
      return;
    }
    if (selected) commit(selected);
    else setOpen(false);
  };

  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={openPicker}
        style={[
          styles.field,
          {
            borderColor: error ? t.destructive : t.border,
            backgroundColor: t.card,
          },
        ]}
      >
        <Text
          style={{
            color: value ? t.foreground : t.mutedForeground,
            fontSize: fontSize.md,
            flex: 1,
          }}
        >
          {display}
        </Text>
        <Ionicons name="calendar-outline" size={18} color={t.mutedForeground} />
      </Pressable>
      {error ? (
        <Text style={{ color: t.destructive, fontSize: fontSize.xs }}>{error}</Text>
      ) : null}

      {Platform.OS === 'android' && open ? (
        <DateTimePicker
          value={draft}
          mode="date"
          display="default"
          onChange={onAndroidChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      ) : null}

      {Platform.OS === 'ios' ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
          <View style={{ gap: spacing.md }}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="spinner"
              onChange={(_, selected) => {
                if (selected) setDraft(selected);
              }}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
              style={{ alignSelf: 'center' }}
            />
            <Button title="Confirm" onPress={() => commit(draft)} />
            {optional && value ? (
              <Button
                title="Clear"
                variant="ghost"
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              />
            ) : null}
            <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} />
          </View>
        </Sheet>
      ) : null}

      {Platform.OS === 'web' && open ? (
        <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
          <View style={{ gap: spacing.md }}>
            <DateTimePicker
              value={draft}
              mode="date"
              display="default"
              onChange={(_, selected) => {
                if (selected) setDraft(selected);
              }}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
            <Button title="Confirm" onPress={() => commit(draft)} />
            {optional && value ? (
              <Button
                title="Clear"
                variant="ghost"
                onPress={() => {
                  onChange('');
                  setOpen(false);
                }}
              />
            ) : null}
            <Button title="Cancel" variant="outline" onPress={() => setOpen(false)} />
          </View>
        </Sheet>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
});

import React, { useCallback } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Switch as RNSwitch,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { withAlpha } from './Badge';
import { Text } from './Text';

export interface SwitchRowProps {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
  disabled?: boolean;
  description?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Labelled toggle.
 *
 * The whole row is the target, not just the switch — a 50pt control at the far
 * edge of the screen is an awkward reach on a large phone.
 */
export function SwitchRow({
  label,
  value,
  onValueChange,
  disabled,
  description,
  style,
}: SwitchRowProps) {
  const t = useTheme();

  const toggle = useCallback(() => {
    if (disabled) return;
    void Haptics.selectionAsync();
    onValueChange(!value);
  }, [disabled, onValueChange, value]);

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: Boolean(disabled) }}
      accessibilityLabel={label}
      accessibilityHint={description}
      onPress={toggle}
      style={[styles.row, disabled ? { opacity: 0.5 } : null, style]}
    >
      <View style={styles.copy}>
        <Text variant="title">{label}</Text>
        {description ? (
          <Text variant="subtext" color="muted">
            {description}
          </Text>
        ) : null}
      </View>

      <RNSwitch
        value={value}
        onValueChange={toggle}
        disabled={disabled}
        // `withAlpha` rather than string concatenation: appending '88' to a
        // token silently produces an invalid colour once that token is an
        // rgba() value.
        trackColor={{ false: t.borderStrong, true: withAlpha(t.primary, 0.55) }}
        thumbColor={Platform.OS === 'android' ? (value ? t.primary : t.card) : undefined}
        ios_backgroundColor={t.borderStrong}
        // Row press already handles the tap; this keeps the switch from
        // swallowing it and firing the change twice.
        pointerEvents="none"
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.lg,
    paddingVertical: spacing.md,
    minHeight: 56,
  },
  copy: { flex: 1, gap: 2 },
});

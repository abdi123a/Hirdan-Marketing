import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing } from '../../constants/theme';
import { pressScale } from '../../constants/motion';
import { useTheme } from '../../hooks/useTheme';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Trailing ✕ for chips that represent a removable filter. */
  onRemove?: () => void;
  count?: number;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}

/** Filter pill. Selection is carried by fill, not just by a border. */
export function Chip({
  label,
  selected,
  onPress,
  icon,
  onRemove,
  count,
  disabled,
  style,
}: ChipProps) {
  const t = useTheme();

  const bg = selected ? t.primary : t.surfaceSunken;
  const fg = selected ? t.primaryForeground : t.foreground;
  const border = selected ? t.primary : t.borderSubtle;

  const body = (
    <>
      {icon ? <Ionicons name={icon} size={14} color={fg} /> : null}
      <Text variant="label" style={{ color: fg }} numberOfLines={1}>
        {label}
      </Text>
      {typeof count === 'number' ? (
        <View
          style={[
            styles.count,
            { backgroundColor: selected ? 'rgba(255,255,255,0.22)' : t.muted },
          ]}
        >
          <Text variant="overline" style={{ color: fg }}>
            {count}
          </Text>
        </View>
      ) : null}
      {onRemove ? <Ionicons name="close" size={14} color={fg} /> : null}
    </>
  );

  const chipStyle: StyleProp<ViewStyle> = [
    styles.chip,
    { backgroundColor: bg, borderColor: border },
    style,
  ];

  if (!onPress && !onRemove) {
    return <View style={chipStyle}>{body}</View>;
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected), disabled }}
      disabled={disabled}
      scaleTo={pressScale.control}
      haptic="none"
      onPress={onRemove ?? onPress}
      style={chipStyle}
    >
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.full,
    borderWidth: 1,
    minHeight: 38,
  },
  count: {
    minWidth: 20,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

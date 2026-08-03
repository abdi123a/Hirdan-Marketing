import React from 'react';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useResponsive } from '../hooks/useTheme';
import { spacing } from '../constants/theme';

/**
 * Phone: single column. Tablet: optional two-pane split (list | detail).
 */
export function SplitView({
  list,
  detail,
  showDetail = true,
  style,
}: {
  list: React.ReactNode;
  detail?: React.ReactNode;
  showDetail?: boolean;
  style?: ViewProps['style'];
}) {
  const { isTablet, isLandscape } = useResponsive();
  const split = isTablet || isLandscape;

  if (!split || !detail) {
    return <View style={[{ flex: 1 }, style]}>{list}</View>;
  }

  return (
    <View style={[styles.row, style]}>
      <View style={[styles.pane, styles.listPane]}>{list}</View>
      {showDetail ? <View style={[styles.pane, styles.detailPane]}>{detail}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1 },
  listPane: { maxWidth: 420, borderRightWidth: StyleSheet.hairlineWidth },
  detailPane: { flex: 1.4, padding: spacing.md },
});

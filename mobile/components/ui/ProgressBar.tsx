import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function ProgressBar({
  progress,
  color,
  trackColor,
  height = 8,
}: {
  progress: number;
  color?: string;
  trackColor?: string;
  height?: number;
}) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.track, { backgroundColor: trackColor || t.muted, height }]}>
      <View
        style={[
          styles.fill,
          { width: `${pct}%`, backgroundColor: color || t.primary, height },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { borderRadius: radius.full, overflow: 'hidden' },
  fill: { borderRadius: radius.full },
});

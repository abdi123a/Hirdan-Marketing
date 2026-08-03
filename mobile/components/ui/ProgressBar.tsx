import React from 'react';
import { StyleSheet, View } from 'react-native';
import { radius } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function ProgressBar({ progress }: { progress: number }) {
  const t = useTheme();
  const pct = Math.max(0, Math.min(100, progress));
  return (
    <View style={[styles.track, { backgroundColor: t.muted }]}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: t.primary }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.full, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.full },
});

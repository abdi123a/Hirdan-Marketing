import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { radius, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function Avatar({ name, size = 40 }: { name: string; size?: number }) {
  const t = useTheme();
  const initials = name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: t.primary,
        },
      ]}
    >
      <Text style={{ color: t.primaryForeground, fontWeight: '700', fontSize: size * 0.35 }}>
        {initials || '?'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});

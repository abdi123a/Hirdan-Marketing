import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { spacing, fontSize } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';

export function Tabs({
  tabs,
  value,
  onChange,
}: {
  tabs: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  const t = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: t.border }]}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        return (
          <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tab}>
            <Text
              style={{
                color: active ? t.primary : t.mutedForeground,
                fontWeight: active ? '700' : '500',
                fontSize: fontSize.sm,
              }}
            >
              {tab.label}
            </Text>
            {active ? <View style={[styles.indicator, { backgroundColor: t.primary }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
  },
  tab: { paddingVertical: spacing.md, position: 'relative' },
  indicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderRadius: 1,
  },
});

import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { platformColor, platformIconSource, platformLabel } from '../../lib/social';
import { useTheme } from '../../hooks/useTheme';

export function PlatformIcon({
  platform,
  size = 16,
  rounded = true,
}: {
  platform?: string | null;
  size?: number;
  rounded?: boolean;
}) {
  const t = useTheme();
  const src = platformIconSource(platform);
  if (src) {
    return (
      <Image
        source={src}
        style={{
          width: size,
          height: size,
          borderRadius: rounded ? 3 : 0,
        }}
        resizeMode="contain"
        accessibilityLabel={platformLabel(platform)}
      />
    );
  }
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: platformColor(platform) + '33',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text style={{ color: t.foreground, fontSize: size * 0.45, fontWeight: '800' }}>
        {(platform || '?').slice(0, 1).toUpperCase()}
      </Text>
    </View>
  );
}

export function PlatformIconStack({
  platforms,
  size = 14,
  max = 5,
}: {
  platforms: string[];
  size?: number;
  max?: number;
}) {
  const t = useTheme();
  const unique = Array.from(new Set(platforms.map((p) => p.toLowerCase()).filter(Boolean)));
  const shown = unique.slice(0, max);
  const extra = unique.length - shown.length;

  return (
    <View style={styles.stack}>
      {shown.map((p, i) => (
        <View
          key={`${p}-${i}`}
          style={[
            styles.stackItem,
            {
              marginLeft: i === 0 ? 0 : -4,
              zIndex: shown.length - i,
              backgroundColor: t.card,
              borderColor: t.border,
              width: size + 6,
              height: size + 6,
              borderRadius: (size + 6) / 2,
            },
          ]}
        >
          <PlatformIcon platform={p} size={size} />
        </View>
      ))}
      {extra > 0 ? (
        <Text style={{ color: t.mutedForeground, fontSize: 10, fontWeight: '700', marginLeft: 4 }}>
          +{extra}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { flexDirection: 'row', alignItems: 'center' },
  stackItem: {
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});

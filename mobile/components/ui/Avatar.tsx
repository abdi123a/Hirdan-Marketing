import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { brand } from '../../constants/theme';
import { font } from '../../constants/typography';
import { useTheme } from '../../hooks/useTheme';
import { Text } from './Text';

export interface AvatarProps {
  name?: string | null;
  initials?: string | null;
  /** Remote or local image. Falls back to initials while loading or on error. */
  uri?: string | null;
  size?: number;
  /** Presence dot in the corner. */
  status?: 'online' | 'offline' | 'busy';
  style?: StyleProp<ViewStyle>;
}

/**
 * Six-way palette so a list of people isn't a wall of identical purple discs.
 * The colour is derived from the name, so someone keeps the same one
 * everywhere they appear.
 */
const PALETTE = [
  brand.purple,
  '#2F6FB5',
  '#0F8A6D',
  '#B5562F',
  '#7A3E9D',
  '#B5912F',
] as const;

function hashIndex(seed: string, buckets: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) {
    h = (h * 31 + seed.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % buckets;
}

export function Avatar({ name, initials: initialsProp, uri, size = 40, status, style }: AvatarProps) {
  const t = useTheme();
  const [failed, setFailed] = React.useState(false);

  const initials =
    (initialsProp || '').trim().slice(0, 2).toUpperCase() ||
    (name || '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase())
      .join('');

  const seed = (name || initialsProp || '?').trim().toLowerCase();
  const background = PALETTE[hashIndex(seed, PALETTE.length)];
  const showImage = Boolean(uri) && !failed;

  const dot = size * 0.28;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <View
        style={[
          styles.avatar,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            backgroundColor: showImage ? t.muted : background,
          },
        ]}
      >
        {showImage ? (
          <Image
            source={{ uri: uri as string }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={180}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text
            style={[font(600), { color: '#FFFFFF', fontSize: size * 0.36 }]}
            numberOfLines={1}
          >
            {initials || '?'}
          </Text>
        )}
      </View>

      {status ? (
        <View
          style={[
            styles.status,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              // Ring in the surface colour so the dot reads as sitting on the
              // avatar rather than punched through it.
              borderColor: t.card,
              borderWidth: Math.max(1.5, dot * 0.18),
              backgroundColor:
                status === 'online' ? t.success : status === 'busy' ? t.destructive : t.subtleForeground,
            },
          ]}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  status: {
    position: 'absolute',
    right: 0,
    bottom: 0,
  },
});

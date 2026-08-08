import React, { useEffect, useState } from 'react';
import { Image as RNImage, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { Image, type ImageSource } from 'expo-image';
import { endpoints } from '@hirdan/shared';
import { getFullUrl } from '../../lib/api-client';
import { getAccessToken } from '../../lib/secure-storage';
import { platformIconSource, platformLabel } from '../../lib/social';
import { useTheme } from '../../hooks/useTheme';
import { fontSize } from '../../constants/theme';

type Props = {
  /** Connected SocialAccount id — preferred; loads the exact photo via API proxy. */
  accountId?: string | null;
  avatarUrl?: string | null;
  name?: string | null;
  platform?: string | null;
  size?: number;
  showPlatformBadge?: boolean;
  borderColor?: string;
};

function initialsFrom(name?: string | null): string {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return '?';
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('');
}

export function resolveAvatarUri(avatarUrl?: string | null): string | null {
  if (!avatarUrl) return null;
  const trimmed = String(avatarUrl).trim();
  if (!trimmed) return null;
  return getFullUrl(trimmed);
}

/**
 * Profile picture + platform badge — same treatment as the web Accounts /
 * Compose account picker. Prefer `accountId` so photos load through our
 * authenticated avatar proxy (Meta CDN URLs often fail in React Native).
 */
export function SocialAccountAvatar({
  accountId,
  avatarUrl,
  name,
  platform,
  size = 44,
  showPlatformBadge = true,
  borderColor,
}: Props) {
  const t = useTheme();
  const [source, setSource] = useState<ImageSource | null>(null);
  const [failed, setFailed] = useState(false);
  const badgeSize = Math.max(16, Math.round(size * 0.4));
  const platformSrc = platformIconSource(platform);
  const initials = initialsFrom(name || platformLabel(platform));

  useEffect(() => {
    let cancelled = false;
    setFailed(false);

    (async () => {
      if (accountId) {
        const token = await getAccessToken();
        if (cancelled) return;
        setSource({
          uri: getFullUrl(endpoints.social.accountAvatar(accountId)),
          headers: {
            'X-Client-Platform': 'mobile',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        return;
      }

      const direct = resolveAvatarUri(avatarUrl);
      if (cancelled) return;
      setSource(direct ? { uri: direct } : null);
    })();

    return () => {
      cancelled = true;
    };
  }, [accountId, avatarUrl]);

  const showImage = !!source && !failed;

  return (
    <View style={{ width: size, height: size }}>
      <View
        style={[
          styles.ring,
          {
            width: size,
            height: size,
            borderRadius: size / 2,
            borderColor: borderColor || t.border,
            backgroundColor: t.muted,
          },
        ]}
      >
        {showImage ? (
          <Image
            source={source}
            style={{ width: '100%', height: '100%' }}
            contentFit="cover"
            cachePolicy="memory-disk"
            transition={100}
            onError={() => {
              // Proxy failed — fall back to the raw CDN URL once (like the web <img>).
              if (accountId && avatarUrl && source && typeof source === 'object' && 'uri' in source) {
                const proxyUri = getFullUrl(endpoints.social.accountAvatar(accountId));
                if (source.uri === proxyUri) {
                  const direct = resolveAvatarUri(avatarUrl);
                  if (direct) {
                    setSource({ uri: direct });
                    return;
                  }
                }
              }
              setFailed(true);
            }}
            accessibilityLabel={name || platformLabel(platform)}
          />
        ) : (
          <View
            style={[
              styles.fallback,
              {
                width: '100%',
                height: '100%',
                backgroundColor: t.primary + '22',
              },
            ]}
          >
            <Text
              style={{
                color: t.primary,
                fontWeight: '800',
                fontSize: size >= 40 ? fontSize.md : fontSize.xs,
              }}
            >
              {initials}
            </Text>
          </View>
        )}
      </View>

      {showPlatformBadge && platform ? (
        <View
          style={[
            styles.badge,
            {
              width: badgeSize,
              height: badgeSize,
              borderRadius: badgeSize / 2,
              backgroundColor: t.card,
              borderColor: t.border,
              right: -2,
              bottom: -2,
            },
          ]}
        >
          {platformSrc ? (
            <RNImage
              source={platformSrc}
              style={{ width: badgeSize * 0.72, height: badgeSize * 0.72 }}
              resizeMode="contain"
            />
          ) : (
            <Text style={{ fontSize: badgeSize * 0.4, fontWeight: '800', color: t.foreground }}>
              {(platform || '?').slice(0, 1).toUpperCase()}
            </Text>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: {
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  badge: {
    position: 'absolute',
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    zIndex: 2,
  },
});

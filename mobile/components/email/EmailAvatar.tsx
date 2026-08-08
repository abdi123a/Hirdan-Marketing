import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { avatarColor, initials as toInitials } from '../../lib/email/format';

export function EmailAvatar({
  name,
  email,
  size = 36,
}: {
  name?: string | null;
  email?: string | null;
  size?: number;
}) {
  const seed = email || name || '?';
  return (
    <View
      style={[
        styles.avatar,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: avatarColor(seed),
        },
      ]}
    >
      <Text style={{ color: '#fff', fontWeight: '700', fontSize: Math.round(size * 0.36) }}>
        {toInitials(name, email)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
});

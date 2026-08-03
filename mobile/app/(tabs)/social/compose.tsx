import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch, apiUpload } from '../../../lib/api-client';
import { Button, Input, useToast } from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing, fontSize, radius } from '../../../constants/theme';

type PickedImage = { uri: string; name: string; type: string };

export default function SocialComposeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [caption, setCaption] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [image, setImage] = useState<PickedImage | null>(null);

  const pickImage = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Photo library permission is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.85,
      allowsEditing: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setImage({
        uri: asset.uri,
        name: asset.fileName || `post-${Date.now()}.jpg`,
        type: asset.mimeType || 'image/jpeg',
      });
    }
  };

  const mutation = useMutation({
    mutationFn: async () => {
      if (image) {
        const form = new FormData();
        form.append('caption', caption.trim());
        if (scheduleDate) form.append('scheduledAt', scheduleDate);
        form.append('image', {
          uri: image.uri,
          name: image.name,
          type: image.type,
        } as unknown as Blob);
        return apiUpload(endpoints.social.posts, form);
      }

      return apiFetch(endpoints.social.posts, {
        method: 'POST',
        body: JSON.stringify({
          caption: caption.trim(),
          content: caption.trim(),
          scheduledAt: scheduleDate || undefined,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      toast('Post scheduled', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Input
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Write your post…"
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />
        <Input
          label="Schedule (ISO date/time)"
          value={scheduleDate}
          onChangeText={setScheduleDate}
          placeholder="2026-08-10T14:00:00Z"
          autoCapitalize="none"
        />

        <View style={styles.imageSection}>
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>Image</Text>
          {image ? <Image source={{ uri: image.uri }} style={styles.preview} /> : null}
          <Pressable onPress={pickImage} style={[styles.pickBtn, { borderColor: t.border }]}>
            <Text style={{ color: t.primary, fontWeight: '600' }}>{image ? 'Change image' : 'Add image'}</Text>
          </Pressable>
        </View>

        <Button
          title="Schedule post"
          loading={mutation.isPending}
          disabled={!caption.trim()}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md },
  imageSection: { gap: spacing.sm },
  preview: { width: '100%', height: 200, borderRadius: radius.md },
  pickBtn: {
    borderWidth: 1,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
});

import React, { useEffect, useMemo, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import {
  accountDisplayName,
  combineLocalDateTime,
  createCampaign,
  createSocialPost,
  fetchAccountsByClient,
  fetchCampaigns,
  fetchSocialPost,
  generateAiCaption,
  platformLabel,
  publishSocialPostNow,
  type SocialAccount,
  updateSocialPost,
  uploadSocialMedia,
} from '../../../lib/social';
import { PlatformIcon } from '../../../components/social/PlatformIcon';
import { SocialAccountAvatar } from '../../../components/social/SocialAccountAvatar';
import {
  Button,
  Chip,
  Input,
  ProgressBar,
  SegmentedControl,
  Select,
  FormSkeleton,
  SkeletonListRow,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { useClientsWithSocialAccounts } from '../../../hooks/useClientsWithSocialAccounts';
import { fontSize, radius, spacing } from '../../../constants/theme';

type PickedMedia = { uri: string; name: string; type: string; kind: 'image' | 'video' };
type Mode = 'schedule' | 'now' | 'draft';

export default function SocialComposeScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ editId?: string; clientId?: string }>();
  const editId = typeof params.editId === 'string' ? params.editId : undefined;

  const [clientId, setClientId] = useState(params.clientId || '');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([]);
  const [caption, setCaption] = useState('');
  const [campaignId, setCampaignId] = useState('');
  const [mode, setMode] = useState<Mode>('schedule');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState('10:00');
  const [media, setMedia] = useState<PickedMedia[]>([]);
  const [aiPrompt, setAiPrompt] = useState('');
  const [newCampaign, setNewCampaign] = useState('');
  const [igType, setIgType] = useState('post');
  const [fbType, setFbType] = useState('post');
  const [tiktokMode, setTiktokMode] = useState<'direct' | 'draft'>('direct');
  const [youtubeType, setYoutubeType] = useState('short');
  const [youtubePrivacy, setYoutubePrivacy] = useState('public');
  const [youtubeTitle, setYoutubeTitle] = useState('');
  const [firstComment, setFirstComment] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [publishProgress, setPublishProgress] = useState<{
    done: number;
    total: number;
    failed: number;
    message: string;
  } | null>(null);

  const editQ = useQuery({
    queryKey: ['social-post', editId],
    queryFn: () => fetchSocialPost(editId!),
    enabled: !!editId,
  });

  const socialClients = useClientsWithSocialAccounts({
    includeClientId: editQ.data?.clientId || (params.clientId as string | undefined),
  });

  const accountsQ = useQuery({
    queryKey: ['social-by-client', clientId],
    queryFn: () => fetchAccountsByClient(clientId),
    enabled: !!clientId,
  });

  const campaignsQ = useQuery({
    queryKey: ['social-campaigns', clientId],
    queryFn: () => fetchCampaigns(clientId),
    enabled: !!clientId,
  });

  useEffect(() => {
    const post = editQ.data;
    if (!post) return;
    setClientId(post.clientId);
    setCaption(post.caption || '');
    setCampaignId(post.campaignId || '');
    setSelectedAccounts(post.destinations?.map((d) => d.socialAccountId) || []);
    if (post.scheduledFor) {
      const d = new Date(post.scheduledFor);
      setDate(d.toISOString().slice(0, 10));
      setTime(
        `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      );
      setMode('schedule');
    } else if (post.status === 'DRAFT') {
      setMode('draft');
    }
    const urls = Array.isArray(post.mediaUrls) ? post.mediaUrls : [];
    if (urls.length) {
      setMedia(
        urls.map((uri, i) => ({
          uri,
          name: `existing-${i}`,
          type: (post.mediaType || 'image').includes('video') ? 'video/mp4' : 'image/jpeg',
          kind: (post.mediaType || 'image').includes('video') ? 'video' : 'image',
        }))
      );
    }
  }, [editQ.data]);

  const clientOptions = socialClients.options;

  // Drop a stale selected client if it has no social accounts (except while editing / deep-linked).
  useEffect(() => {
    if (!clientId || socialClients.isLoading || editId || params.clientId) return;
    if (!clientOptions.some((o) => o.value === clientId)) {
      setClientId('');
      setSelectedAccounts([]);
    }
  }, [clientId, socialClients.isLoading, clientOptions, editId, params.clientId]);

  const campaignOptions = useMemo(
    () => [
      { label: 'No campaign', value: '' },
      ...(campaignsQ.data || []).map((c) => ({ label: c.name, value: c.id })),
    ],
    [campaignsQ.data]
  );

  const accounts = accountsQ.data || [];

  const toggleAccount = (id: string) => {
    setSelectedAccounts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const pickMedia = async (videos: boolean) => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      toast('Media library permission is required', 'error');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: videos ? ['videos'] : ['images'],
      quality: 0.85,
      allowsMultipleSelection: !videos,
      selectionLimit: videos ? 1 : 6,
    });
    if (result.canceled) return;
    const next: PickedMedia[] = result.assets.map((asset, i) => ({
      uri: asset.uri,
      name: asset.fileName || `media-${Date.now()}-${i}.${videos ? 'mp4' : 'jpg'}`,
      type: asset.mimeType || (videos ? 'video/mp4' : 'image/jpeg'),
      kind: videos ? 'video' : 'image',
    }));
    setMedia((prev) => (videos ? next : [...prev, ...next].slice(0, 6)));
  };

  const createCampaignM = useMutation({
    mutationFn: () => {
      if (!clientId || !newCampaign.trim()) throw new Error('Enter a campaign name');
      return createCampaign(clientId, newCampaign.trim());
    },
    onSuccess: (c) => {
      setCampaignId(c.id);
      setNewCampaign('');
      queryClient.invalidateQueries({ queryKey: ['social-campaigns', clientId] });
      toast('Campaign created', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const selectedPlatforms = useMemo(() => {
    return Array.from(
      new Set(
        accounts
          .filter((a) => selectedAccounts.includes(a.id))
          .map((a) => a.platform.toLowerCase())
      )
    );
  }, [accounts, selectedAccounts]);

  const aiM = useMutation({
    mutationFn: async () => {
      const platform = accounts.find((a) => selectedAccounts.includes(a.id))?.platform || 'instagram';
      const prompt = aiPrompt.trim() || caption.trim() || 'Write an engaging social media caption';
      return generateAiCaption(prompt, platform);
    },
    onSuccess: (text) => {
      if (text) setCaption(text);
      toast('Caption generated', 'success');
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const saveM = useMutation({
    mutationFn: async () => {
      if (!clientId) throw new Error('Select a client');
      if (selectedAccounts.length === 0) throw new Error('Select at least one account');
      if (!caption.trim() && media.length === 0) {
        throw new Error('Add a caption or media');
      }
      if (mode === 'schedule' && !date) throw new Error('Pick a schedule date');

      const remoteUrls: string[] = [];
      let mediaType = 'text';
      for (const item of media) {
        if (item.uri.startsWith('http://') || item.uri.startsWith('https://')) {
          remoteUrls.push(item.uri);
          mediaType = item.kind === 'video' ? 'video' : media.length > 1 ? 'carousel' : 'image';
          continue;
        }
        const url = await uploadSocialMedia(item);
        remoteUrls.push(url);
        mediaType = item.kind === 'video' ? 'video' : media.length > 1 ? 'carousel' : 'image';
      }

      const scheduledFor =
        mode === 'schedule' ? combineLocalDateTime(date, time) : null;
      const status = mode === 'draft' ? 'DRAFT' : mode === 'schedule' ? 'SCHEDULED' : 'DRAFT';

      const platformContent: Record<string, unknown> = {
        syncedPlatforms: selectedPlatforms,
        activities: [
          {
            id: Math.random().toString(36).slice(2, 9),
            type: 'system',
            message: editId ? 'Post updated from mobile' : 'Draft created from mobile',
            createdAt: new Date().toISOString(),
          },
        ],
      };
      if (selectedPlatforms.includes('instagram')) {
        platformContent.instagram = {
          caption: caption.trim(),
          type: igType,
          firstComment: firstComment || undefined,
        };
      }
      if (selectedPlatforms.includes('facebook')) {
        platformContent.facebook = {
          caption: caption.trim(),
          type: fbType,
          firstComment: firstComment || undefined,
        };
      }
      if (selectedPlatforms.includes('tiktok')) {
        platformContent.tiktok = {
          caption: caption.trim(),
          postMode: tiktokMode,
          type: mediaType === 'image' || mediaType === 'carousel' ? 'photo' : 'video',
        };
      }
      if (selectedPlatforms.includes('youtube')) {
        platformContent.youtube = {
          caption: caption.trim(),
          title: youtubeTitle || caption.trim().slice(0, 100),
          type: youtubeType,
          privacy: youtubePrivacy,
        };
      }
      if (selectedPlatforms.includes('linkedin')) {
        platformContent.linkedin = {
          caption: caption.trim(),
          firstComment: firstComment || undefined,
        };
      }
      if (selectedPlatforms.includes('x') || selectedPlatforms.includes('twitter')) {
        platformContent.x = { caption: caption.trim() };
      }
      if (selectedPlatforms.includes('threads')) {
        platformContent.threads = { caption: caption.trim() };
      }
      if (selectedPlatforms.includes('pinterest')) {
        platformContent.pinterest = { caption: caption.trim() };
      }

      const payload = {
        clientId,
        accountIds: selectedAccounts,
        caption: caption.trim(),
        mediaUrls: remoteUrls,
        mediaType: remoteUrls.length ? mediaType : 'text',
        scheduledFor,
        status,
        campaignId: campaignId || null,
        platformContent,
      };

      let postId = editId;
      if (editId) {
        await updateSocialPost(editId, payload);
      } else {
        const created = await createSocialPost(payload);
        postId = created.id;
      }

      if (mode === 'now' && postId) {
        setPublishing(true);
        setPublishProgress({
          done: 0,
          total: selectedAccounts.length,
          failed: 0,
          message: 'Publishing…',
        });
        try {
          const finalPost = await publishSocialPostNow(postId, selectedAccounts);
          const done = finalPost.destinations.filter((d) => d.status === 'PUBLISHED').length;
          const failed = finalPost.destinations.filter((d) => d.status === 'FAILED').length;
          setPublishProgress({
            done,
            total: finalPost.destinations.length,
            failed,
            message: failed > 0 ? 'Published with errors' : 'Published successfully',
          });
          return { postId, published: true, failed };
        } finally {
          setPublishing(false);
        }
      }

      return { postId, published: false, failed: 0 };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['social-posts'] });
      queryClient.invalidateQueries({ queryKey: ['social-post'] });
      if (result.published) {
        toast(
          result.failed > 0 ? 'Published with some failures' : 'Published',
          result.failed > 0 ? 'error' : 'success'
        );
      } else {
        toast(mode === 'draft' ? 'Draft saved' : 'Post scheduled', 'success');
      }
      if (result.postId) {
        router.replace(`/(tabs)/social/post/${result.postId}`);
      } else {
        router.back();
      }
    },
    onError: (e: Error) => {
      setPublishing(false);
      toast(e.message, 'error');
    },
  });

  const primaryLabel =
    mode === 'now' ? 'Publish now' : mode === 'draft' ? 'Save draft' : 'Schedule post';

  if (editId && editQ.isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: t.background }}>
        <FormSkeleton />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        {socialClients.isLoading ? (
          <FormSkeleton fields={1} padding={0} />
        ) : clientOptions.length === 0 ? (
          <View style={[styles.emptyBox, { borderColor: t.border, backgroundColor: t.card }]}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.md }}>
              No clients with social accounts
            </Text>
            <Text style={{ color: t.mutedForeground, marginTop: spacing.xs }}>
              Connect a platform under Social → Accounts first, then come back to compose.
            </Text>
            <Button
              title="Open Accounts"
              variant="outline"
              onPress={() => router.push('/(tabs)/social/accounts')}
              style={{ marginTop: spacing.md }}
            />
          </View>
        ) : (
          <Select
            label="Client"
            value={clientId}
            options={clientOptions}
            onChange={(id) => {
              setClientId(id);
              setSelectedAccounts([]);
              setCampaignId('');
            }}
            placeholder="Select client"
          />
        )}

        {clientId ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: t.foreground }]}>Publishing to</Text>
            {accountsQ.isLoading ? (
              <View style={{ gap: spacing.sm }}>
                <SkeletonListRow />
                <SkeletonListRow />
              </View>
            ) : accounts.length === 0 ? (
              <Text style={{ color: t.mutedForeground }}>
                No connected accounts for this client. Connect them under Accounts.
              </Text>
            ) : (
              <>
                <View style={styles.logoRow}>
                  {accounts.map((acc) => (
                    <AccountLogoButton
                      key={acc.id}
                      account={acc}
                      selected={selectedAccounts.includes(acc.id)}
                      onPress={() => toggleAccount(acc.id)}
                    />
                  ))}
                </View>
                {selectedAccounts.length > 0 ? (
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }} numberOfLines={2}>
                    {accounts
                      .filter((a) => selectedAccounts.includes(a.id))
                      .map(
                        (a) =>
                          `${accountDisplayName(a)}${a.platformUsername ? ` (@${a.platformUsername})` : ''}`
                      )
                      .join(' · ')}
                  </Text>
                ) : (
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    Tap logos to choose where this posts
                  </Text>
                )}
              </>
            )}
          </View>
        ) : null}

        <Select
          label="Campaign (optional)"
          value={campaignId}
          options={campaignOptions}
          onChange={setCampaignId}
        />
        {clientId ? (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Input
                label="New campaign"
                value={newCampaign}
                onChangeText={setNewCampaign}
                placeholder="Campaign name"
              />
            </View>
            <View style={{ justifyContent: 'flex-end' }}>
              <Button
                title="Add"
                variant="outline"
                loading={createCampaignM.isPending}
                disabled={!newCampaign.trim()}
                onPress={() => createCampaignM.mutate()}
              />
            </View>
          </View>
        ) : null}

        <Input
          label="Caption"
          value={caption}
          onChangeText={setCaption}
          placeholder="Write your post…"
          multiline
          style={{ minHeight: 120, textAlignVertical: 'top' }}
        />

        <View style={styles.aiBox}>
          <Input
            label="AI caption prompt (optional)"
            value={aiPrompt}
            onChangeText={setAiPrompt}
            placeholder="Topic, tone, CTA…"
          />
          <Button
            title="Generate caption"
            variant="outline"
            loading={aiM.isPending}
            onPress={() => aiM.mutate()}
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.label, { color: t.foreground }]}>Media</Text>
          <View style={styles.mediaActions}>
            <Button title="Add images" variant="outline" onPress={() => pickMedia(false)} />
            <Button title="Add video" variant="outline" onPress={() => pickMedia(true)} />
          </View>
          {media.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: spacing.sm }}>
              {media.map((m) => (
                <View key={m.uri} style={styles.thumbWrap}>
                  {m.kind === 'image' ? (
                    <Image source={{ uri: m.uri }} style={styles.thumb} />
                  ) : (
                    <View style={[styles.thumb, styles.videoThumb, { backgroundColor: t.muted }]}>
                      <Ionicons name="videocam" size={28} color={t.foreground} />
                    </View>
                  )}
                  <Pressable
                    style={styles.removeThumb}
                    onPress={() => setMedia((prev) => prev.filter((x) => x.uri !== m.uri))}
                  >
                    <Ionicons name="close-circle" size={22} color={t.destructive} />
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {selectedPlatforms.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.label, { color: t.foreground }]}>Platform options</Text>
            {selectedPlatforms.map((p) => (
              <View key={p} style={[styles.platOpt, { borderColor: t.border, backgroundColor: t.card }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing.sm }}>
                  <PlatformIcon platform={p} size={18} />
                  <Text style={{ color: t.foreground, fontWeight: '700' }}>{platformLabel(p)}</Text>
                </View>
                {p === 'instagram' ? (
                  <View style={styles.chips}>
                    {['post', 'reel', 'story'].map((type) => (
                      <Chip key={type} label={type} selected={igType === type} onPress={() => setIgType(type)} />
                    ))}
                  </View>
                ) : null}
                {p === 'facebook' ? (
                  <View style={styles.chips}>
                    {['post', 'reel', 'story'].map((type) => (
                      <Chip key={type} label={type} selected={fbType === type} onPress={() => setFbType(type)} />
                    ))}
                  </View>
                ) : null}
                {p === 'tiktok' ? (
                  <SegmentedControl
                    options={[
                      { label: 'Post directly', value: 'direct' },
                      { label: 'Save to drafts', value: 'draft' },
                    ]}
                    value={tiktokMode}
                    onChange={setTiktokMode}
                  />
                ) : null}
                {p === 'youtube' ? (
                  <View style={{ gap: spacing.sm }}>
                    <Input
                      label="YouTube title"
                      value={youtubeTitle}
                      onChangeText={setYoutubeTitle}
                      placeholder="Video title"
                    />
                    <View style={styles.chips}>
                      {['short', 'video'].map((type) => (
                        <Chip
                          key={type}
                          label={type}
                          selected={youtubeType === type}
                          onPress={() => setYoutubeType(type)}
                        />
                      ))}
                    </View>
                    <View style={styles.chips}>
                      {['public', 'unlisted', 'private'].map((priv) => (
                        <Chip
                          key={priv}
                          label={priv}
                          selected={youtubePrivacy === priv}
                          onPress={() => setYoutubePrivacy(priv)}
                        />
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ))}
            {(selectedPlatforms.includes('instagram') ||
              selectedPlatforms.includes('facebook') ||
              selectedPlatforms.includes('linkedin')) && (
              <Input
                label="First comment (optional)"
                value={firstComment}
                onChangeText={setFirstComment}
                placeholder="Auto first comment"
              />
            )}
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={[styles.label, { color: t.foreground }]}>Publish mode</Text>
          <SegmentedControl
            options={[
              { label: 'Schedule', value: 'schedule' },
              { label: 'Now', value: 'now' },
              { label: 'Draft', value: 'draft' },
            ]}
            value={mode}
            onChange={setMode}
          />
        </View>

        {mode === 'schedule' ? (
          <View style={styles.row2}>
            <View style={{ flex: 1 }}>
              <Input label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} autoCapitalize="none" />
            </View>
            <View style={{ flex: 1 }}>
              <Input label="Time (HH:mm)" value={time} onChangeText={setTime} autoCapitalize="none" />
            </View>
          </View>
        ) : null}

        {mode === 'now' ? (
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>
            Creates the post, then publishes immediately to the selected accounts.
          </Text>
        ) : null}

        <Button
          title={primaryLabel}
          loading={saveM.isPending || publishing}
          disabled={!clientId || selectedAccounts.length === 0}
          onPress={() => saveM.mutate()}
        />
      </ScrollView>

      <Modal visible={!!publishProgress && publishing} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: t.card }]}>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.lg }}>
              Publishing
            </Text>
            <Text style={{ color: t.mutedForeground, marginVertical: spacing.md }}>
              {publishProgress?.message}
            </Text>
            <ProgressBar
              progress={
                publishProgress && publishProgress.total > 0
                  ? (publishProgress.done / publishProgress.total) * 100
                  : 10
              }
            />
            <Text style={{ color: t.foreground, marginTop: spacing.sm }}>
              {publishProgress?.done ?? 0}/{publishProgress?.total ?? 0} published
              {(publishProgress?.failed ?? 0) > 0 ? ` · ${publishProgress?.failed} failed` : ''}
            </Text>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AccountLogoButton({
  account,
  selected,
  onPress,
}: {
  account: SocialAccount;
  selected: boolean;
  onPress: () => void;
}) {
  const t = useTheme();
  const name = accountDisplayName(account);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${name}, ${platformLabel(account.platform)}`}
      style={[
        styles.logoBtn,
        selected
          ? { opacity: 1, transform: [{ scale: 1.06 }] }
          : { opacity: 0.55 },
      ]}
    >
      <SocialAccountAvatar
        accountId={account.id}
        avatarUrl={account.avatarUrl}
        name={name}
        platform={account.platform}
        size={LOGO_SIZE}
        borderColor={selected ? t.primary : t.border}
      />

      {selected ? (
        <View style={[styles.checkBadge, { backgroundColor: t.primary, borderColor: t.card }]}>
          <Ionicons name="checkmark" size={10} color={t.primaryForeground} />
        </View>
      ) : null}
    </Pressable>
  );
}

const LOGO_SIZE = 52;

const styles = StyleSheet.create({
  emptyBox: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  section: { gap: spacing.sm },
  label: { fontSize: fontSize.sm, fontWeight: '600' },
  logoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  platOpt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  logoBtn: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
    marginBottom: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 3,
  },
  aiBox: { gap: spacing.sm },
  mediaActions: { flexDirection: 'row', gap: spacing.sm },
  thumbWrap: { marginRight: spacing.sm, position: 'relative' },
  thumb: { width: 88, height: 88, borderRadius: radius.md },
  videoThumb: { alignItems: 'center', justifyContent: 'center' },
  removeThumb: { position: 'absolute', top: -6, right: -6 },
  row2: { flexDirection: 'row', gap: spacing.sm },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: {
    borderRadius: radius.lg,
    padding: spacing.xl,
  },
});

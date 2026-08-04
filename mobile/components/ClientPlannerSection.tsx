import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch, postAndSharePdf } from '../lib/api-client';
import { formatDate } from '../lib/format';
import {
  Badge,
  Button,
  Card,
  Dialog,
  EmptyState,
  Input,
  Select,
  Sheet,
  SkeletonListRow,
  useToast,
} from './ui';
import { useTheme } from '../hooks/useTheme';
import { fontSize, spacing } from '../constants/theme';

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const PLATFORMS = [
  { label: 'Instagram', value: 'INSTAGRAM' },
  { label: 'Facebook', value: 'FACEBOOK' },
  { label: 'TikTok', value: 'TIKTOK' },
  { label: 'LinkedIn', value: 'LINKEDIN' },
  { label: 'X', value: 'X' },
  { label: 'YouTube', value: 'YOUTUBE' },
  { label: 'Pinterest', value: 'PINTEREST' },
  { label: 'Snapchat', value: 'SNAPCHAT' },
  { label: 'Other', value: 'OTHER' },
];

const STATUSES = [
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Scheduled', value: 'SCHEDULED' },
  { label: 'Filmed', value: 'FILMED' },
  { label: 'Published', value: 'PUBLISHED' },
  { label: 'Delayed', value: 'DELAYED' },
];

const CONTENT_TYPES = [
  { label: 'Video', value: 'video' },
  { label: 'Photo', value: 'photo' },
  { label: 'Story', value: 'story' },
  { label: 'Graphic', value: 'graphic' },
];

type ContentPost = {
  id: string;
  title: string;
  platform: string;
  status: string;
  contentType?: string | null;
  shootingDate?: string | null;
  publishDate?: string | null;
  notes?: string | null;
};

type GroupedPost = {
  id: string;
  title: string;
  status: string;
  contentType: string;
  shootingDate?: string | null;
  publishDate?: string | null;
  notes?: string | null;
  platforms: string[];
  postIds: string[];
};

type PostForm = {
  title: string;
  platforms: string[];
  status: string;
  contentType: string;
  shootingDate: string;
  publishDate: string;
  notes: string;
};

const emptyForm = (): PostForm => ({
  title: '',
  platforms: ['INSTAGRAM'],
  status: 'DRAFT',
  contentType: 'graphic',
  shootingDate: '',
  publishDate: '',
  notes: '',
});

function needsShootDay(contentType: string) {
  return contentType === 'video' || contentType === 'photo';
}

function groupPosts(posts: ContentPost[]): GroupedPost[] {
  const groups: Record<string, GroupedPost> = {};
  const statusOrder = ['DRAFT', 'SCHEDULED', 'FILMED', 'PUBLISHED', 'DELAYED'];

  for (const post of posts) {
    const key = `${post.title}_${post.shootingDate}_${post.publishDate}`;
    if (!groups[key]) {
      groups[key] = {
        id: post.id,
        title: post.title,
        status: post.status,
        contentType: post.contentType || 'graphic',
        shootingDate: post.shootingDate,
        publishDate: post.publishDate,
        notes: post.notes,
        platforms: [post.platform],
        postIds: [post.id],
      };
    } else {
      if (!groups[key].platforms.includes(post.platform)) {
        groups[key].platforms.push(post.platform);
      }
      if (!groups[key].postIds.includes(post.id)) {
        groups[key].postIds.push(post.id);
      }
      const currentIdx = statusOrder.indexOf(post.status);
      const groupIdx = statusOrder.indexOf(groups[key].status);
      if (currentIdx > groupIdx) groups[key].status = post.status;
    }
  }

  return Object.values(groups).sort((a, b) => {
    const da = a.publishDate || a.shootingDate || '';
    const db = b.publishDate || b.shootingDate || '';
    return new Date(da).getTime() - new Date(db).getTime();
  });
}

export function ClientPlannerSection({
  clientId,
  clientName,
}: {
  clientId: string;
  clientName: string;
}) {
  const t = useTheme();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<GroupedPost | null>(null);
  const [form, setForm] = useState<PostForm>(emptyForm());
  const [deleteTarget, setDeleteTarget] = useState<GroupedPost | null>(null);
  const [showDup, setShowDup] = useState(false);
  const [dupMonth, setDupMonth] = useState(month > 1 ? month - 1 : 12);
  const [dupYear, setDupYear] = useState(month > 1 ? year : year - 1);
  const [showClear, setShowClear] = useState(false);
  const [showAi, setShowAi] = useState(false);
  const [aiPlatforms, setAiPlatforms] = useState<string[]>(['INSTAGRAM']);
  const [aiCount, setAiCount] = useState('12');
  const [aiTone, setAiTone] = useState('Professional yet engaging');
  const [aiTopics, setAiTopics] = useState('');
  const [aiPreview, setAiPreview] = useState<any[]>([]);

  const postsQ = useQuery({
    queryKey: ['content-posts', clientId, month, year],
    queryFn: async () => {
      const res = await apiFetch<{ posts: ContentPost[] }>(
        `${endpoints.clients.contentPosts(clientId)}?month=${month}&year=${year}`
      );
      return res.posts || [];
    },
  });

  const settingsQ = useQuery({
    queryKey: ['agency-settings'],
    queryFn: async () => {
      const res = await apiFetch<any>(endpoints.settings.get);
      return res.settings || res;
    },
  });

  const posts = postsQ.data || [];
  const grouped = useMemo(() => groupPosts(posts), [posts]);
  const settings = settingsQ.data;

  const navigateMonth = (dir: number) => {
    let m = month + dir;
    let y = year;
    if (m > 12) {
      m = 1;
      y++;
    }
    if (m < 1) {
      m = 12;
      y--;
    }
    setMonth(m);
    setYear(y);
  };

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setSheetOpen(true);
  };

  const openEdit = (group: GroupedPost) => {
    setEditing(group);
    setForm({
      title: group.title,
      platforms: group.platforms,
      status: group.status,
      contentType: group.contentType || 'graphic',
      shootingDate: group.shootingDate ? String(group.shootingDate).slice(0, 10) : '',
      publishDate: group.publishDate ? String(group.publishDate).slice(0, 10) : '',
      notes: group.notes || '',
    });
    setSheetOpen(true);
  };

  const togglePlatform = (value: string) => {
    setForm((p) => {
      const has = p.platforms.includes(value);
      if (has && p.platforms.length === 1) return p;
      return {
        ...p,
        platforms: has ? p.platforms.filter((x) => x !== value) : [...p.platforms, value],
      };
    });
  };

  const saveM = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error('Title required');
      if (!form.platforms.length) throw new Error('At least one platform is required');
      if (!form.publishDate) throw new Error('Goes live date is required');

      const shootingDate = needsShootDay(form.contentType) ? form.shootingDate : '';

      if (editing) {
        const oldPostIds = editing.postIds;
        let idIndex = 0;
        for (const platform of form.platforms) {
          const payload = {
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || 'graphic',
            shootingDate,
            publishDate: form.publishDate,
            notes: form.notes || null,
          };
          if (idIndex < oldPostIds.length) {
            await apiFetch(endpoints.clients.contentPostById(clientId, oldPostIds[idIndex]), {
              method: 'PUT',
              body: JSON.stringify(payload),
            });
            idIndex++;
          } else {
            await apiFetch(endpoints.clients.contentPosts(clientId), {
              method: 'POST',
              body: JSON.stringify(payload),
            });
          }
        }
        while (idIndex < oldPostIds.length) {
          await apiFetch(endpoints.clients.contentPostById(clientId, oldPostIds[idIndex]), {
            method: 'DELETE',
          });
          idIndex++;
        }
        return;
      }

      for (const platform of form.platforms) {
        await apiFetch(endpoints.clients.contentPosts(clientId), {
          method: 'POST',
          body: JSON.stringify({
            month,
            year,
            title: form.title.trim(),
            platform,
            status: form.status,
            contentType: form.contentType || 'graphic',
            shootingDate,
            publishDate: form.publishDate,
            notes: form.notes || null,
          }),
        });
      }
    },
    onSuccess: () => {
      toast(editing ? 'Post updated' : 'Post(s) added', 'success');
      setSheetOpen(false);
      queryClient.invalidateQueries({ queryKey: ['content-posts', clientId, month, year] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to save', 'error'),
  });

  const deleteM = useMutation({
    mutationFn: async (postIds: string[]) => {
      await Promise.all(
        postIds.map((id) =>
          apiFetch(endpoints.clients.contentPostById(clientId, id), { method: 'DELETE' })
        )
      );
    },
    onSuccess: () => {
      toast('Post(s) deleted', 'success');
      setDeleteTarget(null);
      queryClient.invalidateQueries({ queryKey: ['content-posts', clientId, month, year] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to delete', 'error'),
  });

  const dupM = useMutation({
    mutationFn: () =>
      apiFetch<{ created: number }>(endpoints.clients.contentPostsDuplicate(clientId), {
        method: 'POST',
        body: JSON.stringify({
          fromMonth: dupMonth,
          fromYear: dupYear,
          toMonth: month,
          toYear: year,
        }),
      }),
    onSuccess: (res) => {
      toast(`${res.created} posts copied as draft`, 'success');
      setShowDup(false);
      queryClient.invalidateQueries({ queryKey: ['content-posts', clientId, month, year] });
    },
    onError: (e: Error) => toast(e.message || 'Duplicate failed', 'error'),
  });

  const clearM = useMutation({
    mutationFn: async () => {
      await Promise.all(
        posts.map((post) =>
          apiFetch(endpoints.clients.contentPostById(clientId, post.id), { method: 'DELETE' })
        )
      );
    },
    onSuccess: () => {
      toast(`Cleared ${MONTHS[month - 1]}`, 'success');
      setShowClear(false);
      queryClient.invalidateQueries({ queryKey: ['content-posts', clientId, month, year] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to clear', 'error'),
  });

  const aiGenerateM = useMutation({
    mutationFn: () =>
      apiFetch<{ posts: any[] }>(endpoints.ai.generatePlan, {
        method: 'POST',
        body: JSON.stringify({
          clientId,
          month,
          year,
          platforms: aiPlatforms,
          numberOfPosts: parseInt(aiCount, 10) || 12,
          tone: aiTone,
          focusTopics: aiTopics,
        }),
      }),
    onSuccess: (res) => {
      setAiPreview((res.posts || []).map((p: any, i: number) => ({ ...p, selected: true, id: `ai-${i}` })));
      toast('AI plan generated — review and save', 'success');
    },
    onError: (e: Error) => toast(e.message || 'Generation failed', 'error'),
  });

  const aiSaveM = useMutation({
    mutationFn: async () => {
      const selected = aiPreview.filter((p) => p.selected);
      if (!selected.length) throw new Error('Select at least one post');
      await Promise.all(
        selected.map((p) =>
          apiFetch(endpoints.clients.contentPosts(clientId), {
            method: 'POST',
            body: JSON.stringify({
              month,
              year,
              title: p.title,
              platform: p.platform,
              status: p.status || 'DRAFT',
              contentType: p.contentType || 'graphic',
              shootingDate: p.shootingDate || null,
              publishDate: p.publishDate || null,
              notes: p.notes || null,
            }),
          })
        )
      );
    },
    onSuccess: () => {
      toast('AI plan saved', 'success');
      setShowAi(false);
      setAiPreview([]);
      queryClient.invalidateQueries({ queryKey: ['content-posts', clientId, month, year] });
    },
    onError: (e: Error) => toast(e.message || 'Failed to save plan', 'error'),
  });

  const exportM = useMutation({
    mutationFn: async () => {
      if (grouped.length === 0) throw new Error('No posts to export this month');
      const filename = `${clientName}-${MONTHS[month - 1]}-${year}-Content-Plan.pdf`;
      await postAndSharePdf(endpoints.reports.contentPlan, filename, {
        clientName,
        month,
        year,
        agency: {
          agencyName: settings?.agencyName || 'Hirdan Marketing',
          logo: settings?.logo || null,
          primaryColor: settings?.primaryColor || '#5A428A',
          phone: settings?.phone || null,
          adminEmail: settings?.adminEmail || null,
          website: settings?.website || null,
        },
        posts: grouped.map((g) => ({
          id: g.id,
          title: g.title,
          status: g.status,
          contentType: g.contentType || null,
          shootingDate: g.shootingDate || null,
          publishDate: g.publishDate || null,
          platforms: g.platforms,
        })),
      });
    },
    onSuccess: () => toast('PDF exported', 'success'),
    onError: (e: Error) => toast(e.message || 'Could not generate PDF', 'error'),
  });

  return (
    <View style={{ gap: spacing.md }}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
            Content planner
          </Text>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>{clientName}</Text>
        </View>
        <Button title="Add" size="sm" onPress={openAdd} />
      </View>

      <View style={styles.monthNav}>
        <Pressable onPress={() => navigateMonth(-1)} hitSlop={8}>
          <Ionicons name="chevron-back" size={22} color={t.foreground} />
        </Pressable>
        <Text style={{ color: t.foreground, fontWeight: '800', fontSize: fontSize.md }}>
          {MONTHS[month - 1]} {year}
        </Text>
        <Pressable onPress={() => navigateMonth(1)} hitSlop={8}>
          <Ionicons name="chevron-forward" size={22} color={t.foreground} />
        </Pressable>
      </View>

      <View style={styles.actions}>
        <Button title="Duplicate" size="sm" variant="outline" onPress={() => setShowDup(true)} />
        <Button title="AI plan" size="sm" variant="outline" onPress={() => setShowAi(true)} />
        <Button
          title={exportM.isPending ? 'Exporting…' : 'Export PDF'}
          size="sm"
          variant="outline"
          loading={exportM.isPending}
          disabled={grouped.length === 0 || exportM.isPending}
          onPress={() => exportM.mutate()}
        />
        <Button
          title="Clear"
          size="sm"
          variant="outline"
          onPress={() => setShowClear(true)}
          disabled={posts.length === 0}
        />
      </View>

      {postsQ.isLoading ? (
        <View>
          <SkeletonListRow avatar={false} />
          <SkeletonListRow avatar={false} />
          <SkeletonListRow avatar={false} />
        </View>
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No posts this month"
          description="Add content or duplicate from another month."
          icon="calendar-outline"
          actionLabel="Add post"
          onAction={openAdd}
        />
      ) : (
        <Card style={{ padding: 0, overflow: 'hidden' }}>
          {grouped.map((g, i) => (
            <View
              key={g.id + g.platforms.join(',')}
              style={[
                styles.row,
                i < grouped.length - 1 && {
                  borderBottomWidth: StyleSheet.hairlineWidth,
                  borderBottomColor: t.border,
                },
              ]}
            >
              <Pressable onPress={() => openEdit(g)} style={{ flex: 1, gap: 4 }}>
                <Text style={{ color: t.foreground, fontWeight: '700' }}>{g.title}</Text>
                <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                  {g.platforms.join(' · ')}
                  {g.publishDate ? ` · Live ${formatDate(g.publishDate)}` : ''}
                </Text>
                <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                  <Badge label={g.status} />
                  <Badge label={g.contentType} tone="default" />
                </View>
              </Pressable>
              <Pressable onPress={() => setDeleteTarget(g)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={t.destructive} />
              </Pressable>
            </View>
          ))}
        </Card>
      )}

      <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)} title={editing ? 'Edit post' : 'Add post'}>
        <View style={{ gap: spacing.md }}>
          <Input
            label="Title"
            value={form.title}
            onChangeText={(v) => setForm((p) => ({ ...p, title: v }))}
          />
          <Select
            label="Content type"
            value={form.contentType}
            options={CONTENT_TYPES}
            onChange={(v) => setForm((p) => ({ ...p, contentType: v }))}
          />
          <Select
            label="Status"
            value={form.status}
            options={STATUSES}
            onChange={(v) => setForm((p) => ({ ...p, status: v }))}
          />
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>Platforms</Text>
          <View style={styles.chips}>
            {PLATFORMS.map((p) => {
              const active = form.platforms.includes(p.value);
              return (
                <Pressable
                  key={p.value}
                  onPress={() => togglePlatform(p.value)}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? t.primary + '22' : t.muted,
                      borderColor: active ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? t.primary : t.foreground, fontSize: fontSize.xs, fontWeight: '700' }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Input
            label="Goes live (YYYY-MM-DD)"
            value={form.publishDate}
            onChangeText={(v) => setForm((p) => ({ ...p, publishDate: v }))}
            autoCapitalize="none"
          />
          {needsShootDay(form.contentType) ? (
            <Input
              label="Shoot day (YYYY-MM-DD)"
              value={form.shootingDate}
              onChangeText={(v) => setForm((p) => ({ ...p, shootingDate: v }))}
              autoCapitalize="none"
            />
          ) : null}
          <Input
            label="Notes"
            value={form.notes}
            onChangeText={(v) => setForm((p) => ({ ...p, notes: v }))}
            multiline
            style={{ minHeight: 72, textAlignVertical: 'top' }}
          />
          <Button
            title={saveM.isPending ? 'Saving…' : editing ? 'Update' : 'Add post'}
            loading={saveM.isPending}
            onPress={() => saveM.mutate()}
          />
        </View>
      </Sheet>

      <Sheet visible={showDup} onClose={() => setShowDup(false)} title="Duplicate month">
        <View style={{ gap: spacing.md }}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
            Copy posts into {MONTHS[month - 1]} {year}
          </Text>
          <Select
            label="From month"
            value={String(dupMonth)}
            options={MONTHS.map((m, i) => ({ label: m, value: String(i + 1) }))}
            onChange={(v) => setDupMonth(parseInt(v, 10))}
          />
          <Input
            label="From year"
            value={String(dupYear)}
            onChangeText={(v) => setDupYear(parseInt(v.replace(/\D/g, ''), 10) || year)}
            keyboardType="number-pad"
          />
          <Button
            title={dupM.isPending ? 'Copying…' : 'Duplicate'}
            loading={dupM.isPending}
            onPress={() => dupM.mutate()}
          />
        </View>
      </Sheet>

      <Sheet visible={showAi} onClose={() => setShowAi(false)} title="AI content plan">
        <View style={{ gap: spacing.md }}>
          <Input
            label="Number of posts"
            value={aiCount}
            onChangeText={(v) => setAiCount(v.replace(/\D/g, ''))}
            keyboardType="number-pad"
          />
          <Input label="Tone" value={aiTone} onChangeText={setAiTone} />
          <Input
            label="Focus topics"
            value={aiTopics}
            onChangeText={setAiTopics}
            placeholder="Optional themes"
          />
          <Text style={{ color: t.foreground, fontSize: fontSize.sm, fontWeight: '600' }}>Platforms</Text>
          <View style={styles.chips}>
            {PLATFORMS.slice(0, 6).map((p) => {
              const active = aiPlatforms.includes(p.value);
              return (
                <Pressable
                  key={p.value}
                  onPress={() =>
                    setAiPlatforms((prev) =>
                      active ? prev.filter((x) => x !== p.value) : [...prev, p.value]
                    )
                  }
                  style={[
                    styles.chip,
                    {
                      backgroundColor: active ? t.primary + '22' : t.muted,
                      borderColor: active ? t.primary : t.border,
                    },
                  ]}
                >
                  <Text style={{ color: active ? t.primary : t.foreground, fontSize: fontSize.xs, fontWeight: '700' }}>
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Button
            title={aiGenerateM.isPending ? 'Generating…' : 'Generate'}
            loading={aiGenerateM.isPending}
            disabled={!aiPlatforms.length}
            onPress={() => aiGenerateM.mutate()}
          />
          {aiPreview.length > 0 ? (
            <>
              <Text style={{ color: t.foreground, fontWeight: '700' }}>
                Preview ({aiPreview.filter((p) => p.selected).length}/{aiPreview.length})
              </Text>
              {aiPreview.map((p, idx) => (
                <Pressable
                  key={p.id}
                  onPress={() =>
                    setAiPreview((prev) =>
                      prev.map((x, i) => (i === idx ? { ...x, selected: !x.selected } : x))
                    )
                  }
                  style={[styles.aiRow, { borderColor: t.border, backgroundColor: p.selected ? t.primary + '12' : t.card }]}
                >
                  <Text style={{ color: t.foreground, fontWeight: '600', flex: 1 }} numberOfLines={2}>
                    {p.title}
                  </Text>
                  <Ionicons
                    name={p.selected ? 'checkbox' : 'square-outline'}
                    size={20}
                    color={p.selected ? t.primary : t.mutedForeground}
                  />
                </Pressable>
              ))}
              <Button
                title={aiSaveM.isPending ? 'Saving…' : 'Save selected'}
                loading={aiSaveM.isPending}
                onPress={() => aiSaveM.mutate()}
              />
            </>
          ) : null}
        </View>
      </Sheet>

      <Dialog
        visible={!!deleteTarget}
        title="Delete post"
        message={`Remove “${deleteTarget?.title || 'this post'}”?`}
        confirmLabel="Delete"
        destructive
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => deleteTarget && deleteM.mutate(deleteTarget.postIds)}
      />

      <Dialog
        visible={showClear}
        title="Clear month"
        message={`Delete all posts for ${MONTHS[month - 1]} ${year}?`}
        confirmLabel="Clear"
        destructive
        onCancel={() => setShowClear(false)}
        onConfirm={() => clearM.mutate()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  monthNav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.sm,
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  aiRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: spacing.md,
  },
});

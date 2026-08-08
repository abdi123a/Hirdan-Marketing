import React from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Stack } from 'expo-router';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { formatDate, unwrapList, unwrapOne } from '../../../../lib/format';
import {
  teamFromApi,
  teamStatusTone,
  titleCase,
  type TeamMemberRow,
} from '../../../../lib/team';
import {
  Avatar,
  Badge,
  Card,
  DetailSkeleton,
  EmptyState,
  ListRow,
} from '../../../../components/ui';
import { usePermissions } from '../../../../hooks/usePermissions';
import { useTheme } from '../../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../../constants/theme';

type EmployeeFile = {
  id: string;
  label?: string | null;
  category?: string | null;
  fileUrl?: string | null;
  uploadedAt?: string | null;
};

type EmployeeActivity = {
  id: string;
  actionType?: string | null;
  performedBy?: string | null;
  notes?: string | null;
  timestamp?: string | null;
};

export default function TeamMemberDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const t = useTheme();
  const router = useRouter();
  const { canWrite } = usePermissions();

  const memberQ = useQuery({
    queryKey: ['team-member', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.team.byId(id!));
      const raw =
        (unwrapOne<Record<string, unknown>>(res, 'member', 'data') as Record<string, unknown> | undefined) ||
        (res as Record<string, unknown>);
      if (!raw?.id) throw new Error('Team member not found');
      return teamFromApi(raw);
    },
  });

  const filesQ = useQuery({
    queryKey: ['team-member-files', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.team.files(id!));
      return unwrapList<EmployeeFile>(res);
    },
  });

  const activityQ = useQuery({
    queryKey: ['team-member-activity', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.team.activity(id!));
      return unwrapList<EmployeeActivity>(res);
    },
  });

  const refetchAll = () => {
    memberQ.refetch();
    filesQ.refetch();
    activityQ.refetch();
  };

  const refreshing =
    memberQ.isRefetching || filesQ.isRefetching || activityQ.isRefetching;

  if (memberQ.isLoading) {
    return <DetailSkeleton />;
  }

  if (memberQ.error || !memberQ.data) {
    return (
      <EmptyState
        title="Team member not found"
        description={(memberQ.error as Error)?.message}
        actionLabel="Retry"
        onAction={() => memberQ.refetch()}
        icon="people-outline"
      />
    );
  }

  const member = memberQ.data;
  const files = filesQ.data || [];
  const activities = activityQ.data || [];

  return (
    <>
      <Stack.Screen
        options={{
          title: member.name,
          headerRight: () =>
            canWrite('team') ? (
              <Pressable
                onPress={() => router.push(`/(tabs)/more/team/edit/${member.id}`)}
                hitSlop={8}
                style={{ marginRight: spacing.sm }}
              >
                <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.sm }}>
                  Edit
                </Text>
              </Pressable>
            ) : null,
        }}
      />
      <ScrollView
        style={{ flex: 1, backgroundColor: t.background }}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={refetchAll} tintColor={t.primary} />
        }
      >
        <Card style={{ alignItems: 'center', gap: spacing.md }}>
          <Avatar name={member.name} size={72} />
          <Text style={{ color: t.foreground, fontSize: fontSize.xl, fontWeight: '800' }}>
            {member.name}
          </Text>
          {member.role ? (
            <Badge label={member.role} tone="gold" />
          ) : null}
          {member.status ? (
            <Badge label={titleCase(member.status)} tone={teamStatusTone(member.status)} />
          ) : null}
        </Card>

        <Card style={{ gap: spacing.md }}>
          <Field label="Email" value={member.email} />
          <Field label="Phone" value={member.phone} />
          <Field label="Department" value={member.department} />
          <Field label="Hire date" value={member.startDate ? formatDate(member.startDate) : null} />
          {member.bio ? <Field label="Bio" value={member.bio} /> : null}
        </Card>

        {files.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
              FILES
            </Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {files.map((file) => (
                <ListRow
                  key={file.id}
                  title={file.label || 'Document'}
                  subtitle={[file.category, file.uploadedAt ? formatDate(file.uploadedAt) : null]
                    .filter(Boolean)
                    .join(' · ')}
                  left={<Ionicons name="document-outline" size={20} color={t.primary} />}
                />
              ))}
            </Card>
          </View>
        ) : null}

        {activities.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
              ACTIVITY
            </Text>
            <Card style={{ padding: 0, overflow: 'hidden' }}>
              {activities.map((item) => (
                <ListRow
                  key={item.id}
                  title={titleCase(item.actionType || 'Update')}
                  subtitle={item.notes || item.performedBy || undefined}
                  right={
                    item.timestamp ? (
                      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                        {formatDate(item.timestamp)}
                      </Text>
                    ) : undefined
                  }
                />
              ))}
            </Card>
          </View>
        ) : null}
      </ScrollView>
    </>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  const t = useTheme();
  return (
    <View style={{ gap: 2 }}>
      <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, fontWeight: '700' }}>
        {label.toUpperCase()}
      </Text>
      <Text style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '600' }}>
        {value || '—'}
      </Text>
    </View>
  );
}

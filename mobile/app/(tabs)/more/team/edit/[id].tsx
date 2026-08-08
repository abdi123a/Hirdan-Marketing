import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../../lib/api-client';
import { unwrapOne } from '../../../../../lib/format';
import {
  TEAM_STATUSES,
  teamFormFromMember,
  teamFromApi,
  teamPayload,
  titleCase,
  validateTeamForm,
  type TeamFormValues,
} from '../../../../../lib/team';
import {
  Button,
  DatePickerField,
  FormSkeleton,
  Input,
  Select,
  useToast,
} from '../../../../../components/ui';
import { useTheme } from '../../../../../hooks/useTheme';
import { spacing } from '../../../../../constants/theme';

export default function EditTeamMemberScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [form, setForm] = useState<TeamFormValues | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});

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

  useEffect(() => {
    if (memberQ.data) setForm(teamFormFromMember(memberQ.data));
  }, [memberQ.data]);

  const onChange = <K extends keyof TeamFormValues>(key: K, value: TeamFormValues[K]) => {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.team.update(id!), {
        method: 'PUT',
        body: JSON.stringify(teamPayload(form!)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      queryClient.invalidateQueries({ queryKey: ['team-member', id] });
      toast('Employee updated', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    if (!form) return;
    const next = validateTeamForm(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

  if (memberQ.isLoading || !form) {
    return <FormSkeleton fields={7} />;
  }

  if (memberQ.error) {
    return null;
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
        <Input
          label="Full name"
          value={form.name}
          onChangeText={(v) => onChange('name', v)}
          error={errors.name}
          autoCapitalize="words"
        />
        <Input
          label="Email"
          value={form.email}
          onChangeText={(v) => onChange('email', v)}
          error={errors.email}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <Input
          label="Phone"
          value={form.phone}
          onChangeText={(v) => onChange('phone', v)}
          keyboardType="phone-pad"
        />
        <Input
          label="Role"
          value={form.role}
          onChangeText={(v) => onChange('role', v)}
          error={errors.role}
        />
        <Input
          label="Department"
          value={form.department}
          onChangeText={(v) => onChange('department', v)}
        />
        <Select
          label="Status"
          value={form.status}
          options={TEAM_STATUSES.map((s) => ({ value: s, label: titleCase(s) }))}
          onChange={(v) => onChange('status', v as TeamFormValues['status'])}
        />
        <DatePickerField
          label="Hire date"
          value={form.startDate}
          onChange={(v) => onChange('startDate', v)}
        />
        <Input
          label="Bio"
          value={form.bio}
          onChangeText={(v) => onChange('bio', v)}
          multiline
          numberOfLines={3}
          style={{ minHeight: 88, textAlignVertical: 'top' }}
        />
        <Button title="Save changes" onPress={submit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});

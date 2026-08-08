import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import {
  TEAM_STATUSES,
  emptyTeamForm,
  teamPayload,
  titleCase,
  validateTeamForm,
  type TeamFormValues,
} from '../../../../lib/team';
import {
  Button,
  DatePickerField,
  Input,
  Select,
  useToast,
} from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { spacing } from '../../../../constants/theme';

export default function AddTeamMemberScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<TeamFormValues>(emptyTeamForm());
  const [errors, setErrors] = useState<Record<string, string>>({});

  const onChange = <K extends keyof TeamFormValues>(key: K, value: TeamFormValues[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    if (errors[key]) setErrors((prev) => ({ ...prev, [key]: '' }));
  };

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.team.create, {
        method: 'POST',
        body: JSON.stringify(teamPayload(form)),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team'] });
      toast('Employee added', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    const next = validateTeamForm(form);
    setErrors(next);
    if (Object.keys(next).length) return;
    mutation.mutate();
  };

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
        <Button title="Create employee" onPress={submit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});

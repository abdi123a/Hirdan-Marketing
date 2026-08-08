import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet } from 'react-native';
import { Text } from '../../../../components/ui/Text';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../../lib/api-client';
import { unwrapList } from '../../../../lib/format';
import {
  HR_DOC_TYPES,
  HR_DOC_TYPE_LABELS,
  buildHrContent,
  hrDocTypeLabel,
  type HrDocType,
} from '../../../../lib/hr';
import { teamFromApi } from '../../../../lib/team';
import {
  Button,
  Input,
  Select,
  useToast,
} from '../../../../components/ui';
import { useTheme } from '../../../../hooks/useTheme';
import { spacing } from '../../../../constants/theme';

export default function GenerateHrDocumentScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [employeeId, setEmployeeId] = useState('');
  const [docType, setDocType] = useState<HrDocType>('WORK_CERTIFICATE');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const teamQ = useQuery({
    queryKey: ['team'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.team.list}?take=200`);
      return unwrapList(res).map((m) => teamFromApi(m as Record<string, unknown>));
    },
  });

  const employees = teamQ.data || [];

  const employeeOptions = useMemo(
    () =>
      employees.map((e) => ({
        value: e.id,
        label: [e.name, e.role].filter(Boolean).join(' · '),
      })),
    [employees]
  );

  const selectedEmployee = employees.find((e) => e.id === employeeId);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!selectedEmployee) throw new Error('Select an employee');
      const docTitle = title.trim() || hrDocTypeLabel(docType);
      const content = buildHrContent({
        employee: selectedEmployee,
        title: docTitle,
        notes,
      });
      const status = docType === 'WARNING_CERTIFICATE' ? 'PENDING_APPROVAL' : 'FINAL';
      return apiFetch(endpoints.hr.create, {
        method: 'POST',
        body: JSON.stringify({
          employeeId: selectedEmployee.id,
          docType,
          content,
          status,
        }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['hr-documents'] });
      toast('HR document created', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message, 'error'),
  });

  const submit = () => {
    const next: Record<string, string> = {};
    if (!employeeId) next.employeeId = 'Select an employee';
    if (!docType) next.docType = 'Select a document type';
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
        <Select
          label="Employee"
          value={employeeId}
          options={employeeOptions}
          onChange={setEmployeeId}
          placeholder={teamQ.isLoading ? 'Loading team…' : 'Select employee'}
        />
        {errors.employeeId ? (
          <Text style={{ color: t.destructive, fontSize: 12 }}>{errors.employeeId}</Text>
        ) : null}

        <Select
          label="Document type"
          value={docType}
          options={HR_DOC_TYPES.map((type) => ({
            value: type,
            label: HR_DOC_TYPE_LABELS[type],
          }))}
          onChange={(v) => setDocType(v as HrDocType)}
        />

        <Input
          label="Title"
          value={title}
          onChangeText={setTitle}
          placeholder={hrDocTypeLabel(docType)}
        />

        <Input
          label="Notes (optional)"
          value={notes}
          onChangeText={setNotes}
          multiline
          numberOfLines={4}
          placeholder="Additional notes for the document body"
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />

        {docType === 'WARNING_CERTIFICATE' ? (
          <Text style={{ color: t.mutedForeground, fontSize: 12 }}>
            Warning notices are submitted for manager approval.
          </Text>
        ) : null}

        <Button title="Generate document" onPress={submit} loading={mutation.isPending} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  form: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});

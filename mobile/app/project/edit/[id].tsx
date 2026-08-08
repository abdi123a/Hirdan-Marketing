import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { unwrapList, unwrapOne } from '../../../lib/format';
import { clientDisplayName, clientFromApi } from '../../../lib/clients';
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  isoDateOnly,
  normalizePriority,
  normalizeStatus,
  projectFromApi,
} from '../../../lib/projects';
import {
  Button,
  DatePickerField,
  FormSkeleton,
  Input,
  Select,
  useToast,
} from '../../../components/ui';
import { useTheme } from '../../../hooks/useTheme';
import { spacing } from '../../../constants/theme';

export default function ProjectEditScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const projectQ = useQuery({
    queryKey: ['project', id],
    enabled: !!id,
    queryFn: async () => {
      const res = await apiFetch<unknown>(endpoints.projects.byId(id!));
      const project = unwrapOne<any>(res, 'project', 'data') || res;
      if (!project?.id) throw new Error('Project not found');
      return projectFromApi(project);
    },
  });

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList(res).map((c) => clientFromApi(c as any));
    },
  });

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('IN_PROGRESS');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');
  const [progress, setProgress] = useState('0');
  const [budget, setBudget] = useState('');

  useEffect(() => {
    const p = projectQ.data;
    if (!p) return;
    setName(p.name);
    setClientId(p.clientId || '');
    setDescription(p.description || '');
    setStatus(normalizeStatus(p.status));
    setPriority(normalizePriority(p.priority));
    setDueDate(isoDateOnly(p.dueDate));
    setStartDate(isoDateOnly(p.startDate));
    setProgress(String(p.progress ?? 0));
    setBudget(p.budget != null ? String(p.budget) : '');
  }, [projectQ.data]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch(endpoints.projects.update(id!), {
        method: 'PUT',
        body: JSON.stringify({
          name: name.trim(),
          clientId,
          description: description.trim() || null,
          status,
          priority,
          dueDate: dueDate || null,
          startDate: startDate || null,
          progress: Math.min(100, Math.max(0, Number(progress) || 0)),
          budget: budget.trim() ? Number(budget) : null,
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['project', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-for-client'] });
      toast('Project updated', 'success');
      router.back();
    },
    onError: (e: Error) => toast(e.message || 'Failed to update project', 'error'),
  });

  if (projectQ.isLoading || clientsQ.isLoading) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
      </ScrollView>
    );
  }

  if (projectQ.error || !projectQ.data) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg }}>
        <Button title="Retry" onPress={() => projectQ.refetch()} />
      </ScrollView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: t.background }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Input label="Project name" value={name} onChangeText={setName} placeholder="Website redesign" />
        <Select
          label="Client"
          value={clientId}
          options={(clientsQ.data || []).map((c) => ({
            label: clientDisplayName(c),
            value: c.id,
          }))}
          onChange={setClientId}
        />
        <Input
          label="Description"
          value={description}
          onChangeText={setDescription}
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
        <Select
          label="Status"
          value={status}
          options={[...PROJECT_STATUSES]}
          onChange={setStatus}
        />
        <Select
          label="Priority"
          value={priority}
          options={[...PROJECT_PRIORITIES]}
          onChange={setPriority}
        />
        <Input
          label="Progress (%)"
          value={progress}
          onChangeText={setProgress}
          keyboardType="number-pad"
        />
        <Input
          label="Budget"
          value={budget}
          onChangeText={setBudget}
          keyboardType="decimal-pad"
          placeholder="Optional"
        />
        <DatePickerField label="Start date" value={startDate} onChange={setStartDate} optional />
        <DatePickerField label="Due date" value={dueDate} onChange={setDueDate} optional />
        <Button
          title={mutation.isPending ? 'Saving…' : 'Save changes'}
          loading={mutation.isPending}
          disabled={!name.trim() || !clientId || mutation.isPending}
          onPress={() => mutation.mutate()}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
});

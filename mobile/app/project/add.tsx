import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet } from 'react-native';
import { ScrollView } from '../../components/ui/ScrollView';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../lib/api-client';
import { unwrapList } from '../../lib/format';
import { clientDisplayName, clientFromApi } from '../../lib/clients';
import { PROJECT_PRIORITIES, PROJECT_STATUSES } from '../../lib/projects';
import {
  Button,
  DatePickerField,
  FormSkeleton,
  Input,
  Select,
  useToast,
} from '../../components/ui';
import { useTheme } from '../../hooks/useTheme';
import { spacing } from '../../constants/theme';

export default function ProjectAddScreen() {
  const t = useTheme();
  const router = useRouter();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { clientId: clientIdParam } = useLocalSearchParams<{ clientId?: string }>();

  const clientsQ = useQuery({
    queryKey: ['clients'],
    queryFn: async () => {
      const res = await apiFetch<unknown>(`${endpoints.clients.list}?take=100`);
      return unwrapList(res).map((c) => clientFromApi(c as any));
    },
  });

  const [name, setName] = useState('');
  const [clientId, setClientId] = useState(clientIdParam || '');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState('IN_PROGRESS');
  const [priority, setPriority] = useState('MEDIUM');
  const [dueDate, setDueDate] = useState('');
  const [startDate, setStartDate] = useState('');

  useEffect(() => {
    if (clientIdParam) setClientId(clientIdParam);
  }, [clientIdParam]);

  const mutation = useMutation({
    mutationFn: () =>
      apiFetch<{ project: { id: string } }>(endpoints.projects.create, {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          clientId,
          description: description.trim() || null,
          status,
          priority,
          dueDate: dueDate || null,
          startDate: startDate || null,
        }),
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['projects-for-client'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-projects'] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      toast('Project created', 'success');
      const id = res.project?.id;
      if (id) router.replace(`/project/${id}`);
      else router.back();
    },
    onError: (e: Error) => toast(e.message || 'Failed to create project', 'error'),
  });

  if (clientsQ.isLoading) {
    return (
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <FormSkeleton />
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
        <DatePickerField label="Start date" value={startDate} onChange={setStartDate} optional />
        <DatePickerField label="Due date" value={dueDate} onChange={setDueDate} optional />
        <Button
          title={mutation.isPending ? 'Creating…' : 'Create project'}
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

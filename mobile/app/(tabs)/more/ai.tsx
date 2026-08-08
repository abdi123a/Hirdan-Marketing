import React, { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text } from '../../../components/ui/Text';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { endpoints } from '@hirdan/shared';
import { apiFetch } from '../../../lib/api-client';
import { Badge, EmptyState, useToast } from '../../../components/ui';
import { usePermissions } from '../../../hooks/usePermissions';
import { useTheme } from '../../../hooks/useTheme';
import { fontSize, radius, spacing } from '../../../constants/theme';

type Message = {
  role: 'user' | 'assistant';
  content: string;
  toolsUsed?: string[];
};

function providerLabel(id: string): string {
  const labels: Record<string, string> = {
    openai: 'OpenAI',
    claude: 'Claude',
    gemini: 'Gemini',
  };
  return labels[id] || id.toUpperCase();
}

export default function AiAssistantScreen() {
  const t = useTheme();
  const { toast } = useToast();
  const { canRead } = usePermissions();
  const allowed = canRead('ai_assistant');

  const scrollRef = useRef<ScrollView>(null);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content:
        'Hello! I am your Hirdan Marketing AI assistant. Ask about clients, projects, financials, or draft content.',
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const statusQ = useQuery({
    queryKey: ['ai-status'],
    enabled: allowed,
    queryFn: () => apiFetch<{ provider: string; connected: boolean }>(endpoints.ai.status),
  });

  const connected = statusQ.data?.connected ?? false;
  const provider = statusQ.data?.provider ?? 'openai';

  useEffect(() => {
    scrollRef.current?.scrollToEnd({ animated: true });
  }, [messages, sending]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || sending || !connected) return;

    setInput('');
    const userMsg: Message = { role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setSending(true);

    try {
      const res = await apiFetch<{
        reply: string;
        provider: string;
        model: string;
        toolsUsed?: string[];
      }>(endpoints.ai.chat, {
        method: 'POST',
        body: JSON.stringify({
          message: text,
          history: messages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: res.reply,
          toolsUsed: res.toolsUsed,
        },
      ]);
    } catch (e: any) {
      toast(e?.message || 'Failed to get AI response', 'error');
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Error: ${e?.message || 'Could not retrieve AI response. Check that an API key is configured in Settings.'}`,
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  if (!allowed) {
    return (
      <View style={[styles.container, { backgroundColor: t.background }]}>
        <EmptyState
          icon="lock-closed-outline"
          title="AI Assistant unavailable"
          description="You do not have permission to use the AI assistant."
        />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: t.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={[styles.statusBar, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 }}>
          <View style={[styles.sparkle, { backgroundColor: t.primary + '18' }]}>
            <Ionicons name="sparkles" size={16} color={t.primary} />
          </View>
          <View>
            <Text style={{ color: t.foreground, fontWeight: '700', fontSize: fontSize.sm }}>
              {providerLabel(provider)}
            </Text>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>Agency AI assistant</Text>
          </View>
        </View>
        <Badge
          label={connected ? 'Connected' : 'Key missing'}
          tone={connected ? 'success' : 'warning'}
        />
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1 }}
        contentContainerStyle={styles.messages}
        keyboardShouldPersistTaps="handled"
      >
        {messages.map((m, idx) => (
          <MessageBubble key={idx} message={m} />
        ))}
        {sending ? (
          <View style={[styles.bubbleRow, { alignSelf: 'flex-start' }]}>
            <View style={[styles.avatar, { backgroundColor: t.primary + '18' }]}>
              <Ionicons name="sparkles-outline" size={14} color={t.primary} />
            </View>
            <View style={[styles.bubble, { backgroundColor: t.muted, borderTopLeftRadius: 4 }]}>
              <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>Thinking…</Text>
            </View>
          </View>
        ) : null}
      </ScrollView>

      {!connected && !statusQ.isLoading ? (
        <Text style={[styles.hint, { color: t.warning }]}>
          Configure an AI provider API key in dashboard settings to enable chat.
        </Text>
      ) : null}

      <View style={[styles.inputBar, { backgroundColor: t.card, borderColor: t.border }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Ask anything…"
          placeholderTextColor={t.mutedForeground}
          editable={connected && !sending}
          multiline
          style={[
            styles.textInput,
            {
              color: t.foreground,
              backgroundColor: t.background,
              borderColor: t.border,
            },
          ]}
        />
        <Pressable
          onPress={handleSend}
          disabled={!input.trim() || sending || !connected}
          style={[
            styles.sendBtn,
            {
              backgroundColor: input.trim() && connected && !sending ? t.primary : t.muted,
            },
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send message"
        >
          <Ionicons
            name="send"
            size={18}
            color={input.trim() && connected && !sending ? t.primaryForeground : t.mutedForeground}
          />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const t = useTheme();
  const isUser = message.role === 'user';

  return (
    <View style={[styles.bubbleRow, { alignSelf: isUser ? 'flex-end' : 'flex-start' }]}>
      {!isUser ? (
        <View style={[styles.avatar, { backgroundColor: t.primary + '18' }]}>
          <Ionicons name="sparkles-outline" size={14} color={t.primary} />
        </View>
      ) : null}
      <View style={{ maxWidth: '82%', gap: spacing.xs }}>
        <View
          style={[
            styles.bubble,
            isUser
              ? { backgroundColor: t.primary, borderTopRightRadius: 4 }
              : { backgroundColor: t.card, borderColor: t.border, borderWidth: StyleSheet.hairlineWidth, borderTopLeftRadius: 4 },
          ]}
        >
          <Text
            style={{
              color: isUser ? t.primaryForeground : t.foreground,
              fontSize: fontSize.sm,
              lineHeight: 20,
            }}
          >
            {message.content}
          </Text>
        </View>
        {message.toolsUsed && message.toolsUsed.length > 0 ? (
          <View style={[styles.toolsPill, { backgroundColor: t.muted }]}>
            <Ionicons name="build-outline" size={12} color={t.primary} />
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
              Tools: {message.toolsUsed.join(', ')}
            </Text>
          </View>
        ) : null}
      </View>
      {isUser ? (
        <View style={[styles.avatar, { backgroundColor: t.accent }]}>
          <Ionicons name="person-outline" size={14} color={t.accentForeground} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  statusBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  sparkle: {
    width: 32,
    height: 32,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  messages: {
    padding: spacing.lg,
    gap: spacing.md,
    paddingBottom: spacing.xl,
  },
  bubbleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    maxWidth: '100%',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  toolsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.full,
  },
  hint: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xs,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  textInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: fontSize.md,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

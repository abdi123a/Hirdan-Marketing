import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui/Text';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { fontSize, radius, spacing } from '../../constants/theme';
import { useTheme } from '../../hooks/useTheme';
import { Badge, Button, SearchBar, Sheet, DetailSkeleton } from '../ui';
import { emailApi } from '../../lib/email/api';
import { useCustomer, useLinkClient } from '../../lib/email/hooks';
import { listTime } from '../../lib/email/format';
import type { ClientLite } from '../../lib/email/types';
import { EmailAvatar } from './EmailAvatar';

export function CustomerSheet({
  visible,
  onClose,
  conversationId,
}: {
  visible: boolean;
  onClose: () => void;
  conversationId: string;
}) {
  const t = useTheme();
  const router = useRouter();
  const { data, isLoading } = useCustomer(visible ? conversationId : null);
  const link = useLinkClient(conversationId);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ClientLite[]>([]);
  const [searching, setSearching] = useState(false);

  const customer = data?.customer ?? null;
  const suggested = data?.suggested ?? false;

  useEffect(() => {
    const term = query.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = setTimeout(() => {
      emailApi
        .searchClients(term)
        .then((res) => {
          if (!cancelled) setResults(res.clients);
        })
        .catch(() => {
          if (!cancelled) setResults([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query]);

  const openClient = (id: string) => {
    onClose();
    router.push(`/client/${id}`);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Customer">
      {isLoading ? (
        <DetailSkeleton padding={0} />
      ) : customer ? (
        <View style={{ gap: spacing.lg }}>
          {suggested ? (
            <View style={[styles.suggested, { borderColor: t.primary, backgroundColor: t.accent }]}>
              <Ionicons name="sparkles-outline" size={15} color={t.primary} />
              <Text style={{ flex: 1, color: t.foreground, fontSize: fontSize.xs }}>
                Suggested match by email.
              </Text>
              <Button
                title="Link"
                size="sm"
                onPress={() => link.mutate(customer.id)}
                loading={link.isPending}
              />
            </View>
          ) : null}

          <View style={styles.identity}>
            <EmailAvatar name={customer.name} email={customer.email} size={48} />
            <View style={{ flex: 1 }}>
              <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.md, fontWeight: '700' }}>
                {customer.name}
              </Text>
              <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                {customer.company}
              </Text>
            </View>
          </View>

          <View style={{ gap: spacing.xs }}>
            {customer.email ? <ContactLine icon="mail-outline" text={customer.email} /> : null}
            {customer.phone ? <ContactLine icon="call-outline" text={customer.phone} /> : null}
            {customer.city || customer.country ? (
              <ContactLine
                icon="location-outline"
                text={[customer.city, customer.country].filter(Boolean).join(', ')}
              />
            ) : null}
            <View style={styles.contactLine}>
              <Ionicons name="business-outline" size={15} color={t.mutedForeground} />
              <Badge label={customer.status} />
            </View>
          </View>

          <View style={styles.stats}>
            <Stat label="Invoices" value={customer._count.invoices} />
            <Stat label="Projects" value={customer._count.projects} />
            <Stat label="Emails" value={customer._count.emailConversations} />
          </View>

          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Button
              title="Open customer"
              variant="outline"
              size="sm"
              onPress={() => openClient(customer.id)}
              style={{ flex: 1 }}
            />
            {!suggested ? (
              <Button
                title="Unlink"
                variant="ghost"
                size="sm"
                onPress={() => link.mutate(null)}
                loading={link.isPending}
              />
            ) : null}
          </View>

          {customer.invoices.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={[styles.sectionLabel, { color: t.mutedForeground }]}>Recent invoices</Text>
              {customer.invoices.map((invoice) => (
                <Pressable
                  key={invoice.id}
                  onPress={() => {
                    onClose();
                    router.push(`/invoice/${invoice.id}`);
                  }}
                  style={({ pressed }) => [
                    styles.miniRow,
                    { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
                  ]}
                >
                  <Ionicons name="document-text-outline" size={14} color={t.mutedForeground} />
                  <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.xs }}>
                    {invoice.invoiceNumber}
                  </Text>
                  {/* The payload carries no currency, so show a bare amount like the web panel. */}
                  <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {Number(invoice.amount).toLocaleString()}
                  </Text>
                  <Badge label={invoice.status} />
                </Pressable>
              ))}
            </View>
          ) : null}

          {customer.emailConversations.length > 0 ? (
            <View style={{ gap: spacing.xs }}>
              <Text style={[styles.sectionLabel, { color: t.mutedForeground }]}>Other conversations</Text>
              {customer.emailConversations.map((conversation) => (
                <View key={conversation.id} style={[styles.miniRow, { borderColor: t.border }]}>
                  <Text numberOfLines={1} style={{ flex: 1, color: t.foreground, fontSize: fontSize.xs }}>
                    {conversation.subject || '(no subject)'}
                  </Text>
                  {conversation.unreadCount > 0 ? (
                    <View style={[styles.dot, { backgroundColor: t.primary }]} />
                  ) : null}
                  <Text style={{ color: t.mutedForeground, fontSize: 10 }}>
                    {listTime(conversation.lastMessageAt)}
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <View style={{ gap: spacing.md }}>
          <View style={{ alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg }}>
            <Ionicons name="person-outline" size={32} color={t.mutedForeground} />
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm, textAlign: 'center' }}>
              No customer linked to this conversation.
            </Text>
          </View>
          <SearchBar value={query} onChangeText={setQuery} placeholder="Search clients to link…" />
          {searching ? <ActivityIndicator color={t.primary} /> : null}
          <View style={{ gap: spacing.xs }}>
            {results.map((client) => (
              <Pressable
                key={client.id}
                onPress={() => link.mutate(client.id)}
                style={({ pressed }) => [
                  styles.miniRow,
                  { borderColor: t.border, backgroundColor: pressed ? t.accent : 'transparent' },
                ]}
              >
                <Ionicons name="link-outline" size={15} color={t.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text numberOfLines={1} style={{ color: t.foreground, fontSize: fontSize.sm }}>
                    {client.name}
                  </Text>
                  <Text numberOfLines={1} style={{ color: t.mutedForeground, fontSize: fontSize.xs }}>
                    {client.company}
                    {client.email ? ` · ${client.email}` : ''}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      )}
    </Sheet>
  );
}

function ContactLine({ icon, text }: { icon: keyof typeof Ionicons.glyphMap; text: string }) {
  const t = useTheme();
  return (
    <View style={styles.contactLine}>
      <Ionicons name={icon} size={15} color={t.mutedForeground} />
      <Text numberOfLines={1} style={{ flex: 1, color: t.mutedForeground, fontSize: fontSize.sm }}>
        {text}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  const t = useTheme();
  return (
    <View style={[styles.stat, { borderColor: t.border, backgroundColor: t.muted }]}>
      <Text style={{ color: t.foreground, fontSize: fontSize.lg, fontWeight: '700' }}>{value}</Text>
      <Text style={{ color: t.mutedForeground, fontSize: 10, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  suggested: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  contactLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stats: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
  },
  sectionLabel: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  miniRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
});

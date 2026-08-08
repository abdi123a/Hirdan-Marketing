import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from './ui/Text';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Select } from './ui';
import { useTheme } from '../hooks/useTheme';
import type { ClientFormValues } from '../lib/clients';
import { fontSize, radius, spacing } from '../constants/theme';

export function ClientForm({
  form,
  errors,
  onChange,
  onSubmit,
  submitLabel,
  loading,
}: {
  form: ClientFormValues;
  errors: Record<string, string>;
  onChange: <K extends keyof ClientFormValues>(key: K, value: ClientFormValues[K]) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
}) {
  const t = useTheme();

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Client type</Text>
        <View style={styles.typeRow}>
          {(['Business', 'Individual'] as const).map((type) => {
            const active = form.type === type;
            return (
              <Pressable
                key={type}
                onPress={() => onChange('type', type)}
                style={[
                  styles.typeBtn,
                  {
                    backgroundColor: active ? t.primary : t.card,
                    borderColor: active ? t.primary : t.border,
                  },
                ]}
              >
                <Ionicons
                  name={type === 'Business' ? 'business-outline' : 'person-outline'}
                  size={18}
                  color={active ? t.primaryForeground : t.foreground}
                />
                <Text
                  style={{
                    color: active ? t.primaryForeground : t.foreground,
                    fontWeight: '700',
                    fontSize: fontSize.sm,
                  }}
                >
                  {type}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Contact information</Text>
        <Input
          label="Contact name *"
          value={form.name}
          onChangeText={(v) => onChange('name', v)}
          placeholder="Jane Smith"
          autoCapitalize="words"
          error={errors.name}
        />
        <Input
          label={form.type === 'Business' ? 'Company name *' : 'Company name'}
          value={form.company}
          onChangeText={(v) => onChange('company', v)}
          placeholder={form.type === 'Business' ? 'Acme Corporation' : 'Optional'}
          autoCapitalize="words"
          error={errors.company}
        />
        <Input
          label="Email address"
          value={form.email}
          onChangeText={(v) => onChange('email', v)}
          placeholder="jane@acme.com"
          keyboardType="email-address"
          autoCapitalize="none"
          error={errors.email}
        />
        <Input
          label="Phone number"
          value={form.phone}
          onChangeText={(v) => onChange('phone', v)}
          placeholder="+253 77 00 00 00"
          keyboardType="phone-pad"
        />
        <Input
          label="Website"
          value={form.website}
          onChangeText={(v) => onChange('website', v)}
          placeholder="https://acme.com"
          autoCapitalize="none"
          keyboardType="url"
        />
        <Input
          label="Industry"
          value={form.industry}
          onChangeText={(v) => onChange('industry', v)}
          placeholder="e.g. Technology, Finance"
          autoCapitalize="words"
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Address</Text>
        <Input
          label="Street address"
          value={form.address}
          onChangeText={(v) => onChange('address', v)}
          placeholder="123 Business Ave"
        />
        <Input
          label="City"
          value={form.city}
          onChangeText={(v) => onChange('city', v)}
          placeholder="Djibouti"
          autoCapitalize="words"
        />
        <Input
          label="Country"
          value={form.country}
          onChangeText={(v) => onChange('country', v)}
          placeholder="Djibouti"
          autoCapitalize="words"
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Notes</Text>
        <Input
          label="Internal notes"
          value={form.notes}
          onChangeText={(v) => onChange('notes', v)}
          placeholder="Any additional notes about this client…"
          multiline
          style={{ minHeight: 100, textAlignVertical: 'top' }}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Status</Text>
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => onChange('status', v as ClientFormValues['status'])}
          options={[
            { label: 'Active', value: 'Active' },
            { label: 'Paused', value: 'Paused' },
            { label: 'Churned', value: 'Churned' },
          ]}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.sectionTitle, { color: t.foreground }]}>Billing & automation</Text>
        <Input
          label="Invoice generation day (1–28)"
          value={form.invoiceGenerationDay}
          onChangeText={(v) => onChange('invoiceGenerationDay', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="1"
        />
        <Input
          label="Payment reminder delay (days)"
          value={form.paymentReminderDelay}
          onChangeText={(v) => onChange('paymentReminderDelay', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="5"
        />
        <Input
          label="Overdue notice delay (days)"
          value={form.overdueNoticeDelay}
          onChangeText={(v) => onChange('overdueNoticeDelay', v.replace(/[^0-9]/g, ''))}
          keyboardType="number-pad"
          placeholder="10"
        />
      </Card>

      <Button title={submitLabel} loading={loading} onPress={onSubmit} />
    </View>
  );
}

const styles = StyleSheet.create({
  sectionTitle: { fontSize: fontSize.md, fontWeight: '800' },
  typeRow: { flexDirection: 'row', gap: spacing.sm },
  typeBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
});

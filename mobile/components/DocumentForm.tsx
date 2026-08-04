import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card, Input, Select } from './ui';
import { useTheme } from '../hooks/useTheme';
import {
  INVOICE_STATUSES,
  PROFORMA_STATUSES,
  computeDocumentTotals,
  newLineItem,
  type DocKind,
  type DocumentFormState,
} from '../lib/documents';
import { formatMajorMoney } from '../lib/format';
import { fontSize, radius, spacing } from '../constants/theme';

export function DocumentForm({
  kind,
  form,
  errors,
  clients,
  currency,
  inventory = [],
  onChange,
  onSubmit,
  submitLabel,
  loading,
}: {
  kind: DocKind;
  form: DocumentFormState;
  errors: Record<string, string>;
  clients: { id: string; label: string }[];
  currency: string;
  inventory?: { label: string; value: string; unitPrice: number }[];
  onChange: (next: DocumentFormState) => void;
  onSubmit: () => void;
  submitLabel: string;
  loading?: boolean;
}) {
  const t = useTheme();
  const totals = computeDocumentTotals(form);
  const money = (n: number) => formatMajorMoney(n, currency);
  const statuses = kind === 'invoice' ? INVOICE_STATUSES : PROFORMA_STATUSES;
  const clientOptions = clients.map((c) => ({ label: c.label, value: c.id }));

  const set = <K extends keyof DocumentFormState>(key: K, value: DocumentFormState[K]) => {
    onChange({ ...form, [key]: value });
  };

  const updateItem = (key: string, patch: Partial<(typeof form.items)[0]>) => {
    onChange({
      ...form,
      items: form.items.map((item) => (item.key === key ? { ...item, ...patch } : item)),
    });
  };

  const removeItem = (key: string) => {
    if (form.items.length <= 1) return;
    onChange({ ...form, items: form.items.filter((i) => i.key !== key) });
  };

  const addFromInventory = (value: string) => {
    const inv = inventory.find((i) => i.value === value);
    if (!inv) return;
    const existing = form.items.find(
      (i) => i.description.replace(/<[^>]*>?/gm, '').trim() === inv.label
    );
    if (existing) {
      updateItem(existing.key, {
        quantity: String((parseInt(existing.quantity, 10) || 0) + 1),
        unitPrice: String(inv.unitPrice),
      });
      return;
    }
    const item = newLineItem();
    item.description = inv.label;
    item.unitPrice = String(inv.unitPrice);
    const first = form.items[0];
    if (form.items.length === 1 && !first.description.trim() && !first.unitPrice) {
      onChange({ ...form, items: [{ ...item, key: first.key }] });
    } else {
      onChange({ ...form, items: [...form.items, item] });
    }
  };

  return (
    <View style={{ gap: spacing.lg }}>
      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.section, { color: t.foreground }]}>
          {kind === 'invoice' ? 'Invoice details' : 'Proforma details'}
        </Text>
        <View style={[styles.numberBox, { backgroundColor: t.primary + '12', borderColor: t.primary + '33' }]}>
          <Text style={{ color: t.mutedForeground, fontSize: fontSize.sm }}>Number</Text>
          <Text style={{ color: t.primary, fontWeight: '800', fontSize: fontSize.lg }}>{form.number}</Text>
        </View>
        <Select
          label="Client *"
          value={form.clientId}
          onChange={(v) => set('clientId', v)}
          options={clientOptions}
          placeholder="Select a client"
        />
        {errors.clientId ? <Text style={styles.error}>{errors.clientId}</Text> : null}
        <Input
          label="Date (YYYY-MM-DD) *"
          value={form.date}
          onChangeText={(v) => set('date', v)}
          placeholder="2026-08-04"
          autoCapitalize="none"
          error={errors.date}
        />
        <Input
          label={kind === 'invoice' ? 'Due date *' : 'Valid until *'}
          value={form.dueDate}
          onChangeText={(v) => set('dueDate', v)}
          placeholder="2026-08-18"
          autoCapitalize="none"
          error={errors.dueDate}
        />
        <Select
          label="Status"
          value={form.status}
          onChange={(v) => set('status', v)}
          options={statuses}
        />
      </Card>

      <Card style={{ gap: spacing.md }}>
        <View style={styles.rowBetween}>
          <Text style={[styles.section, { color: t.foreground }]}>Line items</Text>
          <Pressable
            onPress={() => set('items', [...form.items, newLineItem()])}
            style={[styles.addChip, { backgroundColor: t.primary + '18' }]}
          >
            <Ionicons name="add" size={16} color={t.primary} />
            <Text style={{ color: t.primary, fontWeight: '700', fontSize: fontSize.xs }}>Add item</Text>
          </Pressable>
        </View>
        {inventory.length > 0 ? (
          <Select
            label="Add from inventory"
            value=""
            onChange={addFromInventory}
            options={inventory.map((i) => ({
              label: `${i.label} · ${money(i.unitPrice)}`,
              value: i.value,
            }))}
            placeholder="Services & packages…"
          />
        ) : null}
        {errors.items ? <Text style={styles.error}>{errors.items}</Text> : null}
        {form.items.map((item, index) => (
          <View
            key={item.key}
            style={[styles.itemCard, { borderColor: t.border, backgroundColor: t.muted + '55' }]}
          >
            <View style={styles.rowBetween}>
              <Text style={{ color: t.mutedForeground, fontWeight: '700', fontSize: fontSize.xs }}>
                ITEM {index + 1}
              </Text>
              {form.items.length > 1 ? (
                <Pressable onPress={() => removeItem(item.key)} hitSlop={8}>
                  <Ionicons name="trash-outline" size={18} color={t.destructive} />
                </Pressable>
              ) : null}
            </View>
            <Input
              label="Description *"
              value={item.description}
              onChangeText={(v) => updateItem(item.key, { description: v })}
              placeholder="Service or product"
            />
            <View style={styles.row}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Qty"
                  value={item.quantity}
                  onChangeText={(v) => updateItem(item.key, { quantity: v.replace(/[^0-9]/g, '') })}
                  keyboardType="number-pad"
                  placeholder="1"
                />
              </View>
              <View style={{ flex: 2 }}>
                <Input
                  label="Unit price"
                  value={item.unitPrice}
                  onChangeText={(v) => updateItem(item.key, { unitPrice: v })}
                  keyboardType="decimal-pad"
                  placeholder="0"
                />
              </View>
            </View>
            <Text style={{ color: t.mutedForeground, fontSize: fontSize.xs, textAlign: 'right' }}>
              Line total{' '}
              {money((parseInt(item.quantity, 10) || 0) * (parseFloat(item.unitPrice) || 0))}
            </Text>
          </View>
        ))}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.section, { color: t.foreground }]}>Tax, discount & deposit</Text>
        <Input
          label="Tax / TVA (%)"
          value={form.taxRate}
          onChangeText={(v) => set('taxRate', v)}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Select
          label="Discount type"
          value={form.discountType}
          onChange={(v) => set('discountType', v as 'fixed' | 'percentage')}
          options={[
            { label: 'Fixed amount', value: 'fixed' },
            { label: 'Percentage', value: 'percentage' },
          ]}
        />
        <Input
          label={form.discountType === 'percentage' ? 'Discount (%)' : 'Discount amount'}
          value={form.discount}
          onChangeText={(v) => set('discount', v)}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        <Input
          label="Deposit / paid amount"
          value={form.deposit}
          onChangeText={(v) => set('deposit', v)}
          keyboardType="decimal-pad"
          placeholder="0"
        />
        {kind === 'invoice' ? (
          <Input
            label="Payment method"
            value={form.paymentMethod}
            onChangeText={(v) => set('paymentMethod', v)}
            placeholder="Bank transfer, cash…"
          />
        ) : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <Text style={[styles.section, { color: t.foreground }]}>Notes & delivery</Text>
        <Input
          label="Notes"
          value={form.notes}
          onChangeText={(v) => set('notes', v)}
          placeholder="Thank you for your business!"
          multiline
          style={{ minHeight: 88, textAlignVertical: 'top' }}
        />
        <ToggleRow
          label="Show signature"
          value={form.showSignature}
          onChange={(v) => set('showSignature', v)}
        />
        <ToggleRow label="Show stamp" value={form.showStamp} onChange={(v) => set('showStamp', v)} />
        <ToggleRow
          label="Include delivery note"
          value={form.deliveryNoteEnabled}
          onChange={(v) => set('deliveryNoteEnabled', v)}
        />
        {form.deliveryNoteEnabled ? (
          <>
            <Input
              label="Delivery note title"
              value={form.deliveryNoteTitle}
              onChangeText={(v) => set('deliveryNoteTitle', v)}
              placeholder="Delivery Terms"
            />
            <Input
              label="Delivery note content"
              value={form.deliveryNoteContent}
              onChangeText={(v) => set('deliveryNoteContent', v)}
              placeholder="Terms of delivery…"
              multiline
              style={{ minHeight: 88, textAlignVertical: 'top' }}
            />
          </>
        ) : null}
      </Card>

      <Card style={{ gap: spacing.sm }}>
        <Text style={[styles.section, { color: t.foreground }]}>Summary</Text>
        <SummaryRow label="Subtotal" value={money(totals.subtotal)} />
        {totals.tax > 0 ? <SummaryRow label={`Tax (${form.taxRate}%)`} value={money(totals.tax)} /> : null}
        {totals.discount > 0 ? (
          <SummaryRow label="Discount" value={`-${money(totals.discount)}`} tone="destructive" />
        ) : null}
        <SummaryRow label="Total" value={money(totals.total)} bold />
        {totals.deposit > 0 ? (
          <SummaryRow label="Deposit" value={`-${money(totals.deposit)}`} tone="success" />
        ) : null}
        <SummaryRow label="Balance due" value={money(totals.balanceDue)} bold />
      </Card>

      <Button title={submitLabel} loading={loading} onPress={onSubmit} />
    </View>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  const t = useTheme();
  return (
    <Pressable
      onPress={() => onChange(!value)}
      style={[styles.toggle, { borderColor: t.border }]}
    >
      <Text style={{ color: t.foreground, fontWeight: '600', flex: 1 }}>{label}</Text>
      <Ionicons
        name={value ? 'checkbox' : 'square-outline'}
        size={22}
        color={value ? t.primary : t.mutedForeground}
      />
    </Pressable>
  );
}

function SummaryRow({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: 'destructive' | 'success';
}) {
  const t = useTheme();
  const color =
    tone === 'destructive' ? t.destructive : tone === 'success' ? t.success : t.foreground;
  return (
    <View style={styles.rowBetween}>
      <Text style={{ color: t.mutedForeground, fontWeight: bold ? '700' : '500' }}>{label}</Text>
      <Text style={{ color, fontWeight: bold ? '800' : '600' }}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { fontSize: fontSize.md, fontWeight: '800' },
  numberBox: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  addChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.full,
  },
  itemCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.sm,
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
  },
  error: { color: '#E53E3E', fontSize: fontSize.xs, fontWeight: '600' },
});

/** Invoice / proforma form helpers — mirrors web AddInvoice / AddProforma. */

export type DocKind = 'invoice' | 'proforma';

export type LineItemForm = {
  key: string;
  description: string;
  quantity: string;
  unitPrice: string; // major units
};

export type DocumentFormState = {
  number: string;
  clientId: string;
  date: string;
  dueDate: string;
  status: string;
  taxRate: string;
  discountType: 'fixed' | 'percentage';
  discount: string;
  deposit: string;
  paymentMethod: string;
  notes: string;
  showSignature: boolean;
  showStamp: boolean;
  deliveryNoteEnabled: boolean;
  deliveryNoteTitle: string;
  deliveryNoteContent: string;
  items: LineItemForm[];
};

export const INVOICE_STATUSES = [
  { label: 'Pending', value: 'Pending' },
  { label: 'Partially Paid', value: 'Partially Paid' },
  { label: 'Paid', value: 'Paid' },
  { label: 'Overdue', value: 'Overdue' },
];

export const PROFORMA_STATUSES = [
  { label: 'Draft', value: 'Draft' },
  { label: 'Sent', value: 'Sent' },
  { label: 'Accepted', value: 'Accepted' },
  { label: 'Partially Paid', value: 'Partially Paid' },
  { label: 'Expired', value: 'Expired' },
];

function isoDate(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function newLineItem(): LineItemForm {
  return {
    key: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    description: '',
    quantity: '1',
    unitPrice: '',
  };
}

export function generateDocNumber(kind: DocKind) {
  const n = Math.floor(Math.random() * 9000 + 1000);
  return kind === 'invoice' ? `INV-${n}` : `PRO-${n}`;
}

export function emptyDocumentForm(kind: DocKind, taxRate = 0): DocumentFormState {
  const today = isoDate();
  return {
    number: generateDocNumber(kind),
    clientId: '',
    date: today,
    dueDate: addDays(today, kind === 'invoice' ? 14 : 30),
    status: kind === 'invoice' ? 'Pending' : 'Draft',
    taxRate: String(taxRate || 0),
    discountType: 'fixed',
    discount: '0',
    deposit: '0',
    paymentMethod: '',
    notes: 'Thank you for your business!',
    showSignature: true,
    showStamp: true,
    deliveryNoteEnabled: false,
    deliveryNoteTitle: 'Delivery Terms',
    deliveryNoteContent: '',
    items: [newLineItem()],
  };
}

export function parseMoney(value: string | number | undefined | null): number {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  return parseFloat(String(value).replace(/[^0-9.-]/g, '')) || 0;
}

/** Display totals in major units (same formula as web UI). */
export function computeDocumentTotals(form: DocumentFormState) {
  const subtotal = form.items.reduce((sum, item) => {
    const qty = Math.max(0, parseInt(item.quantity, 10) || 0);
    const price = parseMoney(item.unitPrice);
    return sum + qty * price;
  }, 0);
  const taxRate = parseMoney(form.taxRate);
  const tax = subtotal * (taxRate / 100);
  const discountValue = parseMoney(form.discount);
  const discount =
    form.discountType === 'percentage' ? (subtotal * discountValue) / 100 : discountValue;
  const total = Math.max(0, subtotal + tax - discount);
  const deposit = parseMoney(form.deposit);
  const balanceDue = Math.max(0, total - deposit);
  return { subtotal, tax, discount, total, deposit, balanceDue };
}

export function resolveAutoStatus(kind: DocKind, form: DocumentFormState, total: number): string {
  const deposit = parseMoney(form.deposit);
  if (deposit <= 0) return form.status;
  if (kind === 'invoice') {
    if (deposit >= total) return 'Paid';
    return 'Partially Paid';
  }
  if (deposit >= total) return 'Accepted';
  return 'Partially Paid';
}

export function validateDocumentForm(form: DocumentFormState): Record<string, string> {
  const e: Record<string, string> = {};
  if (!form.clientId) e.clientId = 'Please select a client';
  if (!form.number.trim()) e.number = 'Document number is required';
  if (!form.date.trim()) e.date = 'Date is required';
  if (!form.dueDate.trim()) e.dueDate = 'Due date is required';
  if (
    form.items.length === 0 ||
    form.items.some((i) => !i.description.replace(/<[^>]*>?/gm, '').trim())
  ) {
    e.items = 'All line items must have a description';
  }
  if (form.items.some((i) => (parseInt(i.quantity, 10) || 0) < 1)) {
    e.items = e.items || 'Quantity must be at least 1';
  }
  return e;
}

/** Build API payload. For invoices, amount is omitted so the server computes it. */
export function buildDocumentPayload(kind: DocKind, form: DocumentFormState) {
  const { total } = computeDocumentTotals(form);
  const status = resolveAutoStatus(kind, form, total);
  const items = form.items.map((item, index) => ({
    description: item.description.trim(),
    quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
    unitPrice: Math.round(parseMoney(item.unitPrice) * 100),
    position: index,
  }));

  const base = {
    clientId: form.clientId,
    status: status.toUpperCase().replace(/\s+/g, '_'),
    date: new Date(form.date + 'T12:00:00').toISOString(),
    dueDate: new Date(form.dueDate + 'T12:00:00').toISOString(),
    taxRate: parseMoney(form.taxRate),
    discount: parseMoney(form.discount),
    discountType: form.discountType.toUpperCase() as 'FIXED' | 'PERCENTAGE',
    deposit: Math.round(parseMoney(form.deposit) * 100),
    notes: form.notes.trim() || null,
    showSignature: form.showSignature,
    showStamp: form.showStamp,
    deliveryNoteEnabled: form.deliveryNoteEnabled,
    deliveryNoteTitle: form.deliveryNoteEnabled ? form.deliveryNoteTitle.trim() || 'Delivery Terms' : null,
    deliveryNoteContent: form.deliveryNoteEnabled ? form.deliveryNoteContent.trim() || null : null,
    items,
  };

  if (kind === 'invoice') {
    return {
      ...base,
      invoiceNumber: form.number.trim(),
      paymentMethod: form.paymentMethod.trim() || null,
      // Omit amount — server computes from items (avoids mismatch)
    };
  }

  return {
    ...base,
    proformaNumber: form.number.trim(),
    amount: Math.round(total * 100),
  };
}

export function formFromDocument(
  kind: DocKind,
  raw: any,
  fallbackTax = 0
): DocumentFormState {
  const status = String(raw.status || (kind === 'invoice' ? 'PENDING' : 'DRAFT'))
    .split('_')
    .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
  const discountType =
    String(raw.discountType || 'FIXED').toUpperCase() === 'PERCENTAGE' ? 'percentage' : 'fixed';
  const items: LineItemForm[] =
    (raw.items || []).length > 0
      ? (raw.items as any[]).map((item, i) => ({
          key: item.id || `item-${i}`,
          description: item.description || '',
          quantity: String(item.quantity ?? 1),
          unitPrice: String(((item.unitPrice || 0) as number) / 100),
        }))
      : [newLineItem()];

  return {
    number: kind === 'invoice' ? raw.invoiceNumber || '' : raw.proformaNumber || '',
    clientId: raw.clientId || raw.client?.id || '',
    date: raw.date ? String(raw.date).split('T')[0] : isoDate(),
    dueDate: raw.dueDate ? String(raw.dueDate).split('T')[0] : isoDate(),
    status,
    taxRate: String(raw.taxRate ?? fallbackTax),
    discountType,
    discount: String(raw.discount ?? 0),
    deposit: String(((raw.deposit || 0) as number) / 100),
    paymentMethod: raw.paymentMethod || '',
    notes: raw.notes || '',
    showSignature: raw.showSignature !== false,
    showStamp: raw.showStamp !== false,
    deliveryNoteEnabled: Boolean(raw.deliveryNoteEnabled),
    deliveryNoteTitle: raw.deliveryNoteTitle || 'Delivery Terms',
    deliveryNoteContent: raw.deliveryNoteContent || '',
    items,
  };
}

export function titleCaseStatus(status?: string) {
  return String(status || '')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export const EXPENSE_CATEGORIES = [
  { label: 'Food', value: 'FOOD' },
  { label: 'Transport', value: 'TRANSPORT' },
  { label: 'Software', value: 'SOFTWARE' },
  { label: 'Office', value: 'OFFICE' },
  { label: 'Marketing', value: 'MARKETING' },
  { label: 'Rent', value: 'RENT' },
  { label: 'Utilities', value: 'UTILITIES' },
  { label: 'Payroll', value: 'PAYROLL' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Travel', value: 'TRAVEL' },
  { label: 'Communication', value: 'COMMUNICATION' },
  { label: 'Entertainment', value: 'ENTERTAINMENT' },
  { label: 'Taxes', value: 'TAXES' },
  { label: 'Other', value: 'OTHER' },
] as const;

export const FOLLOW_UP_TYPES = [
  { label: 'Gentle reminder', value: 'GENTLE_REMINDER' },
  { label: 'Expiring soon', value: 'EXPIRING_SOON' },
  { label: 'Deposit required', value: 'DEPOSIT_REQUIRED' },
  { label: 'Final notice', value: 'FINAL_NOTICE' },
] as const;

/** Invoice list stats — mirrors web InvoicesPage cards (amounts in cents). */
export function computeInvoiceListStats(
  invoices: Array<{
    status?: string;
    amount?: number;
    total?: number;
    deposit?: number | null;
    dueDate?: string | null;
  }>
) {
  let paid = 0;
  let paidCount = 0;
  let pending = 0;
  let pendingCount = 0;
  let overdue = 0;
  let overdueCount = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const inv of invoices) {
    const status = String(inv.status || '').toUpperCase();
    const total = inv.total ?? inv.amount ?? 0;
    const deposit = inv.deposit || 0;
    const remaining = Math.max(0, total - deposit);
    const due = inv.dueDate ? new Date(inv.dueDate) : null;
    const pastDue = due ? due < today : false;

    if (status === 'PAID') {
      paid += total;
      paidCount += 1;
    } else if (status === 'PARTIALLY_PAID') {
      paid += deposit;
      paidCount += 1;
      if (pastDue) {
        overdue += remaining;
        overdueCount += 1;
      } else {
        pending += remaining;
      }
    } else if (status === 'OVERDUE') {
      overdue += remaining;
      overdueCount += 1;
    } else {
      pending += remaining;
      pendingCount += 1;
    }
  }

  return { paid, paidCount, pending, pendingCount, overdue, overdueCount };
}

export function computeExpenseListStats(
  expenses: Array<{ amount?: number }>,
  accounts: Array<{ balance?: number }> = []
) {
  const totalExpenses = expenses.reduce((s, e) => s + (e.amount || 0), 0);
  const totalBalance = accounts.reduce((s, a) => s + (a.balance || 0), 0);
  return { totalExpenses, totalBalance };
}

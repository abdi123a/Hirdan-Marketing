/**
 * Pure business rules shared by the invoice and proforma routes. Kept free of
 * Prisma / Express so they can be unit-tested in isolation.
 */
import { cleanRichText } from './rich-text.js';
import { computeInvoiceTotalsCents, deriveBaseSubtotalCents, type TotalsItem } from './money.js';

export type DocItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
  position?: number;
  discountable?: boolean;
};

export type DocItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  position: number;
  discountable: boolean;
};

/**
 * Normalize incoming items: positions follow array order, discountable
 * defaults to true, and descriptions (rendered as HTML by the web app and the
 * PDF) are passed through the rich-text allowlist.
 */
export function normalizeItems(items: DocItemInput[] | undefined): DocItem[] | undefined {
  return items?.map((item, index) => ({
    description: cleanRichText(item.description),
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    position: item.position !== undefined ? item.position : index,
    discountable: item.discountable !== false,
  }));
}

/** Whether two line-item lists are financially and textually identical. */
export function sameItems(
  next: DocItem[],
  current: Array<{ description: string; quantity: number; unitPrice: number; position: number; discountable: boolean }>
): boolean {
  if (next.length !== current.length) return false;
  const byPos = <T extends { position: number }>(list: T[]) => [...list].sort((a, b) => a.position - b.position);
  const a = byPos(next);
  const b = byPos(current);
  return a.every(
    (item, i) =>
      item.quantity === b[i].quantity &&
      item.unitPrice === b[i].unitPrice &&
      item.discountable === (b[i].discountable !== false) &&
      item.description === cleanRichText(b[i].description)
  );
}

const DATE_FIELDS = new Set(['date', 'dueDate']);
const ZERO_DEFAULT_FIELDS = new Set(['deposit', 'taxRate', 'discount']);
const RICH_FIELDS = new Set(['deliveryNoteContent']);

function sameValue(key: string, next: unknown, current: unknown): boolean {
  if (DATE_FIELDS.has(key)) {
    const t = (v: unknown) => (v == null ? null : new Date(v as string | Date).getTime());
    return t(next) === t(current);
  }
  if (ZERO_DEFAULT_FIELDS.has(key)) return (next ?? 0) === (current ?? 0);
  if (RICH_FIELDS.has(key) && typeof current === 'string') {
    return (next ?? null) === (cleanRichText(current) ?? null);
  }
  return (next ?? null) === (current ?? null);
}

/**
 * Keys of `body` whose value differs from the stored document. `items` is
 * compared structurally against `currentItems`.
 */
export function changedFields(
  body: Record<string, unknown>,
  current: Record<string, unknown>,
  currentItems: Parameters<typeof sameItems>[1]
): string[] {
  return Object.keys(body).filter((key) => {
    if (body[key] === undefined) return false;
    if (key === 'items') return !sameItems(body.items as DocItem[], currentItems);
    return !sameValue(key, body[key], current[key]);
  });
}

/** Fields that determine what an invoice is worth / what was paid. */
export const FINANCIAL_FIELDS = ['items', 'amount', 'deposit', 'taxRate', 'discount', 'discountType'] as const;

/**
 * Client-portal note edits may only append (the portal appends a
 * "[Client Approved …]" line); clients may not rewrite the agency's notes.
 */
export function isAppendOnlyNotes(previous: string | null | undefined, next: string | null | undefined): boolean {
  const prev = (previous ?? '').trim();
  if (!prev) return true;
  return (next ?? '').trim().startsWith(prev);
}

/** Validate a discount against its type. Returns an error message or null. */
export function discountError(discount: number | null | undefined, discountType: string | null | undefined): string | null {
  if (discount == null) return null;
  if (discount < 0) return 'Discount cannot be negative.';
  if (String(discountType || '').toUpperCase() === 'PERCENTAGE' && discount > 100) {
    return 'A percentage discount cannot exceed 100%.';
  }
  return null;
}

/**
 * Server-authoritative stored total (cents) of a document after an update.
 *
 * - With line items (sent or stored) the total is recomputed from them.
 * - Without line items an explicit `amount` wins; otherwise a tax / discount
 *   change re-prices the existing base (the stored total with the old tax and
 *   discount taken back out) instead of collapsing the total to $0.
 */
export function resolveTotalCents(input: {
  items: TotalsItem[];
  explicitAmount?: number;
  affectsTotal: boolean;
  current: { amount: number; taxRate: number | null; discount: number | null; discountType: string | null };
  next: { taxRate: number | null; discount: number | null; discountType: string | null };
}): number {
  const { items, current, next } = input;
  if (items.length) {
    if (!input.affectsTotal) return current.amount;
    return computeInvoiceTotalsCents({ items, ...next }).totalCents;
  }
  if (input.explicitAmount !== undefined) return input.explicitAmount;
  if (!input.affectsTotal) return current.amount;
  const baseSubtotalCents = deriveBaseSubtotalCents(
    current.amount,
    current.taxRate,
    current.discount,
    current.discountType
  );
  return computeInvoiceTotalsCents({ baseSubtotalCents, ...next }).totalCents;
}

export type InvoicePaymentStatus = 'PAID' | 'PARTIALLY_PAID' | 'PENDING' | 'OVERDUE';

export type PaymentResolution =
  | { ok: true; status: InvoicePaymentStatus; deposit: number | null }
  | { ok: false; error: string };

/**
 * Keep an invoice's status and recorded payment (deposit) consistent, since
 * the ledger (deposit-sync) books `amount` for PAID and `deposit` for
 * PARTIALLY_PAID.
 *
 * When the amount / payment inputs changed (or on create) the status follows
 * the money, exactly like the web editor does: deposit ≥ total ⇒ PAID,
 * 0 < deposit < total ⇒ PARTIALLY_PAID. On a status-only change the chosen
 * status wins and the deposit is adjusted to match it.
 */
export function resolveInvoicePayment(input: {
  amount: number;
  deposit: number | null | undefined;
  status: InvoicePaymentStatus;
  previousStatus?: InvoicePaymentStatus;
  financialChange: boolean;
}): PaymentResolution {
  const amount = input.amount;
  const deposit = input.deposit ?? null;
  const d = deposit ?? 0;
  // Nothing payment-related changed (e.g. a notes edit): leave stored state be.
  if (!input.financialChange && input.previousStatus === input.status) {
    return { ok: true, status: input.status, deposit };
  }
  if (d < 0) return { ok: false, error: 'The amount received cannot be negative.' };
  if (d > amount) return { ok: false, error: 'The amount received cannot exceed the invoice total.' };

  if (input.financialChange) {
    if (amount > 0 && d >= amount) return { ok: true, status: 'PAID', deposit };
    if (d > 0) return { ok: true, status: 'PARTIALLY_PAID', deposit };
    if (input.status === 'PARTIALLY_PAID') {
      return { ok: false, error: 'Enter the amount received for a partially paid invoice.' };
    }
    return { ok: true, status: input.status, deposit };
  }

  switch (input.status) {
    case 'PAID':
      // Marking a partially paid invoice as paid records the full payment.
      return { ok: true, status: 'PAID', deposit: d > 0 && d < amount ? amount : deposit };
    case 'PARTIALLY_PAID':
      if (d <= 0) return { ok: false, error: 'Enter the amount received for a partially paid invoice.' };
      if (d >= amount) {
        return { ok: false, error: 'The amount received covers the full total; lower it before marking the invoice partially paid.' };
      }
      return { ok: true, status: 'PARTIALLY_PAID', deposit };
    default:
      // Reverting a paid invoice to unpaid clears the recorded full payment.
      if (input.previousStatus === 'PAID' && amount > 0 && d >= amount) {
        return { ok: true, status: input.status, deposit: null };
      }
      return { ok: true, status: input.status, deposit };
  }
}

/**
 * Client-portal proforma transitions: accept, or send back for revision
 * (DRAFT), and only while the proforma is awaiting the client's decision.
 */
const CLIENT_PROFORMA_FROM = new Set(['SENT', 'PARTIALLY_PAID']);
const CLIENT_PROFORMA_TO = new Set(['ACCEPTED', 'DRAFT']);

export function isClientProformaTransitionAllowed(from: string, to: string): boolean {
  if (from === to) return true;
  return CLIENT_PROFORMA_FROM.has(from) && CLIENT_PROFORMA_TO.has(to);
}

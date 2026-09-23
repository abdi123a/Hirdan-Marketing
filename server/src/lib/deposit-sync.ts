import { prisma } from './prisma.js';

/** The extended Prisma client or an interactive-transaction client of it. */
export type DepositSyncClient = Pick<typeof prisma, 'invoice' | 'deposit' | 'account' | 'agencySettings'>;
type Tx = DepositSyncClient;

/**
 * Marker embedded in the description of every invoice-derived deposit.
 * Kept for backwards compatibility: financial reports identify invoice revenue
 * by category REVENUE + this text, and pre-migration rows are matched by it.
 */
export function invoiceDepositMarker(invoiceId: string): string {
  return `(ID: ${invoiceId})`;
}

/** Amount (cents) the ledger should hold for an invoice in its current state. */
export function targetDepositCents(invoice: {
  status: string;
  amount: number;
  deposit: number | null;
}): number {
  if (invoice.status === 'PAID') return invoice.amount;
  if (invoice.status === 'PARTIALLY_PAID') return invoice.deposit ?? 0;
  return 0;
}

async function resolveAccount(tx: Tx, paymentMethodRaw: string | null) {
  const paymentMethod = paymentMethodRaw?.trim() || 'Bank Transfer';

  // Try to find account with exact case-insensitive name match
  let account = await tx.account.findFirst({
    where: { name: { equals: paymentMethod }, isArchived: false },
  });

  const pmLower = paymentMethod.toLowerCase();
  const isWallet =
    pmLower.includes('wallet') ||
    pmLower.includes('paypal') ||
    pmLower.includes('mobile') ||
    pmLower.includes('stripe') ||
    pmLower.includes('pay') ||
    pmLower.includes('card');

  // If not found, search by mapping paymentMethod keyword to account type
  if (!account) {
    let targetType: 'BANK' | 'MOBILE_WALLET' | 'CASH' | null = null;
    if (pmLower.includes('bank') || pmLower.includes('transfer') || pmLower.includes('wire')) {
      targetType = 'BANK';
    } else if (isWallet) {
      targetType = 'MOBILE_WALLET';
    } else if (pmLower.includes('cash')) {
      targetType = 'CASH';
    }
    if (targetType) {
      account = await tx.account.findFirst({ where: { type: targetType, isArchived: false } });
    }
  }

  // If still not found, get the first non-archived account
  if (!account) {
    account = await tx.account.findFirst({ where: { isArchived: false } });
  }

  // If still not found (no accounts exist in the DB), create a default account
  if (!account) {
    const newType: 'BANK' | 'MOBILE_WALLET' | 'CASH' = isWallet
      ? 'MOBILE_WALLET'
      : pmLower.includes('cash')
        ? 'CASH'
        : 'BANK';
    const settings = await tx.agencySettings.findFirst();
    account = await tx.account.create({
      data: {
        name: paymentMethod,
        type: newType,
        currency: settings?.currency || 'USD',
        notes: `Automatically created for payment method: ${paymentMethod}`,
      },
    });
    console.log(`[syncInvoiceDeposit] Created default account ${account.name} (Type: ${account.type})`);
  }

  return account;
}

async function syncWithin(tx: Tx, invoiceId: string): Promise<void> {
  const invoice = await tx.invoice.findUnique({ where: { id: invoiceId } });
  if (!invoice) {
    console.log(`[syncInvoiceDeposit] Invoice ${invoiceId} not found.`);
    return;
  }

  const marker = invoiceDepositMarker(invoice.id);
  const targetAmount = targetDepositCents(invoice);

  // Linked rows, plus legacy rows written before `invoiceId` existed.
  const existing = await tx.deposit.findMany({
    where: {
      OR: [{ invoiceId: invoice.id }, { invoiceId: null, description: { contains: marker } }],
    },
    orderBy: { createdAt: 'asc' },
  });

  if (targetAmount <= 0) {
    if (existing.length > 0) {
      await tx.deposit.deleteMany({ where: { id: { in: existing.map((d) => d.id) } } });
      console.log(`[syncInvoiceDeposit] Deleted deposits for unpaid invoice ${invoice.invoiceNumber}`);
    }
    return;
  }

  const account = await resolveAccount(tx, invoice.paymentMethod);
  const description = `Payment for Invoice ${invoice.invoiceNumber} ${marker}`;
  const [keep, ...duplicates] = existing;

  if (duplicates.length > 0) {
    await tx.deposit.deleteMany({ where: { id: { in: duplicates.map((d) => d.id) } } });
  }

  if (!keep) {
    // First time this invoice is (partially) paid: book it now.
    await tx.deposit.create({
      data: {
        accountId: account.id,
        invoiceId: invoice.id,
        amount: targetAmount,
        category: 'REVENUE',
        description,
        date: new Date(),
      },
    });
  } else {
    // Update in place. The booking date only moves when the paid amount
    // changes, so unrelated edits (notes, due date…) never shift revenue
    // between months.
    const amountChanged = keep.amount !== targetAmount;
    await tx.deposit.update({
      where: { id: keep.id },
      data: {
        accountId: account.id,
        invoiceId: invoice.id,
        amount: targetAmount,
        category: 'REVENUE',
        description,
        ...(amountChanged ? { date: new Date() } : {}),
      },
    });
  }

  console.log(
    `[syncInvoiceDeposit] Synchronized deposit of ${targetAmount / 100} to account '${account.name}' for invoice ${invoice.invoiceNumber}`
  );
}

/**
 * Keep the ledger deposit of an invoice in step with its payment status.
 *
 * Pass the caller's transaction client to make the sync part of the invoice
 * write (errors then propagate and roll the whole write back). Without one the
 * sync runs in its own transaction and failures are logged, not thrown.
 */
export async function syncInvoiceDeposit(invoiceId: string, tx?: Tx): Promise<void> {
  if (tx) {
    await syncWithin(tx, invoiceId);
    return;
  }
  try {
    await prisma.$transaction((t) => syncWithin(t, invoiceId));
  } catch (error) {
    console.error(`[syncInvoiceDeposit] Error syncing deposit for invoice ${invoiceId}:`, error);
  }
}

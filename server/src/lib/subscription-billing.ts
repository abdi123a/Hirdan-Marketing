import cron from 'node-cron';
import { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';
import { sendEmail, generateEmailHtml } from './email.js';
import { createNotification } from './notifications.js';
import { formatCents } from './money.js';
import { nextDocumentNumber } from './document-number.js';
import { dueBillingPeriod } from './billing-period.js';

// Held back until the server is up. This is the heaviest thing that used to run
// at boot — it generates invoices, writes notifications and sends reminder
// email — and it ran before app.listen(), delaying the first health response.
const STARTUP_DELAY_MS = 60 * 1000;
const LOCK_NAME = 'subscription-billing';
// Upper bound on one run. Only bounds the connection-pinning transaction that
// holds the MySQL named lock (see withBillingLock).
const RUN_TIMEOUT_MS = 30 * 60 * 1000;

const CYCLE_LABEL: Record<string, string> = {
  MONTHLY: 'Monthly',
  QUARTERLY: 'Quarterly',
  ANNUAL: 'Annual',
};

export function startSubscriptionBillingJob(): void {
  // runBillingCycle() swallows its own errors, but it is called here as a
  // floating promise: anything that ever escapes it would reach the
  // unhandledRejection handler in index.ts, which shuts the whole API down.
  const safeRun = () =>
    runBillingCycle().catch(error =>
      console.error('❌ [SubscriptionBilling] Error running billing cycle:', error)
    );

  setTimeout(safeRun, STARTUP_DELAY_MS);
  // Hourly: a run that is missed (restart, downtime) is caught up by the next
  // one, because billing is "on or after the billing day and not yet billed"
  // rather than "exactly on the billing day".
  cron.schedule('0 * * * *', safeRun);
  console.log('🔄 [SubscriptionBilling] Hourly billing job started.');
}

export interface BillingRunResult {
  /** True when another run (this process or another instance) was in progress. */
  skipped: boolean;
  invoicesCreated: number;
}

let inProcessRun: Promise<BillingRunResult> | null = null;

/**
 * Run `work` while holding the MySQL named lock `subscription-billing`.
 *
 * GET_LOCK is scoped to a DB *session*, and Prisma otherwise hands each query
 * to any pooled connection, so GET_LOCK and RELEASE_LOCK could land on
 * different connections. We therefore open an interactive transaction whose
 * only purpose is to pin one pooled connection: GET_LOCK and RELEASE_LOCK both
 * run on it. It performs no writes and takes no row locks, so keeping it open
 * for the run blocks nobody; the actual work uses the regular pool.
 * Returns null when the lock is held elsewhere (non-blocking, timeout 0).
 */
async function withBillingLock<T>(work: () => Promise<T>): Promise<T | null> {
  return prisma.$transaction(
    async (lockConn) => {
      const rows = await lockConn.$queryRaw<{ acquired: unknown }[]>`SELECT GET_LOCK(${LOCK_NAME}, 0) AS acquired`;
      if (Number(rows[0]?.acquired) !== 1) return null;
      try {
        return await work();
      } finally {
        await lockConn.$queryRaw`SELECT RELEASE_LOCK(${LOCK_NAME})`.catch((err: unknown) =>
          console.error('[SubscriptionBilling] Failed to release billing lock:', err),
        );
      }
    },
    { maxWait: 10_000, timeout: RUN_TIMEOUT_MS },
  );
}

/**
 * Generate due subscription invoices and send reminders/notices.
 * Safe to call concurrently: overlapping calls in this process share nothing
 * and return `skipped`, other instances are excluded by a MySQL named lock,
 * and the (subscriptionId, billingPeriod) unique index is the final guard
 * against double-billing.
 */
export function runBillingCycle(): Promise<BillingRunResult> {
  if (inProcessRun) {
    console.log('⏭️ [SubscriptionBilling] Billing cycle already running — skipped.');
    return Promise.resolve({ skipped: true, invoicesCreated: 0 });
  }
  inProcessRun = (async (): Promise<BillingRunResult> => {
    try {
      const result = await withBillingLock(runBillingCycleUnlocked);
      if (result === null) {
        console.log('⏭️ [SubscriptionBilling] Another instance holds the billing lock — skipped.');
        return { skipped: true, invoicesCreated: 0 };
      }
      return result;
    } catch (error) {
      console.error('❌ [SubscriptionBilling] Error running billing cycle:', error);
      return { skipped: false, invoicesCreated: 0 };
    } finally {
      inProcessRun = null;
    }
  })();
  return inProcessRun;
}

/** Amount still owed on an invoice, in cents. */
function outstandingCents(inv: { amount: number; deposit: number | null; status: string }): number {
  return inv.status === 'PARTIALLY_PAID' ? Math.max(0, inv.amount - (inv.deposit ?? 0)) : inv.amount;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}

async function runBillingCycleUnlocked(): Promise<BillingRunResult> {
  console.log('🔄 [SubscriptionBilling] Running billing cycle...');
  let invoicesCreated = 0;
  try {
    const now = new Date();

    // 1. Generate invoices for subscriptions whose current billing period is due
    const activeSubscriptions = await prisma.subscription.findMany({
      where: { status: 'ACTIVE', startDate: { lte: now } },
      include: {
        client: true,
      },
    });

    const settings = await prisma.agencySettings.findFirst();
    const taxRate = settings?.taxRate ?? 0;
    const currencySymbol = settings?.currency ?? 'USD';
    const appUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    for (const sub of activeSubscriptions) {
      const client = sub.client;
      // If invoiceGenerationDay is null/undefined, default to 1st of the month
      const due = dueBillingPeriod(sub, client.invoiceGenerationDay ?? 1, now);
      if (!due) continue;

      const alreadyBilled = await prisma.invoice.findFirst({
        where: { subscriptionId: sub.id, billingPeriod: due.billingPeriod },
        select: { id: true },
      });
      if (alreadyBilled) continue;

      // Compute amount with tax (sub.amount is cents per billing cycle)
      const subtotal = sub.amount;
      const totalAmount = subtotal + Math.round(subtotal * (taxRate / 100));
      const dueDate = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
      const cycleLabel = CYCLE_LABEL[sub.billingCycle] ?? 'Monthly';

      let invoiceNumber: string;
      try {
        invoiceNumber = await prisma.$transaction(async (tx) => {
          // Extended client's tx type differs from Prisma.TransactionClient (same cast as document-number.ts)
          const number = await nextDocumentNumber('INV', tx as unknown as Parameters<typeof nextDocumentNumber>[1]);
          await tx.invoice.create({
            data: {
              invoiceNumber: number,
              clientId: sub.clientId,
              subscriptionId: sub.id,
              billingPeriod: due.billingPeriod,
              autoGenerated: true,
              amount: totalAmount,
              status: 'PENDING',
              date: now,
              dueDate,
              taxRate,
              notes: settings?.defaultInvoiceNotes || "Thank you for your business! Please make payment within 14 days.",
              items: {
                create: [
                  {
                    description: `${cycleLabel} subscription - ${sub.plan} (${due.billingPeriod})`,
                    quantity: 1,
                    unitPrice: sub.amount,
                    position: 0,
                  },
                ],
              },
            },
          });
          return number;
        });
      } catch (error) {
        if (isUniqueViolation(error)) {
          // Another run billed this period between our check and insert.
          console.log(`[SubscriptionBilling] ${sub.id} ${due.billingPeriod} already billed — skipping.`);
        } else {
          console.error(`❌ [SubscriptionBilling] Failed to bill subscription ${sub.id}:`, error);
        }
        continue;
      }

      invoicesCreated++;
      createNotification({
        title: 'Auto-Invoice Generated',
        message: `Invoice ${invoiceNumber} generated for ${client.company || client.name} (${sub.plan}).`,
        type: 'INVOICE_AUTO_GENERATED',
        category: 'INFORMATION',
        entityType: 'INVOICE',
        entityId: invoiceNumber,
        actionUrl: `/dashboard/invoices/view/${invoiceNumber}`,
      });
      console.log(`Successfully generated invoice ${invoiceNumber} (${due.billingPeriod}) for client ${client.name}`);
    }

    // 2. Send Payment Reminders
    // Unpaid invoices that are past their due date by client's grace period (default 5 days)
    const pendingInvoicesForReminder = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
        reminderSentAt: null,
        client: {
          email: { not: null },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    for (const inv of pendingInvoicesForReminder) {
      const client = inv.client;
      if (!client.email) continue;

      const graceDays = client.paymentReminderDelay ?? 5;
      const dueDateWithGrace = new Date(inv.dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);

      if (now >= dueDateWithGrace) {
        console.log(`Sending payment reminder for invoice ${inv.invoiceNumber} to ${client.email}`);

        const amountFormatted = formatCents(outstandingCents(inv), currencySymbol);
        const dueDateFormatted = inv.dueDate.toISOString().split('T')[0];

        const subject = `Payment Reminder: Invoice ${inv.invoiceNumber} is Unpaid`;
        const contentHtml = `
          <h2 style="color: #334155; font-size: 20px; margin-bottom: 16px;">Hello ${client.name},</h2>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            This is a friendly reminder that invoice <strong>${inv.invoiceNumber}</strong>, which was due on <strong>${dueDateFormatted}</strong>, is still awaiting payment.
          </p>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            <strong>Amount Due:</strong> ${amountFormatted}<br/>
            <strong>Subscription Plan:</strong> ${inv.items?.[0]?.description || 'Monthly Subscription'}
          </p>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            Please log in to your portal to make the payment or arrange a bank transfer at your earliest convenience.
          </p>
        `;

        const emailHtml = await generateEmailHtml({
          title: subject,
          preheader: `Friendly reminder that invoice ${inv.invoiceNumber} is unpaid.`,
          contentHtml,
          actionButton: {
            label: 'View Invoice & Pay',
            url: `${appUrl}/dashboard/invoices`, // fallback to portal invoices list
          },
        });

        const result = await sendEmail({
          to: client.email,
          subject,
          html: emailHtml,
        });

        if (result.success) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: { reminderSentAt: now },
          });
          console.log(`Successfully sent payment reminder and updated invoice ${inv.invoiceNumber}`);
        } else {
          console.error(`Failed to send reminder for invoice ${inv.invoiceNumber}: ${result.error}`);
        }
      }
    }

    // 3. Send Overdue Notices
    // Unpaid invoices past their DUE date by the client's overdue threshold (default 10 days)
    const pendingInvoicesForOverdue = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE', 'PARTIALLY_PAID'] },
        overdueSentAt: null,
        client: {
          email: { not: null },
        },
      },
      include: {
        client: true,
        items: true,
      },
    });

    for (const inv of pendingInvoicesForOverdue) {
      const client = inv.client;
      if (!client.email) continue;

      const overdueDays = client.overdueNoticeDelay ?? 10;
      const overdueDate = new Date(inv.dueDate.getTime() + overdueDays * 24 * 60 * 60 * 1000);

      if (now >= overdueDate) {
        console.log(`Sending overdue notice for invoice ${inv.invoiceNumber} to ${client.email}`);

        const amountFormatted = formatCents(outstandingCents(inv), currencySymbol);
        const dateFormatted = inv.dueDate.toISOString().split('T')[0];

        const subject = `URGENT: Invoice ${inv.invoiceNumber} is OVERDUE`;
        const contentHtml = `
          <h2 style="color: #dc2626; font-size: 20px; margin-bottom: 16px;">Dear ${client.name},</h2>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            We are writing to inform you that payment for invoice <strong>${inv.invoiceNumber}</strong>, which was due on <strong>${dateFormatted}</strong>, is now significantly overdue.
          </p>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6; font-weight: 600; color: #dc2626;">
            Your subscription payment of ${amountFormatted} remains unpaid.
          </p>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            To prevent any disruption to your active subscription and agency services, please complete the payment immediately using the button below.
          </p>
          <p style="margin: 0 0 16px; color: #475569; line-height: 1.6;">
            If you have already made the payment, please disregard this notice or contact our billing team with your proof of payment.
          </p>
        `;

        const emailHtml = await generateEmailHtml({
          title: subject,
          preheader: `URGENT: Invoice ${inv.invoiceNumber} is overdue.`,
          contentHtml,
          actionButton: {
            label: 'Pay Now',
            url: `${appUrl}/dashboard/invoices`,
          },
        });

        const result = await sendEmail({
          to: client.email,
          subject,
          html: emailHtml,
        });

        if (result.success) {
          await prisma.invoice.update({
            where: { id: inv.id },
            data: {
              // Keep PARTIALLY_PAID: switching it to OVERDUE would make the
              // reports and deposit sync forget the part already paid.
              ...(inv.status === 'PARTIALLY_PAID' ? {} : { status: 'OVERDUE' as const }),
              overdueSentAt: now,
            },
          });
          createNotification({
            title: 'Invoice Overdue ⚠️',
            message: `Invoice ${inv.invoiceNumber} for ${client.company || client.name} is now overdue.`,
            type: 'INVOICE_OVERDUE_BILLING',
            category: 'ACTION_REQUIRED',
            entityType: 'INVOICE',
            entityId: inv.invoiceNumber || inv.id,
            actionUrl: `/dashboard/invoices/view/${inv.invoiceNumber || inv.id}`,
          });
          console.log(`Successfully sent overdue notice and marked invoice ${inv.invoiceNumber} as OVERDUE`);
        } else {
          console.error(`Failed to send overdue notice for invoice ${inv.invoiceNumber}: ${result.error}`);
        }
      }
    }

    // 4. Warning: Invoices due in 3 days (deduplicated — only fire once per invoice)
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const dueSoonInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          gte: now,
          lte: threeDaysFromNow,
        },
        dueSoonNotifiedAt: null,
      },
      include: { client: true },
    });

    for (const inv of dueSoonInvoices) {
      const client = inv.client;
      const daysLeft = Math.ceil((inv.dueDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      createNotification({
        title: 'Invoice Due Soon 🔔',
        message: `Invoice ${inv.invoiceNumber} for ${client.company || client.name} is due in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        type: 'INVOICE_DUE_SOON',
        category: 'WARNING',
        entityType: 'INVOICE',
        entityId: inv.invoiceNumber || inv.id,
        actionUrl: `/dashboard/invoices/view/${inv.invoiceNumber || inv.id}`,
      });
      await prisma.invoice.update({
        where: { id: inv.id },
        data: { dueSoonNotifiedAt: now } as any,
      });
    }

    // 5. Warning: Subscriptions expiring in 7 days
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const expiringSubs = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: now,
          lte: sevenDaysFromNow,
        },
      },
      include: { client: true },
    });

    for (const sub of expiringSubs) {
      const client = sub.client;
      const daysLeft = Math.ceil((sub.endDate!.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      createNotification({
        title: 'Subscription Expiring Soon',
        message: `Subscription "${sub.plan}" for ${client.company || client.name} expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
        type: 'SUBSCRIPTION_EXPIRING_SOON',
        category: 'WARNING',
        entityType: 'SUBSCRIPTION',
        entityId: sub.id,
        actionUrl: `/dashboard/subscriptions/view/${sub.id}`,
      });
    }

  } catch (error) {
    console.error('❌ [SubscriptionBilling] Error running billing cycle:', error);
  }
  return { skipped: false, invoicesCreated };
}

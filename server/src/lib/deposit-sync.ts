import { prisma } from './prisma.js';

export async function syncInvoiceDeposit(invoiceId: string): Promise<void> {
  try {
    // 1. Fetch the invoice with client
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { client: true },
    });

    if (!invoice) {
      console.log(`[syncInvoiceDeposit] Invoice ${invoiceId} not found.`);
      return;
    }

    const depositDescriptionMarker = `(ID: ${invoice.id})`;

    // 2. Determine target deposit amount based on status
    let targetAmount = 0;
    if (invoice.status === 'PAID') {
      targetAmount = invoice.amount; // total amount in cents
    } else if (invoice.status === 'PARTIALLY_PAID') {
      targetAmount = invoice.deposit ?? 0; // partial amount in cents
    }

    // 3. Find if there are existing deposits for this invoice
    const existingDeposits = await prisma.deposit.findMany({
      where: {
        description: {
          contains: depositDescriptionMarker,
        },
      },
    });

    // If targetAmount is 0 (unpaid/pending/overdue status or amount is 0),
    // delete any existing deposits and return
    if (targetAmount <= 0) {
      if (existingDeposits.length > 0) {
        await prisma.deposit.deleteMany({
          where: {
            id: {
              in: existingDeposits.map(d => d.id),
            },
          },
        });
        console.log(`[syncInvoiceDeposit] Deleted existing deposits for unpaid invoice ${invoice.invoiceNumber}`);
      }
      return;
    }

    // 4. Find the Account to deposit to
    const paymentMethod = invoice.paymentMethod?.trim() || 'Bank Transfer';

    // Try to find account with exact case-insensitive name match
    let account = await prisma.account.findFirst({
      where: {
        name: {
          equals: paymentMethod,
        },
        isArchived: false,
      },
    });

    // If not found, search by mapping paymentMethod keyword to account type
    if (!account) {
      let targetType: 'BANK' | 'MOBILE_WALLET' | 'CASH' | null = null;
      const pmLower = paymentMethod.toLowerCase();

      if (pmLower.includes('bank') || pmLower.includes('transfer') || pmLower.includes('wire')) {
        targetType = 'BANK';
      } else if (
        pmLower.includes('wallet') ||
        pmLower.includes('paypal') ||
        pmLower.includes('mobile') ||
        pmLower.includes('stripe') ||
        pmLower.includes('pay') ||
        pmLower.includes('card')
      ) {
        targetType = 'MOBILE_WALLET';
      } else if (pmLower.includes('cash')) {
        targetType = 'CASH';
      }

      if (targetType) {
        account = await prisma.account.findFirst({
          where: {
            type: targetType,
            isArchived: false,
          },
        });
      }
    }

    // If still not found, get the first non-archived account
    if (!account) {
      account = await prisma.account.findFirst({
        where: { isArchived: false },
      });
    }

    // If still not found (no accounts exist in the DB), create a default account
    if (!account) {
      let newType: 'BANK' | 'MOBILE_WALLET' | 'CASH' = 'BANK';
      const pmLower = paymentMethod.toLowerCase();
      if (pmLower.includes('wallet') || pmLower.includes('paypal') || pmLower.includes('mobile') || pmLower.includes('stripe') || pmLower.includes('pay') || pmLower.includes('card')) {
        newType = 'MOBILE_WALLET';
      } else if (pmLower.includes('cash')) {
        newType = 'CASH';
      }

      const settings = await prisma.agencySettings.findFirst();
      const currency = settings?.currency || 'USD';

      account = await prisma.account.create({
        data: {
          name: paymentMethod,
          type: newType,
          currency,
          notes: `Automatically created for payment method: ${paymentMethod}`,
        },
      });
      console.log(`[syncInvoiceDeposit] Created default account ${account.name} (Type: ${account.type})`);
    }

    // 5. Create or Update Deposit
    if (existingDeposits.length > 0) {
      await prisma.deposit.deleteMany({
        where: {
          id: {
            in: existingDeposits.map(d => d.id),
          },
        },
      });
    }

    const depositDate = invoice.updatedAt || new Date();
    await prisma.deposit.create({
      data: {
        accountId: account.id,
        amount: targetAmount,
        category: 'REVENUE',
        description: `Payment for Invoice ${invoice.invoiceNumber} ${depositDescriptionMarker}`,
        date: depositDate,
      },
    });

    console.log(`[syncInvoiceDeposit] Synchronized deposit of ${targetAmount / 100} to account '${account.name}' for invoice ${invoice.invoiceNumber}`);
  } catch (error) {
    console.error(`[syncInvoiceDeposit] Error syncing deposit for invoice ${invoiceId}:`, error);
  }
}

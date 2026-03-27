import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('--- Checking Invoices ---');
  const invoices = await prisma.invoice.findMany({ take: 1 });
  if (invoices.length > 0) {
    const inv = invoices[0];
    console.log(`Found invoice: ${inv.id} (${inv.invoiceNumber})`);
  } else {
    console.log('No invoices found.');
  }

  console.log('--- Checking Proformas ---');
  const proformas = await prisma.proforma.findMany({ take: 1 });
  if (proformas.length > 0) {
    const prof = proformas[0];
    console.log(`Found proforma: ${prof.id} (${prof.proformaNumber})`);
  } else {
    console.log('No proformas found.');
  }

  console.log('--- Checking VerificationTokens ---');
  const tokens = await prisma.verificationToken.findMany({ take: 5 });
  console.log(`Found ${tokens.length} tokens.`);
  tokens.forEach(t => {
    console.log(`Token: ${t.token}, Type: ${t.documentType}, Inv: ${t.invoiceId}, Prof: ${t.proformaId}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

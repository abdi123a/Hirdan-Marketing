import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function testProforma() {
  console.log('--- Testing Proforma Verification ---');
  
  // 1. Get a proforma
  const prof = await prisma.proforma.findFirst();
  if (!prof) {
    console.log('No proforma found, cannot test.');
    return;
  }
  console.log(`Testing with Proforma: ${prof.proformaNumber} (${prof.id})`);

  // 2. Create/Get token (simulate POST /api/verify)
  const documentType = 'proforma';
  const realDocumentId = prof.id;
  
  const existing = await prisma.verificationToken.findFirst({
    where: {
      documentType,
      proformaId: realDocumentId
    }
  });

  let token;
  if (existing) {
    token = existing.token;
    console.log(`Found existing token: ${token}`);
  } else {
    token = crypto.randomBytes(32).toString('hex');
    await prisma.verificationToken.create({
      data: {
        token,
        documentType,
        proformaId: realDocumentId
      }
    });
    console.log(`Created new token: ${token}`);
  }

  // 3. Verify via HTTP (simulate public access)
  const url = `http://localhost:3001/api/verify/${token}`;
  console.log(`Checking ${url}...`);
  try {
    const res = await fetch(url);
    console.log(`Status: ${res.status}`);
    const data = await res.json();
    console.log('Data:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
  }
}

testProforma()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

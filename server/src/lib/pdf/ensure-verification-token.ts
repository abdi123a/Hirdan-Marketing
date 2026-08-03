import crypto from 'crypto';
import { prisma } from '../prisma.js';

async function generateUniqueVerifyToken(): Promise<string> {
  const length = 8;
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  for (let attempts = 0; attempts < 10; attempts++) {
    const bytes = crypto.randomBytes(length);
    let token = '';
    for (let i = 0; i < length; i++) {
      token += chars[bytes[i]! % chars.length]!;
    }
    const exists = await prisma.verificationToken.findUnique({ where: { token } });
    if (!exists) return token;
  }
  return crypto.randomBytes(6).toString('hex');
}

/**
 * Returns a short verification token for an invoice, proforma, or HR document (creates one if needed).
 */
export async function ensureVerificationToken(
  documentType: 'invoice' | 'proforma' | 'hr_document',
  documentUuid: string
): Promise<string> {
  const existing = await prisma.verificationToken.findFirst({
    where: {
      documentType,
      invoiceId: documentType === 'invoice' ? documentUuid : undefined,
      proformaId: documentType === 'proforma' ? documentUuid : undefined,
      hrDocumentId: documentType === 'hr_document' ? documentUuid : undefined,
    },
  });

  if (existing) {
    if (!existing.revokedAt && existing.expiresAt > new Date() && existing.token.length <= 12) {
      return existing.token;
    }
    await prisma.verificationToken.delete({ where: { id: existing.id } });
  }

  const token = await generateUniqueVerifyToken();
  const created = await prisma.verificationToken.create({
    data: {
      token,
      documentType,
      invoiceId: documentType === 'invoice' ? documentUuid : undefined,
      proformaId: documentType === 'proforma' ? documentUuid : undefined,
      hrDocumentId: documentType === 'hr_document' ? documentUuid : undefined,
      expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });
  return created.token;
}

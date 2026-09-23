import type { Prisma } from '@prisma/client';
import { prisma } from './prisma.js';

export type DocumentPrefix = 'INV' | 'PRO';

type CounterClient = Pick<Prisma.TransactionClient, '$executeRaw' | 'documentCounter'>;

async function increment(tx: CounterClient, key: string): Promise<number> {
  // Single atomic statement: the row lock taken by ON DUPLICATE KEY UPDATE is
  // held until the surrounding transaction ends, so two concurrent callers can
  // never read the same value.
  await tx.$executeRaw`
    INSERT INTO document_counters (\`key\`, value) VALUES (${key}, 1)
    ON DUPLICATE KEY UPDATE value = value + 1`;
  const row = await tx.documentCounter.findUniqueOrThrow({ where: { key } });
  return row.value;
}

/**
 * Allocate the next sequential, gap-resistant document number, e.g.
 * `INV-2026-00042`. Numbering restarts every calendar year (UTC).
 *
 * Pass the caller's transaction client when the number is allocated as part of
 * a larger write, so a rolled-back creation also rolls back the increment.
 */
export async function nextDocumentNumber(
  prefix: DocumentPrefix,
  tx?: CounterClient,
  date: Date = new Date(),
): Promise<string> {
  const key = `${prefix}-${date.getUTCFullYear()}`;
  const value = tx
    ? await increment(tx, key)
    : await prisma.$transaction((t) => increment(t as unknown as CounterClient, key));
  return `${key}-${String(value).padStart(5, '0')}`;
}

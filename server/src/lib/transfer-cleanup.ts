/**
 * transfer-cleanup.ts
 * ─────────────────────────────────────────────────────────────────
 * Hourly background job that physically removes transfer files from
 * disk once they are expired (expiresAt < NOW) or soft-deleted.
 *
 * This prevents unbounded disk growth on the server.
 *
 * Usage: call `startTransferCleanupJob()` once at server startup
 * (imported in app.ts).
 */

import fs from 'fs';
import path from 'path';
import { prisma } from './prisma.js';
import { PATHS } from './paths.js';

const INTERVAL_MS = 60 * 60 * 1000; // 1 hour
// Hold the first run back until after the server is listening. This job used to
// fire during module load — i.e. before app.listen() — so its disk walk and
// Prisma queries competed with startup for the connection pool and pushed out
// the moment the API could answer /api/health.
const STARTUP_DELAY_MS = 30 * 1000;

export function startTransferCleanupJob(): void {
  // runCleanup() already swallows its own errors, but it is called here as a
  // floating promise: anything that ever escapes it would reach the
  // unhandledRejection handler in index.ts, which shuts the whole API down.
  const safeRun = () =>
    runCleanup().catch(err =>
      console.error('🗑️  [TransferCleanup] Cleanup run failed:', err)
    );

  setTimeout(safeRun, STARTUP_DELAY_MS);
  setInterval(safeRun, INTERVAL_MS);
  console.log('🗑️  [TransferCleanup] Hourly cleanup job started.');
}

async function runCleanup(): Promise<void> {
  try {
    const now = new Date();

    // Fetch all records that are either soft-deleted or past their expiry date
    // and whose file has not yet been purged from disk.
    const stale = await prisma.sharedFile.findMany({
      where: {
        OR: [
          { isDeleted: true },
          { expiresAt: { lt: now } },
        ],
      },
      select: {
        id: true,
        filePath: true,
        fileName: true,
      },
    });

    if (stale.length === 0) return;

    console.log(`🗑️  [TransferCleanup] Found ${stale.length} stale transfer(s) to purge.`);

    let purgedCount = 0;
    const handledIds: string[] = [];

    for (const record of stale) {
      // Build the absolute path and verify it stays inside the transfers directory
      const fullPath = path.resolve(PATHS.TRANSFERS, record.filePath);
      const normalised = path.normalize(fullPath);

      if (
        !normalised.startsWith(PATHS.TRANSFERS + path.sep) &&
        normalised !== PATHS.TRANSFERS
      ) {
        console.warn(`⚠️  [TransferCleanup] Suspicious path skipped: ${record.filePath}`);
        handledIds.push(record.id); // still mark so we don't loop forever
        continue;
      }

      if (fs.existsSync(fullPath)) {
        try {
          fs.unlinkSync(fullPath);
          purgedCount++;
          console.log(`   ✅ Deleted: ${record.fileName} (id: ${record.id})`);
        } catch (err) {
          console.error(`   ❌ Failed to delete ${record.fileName}:`, err);
          continue; // don't mark as handled if deletion failed
        }
      }

      handledIds.push(record.id);
    }

    // Mark handled records as deleted so we don't reprocess them next cycle
    if (handledIds.length > 0) {
      await prisma.sharedFile.updateMany({
        where: { id: { in: handledIds } },
        data: { isDeleted: true },
      });
    }

    if (purgedCount > 0) {
      console.log(`🗑️  [TransferCleanup] Purged ${purgedCount} file(s) from disk.`);
    }
  } catch (err) {
    // Errors in a background job must never crash the process.
    console.error('🗑️  [TransferCleanup] Cleanup run failed:', err);
  }
}

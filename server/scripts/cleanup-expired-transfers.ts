import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// The storage directory of transfers.
// PATHS.TRANSFERS resolves to path.resolve(process.cwd(), 'uploads', 'transfers')
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads', 'transfers');

async function main() {
  console.log('⏰ [Cleanup] Starting expired transfers cleanup...');
  
  // Only delete files if they expired more than 15 days ago
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 15);

  const expiredFiles = await prisma.sharedFile.findMany({
    where: {
      isDeleted: false,
      expiresAt: {
        lt: cutoffDate,
      },
    },
  });

  console.log(`⏰ [Cleanup] Found ${expiredFiles.length} expired transfers to delete.`);

  let deletedCount = 0;

  for (const record of expiredFiles) {
    const fullPath = path.join(UPLOAD_DIR, record.filePath);
    
    // Attempt physical deletion
    try {
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        console.log(`🗑️ [Cleanup] Deleted file from disk: ${record.fileName} (${record.filePath})`);
      } else {
        console.log(`⚠️ [Cleanup] File not found on disk, skipping unlinking: ${record.fileName} (${record.filePath})`);
      }
    } catch (err) {
      console.error(`❌ [Cleanup] Failed to delete file ${record.fileName} from disk:`, err);
    }

    // Mark as deleted in DB
    try {
      await prisma.sharedFile.update({
        where: { id: record.id },
        data: {
          isDeleted: true,
          deletedAt: new Date(),
        },
      });
      deletedCount++;
    } catch (err) {
      console.error(`❌ [Cleanup] Failed to update DB record for ${record.fileName}:`, err);
    }
  }

  console.log(`✅ [Cleanup] Cleanup finished. Successfully processed ${deletedCount}/${expiredFiles.length} records.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import fs from 'fs/promises';
import path from 'path';
import { PATHS } from '../paths.js';

/**
 * Multer writes every social upload to uploads/social-temp first and the
 * route renames it out on success. A request that dies mid-transfer (client
 * gone, nginx 408) leaves the partial file behind forever: 25 of them,
 * 650 MB, had piled up on the VPS by 2026-09-26. Anything untouched for an
 * hour is dead — a live upload keeps rewriting its file.
 */
export const SOCIAL_TEMP_DIR = path.join(PATHS.UPLOADS_ROOT, 'social-temp');
const MAX_AGE_MS = 60 * 60 * 1000;

/** Deletes stale files directly inside `dir`; returns how many were removed. */
export async function purgeAbandonedUploads(dir = SOCIAL_TEMP_DIR, maxAgeMs = MAX_AGE_MS): Promise<number> {
  let names: string[];
  try {
    names = await fs.readdir(dir);
  } catch {
    return 0; // the directory only exists once the first upload has happened
  }
  const cutoff = Date.now() - maxAgeMs;
  let purged = 0;
  for (const name of names) {
    const full = path.join(dir, name);
    try {
      const stat = await fs.stat(full);
      if (!stat.isFile() || stat.mtimeMs > cutoff) continue;
      await fs.unlink(full);
      purged++;
    } catch (err) {
      console.warn(`⚠️  [TempUploadCleanup] Could not purge ${name}:`, err);
    }
  }
  return purged;
}

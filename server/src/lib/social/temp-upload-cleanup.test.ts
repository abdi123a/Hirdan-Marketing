import { describe, it, expect } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { purgeAbandonedUploads } from './temp-upload-cleanup.js';

describe('purgeAbandonedUploads', () => {
  it('removes files older than the cutoff, keeps fresh files and subdirectories', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'social-temp-'));
    const old = path.join(dir, 'old');
    const fresh = path.join(dir, 'fresh');
    const sub = path.join(dir, 'sub');
    fs.writeFileSync(old, 'x');
    fs.writeFileSync(fresh, 'x');
    fs.mkdirSync(sub);
    const twoHoursAgo = (Date.now() - 2 * 60 * 60 * 1000) / 1000;
    fs.utimesSync(old, twoHoursAgo, twoHoursAgo);
    fs.utimesSync(sub, twoHoursAgo, twoHoursAgo);

    const purged = await purgeAbandonedUploads(dir, 60 * 60 * 1000);

    expect(purged).toBe(1);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(fresh)).toBe(true);
    expect(fs.existsSync(sub)).toBe(true);
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('returns 0 when the directory does not exist yet', async () => {
    expect(await purgeAbandonedUploads(path.join(os.tmpdir(), `missing-${Date.now()}`))).toBe(0);
  });
});

import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { importTikTokStudioFiles } from '../lib/social/import/tiktok-import.service.js';
import { importMetaAudienceFiles } from '../lib/social/import/meta-audience-import.service.js';
import { enrichTikTokVideosBatch } from '../lib/social/tiktok-enrich.service.js';

const router = Router();

// Parse in memory — files are small analytics exports and we never keep them.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 12 },
  fileFilter: (_req, file, cb) => {
    if (/\.(xlsx|xls|csv)$/i.test(file.originalname)) cb(null, true);
    else cb(new Error('Only .xlsx / .xls / .csv exports are supported'));
  },
});

// ── Import TikTok Studio exports for a TikTok account ────────────────────────
router.post('/import/tiktok/:accountId', authenticate, upload.array('files', 12), async (req, res, next) => {
  try {
    const { accountId } = req.params as { accountId: string };
    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.platform.toLowerCase() !== 'tiktok') {
      res.status(400).json({ error: 'This importer is only for TikTok accounts' });
      return;
    }

    const summary = await importTikTokStudioFiles(
      accountId,
      files.map(f => ({ originalname: f.originalname, buffer: f.buffer })),
    );

    // If nothing recognizable was parsed, surface that clearly.
    const recognized = summary.files.some(f => f.type !== 'unknown' && f.rows > 0);
    if (!recognized) {
      res.status(422).json({
        error: 'None of the uploaded files looked like TikTok Studio exports.',
        summary,
      });
      return;
    }

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

// ── Re-enrich & Verify Past Imported Videos for All Accounts ────────────────
router.post('/import/tiktok/enrich-all', authenticate, async (_req, res, next) => {
  try {
    const tiktokAccounts = await prisma.socialAccount.findMany({
      where: { platform: 'tiktok' },
      select: { id: true },
    });

    let totalEnriched = 0;
    let totalVerified = 0;

    for (const acc of tiktokAccounts) {
      const res = await enrichTikTokVideosBatch(acc.id, undefined, { force: true });
      totalEnriched += res.enrichedCount;
      totalVerified += res.verifiedCount;
    }

    res.json({ success: true, totalEnriched, totalVerified, accountsCount: tiktokAccounts.length });
  } catch (err) {
    next(err);
  }
});

// ── Re-enrich & Verify Past Imported Videos for an Account ───────────────────
router.post('/import/tiktok/:accountId/enrich', authenticate, async (req, res, next) => {
  try {
    const { accountId } = req.params as { accountId: string };
    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const result = await enrichTikTokVideosBatch(accountId, undefined, { force: true });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ── Import analytics exports for Instagram / Facebook / YouTube ──────────────
// Registered after the TikTok routes above so their literal paths win; TikTok
// keeps its own endpoint because its export is a different format entirely.
const META_IMPORT_PLATFORMS = new Set(['instagram', 'facebook', 'youtube']);

router.post('/import/:platform/:accountId', authenticate, upload.array('files', 12), async (req, res, next) => {
  try {
    const { platform, accountId } = req.params as { platform: string; accountId: string };
    const target = platform.toLowerCase();

    if (!META_IMPORT_PLATFORMS.has(target)) {
      res.status(400).json({ error: `No importer available for "${platform}"` });
      return;
    }

    const files = (req.files as Express.Multer.File[]) || [];
    if (files.length === 0) {
      res.status(400).json({ error: 'No files uploaded' });
      return;
    }

    const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }
    if (account.platform.toLowerCase() !== target) {
      res.status(400).json({ error: `This account is not a ${platform} account` });
      return;
    }

    const summary = await importMetaAudienceFiles(
      accountId,
      files.map(f => ({ originalname: f.originalname, buffer: f.buffer })),
    );

    const recognized = summary.files.some(f => f.sections.length > 0 && f.rows > 0);
    if (!recognized) {
      res.status(422).json({
        error: 'None of the uploaded files looked like an analytics export.',
        summary,
      });
      return;
    }

    res.json({ success: true, summary });
  } catch (err) {
    next(err);
  }
});

// ── Current import status for an account (powers the provenance chip) ────────
router.get('/import/:accountId/status', authenticate, async (req, res, next) => {
  try {
    const { accountId } = req.params as { accountId: string };
    const account = await prisma.socialAccount.findUnique({
      where: { id: accountId },
      select: { id: true, platform: true, lastImportedAt: true },
    });
    if (!account) {
      res.status(404).json({ error: 'Account not found' });
      return;
    }

    const [daily, demographics, activity, videos, unverifiedVideos] = await Promise.all([
      prisma.accountInsightDaily.count({ where: { socialAccountId: accountId, source: 'import' } }),
      prisma.accountDemographic.count({ where: { socialAccountId: accountId } }),
      prisma.accountActivity.count({ where: { socialAccountId: accountId } }),
      prisma.importedPost.count({ where: { socialAccountId: accountId } }),
      prisma.importedPost.count({ where: { socialAccountId: accountId, isVerified: false } }),
    ]);

    res.json({
      accountId,
      platform: account.platform,
      lastImportedAt: account.lastImportedAt,
      counts: { daily, demographics, activity, videos, unverifiedVideos },
      hasData: daily + demographics + activity + videos > 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

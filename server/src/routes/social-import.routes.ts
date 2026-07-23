import { Router } from 'express';
import multer from 'multer';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { importTikTokStudioFiles } from '../lib/social/import/tiktok-import.service.js';

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

    const [daily, demographics, activity, videos] = await Promise.all([
      prisma.accountInsightDaily.count({ where: { socialAccountId: accountId, source: 'import' } }),
      prisma.accountDemographic.count({ where: { socialAccountId: accountId } }),
      prisma.accountActivity.count({ where: { socialAccountId: accountId } }),
      prisma.importedPost.count({ where: { socialAccountId: accountId } }),
    ]);

    res.json({
      accountId,
      platform: account.platform,
      lastImportedAt: account.lastImportedAt,
      counts: { daily, demographics, activity, videos },
      hasData: daily + demographics + activity + videos > 0,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { PATHS } from './lib/paths.js';
import fileRoutes from './routes/files.routes.js';
import { startTransferCleanupJob } from './lib/transfer-cleanup.js';
import { startSubscriptionBillingJob } from './lib/subscription-billing.js';
import { startSocialScheduler } from './lib/social/social-scheduler.js';

// ─── Storage Bootstrap ───────────────────────────────────────────

function bootstrapStorage() {
  const dirs = [
    PATHS.UPLOADS_ROOT,
    PATHS.DOCUMENTS,
    PATHS.MEDIA,
    PATHS.BRANDING,
    PATHS.EMPLOYEE_DOCS,
    PATHS.RECEIPTS,
    PATHS.TRANSFERS,
    path.join(PATHS.UPLOADS_ROOT, 'social'), // social uploads directory
  ];

  console.log('📂 [Storage] Bootstrapping directories...');
  
  dirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`✅ Created: ${dir}`);
      } else {
        // Check write permissions
        fs.accessSync(dir, fs.constants.W_OK);
      }
    } catch (error) {
      console.error(`❌ Storage Error for ${dir}:`, error);
      if (process.env.NODE_ENV === 'production') {
        process.exit(1); // Fail fast in production
      }
    }
  });
  console.log('✅ [Storage] All directories verified and writable');
}

bootstrapStorage();

// ─── Background Jobs ─────────────────────────────────────────────
// Purges expired / deleted transfer files from disk every hour.
startTransferCleanupJob();
// Automatically generate subscription invoices and send reminders/overdue notices.
startSubscriptionBillingJob();
// Start social media posting and token refresh background jobs
startSocialScheduler();

const app = express();

app.set("trust proxy", 1);

// ─── Security & Global Middleware ─────────────────────────────────

// Add security headers (configured to allow document previews and cross-origin resources)
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "img-src": ["'self'", "data:", "https:", "blob:", "http://localhost:*", "http://127.0.0.1:*", env.FRONTEND_URL].filter(Boolean) as string[],
      "frame-src": ["'self'", "data:", "blob:", "http://localhost:*", "http://127.0.0.1:*", env.FRONTEND_URL].filter(Boolean) as string[],
      "frame-ancestors": ["'self'", "http://localhost:*", "http://127.0.0.1:*", env.FRONTEND_URL].filter(Boolean) as string[],
      "script-src": ["'self'"],
    },
  },
}));

// Global API Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 5000 : 20000,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          env.FRONTEND_URL || 'https://app.hirdanmarketing.com',
          env.LANDING_URL || 'https://hirdanmarketing.com',
        ].filter(Boolean)
      : [
          'http://localhost:8080',
          'http://localhost:3000',
          'http://localhost:5173',
          'http://127.0.0.1:5173',
        ];

    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ─── Health Check ─────────────────────────────────────────────────

app.get('/api/health', async (_req, res) => {
  try {
    // Test database connection
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      database: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

// ─── API Routes ───────────────────────────────────────────────────

app.use('/api', routes);

// Serve social media assets publicly for external platforms (Meta/TikTok/etc) to download
app.use('/public-uploads', express.static(path.join(PATHS.UPLOADS_ROOT, 'social')));

// Handle protected file access first
app.use('/uploads', fileRoutes);

// NOTE: do NOT publicly serve uploads. All access must go through authenticated routes.

// ─── Short Link Redirection Route ──────────────────────────────────

app.get(['/f/:shareId', '/share/:shareId'], async (req, res, next) => {
  try {
    const shareId = req.params.shareId as string;
    const record = await prisma.sharedFile.findUnique({
      where: { shareId },
    });
    if (!record) {
      return res.status(404).send('Share link not found or expired.');
    }
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl.replace(/\/$/, '')}/f/${shareId}`);
  } catch (err) {
    next(err);
  }
});

app.get(['/v/:token', '/verify/:token'], async (req, res, next) => {
  try {
    const token = req.params.token as string;
    const record = await prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!record) {
      return res.status(404).send('Verification link not found or expired.');
    }
    const frontendUrl = env.FRONTEND_URL || 'http://localhost:5173';
    return res.redirect(`${frontendUrl.replace(/\/$/, '')}/v/${token}`);
  } catch (err) {
    next(err);
  }
});

// ─── 404 Handler ──────────────────────────────────────────────────

app.use((req, _res, next) => {
  if (req.originalUrl.startsWith('/api')) {
    next(AppError.notFound('API endpoint not found'));
  } else {
    next();
  }
});

// ─── Global Error Handler ─────────────────────────────────────────

app.use(errorHandler);

export default app;

import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// ─── Security & Global Middleware ─────────────────────────────────

// Add security headers
app.use(helmet());

// Global API Rate Limiting
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 100 : 20000,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [
          process.env.FRONTEND_URL || 'https://app.hirdanmarketing.com',
          process.env.LANDING_URL || 'https://hirdanmarketing.com',
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

// ─── Static Files for Uploads ─────────────────────────────────────
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../public/uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use('/uploads', express.static(path.join(__dirname, '../public/uploads')));

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

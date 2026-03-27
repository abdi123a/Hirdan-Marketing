import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';

import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

const app = express();

// ─── Security & Global Middleware ─────────────────────────────────

// Add security headers
app.use(helmet());

// Global API Rate Limiting (e.g. max 200 requests per 15 mins per IP)
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: true, message: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', globalLimiter);

app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigins = process.env.NODE_ENV === 'production'
      ? [process.env.FRONTEND_URL || 'http://localhost:8080']
      : ['http://localhost:8080', 'http://localhost:5173', 'http://127.0.0.1:5173'];

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

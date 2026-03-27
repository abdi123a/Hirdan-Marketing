import express from 'express';
import cors from 'cors';
import routes from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';
import { AppError } from './lib/errors.js';
import { prisma } from './lib/prisma.js';

const app = express();

// ─── Global Middleware ────────────────────────────────────────────

app.use(cors({
  origin: (origin, callback) => {
    // Allow any origin in development for network testing
    if (process.env.NODE_ENV === 'development' || !origin) {
      callback(null, true);
    } else {
      const allowed = process.env.FRONTEND_URL || 'http://localhost:8080';
      if (origin === allowed) {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

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

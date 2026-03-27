import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { isSetupComplete } from '../config/env.js';
import { AppError } from '../lib/errors.js';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import util from 'util';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const execAsync = util.promisify(exec);
const router = Router();

// Middleware to block normal API requests if setup is not complete
export const requireSetup = (req: Request, res: Response, next: NextFunction) => {
  if (req.path.startsWith('/install')) {
    return next();
  }
  
  if (!isSetupComplete) {
    return next(new AppError('Application setup incomplete', 503));
  }
  
  next();
};

router.get('/status', (req: Request, res: Response) => {
  res.json({ isInstalled: isSetupComplete });
});

router.post('/test-db', async (req: Request, res: Response, next: NextFunction) => {
  if (isSetupComplete) {
    return next(AppError.badRequest('Setup is already complete'));
  }

  const { databaseUrl } = req.body;
  
  if (!databaseUrl) {
    return next(AppError.badRequest('Database URL is required'));
  }

  // Create a temporary PrismaClient to test the connection
  const tempPrisma = new PrismaClient({
    datasourceUrl: databaseUrl,
  });

  try {
    // Attempt a simple query to verify connection
    await tempPrisma.$queryRaw`SELECT 1`;
    await tempPrisma.$disconnect();
    
    res.json({ status: 'success', message: 'Database connection successful' });
  } catch (error: any) {
    await tempPrisma.$disconnect();
    next(new AppError(`Database connection failed: ${error.message}`, 400));
  }
});

router.post('/finalize', async (req: Request, res: Response, next: NextFunction) => {
  if (isSetupComplete) {
    return next(AppError.badRequest('Setup is already complete'));
  }

  const { databaseUrl, adminName, adminEmail, adminPassword } = req.body;

  if (!databaseUrl || !adminName || !adminEmail || !adminPassword) {
    return next(AppError.badRequest('All fields are required'));
  }

  try {
    // 1. Generate secrets
    const jwtSecret = crypto.randomBytes(32).toString('hex');
    const jwtRefreshSecret = crypto.randomBytes(32).toString('hex');

    // 2. Write to .env
    const envContent = `
DATABASE_URL="${databaseUrl}"
JWT_SECRET="${jwtSecret}"
JWT_REFRESH_SECRET="${jwtRefreshSecret}"
PORT=3001
NODE_ENV="development"
JWT_EXPIRES_IN="15m"
JWT_REFRESH_EXPIRES_IN="7d"
`.trim();

    const envPath = path.resolve(process.cwd(), '.env');
    fs.writeFileSync(envPath, envContent);

    // 3. Run Prisma db push to create schema
    // We set the DATABASE_URL environment variable for the child process so Prisma knows where to push
    try {
      await execAsync('npx prisma db push --accept-data-loss', {
        env: { ...process.env, DATABASE_URL: databaseUrl },
      });
    } catch (pushError: any) {
      return next(new AppError(`Failed to initialize database schema: ${pushError.message}`, 500));
    }

    // 4. Create Admin User
    const finalPrisma = new PrismaClient({ datasourceUrl: databaseUrl });
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    await finalPrisma.user.create({
      data: {
        email: adminEmail,
        name: adminName,
        passwordHash,
        role: 'ADMIN',
      },
    });

    await finalPrisma.$disconnect();

    res.json({ 
      status: 'success', 
      message: 'Setup completed successfully. Please restart the backend server.' 
    });
  } catch (error: any) {
    next(new AppError(`Setup failed: ${error.message}`, 500));
  }
});

export default router;

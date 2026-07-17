import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Force load env variables depending on NODE_ENV
const isProd = process.env.NODE_ENV === 'production';
const envProdPath = path.resolve(process.cwd(), '.env.production');
const envPath = path.resolve(process.cwd(), '.env');

if (isProd && fs.existsSync(envProdPath)) {
  console.log("Loading production environment from .env.production");
  const envConfig = dotenv.parse(fs.readFileSync(envProdPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
} else if (fs.existsSync(envPath)) {
  console.log("Loading environment from .env");
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
}

import { PrismaClient } from '@prisma/client';
import { decryptToken } from '../src/lib/social/token-crypto.service.js';

const prisma = new PrismaClient();

async function main() {
  console.log("Database URL in use:", process.env.DATABASE_URL);
  const accounts = await prisma.socialAccount.findMany();
  console.log(`Found ${accounts.length} total social accounts.`);

  let deletedCount = 0;

  for (const account of accounts) {
    let isMock = false;
    try {
      const decryptedToken = decryptToken(account.accessTokenEnc);
      if (decryptedToken === 'mock_access_token_data' || decryptedToken.startsWith('mock_')) {
        isMock = true;
      }
    } catch {
      isMock = true;
    }

    if (!isMock) {
      console.log(`Cleaning historical fake data for real account: ${account.displayName} (${account.platform})`);
      const accountDate = new Date(account.createdAt);
      const accountDay = new Date(Date.UTC(accountDate.getUTCFullYear(), accountDate.getUTCMonth(), accountDate.getUTCDate()));

      const result = await prisma.accountInsightDaily.deleteMany({
        where: {
          socialAccountId: account.id,
          date: {
            lt: accountDay,
          },
        },
      });
      console.log(`Deleted ${result.count} backdated seeded metrics.`);
      deletedCount += result.count;
    }
  }

  console.log(`Successfully completed! Total deleted records: ${deletedCount}`);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});

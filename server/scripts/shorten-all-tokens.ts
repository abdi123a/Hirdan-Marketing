import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function generateUniqueVerifyToken(): Promise<string> {
  const length = 8;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let attempts = 0;
  while (attempts < 10) {
    const bytes = crypto.randomBytes(length);
    let token = "";
    for (let i = 0; i < length; i++) {
      token += chars[bytes[i] % chars.length];
    }
    const exists = await prisma.verificationToken.findUnique({
      where: { token },
    });
    if (!exists) {
      return token;
    }
    attempts++;
  }
  return crypto.randomBytes(6).toString('hex');
}

async function main() {
  const longTokens = await prisma.verificationToken.findMany({
    where: {
      token: {
        gt: '=============' // match long string tokens
      }
    }
  });

  console.log(`Found ${longTokens.length} total tokens in DB. Shortening long ones...`);

  let count = 0;
  for (const record of longTokens) {
    if (record.token.length > 12) {
      const newToken = await generateUniqueVerifyToken();
      await prisma.verificationToken.update({
        where: { id: record.id },
        data: { token: newToken }
      });
      console.log(`Updated token for ${record.documentType} ${record.id}: ${record.token.substring(0, 10)}... -> ${newToken}`);
      count++;
    }
  }

  console.log(`Successfully shortened ${count} token(s).`);
}

main()
  .catch(err => {
    console.error('Error shortening tokens:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

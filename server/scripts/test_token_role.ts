import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
const prisma = new PrismaClient();

async function main() {
  const email = 'abdihakiim488@gmail.com';
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return console.log('User not found');

  console.log('User role in DB:', user.role);
  
  const token = jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    '7658c35a8f4c2e1d09b4a6d8e7f5c3b2a109876543210fedcba9876543210fed', // Guessing it or looking up
    { expiresIn: '1d' }
  );
  
  console.log('Token role (decoded):', (jwt.decode(token) as any).role);
}

main().finally(() => prisma.$disconnect());

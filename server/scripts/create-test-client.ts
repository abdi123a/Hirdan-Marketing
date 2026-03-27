
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const client = await prisma.client.findFirst({
    where: { email: 'support@evatis.dj' }
  });

  if (!client) {
    console.log('Client not found');
    return;
  }

  console.log('Found client:', client.company);

  const accessCode = 'EVATIS'; // For testing
  const passwordHash = await bcrypt.hash(accessCode, 12);

  const user = await prisma.user.upsert({
    where: { email: client.email },
    update: {
      passwordHash,
      role: 'CLIENT',
    },
    create: {
      email: client.email,
      name: client.name,
      passwordHash,
      role: 'CLIENT',
    }
  });

  await prisma.client.update({
    where: { id: client.id },
    data: { userId: user.id }
  });

  console.log(`User created/updated for ${client.company}. Email: ${client.email}, Access Code: ${accessCode}`);
}

main()
  .catch(e => console.error(e))
  .finally(() => prisma.$disconnect());

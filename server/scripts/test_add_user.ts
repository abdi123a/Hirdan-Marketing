import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.create({
    data: {
      name: 'Test Manager',
      email: 'manager@test.com',
      passwordHash: 'dummy',
      role: 'MANAGER',
    },
  });
  console.log('User created:', user);
}

main()
  .catch((e) => {
    console.error('Failed to create user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

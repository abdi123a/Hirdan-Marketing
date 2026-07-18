import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all social accounts...');
  const accounts = await prisma.socialAccount.findMany({
    include: {
      client: true,
    },
  });

  console.log(`Found ${accounts.length} social accounts:\n`);
  for (const account of accounts) {
    console.log(`ID: ${account.id}`);
    console.log(`Platform: ${account.platform}`);
    console.log(`Display Name: ${account.displayName}`);
    console.log(`Username: ${account.platformUsername}`);
    console.log(`Client Name: ${account.client?.name || 'N/A'}`);
    console.log(`Is Active: ${account.isActive}`);
    console.log(`Health Status: ${account.healthStatus}`);
    console.log('-----------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

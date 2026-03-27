import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const teamMember = await prisma.teamMember.findFirst();
  if (!teamMember) return console.log('No team member found');

  const user = await prisma.user.create({
    data: {
      name: 'Test Linked User',
      email: 'linked@test.com',
      passwordHash: 'dummy',
      role: 'STAFF',
      teamMember: { connect: { id: teamMember.id } },
    },
  });
  console.log('User created:', user);
}

main()
  .catch((e) => {
    console.error('Failed to create linked user:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

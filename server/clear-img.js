import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const current = await prisma.landingPageContent.findFirst();
  if (current) {
    await prisma.landingPageContent.update({
      where: { id: current.id },
      data: { contactImageUrl: null }
    });
    console.log("Cleared contactImageUrl");
  }
}
main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());

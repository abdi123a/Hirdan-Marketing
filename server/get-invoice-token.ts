import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const token = await prisma.verificationToken.findFirst({
    where: { documentType: 'invoice' }
  })
  console.log(JSON.stringify(token))
}

main()
  .catch(e => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })

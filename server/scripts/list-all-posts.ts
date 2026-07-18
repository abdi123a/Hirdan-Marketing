import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Fetching all social posts...');
  const posts = await prisma.socialPost.findMany({
    include: {
      client: true,
    },
  });

  console.log(`Found ${posts.length} social posts:\n`);
  for (const post of posts) {
    console.log(`ID: ${post.id}`);
    console.log(`Client: ${post.client?.name || 'N/A'}`);
    console.log(`Status: ${post.status}`);
    console.log(`Caption: ${post.caption}`);
    console.log(`Scheduled For: ${post.scheduledFor || 'Not Scheduled'}`);
    console.log(`Published At: ${post.publishedAt || 'Not Published'}`);
    console.log('-----------------------------------');
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

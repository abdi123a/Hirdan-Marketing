import { prisma } from '../src/lib/prisma.js';

async function cleanup() {
  const SINGLE_TYPES = [
    'QUEUED',
    'SCHEDULED',
    'SENT',
    'DELIVERY_DELAYED',
    'DELIVERED',
    'RECEIVED',
    'REPLIED',
    'BOUNCED',
    'COMPLAINED',
    'FAILED',
    'CANCELED',
  ];

  const allEvents = await prisma.emailEvent.findMany({
    orderBy: { occurredAt: 'asc' },
  });

  const seen = new Set<string>();
  const toDelete: string[] = [];

  for (const ev of allEvents) {
    if (SINGLE_TYPES.includes(ev.type)) {
      const key = ev.emailId + ':' + ev.type;
      if (seen.has(key)) {
        toDelete.push(ev.id);
      } else {
        seen.add(key);
      }
    }
  }

  if (toDelete.length > 0) {
    console.log('Deleting duplicate event count:', toDelete.length);
    await prisma.emailEvent.deleteMany({
      where: { id: { in: toDelete } },
    });
    console.log('Successfully cleaned duplicate events from database.');
  } else {
    console.log('No duplicate events found in database.');
  }
}

cleanup().catch(console.error).finally(() => prisma.$disconnect());

import { prisma } from '../lib/prisma.js';
import { enrichTikTokVideosBatch } from '../lib/social/tiktok-enrich.service.js';

async function main() {
  console.log('Starting backfill for past imported TikTok posts...');

  const tiktokAccounts = await prisma.socialAccount.findMany({
    where: { platform: 'tiktok' },
    select: { id: true, displayName: true, platformUsername: true },
  });

  if (tiktokAccounts.length === 0) {
    console.log('No TikTok accounts found in database.');
    process.exit(0);
  }

  console.log(`Found ${tiktokAccounts.length} TikTok account(s). Enriching past imported posts...`);

  let totalEnriched = 0;
  let totalVerified = 0;

  for (const acc of tiktokAccounts) {
    console.log(`Processing account: ${acc.displayName} (@${acc.platformUsername || acc.id})...`);
    const res = await enrichTikTokVideosBatch(acc.id);
    console.log(`  └ Enriched: ${res.enrichedCount}, Verified: ${res.verifiedCount}`);
    totalEnriched += res.enrichedCount;
    totalVerified += res.verifiedCount;
  }

  console.log(`\nBackfill Completed!`);
  console.log(`Total Posts Enriched: ${totalEnriched}`);
  console.log(`Total Posts Verified: ${totalVerified}`);
  process.exit(0);
}

main().catch((err) => {
  console.error('Backfill error:', err);
  process.exit(1);
});

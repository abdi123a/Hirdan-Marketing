import '../dist/config/env.js';
import { prisma } from '../dist/lib/prisma.js';

const all = await prisma.client.findMany({
  select: { id: true, name: true, company: true },
});
const target = all.filter((c) => {
  const n = `${c.name} ${c.company || ''}`.toLowerCase();
  return (
    n.includes('tokka') ||
    n.includes('papparoti') ||
    n.includes('paparoti') ||
    n.includes('teamo') ||
    n.includes('te amo') ||
    n.includes("te'amo")
  );
});
console.log(JSON.stringify({ clients: target }, null, 2));

for (const c of target) {
  const accounts = await prisma.socialAccount.findMany({
    where: { clientId: c.id, isActive: true },
    orderBy: { updatedAt: 'desc' },
  });
  console.log('\nCLIENT', c.name, '/', c.company);
  for (const a of accounts) {
    const since = new Date(Date.now() - 7 * 864e5);
    const recent = await prisma.accountInsightDaily.findMany({
      where: { socialAccountId: a.id, date: { gte: since } },
      orderBy: { date: 'desc' },
      take: 4,
      select: {
        date: true,
        followers: true,
        impressions: true,
        reach: true,
        profileVisits: true,
        videoViews: true,
        likes: true,
        source: true,
      },
    });
    const totalRows = await prisma.accountInsightDaily.count({ where: { socialAccountId: a.id } });
    const hasNums = recent.some(
      (r) =>
        (r.followers || 0) +
          (r.impressions || 0) +
          (r.reach || 0) +
          (r.profileVisits || 0) +
          (r.videoViews || 0) +
          (r.likes || 0) >
        0,
    );
    console.log(
      JSON.stringify({
        id: a.id.slice(0, 8),
        platform: a.platform,
        name: a.displayName || a.platformUsername,
        health: a.healthStatus,
        healthMsg: (a.healthMessage || '').slice(0, 160),
        updatedAt: a.updatedAt,
        tokenExpiresAt: a.tokenExpiresAt,
        hasRefresh: !!a.refreshTokenEnc,
        insightRows: totalRows,
        hasRecentNumbers: hasNums,
        recent: recent.map((r) => ({
          d: r.date.toISOString().slice(0, 10),
          f: r.followers,
          i: r.impressions,
          r: r.reach,
          v: r.profileVisits,
          vv: r.videoViews,
          likes: r.likes,
          src: r.source,
        })),
      }),
    );
  }
}
await prisma.$disconnect();

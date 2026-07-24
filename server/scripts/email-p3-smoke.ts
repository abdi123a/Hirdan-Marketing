/**
 * Phase 3 HTTP smoke — analytics, customer integration, attachments.
 *   npx tsx scripts/email-p3-smoke.ts
 */
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';

const BASE = `http://localhost:${env.PORT || 3001}/api`;

function ok(label: string, pass: boolean, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No ADMIN user');
  const token = jwt.sign({ userId: admin.id, email: admin.email, role: admin.role }, env.JWT_SECRET, { expiresIn: '5m' });
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = async (p: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}${p}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  console.log('\n── Analytics ─────────────────────────────');
  const overview = await api('/email/analytics/overview');
  ok('overview returns cards', overview.status === 200 && !!overview.body?.cards, `status ${overview.status}`);
  ok('overview has rates', typeof overview.body?.cards?.openRate === 'number');
  const volume = await api('/email/analytics/volume?days=30');
  ok('volume series (30 pts)', Array.isArray(volume.body?.series) && volume.body.series.length === 30, `len ${volume.body?.series?.length}`);
  const byMailbox = await api('/email/analytics/by-mailbox');
  ok('by-mailbox rows', Array.isArray(byMailbox.body?.mailboxes), `count ${byMailbox.body?.mailboxes?.length}`);
  const top = await api('/email/analytics/top-senders');
  ok('top-senders array', Array.isArray(top.body?.senders));

  console.log('\n── Customer integration ──────────────────');
  const clientSearch = await api('/email/clients/search?q=');
  ok('client search works', clientSearch.status === 200 && Array.isArray(clientSearch.body?.clients), `count ${clientSearch.body?.clients?.length}`);

  const convo = await prisma.conversation.findFirst({ orderBy: { createdAt: 'desc' } });
  const someClient = await prisma.client.findFirst({ select: { id: true, name: true } });
  if (convo) {
    const cust = await api(`/email/conversations/${convo.id}/customer`);
    ok('customer context endpoint', cust.status === 200, `status ${cust.status}`);
    if (someClient) {
      const link = await api(`/email/conversations/${convo.id}/link-client`, { method: 'POST', body: JSON.stringify({ clientId: someClient.id }) });
      ok('link client', link.status === 200 && link.body?.clientId === someClient.id);
      const cust2 = await api(`/email/conversations/${convo.id}/customer`);
      ok('linked customer resolves', cust2.body?.customer?.id === someClient.id && cust2.body?.suggested === false);
      const unlink = await api(`/email/conversations/${convo.id}/link-client`, { method: 'POST', body: JSON.stringify({ clientId: null }) });
      ok('unlink client', unlink.status === 200 && unlink.body?.clientId === null);
    } else {
      console.log('   (no client in DB — skipping link/unlink)');
    }
  } else {
    console.log('   (no conversation — skipping customer checks)');
  }

  console.log('\n✅ Phase 3 smoke finished.\n');
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

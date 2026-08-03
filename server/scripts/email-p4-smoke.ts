/**
 * Phase 4 smoke — system-email mirroring, agent/activity analytics, attachment versions.
 *   npx tsx scripts/email-p4-smoke.ts
 */
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env.js';
import { prisma } from '../src/lib/prisma.js';
import { logSystemEmail } from '../src/lib/mail/system-log.js';
import { storeAttachments } from '../src/lib/mail/attachments.js';

const BASE = `http://localhost:${env.PORT || 3001}/api`;

function ok(label: string, pass: boolean, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) throw new Error('No ADMIN');
  const token = jwt.sign({ userId: admin.id, email: admin.email, role: admin.role }, env.JWT_SECRET, { expiresIn: '5m' });
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = async (p: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}${p}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  console.log('\n── System email mirroring ────────────────');
  const fromEmail = 'notify-smoke@hirdanmarketing.com';
  await logSystemEmail({
    fromEmail,
    fromName: 'Notifications',
    to: 'client-smoke@example.com',
    subject: `Invoice INV-SMOKE ${Date.now()}`,
    html: '<p>Your invoice is attached.</p>',
  });
  const sysMailbox = await prisma.mailbox.findUnique({ where: { email: fromEmail } });
  ok('system mailbox auto-created', !!sysMailbox, sysMailbox?.displayName);
  const sysEmail = sysMailbox
    ? await prisma.email.findFirst({ where: { mailboxId: sysMailbox.id, direction: 'OUTBOUND' }, orderBy: { createdAt: 'desc' } })
    : null;
  ok('mirrored email is OUTBOUND + SENT', sysEmail?.status === 'SENT' && sysEmail?.direction === 'OUTBOUND');
  ok('mirrored email attributed to Automated (sentById null)', sysEmail?.sentById === null);

  console.log('\n── Agent + activity analytics ────────────');
  const byAgent = await api('/email/analytics/by-agent');
  ok('by-agent returns agents', Array.isArray(byAgent.body?.agents) && byAgent.body.agents.length >= 1);
  ok('includes Automated bucket', byAgent.body?.agents?.some((a: any) => a.automated === true));
  const dept = await api('/email/analytics/by-department');
  ok('by-department returns rows', Array.isArray(dept.body?.departments));
  const activity = await api('/email/analytics/activity');
  ok('activity feed returns rows', Array.isArray(activity.body?.activity) && activity.body.activity.length >= 1);
  ok('activity rows carry an agent name', activity.body?.activity?.every((a: any) => typeof a.agent === 'string'));

  console.log('\n── Attachment version history ────────────');
  // Build a throwaway email with one attachment.
  const mailbox = await prisma.mailbox.findFirst();
  if (mailbox) {
    const convo = await prisma.conversation.create({ data: { mailboxId: mailbox.id, subject: 'Attach smoke', threadKey: 'attach smoke' } });
    const email = await prisma.email.create({ data: { conversationId: convo.id, mailboxId: mailbox.id, direction: 'OUTBOUND', status: 'SENT', fromEmail: mailbox.email, toEmails: ['x@example.com'], subject: 'Attach smoke' } });
    const [stored] = await storeAttachments(email.id, [{ filename: 'doc.txt', content: Buffer.from('v1').toString('base64'), contentType: 'text/plain' }]);
    const att = await prisma.attachment.create({ data: { emailId: email.id, filename: stored.filename, mimeType: stored.mimeType, size: stored.size, storageKey: stored.storageKey, checksum: stored.checksum } });

    const replaced = await api(`/email/attachments/${att.id}/replace`, {
      method: 'POST',
      body: JSON.stringify({ filename: 'doc.txt', content: Buffer.from('v2 contents').toString('base64'), contentType: 'text/plain' }),
    });
    ok('replace creates v2', replaced.status === 201 && replaced.body?.attachment?.version === 2);

    const versions = await api(`/email/attachments/${att.id}/versions`);
    ok('versions chain has 2 entries', (versions.body?.versions || []).length === 2, `len ${(versions.body?.versions || []).length}`);
    ok('exactly one latest version', (versions.body?.versions || []).filter((v: any) => v.isLatest).length === 1);

    const detail = await api(`/email/conversations/${convo.id}`);
    const latestAtts = detail.body?.conversation?.emails?.[0]?.attachments || [];
    ok('thread shows only latest version', latestAtts.length === 1 && latestAtts[0].version === 2);

    // cleanup
    await prisma.conversation.delete({ where: { id: convo.id } });
  } else {
    console.log('   (no mailbox — skipping attachment test)');
  }

  console.log('\n✅ Phase 4 smoke finished.\n');
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

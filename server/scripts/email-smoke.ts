/**
 * Email Center smoke test — exercises the core Phase 1 pipeline directly
 * against the database (no HTTP/Resend needed):
 *   send → tracking events (delivered/opened/clicked) → threaded inbound reply.
 * Also seeds the example company mailboxes so the UI is immediately usable.
 *
 * Run:  npx tsx scripts/email-smoke.ts
 */
import { prisma } from '../src/lib/prisma.js';
import { sendMailboxEmail, SendPersistedError } from '../src/lib/mail/send.service.js';
import { processEmailEvent } from '../src/lib/mail/events.service.js';
import { processInboundEmail } from '../src/lib/mail/inbound.service.js';

const EXAMPLE_MAILBOXES = [
  { email: 'support@hirdanmarketing.com', displayName: 'Support', department: 'Support', color: '#6366f1', signature: '<p>— The Support Team</p>' },
  { email: 'sales@hirdanmarketing.com', displayName: 'Sales', department: 'Sales', color: '#10b981', signature: '<p>— The Sales Team</p>' },
  { email: 'billing@hirdanmarketing.com', displayName: 'Finance', department: 'Finance', color: '#f59e0b', signature: '<p>— Finance</p>' },
  { email: 'hr@hirdanmarketing.com', displayName: 'HR', department: 'HR', color: '#ec4899', signature: '<p>— Human Resources</p>' },
  { email: 'marketing@hirdanmarketing.com', displayName: 'Marketing', department: 'Marketing', color: '#8b5cf6', signature: '<p>— Marketing</p>' },
  { email: 'operations@hirdanmarketing.com', displayName: 'Operations', department: 'Operations', color: '#06b6d4', signature: '<p>— Operations</p>' },
];

function ok(label: string, pass: boolean, detail = '') {
  console.log(`${pass ? '✅' : '❌'} ${label}${detail ? ` — ${detail}` : ''}`);
  if (!pass) process.exitCode = 1;
}

async function main() {
  console.log('\n── Seeding example mailboxes ─────────────────────────');
  for (const m of EXAMPLE_MAILBOXES) {
    await prisma.mailbox.upsert({ where: { email: m.email }, create: m, update: { displayName: m.displayName, color: m.color } });
  }
  const mailbox = await prisma.mailbox.findUniqueOrThrow({ where: { email: 'support@hirdanmarketing.com' } });
  console.log(`   Seeded ${EXAMPLE_MAILBOXES.length} mailboxes.`);

  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  const user = { userId: admin?.id ?? 'system', role: 'ADMIN' };

  console.log('\n── 1. Compose & send (no Resend key → persists as FAILED) ──');
  let emailId: string;
  try {
    const r = await sendMailboxEmail({
      user, mailboxId: mailbox.id,
      to: ['customer@example.com'],
      subject: `Smoke Test ${Date.now()}`,
      html: '<p>Hello from the Email Center smoke test.</p>',
    });
    emailId = r.email.id;
  } catch (e) {
    if (e instanceof SendPersistedError) { emailId = e.email.id; console.log('   send() reported:', e.message); }
    else throw e;
  }
  const sent = await prisma.email.findUniqueOrThrow({ where: { id: emailId }, include: { events: true } });
  ok('Outbound email persisted with conversation', !!sent.conversationId);
  ok('QUEUED event recorded', sent.events.some((e) => e.type === 'QUEUED'));
  ok('Message-ID generated', !!sent.messageId, sent.messageId ?? '');

  console.log('\n── 2. Delivery tracking events (delivered → opened → clicked) ──');
  const resendId = `resend_smoke_${sent.id}`;
  await prisma.email.update({ where: { id: sent.id }, data: { resendId, status: 'SENT', sentAt: new Date() } });
  await processEmailEvent('email.delivered', { email_id: resendId });
  await processEmailEvent('email.opened', { email_id: resendId });
  await processEmailEvent('email.clicked', { email_id: resendId, click: { link: 'https://hirdanmarketing.com' } });
  const tracked = await prisma.email.findUniqueOrThrow({ where: { id: sent.id }, include: { events: { orderBy: { occurredAt: 'asc' } } } });
  ok('Status advanced to CLICKED', tracked.status === 'CLICKED', `status=${tracked.status}`);
  console.log('   Timeline:', tracked.events.map((e) => e.type).join(' → '));

  console.log('\n── 3. Threaded inbound reply (In-Reply-To match) ──');
  const before = await prisma.conversation.findUniqueOrThrow({ where: { id: sent.conversationId } });
  await processInboundEmail({
    from: { email: 'customer@example.com', name: 'Test Customer' },
    to: [mailbox.email],
    subject: `Re: ${sent.subject}`,
    html: '<p>Thanks, received!</p>',
    text: 'Thanks, received!',
    headers: [
      { name: 'Message-ID', value: `<customer-reply-${Date.now()}@example.com>` },
      { name: 'In-Reply-To', value: sent.messageId },
      { name: 'References', value: sent.messageId },
    ],
  });
  const after = await prisma.conversation.findUniqueOrThrow({
    where: { id: sent.conversationId },
    include: { emails: { orderBy: { createdAt: 'asc' }, include: { events: true } } },
  });
  ok('Reply attached to same conversation (no duplicate)', after.messageCount === before.messageCount + 1,
    `messageCount ${before.messageCount} → ${after.messageCount}`);
  ok('Thread has both OUTBOUND and INBOUND', after.emails.some((e) => e.direction === 'OUTBOUND') && after.emails.some((e) => e.direction === 'INBOUND'));
  const outbound = after.emails.find((e) => e.direction === 'OUTBOUND')!;
  ok('Outbound marked REPLIED', outbound.events.some((e) => e.type === 'REPLIED'));
  ok('Unread count incremented by inbound', after.unreadCount >= 1, `unreadCount=${after.unreadCount}`);
  const dup = await prisma.conversation.count({ where: { mailboxId: mailbox.id, threadKey: after.threadKey } });
  ok('Exactly one conversation for this thread', dup === 1, `count=${dup}`);

  console.log('\n✅ Smoke test finished.\n');
}

main()
  .catch((e) => { console.error('❌ Smoke test error:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });

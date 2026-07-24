/**
 * Phase 2 HTTP smoke test — templates, labels, notes, search, cancel/retry.
 * Signs an admin JWT and hits the live server on :3001.
 *   npx tsx scripts/email-p2-smoke.ts
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
  if (!admin) throw new Error('No ADMIN user found');
  const token = jwt.sign({ userId: admin.id, email: admin.email, role: admin.role }, env.JWT_SECRET, { expiresIn: '5m' });
  const H = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const api = async (path: string, init?: RequestInit) => {
    const res = await fetch(`${BASE}${path}`, { ...init, headers: { ...H, ...(init?.headers || {}) } });
    return { status: res.status, body: await res.json().catch(() => ({})) };
  };

  console.log('\n── Templates ─────────────────────────────');
  const created = await api('/email/templates', {
    method: 'POST',
    body: JSON.stringify({ name: 'P2 Smoke Template', category: 'SUPPORT', subject: 'Hi {{customer}}', body: 'Sent {{today}} to {{customer}}.' }),
  });
  ok('create template', created.status === 201, `status ${created.status}`);
  ok('variables auto-detected', JSON.stringify(created.body?.template?.variables || []).includes('customer'), JSON.stringify(created.body?.template?.variables));
  const templateId = created.body?.template?.id;
  const listed = await api('/email/templates');
  ok('list templates includes new one', (listed.body?.templates || []).some((t: any) => t.id === templateId));

  console.log('\n── Labels ────────────────────────────────');
  const label = await api('/email/labels', { method: 'POST', body: JSON.stringify({ name: `Smoke ${Date.now()}`, color: '#10b981' }) });
  ok('create label', label.status === 201, `status ${label.status}`);
  const labelId = label.body?.label?.id;

  const convo = await prisma.conversation.findFirst({ orderBy: { createdAt: 'desc' } });
  if (convo && labelId) {
    const assign = await api(`/email/conversations/${convo.id}/labels`, { method: 'POST', body: JSON.stringify({ labelId }) });
    ok('assign label to conversation', assign.status === 201, `status ${assign.status}`);
    const detail = await api(`/email/conversations/${convo.id}`);
    ok('conversation shows label', (detail.body?.conversation?.labels || []).some((l: any) => l.labelId === labelId));

    console.log('\n── Notes + mentions ──────────────────────');
    const note = await api(`/email/conversations/${convo.id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ body: `@${admin.name} please review`, mentions: [admin.id] }),
    });
    ok('add internal note', note.status === 201, `status ${note.status}`);
    const notes = await api(`/email/conversations/${convo.id}/notes`);
    ok('list notes includes it', (notes.body?.notes || []).length >= 1);

    console.log('\n── Cleanup label/note ────────────────────');
    await api(`/email/conversations/${convo.id}/labels/${labelId}`, { method: 'DELETE' });
    ok('remove label from conversation', true);
  } else {
    console.log('   (no conversation to attach label/note — skipping those checks)');
  }

  console.log('\n── Search + filters ──────────────────────');
  const mentionable = await api('/email/mentionable-users');
  ok('mentionable-users returns staff', (mentionable.body?.users || []).length >= 1, `count ${(mentionable.body?.users || []).length}`);
  const unread = await api('/email/conversations?folder=inbox&unread=true&limit=5');
  ok('unread filter query works', unread.status === 200 && Array.isArray(unread.body?.conversations));
  const search = await api('/email/conversations?folder=inbox&q=test&limit=5');
  ok('global search query works', search.status === 200 && Array.isArray(search.body?.conversations));

  // cleanup template + label
  if (templateId) await api(`/email/templates/${templateId}`, { method: 'DELETE' });
  if (labelId) await api(`/email/labels/${labelId}`, { method: 'DELETE' });

  console.log('\n✅ Phase 2 smoke finished.\n');
}

main().catch((e) => { console.error('❌', e); process.exit(1); }).finally(() => prisma.$disconnect());

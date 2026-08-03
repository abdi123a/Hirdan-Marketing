/**
 * Post-deploy / local smoke checks for critical API surfaces.
 * Usage: API_BASE=https://api.example.com node --import tsx scripts/smoke-api.ts
 * Or against local: API_BASE=http://127.0.0.1:3001 npm run smoke:api (after adding script)
 */
const base = (process.env.API_BASE || 'http://127.0.0.1:3001').replace(/\/$/, '');

async function check(name: string, fn: () => Promise<void>) {
  try {
    await fn();
    console.log(`✅ ${name}`);
  } catch (err) {
    console.error(`❌ ${name}:`, err instanceof Error ? err.message : err);
    process.exitCode = 1;
  }
}

async function main() {
  console.log(`Smoke against ${base}`);

  await check('GET /api/health', async () => {
    const res = await fetch(`${base}/api/health`);
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json().catch(() => ({}));
    if (body && typeof body === 'object' && 'ok' in body && body.ok === false) {
      throw new Error('health returned ok:false');
    }
  });

  await check('money helpers (local)', async () => {
    const { centsToMajor, dollarsToCents, formatCents, computeInvoiceTotalsCents } = await import('../src/lib/money.js');
    if (centsToMajor(1999) !== 19.99) throw new Error('centsToMajor failed');
    if (dollarsToCents(19.99) !== 1999) throw new Error('dollarsToCents failed');
    if (!formatCents(50000, 'USD').includes('500')) throw new Error('formatCents failed');
    const t = computeInvoiceTotalsCents({
      items: [{ quantity: 2, unitPrice: 10000 }],
      taxRate: 10,
      discount: 5,
      discountType: 'PERCENTAGE',
      depositCents: 0,
    });
    // subtotal 20000, tax 2000, discount 1000 → total 21000
    if (t.subtotalCents !== 20000 || t.taxCents !== 2000 || t.discountCents !== 1000 || t.totalCents !== 21000) {
      throw new Error(`totals mismatch: ${JSON.stringify(t)}`);
    }
  });

  if (process.exitCode) {
    console.error('Smoke failed');
    process.exit(1);
  }
  console.log('All smoke checks passed');
}

main();

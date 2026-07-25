// ─────────────────────────────────────────────────────────────────────────────
// Idempotent migration baseline guard — run immediately before `migrate deploy`.
//
// This project previously used `prisma db push`, so existing databases have all
// the tables but no `_prisma_migrations` history. Running `migrate deploy`
// against one of those would try to apply `0_init` — a pile of CREATE TABLE
// statements — and fail because everything already exists.
//
// This script marks `0_init` as already-applied, but ONLY when it is safe to:
//
//   already has _prisma_migrations  → do nothing (already on migrations)
//   no _prisma_migrations, tables present → baseline (the db push case)
//   no _prisma_migrations, empty database → do nothing, so `migrate deploy`
//                                           can legitimately create the schema
//
// That last branch matters: blindly baselining a brand-new empty database would
// record the schema as created without ever creating it.
//
// Safe to run on every deploy.
// ─────────────────────────────────────────────────────────────────────────────

const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const BASELINE = '0_init';
// Any table guaranteed to exist in a provisioned database.
const SENTINEL_TABLE = 'users';
const SERVER_DIR = path.resolve(__dirname, '..');

/**
 * Locate the locally installed Prisma CLI.
 *
 * This deliberately does NOT fall back to `npx prisma@<version>`. `prisma` is a
 * devDependency, and prisma.config.ts does `import ... from "prisma/config"`, so
 * an npx-provided CLI still fails to load the config when the package itself
 * isn't in node_modules. The deploy must therefore install devDependencies
 * before running migrations (and may prune afterwards) — which is exactly what
 * the deploy scripts now do.
 */
function resolvePrismaCli() {
  const local = path.join(SERVER_DIR, 'node_modules', '.bin', 'prisma');
  if (fs.existsSync(local)) return local;

  console.error(
    '❌ Prisma CLI not found at node_modules/.bin/prisma.\n' +
      '   `prisma` is a devDependency, so run a full `npm install` (not\n' +
      '   `npm install --production`) before migrations, and prune afterwards.'
  );
  process.exit(1);
}

async function tableExists(prisma, name) {
  const rows = await prisma.$queryRawUnsafe(
    'SELECT COUNT(*) AS c FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?',
    name
  );
  return Number(rows[0].c) > 0;
}

async function main() {
  const prisma = new PrismaClient();
  let needsBaseline = false;

  try {
    const hasHistory = await tableExists(prisma, '_prisma_migrations');
    if (hasHistory) {
      console.log('✅ Migration history already present — nothing to baseline.');
      return;
    }

    const hasSchema = await tableExists(prisma, SENTINEL_TABLE);
    if (!hasSchema) {
      console.log('✅ Empty database — letting `migrate deploy` create the schema from scratch.');
      return;
    }

    needsBaseline = true;
  } finally {
    await prisma.$disconnect();
  }

  if (!needsBaseline) return;

  console.log(`📐 Existing database without migration history — baselining "${BASELINE}"...`);
  execFileSync(resolvePrismaCli(), ['migrate', 'resolve', '--applied', BASELINE], {
    stdio: 'inherit',
    cwd: SERVER_DIR,
  });
  console.log('✅ Baseline recorded. `migrate deploy` will now apply only newer migrations.');
}

main().catch((err) => {
  console.error('❌ Migration baseline check failed:', err.message);
  process.exit(1);
});

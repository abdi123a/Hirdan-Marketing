const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const zlib = require('zlib');
const { pipeline } = require('stream/promises');
const { URL } = require('url');

// Path configurations
const envPath = path.resolve(__dirname, '../.env');
const backupDir = path.resolve(__dirname, '../backups');

console.log('📦 Starting Database Backup process...');

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env file not found at:', envPath);
  process.exit(0); // Exit gracefully so deployments don't block, but log the error
}

// Read and parse .env
const envContent = fs.readFileSync(envPath, 'utf-8');
let databaseUrl = '';
for (const line of envContent.split('\n')) {
  if (line.startsWith('DATABASE_URL=')) {
    const index = line.indexOf('=');
    databaseUrl = line.substring(index + 1).trim().replace(/^['"]|['"]$/g, '');
    break;
  }
}

if (!databaseUrl) {
  console.error('❌ Error: DATABASE_URL not found in .env');
  process.exit(0);
}

// Pre-migration dumps contain every client, invoice, payroll and credential
// row. They are written gzip-compressed, owner-read-only (0600) into a 0700
// directory, and never through a shell (the DB URL can't inject commands).
//
// RECOMMENDATION: these files live on the same VPS as the database, so they
// don't survive loss/compromise of that box. Ship them offsite (e.g. an
// encrypted S3/B2 bucket with lifecycle rules, or `restic`/`borg`) and test a
// restore periodically.
async function run() {
  const parsedUrl = new URL(databaseUrl);
  const username = decodeURIComponent(parsedUrl.username);
  const password = decodeURIComponent(parsedUrl.password);
  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port || '3306';
  // pathname contains leading '/'; URL already strips the query string
  const database = decodeURIComponent(parsedUrl.pathname.substring(1));

  fs.mkdirSync(backupDir, { recursive: true, mode: 0o700 });
  fs.chmodSync(backupDir, 0o700);

  // Tighten any plain-text dumps left by earlier versions of this script.
  for (const file of fs.readdirSync(backupDir)) {
    if (file.startsWith('backup_')) {
      try { fs.chmodSync(path.join(backupDir, file), 0o600); } catch { /* ignore */ }
    }
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup_${database}_${timestamp}.sql.gz`;
  const backupPath = path.join(backupDir, backupFilename);

  console.log(`🗄️  Backing up database "${database}" to ${backupPath}...`);

  // Password goes via MYSQL_PWD so it never appears in the process list.
  const dump = spawn(
    'mysqldump',
    ['--no-tablespaces', '--single-transaction', '-h', hostname, '-P', port, '-u', username, database],
    { env: { ...process.env, MYSQL_PWD: password }, stdio: ['ignore', 'pipe', 'inherit'] }
  );
  const dumpExit = new Promise((resolve, reject) => {
    dump.on('error', reject);
    dump.on('close', (code) => (code === 0 ? resolve() : reject(new Error(`mysqldump exited with code ${code}`))));
  });

  try {
    await Promise.all([
      pipeline(dump.stdout, zlib.createGzip({ level: 9 }), fs.createWriteStream(backupPath, { mode: 0o600 })),
      dumpExit,
    ]);
  } catch (err) {
    // Don't leave a truncated file that looks like a valid backup.
    try { fs.unlinkSync(backupPath); } catch { /* ignore */ }
    throw err;
  }
  fs.chmodSync(backupPath, 0o600);

  const { size } = fs.statSync(backupPath);
  console.log(`✅ Database backup completed successfully (${(size / 1024 / 1024).toFixed(1)} MB, gzip, mode 600).`);
  console.log('ℹ️  Backups are stored on this server only — copy them offsite (see comment in scripts/backup.cjs).');

  // Prune backups older than 10 days to prevent disk space exhaustion
  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;
  for (const file of fs.readdirSync(backupDir)) {
    if (file.startsWith('backup_') && (file.endsWith('.sql') || file.endsWith('.sql.gz'))) {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < tenDaysAgo) {
        console.log(`🧹 Pruning old backup file: ${file}`);
        fs.unlinkSync(filePath);
      }
    }
  }
}

run().catch((error) => {
  console.error('❌ Database backup failed:', error.message);
  // We do not crash the script to prevent blocking deployments if mysqldump is temporarily unavailable,
  // but we print a clear warning.
});

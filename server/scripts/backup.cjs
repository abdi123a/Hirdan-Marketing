const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
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

try {
  const parsedUrl = new URL(databaseUrl);
  const username = parsedUrl.username;
  const password = parsedUrl.password;
  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port || '3306';
  // pathname contains leading '/'
  let database = parsedUrl.pathname.substring(1);
  // Strip query parameters
  if (database.includes('?')) {
    database = database.split('?')[0];
  }

  // Ensure backup directory exists
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilename = `backup_${database}_${timestamp}.sql`;
  const backupPath = path.join(backupDir, backupFilename);

  console.log(`🗄️  Backing up database "${database}" to ${backupPath}...`);

  // Build command using environment variable for password to avoid exposure in process lists
  const command = `mysqldump --no-tablespaces -h "${hostname}" -P "${port}" -u "${username}" "${database}" > "${backupPath}"`;
  
  execSync(command, {
    env: {
      ...process.env,
      MYSQL_PWD: password
    },
    stdio: 'inherit'
  });

  console.log('✅ Database backup completed successfully!');

  // Prune backups older than 10 days to prevent disk space exhaustion
  const files = fs.readdirSync(backupDir);
  const tenDaysAgo = Date.now() - 10 * 24 * 60 * 60 * 1000;

  for (const file of files) {
    if (file.startsWith('backup_') && file.endsWith('.sql')) {
      const filePath = path.join(backupDir, file);
      const stat = fs.statSync(filePath);
      if (stat.mtimeMs < tenDaysAgo) {
        console.log(`🧹 Pruning old backup file: ${file}`);
        fs.unlinkSync(filePath);
      }
    }
  }

} catch (error) {
  console.error('❌ Database backup failed:', error.message);
  // We do not crash the script to prevent blocking deployments if mysqldump is temporarily unavailable,
  // but we print a clear warning.
}

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { URL } = require('url');

// Path configurations
const envPath = path.resolve(__dirname, '../.env');
const backupDir = path.resolve(__dirname, '../backups');

console.log('📦 Starting Database Restore process...');

// Get backup filename from arguments
const backupFilename = process.argv[2];
if (!backupFilename) {
  console.error('❌ Error: Backup filename must be specified as an argument.');
  process.exit(1);
}

// Security check: Prevent path traversal
if (backupFilename.includes('..') || backupFilename.includes('/') || backupFilename.includes('\\')) {
  console.error('❌ Error: Invalid backup filename.');
  process.exit(1);
}

const backupPath = path.join(backupDir, backupFilename);
if (!fs.existsSync(backupPath)) {
  console.error('❌ Error: Backup file not found at:', backupPath);
  process.exit(1);
}

if (!fs.existsSync(envPath)) {
  console.error('❌ Error: .env file not found at:', envPath);
  process.exit(1);
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
  process.exit(1);
}

try {
  const parsedUrl = new URL(databaseUrl);
  const username = parsedUrl.username;
  const password = parsedUrl.password;
  const hostname = parsedUrl.hostname;
  const port = parsedUrl.port || '3306';
  let database = parsedUrl.pathname.substring(1);
  if (database.includes('?')) {
    database = database.split('?')[0];
  }

  console.log(`🗄️  Restoring database "${database}" from ${backupPath}...`);

  // Build command using environment variable for password to avoid exposure in process lists
  const command = `mysql -h "${hostname}" -P "${port}" -u "${username}" "${database}" < "${backupPath}"`;
  
  execSync(command, {
    env: {
      ...process.env,
      MYSQL_PWD: password
    },
    stdio: 'inherit'
  });

  console.log('✅ Database restore completed successfully!');

} catch (error) {
  console.error('❌ Database restore failed:', error.message);
  process.exit(1);
}

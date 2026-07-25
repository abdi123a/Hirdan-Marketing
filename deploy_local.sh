#!/bin/bash
# Local deployment script to bypass GitHub Action runner timeouts

# Exit on any error
set -e

echo "📦 Building Frontend (CRM Dashboard)..."
npm run build

echo "📦 Building Landing Page (hirdanmarketing.com)..."
cd landing-page
npm install --legacy-peer-deps
npm run build
cd ..

echo "📦 Building Backend..."
cd server
npm install --legacy-peer-deps
npx prisma generate
npm run build
cd ..

echo "🚀 Copying Frontend static files to app.hirdanmarketing.com..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" \
  dist/ root@72.61.192.11:/home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/

echo "🚀 Copying Landing Page static files to hirdanmarketing.com..."
rsync -avz --delete --exclude='.well-known' -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" \
  landing-page/dist/ root@72.61.192.11:/home/hirdanmarketing/htdocs/hirdanmarketing.com/
   
echo "🚀 Copying Backend compiled files to api.hirdanmarketing.com..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" \
  server/dist server/package.json server/package-lock.json server/prisma server/scripts \
  root@72.61.192.11:/home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/

echo "⚙️ Finalizing Server Setup..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@72.61.192.11 << 'EOF'
  chown -R hirdanmarketing-app:hirdanmarketing-app /home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/
  chown -R hirdanmarketing:hirdanmarketing /home/hirdanmarketing/htdocs/hirdanmarketing.com/
  
  mkdir -p /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public
  ln -sfn /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/uploads \
    /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public/uploads
  
  set -e   # abort before restarting the API if any step below fails

  cd /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/

  # Fail fast: env.ts now REQUIRES TOKEN_ENCRYPTION_KEY (it decrypts the stored
  # third-party credentials). Without it the API would refuse to boot, so check
  # here — before pm2 restart — rather than taking the service down.
  if ! grep -q '^TOKEN_ENCRYPTION_KEY=' .env; then
    echo "❌ TOKEN_ENCRYPTION_KEY missing from server/.env — aborting before restart."
    echo "   Generate one with: openssl rand -hex 32"
    exit 1
  fi

  # Full install (not --production): the Prisma CLI is a devDependency and
  # prisma.config.ts imports from 'prisma/config', so migrations need it present.
  # Dev dependencies are pruned again after the migration step.
  npm install --legacy-peer-deps

  echo "🗄️ Running pre-migration database backup..."
  node scripts/backup.cjs

  ./node_modules/.bin/prisma generate

  # `db push --accept-data-loss` was used here previously; it silently drops any
  # column/table that drifts from the schema, against live business data.
  # `migrate deploy` applies only the reviewed SQL in prisma/migrations.
  node scripts/baseline-migrations.cjs
  ./node_modules/.bin/prisma migrate deploy

  echo "🧹 Pruning dev dependencies..."
  npm prune --production --legacy-peer-deps

  chown -R hirdanmarketing-api:hirdanmarketing-api /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/
  
  echo "🔄 Restarting Node.js service..."
  sudo -u hirdanmarketing-api pm2 restart api || pm2 restart api || pm2 restart all || echo "Restart failed"
  
  echo "✅ Server commands finished!"
EOF

echo "✅ Local deployment successfully finished!"

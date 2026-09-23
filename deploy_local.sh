#!/bin/bash
# Local deployment script to bypass GitHub Action runner timeouts.
#
# Required environment:
#   DEPLOY_HOST   VPS hostname or IP
#   DEPLOY_USER   SSH user (currently must be able to chown the site dirs)
# Optional:
#   DEPLOY_PORT          SSH port (default 22)
#   DEPLOY_SSH_KEY       private key path (default ~/.ssh/id_ed25519)
#   DEPLOY_HOST_KEY_MODE StrictHostKeyChecking value (default accept-new:
#                        trust on first use, refuse if the key later changes)
#
# Example: DEPLOY_HOST=203.0.113.10 DEPLOY_USER=deploy ./deploy_local.sh

set -euo pipefail

: "${DEPLOY_HOST:?DEPLOY_HOST is not set — export the VPS hostname/IP before running}"
: "${DEPLOY_USER:?DEPLOY_USER is not set — export the SSH user before running}"
DEPLOY_PORT="${DEPLOY_PORT:-22}"
DEPLOY_SSH_KEY="${DEPLOY_SSH_KEY:-$HOME/.ssh/id_ed25519}"
DEPLOY_HOST_KEY_MODE="${DEPLOY_HOST_KEY_MODE:-accept-new}"

if [ ! -f "$DEPLOY_SSH_KEY" ]; then
  echo "❌ SSH key not found at $DEPLOY_SSH_KEY (set DEPLOY_SSH_KEY)." >&2
  exit 1
fi

SSH_OPTS=(-p "$DEPLOY_PORT" -o "StrictHostKeyChecking=$DEPLOY_HOST_KEY_MODE" -i "$DEPLOY_SSH_KEY")
RSYNC_SSH="ssh -p $DEPLOY_PORT -o StrictHostKeyChecking=$DEPLOY_HOST_KEY_MODE -i $DEPLOY_SSH_KEY"
REMOTE="$DEPLOY_USER@$DEPLOY_HOST"

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
rsync -avz -e "$RSYNC_SSH" \
  dist/ "$REMOTE":/home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/

echo "🚀 Copying Landing Page static files to hirdanmarketing.com..."
rsync -avz --delete --exclude='.well-known' -e "$RSYNC_SSH" \
  landing-page/dist/ "$REMOTE":/home/hirdanmarketing/htdocs/hirdanmarketing.com/
   
echo "🚀 Copying Backend compiled files to api.hirdanmarketing.com..."
rsync -avz -e "$RSYNC_SSH" \
  server/dist server/package.json server/package-lock.json server/prisma server/scripts server/templates \
  "$REMOTE":/home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/

echo "⚙️ Finalizing Server Setup..."
ssh "${SSH_OPTS[@]}" "$REMOTE" 'bash -s' << 'EOF'
  set -euo pipefail   # abort before restarting the API if any step fails

  chown -R hirdanmarketing-app:hirdanmarketing-app /home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/
  # Same fallback as the CI deploy: the landing-page site user differs per box.
  chown -R hirdanmarketing:hirdanmarketing /home/hirdanmarketing/htdocs/hirdanmarketing.com/ 2>/dev/null || \
    chown -R www-data:www-data /home/hirdanmarketing/htdocs/hirdanmarketing.com/ || true

  mkdir -p /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public
  ln -sfn /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/uploads \
    /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public/uploads

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

  # Drift check (warning only, same as the CI deploy): live DB vs schema.prisma.
  DRIFT_RC=0
  DRIFT_OUT=$(mktemp)
  ./node_modules/.bin/prisma migrate diff \
    --from-schema-datasource prisma/schema.prisma \
    --to-schema-datamodel prisma/schema.prisma \
    --exit-code > "$DRIFT_OUT" 2>&1 || DRIFT_RC=$?
  if [ "$DRIFT_RC" -eq 2 ]; then
    echo "⚠️  SCHEMA DRIFT: production DB does not match prisma/schema.prisma:"
    head -n 80 "$DRIFT_OUT"
    echo "   Turn this into a reviewed migration — do NOT db push."
  elif [ "$DRIFT_RC" -ne 0 ]; then
    echo "⚠️  Drift check could not run (exit $DRIFT_RC):"
    head -n 20 "$DRIFT_OUT"
  else
    echo "✅ No schema drift."
  fi
  rm -f "$DRIFT_OUT"

  echo "🧹 Pruning dev dependencies..."
  npm prune --production --legacy-peer-deps

  chown -R hirdanmarketing-api:hirdanmarketing-api /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/
  
  echo "🔄 Restarting Node.js service..."
  if ! { sudo -u hirdanmarketing-api pm2 restart api || pm2 restart api || pm2 restart all; }; then
    echo "❌ pm2 restart failed — the API is still running the previous build."
    exit 1
  fi
  
  echo "✅ Server commands finished!"
EOF

echo "✅ Local deployment successfully finished!"

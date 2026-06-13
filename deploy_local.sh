#!/bin/bash
# Local deployment script to bypass GitHub Action runner timeouts

# Exit on any error
set -e

echo "📦 Building Frontend..."
npm run build

echo "📦 Building Backend..."
cd server
npm install --legacy-peer-deps
npx prisma generate
npm run build
cd ..

echo "🚀 Copying Frontend static files to app.hirdanmarketing.com..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" \
  dist/ root@72.61.192.11:/home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/
   
echo "🚀 Copying Backend compiled files to api.hirdanmarketing.com..."
rsync -avz -e "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519" \
  server/dist/ server/package.json server/package-lock.json server/prisma/ \
  root@72.61.192.11:/home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/

echo "⚙️ Finalizing Server Setup..."
ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519 root@72.61.192.11 << 'EOF'
  chown -R hirdanmarketing-app:hirdanmarketing-app /home/hirdanmarketing-app/htdocs/app.hirdanmarketing.com/
  
  mkdir -p /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public
  ln -sfn /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/uploads \
    /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/public/uploads
  
  cd /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/
  npm install --production --legacy-peer-deps
  ./node_modules/.bin/prisma generate
  
  chown -R hirdanmarketing-api:hirdanmarketing-api /home/hirdanmarketing-api/htdocs/api.hirdanmarketing.com/
  
  echo "🔄 Restarting Node.js service..."
  pm2 restart api || pm2 restart all || echo "Restart failed"
  
  echo "✅ Server commands finished!"
EOF

echo "✅ Local deployment successfully finished!"

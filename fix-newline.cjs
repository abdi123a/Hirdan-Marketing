const fs = require('fs');
const path = require('path');

const files = [
  'projects.routes.ts',
  'team.routes.ts',
  'packages.routes.ts',
  'services.routes.ts',
  'subscriptions.routes.ts',
  'proformas.routes.ts'
];

files.forEach(filename => {
  const filepath = path.join(__dirname, 'server/src/routes', filename);
  if (!fs.existsSync(filepath)) return;
  
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/\\nimport/g, '\nimport');
  
  fs.writeFileSync(filepath, content);
  console.log('Fixed newlines in', filename);
});

const fs = require('fs');
const path = require('path');

const routesDir = path.join(__dirname, 'src/routes');
const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.routes.ts'));

for (const file of files) {
  const filePath = path.join(routesDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Replace req.params.id with req.params.id as string (but don't double replace)
  content = content.replace(/req\.params\.id(?! as string)/g, 'req.params.id as string');
  content = content.replace(/req\.params\.token(?! as string)/g, 'req.params.token as string');
  
  if (file === 'verify.routes.ts') {
    content = content.replace(/record\.invoice/g, '(record as any).invoice');
    content = content.replace(/record\.proforma/g, '(record as any).proforma');
  }
  
  fs.writeFileSync(filePath, content);
}
console.log('Patched routes files');

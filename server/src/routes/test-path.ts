
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const UPLOADS_ROOT = path.join(__dirname, '../../uploads');

console.log('__dirname:', __dirname);
console.log('UPLOADS_ROOT:', UPLOADS_ROOT);

const folder = 'documents';
const filename = 'doc-1774766969124-62437661.pdf';
const safeFilename = path.basename(filename);
const filePath = path.join(UPLOADS_ROOT, folder, safeFilename);

console.log('Target filePath:', filePath);
console.log('Exists:', fs.existsSync(filePath));

if (fs.existsSync(filePath)) {
  const stats = fs.statSync(filePath);
  console.log('Size:', stats.size);
}

const fs = require('fs');
const path = require('path');

const applyToFiles = {
  'projects.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const projectDtoSchema = z.object({
  name: z.string().min(1),
  clientId: z.string().uuid(),
  description: z.string().optional().nullable(),
  status: z.enum(['IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'ARCHIVED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  progress: z.number().int().min(0).max(100).optional(),
  budget: z.number().int().optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  tags: z.string().optional().nullable(),
});
`,
  'team.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const teamDtoSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  role: z.string().min(1),
  department: z.string().optional().nullable(),
  status: z.enum(['ACTIVE', 'OFFLINE', 'AWAY']).optional(),
  avatar: z.string().optional().nullable(),
  hourlyRate: z.number().int().optional().nullable(),
  startDate: z.string().or(z.date()).optional().nullable(),
  bio: z.string().optional().nullable(),
});
`,
  'packages.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const packageDtoSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  price: z.number().int().nonnegative(),
  features: z.string().optional().nullable(),
  type: z.enum(['SERVICE', 'SUBSCRIPTION', 'ONE_TIME']).optional(),
});
`,
  'services.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const serviceDtoSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  basePrice: z.number().int().nonnegative(),
  description: z.string().min(1),
  status: z.enum(['AVAILABLE', 'UNAVAILABLE']).optional(),
});
`,
  'subscriptions.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const subscriptionDtoSchema = z.object({
  clientId: z.string().uuid(),
  packageId: z.string().uuid().optional().nullable(),
  plan: z.string().min(1),
  amount: z.number().int().nonnegative(),
  billingCycle: z.enum(['MONTHLY', 'QUARTERLY', 'ANNUAL']).optional(),
  started: z.string().or(z.date()),
  renewal: z.string().or(z.date()).optional().nullable(),
  status: z.enum(['ACTIVE', 'PAUSED', 'CANCELLED', 'TRIAL']).optional(),
  features: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});
`,
  'proformas.routes.ts': `import { z } from 'zod';
import { validate } from '../middleware/validate.js';

const proformaItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().nonnegative(),
});

const proformaDtoSchema = z.object({
  proformaNumber: z.string().min(1),
  clientId: z.string().uuid(),
  amount: z.number().int().nonnegative(),
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'EXPIRED']).optional(),
  date: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  notes: z.string().optional().nullable(),
  items: z.array(proformaItemSchema).optional(),
});
`
};

Object.entries(applyToFiles).forEach(([filename, schemaCode]) => {
  const filepath = path.join(__dirname, 'server/src/routes', filename);
  if (!fs.existsSync(filepath)) {
    console.log("Not found", filepath);
    return;
  }
  
  let content = fs.readFileSync(filepath, 'utf8');
  
  // Add imports and schema after the existing imports
  if (!content.includes('import { z }')) {
    const importRegex = /^import .* from '.*';\n/gm;
    let match;
    let lastImportIndex = 0;
    while ((match = importRegex.exec(content)) !== null) {
      lastImportIndex = match.index + match[0].length;
    }
    
    content = content.slice(0, lastImportIndex) + '\\n' + schemaCode + content.slice(lastImportIndex);
  }
  
  // Fix POST and PUT routes
  const schemaName = filename.replace('.routes.ts', '').replace('team', 'team').replace('packages', 'package').replace('services', 'service').replace('subscriptions', 'subscription').replace('projects', 'project').replace('proformas', 'proforma') + 'DtoSchema';
  
  content = content.replace(/router\.post\('\/\', requireAdmin, async \(req/g, `router.post('/', requireAdmin, validate({ body: ${schemaName} }), async (req`);
  content = content.replace(/router\.post\('\/\', async \(req/g, `router.post('/', validate({ body: ${schemaName} }), async (req`);
  
  content = content.replace(/router\.put\('\/:id', requireAdmin, async \(req/g, `router.put('/:id', requireAdmin, validate({ body: ${schemaName}.partial() }), async (req`);
  content = content.replace(/router\.put\('\/:id', async \(req/g, `router.put('/:id', validate({ body: ${schemaName}.partial() }), async (req`);

  fs.writeFileSync(filepath, content);
  console.log('Fixed', filename);
});

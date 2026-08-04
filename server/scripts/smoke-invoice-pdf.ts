import { renderInvoicePdf } from '../src/lib/pdf/render-invoice.js';
import { closePdfBrowser } from '../src/lib/pdf/puppeteer-browser.js';
import fs from 'fs';

const buf = await renderInvoicePdf({
  type: 'Invoice',
  id: 'INV-TEST-1',
  date: new Date('2026-08-01'),
  dueDate: new Date('2026-08-15'),
  client: 'Tokka Coffee',
  clientEmail: 'a@b.com',
  clientAddress: 'Djibouti',
  items: [{ description: 'Social media management', quantity: 1, unitPrice: 500 }],
  taxRate: 0,
  status: 'PENDING',
  agency: {
    agencyName: 'Hirdan Marketing',
    primaryColor: '#5A428A',
    currency: 'USD',
    timezone: 'UTC',
    phone: '+252 61 0000000',
    adminEmail: 'info@hirdanmarketing.com',
    website: 'hirdanmarketing.com',
    address: 'Djibouti City',
  },
  verificationToken: 'abc12345',
});
fs.writeFileSync('tmp-invoice-smoke.pdf', buf);
console.log('pdf bytes', buf.length);
await closePdfBrowser();

import fs from 'fs';
import { resolveAssetUrl, buildContentPlanHtml } from '../src/lib/pdf/content-plan-html.js';
import { renderContentPlanPdf } from '../src/lib/pdf/render-content-plan.js';
import { closePdfBrowser } from '../src/lib/pdf/puppeteer-browser.js';

async function main() {
  const files = fs.readdirSync('uploads/branding').filter((f) => /\.(png|jpe?g|webp)$/i.test(f));
  const logo = files[0] ? `/uploads/branding/${files[0]}` : null;
  console.log('testing logo', logo);
  const resolved = resolveAssetUrl(logo);
  console.log('resolved prefix', resolved.slice(0, 40), 'len', resolved.length);

  const buf = await renderContentPlanPdf({
    clientName: 'Tokka Coffee',
    month: 8,
    year: 2026,
    agency: {
      agencyName: 'Hirdan Marketing',
      logo,
      primaryColor: '#5A428A',
      phone: '+253 77646159',
      adminEmail: 'info@hirdanmarketing.com',
      website: 'hirdanmarketing.com',
    },
    posts: [
      {
        id: '1',
        title: 'Test Video',
        status: 'SCHEDULED',
        contentType: 'video',
        shootingDate: '2026-08-03',
        publishDate: '2026-08-05',
        platforms: ['INSTAGRAM', 'FACEBOOK', 'TIKTOK'],
      },
      {
        id: '2',
        title: 'Test',
        status: 'DRAFT',
        contentType: 'graphic',
        shootingDate: null,
        publishDate: '2026-08-13',
        platforms: ['INSTAGRAM', 'X'],
      },
    ],
  });
  fs.writeFileSync('tmp-content-plan-smoke.pdf', buf);
  console.log('PDF bytes', buf.length);

  const html = buildContentPlanHtml({
    clientName: 'Tokka Coffee',
    month: 8,
    year: 2026,
    agency: { agencyName: 'Hirdan', logo, primaryColor: '#5A428A' },
    posts: [
      {
        id: '1',
        title: 'T',
        status: 'DRAFT',
        contentType: 'video',
        platforms: ['INSTAGRAM'],
        publishDate: '2026-08-05',
      },
    ],
  });
  console.log('has data image', html.includes('data:image/'));
  console.log('has file://', html.includes('file://'));
  await closePdfBrowser();
}

main().catch(async (e) => {
  console.error(e);
  await closePdfBrowser();
  process.exit(1);
});

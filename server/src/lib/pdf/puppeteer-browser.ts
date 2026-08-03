import fs from 'fs';
import puppeteer, { type Browser, type LaunchOptions } from 'puppeteer';
import { AppError } from '../errors.js';

let browserPromise: Promise<Browser> | null = null;

const SYSTEM_CHROME_CANDIDATES = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter((p): p is string => Boolean(p));

function resolveSystemChrome(): string | undefined {
  return SYSTEM_CHROME_CANDIDATES.find((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });
}

async function launchBrowser(): Promise<Browser> {
  const sharedArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--font-render-hinting=medium',
  ];

  const attempts: LaunchOptions[] = [
    { headless: true, args: sharedArgs },
    { headless: true, channel: 'chrome', args: sharedArgs },
  ];

  const systemChrome = resolveSystemChrome();
  if (systemChrome) {
    attempts.push({
      headless: true,
      executablePath: systemChrome,
      args: sharedArgs,
    });
  }

  const errors: string[] = [];
  for (const opts of attempts) {
    try {
      return await puppeteer.launch(opts);
    } catch (err) {
      errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  throw new AppError(
    `PDF engine could not start Chrome. Run: cd server && npx puppeteer browsers install chrome. Details: ${errors[0] || 'unknown'}`,
    503,
    true
  );
}

/**
 * Reuse one Chromium instance across PDF exports.
 * Pages are created/closed per request.
 */
export async function getPdfBrowser(): Promise<Browser> {
  if (!browserPromise) {
    browserPromise = launchBrowser().catch((err) => {
      browserPromise = null;
      throw err;
    });
  }
  return browserPromise;
}

export async function closePdfBrowser(): Promise<void> {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch {
    // ignore shutdown errors
  } finally {
    browserPromise = null;
  }
}

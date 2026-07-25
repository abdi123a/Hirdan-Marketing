// ─────────────────────────────────────────────────────────────────────────────
// TikTok Studio export importer.
//
// TikTok's public API only exposes follower counts to third-party apps, but
// creators can export the rest from TikTok Studio → Analytics → "Download data"
// as XLSX. This module parses those files and maps them into our normal analytics
// tables so the dashboard renders TikTok like any other platform — reach, video
// views, profile visits, per-video engagement, demographics and an active-times
// heatmap the API never provides.
//
// Files are auto-detected by header signature (not filename), so the user can
// upload any subset in any order. Everything upserts idempotently, keyed by
// (account,date) / (account,kind,label) / (account,weekday,hour) / (account,
// videoId) — re-importing a fresh export just updates in place.
// ─────────────────────────────────────────────────────────────────────────────

import { Readable } from 'stream';
import ExcelJS from 'exceljs';
import { prisma } from '../../prisma.js';

export type TikTokFileType =
  | 'followerHistory'
  | 'overview'
  | 'viewers'
  | 'content'
  | 'followerGender'
  | 'followerTerritories'
  | 'followerActivity'
  | 'unknown';

export interface ImportFileResult {
  filename: string;
  type: TikTokFileType;
  rows: number;
  warning?: string;
}

export interface ImportSummary {
  accountId: string;
  importedAt: string;
  files: ImportFileResult[];
  dailyDates: number;
  demographics: number;
  activityCells: number;
  videos: number;
  warnings: string[];
}

// ── low-level helpers ────────────────────────────────────────────────────────

const MONTHS: Record<string, number> = {
  january: 0, february: 1, march: 2, april: 3, may: 4, june: 5,
  july: 6, august: 7, september: 8, october: 9, november: 10, december: 11,
};

/** Parse a year-less "June 24" against a reference date (most recent past occurrence). */
export function parseMonthDay(input: unknown, ref: Date): Date | null {
  if (input == null) return null;
  const s = String(input).trim();
  const m = s.match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if (!m) {
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  }
  const mon = MONTHS[m[1].toLowerCase()];
  if (mon == null) return null;
  const day = parseInt(m[2], 10);
  let year = ref.getUTCFullYear();
  let cand = new Date(Date.UTC(year, mon, day));
  // If that lands in the future (more than a day ahead of ref), it must be last year.
  if (cand.getTime() > ref.getTime() + 86400000) {
    cand = new Date(Date.UTC(year - 1, mon, day));
  }
  return cand;
}

/** TikTok video id from a video link. */
export function videoIdFromLink(link: unknown): string | null {
  if (!link) return null;
  const m = String(link).match(/\/video\/(\d+)/);
  return m ? m[1] : null;
}

/** TikTok ids embed their creation time in the top 32 bits (Unix seconds). */
export function videoIdToDate(id: string): Date | null {
  try {
    const secs = Number(BigInt(id) >> 32n);
    if (secs > 1_000_000_000 && secs < 4_000_000_000) return new Date(secs * 1000);
  } catch { /* not a bigint */ }
  return null;
}

function safeInt(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return null;
  const n = parseInt(s.replace(/[, ]/g, ''), 10);
  return isNaN(n) ? null : n;
}

function safeFloat(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'undefined') return null;
  const n = parseFloat(s.replace(/[, %]/g, ''));
  return isNaN(n) ? null : n;
}

// ── parsing + detection ──────────────────────────────────────────────────────

interface ParsedSheet {
  sheetName: string;
  header: string[];
  rows: any[][];
}

/**
 * Flatten one ExcelJS cell to the plain string/null the row mappers expect.
 *
 * The previous `xlsx` reader was called with `raw: false`, so every cell arrived
 * pre-stringified. ExcelJS instead returns typed values, including a few shapes
 * that would stringify to "[object Object]" and silently break parsing:
 *   - hyperlink cells  → { text, hyperlink }  (the "Video link" column)
 *   - rich text        → { richText: [{ text }] }
 *   - formula cells    → { formula, result }
 *   - error cells      → { error: '#N/A' }
 * Dates and numbers are passed through as-is; the downstream safeInt/safeFloat/
 * parseMonthDay helpers already coerce via String().
 */
function cellValue(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, any>;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t?.text ?? '').join('');
    if ('hyperlink' in o) return o.text ?? o.hyperlink ?? null;
    if ('result' in o) return cellValue(o.result);
    if ('error' in o) return null;
    if ('text' in o) return o.text;
  }
  return v;
}

/** Read the first worksheet of an .xlsx or .csv export into header + rows. */
export async function parseWorkbook(buffer: Buffer, filename = ''): Promise<ParsedSheet> {
  // ExcelJS covers .xlsx and .csv but not the legacy binary .xls (BIFF) format.
  // Fail with an actionable message rather than a parser stack trace — the caller
  // turns this into a per-file warning so the rest of the upload still imports.
  if (/\.xls$/i.test(filename)) {
    throw new Error('Legacy .xls files are not supported — re-export from TikTok Studio as .xlsx or .csv');
  }

  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    // `map: v => v` disables ExcelJS's value coercion so cells stay raw strings,
    // matching the old reader. Without it "+12" becomes the number 12 and
    // date-like columns get reinterpreted, which the row mappers don't expect.
    await wb.csv.read(Readable.from(buffer), { map: (value: string) => value } as any);
  } else {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File contains no worksheets');

  // getSheetValues() is 1-indexed and leaves a hole at [0]; same for each row.
  const sheetRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    sheetRows.push((Array.isArray(values) ? values.slice(1) : []).map(cellValue));
  });

  const header = (sheetRows[0] || []).map((c) => String(c ?? '').trim());
  const rows = sheetRows.slice(1) as any[][];
  return { sheetName: ws.name, header, rows };
}

function has(header: string[], ...cols: string[]): boolean {
  const lower = header.map(h => h.toLowerCase());
  return cols.every(c => lower.some(h => h.includes(c.toLowerCase())));
}

export function detectType(sheet: ParsedSheet): TikTokFileType {
  const name = sheet.sheetName.toLowerCase().replace(/\s+/g, '');
  const h = sheet.header;
  // Prefer header signatures (robust to renamed sheets), fall back to sheet name.
  if (has(h, 'date', 'followers', 'difference')) return 'followerHistory';
  if (has(h, 'gender', 'distribution')) return 'followerGender';
  if (has(h, 'top territories', 'distribution') || (has(h, 'distribution') && name.includes('territ'))) return 'followerTerritories';
  if (has(h, 'date', 'hour', 'active followers')) return 'followerActivity';
  if (has(h, 'video views', 'profile views', 'likes')) return 'overview';
  if (has(h, 'video link', 'total views')) return 'content';
  if (has(h, 'total viewers', 'new viewers', 'returning viewers')) return 'viewers';
  // sheet-name fallbacks
  if (name.includes('followerhistory')) return 'followerHistory';
  if (name.includes('followergender')) return 'followerGender';
  if (name.includes('territ')) return 'followerTerritories';
  if (name.includes('followeractivity')) return 'followerActivity';
  if (name.includes('overview')) return 'overview';
  if (name.includes('content')) return 'content';
  if (name.includes('viewer')) return 'viewers';
  return 'unknown';
}

// ── daily-metric accumulator ─────────────────────────────────────────────────

interface DailyAcc {
  date: Date;
  followers?: number | null;
  reach?: number | null;
  impressions?: number | null;
  videoViews?: number | null;
  profileVisits?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  newViewers?: number | null;
  returningViewers?: number | null;
}

function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

// ── main entry ───────────────────────────────────────────────────────────────

export async function importTikTokStudioFiles(
  accountId: string,
  files: { originalname: string; buffer: Buffer }[],
): Promise<ImportSummary> {
  const now = new Date();
  const fileResults: ImportFileResult[] = [];
  const warnings: string[] = [];

  const daily = new Map<string, DailyAcc>();
  const gender: { label: string; fraction: number }[] = [];
  const country: { label: string; fraction: number }[] = [];
  const activityAcc = new Map<string, { sum: number; count: number; weekday: number; hour: number }>();
  const videos: {
    externalId: string; title: string | null; link: string | null; postedAt: Date | null;
    likes: number | null; comments: number | null; shares: number | null; views: number | null;
  }[] = [];

  const upsertDaily = (d: Date, patch: Partial<DailyAcc>) => {
    const k = dateKey(d);
    const cur = daily.get(k) || { date: d };
    daily.set(k, { ...cur, ...patch, date: d });
  };

  for (const file of files) {
    let sheet: ParsedSheet;
    try {
      sheet = await parseWorkbook(file.buffer, file.originalname);
    } catch (e: any) {
      fileResults.push({ filename: file.originalname, type: 'unknown', rows: 0, warning: `Could not read file: ${e.message}` });
      warnings.push(`${file.originalname}: could not read (${e.message})`);
      continue;
    }
    const type = detectType(sheet);
    let count = 0;

    try {
      switch (type) {
        case 'followerHistory':
          for (const r of sheet.rows) {
            const d = parseMonthDay(r[0], now);
            if (!d) continue;
            upsertDaily(d, { followers: safeInt(r[1]) });
            count++;
          }
          break;

        case 'overview':
          for (const r of sheet.rows) {
            const d = parseMonthDay(r[0], now);
            if (!d) continue;
            const videoViews = safeInt(r[1]);
            upsertDaily(d, {
              videoViews,
              impressions: videoViews, // TikTok's closest impressions proxy
              profileVisits: safeInt(r[2]),
              likes: safeInt(r[3]),
              comments: safeInt(r[4]),
              shares: safeInt(r[5]),
            });
            count++;
          }
          break;

        case 'viewers':
          for (const r of sheet.rows) {
            const d = parseMonthDay(r[0], now);
            if (!d) continue;
            upsertDaily(d, {
              reach: safeInt(r[1]),      // Total Viewers ≈ reach
              newViewers: safeInt(r[2]),
              returningViewers: safeInt(r[3]),
            });
            count++;
          }
          break;

        case 'followerGender':
          for (const r of sheet.rows) {
            const label = r[0] ? String(r[0]).trim() : null;
            const frac = safeFloat(r[1]);
            if (!label || frac == null) continue;
            gender.push({ label, fraction: frac });
            count++;
          }
          break;

        case 'followerTerritories':
          for (const r of sheet.rows) {
            const label = r[0] ? String(r[0]).trim() : null;
            const frac = safeFloat(r[1]);
            if (!label || frac == null) continue;
            country.push({ label, fraction: frac });
            count++;
          }
          break;

        case 'followerActivity':
          for (const r of sheet.rows) {
            const d = parseMonthDay(r[0], now);
            const hour = safeInt(r[1]);
            const active = safeInt(r[2]);
            if (!d || hour == null || active == null) continue;
            const weekday = d.getUTCDay();
            const k = `${weekday}_${hour}`;
            const cur = activityAcc.get(k) || { sum: 0, count: 0, weekday, hour };
            cur.sum += active; cur.count += 1;
            activityAcc.set(k, cur);
            count++;
          }
          break;

        case 'content':
          for (const r of sheet.rows) {
            // columns: Time, Video title, Video link, Post time, likes, comments, shares, views
            const link = r[2] ? String(r[2]).trim() : null;
            const externalId = videoIdFromLink(link);
            if (!externalId) continue;
            const postedAt = videoIdToDate(externalId) || parseMonthDay(r[3], now);
            videos.push({
              externalId,
              title: r[1] ? String(r[1]).trim() : null,
              link,
              postedAt,
              likes: safeInt(r[4]),
              comments: safeInt(r[5]),
              shares: safeInt(r[6]),
              views: safeInt(r[7]),
            });
            count++;
          }
          break;

        default:
          fileResults.push({ filename: file.originalname, type, rows: 0, warning: 'Unrecognized TikTok export file — skipped' });
          warnings.push(`${file.originalname}: unrecognized file, skipped`);
          continue;
      }
    } catch (e: any) {
      fileResults.push({ filename: file.originalname, type, rows: count, warning: `Partial parse: ${e.message}` });
      warnings.push(`${file.originalname}: ${e.message}`);
      continue;
    }

    fileResults.push({ filename: file.originalname, type, rows: count });
  }

  // ── persist ──
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  // Daily metrics: upsert per date, computing a consistent engagement rate.
  for (const acc of daily.values()) {
    const engBase = acc.reach ?? acc.impressions ?? null;
    const engSum = (acc.likes ?? 0) + (acc.comments ?? 0) + (acc.shares ?? 0);
    const engagementRate =
      engBase && engBase > 0 && (acc.likes != null || acc.comments != null || acc.shares != null)
        ? Number(((engSum / engBase) * 100).toFixed(2))
        : null;

    // Only set columns this import actually provided (don't null out existing data).
    const data: any = { source: 'import' };
    for (const key of ['followers', 'reach', 'impressions', 'videoViews', 'profileVisits', 'likes', 'comments', 'shares', 'newViewers', 'returningViewers'] as const) {
      if (acc[key] != null) data[key] = acc[key];
    }
    if (engagementRate != null) data.engagementRate = engagementRate;

    await prisma.accountInsightDaily.upsert({
      where: { socialAccountId_date: { socialAccountId: accountId, date: acc.date } },
      create: { socialAccountId: accountId, date: acc.date, ...data },
      update: data,
    });
  }

  // Demographics: full replace per kind so removed labels disappear.
  if (gender.length) {
    await prisma.accountDemographic.deleteMany({ where: { socialAccountId: accountId, kind: 'gender' } });
    await prisma.accountDemographic.createMany({
      data: gender.map(g => ({ socialAccountId: accountId, kind: 'gender', label: g.label, fraction: g.fraction, source: 'import' })),
    });
  }
  if (country.length) {
    await prisma.accountDemographic.deleteMany({ where: { socialAccountId: accountId, kind: 'country' } });
    await prisma.accountDemographic.createMany({
      data: country.map(c => ({ socialAccountId: accountId, kind: 'country', label: c.label, fraction: c.fraction, source: 'import' })),
    });
  }

  // Activity heatmap: full replace.
  const activityCells = activityAcc.size;
  if (activityCells) {
    await prisma.accountActivity.deleteMany({ where: { socialAccountId: accountId } });
    await prisma.accountActivity.createMany({
      data: Array.from(activityAcc.values()).map(a => ({
        socialAccountId: accountId,
        weekday: a.weekday,
        hour: a.hour,
        activeFollowers: Math.round(a.sum / a.count),
        source: 'import',
      })),
    });
  }

  // Videos: upsert per external id.
  for (const v of videos) {
    await prisma.importedPost.upsert({
      where: { socialAccountId_externalId: { socialAccountId: accountId, externalId: v.externalId } },
      create: {
        socialAccountId: accountId, platform: 'tiktok', externalId: v.externalId,
        title: v.title, link: v.link, postedAt: v.postedAt,
        likes: v.likes, comments: v.comments, shares: v.shares, views: v.views,
        source: 'import', importedAt: now,
      },
      update: {
        title: v.title, link: v.link, postedAt: v.postedAt,
        likes: v.likes, comments: v.comments, shares: v.shares, views: v.views,
        importedAt: now,
      },
    });
  }

  await prisma.socialAccount.update({ where: { id: accountId }, data: { lastImportedAt: now } });

  return {
    accountId,
    importedAt: now.toISOString(),
    files: fileResults,
    dailyDates: daily.size,
    demographics: gender.length + country.length,
    activityCells,
    videos: videos.length,
    warnings,
  };
}

import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { parseTikTokStudioFiles } from './tiktok-import.service.js';

// The importer reaches prisma only in the persist step, which these tests never
// call; importing the module is enough to pull prisma in, and that is fine —
// the client is lazy until a query runs.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const label = (d: Date) => `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCDate()}`;
const addDays = (d: Date, n: number) => new Date(d.getTime() + n * 86400000);
const iso = (d: Date) => d.toISOString().slice(0, 10);

async function xlsx(sheetName: string, header: string[], rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheetName);
  ws.addRow(header);
  for (const r of rows) ws.addRow(r);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

// Shaped like the real papparoti.djibouti export of 2026-08-22: 365 daily rows,
// oldest first, year-less labels, and — the case that broke production — the
// account's biggest days ever sitting in the first rows, a year before the
// export. The old cell-by-cell dating stamped those rows with the current year
// and tripled the 30-day KPIs.
const NOW = new Date('2026-08-22T15:00:00Z');
const LAST_DAY = new Date('2026-08-20T00:00:00Z');
const DAYS = 365;
const SPIKE = [218266, 87455, 46302]; // video views on 2025-08-21..23

function overviewRows(): unknown[][] {
  return Array.from({ length: DAYS }, (_, i) => {
    const d = addDays(LAST_DAY, i - (DAYS - 1));
    const views = SPIKE[i] ?? 2500;
    return [label(d), String(views), String(Math.round(views / 70)), '100', '10', '5'];
  });
}

const OVERVIEW_HEADER = ['Date', 'Video views', 'Profile views', 'Likes', 'Comments', 'Shares'];
const VIEWERS_HEADER = ['Date', 'Total viewers', 'New viewers', 'Returning viewers'];
const FOLLOWERS_HEADER = ['Date', 'Followers', 'Difference'];

describe('parseTikTokStudioFiles — dating a full-year export', () => {
  it('keeps the year-old spike a year old and out of the current 30-day window', async () => {
    const buffer = await xlsx('Overview', OVERVIEW_HEADER, overviewRows());
    const parsed = await parseTikTokStudioFiles([{ originalname: 'Overview.xlsx', buffer }], NOW);

    expect(parsed.fileResults).toEqual([{ filename: 'Overview.xlsx', type: 'overview', rows: DAYS }]);
    expect(parsed.warnings).toEqual([]);
    expect(parsed.futureRows).toBe(0);
    expect(parsed.daily.size).toBe(DAYS);

    // The spike rows carry last year's date…
    expect(parsed.daily.get('2025-08-21')?.videoViews).toBe(SPIKE[0]);
    expect(parsed.daily.get('2025-08-22')?.videoViews).toBe(SPIKE[1]);
    expect(parsed.daily.get('2025-08-23')?.videoViews).toBe(SPIKE[2]);
    // …and nothing at all is dated this week beyond the export's last day.
    expect(parsed.daily.has('2026-08-21')).toBe(false);
    expect(parsed.daily.has('2026-08-22')).toBe(false);
    expect(parsed.daily.has('2026-08-23')).toBe(false);

    // The reconciliation the dashboard depends on: last 30 days summed straight
    // from the parsed rows equals 30 ordinary days, with no spike in it.
    const since = addDays(LAST_DAY, -29);
    let views = 0;
    for (const row of parsed.daily.values()) {
      if (row.date >= since && row.date <= LAST_DAY) views += row.videoViews ?? 0;
    }
    expect(views).toBe(30 * 2500);
  });

  it('lines up the three daily files on the same dates so each day gets one merged row', async () => {
    const days = Array.from({ length: DAYS }, (_, i) => addDays(LAST_DAY, i - (DAYS - 1)));
    const files = [
      { originalname: 'Overview.xlsx', buffer: await xlsx('Overview', OVERVIEW_HEADER, overviewRows()) },
      {
        originalname: 'Viewers.xlsx',
        buffer: await xlsx('Viewers', VIEWERS_HEADER, days.map(d => [label(d), '1500', '900', '600'])),
      },
      {
        originalname: 'FollowerHistory.xlsx',
        buffer: await xlsx('FollowerHistory', FOLLOWERS_HEADER, days.map((d, i) => [label(d), String(30000 + i * 25), '25'])),
      },
    ];
    const parsed = await parseTikTokStudioFiles(files, NOW);

    expect(parsed.daily.size).toBe(DAYS);
    const first = parsed.daily.get(iso(days[0]))!;
    expect(first).toMatchObject({ videoViews: SPIKE[0], reach: 1500, followers: 30000 });
    const last = parsed.daily.get(iso(LAST_DAY))!;
    expect(last).toMatchObject({ videoViews: 2500, reach: 1500, followers: 30000 + (DAYS - 1) * 25 });
  });
});

describe('parseTikTokStudioFiles — future-date guard', () => {
  it('refuses daily rows dated after the import and says so, instead of writing them', async () => {
    // Dates that carry a year cannot be re-anchored, so a file dated next month
    // is the simplest way to produce rows the guard must stop.
    const rows = [
      ['2026-08-19', '100', '5', '1', '0', '0'],
      ['2026-08-20', '100', '5', '1', '0', '0'],
      ['2026-09-05', '999999', '5', '1', '0', '0'],
      ['2026-09-06', '999999', '5', '1', '0', '0'],
    ];
    const buffer = await xlsx('Overview', OVERVIEW_HEADER, rows);
    const parsed = await parseTikTokStudioFiles([{ originalname: 'Overview.xlsx', buffer }], NOW);

    expect(parsed.futureRows).toBe(2);
    expect(parsed.daily.size).toBe(2);
    expect(parsed.daily.has('2026-09-05')).toBe(false);
    expect(parsed.fileResults[0]).toMatchObject({ type: 'overview', rows: 2 });
    expect(parsed.warnings).toHaveLength(1);
    expect(parsed.warnings[0]).toMatch(/2 daily row\(s\) were dated after today and skipped/);
  });

  it('tolerates the export day itself (a day of slack for timezones)', async () => {
    const rows = [['2026-08-22', '100', '5', '1', '0', '0'], ['2026-08-23', '100', '5', '1', '0', '0']];
    const buffer = await xlsx('Overview', OVERVIEW_HEADER, rows);
    const parsed = await parseTikTokStudioFiles([{ originalname: 'Overview.xlsx', buffer }], NOW);
    expect(parsed.futureRows).toBe(0);
    expect(parsed.daily.size).toBe(2);
  });
});

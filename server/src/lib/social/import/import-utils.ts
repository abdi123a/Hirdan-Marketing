// Shared parsing helpers for the platform export importers.
//
// Extracted from the TikTok importer when Instagram/Facebook/YouTube gained
// their own importers — the cell-flattening and number-coercion rules are the
// same everywhere, only the file layouts differ.

import ExcelJS from 'exceljs';
import { Readable } from 'stream';

export interface ParsedSheet {
  sheetName: string;
  header: string[];
  rows: any[][];
}

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
  const year = ref.getUTCFullYear();
  let cand = new Date(Date.UTC(year, mon, day));
  // If that lands in the future (more than a day ahead of ref), it must be last year.
  if (cand.getTime() > ref.getTime() + 86400000) {
    cand = new Date(Date.UTC(year - 1, mon, day));
  }
  return cand;
}

/**
 * Parse an ISO-ish timestamp to a UTC midnight date.
 *
 * Exports write local wall-clock stamps with no zone suffix ("2026-07-18T00:00:00").
 * `new Date()` reads those as *local* time, so on a server east of UTC every row
 * would shift back a day. Bare timestamps are therefore pinned to UTC explicitly.
 */
export function parseIsoDate(input: unknown): Date | null {
  if (input == null) return null;
  const s = String(input).trim().replace(/^"|"$/g, '');
  if (!s) return null;

  const bare = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+)?$/);
  if (bare) {
    return new Date(Date.UTC(Number(bare[1]), Number(bare[2]) - 1, Number(bare[3])));
  }

  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/** Percentages divided by 100 land on values like 0.7140000000000001; trim the noise. */
export function toFraction(pct: number): number {
  return Math.round((pct / 100) * 1e6) / 1e6;
}

export function safeInt(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'undefined' || s.toLowerCase() === 'null') return null;
  const n = parseInt(s.replace(/[, ]/g, ''), 10);
  return isNaN(n) ? null : n;
}

export function safeFloat(v: unknown): number | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s || s.toLowerCase() === 'undefined') return null;
  const n = parseFloat(s.replace(/[, %]/g, ''));
  return isNaN(n) ? null : n;
}

export function dateKey(d: Date): string {
  return d.toISOString().split('T')[0];
}

/** True when every one of `cols` appears somewhere in the header. */
export function has(header: string[], ...cols: string[]): boolean {
  const lower = header.map(h => h.toLowerCase());
  return cols.every(c => lower.some(h => h.includes(c.toLowerCase())));
}

/**
 * Flatten one ExcelJS cell to the plain string/null the row mappers expect.
 *
 * ExcelJS returns typed values, including shapes that would stringify to
 * "[object Object]" and silently break parsing:
 *   - hyperlink cells  → { text, hyperlink }
 *   - rich text        → { richText: [{ text }] }
 *   - formula cells    → { formula, result }
 *   - error cells      → { error: '#N/A' }
 */
export function cellValue(v: unknown): unknown {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    const o = v as Record<string, any>;
    if (Array.isArray(o.richText)) return o.richText.map((t: any) => t?.text ?? '').join('');
    if ('hyperlink' in o) {
      // Prefer whichever side actually carries a URL. Exports sometimes put a
      // truncated display label in `text`, and taking it blindly loses the post
      // id that the content import keys on.
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (/^https?:\/\//i.test(text)) return text;
      return o.hyperlink ?? (text || null);
    }
    if ('result' in o) return cellValue(o.result);
    if ('error' in o) return null;
    if ('text' in o) return o.text;
  }
  return v;
}

/**
 * Decode a CSV buffer to text, honouring the encoding its BOM declares.
 *
 * Meta exports its analytics CSVs as UTF-16LE. Reading those as UTF-8 yields
 * NUL-separated mojibake that parses into garbage rather than failing loudly,
 * so the encoding has to be sniffed rather than assumed.
 */
export function decodeCsvBuffer(buffer: Buffer): string {
  if (buffer.length >= 2) {
    if (buffer[0] === 0xff && buffer[1] === 0xfe) return buffer.subarray(2).toString('utf16le');
    if (buffer[0] === 0xfe && buffer[1] === 0xff) {
      // UTF-16BE: swap byte pairs, then decode as LE.
      const swapped = Buffer.from(buffer.subarray(2));
      swapped.swap16();
      return swapped.toString('utf16le');
    }
  }
  return buffer.toString('utf8').replace(/^﻿/, '');
}

/** Split one CSV line into fields, honouring quotes and escaped quotes. */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') { cur += '"'; i++; }
        else inQuotes = false;
      } else cur += ch;
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      out.push(cur); cur = '';
    } else cur += ch;
  }
  out.push(cur);
  return out.map(s => s.trim());
}

/** Read the first worksheet of an .xlsx or .csv export into header + rows. */
export async function parseWorkbook(buffer: Buffer, filename = ''): Promise<ParsedSheet> {
  // ExcelJS covers .xlsx and .csv but not the legacy binary .xls (BIFF) format.
  // Fail with an actionable message rather than a parser stack trace — the caller
  // turns this into a per-file warning so the rest of the upload still imports.
  if (/\.xls$/i.test(filename)) {
    throw new Error('Legacy .xls files are not supported — re-export as .xlsx or .csv');
  }

  const wb = new ExcelJS.Workbook();
  if (/\.csv$/i.test(filename)) {
    // `map: v => v` disables ExcelJS's value coercion so cells stay raw strings.
    // Without it "+12" becomes the number 12 and date-like columns get
    // reinterpreted, which the row mappers don't expect.
    const text = decodeCsvBuffer(buffer);
    await wb.csv.read(Readable.from(text), { map: (value: string) => value } as any);
  } else {
    await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  }

  const ws = wb.worksheets[0];
  if (!ws) throw new Error('File contains no worksheets');

  // Row values are 1-indexed and leave a hole at [0].
  const sheetRows: unknown[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const values = row.values as unknown[];
    sheetRows.push((Array.isArray(values) ? values.slice(1) : []).map(cellValue));
  });

  const header = (sheetRows[0] || []).map((c) => String(c ?? '').trim());
  const rows = sheetRows.slice(1) as any[][];
  return { sheetName: ws.name, header, rows };
}

// ── shared daily-metric accumulator ──────────────────────────────────────────

export interface DailyAcc {
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
  newFollows?: number | null;
  unfollows?: number | null;
}

export const DAILY_METRIC_KEYS = [
  'followers', 'reach', 'impressions', 'videoViews', 'profileVisits',
  'likes', 'comments', 'shares', 'newViewers', 'returningViewers',
  'newFollows', 'unfollows',
] as const;

/**
 * Build the Prisma payload for one day, skipping metrics this import didn't
 * provide so a partial upload never nulls out data another file already set.
 */
export function buildDailyData(acc: DailyAcc): Record<string, unknown> {
  const engBase = acc.reach ?? acc.impressions ?? null;
  const engSum = (acc.likes ?? 0) + (acc.comments ?? 0) + (acc.shares ?? 0);
  const engagementRate =
    engBase && engBase > 0 && (acc.likes != null || acc.comments != null || acc.shares != null)
      ? Number(((engSum / engBase) * 100).toFixed(2))
      : null;

  const data: Record<string, unknown> = { source: 'import' };
  for (const key of DAILY_METRIC_KEYS) {
    if (acc[key] != null) data[key] = acc[key];
  }
  if (engagementRate != null) data.engagementRate = engagementRate;
  return data;
}

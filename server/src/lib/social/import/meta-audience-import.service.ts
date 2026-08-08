// ─────────────────────────────────────────────────────────────────────────────
// Meta (Instagram / Facebook) analytics export importer.
//
// Meta gates audience demographics behind an advanced-access review we don't
// have, so age/gender/location never arrive over the API. They are, however,
// downloadable from Instagram Insights / Meta Business Suite as CSV — this
// module parses those files into the same tables the live sync writes to, so
// the dashboard and the monthly report render them like any other metric.
//
// The format is unlike TikTok's single-table export: one file holds several
// stacked, blank-line-separated sections, each with its own shape, and Meta
// writes it as UTF-16LE. Sections are matched by their title row, so any subset
// in any order imports fine.
//
//   "Top countries"   label row, then a percentage row  (horizontal)
//   "Top cities"      label row, then a percentage row  (horizontal)
//   "Age & gender"    header ["", "Women", "Men"], then one row per bracket
//   "Follows"         header ["Date", "Primary"], then one row per day
//
// Everything upserts idempotently, so re-importing a fresh export updates in
// place rather than duplicating.
// ─────────────────────────────────────────────────────────────────────────────

import { prisma } from '../../prisma.js';
import {
  type DailyAcc,
  buildDailyData,
  dateKey,
  decodeCsvBuffer,
  parseIsoDate,
  safeFloat,
  safeInt,
  splitCsvLine,
  toFraction,
} from './import-utils.js';

export type MetaSectionType = 'topCountries' | 'topCities' | 'ageGender' | 'follows' | 'unknown';

export interface MetaImportFileResult {
  filename: string;
  sections: MetaSectionType[];
  rows: number;
  warning?: string;
}

export interface MetaImportSummary {
  accountId: string;
  platform: string;
  importedAt: string;
  files: MetaImportFileResult[];
  dailyDates: number;
  demographics: number;
  warnings: string[];
}

interface RawSection {
  title: string;
  rows: string[][];
}

/**
 * Split the export into its blank-line-separated sections.
 *
 * A section starts at a single-cell row (its title) and runs until the next
 * blank line. Meta's leading `sep=,` directive is skipped.
 */
export function splitSections(text: string): RawSection[] {
  const lines = text.split(/\r?\n/);
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { current = null; continue; }
    if (/^sep\s*=/i.test(line)) continue;

    const cells = splitCsvLine(line);
    const nonEmpty = cells.filter(c => c !== '');

    if (!current) {
      // First line of a block is its title when it holds a single value.
      if (nonEmpty.length === 1) {
        current = { title: nonEmpty[0], rows: [] };
        sections.push(current);
      } else {
        current = { title: '', rows: [cells] };
        sections.push(current);
      }
      continue;
    }
    current.rows.push(cells);
  }

  return sections;
}

function classify(title: string): MetaSectionType {
  const t = title.toLowerCase();
  if (t.includes('countr')) return 'topCountries';
  if (t.includes('cit')) return 'topCities';
  if (t.includes('age') && t.includes('gender')) return 'ageGender';
  if (t.includes('age')) return 'ageGender';
  if (t === 'follows' || t.includes('follow')) return 'follows';
  return 'unknown';
}

/**
 * Read a "labels row then percentages row" block.
 *
 * Meta writes these horizontally, so the two rows are positional pairs. Rows
 * are zipped by index and any pair missing either half is dropped.
 */
export function parseHorizontalShare(rows: string[][]): { label: string; fraction: number }[] {
  if (rows.length < 2) return [];
  const labels = rows[0];
  const values = rows[1];
  const out: { label: string; fraction: number }[] = [];
  for (let i = 0; i < labels.length; i++) {
    const label = (labels[i] || '').trim();
    const pct = safeFloat(values[i]);
    if (!label || pct == null) continue;
    // Stored as a 0..1 fraction, matching AccountDemographic's contract.
    out.push({ label, fraction: toFraction(pct) });
  }
  return out;
}

/**
 * Read the age × gender cross-tab into the two flat marginals we store.
 *
 * AccountDemographic holds one fraction per (kind,label), so the cross-tab is
 * collapsed twice: summed across genders for the age split, and down the
 * columns for the gender split. Both come from the same cells, so they stay
 * mutually consistent.
 */
export function parseAgeGender(rows: string[][]): {
  age: { label: string; fraction: number }[];
  gender: { label: string; fraction: number }[];
} {
  if (rows.length < 2) return { age: [], gender: [] };
  const header = rows[0].map(h => h.trim());
  // Column 0 is the bracket label; the rest are gender columns.
  const genderCols = header
    .map((h, i) => ({ name: h, index: i }))
    .filter(c => c.index > 0 && c.name !== '');

  const age: { label: string; fraction: number }[] = [];
  const genderTotals = new Map<string, number>();

  for (const row of rows.slice(1)) {
    const bracket = (row[0] || '').trim();
    if (!bracket) continue;
    let bracketTotal = 0;
    let sawValue = false;
    for (const col of genderCols) {
      const pct = safeFloat(row[col.index]);
      if (pct == null) continue;
      sawValue = true;
      bracketTotal += pct;
      genderTotals.set(col.name, (genderTotals.get(col.name) ?? 0) + pct);
    }
    if (sawValue) age.push({ label: bracket, fraction: toFraction(bracketTotal) });
  }

  const gender = Array.from(genderTotals.entries()).map(([label, pct]) => ({
    label,
    fraction: toFraction(pct),
  }));

  return { age, gender };
}

/** Read the daily "Follows" block (Date, count-gained-that-day). */
export function parseFollows(rows: string[][]): { date: Date; follows: number }[] {
  const out: { date: Date; follows: number }[] = [];
  for (const row of rows) {
    const first = (row[0] || '').trim();
    // Skip the header row.
    if (/^date$/i.test(first)) continue;
    const date = parseIsoDate(first);
    const follows = safeInt(row[1]);
    if (!date || follows == null) continue;
    out.push({ date, follows });
  }
  return out;
}

export async function importMetaAudienceFiles(
  accountId: string,
  files: { originalname: string; buffer: Buffer }[],
): Promise<MetaImportSummary> {
  const now = new Date();
  const fileResults: MetaImportFileResult[] = [];
  const warnings: string[] = [];

  const daily = new Map<string, DailyAcc>();
  const demographics: { kind: string; label: string; fraction: number }[] = [];
  const seenKinds = new Set<string>();

  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  for (const file of files) {
    let sections: RawSection[];
    try {
      // These exports are CSV-only; an .xlsx would come through a different path.
      sections = splitSections(decodeCsvBuffer(file.buffer));
    } catch (e: any) {
      fileResults.push({ filename: file.originalname, sections: [], rows: 0, warning: `Could not read file: ${e.message}` });
      warnings.push(`${file.originalname}: could not read (${e.message})`);
      continue;
    }

    const found: MetaSectionType[] = [];
    let rowCount = 0;

    for (const section of sections) {
      const type = classify(section.title);
      switch (type) {
        case 'topCountries': {
          const entries = parseHorizontalShare(section.rows);
          for (const e of entries) demographics.push({ kind: 'country', ...e });
          if (entries.length) { seenKinds.add('country'); found.push(type); rowCount += entries.length; }
          break;
        }
        case 'topCities': {
          const entries = parseHorizontalShare(section.rows);
          for (const e of entries) demographics.push({ kind: 'city', ...e });
          if (entries.length) { seenKinds.add('city'); found.push(type); rowCount += entries.length; }
          break;
        }
        case 'ageGender': {
          const { age, gender } = parseAgeGender(section.rows);
          for (const e of age) demographics.push({ kind: 'age', ...e });
          for (const e of gender) demographics.push({ kind: 'gender', ...e });
          if (age.length) seenKinds.add('age');
          if (gender.length) seenKinds.add('gender');
          if (age.length || gender.length) { found.push(type); rowCount += age.length + gender.length; }
          break;
        }
        case 'follows': {
          const entries = parseFollows(section.rows);
          for (const e of entries) {
            const k = dateKey(e.date);
            const cur = daily.get(k) || { date: e.date };
            daily.set(k, { ...cur, newFollows: e.follows, date: e.date });
          }
          if (entries.length) { found.push(type); rowCount += entries.length; }
          break;
        }
        default:
          break;
      }
    }

    if (found.length === 0) {
      fileResults.push({ filename: file.originalname, sections: [], rows: 0, warning: 'Unrecognized export file — skipped' });
      warnings.push(`${file.originalname}: unrecognized file, skipped`);
      continue;
    }

    fileResults.push({ filename: file.originalname, sections: found, rows: rowCount });
  }

  // ── persist ──
  for (const acc of daily.values()) {
    const data = buildDailyData(acc);
    await prisma.accountInsightDaily.upsert({
      where: { socialAccountId_date: { socialAccountId: accountId, date: acc.date } },
      create: { socialAccountId: accountId, date: acc.date, ...data },
      update: data,
    });
  }

  // Full replace per kind so labels dropped from a fresh export disappear here
  // too. Only kinds this upload actually contained are touched.
  for (const kind of seenKinds) {
    const rows = demographics.filter(d => d.kind === kind);
    if (!rows.length) continue;
    await prisma.accountDemographic.deleteMany({ where: { socialAccountId: accountId, kind } });
    await prisma.accountDemographic.createMany({
      data: rows.map(r => ({
        socialAccountId: accountId,
        kind,
        label: r.label,
        fraction: r.fraction,
        source: 'import',
      })),
    });
  }

  await prisma.socialAccount.update({ where: { id: accountId }, data: { lastImportedAt: now } });

  return {
    accountId,
    platform: account.platform,
    importedAt: now.toISOString(),
    files: fileResults,
    dailyDates: daily.size,
    demographics: demographics.length,
    warnings,
  };
}

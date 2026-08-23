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
//
// The daily files carry no year ("August 21"), so their dates are resolved as an
// ordered sequence (resolveSequentialDates) rather than cell by cell — a
// full-year export would otherwise fold its first days onto the current week.
// ─────────────────────────────────────────────────────────────────────────────

import { createHash } from 'crypto';
import { prisma } from '../../prisma.js';
import { enrichTikTokVideosBatch } from '../tiktok-enrich.service.js';
import { videoIdFromLink } from '../permalink.service.js';
import { logSocialError } from '../safe-error.js';
import {
  type ParsedSheet,
  type DailyAcc,
  buildDailyData,
  cellValue,
  dateKey,
  has,
  parseMonthDay,
  parseWorkbook,
  resolveSequentialDates,
  safeFloat,
  safeInt,
} from './import-utils.js';

export { parseMonthDay, parseWorkbook };

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

// Canonical implementation lives with the other permalink helpers; re-exported
// here so this module's existing importers keep working.
export { videoIdFromLink };

/** TikTok ids embed their creation time in the top 32 bits (Unix seconds). */
export function videoIdToDate(id: string): Date | null {
  try {
    const secs = Number(BigInt(id) >> 32n);
    if (secs > 1_000_000_000 && secs < 4_000_000_000) return new Date(secs * 1000);
  } catch { /* not a bigint */ }
  return null;
}

/**
 * A stable key for a content row whose link carries no TikTok id.
 *
 * Identifying a video is a nice-to-have; importing it is not. A row we cannot
 * parse an id out of must still land in the database and still show up in the
 * dashboard, so it gets a synthetic key instead of being dropped. The key is
 * derived from the row's own content so re-importing the same export updates the
 * row rather than duplicating it, and it is deliberately non-numeric so
 * derivePermalink() can never mistake it for a real video id and invent a URL.
 */
function fallbackExternalId(link: string | null, title: string | null, rowIndex: number): string {
  const basis = (link || title || `row-${rowIndex}`).trim().toLowerCase();
  return `unlinked-${createHash('sha1').update(basis).digest('hex').slice(0, 16)}`;
}

// ── parsing + detection ──────────────────────────────────────────────────────

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

// ── parsing ──────────────────────────────────────────────────────────────────

export interface ParsedVideo {
  externalId: string; title: string | null; link: string | null; postedAt: Date | null;
  likes: number | null; comments: number | null; shares: number | null; views: number | null;
}

export interface ActivityCell { sum: number; count: number; weekday: number; hour: number }

/** Everything the export files say, before any of it touches the database. */
export interface ParsedTikTokExport {
  fileResults: ImportFileResult[];
  warnings: string[];
  daily: Map<string, DailyAcc>;
  gender: { label: string; fraction: number }[];
  country: { label: string; fraction: number }[];
  activity: Map<string, ActivityCell>;
  videos: ParsedVideo[];
  /** Content rows imported under a synthetic key because their link carried no video id. */
  unlinkedVideos: number;
  /** Daily rows refused because they resolved to a date after the export itself. */
  futureRows: number;
}

/**
 * Parse TikTok Studio export files into plain data.
 *
 * Pure apart from reading the buffers — no database — so the date handling can
 * be tested against a real-shaped export. `now` is the import time and the
 * reference every year-less date is resolved against.
 */
export async function parseTikTokStudioFiles(
  files: { originalname: string; buffer: Buffer }[],
  now: Date = new Date(),
): Promise<ParsedTikTokExport> {
  const fileResults: ImportFileResult[] = [];
  const warnings: string[] = [];

  const daily = new Map<string, DailyAcc>();
  const gender: { label: string; fraction: number }[] = [];
  const country: { label: string; fraction: number }[] = [];
  const activityAcc = new Map<string, ActivityCell>();
  const videos: ParsedVideo[] = [];
  // Rows imported under a synthetic key because their link carried no video id.
  // Reported as a warning, never as a failure — they are in the dashboard either way.
  let unlinkedVideos = 0;
  let futureRows = 0;

  // A daily row can never be dated after the export that contains it. One that
  // is means a year-less date was placed wrongly — exactly the failure that once
  // put a year-old viral spike on top of the current week — so refuse it instead
  // of writing it. A day of slack covers the export day itself across timezones.
  const futureCutoff = now.getTime() + 86400000;

  const upsertDaily = (d: Date, patch: Partial<DailyAcc>): boolean => {
    if (d.getTime() > futureCutoff) {
      futureRows++;
      return false;
    }
    const k = dateKey(d);
    const cur = daily.get(k) || { date: d };
    daily.set(k, { ...cur, ...patch, date: d });
    return true;
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
        case 'followerHistory': {
          const dates = resolveSequentialDates(sheet.rows.map(r => r[0]), now);
          for (let i = 0; i < sheet.rows.length; i++) {
            const r = sheet.rows[i];
            const d = dates[i];
            if (!d) continue;
            if (upsertDaily(d, { followers: safeInt(r[1]) })) count++;
          }
          break;
        }

        case 'overview': {
          const dates = resolveSequentialDates(sheet.rows.map(r => r[0]), now);
          for (let i = 0; i < sheet.rows.length; i++) {
            const r = sheet.rows[i];
            const d = dates[i];
            if (!d) continue;
            const videoViews = safeInt(r[1]);
            const ok = upsertDaily(d, {
              videoViews,
              impressions: videoViews, // TikTok's closest impressions proxy
              profileVisits: safeInt(r[2]),
              likes: safeInt(r[3]),
              comments: safeInt(r[4]),
              shares: safeInt(r[5]),
            });
            if (ok) count++;
          }
          break;
        }

        case 'viewers': {
          const dates = resolveSequentialDates(sheet.rows.map(r => r[0]), now);
          for (let i = 0; i < sheet.rows.length; i++) {
            const r = sheet.rows[i];
            const d = dates[i];
            if (!d) continue;
            const ok = upsertDaily(d, {
              reach: safeInt(r[1]),      // Total Viewers ≈ reach
              newViewers: safeInt(r[2]),
              returningViewers: safeInt(r[3]),
            });
            if (ok) count++;
          }
          break;
        }

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

        case 'followerActivity': {
          const dates = resolveSequentialDates(sheet.rows.map(r => r[0]), now);
          for (let i = 0; i < sheet.rows.length; i++) {
            const r = sheet.rows[i];
            const d = dates[i];
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
        }

        case 'content':
          for (let idx = 0; idx < sheet.rows.length; idx++) {
            const r = sheet.rows[idx];
            // columns: Time, Video title, Video link, Post time, likes, comments, shares, views
            const link = r[2] ? String(r[2]).trim() : null;
            const title = r[1] ? String(r[1]).trim() : null;
            // Genuinely blank padding rows are the only ones worth skipping.
            if (r.every(c => c == null || String(c).trim() === '')) continue;
            // An unparseable link is NOT a reason to drop the video. The id is only
            // an upsert key and a merge hint, both of which have workable
            // fallbacks, so the row imports either way.
            const videoId = videoIdFromLink(link);
            if (!videoId) unlinkedVideos++;
            const externalId = videoId || fallbackExternalId(link, title, idx);
            const postedAt = videoIdToDate(externalId) || parseMonthDay(r[3], now);
            videos.push({
              externalId,
              title,
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

  if (futureRows > 0) {
    warnings.push(
      `${futureRows} daily row(s) were dated after today and skipped — their dates could not be ` +
      `placed on the calendar, so nothing was written for them. Check the export and re-upload.`,
    );
  }

  return {
    fileResults, warnings, daily, gender, country,
    activity: activityAcc, videos, unlinkedVideos, futureRows,
  };
}

// ── main entry ───────────────────────────────────────────────────────────────

export async function importTikTokStudioFiles(
  accountId: string,
  files: { originalname: string; buffer: Buffer }[],
): Promise<ImportSummary> {
  const now = new Date();
  const {
    fileResults, warnings, daily, gender, country, activity: activityAcc, videos, unlinkedVideos,
  } = await parseTikTokStudioFiles(files, now);

  // ── persist ──
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  // Daily metrics: upsert per date, computing a consistent engagement rate.
  for (const acc of daily.values()) {
    const data = buildDailyData(acc);

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
  if (videos.length > 0) {
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

    if (unlinkedVideos > 0) {
      warnings.push(
        `${unlinkedVideos} video row(s) had no recognizable TikTok link — imported and visible, ` +
        `but they cannot be auto-verified or auto-thumbnailed.`,
      );
    }

    // Thumbnails and verification are enrichment, not a gate: the rows above are
    // already committed, and this runs detached so a slow or failing TikTok API
    // can neither delay nor fail the import.
    enrichTikTokVideosBatch(accountId).catch((err) => {
      logSocialError(`Background TikTok video enrichment error for account ${accountId}`, err);
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

// ── clearing ─────────────────────────────────────────────────────────────────
//
// The importer only ever upserts, so a bad upload (wrong account, mis-dated
// rows, a stale export) cannot be undone by importing again — the wrong rows
// stay unless something removes them. This is that something: scoped to one
// account, optionally to a date window, with a dry-run count so the UI can say
// exactly what is about to go before it goes.

export interface ClearImportedDataOptions {
  /** Inclusive UTC-midnight bounds. Both omitted = everything. */
  from?: Date | null;
  to?: Date | null;
  /** Daily metric rows (followers, reach, views, …). Default true. */
  daily?: boolean;
  /** Imported videos, ranged on their post date. Default true. */
  videos?: boolean;
  /**
   * Demographics and the active-times heatmap. These carry no date, so they
   * are only touched when no range is given. Default true.
   */
  audience?: boolean;
}

export interface ClearImportedDataCounts {
  daily: number;
  videos: number;
  demographics: number;
  activity: number;
}

function clearFilters(accountId: string, opts: ClearImportedDataOptions) {
  const from = opts.from ?? null;
  const to = opts.to ?? null;
  const ranged = from != null || to != null;
  const dayAfterTo = to ? new Date(to.getTime() + 86400000) : null;

  const dailyWhere = {
    socialAccountId: accountId,
    ...(ranged ? { date: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
  };
  // A video with no post date cannot be placed in a window, so a ranged clear
  // leaves it alone; only an unbounded clear removes it.
  const videosWhere = {
    socialAccountId: accountId,
    ...(ranged
      ? { postedAt: { ...(from ? { gte: from } : {}), ...(dayAfterTo ? { lt: dayAfterTo } : {}) } }
      : {}),
  };
  return {
    ranged,
    daily: opts.daily !== false,
    videos: opts.videos !== false,
    audience: opts.audience !== false && !ranged,
    dailyWhere,
    videosWhere,
  };
}

/** What clearImportedData() would delete, without deleting it. */
export async function countImportedData(
  accountId: string,
  opts: ClearImportedDataOptions = {},
): Promise<ClearImportedDataCounts> {
  const f = clearFilters(accountId, opts);
  const [daily, videos, demographics, activity] = await Promise.all([
    f.daily ? prisma.accountInsightDaily.count({ where: f.dailyWhere }) : 0,
    f.videos ? prisma.importedPost.count({ where: f.videosWhere }) : 0,
    f.audience ? prisma.accountDemographic.count({ where: { socialAccountId: accountId } }) : 0,
    f.audience ? prisma.accountActivity.count({ where: { socialAccountId: accountId } }) : 0,
  ]);
  return { daily, videos, demographics, activity };
}

export async function clearImportedData(
  accountId: string,
  opts: ClearImportedDataOptions = {},
): Promise<ClearImportedDataCounts> {
  const account = await prisma.socialAccount.findUnique({ where: { id: accountId } });
  if (!account) throw new Error('Account not found');

  const f = clearFilters(accountId, opts);

  return prisma.$transaction(async (tx) => {
    const daily = f.daily ? (await tx.accountInsightDaily.deleteMany({ where: f.dailyWhere })).count : 0;
    const videos = f.videos ? (await tx.importedPost.deleteMany({ where: f.videosWhere })).count : 0;
    const demographics = f.audience
      ? (await tx.accountDemographic.deleteMany({ where: { socialAccountId: accountId } })).count
      : 0;
    const activity = f.audience
      ? (await tx.accountActivity.deleteMany({ where: { socialAccountId: accountId } })).count
      : 0;

    // With nothing imported left, "last imported" would point at data that no
    // longer exists.
    if (!f.ranged && f.daily && f.videos && f.audience) {
      await tx.socialAccount.update({ where: { id: accountId }, data: { lastImportedAt: null } });
    }

    return { daily, videos, demographics, activity };
  });
}

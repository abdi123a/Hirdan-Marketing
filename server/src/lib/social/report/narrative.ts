// The prose sections of the monthly report.
//
// Only the parts that genuinely need writing go through the model: the summary,
// the wins and the miss, the per-platform verdicts, the recommendations. Every
// number in the report is computed in report-facts.ts and interpolated by the
// template — the model is handed the finished figures and told, firmly, not to
// produce any of its own. A client-facing report is the last place to let a
// language model do arithmetic.

import { prisma } from '../../prisma.js';
import { callAI, resolveProviderKey } from '../../ai-provider.js';
import type { ReportFacts } from './report-facts.js';
import { logSocialError } from '../safe-error.js';

export interface Narrative {
  executiveSummary: string;
  wins: { label: string; value: string; title: string; body: string }[];
  miss: string;
  ask: string;
  monthAtAGlanceNote: string;
  platformVerdicts: Record<string, string>;
  paidNote: string;
  formatNote: string;
  bestTimeNote: string;
  audienceNote: string;
  recommendations: { title: string; body: string }[];
}

/** Deterministic fallback so a missing AI key never blocks a report. */
export function fallbackNarrative(facts: ReportFacts): Narrative {
  const fmtNum = (n: number) => n.toLocaleString('en-US');
  const delta = (pct: number | null) =>
    pct == null ? '' : ` (${pct >= 0 ? '+' : ''}${pct}% vs. the previous month)`;

  const wins: Narrative['wins'] = [];
  if (facts.kpis.reach.current > 0) {
    wins.push({
      label: 'Win 1',
      value: facts.kpis.reach.changePct != null
        ? `${facts.kpis.reach.changePct >= 0 ? '+' : ''}${facts.kpis.reach.changePct}%`
        : fmtNum(facts.kpis.reach.current),
      title: 'Reach',
      body: `Total reach was ${fmtNum(facts.kpis.reach.current)}${delta(facts.kpis.reach.changePct)}.`,
    });
  }
  if (facts.kpis.engagementRate.current > 0) {
    wins.push({
      label: 'Win 2',
      value: `${facts.kpis.engagementRate.current}%`,
      title: 'Engagement rate',
      body: `Engagement rate was ${facts.kpis.engagementRate.current}%${delta(facts.kpis.engagementRate.changePct)}.`,
    });
  }
  if (facts.kpis.newFollowers.current > 0) {
    wins.push({
      label: 'Win 3',
      value: fmtNum(facts.kpis.newFollowers.current),
      title: 'New followers',
      body: `The audience grew by ${fmtNum(facts.kpis.newFollowers.current)} followers${delta(facts.kpis.newFollowers.changePct)}.`,
    });
  }

  const weakest = [...facts.platforms]
    .filter(p => p.engagementRate != null)
    .sort((a, b) => (a.engagementRate || 0) - (b.engagementRate || 0))[0];

  return {
    executiveSummary:
      `${facts.period.label} saw ${fmtNum(facts.totals.postCount)} posts published across ` +
      `${facts.platforms.length} platform${facts.platforms.length === 1 ? '' : 's'}, reaching ` +
      `${fmtNum(facts.kpis.reach.current)} with ${fmtNum(facts.kpis.engagements.current)} engagements.`,
    wins,
    miss: weakest
      ? `${titleCase(weakest.platform)} returned ${weakest.engagementRate}% engagement on ${weakest.posts} posts — the weakest platform this month.`
      : '',
    ask: '',
    monthAtAGlanceNote: '',
    platformVerdicts: {},
    paidNote: '',
    formatNote: '',
    bestTimeNote: '',
    audienceNote: '',
    recommendations: [],
  };
}

function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const SYSTEM_PROMPT = `You write the prose sections of a marketing agency's monthly client report.

Hard rules:
- Use ONLY the figures given to you in the facts JSON. Never state a number that is not in it.
- Never estimate, extrapolate, or invent a metric. If a figure is null, do not mention it at all.
- Do not perform arithmetic — every number you need has already been computed for you.
- Write plainly and specifically, in the voice of a consultant reporting to a paying client.
- No emoji, no exclamation marks, no filler like "amazing" or "incredible".
- If the facts are too thin to support a section, return an empty string for it.

Return ONLY valid JSON matching the requested shape.`;

function buildUserPrompt(facts: ReportFacts): string {
  return `Client: ${facts.client.name}
Period: ${facts.period.label}

Facts (the only numbers you may cite):
${JSON.stringify(facts, null, 2)}

Return JSON with exactly this shape:
{
  "executiveSummary": "2-3 sentences on how the month went overall",
  "wins": [{ "label": "Win 1", "value": "a headline figure copied from the facts", "title": "short title", "body": "one sentence" }],
  "miss": "one or two sentences on the weakest area, or \\"\\" if nothing stands out",
  "ask": "one sentence naming what you want the client to approve next month, or \\"\\"",
  "monthAtAGlanceNote": "one sentence summarising the KPI row",
  "platformVerdicts": { "tiktok": "3-5 word verdict", "instagram": "...", "youtube": "...", "facebook": "..." },
  "paidNote": "one or two sentences on paid vs organic, or \\"\\" if there is no paid data",
  "formatNote": "one sentence on which formats performed, or \\"\\"",
  "bestTimeNote": "one sentence on the strongest posting window, or \\"\\"",
  "audienceNote": "one sentence on who the audience is, or \\"\\"",
  "recommendations": [{ "title": "short imperative", "body": "one sentence of rationale" }]
}

Include a "wins" entry only where the facts support it (at most 3). Include a
platformVerdict only for platforms present in the facts. Aim for 3 recommendations.`;
}

function parseModelJson(raw: string): any {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Compose the report's prose. Falls back to a deterministic summary when no AI
 * provider is configured or the call fails — a report with plain wording is far
 * better than no report, and the numbers are identical either way.
 */
export async function composeNarrative(facts: ReportFacts): Promise<Narrative> {
  const base = fallbackNarrative(facts);
  if (!facts.hasAccounts) return base;

  try {
    const settings = await prisma.agencySettings.findFirst();
    if (!settings) return base;

    const { provider, apiKey } = resolveProviderKey(settings as unknown as Record<string, any>);
    const response = await callAI(provider, apiKey, [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: buildUserPrompt(facts) },
    ]);

    const parsed = parseModelJson(response.content || '');

    // Merge over the deterministic base so a model that omits a key still
    // produces a complete report.
    return {
      executiveSummary: parsed.executiveSummary || base.executiveSummary,
      wins: Array.isArray(parsed.wins) && parsed.wins.length ? parsed.wins.slice(0, 3) : base.wins,
      miss: typeof parsed.miss === 'string' ? parsed.miss : base.miss,
      ask: typeof parsed.ask === 'string' ? parsed.ask : '',
      monthAtAGlanceNote: parsed.monthAtAGlanceNote || '',
      platformVerdicts: parsed.platformVerdicts && typeof parsed.platformVerdicts === 'object'
        ? parsed.platformVerdicts : {},
      paidNote: parsed.paidNote || '',
      formatNote: parsed.formatNote || '',
      bestTimeNote: parsed.bestTimeNote || '',
      audienceNote: parsed.audienceNote || '',
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 3) : [],
    };
  } catch (err) {
    logSocialError('[SocialReport] Narrative composition failed, using computed fallback', err);
    return base;
  }
}

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { AppError } from '../lib/errors.js';
import { callAI, resolveProviderKey } from '../lib/ai-provider.js';
import { createNotification } from '../lib/notifications.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

const sectionKeys = [
  'cover',
  'tableOfContents',
  'overview',
  'objectives',
  'targetAudience',
  'instagramInsights',
  'instagramTopPost',
  'facebookInsights',
  'facebookTopPost',
  'tiktokInsights',
  'tiktokTopPost',
  'swotAnalysis',
  'competitors',
  'nextSteps',
  'thankYou',
] as const;

const preflightDto = z.object({
  clientId: z.string().uuid(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  sourceText: z.string().min(80).max(100_000),
});

const generateDto = preflightDto.extend({
  title: z.string().min(3).max(200).optional(),
  forceGenerate: z.boolean().optional().default(false),
});

const updateParamsDto = z.object({
  reportId: z.string().uuid(),
});

const getByMonthParamsDto = z.object({
  clientId: z.string().uuid(),
  month: z.coerce.number().int().min(1).max(12),
  year: z.coerce.number().int().min(2000).max(2100),
});

const listQueryDto = z.object({
  clientId: z.string().uuid().optional(),
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(30),
});

const updateReportDto = z.object({
  title: z.string().min(3).max(200).optional(),
  status: z.enum(['DRAFT', 'FINALIZED']).optional(),
  sourceText: z.string().min(80).max(100_000).optional(),
  sections: z.array(
    z.object({
      key: z.string().min(1).max(100),
      order: z.number().int().min(0).max(1000),
      content: z.any(),
    })
  ).optional(),
});

const saveAssetDto = z.object({
  sectionKey: z.string().min(1).max(100),
  slotKey: z.string().min(1).max(100),
  // Accept both hosted URLs and base64 data URLs from in-app uploads.
  url: z.string().min(1).refine(
    (value) => /^https?:\/\/\S+$/i.test(value) || /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(value),
    { message: 'url must be an http(s) URL or a valid base64 image data URL' }
  ),
  caption: z.string().max(500).optional().nullable(),
});

type ReportSectionInput = {
  key: string;
  order: number;
  content: Prisma.InputJsonValue;
};

type PreflightResult = {
  errors: string[];
  warnings: string[];
  autofixSuggestions: string[];
  completenessScore: number;
};

const urlRegex = /https?:\/\/[^\s)]+/g;

const runPreflightChecks = (sourceText: string): PreflightResult => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const autofixSuggestions: string[] = [];
  const lower = sourceText.toLowerCase();

  const requiredTokens = ['followers', 'views', 'likes', 'comments'];
  const optionalTokens = ['shares', 'saves', 'engagement', 'top post', 'instagram', 'facebook', 'tiktok'];

  for (const token of requiredTokens) {
    if (!lower.includes(token)) {
      warnings.push(`Missing "${token}" metrics in context text.`);
    }
  }

  const presentOptionalCount = optionalTokens.filter((token) => lower.includes(token)).length;
  if (!lower.includes('instagram') || !lower.includes('facebook') || !lower.includes('tiktok')) {
    warnings.push('At least one core platform block (Instagram/Facebook/TikTok) appears incomplete.');
  }

  const urls = sourceText.match(urlRegex) ?? [];
  for (const url of urls) {
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.includes('.')) {
        errors.push(`Invalid URL detected: ${url}`);
      }
    } catch {
      errors.push(`Invalid URL detected: ${url}`);
    }
  }

  const hasPercent = /\b\d+(\.\d+)?%\b/.test(sourceText);
  const hasMoMWord = /\b(previous|last|month[- ]over[- ]month|mom|compared)\b/i.test(sourceText);
  if (hasPercent && !hasMoMWord) {
    autofixSuggestions.push('Add a short note clarifying what percentage values are compared against.');
  }

  if (!/\b(overview|summary)\b/i.test(sourceText)) {
    autofixSuggestions.push('Add a 3-5 sentence monthly overview paragraph for a stronger executive summary.');
  }

  const densitySignals = requiredTokens.filter((token) => lower.includes(token)).length + presentOptionalCount;
  const rawScore = Math.min(100, Math.round((densitySignals / (requiredTokens.length + optionalTokens.length)) * 100));
  const completenessScore = Math.max(35, rawScore);

  if (sourceText.length < 220) {
    errors.push('Context text is too short. Provide more monthly details before generation.');
  }

  return { errors, warnings, autofixSuggestions, completenessScore };
};

const parseModelJson = (content: unknown) => {
  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('AI content is empty');
  }

  const cleaned = content
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed = JSON.parse(cleaned) as Record<string, unknown>;
  return parsed;
};

const toText = (value: unknown, fallback = 'Not provided') => {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return fallback;
};

const toTextArray = (value: unknown, fallback: string[] = []) => {
  if (!Array.isArray(value)) return fallback;
  const items = value
    .map((item) => (typeof item === 'string' ? item.trim() : typeof item === 'number' ? String(item) : ''))
    .filter(Boolean);
  return items.length ? items : fallback;
};

const platformFacts = (facts: Record<string, any>, key: 'instagram' | 'facebook' | 'tiktok') => {
  const p = facts?.platforms?.[key] ?? {};
  const followersStart = toText(p.followersStart, '0');
  const followersEnd = toText(p.followersEnd, '0');
  const start = Number(followersStart.replace(/[^\d.-]/g, ''));
  const end = Number(followersEnd.replace(/[^\d.-]/g, ''));
  const growth =
    Number.isFinite(start) && Number.isFinite(end) && start > 0
      ? `${(((end - start) / start) * 100).toFixed(1)}`
      : toText(p.growth, '0');

  return {
    growth,
    prevFollowers: followersStart,
    followers: followersEnd,
    prevViews: toText(p.prevViews, '--'),
    views: toText(p.views, '0'),
    prevLikes: toText(p.prevLikes, '--'),
    likes: toText(p.likes, '0'),
    prevComments: toText(p.prevComments, '--'),
    comments: toText(p.comments, '0'),
    prevShares: toText(p.prevShares, '--'),
    shares: toText(p.shares, '0'),
    prevSaves: toText(p.prevSaves, '--'),
    saves: toText(p.saves, '0'),
  };
};

const buildSectionFallbacks = (facts: Record<string, any>) => {
  const topPosts = Array.isArray(facts?.topPosts) ? facts.topPosts : [];
  const topPostFor = (platform: 'instagram' | 'facebook' | 'tiktok') =>
    topPosts.find((post: any) => String(post?.platform || '').toLowerCase() === platform) ?? {};
  const swot = facts?.swot ?? {};
  const objectives = toTextArray(facts?.objectives);
  const audience = toTextArray(facts?.audience);
  const competitors = toTextArray(facts?.competitors);
  const nextSteps = toTextArray(facts?.nextSteps);
  const summary = toText(facts?.executiveSummary);

  return {
    cover: { title: 'Social Media Monthly Report', body: summary },
    tableOfContents: { title: 'Table of Contents', body: `Monthly report structure and sections.` },
    overview: { title: 'Overview', body: summary, summary, bullets: objectives.slice(0, 4) },
    objectives: { title: 'Objectives', body: 'Monthly objectives and strategic focus areas.', bullets: objectives },
    targetAudience: { title: 'Target Audience', body: 'Audience segments and behavior insights.', bullets: audience },
    instagramInsights: { title: 'Instagram Insights', body: summary, ...platformFacts(facts, 'instagram') },
    instagramTopPost: {
      title: 'Instagram Top Post',
      body: toText(topPostFor('instagram')?.title),
      views: toText(topPostFor('instagram')?.views, '0'),
      likes: toText(topPostFor('instagram')?.likes, '0'),
      comments: toText(topPostFor('instagram')?.comments, '0'),
      shares: toText(topPostFor('instagram')?.shares, '0'),
      saves: toText(topPostFor('instagram')?.saves, '0'),
      imageUrl: toText(topPostFor('instagram')?.url, ''),
      bullets: [],
    },
    facebookInsights: { title: 'Facebook Insights', body: summary, ...platformFacts(facts, 'facebook') },
    facebookTopPost: {
      title: 'Facebook Top Post',
      body: toText(topPostFor('facebook')?.title),
      views: toText(topPostFor('facebook')?.views, '0'),
      likes: toText(topPostFor('facebook')?.likes, '0'),
      comments: toText(topPostFor('facebook')?.comments, '0'),
      shares: toText(topPostFor('facebook')?.shares, '0'),
      saves: toText(topPostFor('facebook')?.saves, '0'),
      imageUrl: toText(topPostFor('facebook')?.url, ''),
      bullets: [],
    },
    tiktokInsights: { title: 'TikTok Insights', body: summary, ...platformFacts(facts, 'tiktok') },
    tiktokTopPost: {
      title: 'TikTok Top Post',
      body: toText(topPostFor('tiktok')?.title),
      views: toText(topPostFor('tiktok')?.views, '0'),
      likes: toText(topPostFor('tiktok')?.likes, '0'),
      comments: toText(topPostFor('tiktok')?.comments, '0'),
      shares: toText(topPostFor('tiktok')?.shares, '0'),
      saves: toText(topPostFor('tiktok')?.saves, '0'),
      imageUrl: toText(topPostFor('tiktok')?.url, ''),
      bullets: [],
    },
    swotAnalysis: {
      title: 'SWOT Analysis',
      body: 'SWOT highlights based on this month data.',
      strengths: toTextArray(swot?.strengths),
      weakness: toTextArray(swot?.weakness ?? swot?.weaknesses),
      opportunities: toTextArray(swot?.opportunities),
      threats: toTextArray(swot?.threats),
    },
    competitors: { title: 'Competitors', body: 'Competitive benchmark snapshot.', bullets: competitors },
    nextSteps: { title: 'Next Steps', body: 'Recommended actions for next month.', bullets: nextSteps },
    thankYou: { title: 'Thank You', body: 'Thank you for your trust and partnership this month.' },
  } as Record<string, Record<string, unknown>>;
};

const normalizeSectionContent = (
  key: string,
  aiContent: unknown,
  fallback: Record<string, unknown>
) => {
  const base = aiContent && typeof aiContent === 'object' ? (aiContent as Record<string, unknown>) : {};
  const merged = { ...fallback, ...base };
  if (key === 'swotAnalysis') {
    const weakness = toTextArray((merged as any).weakness ?? (merged as any).weaknesses, toTextArray((fallback as any).weakness));
    return {
      ...merged,
      strengths: toTextArray((merged as any).strengths, toTextArray((fallback as any).strengths)),
      weakness,
      opportunities: toTextArray((merged as any).opportunities, toTextArray((fallback as any).opportunities)),
      threats: toTextArray((merged as any).threats, toTextArray((fallback as any).threats)),
    };
  }
  return merged;
};

const getAiProviderKey = async () => {
  const settings = await prisma.agencySettings.findFirst();
  return resolveProviderKey(settings || {});
};

router.post('/monthly/preflight', validate({ body: preflightDto }), async (req: Request, res: Response, next) => {
  try {
    const { clientId, month, year, sourceText } = req.body;
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { id: true } });
    if (!client) throw AppError.notFound('Client not found');

    const result = runPreflightChecks(sourceText);
    res.json({
      month,
      year,
      ...result,
      canGenerate: result.errors.length === 0,
    });
  } catch (error) {
    next(error);
  }
});

router.post('/monthly/generate', validate({ body: generateDto }), async (req: Request, res: Response, next) => {
  try {
    const { clientId, month, year, sourceText, title, forceGenerate } = req.body;
    const preflight = runPreflightChecks(sourceText);
    if (preflight.errors.length > 0 && !forceGenerate) {
      throw AppError.badRequest(`Preflight failed: ${preflight.errors.join(' | ')}`);
    }

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      select: { id: true, name: true, company: true, industry: true },
    });
    if (!client) throw AppError.notFound('Client not found');

    const { provider, apiKey } = await getAiProviderKey();

    const normalizeSystemPrompt = `You transform monthly marketing notes into structured JSON facts.
Return ONLY valid JSON.
Never invent numbers.
If data is missing, set value to "Not provided".`;
    const normalizeUserPrompt = `Client: ${client.company || client.name}
Month: ${month}
Year: ${year}
Raw context:
${sourceText}

Return JSON with this shape:
{
  "executiveSummary": string,
  "objectives": string[],
  "audience": string[],
  "platforms": {
    "instagram": { "followersStart": string, "followersEnd": string, "views": string, "likes": string, "comments": string, "shares": string, "saves": string },
    "facebook": { "followersStart": string, "followersEnd": string, "views": string, "likes": string, "comments": string, "shares": string, "saves": string },
    "tiktok": { "followersStart": string, "followersEnd": string, "views": string, "likes": string, "comments": string, "shares": string, "saves": string }
  },
  "topPosts": [{ "platform": string, "title": string, "url": string, "views": string, "likes": string, "comments": string, "shares": string, "saves": string }],
  "swot": { "strengths": string[], "weaknesses": string[], "opportunities": string[], "threats": string[] },
  "competitors": string[],
  "nextSteps": string[]
}`;

    const normalizeResponse = await callAI(provider, apiKey, [
      { role: 'system', content: normalizeSystemPrompt },
      { role: 'user', content: normalizeUserPrompt },
    ]);

    const normalizedFacts = parseModelJson(normalizeResponse.content);

    const composeSystemPrompt = `You are preparing a polished monthly social media report.
Use only given facts. Do not invent metrics.
Return ONLY valid JSON with sections array.`;
    const composeUserPrompt = `Generate report sections for this fixed order:
${sectionKeys.join(', ')}

Facts JSON:
${JSON.stringify(normalizedFacts)}

Return:
{
  "sections": [
    { "key": "cover", "content": { ... } },
    { "key": "tableOfContents", "content": { ... } }
  ]
}
Each section must have concise, presentation-ready text.`;

    const composeResponse = await callAI(provider, apiKey, [
      { role: 'system', content: composeSystemPrompt },
      { role: 'user', content: composeUserPrompt },
    ]);

    const composed = parseModelJson(composeResponse.content);
    const sectionsInput = Array.isArray(composed.sections) ? composed.sections : [];

    const keyedInput = new Map<string, unknown>();
    for (const section of sectionsInput) {
      if (section && typeof section === 'object') {
        const key = String((section as Record<string, unknown>).key || '');
        if (key) keyedInput.set(key, (section as Record<string, unknown>).content ?? {});
      }
    }

    const sectionFallbacks = buildSectionFallbacks(normalizedFacts as Record<string, any>);
    const finalSections: ReportSectionInput[] = sectionKeys.map((key, index) => ({
      key,
      order: index + 1,
      content: normalizeSectionContent(
        key,
        keyedInput.get(key),
        sectionFallbacks[key] ?? { title: key, body: 'Not provided' }
      ) as Prisma.InputJsonValue,
    }));

    const reportTitle = title || `${client.company || client.name} - ${month}/${year} Monthly Report`;
    const createdById = req.user?.userId ?? null;

    const report = await prisma.monthlyReport.upsert({
      where: {
        clientId_month_year: { clientId, month, year },
      },
      create: {
        clientId,
        month,
        year,
        title: reportTitle,
        sourceText,
        dataQuality: JSON.stringify(preflight),
        themeSnapshot: null,
        createdById,
        sections: {
          create: finalSections.map((section) => ({
            key: section.key,
            order: section.order,
            content: section.content,
          })),
        },
      },
      update: {
        title: reportTitle,
        sourceText,
        dataQuality: JSON.stringify(preflight),
        sections: {
          deleteMany: {},
          create: finalSections.map((section) => ({
            key: section.key,
            order: section.order,
            content: section.content,
          })),
        },
      },
      include: {
        sections: {
          orderBy: { order: 'asc' },
        },
      },
    });

    await prisma.monthlyReportVersion.create({
      data: {
        reportId: report.id,
        createdById,
        snapshotJson: {
          title: report.title,
          sourceText: report.sourceText,
          dataQuality: preflight,
          sections: finalSections,
        } as Prisma.InputJsonValue,
      },
    });

    createNotification({
      title: 'Monthly Report Generated',
      message: `Monthly report "${report.title}" has been successfully generated.`,
      type: 'MONTHLY_REPORT_GENERATED',
      category: 'INFORMATION',
      entityType: 'REPORT',
      entityId: report.id,
      actionUrl: `/dashboard/reports/monthly`,
    });

    res.status(201).json({
      report,
      preflight: {
        ...preflight,
        canGenerate: preflight.errors.length === 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.get('/monthly', validate({ query: listQueryDto }), async (req: Request, res: Response, next) => {
  try {
    const { clientId, month, year, limit } = req.query as unknown as z.infer<typeof listQueryDto>;
    const where: Record<string, unknown> = {};
    if (clientId) where.clientId = clientId;
    if (month !== undefined) where.month = month;
    if (year !== undefined) where.year = year;

    const reports = await prisma.monthlyReport.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }, { updatedAt: 'desc' }],
      take: limit,
      select: {
        id: true,
        clientId: true,
        month: true,
        year: true,
        title: true,
        status: true,
        updatedAt: true,
        client: { select: { name: true, company: true } },
      },
    });

    res.json({ reports });
  } catch (error) {
    next(error);
  }
});

router.get(
  '/monthly/:clientId/:month/:year',
  validate({ params: getByMonthParamsDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { clientId, month, year } = req.params;
      const report = await prisma.monthlyReport.findUnique({
        where: {
          clientId_month_year: {
            clientId: String(clientId),
            month: Number(month),
            year: Number(year),
          },
        },
        include: {
          sections: { orderBy: { order: 'asc' } },
          assets: true,
        },
      });
      if (!report) throw AppError.notFound('Monthly report not found');
      res.json({ report });
    } catch (error) {
      next(error);
    }
  }
);

router.put(
  '/monthly/:reportId',
  validate({ params: updateParamsDto, body: updateReportDto }),
  async (req: Request, res: Response, next) => {
    try {
      const reportId = String(req.params.reportId);
      const { sections, ...rest } = req.body;
      const updated = await prisma.monthlyReport.update({
        where: { id: reportId },
        data: {
          ...rest,
          ...(sections && {
            sections: {
              deleteMany: {},
              create: sections.map((section: { key: string; order: number; content: unknown }) => ({
                key: section.key,
                order: section.order,
                content: section.content as Prisma.InputJsonValue,
              })),
            },
          }),
        },
        include: {
          sections: { orderBy: { order: 'asc' } },
        },
      });

      await prisma.monthlyReportVersion.create({
        data: {
          reportId: updated.id,
          createdById: req.user?.userId ?? null,
          snapshotJson: {
            title: updated.title,
            status: updated.status,
            sourceText: updated.sourceText,
            sections: updated.sections,
          } as Prisma.InputJsonValue,
        },
      });

      if (updated.status === 'FINALIZED') {
        createNotification({
          title: 'Monthly Report Approved ✅',
          message: `Monthly report "${updated.title}" has been finalized & approved.`,
          type: 'MONTHLY_REPORT_FINALIZED',
          category: 'SUCCESS',
          entityType: 'REPORT',
          entityId: updated.id,
          actionUrl: `/dashboard/reports/monthly`,
        });
      }

      res.json({ report: updated });
    } catch (error) {
      next(error);
    }
  }
);

router.post(
  '/monthly/:reportId/images',
  validate({ params: updateParamsDto, body: saveAssetDto }),
  async (req: Request, res: Response, next) => {
    try {
      const reportId = String(req.params.reportId);
      const { sectionKey, slotKey, url, caption } = req.body;

      const report = await prisma.monthlyReport.findUnique({ where: { id: reportId }, select: { id: true } });
      if (!report) throw AppError.notFound('Monthly report not found');

      const asset = await prisma.monthlyReportAsset.upsert({
        where: {
          reportId_sectionKey_slotKey: {
            reportId,
            sectionKey,
            slotKey,
          },
        },
        create: {
          reportId,
          sectionKey,
          slotKey,
          url,
          caption: caption ?? null,
        },
        update: {
          url,
          caption: caption ?? null,
        },
      });

      res.status(201).json({ asset });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2000'
      ) {
        next(AppError.badRequest('Uploaded image is too large. Please use a smaller image.'));
        return;
      }
      next(error);
    }
  }
);

export default router;

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { uploadMedia, enforceMagicBytes } from '../lib/upload.js';
import { parsePagination } from '../lib/pagination.js';

const router = Router();
router.use(authenticate);

const POST_STATUS_BY_TASK_STATUS: Record<string, 'DRAFT' | 'SCHEDULED' | 'FILMED' | 'PUBLISHED' | 'DELAYED'> = {
  PENDING: 'DRAFT',
  PLANNED: 'SCHEDULED',
  IN_PROGRESS: 'SCHEDULED',
  WAITING_APPROVAL: 'FILMED',
  COMPLETED: 'PUBLISHED',
  CANCELLED: 'DELAYED',
};

const toStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const parseIsoDateOnly = (value: string) => {
  const [y, m, d] = value.split('-').map(Number);
  if (!y || !m || !d) return new Date(value);
  // Use UTC noon to avoid timezone shift into previous/next day.
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0, 0));
};

const isBusinessDay = (date: Date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6;
};

const enumerateDays = (start: Date, end: Date) => {
  const days: Date[] = [];
  const cursor = toStartOfDay(start);
  const limit = toStartOfDay(end);

  while (cursor <= limit) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
};

const enumerateBusinessDays = (start: Date, end: Date) =>
  enumerateDays(start, end).filter(isBusinessDay);

const getSpreadDate = (index: number, total: number, days: Date[]) => {
  if (days.length === 0) return null;
  if (total <= 1) return days[Math.floor((days.length - 1) / 2)];
  const spreadIndex = Math.round((index * (days.length - 1)) / (total - 1));
  return days[Math.min(days.length - 1, Math.max(0, spreadIndex))];
};

const previousBusinessDay = (publishDate: Date, cycleStart: Date) => {
  const minDate = toStartOfDay(cycleStart);
  const candidate = toStartOfDay(publishDate);
  candidate.setDate(candidate.getDate() - 1);

  while (candidate >= minDate && !isBusinessDay(candidate)) {
    candidate.setDate(candidate.getDate() - 1);
  }

  // If the cycle starts too close, keep shooting date on cycle start.
  if (candidate < minDate) {
    return minDate;
  }

  return candidate;
};

const previousCalendarDay = (date: Date, cycleStart: Date) => {
  const minDate = toStartOfDay(cycleStart);
  const candidate = toStartOfDay(date);
  candidate.setDate(candidate.getDate() - 1);
  return candidate < minDate ? minDate : candidate;
};

const nextCalendarDay = (date: Date, cycleEnd: Date) => {
  const maxDate = toStartOfDay(cycleEnd);
  const candidate = toStartOfDay(date);
  candidate.setDate(candidate.getDate() + 1);
  return candidate > maxDate ? maxDate : candidate;
};

const isMissingContentPostIdArgError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('Unknown argument `contentPostId`');
};

const isContentPostLinkUnavailableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return (
    isMissingContentPostIdArgError(error) ||
    message.includes('content_post_id') ||
    message.includes('Unknown column') ||
    message.includes('column') && message.includes('does not exist')
  );
};

const VIDEO_LIKE_TYPES = new Set(['VIDEO', 'REEL', 'SHORT']);
const STORY_NAME_RE = /\bstory\b/i;
const VIDEO_NAME_RE = /\b(video|reel|short)\b/i;

const getContentKind = (task: { type?: string; title?: string }) => {
  const type = String(task.type || '').toUpperCase();
  const title = String(task.title || '');

  if (type === 'STORY' || STORY_NAME_RE.test(title)) return 'STORY';
  if (VIDEO_LIKE_TYPES.has(type) || VIDEO_NAME_RE.test(title)) return 'VIDEO';
  return 'OTHER';
};

const buildMixedTaskOrder = (tasks: any[]) => {
  const storyQueue = tasks.filter(t => getContentKind(t) === 'STORY');
  const videoQueue = tasks.filter(t => getContentKind(t) === 'VIDEO');
  const otherQueue = tasks.filter(t => getContentKind(t) === 'OTHER');

  const pairedAndMixedUnits: any[][] = [];

  // Pair Story + Video-like deliverables on the same publish slot when possible.
  while (storyQueue.length > 0 || videoQueue.length > 0) {
    const unit: any[] = [];
    if (storyQueue.length > 0) unit.push(storyQueue.shift());
    if (videoQueue.length > 0) unit.push(videoQueue.shift());
    pairedAndMixedUnits.push(unit.filter(Boolean));
  }

  // Keep the rest mixed by adding other types in between.
  const finalUnits: any[][] = [];
  let pairIdx = 0;
  let otherIdx = 0;
  while (pairIdx < pairedAndMixedUnits.length || otherIdx < otherQueue.length) {
    if (pairIdx < pairedAndMixedUnits.length) {
      finalUnits.push(pairedAndMixedUnits[pairIdx]);
      pairIdx++;
    }
    if (otherIdx < otherQueue.length) {
      finalUnits.push([otherQueue[otherIdx]]);
      otherIdx++;
    }
  }

  return finalUnits;
};

// ─── Validation ───────────────────────────────────────────────────

const TASK_STATUSES = [
  'PENDING', 'PLANNED', 'IN_PROGRESS', 'WAITING_APPROVAL', 'COMPLETED', 'CANCELLED',
] as const;

const DELIVERABLE_TYPES = [
  'POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER',
] as const;

const PLATFORMS = [
  'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN',
  'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER',
] as const;

const taskCreateDto = z.object({
  clientId: z.string().uuid(),
  subscriptionId: z.string().uuid(),
  cycleId: z.string().uuid(),
  contentPostId: z.string().uuid().optional().nullable(),
  title: z.string().min(1),
  type: z.enum(DELIVERABLE_TYPES),
  platforms: z.array(z.enum(PLATFORMS)).min(1),
  dueDate: z.string().or(z.date()).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  teamMemberId: z.string().uuid().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  clientVisible: z.boolean().optional(),
});

const taskUpdateDto = z.object({
  contentPostId: z.string().uuid().optional().nullable(),
  title: z.string().min(1).optional(),
  type: z.enum(DELIVERABLE_TYPES).optional(),
  platforms: z.array(z.enum(PLATFORMS)).optional(),
  dueDate: z.string().or(z.date()).optional().nullable(),
  status: z.enum(TASK_STATUSES).optional(),
  teamMemberId: z.string().uuid().optional().nullable(),
  internalNotes: z.string().optional().nullable(),
  clientNotes: z.string().optional().nullable(),
  mediaUrl: z.string().optional().nullable(),
  postUrl: z.string().optional().nullable(),
  postedAt: z.string().or(z.date()).optional().nullable(),
  proofUrl: z.string().optional().nullable(),
  clientVisible: z.boolean().optional(),
});

const generateDto = z.object({
  subscriptionId: z.string().uuid(),
  cycleStart: z.string(), // ISO date string for the cycle start
  cycleEnd: z.string(),   // ISO date string for the cycle end
  label: z.string().min(1), // e.g. "March 2026"
  useAi: z.boolean().optional().default(false),
  prompt: z.string().optional(),
});

// ─── Task includes — reusable ─────────────────────────────────────

const taskIncludes = {
  platforms: { select: { id: true, platform: true } },
  assignee: { select: { id: true, name: true, avatar: true } },
  client: { select: { id: true, name: true, company: true } },
  cycle: { select: { id: true, label: true, cycleStart: true, cycleEnd: true } },
  subscription: { select: { id: true, plan: true } },
};

// ─── GET /api/tasks ───────────────────────────────────────────────
// Supports filtering: ?clientId=&cycleId=&status=&teamMemberId=&subscriptionId=

router.get('/', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const where: any = {};

    if (req.query.clientId) where.clientId = String(req.query.clientId);
    if (req.query.cycleId) where.cycleId = String(req.query.cycleId);
    if (req.query.subscriptionId) where.subscriptionId = String(req.query.subscriptionId);
    if (req.query.teamMemberId) where.teamMemberId = String(req.query.teamMemberId);
    if (req.query.status) where.status = String(req.query.status);

    const { take, skip } = parsePagination(req.query, { maxTake: 200, defaultTake: 50 });
    const tasks = await prisma.deliverableTask.findMany({
      where,
      include: taskIncludes,
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
      take,
      skip,
    });

    res.json({ tasks });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/tasks/analytics/dashboard ───────────────────────────
// Dashboard-specific analytics: Velocity, Fulfillment Warnings, and Workload

router.get('/analytics/dashboard', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(now.getDate() - 30);

    // 1. Deliverable Velocity (Completed tasks in last 30 days grouped by date)
    const completedTasks = await prisma.deliverableTask.findMany({
      where: {
        status: 'COMPLETED',
        postedAt: { gte: thirtyDaysAgo },
      },
      select: { postedAt: true, id: true },
    });

    const velocityMap: Record<string, number> = {};
    completedTasks.forEach(t => {
      const dateKey = t.postedAt ? t.postedAt.toISOString().split('T')[0] : '';
      if (dateKey) velocityMap[dateKey] = (velocityMap[dateKey] || 0) + 1;
    });

    const velocity = Object.entries(velocityMap)
      .map(([date, count]) => ({ date, count }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // 2. Fulfillment Warnings (Cycles with progress < 50%)
    const allCycles = await prisma.subscriptionCycle.findMany({
      where: { tasksGenerated: true },
      include: {
        subscription: {
          select: {
            plan: true,
            client: { select: { name: true, company: true } },
          },
        },
        _count: { select: { deliverableTasks: true } },
      },
    });

    const cycleProgress = await Promise.all(
      allCycles.map(async (cycle) => {
        const completedCount = await prisma.deliverableTask.count({
          where: { cycleId: cycle.id, status: 'COMPLETED' },
        });
        return {
          id: cycle.id,
          label: cycle.label,
          client: cycle.subscription.client.company || cycle.subscription.client.name,
          plan: cycle.subscription.plan,
          progress: cycle._count.deliverableTasks > 0
            ? Math.round((completedCount / cycle._count.deliverableTasks) * 100)
            : 0,
          total: cycle._count.deliverableTasks,
          completed: completedCount,
        };
      })
    );

    const warnings = cycleProgress
      .filter(c => c.progress < 50 && c.total > 0)
      .sort((a, b) => a.progress - b.progress)
      .slice(0, 5);

    // 3. Team Workload (Active tasks per member)
    const members = await prisma.teamMember.findMany({
      where: { status: 'ACTIVE' },
      select: { id: true, name: true },
    });

    const workload = await Promise.all(
      members.map(async (member) => {
        const activeCount = await prisma.deliverableTask.count({
          where: {
            teamMemberId: member.id,
            status: { notIn: ['COMPLETED', 'CANCELLED'] },
          },
        });
        return {
          id: member.id,
          name: member.name,
          count: activeCount,
        };
      })
    );

    res.json({ velocity, warnings, workload });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/tasks/:id ───────────────────────────────────────────

router.get('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const task = await prisma.deliverableTask.findUnique({
      where: { id: req.params.id as string },
      include: taskIncludes,
    });
    if (!task) throw AppError.notFound('Task not found');
    res.json({ task });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/tasks ──────────────────────────────────────────────
// Manual task creation

router.post(
  '/',
  requireAdmin,
  validate({ body: taskCreateDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { platforms, dueDate, ...data } = req.body;

      const task = await prisma.deliverableTask.create({
        data: {
          ...data,
          dueDate: dueDate ? new Date(dueDate as string) : null,
          platforms: {
            create: platforms.map((p: string) => ({ platform: p as any })),
          },
        },
        include: taskIncludes,
      });

      if (task.contentPostId) {
        await prisma.contentPost.update({
          where: { id: task.contentPostId },
          data: { status: POST_STATUS_BY_TASK_STATUS[task.status] ?? 'DRAFT' },
        });
      }

      res.status(201).json({ task });
    } catch (error) {
      next(error);
    }
  }
);

// ─── POST /api/tasks/generate ─────────────────────────────────────
// Auto-generates tasks from package deliverables for a subscription cycle

router.post(
  '/generate',
  requireAdmin,
  validate({ body: generateDto }),
  async (req: Request, res: Response, next) => {
    try {
      const { subscriptionId, cycleStart, cycleEnd, label, useAi, prompt } = req.body;

      // 1. Fetch subscription with client, package → deliverables → platforms
      const subscription = await prisma.subscription.findUnique({
        where: { id: subscriptionId },
        include: {
          client: { include: { socialProfiles: true } },
          package: {
            include: {
              deliverables: {
                include: { platforms: true },
              },
            },
          },
        },
      });

      if (!subscription) throw AppError.notFound('Subscription not found');
      if (!subscription.package) throw AppError.badRequest('Subscription has no associated package');

      const deliverables = subscription.package.deliverables;
      if (deliverables.length === 0) {
        throw AppError.badRequest('Package has no deliverables defined. Add deliverables to the package first.');
      }

      // Always prefer all active connected platforms for this client.
      const connectedProfiles = await prisma.clientSocialProfile.findMany({
        where: { clientId: subscription.clientId, isActive: true },
        select: { platform: true },
        orderBy: { platform: 'asc' },
      });
      const connectedPlatforms = Array.from(new Set(connectedProfiles.map(p => p.platform)));
      if (connectedPlatforms.length === 0) {
        throw AppError.badRequest(
          'No connected social media platforms found for this client. Add Connected Platforms first.'
        );
      }
      const cycleStartDate = parseIsoDateOnly(cycleStart);
      const targetMonth = cycleStartDate.getUTCMonth() + 1;
      const targetYear = cycleStartDate.getUTCFullYear();

      // Block duplicate generation for the same subscription-month.
      const existingGeneratedCycles = await prisma.subscriptionCycle.findMany({
        where: {
          subscriptionId,
          tasksGenerated: true,
        },
        select: { id: true, label: true, cycleStart: true },
      });
      const duplicateMonth = existingGeneratedCycles.find((existing) => {
        const existingMonth = existing.cycleStart.getUTCMonth() + 1;
        const existingYear = existing.cycleStart.getUTCFullYear();
        return existingMonth === targetMonth && existingYear === targetYear;
      });
      if (duplicateMonth) {
        throw AppError.conflict(`Tasks already generated for ${label}. This month cannot be generated twice.`);
      }

      // 2. Create or find the subscription cycle (idempotent via unique constraint)
      let cycle = await prisma.subscriptionCycle.findFirst({
        where: {
          subscriptionId,
          cycleStart: new Date(cycleStart),
        },
      });

      if (cycle?.tasksGenerated) {
        throw AppError.conflict(`Tasks have already been generated for cycle "${label}"`);
      }

      if (!cycle) {
        cycle = await prisma.subscriptionCycle.create({
          data: {
            subscriptionId,
            cycleStart: new Date(cycleStart),
            cycleEnd: new Date(cycleEnd),
            label,
          },
        });
      }

      // ─── AI-powered or mechanical generation ────────────────────
      let tasksToCreate: any[] = [];

      if (useAi) {
        // Fetch API key
        const agencySettings = await prisma.agencySettings.findFirst();
        const apiKey = agencySettings?.openAiApiKey;
        if (!apiKey) {
          throw AppError.badRequest('OpenAI API key is not configured in Settings → Integrations. Please add it first.');
        }

        const client = subscription.client;
        const deliverablesDescription = deliverables.map(d =>
          `${d.quantity}x ${d.name} (${d.type})`
        ).join(', ');

        const totalTasks = deliverables.reduce((sum, d) => sum + d.quantity, 0);

        const cycleStartMs = new Date(cycleStart).getTime();
        const cycleEndMs = new Date(cycleEnd).getTime();
        const daysInCycle = Math.round((cycleEndMs - cycleStartMs) / (1000 * 60 * 60 * 24)) + 1;

        const systemPrompt = `You are an expert Social Media Manager creating a content calendar.
Return ONLY a valid JSON object with a "tasks" array. No markdown, no extra text.
Always honor the user's custom instructions unless they conflict with required output format or hard scheduling constraints.

Client Details:
- Name/Company: ${client.company || client.name}
- Industry: ${client.industry || 'Not specified'}
- Notes: ${client.notes || 'None'}
- Connected Platforms: ${connectedPlatforms.join(', ')}

CRITICAL SCHEDULING RULES:
1. You MUST distribute all ${totalTasks} pieces EVENLY across the exact cycle period (${cycleStart} to ${cycleEnd}).
2. Calculate the ideal gap: ${daysInCycle} days ÷ ${totalTasks} posts ≈ ${Math.max(1, Math.round(daysInCycle / totalTasks))} days between posts.
3. The very first post MUST be scheduled on or within 1-3 days after ${cycleStart}.
4. The very last post MUST be scheduled on or within 1-3 days before ${cycleEnd}.
5. NO CLUSTERING: Do not schedule multiple posts on the same day unless the total number of tasks exceeds the number of days in the cycle. Specifically, you MUST NOT schedule two pieces of the same type (e.g., two STORIES or two VIDEOS) on the same "publishDate". Each day should have a unique content mix.
6. VIDEO SHOOTS: All video/reel/motion content (TikTok, Reels, Youtube Shorts, etc.) MUST have their "shootingDate" planned within a total of ONLY 3 shooting days for the entire month.
7. SHOOT SPACING: These 3 shooting days MUST be spaced apart (NOT on consecutive days). For example, Tuesday, Thursday, and Saturday of a specific week, or spread across two weeks.
8. GRAPHICS & STORIES: For graphics, carousels, and story content, ONLY schedule a "publishDate". DO NOT include a "shootingDate" for these types of posts.
9. ABSOLUTELY ALL dates MUST be strictly between ${cycleStart} and ${cycleEnd} inclusive. If a calculated "shootingDate" would fall BEFORE ${cycleStart}, you MUST set the "shootingDate" to exactly ${cycleStart} and push the "publishDate" later so that NO date ever falls before ${cycleStart}.

For each deliverable, generate the exact number of content pieces specified.
Return this exact JSON structure:
{
  "tasks": [
    {
      "deliverableIndex": 0,
      "pieceIndex": 1,
      "notes": "Brief visual concept and caption idea — 1-2 sentences max",
      "publishDate": "YYYY-MM-DD"
      // NEVER include "shootingDate" UNLESS the piece is a video/reel AND the user's prompt allows it! Otherwise ignore the key.
    }
  ]
}

The deliverableIndex corresponds to this ordered list:
${deliverables.map((d, i) => `${i}: ${d.name} (${d.type}) — generate ${d.quantity} pieces`).join('\n')}`;

        const userPrompt = `Build the content plan for this cycle:
- Package Deliverables to fulfill: ${deliverablesDescription}
- Total content pieces to create: ${totalTasks}
- Cycle Period: ${cycleStart} to ${cycleEnd} (${label})
- Days in Cycle: ${daysInCycle}

User Instructions:
${prompt?.trim() ? prompt.trim() : 'No extra instructions provided by user.'}

Return only the required JSON object.`;

        const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'gpt-4o',
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
            max_tokens: 4000,
            temperature: 0.3,
            response_format: { type: 'json_object' },
          }),
        });

        if (!openaiRes.ok) {
          const errorData = await openaiRes.json().catch(() => ({})) as any;
          console.error('OpenAI API Error:', errorData);
          throw AppError.badRequest(`OpenAI API Error: ${errorData.error?.message || openaiRes.statusText}`);
        }

        const aiData = await openaiRes.json() as any;
        let aiTasks: any[] = [];
        try {
          const parsed = JSON.parse(aiData.choices[0].message.content);
          if (Array.isArray(parsed)) {
            aiTasks = parsed;
          } else if (parsed.tasks && Array.isArray(parsed.tasks)) {
            aiTasks = parsed.tasks;
          } else {
            const arrays = Object.values(parsed).filter(Array.isArray);
            if (arrays.length > 0) aiTasks = arrays[0] as any[];
            else throw new Error('Could not find tasks array in AI response');
          }
        } catch (e) {
          console.error('Failed to parse AI response:', aiData.choices?.[0]?.message?.content);
          throw AppError.badRequest('Failed to parse AI response. Please try again.');
        }

        // Map AI results back to tasks, preserving deliverable structure
        for (const aiTask of aiTasks) {
          const delIdx = aiTask.deliverableIndex ?? 0;
          const deliverable = deliverables[delIdx] || deliverables[0];
          const pieceIdx = String(aiTask.pieceIndex ?? 1).padStart(2, '0');

          tasksToCreate.push({
            clientId: subscription.clientId,
            subscriptionId: subscription.id,
            cycleId: cycle.id,
            title: `${deliverable.name} - ${pieceIdx}`,
            type: deliverable.type,
            status: 'PENDING' as const,
            clientVisible: true,
            platforms: connectedPlatforms,
            _aiPublishDate: aiTask.publishDate || null,
            _aiShootingDate: aiTask.shootingDate || null,
            _aiNotes: aiTask.notes || null,
          });
        }

        // If AI returned fewer items than expected, fill the rest mechanically
        const totalExpected = deliverables.reduce((s, d) => s + d.quantity, 0);
        if (tasksToCreate.length < totalExpected) {
          let created = tasksToCreate.length;
          for (const deliverable of deliverables) {
            const existing = tasksToCreate.filter((t: any) => t.type === deliverable.type).length;
            for (let i = existing + 1; i <= deliverable.quantity && created < totalExpected; i++) {
              const idx = String(i).padStart(2, '0');
              tasksToCreate.push({
                clientId: subscription.clientId,
                subscriptionId: subscription.id,
                cycleId: cycle.id,
                title: `${deliverable.name} - ${idx}`,
                type: deliverable.type,
                status: 'PENDING' as const,
                clientVisible: true,
                platforms: connectedPlatforms,
              });
              created++;
            }
          }
        }
      } else {
        // 3. Mechanical generation
        for (const deliverable of deliverables) {
          const platformList = connectedPlatforms;

          for (let i = 1; i <= deliverable.quantity; i++) {
            const idx = String(i).padStart(2, '0');
            tasksToCreate.push({
              clientId: subscription.clientId,
              subscriptionId: subscription.id,
              cycleId: cycle.id,
              title: `${deliverable.name} - ${idx}`,
              type: deliverable.type,
              status: 'PENDING' as const,
              clientVisible: true,
              platforms: platformList,
            });
          }
        }
      }

      // 4. Create linked planner posts + tasks in one transaction
      const cycleEndDate = parseIsoDateOnly(cycleEnd);

      if (useAi) {
        let validationErrors: string[] = [];
        const startMs = cycleStartDate.getTime();
        const endMs = cycleEndDate.getTime();

        const shootingDates = new Set<string>();
        const typeByDate = new Map<string, Set<string>>();
        const pieceCountByType = new Map<string, number>();

        for (const t of tasksToCreate) {
          const pDateStr = t._aiPublishDate;
          const kind = getContentKind(t);
          if (!pDateStr) {
            validationErrors.push(`Missing publish date for ${t.title}`);
            continue;
          }
          const pDate = parseIsoDateOnly(pDateStr).getTime();
          if (pDate < startMs || pDate > endMs) {
            validationErrors.push(`Publish date ${pDateStr} for ${t.title} is outside the cycle range`);
          }

          if (!typeByDate.has(pDateStr)) typeByDate.set(pDateStr, new Set());
          if (typeByDate.get(pDateStr)!.has(t.type)) {
            validationErrors.push(`Multiple ${t.type} pieces scheduled on the same day (${pDateStr})`);
          }
          typeByDate.get(pDateStr)!.add(t.type);

          if (t._aiShootingDate) {
            if (kind !== 'VIDEO') {
              validationErrors.push(`Shooting date is only allowed for video-like content, but received for ${t.title}`);
              continue;
            }
            const sDateStr = t._aiShootingDate;
            const sDate = parseIsoDateOnly(sDateStr).getTime();
            if (sDate < startMs || sDate > endMs) {
              validationErrors.push(`Shooting date ${sDateStr} for ${t.title} is outside the cycle range`);
            }
            shootingDates.add(sDateStr);
          }

          const match = t.title.match(/ - (\d+)$/);
          if (match) {
            const pieceIdx = parseInt(match[1], 10);
            const expected = (pieceCountByType.get(t.type) || 0) + 1;
            if (pieceIdx !== expected) {
              validationErrors.push(`Non-sequential numbering for ${t.type}: expected ${expected}, got ${pieceIdx}`);
            }
            pieceCountByType.set(t.type, expected);
          }
        }

        if (shootingDates.size > 3) {
          validationErrors.push(`Exceeded maximum allowed shooting days. Only up to 3 unique shooting days allowed, but AI scheduled ${shootingDates.size}.`);
        }

        const sortedShoots = Array.from(shootingDates).sort();
        for (let i = 0; i < sortedShoots.length - 1; i++) {
          const d1 = parseIsoDateOnly(sortedShoots[i]);
          const d2 = parseIsoDateOnly(sortedShoots[i+1]);
          const diff = Math.round((d2.getTime() - d1.getTime()) / (1000 * 3600 * 24));
          if (diff <= 1) {
            validationErrors.push(`Shooting days must be non-consecutive, but ${sortedShoots[i]} and ${sortedShoots[i+1]} are consecutive or identical.`);
          }
        }

        const allPublishDates = tasksToCreate
          .filter(t => t._aiPublishDate)
          .map(t => parseIsoDateOnly(t._aiPublishDate!).getTime())
          .sort((a,b) => a-b);

        if (allPublishDates.length > 1) {
          const firstDate = allPublishDates[0];
          const lastDate = allPublishDates[allPublishDates.length - 1];
          if (firstDate - startMs > 5 * 24 * 3600 * 1000) {
            validationErrors.push(`Unbalanced distribution: First post is scheduled too late.`);
          }
          if (endMs - lastDate > 5 * 24 * 3600 * 1000) {
            validationErrors.push(`Unbalanced distribution: Last post is scheduled too early.`);
          }
        }

        if (validationErrors.length > 0) {
          throw AppError.badRequest('AI Schedule Validation Failed:\n- ' + validationErrors.join('\n- '));
        }
      }

      const businessDays = enumerateBusinessDays(cycleStartDate, cycleEndDate);
      const distributionDays = businessDays.length > 0
        ? businessDays
        : enumerateDays(cycleStartDate, cycleEndDate);
      const taskUnits = useAi ? tasksToCreate.map(t => [t]) : buildMixedTaskOrder(tasksToCreate);

      const createdPosts: Array<{ id: string }> = [];
      const createdTasks = await prisma.$transaction(async (tx) => {
        const tasks: any[] = [];

        for (let slotIndex = 0; slotIndex < taskUnits.length; slotIndex++) {
          const unit = taskUnits[slotIndex];
          
          let fallbackPublishDate = toStartOfDay(cycleStartDate);
          if (!useAi) {
            const basePublishDate = getSpreadDate(slotIndex, taskUnits.length, distributionDays) ?? toStartOfDay(cycleStartDate);
            const hasStory = unit.some((u) => getContentKind(u) === 'STORY');
            const hasVideoLike = unit.some((u) => getContentKind(u) === 'VIDEO');
            const isStoryVideoPairUnit = hasStory && hasVideoLike;

            // For paired Story+Video units, keep one shared shoot day and publish next day.
            fallbackPublishDate = isStoryVideoPairUnit
              ? nextCalendarDay(basePublishDate, cycleEndDate)
              : basePublishDate;
          }

          for (let unitIndex = 0; unitIndex < unit.length; unitIndex++) {
            const item = unit[unitIndex];
            const { platforms: taskPlatforms, _aiPublishDate, _aiShootingDate, _aiNotes, ...taskData } = item;
            const kind = getContentKind(item);

            // Use AI dates if available, fall back to mechanical spread
            let publishDate: Date;
            let shootingDate: Date | null = null;

            if (useAi && _aiPublishDate) {
              publishDate = parseIsoDateOnly(_aiPublishDate);
              shootingDate = kind === 'VIDEO' && _aiShootingDate
                ? parseIsoDateOnly(_aiShootingDate)
                : null;
            } else {
              publishDate = fallbackPublishDate;
              // For mechanical, only assign a shooting date if it's a video (NOT story or general)
              shootingDate = kind === 'VIDEO'
                ? previousCalendarDay(publishDate, cycleStartDate)
                : null;
            }

            const postNotes = _aiNotes || `Auto-generated from cycle ${label}`;

            // Create planner rows across all connected platforms for each generated content piece.
            // The planner groups same title + dates, so this appears as one mixed-platform item.
            const postsForTask: Array<{ id: string }> = [];
            for (const platform of taskPlatforms) {
              const post = await tx.contentPost.create({
                data: {
                  clientId: subscription.clientId,
                  month: publishDate.getUTCMonth() + 1,
                  year: publishDate.getUTCFullYear(),
                  title: taskData.title,
                  platform: platform as any,
                  status: 'DRAFT',
                  shootingDate,
                  publishDate,
                  notes: postNotes,
                },
                select: { id: true },
              });
              postsForTask.push(post);
              createdPosts.push(post);
            }
            const primaryPostId = postsForTask[0]?.id;

            let task: any;
            try {
              task = await tx.deliverableTask.create({
                data: {
                  ...taskData,
                  ...(primaryPostId ? { contentPostId: primaryPostId } : {}),
                  internalNotes: _aiNotes || null,
                  platforms: {
                    create: taskPlatforms.map((p: string) => ({ platform: p as any })),
                  },
                },
                include: taskIncludes,
              });
            } catch (error) {
              // Backward compatibility: if Prisma client is stale and doesn't expose
              // contentPostId yet, create the task without hard link instead of failing
              // the entire generation flow.
              if (!isContentPostLinkUnavailableError(error)) throw error;
              task = await tx.deliverableTask.create({
                data: {
                  ...taskData,
                  internalNotes: _aiNotes || null,
                  platforms: {
                    create: taskPlatforms.map((p: string) => ({ platform: p as any })),
                  },
                },
                include: taskIncludes,
              });
            }

            tasks.push(task);
          }
        }

        return tasks;
      });

      // 5. Mark the cycle as generated
      await prisma.subscriptionCycle.update({
        where: { id: cycle.id },
        data: { tasksGenerated: true },
      });

      res.status(201).json({
        cycle,
        tasks: createdTasks,
        postsCreated: createdPosts.length,
        count: createdTasks.length,
      });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PUT /api/tasks/:id ───────────────────────────────────────────

router.put(
  '/:id',
  requireAdmin,
  validate({ body: taskUpdateDto }),
  async (req: Request, res: Response, next) => {
    try {
      const existing = await prisma.deliverableTask.findUnique({
        where: { id: req.params.id as string },
      });
      if (!existing) throw AppError.notFound('Task not found');

      const { platforms, dueDate, postedAt, ...data } = req.body;

      const task = await prisma.deliverableTask.update({
        where: { id: existing.id },
        data: {
          ...data,
          ...(dueDate !== undefined && {
            dueDate: dueDate ? new Date(dueDate as string) : null,
          }),
          ...(postedAt !== undefined && {
            postedAt: postedAt ? new Date(postedAt as string) : null,
          }),
          ...(platforms && {
            platforms: {
              deleteMany: {},
              create: platforms.map((p: string) => ({ platform: p as any })),
            },
          }),
        },
        include: taskIncludes,
      });

      if (task.contentPostId) {
        await prisma.contentPost.update({
          where: { id: task.contentPostId },
          data: { status: POST_STATUS_BY_TASK_STATUS[task.status] ?? 'DRAFT' },
        });
      }

      res.json({ task });
    } catch (error) {
      next(error);
    }
  }
);

// ─── PATCH /api/tasks/:id/complete ───────────────────────────────
// Dedicated endpoint for completing a task with proof of work

router.post(
  '/:id/complete',
  requireAdmin,
  uploadMedia.single('proof'),
  enforceMagicBytes({ kind: 'media' }),
  async (req: Request, res: Response, next) => {
    try {
      const { id } = req.params;
      const { postUrl, postedAt, clientNotes, clientVisible } = req.body;

      const existing = await prisma.deliverableTask.findUnique({ where: { id: id as string } });
      if (!existing) throw AppError.notFound('Task not found');

      const proofUrl = req.file ? `/uploads/media/${req.file.filename}` : undefined;

      const task = await prisma.deliverableTask.update({
        where: { id: id as string },
        data: {
          status: 'COMPLETED',
          postUrl: postUrl || null,
          postedAt: postedAt ? new Date(postedAt as string) : null,
          clientNotes: clientNotes || null,
          clientVisible: clientVisible === 'false' ? false : (clientVisible === 'true' ? true : undefined),
          ...(proofUrl && { proofUrl }),
        },
        include: taskIncludes,
      });

      if (task.contentPostId) {
        await prisma.contentPost.update({
          where: { id: task.contentPostId },
          data: { status: 'PUBLISHED' },
        });
      }

      res.json({ task });
    } catch (error) {
      next(error);
    }
  }
);

// ─── DELETE /api/tasks/:id ────────────────────────────────────────

router.delete('/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const existing = await prisma.deliverableTask.findUnique({
      where: { id: req.params.id as string },
    });
    if (!existing) throw AppError.notFound('Task not found');

    await prisma.deliverableTask.delete({ where: { id: existing.id } });
    res.json({ message: 'Task deleted' });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/tasks/cycles ────────────────────────────────────────
// List all subscription cycles, optionally filtered by subscriptionId

router.get('/cycles/list', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const where: any = {};
    if (req.query.subscriptionId) where.subscriptionId = String(req.query.subscriptionId);

    const cycles = await prisma.subscriptionCycle.findMany({
      where,
      include: {
        subscription: {
          select: {
            id: true,
            plan: true,
            client: { select: { id: true, name: true, company: true } },
          },
        },
        _count: { select: { deliverableTasks: true } },
      },
      orderBy: { cycleStart: 'desc' },
    });

    // Compute progress for each cycle
    const cyclesWithProgress = await Promise.all(
      cycles.map(async (cycle) => {
        const completedCount = await prisma.deliverableTask.count({
          where: { cycleId: cycle.id, status: 'COMPLETED' },
        });
        return {
          ...cycle,
          totalTasks: cycle._count.deliverableTasks,
          completedTasks: completedCount,
          progress: cycle._count.deliverableTasks > 0
            ? Math.round((completedCount / cycle._count.deliverableTasks) * 100)
            : 0,
        };
      })
    );

    res.json({ cycles: cyclesWithProgress });
  } catch (error) {
    next(error);
  }
});

// ─── DELETE /api/tasks/cycles/:id ──────────────────────────────────
// Delete a generated cycle with its tasks and auto-generated planner posts

router.delete('/cycles/:id', requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const cycleId = req.params.id as string;

    const cycle = await prisma.subscriptionCycle.findUnique({
      where: { id: cycleId },
      include: {
        subscription: {
          select: {
            id: true,
            clientId: true,
          },
        },
      },
    });

    if (!cycle) throw AppError.notFound('Cycle not found');

    const tasks = await prisma.deliverableTask.findMany({
      where: { cycleId },
      select: { id: true, contentPostId: true },
    });

    const linkedPostIds = Array.from(
      new Set(tasks.map(t => t.contentPostId).filter(Boolean) as string[])
    );

    const autoGeneratedPosts = await prisma.contentPost.findMany({
      where: {
        clientId: cycle.subscription.clientId,
        notes: `Auto-generated from cycle ${cycle.label}`,
        publishDate: {
          gte: cycle.cycleStart,
          lte: cycle.cycleEnd,
        },
      },
      select: { id: true },
    });

    const autoGeneratedPostIds = autoGeneratedPosts.map(p => p.id);
    const postIdsToDelete = Array.from(new Set([...linkedPostIds, ...autoGeneratedPostIds]));

    const deleted = await prisma.$transaction(async (tx) => {
      const deletedTasks = await tx.deliverableTask.deleteMany({
        where: { cycleId },
      });

      if (postIdsToDelete.length > 0) {
        await tx.contentPost.deleteMany({
          where: { id: { in: postIdsToDelete } },
        });
      }

      await tx.subscriptionCycle.delete({
        where: { id: cycleId },
      });

      return {
        tasks: deletedTasks.count,
        posts: postIdsToDelete.length,
      };
    });

    res.json({
      message: 'Cycle deleted',
      deleted,
    });
  } catch (error) {
    next(error);
  }
});

export default router;

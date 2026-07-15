import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { callAI, resolveProviderKey, buildToolResultMessage, type AiMessage } from '../lib/ai-provider.js';
import { AI_TOOLS, executeTool } from '../lib/ai-tools.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

// ─── /api/ai/status ─────────────────────────────────────────────────────────
// Returns which provider is active and whether its key is configured.

router.get('/status', async (req: Request, res: Response, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();
    const provider = (settings?.mainAiProvider || 'openai') as string;

    const keyMap: Record<string, string | null | undefined> = {
      openai: settings?.openAiApiKey,
      claude: settings?.claudeApiKey,
      gemini: settings?.geminiApiKey,
    };

    const hasKey = Boolean(keyMap[provider]);
    res.json({ provider, connected: hasKey });
  } catch (error) {
    next(error);
  }
});

// ─── /api/ai/chat ────────────────────────────────────────────────────────────
// Main chat endpoint — resolves provider, runs tool-calling loop, returns reply.

const chatDto = z.object({
  message: z.string().min(1).max(8000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      }),
    )
    .optional()
    .default([]),
  clientId: z.string().optional(), // optional context scope
});

router.post('/chat', validate({ body: chatDto }), async (req: Request, res: Response, next) => {
  try {
    const { message, history, clientId } = req.body;

    const settings = await prisma.agencySettings.findFirst();
    const { provider, apiKey } = resolveProviderKey(settings || {});

    // Build context preamble
    let systemContent = `You are an intelligent AI assistant for a marketing agency management system.
You have access to the following tools to fetch real agency data:
- summarize_file: Get info about a shared file
- draft_monthly_report: Pull monthly social media report data for a client and draft a summary
- summarize_financials: Summarize invoices and expenses for a client or project
- draft_client_email: Draft a professional email for a client based on their account status

IMPORTANT RULES:
- Only use tools when the user is clearly asking for data about a specific client, project, file, or report.
- All tool outputs are drafts only — you never send emails or execute anything automatically.
- If you use a tool, present the result clearly and ask if the user wants to refine it.
- Be concise and professional.`;

    if (clientId) {
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        select: { name: true, company: true },
      });
      if (client) {
        systemContent += `\n\nCurrent context: The user is working with client "${client.company || client.name}" (ID: ${clientId}).`;
      }
    }

    const messages: AiMessage[] = [
      { role: 'system', content: systemContent },
      ...(history as AiMessage[]),
      { role: 'user', content: message },
    ];

    // First call — model may respond with text or request a tool call
    let response = await callAI(provider, apiKey, messages, AI_TOOLS);

    // Tool-calling loop (max 3 iterations to prevent infinite loops)
    const toolsUsed: string[] = [];
    let iterations = 0;
    while (response.toolCalls && response.toolCalls.length > 0 && iterations < 3) {
      iterations++;

      // Execute all requested tools
      const toolResults: string[] = [];
      for (const toolCall of response.toolCalls) {
        toolsUsed.push(toolCall.name);
        const result = await executeTool(toolCall.name, toolCall.args);
        toolResults.push(result);

        // Feed the result back as a user message
        messages.push(
          buildToolResultMessage(provider, toolCall.id, toolCall.name, result),
        );
      }

      // Call the model again with tool results
      response = await callAI(provider, apiKey, messages, AI_TOOLS);
    }

    res.json({
      reply: response.content,
      provider: response.provider,
      model: response.model,
      toolsUsed: toolsUsed.length > 0 ? toolsUsed : undefined,
    });
  } catch (error) {
    next(error);
  }
});

// ─── /api/ai/generate-plan ───────────────────────────────────────────────────
// Social media content plan generation — uses the configured AI provider.

const generatePlanDto = z.object({
  clientId: z.string(),
  month: z.number().int().min(1).max(12),
  year: z.number().int().min(2000).max(2100),
  platforms: z.array(z.string()).min(1),
  numberOfPosts: z.number().int().min(1).max(31),
  tone: z.string().optional(),
  focusTopics: z.string().optional(),
});

router.post('/generate-plan', validate({ body: generatePlanDto }), async (req: Request, res: Response, next) => {
  try {
    const { clientId, month, year, platforms, numberOfPosts, tone, focusTopics } = req.body;

    const settings = await prisma.agencySettings.findFirst();
    const { provider, apiKey } = resolveProviderKey(settings || {});

    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { socialProfiles: true },
    });
    if (!client) throw AppError.notFound('Client not found');

    const existingPosts = await prisma.contentPost.findMany({ where: { clientId, month, year } });
    const existingTitles = existingPosts.map((p) => p.title).join(', ');

    const systemPrompt = `You are an expert Social Media Manager. Your task is to generate a comprehensive social media content plan for a month.
Return ONLY a valid JSON array of objects, with no markdown formatting or extra text.

Client Details:
Name/Company: ${client.company || client.name}
Industry: ${client.industry || 'Not specified'}
Notes: ${client.notes || 'None'}
Connected Profiles: ${client.socialProfiles.map((p) => p.platform).join(', ') || 'None'}

CRITICAL RULES FOR SCHEDULING AND DATES:
1. DISTRIBUTION: Distribute the ${numberOfPosts} posts evenly across the entire month of ${month}/${year}. Aim for consistent daily posting. Avoid overcrowding multiple posts on a single day. Crucially, you MUST NOT schedule two pieces of the same type (e.g., two STORIES) on the same "publishDate". Do not leave long gaps without content.
2. VIDEO SHOOTS: All video/reel/motion content (TikTok, Reels, Youtube Shorts, etc.) MUST have their "shootingDate" planned within a total of ONLY 3 shooting days for the entire month.
3. SHOOT SPACING: These 3 shooting days MUST be spaced apart (NOT on consecutive days). For example, Tuesday, Thursday, and Saturday of a specific week, or spread across two weeks.
4. GRAPHICS & STORIES: For graphics, carousels, and story content, ONLY schedule a "publishDate". DO NOT include a "shootingDate" for these types of posts.
5. DATE CLAMPING: All suggested dates (publish and shooting) MUST fall within the ${month}/${year} period.

Format each post as an object in a JSON array. Each object MUST have the following structure:
{
  "title": "A short, catchy internal title (e.g., 'Behind the scenes at HQ')",
  "platform": "One of the target platforms (e.g., INSTAGRAM, LINKEDIN, FACEBOOK, X, etc.)",
  "publishDate": "YYYY-MM-DD",
  "notes": "A brief description of the content, visual idea, and caption strategy",
  "shootingDate": "YYYY-MM-DD" // REQUIRED ONLY for videos/reels. MUST be one of the 3 chosen shooting days. Omit this key entirely for graphics and stories.
}`;

    const userPrompt = `Generate a monthly social media plan with these requirements:
- Month: ${month}
- Year: ${year}
- Target Platforms: ${platforms.join(', ')}
- Total Posts to Generate: ${numberOfPosts}
- Desired Tone: ${tone || 'Professional yet engaging'}
- Focus Topics/Campaigns: ${focusTopics || 'General brand awareness and engagement'}
- Existing posts to avoid duplicating: ${existingTitles || 'None'}

Follow these user preferences strictly while keeping the required JSON format.`;

    const response = await callAI(provider, apiKey, [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ]);

    let posts: unknown[] = [];
    try {
      const parsed = JSON.parse(response.content);
      if (Array.isArray(parsed)) {
        posts = parsed;
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        posts = parsed.posts;
      } else {
        const arrays = Object.values(parsed).filter(Array.isArray);
        if (arrays.length > 0) posts = arrays[0] as unknown[];
        else throw new Error('Could not find array in response');
      }
    } catch {
      throw AppError.badRequest('Failed to parse AI response. Please try again.');
    }

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

router.post('/test-connection', async (req: Request, res: Response, next) => {
  try {
    const settings = await prisma.agencySettings.findFirst();
    const { provider, apiKey } = resolveProviderKey(settings || {});
    const result = await callAI(provider, apiKey, [
      { role: 'user', content: 'Ping. Respond with exactly "Connected".' }
    ]);
    res.json({ success: true, reply: result.content });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message || 'API connection failed.' });
  }
});

export default router;


import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';

const router = Router();
router.use(authenticate);
router.use(requireAdmin);

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

    // 1. Check if AI key exists
    const settings = await prisma.agencySettings.findFirst();
    const apiKey = settings?.openAiApiKey;
    
    if (!apiKey) {
      throw AppError.badRequest('OpenAI API key is not configured in Settings. Please add it first.');
    }

    // 2. Fetch Client Info
    const client = await prisma.client.findUnique({
      where: { id: clientId },
      include: { socialProfiles: true }
    });

    if (!client) {
      throw AppError.notFound('Client not found');
    }

    // 3. Get existing posts for this month to avoid duplicates
    const existingPosts = await prisma.contentPost.findMany({
      where: { clientId, month, year }
    });
    const existingTitles = existingPosts.map(p => p.title).join(', ');

    // 4. Build prompt
    const systemPrompt = `You are an expert Social Media Manager. Your task is to generate a comprehensive social media content plan for a month.
Return ONLY a valid JSON array of objects, with no markdown formatting or extra text.

Client Details:
Name/Company: ${client.company || client.name}
Industry: ${client.industry || 'Not specified'}
Notes: ${client.notes || 'None'}
Connected Profiles: ${client.socialProfiles.map(p => p.platform).join(', ') || 'None'}

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

    // 5. Call OpenAI API
    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 3000,
        temperature: 0.3,
        response_format: { type: 'json_object' } // Instruct gpt to return json
      })
    });

    if (!openaiRes.ok) {
      const errorData = await openaiRes.json().catch(() => ({})) as any;
      console.error('OpenAI API Error:', errorData);
      throw AppError.badRequest(`OpenAI API Error: ${errorData.error?.message || openaiRes.statusText}`);
    }

    const data = await openaiRes.json() as any;
    let content = data.choices[0].message.content;
    
    // Parse the JSON array. Handle { "posts": [...] } wrapper if GPT added it
    let posts = [];
    try {
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed)) {
        posts = parsed;
      } else if (parsed.posts && Array.isArray(parsed.posts)) {
        posts = parsed.posts;
      } else {
        // Find array in object
        const arrays = Object.values(parsed).filter(Array.isArray);
        if (arrays.length > 0) {
          posts = arrays[0];
        } else {
            throw new Error("Could not find array in response");
        }
      }
    } catch (e) {
      console.error("Failed to parse OpenAI response:", content);
      throw AppError.badRequest('Failed to parse AI response. Please try again.');
    }

    res.json({ posts });
  } catch (error) {
    next(error);
  }
});

export default router;

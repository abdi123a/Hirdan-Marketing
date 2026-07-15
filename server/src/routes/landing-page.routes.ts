import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { PATHS } from '../lib/paths.js';
import { enforceMagicBytes } from '../lib/upload.js';

// Configure multer storage for public landing page assets (stored in public branding folder)
const storage = multer.diskStorage({
  destination: (_req: any, _file: any, cb: any) => {
    cb(null, PATHS.BRANDING);
  },
  filename: (_req: any, file: any, cb: any) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'lp-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req: any, file: any, cb: any) => {
    const allowedExtensions = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (file.mimetype.startsWith('image/') && allowedExtensions.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed (.png, .jpg, .jpeg, .webp, .gif)'));
    }
  }
});

const router = Router();

// Zod schema for updating static landing page content
// Default Landing Page Content Constants for Hirdan Marketing
const DEFAULT_HERO_DESC = "Hirdan Marketing helps businesses build their brand, grow their audience, and turn attention into actual sales — through strategy, design, and content that works.";
const DEFAULT_ABOUT_DESC = "Hirdan Marketing is a full-service digital marketing agency helping businesses grow their visibility, attract new customers, and increase sales. We bring together strategy, design, and content under one team, so every part of your presence works toward the same goal.";
const DEFAULT_ABOUT_BULLETS = "Consistent, high-quality content,Clear reporting on real performance";
const DEFAULT_PROCESS_1_DESC = "We start by understanding your business, your audience, and your goals.";
const DEFAULT_PROCESS_2_DESC = "We build a plan tailored to your brand and your market.";
const DEFAULT_PROCESS_3_DESC = "We create and publish consistently, on the platforms that matter most.";
const DEFAULT_PROCESS_4_DESC = "Every month, you receive a clear report on performance and next steps.";
const DEFAULT_CTA_DESC = "Branding, content, and strategy — all handled by one team.";
const DEFAULT_SEO_DESC = "Hirdan Marketing is a premium digital marketing agency that helps businesses of all sizes grow and stay ahead with data-driven strategies.";
const DEFAULT_SEO_KEYWORDS = "digital marketing, branding, agency, content creation, social media marketing, Djibouti";

const DEFAULT_SERVICES = [
  { "title": "Graphic Design", "description": "Logos, branding, flyers, and posters that give your business a polished, professional identity.", "icon": "flaticon-graphic-design" },
  { "title": "Social Media Marketing", "description": "Strategy, scheduled posting, and advertising that keeps your brand active and growing.", "icon": "flaticon-social-media" },
  { "title": "Content Creation & Copywriting", "description": "Visuals and messaging built to capture attention and drive action.", "icon": "flaticon-copy-writing" },
  { "title": "Website Development", "description": "Modern, responsive websites designed to turn visitors into customers.", "icon": "flaticon-software-development" },
  { "title": "Photography", "description": "Professional, high-quality imagery for your products, team, and events.", "icon": "flaticon-camera" },
  { "title": "Videography", "description": "Promotional videos and storytelling content built to be shared.", "icon": "flaticon-video" }
];

const DEFAULT_FAQS = [
  { "question": "What size of business do you work with?", "answer": "All sizes — from independent shops to larger organizations." },
  { "question": "What platforms do you manage?", "answer": "Facebook, Instagram, TikTok, LinkedIn, Twitter/X, and YouTube Shorts, depending on your package." },
  { "question": "What does it cost to get started?", "answer": "Our Starter Package begins at 120,000 FDJ/month." },
  { "question": "Do you offer content in multiple languages?", "answer": "Yes — tailored to whichever your audience responds to best." },
  { "question": "Do I need a website, or is social media enough?", "answer": "Depends on your goals — we'll give an honest recommendation." },
  { "question": "How do you measure success?", "answer": "A monthly report showing what was done and how it performed." }
];

const DEFAULT_PACKAGES = [
  {
    "name": "Starter",
    "price": "120,000 FDJ/month",
    "bestFor": "businesses wanting credibility and consistent visibility.",
    "features": [
      "3 Platforms",
      "10 Posts/month",
      "2 Stories/week",
      "Basic Community Management",
      "Hashtag & Post Optimization",
      "Monthly Report"
    ]
  },
  {
    "name": "Growth",
    "price": "160,000 FDJ/month",
    "bestFor": "brands that want to grow aggressively.",
    "features": [
      "4 Platforms",
      "12 Posts/month",
      "3 Stories/week",
      "Active Community Management",
      "3 Targeted Ad Campaigns/month",
      "Branded Visual Identity",
      "$50 Ads Credit",
      "Detailed Monthly Report"
    ]
  },
  {
    "name": "Premium",
    "price": "199,000 FDJ/month",
    "bestFor": "businesses that want to lead their industry online.",
    "features": [
      "5 Platforms",
      "16–20 Premium Posts/month",
      "5 Stories/week",
      "Full Community Management",
      "Creative Campaigns & Storytelling",
      "Up to 9 Ad Campaigns/month",
      "$100 Ads Credit",
      "Monthly Report + Strategy Meetings"
    ]
  }
];

const DEFAULT_ABOUT_MISSION_DESC = "We combine strategy, design, and content to help our clients stand out and grow — with results you can actually measure.";
const DEFAULT_ABOUT_MISSION_BULLETS = "Build Your Brand's Online Presence — with consistency and creativity across every channel.,Create Content That Connects — messaging that speaks directly to your audience.,Deliver Measurable Growth — results that help you sell more and scale faster.";
const DEFAULT_ABOUT_STATS = [
  "15+ Businesses We've Worked With",
  "8+ Years Of Industry Experience",
  "6 Core Services",
  "3 Packages To Fit Any Budget"
];

// Zod schema for updating static landing page content
const updateContentSchema = z.object({
  heroImageUrl: z.string().optional(),
  heroShapeImageUrl: z.string().optional(),
  heroBadgeImageUrl: z.string().optional(),
  aboutImageUrl: z.string().optional(),
  contactImageUrl: z.string().optional(),
  trustImageUrl: z.string().optional(),
  clientLogos: z.array(z.string()).optional(),
  heroSubtitle: z.string().min(1),
  heroTitle: z.string().min(1),
  heroDescription: z.string().optional().nullable(),
  heroBtn1Text: z.string().min(1),
  heroBtn2Text: z.string().min(1),
  heroAwardNumber: z.string().optional().nullable(),
  heroAwardLabel: z.string().min(1),
  aboutSubtitle: z.string().min(1),
  aboutTitle: z.string().min(1),
  aboutDescription: z.string().optional().nullable(),
  aboutBullets: z.string().optional().nullable(),
  aboutCampaigns: z.string().min(1),
  aboutClients: z.string().min(1),
  processSubtitle: z.string().min(1),
  processTitle: z.string().min(1),
  process1Title: z.string().min(1),
  process1Desc: z.string().optional().nullable(),
  process2Title: z.string().min(1),
  process2Desc: z.string().optional().nullable(),
  process3Title: z.string().min(1),
  process3Desc: z.string().optional().nullable(),
  process4Title: z.string().min(1),
  process4Desc: z.string().optional().nullable(),
  ctaSubtitle: z.string().min(1),
  ctaTitle: z.string().min(1),
  ctaDescription: z.string().optional().nullable(),
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional().nullable(),
  seoKeywords: z.string().optional().nullable(),
  seoImage: z.string().optional(),
  servicesJson: z.any().optional(),
  faqsJson: z.any().optional(),
  packagesJson: z.any().optional(),
  footerTagline: z.string().optional(),
  aboutMissionTitle: z.string().optional(),
  aboutMissionDesc: z.string().optional().nullable(),
  aboutMissionBullets: z.string().optional().nullable(),
  aboutStatsJson: z.any().optional(),
});

// Zod schema for case studies
const caseStudySchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1),
});

// Zod schema for landing page projects
const landingPageProjectSchema = z.object({
  title: z.string().min(1),
  category: z.string().min(1),
  description: z.string().min(1),
  imageUrl: z.string().min(1),
  imageUrl2: z.string().optional().nullable(),
  imageUrl3: z.string().optional().nullable(),
  imageUrl4: z.string().optional().nullable(),
  clientName: z.string().optional().nullable(),
  projectDate: z.string().optional().nullable(),
  location: z.string().optional().nullable(),
  duration: z.string().optional().nullable(),
  sections: z.array(z.object({
    title: z.string(),
    content: z.string(),
    bullets: z.array(z.string()).optional()
  })).optional().nullable(),
});

// Zod schema for testimonials
const testimonialSchema = z.object({
  name: z.string().min(1),
  role: z.string().min(1),
  feedback: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  avatarUrl: z.string().optional().nullable(),
});

// ─── GET /api/landing-page/content ───────────────────────────────────────
// PUBLIC endpoint to get all SMM landing page content
router.get('/content', async (req: Request, res: Response, next) => {
  try {
    // 1. Get or create static landing page content row
    let content = await prisma.landingPageContent.findUnique({
      where: { id: 'default' }
    });

    if (!content) {
      content = await prisma.landingPageContent.create({
        data: { id: 'default' }
      });
    }

    // Dynamic checks to initialize NULL TEXT/JSON fields or change standard templates to Hirdan Marketing
    let needsUpdate = false;
    const updateData: any = {};

    const checkAndFill = (field: string, defaultValue: any, isJson = false) => {
      let isValEmpty = false;
      const currentVal = (content as any)[field];
      if (isJson) {
        isValEmpty = !currentVal || (Array.isArray(currentVal) && currentVal.length === 0) || (typeof currentVal === 'string' && currentVal === '[]');
      } else {
        isValEmpty = !currentVal;
      }

      if (isValEmpty) {
        (content as any)[field] = defaultValue;
        updateData[field] = defaultValue;
        needsUpdate = true;
      }
    };

    checkAndFill('heroDescription', DEFAULT_HERO_DESC);
    checkAndFill('aboutDescription', DEFAULT_ABOUT_DESC);
    checkAndFill('aboutBullets', DEFAULT_ABOUT_BULLETS);
    checkAndFill('process1Desc', DEFAULT_PROCESS_1_DESC);
    checkAndFill('process2Desc', DEFAULT_PROCESS_2_DESC);
    checkAndFill('process3Desc', DEFAULT_PROCESS_3_DESC);
    checkAndFill('process4Desc', DEFAULT_PROCESS_4_DESC);
    checkAndFill('ctaDescription', DEFAULT_CTA_DESC);
    checkAndFill('seoDescription', DEFAULT_SEO_DESC);
    checkAndFill('seoKeywords', DEFAULT_SEO_KEYWORDS);
    checkAndFill('aboutMissionDesc', DEFAULT_ABOUT_MISSION_DESC);
    checkAndFill('aboutMissionBullets', DEFAULT_ABOUT_MISSION_BULLETS);
    
    checkAndFill('servicesJson', DEFAULT_SERVICES, true);
    checkAndFill('faqsJson', DEFAULT_FAQS, true);
    checkAndFill('packagesJson', DEFAULT_PACKAGES, true);
    checkAndFill('aboutStatsJson', DEFAULT_ABOUT_STATS, true);

    // Default template replacements for Hirdan Marketing details
    if (content.heroSubtitle === "Social Media Marketing") {
      content.heroSubtitle = "Digital Marketing Agency";
      updateData.heroSubtitle = "Digital Marketing Agency";
      needsUpdate = true;
    }
    if (content.heroTitle === "Growth With High-Impact Social Media") {
      content.heroTitle = "Marketing That Builds Real Growth";
      updateData.heroTitle = "Marketing That Builds Real Growth";
      needsUpdate = true;
    }
    if (content.heroBtn1Text === "Boost My Social Media") {
      content.heroBtn1Text = "Get A Quote";
      updateData.heroBtn1Text = "Get A Quote";
      needsUpdate = true;
    }
    if (content.heroAwardLabel === "Happy Client") {
      content.heroAwardLabel = "Trusted by 15+ businesses and organizations";
      updateData.heroAwardLabel = "Trusted by 15+ businesses and organizations";
      needsUpdate = true;
    }
    if (content.heroAwardNumber === "2K+") {
      content.heroAwardNumber = "";
      updateData.heroAwardNumber = "";
      needsUpdate = true;
    }
    if (content.aboutSubtitle === "About SEOX") {
      content.aboutSubtitle = "Who We Are";
      updateData.aboutSubtitle = "Who We Are";
      needsUpdate = true;
    }
    if (content.aboutTitle === "Helping Business All Size Stay Ahead Social Media") {
      content.aboutTitle = "A Full-Service Digital Marketing Agency";
      updateData.aboutTitle = "A Full-Service Digital Marketing Agency";
      needsUpdate = true;
    }
    if (content.processSubtitle === "Our Seamless Process") {
      content.processSubtitle = "How We Work";
      updateData.processSubtitle = "How We Work";
      needsUpdate = true;
    }
    if (content.processTitle === "Our Step-by-Step Approach") {
      content.processTitle = "A Process Built On Strategy, Not Guesswork";
      updateData.processTitle = "A Process Built On Strategy, Not Guesswork";
      needsUpdate = true;
    }
    if (content.process1Title === "Consultation Discovery") {
      content.process1Title = "Discovery";
      updateData.process1Title = "Discovery";
      needsUpdate = true;
    }
    if (content.process2Title === "Design And Development") {
      content.process2Title = "Strategy";
      updateData.process2Title = "Strategy";
      needsUpdate = true;
    }
    if (content.process3Title === "Continuous Improvement") {
      content.process3Title = "Content & Publishing";
      updateData.process3Title = "Content & Publishing";
      needsUpdate = true;
    }

    if (content.ctaSubtitle === "tailored social strategies") {
      content.ctaSubtitle = "Let's Work Together";
      updateData.ctaSubtitle = "Let's Work Together";
      needsUpdate = true;
    }
    if (content.ctaTitle === "Results Driven Marketing For Your Social Business") {
      content.ctaTitle = "Ready To Grow Your Brand? Let's Start Today.";
      updateData.ctaTitle = "Ready To Grow Your Brand? Let's Start Today.";
      needsUpdate = true;
    }
    if (content.seoTitle === "SEOX - High-Impact Social Media Marketing Agency") {
      content.seoTitle = "Hirdan Marketing - Digital Marketing Agency";
      updateData.seoTitle = "Hirdan Marketing - Digital Marketing Agency";
      needsUpdate = true;
    }

    if (needsUpdate) {
      content = await prisma.landingPageContent.update({
        where: { id: 'default' },
        data: updateData
      });
    }

    // 2. Fetch list of services
    const services = await prisma.service.findMany({
      where: { status: 'AVAILABLE' },
      orderBy: { name: 'asc' }
    });

    // 3. Fetch active team members
    const teamMembers = await prisma.teamMember.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { name: 'asc' }
    });

    // 4. Fetch case studies
    const caseStudies = await prisma.caseStudy.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // 5. Fetch landing page projects
    const projects = await prisma.landingPageProject.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // 6. Fetch testimonials
    const testimonials = await prisma.testimonial.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // 7. Fetch general agency details for contact and branding
    const settings = await prisma.agencySettings.findFirst();

    res.json({
      content,
      services,
      teamMembers,
      caseStudies,
      projects,
      testimonials,
      settings: settings ? {
        agencyName: settings.agencyName,
        logo: settings.logo,
        whiteLogo: settings.whiteLogo,
        favicon: settings.favicon,
        phone: settings.phone,
        adminEmail: settings.adminEmail,
        address: settings.address,
        socialLinks: settings.socialLinks,
      } : null
    });
  } catch (error) {
    next(error);
  }
});

// ─── PUT /api/landing-page/content ───────────────────────────────────────
// ADMIN route to update static sections content
router.put('/content', authenticate, requireAdmin, validate({ body: updateContentSchema }), async (req: Request, res: Response, next) => {
  try {
    const updated = await prisma.landingPageContent.upsert({
      where: { id: 'default' },
      update: req.body,
      create: { id: 'default', ...req.body }
    });
    res.json({ content: updated, message: 'Landing page content updated successfully!' });
  } catch (error) {
    next(error);
  }
});

// ─── UPLOAD IMAGE ENDPOINT ──────────────────────────────────────────────
// ADMIN route to upload public images
router.post('/upload', authenticate, requireAdmin, upload.single('image'), enforceMagicBytes({ kind: 'media' }), async (req: Request, res: Response, next) => {
  try {
    if (!req.file) {
      res.status(400).json({ error: 'No file uploaded' });
      return;
    }
    const publicUrl = `/uploads/branding/${req.file.filename}`;
    res.json({ url: publicUrl });
  } catch (error) {
    next(error);
  }
});

// ─── CASE STUDIES CRUD ──────────────────────────────────────────────────

router.post('/case-studies', authenticate, requireAdmin, validate({ body: caseStudySchema }), async (req: Request, res: Response, next) => {
  try {
    const record = await prisma.caseStudy.create({ data: req.body });
    res.status(201).json({ caseStudy: record });
  } catch (error) {
    next(error);
  }
});

router.put('/case-studies/:id', authenticate, requireAdmin, validate({ body: caseStudySchema }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.caseStudy.update({
      where: { id },
      data: req.body
    });
    res.json({ caseStudy: record });
  } catch (error) {
    next(error);
  }
});

router.delete('/case-studies/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.caseStudy.findUnique({ where: { id } });
    if (record?.imageUrl) {
      // Safely delete file from disk if it was uploaded locally
      const filename = path.basename(record.imageUrl);
      const filePath = path.resolve(PATHS.BRANDING, filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    await prisma.caseStudy.delete({ where: { id } });
    res.json({ message: 'Case study deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── Landing Page Projects ───────────────────────────────────────────────────

router.post('/projects', authenticate, requireAdmin, validate({ body: landingPageProjectSchema }), async (req: Request, res: Response, next) => {
  try {
    const record = await prisma.landingPageProject.create({ data: req.body });
    res.status(201).json({ project: record });
  } catch (error) {
    next(error);
  }
});

router.put('/projects/:id', authenticate, requireAdmin, validate({ body: landingPageProjectSchema }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.landingPageProject.update({
      where: { id },
      data: req.body
    });
    res.json({ project: record });
  } catch (error) {
    next(error);
  }
});

router.delete('/projects/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.landingPageProject.findUnique({ where: { id } });
    if (record?.imageUrl) {
      // Safely delete file from disk if it was uploaded locally
      const filename = path.basename(record.imageUrl);
      const filePath = path.resolve(PATHS.BRANDING, filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    await prisma.landingPageProject.delete({ where: { id } });
    res.json({ message: 'Project deleted successfully' });
  } catch (error) {
    next(error);
  }
});

// ─── TESTIMONIALS CRUD ──────────────────────────────────────────────────

router.post('/testimonials', authenticate, requireAdmin, validate({ body: testimonialSchema }), async (req: Request, res: Response, next) => {
  try {
    const record = await prisma.testimonial.create({ data: req.body });
    res.status(201).json({ testimonial: record });
  } catch (error) {
    next(error);
  }
});

router.put('/testimonials/:id', authenticate, requireAdmin, validate({ body: testimonialSchema }), async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.testimonial.update({
      where: { id },
      data: req.body
    });
    res.json({ testimonial: record });
  } catch (error) {
    next(error);
  }
});

router.delete('/testimonials/:id', authenticate, requireAdmin, async (req: Request, res: Response, next) => {
  try {
    const id = req.params.id as string;
    const record = await prisma.testimonial.findUnique({ where: { id } });
    if (record?.avatarUrl) {
      // Safely delete file from disk if it was uploaded locally
      const filename = path.basename(record.avatarUrl);
      const filePath = path.resolve(PATHS.BRANDING, filename);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch {}
      }
    }
    await prisma.testimonial.delete({ where: { id } });
    res.json({ message: 'Testimonial deleted successfully' });
  } catch (error) {
    next(error);
  }
});

export default router;

import { Router, Request, Response, NextFunction } from "express";
import multer, { MulterError } from "multer";
import path from "path";
import fs from "fs";
import crypto from "crypto";
import { ZipArchive } from "archiver";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { prisma } from "../lib/prisma.js";
import { authenticate, requireRole } from "../middleware/auth.js";
import { PATHS } from "../lib/paths.js";
import { sendEmail, generateEmailHtml } from "../lib/email.js";
import { AppError } from "../lib/errors.js";
import { env } from "../config/env.js";
import { getShortShareUrl } from "../lib/short-url.js";

// ---- Helpers --------------------------------------------------------

/** Ensure a resolved path is still inside UPLOAD_DIR to prevent path traversal. */
function assertInsideUploadDir(fullPath: string): void {
  const normalized = path.normalize(fullPath);
  if (!normalized.startsWith(UPLOAD_DIR + path.sep) && normalized !== UPLOAD_DIR) {
    throw AppError.badRequest("Invalid file path.");
  }
}

/** Minimal HTML escaping to prevent injection in email bodies. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Sanitizes rich-text HTML from the frontend to only allow safe inline
 * formatting tags (b, strong, i, em, u, s, ul, ol, li, br, p).
 * Strips all attributes except those on safe tags, and removes script/style/etc.
 */
function sanitizeRichText(html: string): string {
  // Remove all dangerous tags entirely (script, style, iframe, object, etc.)
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/<object[\s\S]*?>/gi, "")
    .replace(/<embed[\s\S]*?>/gi, "")
    .replace(/<form[\s\S]*?<\/form>/gi, "")
    .replace(/<input[\s\S]*?>/gi, "")
    .replace(/<link[\s\S]*?>/gi, "")
    .replace(/<meta[\s\S]*?>/gi, "");

  // Strip all HTML attributes from all remaining tags EXCEPT safe ones (keeps whitelist of tags and attributes)
  const noAttribs = stripped.replace(/<(\w+)([^>]*?)(\/?)>/g, (_match: string, tag: string, attrs: string, selfClose: string) => {
    const safeTags = new Set(["b","strong","i","em","u","s","strike","ul","ol","li","br","p","span","div","font"]);
    if (safeTags.has(tag.toLowerCase())) {
      const allowedAttrs: string[] = [];
      const styleMatch = attrs.match(/style\s*=\s*["']([^"']*)["']/i);
      const faceMatch = attrs.match(/face\s*=\s*["']([^"']*)["']/i);
      const colorMatch = attrs.match(/color\s*=\s*["']([^"']*)["']/i);
      if (styleMatch) allowedAttrs.push(styleMatch[0]);
      if (faceMatch) allowedAttrs.push(faceMatch[0]);
      if (colorMatch) allowedAttrs.push(colorMatch[0]);
      const attrStr = allowedAttrs.length > 0 ? " " + allowedAttrs.join(" ") : "";
      return `<${tag.toLowerCase()}${attrStr}${selfClose}>`;
    }
    return ""; // strip unknown/unsafe opening tags
  });

  // Also strip closing tags not in our whitelist
  const cleanClosing = noAttribs.replace(/<\/(\w+)>/g, (_match: string, tag: string) => {
    const safeTags = new Set(["b","strong","i","em","u","s","strike","ul","ol","li","p","span","div","font"]);
    if (safeTags.has(tag.toLowerCase())) return `</${tag.toLowerCase()}>`;
    return "";
  });

  return cleanClosing.trim();
}

/** Generates a unique, short alphanumeric share ID. */
async function generateUniqueShareId(): Promise<string> {
  const length = 8;
  const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let attempts = 0;
  while (attempts < 10) {
    const bytes = crypto.randomBytes(length);
    let shareId = "";
    for (let i = 0; i < length; i++) {
      shareId += chars[bytes[i] % chars.length];
    }
    // Check if it already exists in the DB
    const exists = await prisma.sharedFile.findUnique({
      where: { shareId },
    });
    if (!exists) {
      return shareId;
    }
    attempts++;
  }
  // Fallback to substring of UUID if we keep colliding
  return crypto.randomUUID().substring(0, length);
}

const router = Router();

// ---- Storage config ----------------------------------------------------
const UPLOAD_DIR = PATHS.TRANSFERS;

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const randomName = crypto.randomUUID();
    const ext = path.extname(file.originalname);
    cb(null, `${randomName}${ext}`);
  },
});

/** Executable / server-side script extensions that must never be stored. */
const BLOCKED_EXTENSIONS = new Set([
  ".exe", ".sh", ".bash", ".bat", ".cmd", ".ps1",
  ".php", ".php3", ".php4", ".php5", ".phtml",
  ".py", ".rb", ".pl", ".cgi", ".asp", ".aspx",
  ".js", ".mjs", ".cjs", ".ts", ".jsx", ".tsx",
  ".msi", ".dll", ".so", ".dylib", ".jar",
  ".html", ".htm", ".xhtml",
  ".svg",  // SVG can embed arbitrary JS
]);

/**
 * Keep these in step with `client_max_body_size` on the nginx `/api/` proxy
 * locations. nginx rejects an oversized body itself, before Express ever sees
 * it, so a cap raised here alone changes nothing in production.
 */
const MAX_FILE_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB per individual file
const MAX_FILES = 300;                        // max files per upload

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
    files: MAX_FILES,
  },
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) {
      return cb(new Error(`File type "${ext}" is not allowed for transfer.`));
    }
    cb(null, true);
  },
});

/**
 * Runs the multer middleware, translating its rejections into `AppError`s.
 *
 * Multer reports failures either as a `MulterError` (size and count limits) or
 * as the plain `Error` our `fileFilter` raises. Neither is operational, so the
 * global error handler replaces the message with a bare 500 "Internal server
 * error" — the uploader is never told whether the file was too large, too many,
 * or a blocked type. Each case below is already safe to show a user.
 */
function uploadFiles(req: Request, res: Response, next: NextFunction): void {
  upload.array("file", MAX_FILES)(req, res, (err: unknown) => {
    if (!err) return next();

    if (err instanceof MulterError) {
      switch (err.code) {
        case "LIMIT_FILE_SIZE":
          return next(new AppError(`Each file must be ${formatBytes(MAX_FILE_SIZE)} or smaller.`, 413));
        case "LIMIT_FILE_COUNT":
        case "LIMIT_UNEXPECTED_FILE":
          return next(AppError.badRequest(`You can upload at most ${MAX_FILES} files at once.`));
        default:
          return next(AppError.badRequest(`Upload rejected: ${err.message}`));
      }
    }

    return next(AppError.badRequest(err instanceof Error ? err.message : "Upload rejected."));
  });
}

/** Zip an array of files into a single archive, resolves with the final byte count. */
function zipFiles(files: Express.Multer.File[], zipPath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(zipPath);
    const archive = new ZipArchive({ zlib: { level: 6 } }) as any;
    archive.on("error", (err: Error) => reject(err));
    output.on("close", () => resolve(archive.pointer()));
    archive.pipe(output);
    for (const f of files) {
      archive.file(f.path, { name: f.originalname });
    }
    archive.finalize();
  });
}

/** Dedicated rate limiter for the upload endpoint (30 uploads / hour per IP). */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  message: { error: true, message: "Upload limit reached. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

const uploadBodySchema = z.object({
  expiryDays: z.coerce.number().int().min(1).max(365).optional(),
  expiryValue: z.coerce.number().int().min(1).max(365).optional(), // ← max 365 days / equivalent
  expiryUnit: z.enum(["minutes", "hours", "days"]).optional(),
  clientId: z.string().optional(),
  message: z.string().max(500).optional(),
});

const renewBodySchema = z.object({
  expiryValue: z.coerce.number().int().min(1).max(365),
  expiryUnit: z.enum(["minutes", "hours", "days"]),
});

const updateBodySchema = z.object({
  expiryValue: z.coerce.number().int().min(1).max(365).optional(),
  expiryUnit: z.enum(["minutes", "hours", "days"]).optional(),
  clientId: z.string().nullable().optional(),
  message: z.string().max(5000).nullable().optional(),
});


// ---- POST /api/transfer/upload ------------------------------------------
// Protected — only logged-in admin/manager/staff can create a transfer link.
router.post(
  "/upload",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  uploadLimiter,
  uploadFiles,
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    const uploadedFiles = (req.files as Express.Multer.File[]) ?? [];
    try {
      if (uploadedFiles.length === 0) {
        return next(AppError.badRequest("No file provided."));
      }

      const parsed = uploadBodySchema.safeParse(req.body);
      if (!parsed.success) {
        for (const f of uploadedFiles) {
          try { fs.unlinkSync(f.path); } catch {}
        }
        return next(AppError.badRequest("Validation failed"));
      }

      const { expiryDays, expiryValue, expiryUnit, clientId, message } = parsed.data;
      const expiresAt = new Date();
      
      if (expiryValue && expiryUnit) {
        if (expiryUnit === "minutes") {
          expiresAt.setMinutes(expiresAt.getMinutes() + expiryValue);
        } else if (expiryUnit === "hours") {
          expiresAt.setHours(expiresAt.getHours() + expiryValue);
        } else {
          expiresAt.setDate(expiresAt.getDate() + expiryValue);
        }
      } else {
        const days = expiryDays || 7;
        expiresAt.setDate(expiresAt.getDate() + days);
      }

      let storedFileName: string;
      let originalFileName: string;
      let fileSize: number;
      let mimeType: string;

      if (uploadedFiles.length === 1) {
        // Single file — store directly
        const f = uploadedFiles[0];
        storedFileName = f.filename;
        originalFileName = f.originalname;
        fileSize = f.size;
        mimeType = f.mimetype;
      } else {
        // Multiple files — zip them
        const zipName = `${crypto.randomUUID()}.zip`;
        const zipPath = path.join(UPLOAD_DIR, zipName);
        const zipSize = await zipFiles(uploadedFiles, zipPath);
        // Remove individual temp files
        for (const f of uploadedFiles) {
          try { fs.unlinkSync(f.path); } catch {}
        }
        storedFileName = zipName;
        originalFileName = `files-${uploadedFiles.length}.zip`;
        fileSize = zipSize;
        mimeType = "application/zip";
      }

      const shareId = await generateUniqueShareId();

      const record = await prisma.sharedFile.create({
        data: {
          shareId,
          fileName: originalFileName,
          storedName: storedFileName,
          filePath: storedFileName, // stored relative to UPLOAD_DIR
          fileSize,
          mimeType,
          clientId: clientId || null,
          uploadedById: req.user!.userId as string,
          message: message || null,
          expiresAt,
        },
      });

      const shareUrl = getShortShareUrl(record.shareId);

      res.status(201).json({
        id: record.id,
        shareId: record.shareId,
        shareUrl,
        fileName: record.fileName,
        fileCount: uploadedFiles.length,
        expiresAt: record.expiresAt,
      });
    } catch (err) {
      // Clean up any uploaded files on error
      for (const f of uploadedFiles) {
        try { fs.unlinkSync(f.path); } catch {}
      }
      console.error("Transfer upload failed:", err);
      next(err);
    }
  }
);

// ---- PATCH /api/transfer/:id ---------------------------------------------
// Protected — updates the metadata of an active/in-progress transfer.
router.patch(
  "/:id",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const id = req.params.id as string;
      const record = await prisma.sharedFile.findFirst({
        where: { id, uploadedById: req.user!.userId as string },
      });

      if (!record) {
        return next(AppError.notFound("Transfer not found."));
      }

      const parsed = updateBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(AppError.badRequest("Invalid update parameters."));
      }

      const { expiryValue, expiryUnit, clientId, message } = parsed.data;
      const updateData: any = {};

      if (clientId !== undefined) {
        updateData.clientId = clientId === "none" || !clientId ? null : clientId;
      }
      if (message !== undefined) {
        updateData.message = message || null;
      }

      if (expiryValue && expiryUnit) {
        const expiresAt = new Date(record.createdAt);
        if (expiryUnit === "minutes") {
          expiresAt.setMinutes(expiresAt.getMinutes() + expiryValue);
        } else if (expiryUnit === "hours") {
          expiresAt.setHours(expiresAt.getHours() + expiryValue);
        } else {
          expiresAt.setDate(expiresAt.getDate() + expiryValue);
        }
        updateData.expiresAt = expiresAt;
      }

      const updated = await prisma.sharedFile.update({
        where: { id },
        data: updateData,
        include: { client: { select: { id: true, name: true, email: true } } },
      });

      res.json(updated);
    } catch (err) {
      console.error("Failed to update transfer metadata:", err);
      next(err);
    }
  }
);

// ---- GET /api/transfer -----------------------------------------------
// Protected — list active/past transfers for the dashboard table.
router.get(
  "/",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const files = await prisma.sharedFile.findMany({
        where: { uploadedById: req.user!.userId as string },
        orderBy: { createdAt: "desc" },
        include: { client: { select: { id: true, name: true, email: true } } },
      });

      res.json(
        files.map((f) => ({
          id: f.id,
          shareId: f.shareId,
          fileName: f.fileName,
          fileSize: f.fileSize,
          client: f.client,
          expiresAt: f.expiresAt,
          downloadCount: f.downloadCount,
          viewCount: f.viewCount,
          isExpired: f.expiresAt < new Date(),
          isDeleted: f.isDeleted,
          createdAt: f.createdAt,
          emailSentTo: f.emailSentTo,
          emailSentAt: f.emailSentAt,
        }))
      );
    } catch (err) {
      next(err);
    }
  }
);

// ---- GET /api/transfer/:shareId --------------------------------------
// PUBLIC — metadata only, used by the recipient-facing share page before
// they click download. No auth: this is the link you send to clients.
router.get("/:shareId", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const shareId = req.params.shareId as string;
    const record = await prisma.sharedFile.findUnique({
      where: { shareId },
    });

    if (!record) {
      return next(AppError.notFound("Link not found."));
    }

    const expired = record.isDeleted || record.expiresAt < new Date();
    if (expired) {
      return res.status(410).json({ error: "This link has expired.", expired: true });
    }

    // Log the page view event
    const ipAddress = req.ip || null; // req.ip already honours trust proxy; avoid raw header spoofing
    const userAgent = req.headers["user-agent"] || null;

    await prisma.sharedFileEvent.create({
      data: {
        fileId: record.id,
        eventType: "VIEW",
        ipAddress: typeof ipAddress === "string" ? ipAddress : null,
        userAgent,
      },
    });

    await prisma.sharedFile.update({
      where: { id: record.id },
      data: { viewCount: { increment: 1 } },
    });

    res.json({
      fileName: record.fileName,
      fileSize: record.fileSize,
      mimeType: record.mimeType,
      message: record.message,
      expiresAt: record.expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

// ---- GET /api/transfer/:shareId/download -----------------------------
// PUBLIC — streams the actual file.
router.get("/:shareId/download", async (req: Request, res: Response, next: NextFunction): Promise<any> => {
  try {
    const shareId = req.params.shareId as string;
    const record = await prisma.sharedFile.findUnique({
      where: { shareId },
    });

    if (!record) {
      return next(AppError.notFound("Link not found."));
    }

    const expired = record.isDeleted || record.expiresAt < new Date();
    if (expired) {
      return next(new AppError("This link has expired.", 410));
    }

    const fullPath = path.join(UPLOAD_DIR, record.filePath);
    try { assertInsideUploadDir(fullPath); } catch (e) { return next(e); }
    if (!fs.existsSync(fullPath)) {
      return next(AppError.notFound("File missing on server."));
    }

    // Log the download event only if it's a real download, not just HTML5 preview stream loading
    if (req.query.preview !== "true") {
      const ipAddress = req.ip || null; // req.ip already honours trust proxy; avoid raw header spoofing
      const userAgent = req.headers["user-agent"] || null;

      await prisma.sharedFileEvent.create({
        data: {
          fileId: record.id,
          eventType: "DOWNLOAD",
          ipAddress: typeof ipAddress === "string" ? ipAddress : null,
          userAgent,
        },
      });

      await prisma.sharedFile.update({
        where: { id: record.id },
        data: { downloadCount: { increment: 1 } },
      });
    }

    res.download(fullPath, record.fileName);
  } catch (err) {
    next(err);
  }
});

// ---- POST /api/transfer/:id/send ---------------------------------------
// Protected — sends (or re-sends) the share link to a client's email.
const sendEmailSchema = z.object({
  recipientEmail: z.string().email(),
  recipientName: z.string().optional(),
  customMessage: z.string().max(5000).optional(),
});

router.post(
  "/:id/send",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const id = req.params.id as string;
      const record = await prisma.sharedFile.findFirst({
        where: { id, uploadedById: req.user!.userId as string },
      });

      if (!record) {
        return next(AppError.notFound("Transfer link not found."));
      }

      if (record.isDeleted || record.expiresAt < new Date()) {
        return next(AppError.badRequest("Cannot email link: This transfer has expired."));
      }

      const parsed = sendEmailSchema.safeParse(req.body);
      if (!parsed.success) {
        return next(AppError.badRequest("Invalid recipient email structure."));
      }

      const { recipientEmail, recipientName, customMessage } = parsed.data;

      const shareUrl = getShortShareUrl(record.shareId);

      // Escape dynamic content before embedding in HTML to prevent injection
      const safeFileName = escapeHtml(record.fileName);
      const safeUploadMessage = record.message ? sanitizeRichText(record.message) : null;
      const safeShareUrl = encodeURI(shareUrl); // encode the URL to be safe in an href

      // Sanitize the rich-text custom message from the dialog (keeps safe formatting)
      const safeCustomMessage = customMessage ? sanitizeRichText(customMessage) : null;

      const emailHtml = await generateEmailHtml({
        title: "New File Transfer Shared With You",
        contentHtml: `
          ${
            // Custom message takes priority. If not present, fallback to upload message.
            safeCustomMessage ? `
            <div style="margin-bottom: 24px; padding: 20px 24px; background: linear-gradient(135deg, #fef9f0 0%, #fff8ed 100%); border-radius: 16px; border-left: 4px solid #f59e0b; border: 1px solid #fde68a;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #92400e; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">📬 Message from your agency</p>
              <div style="font-size: 15px; color: #1e293b; line-height: 1.7; margin: 0;">${safeCustomMessage}</div>
            </div>` : (safeUploadMessage ? `
            <div style="margin-bottom: 24px; padding: 20px 24px; background: linear-gradient(135deg, #fef9f0 0%, #fff8ed 100%); border-radius: 16px; border-left: 4px solid #f59e0b; border: 1px solid #fde68a;">
              <p style="margin: 0 0 8px 0; font-size: 11px; color: #92400e; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em;">📬 Message from your agency</p>
              <div style="font-size: 15px; color: #1e293b; line-height: 1.7; margin: 0;">${safeUploadMessage}</div>
            </div>` : "")
          }
          <div style="margin-bottom: 24px; padding: 20px; background-color: #f8fafc; border-radius: 16px; border: 1px solid #e2e8f0;">
            <p style="margin: 0 0 8px 0; font-size: 13px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 0.05em;">File Details</p>
            <p style="margin: 0 0 6px 0; font-size: 16px; font-weight: bold; color: #0f172a;">${safeFileName}</p>
            <p style="margin: 0 0 12px 0; font-size: 14px; color: #475569; font-family: monospace;">Size: ${formatBytes(record.fileSize)}</p>
            <p style="margin: 0; font-size: 13px; color: #64748b;">Available until: ${new Date(record.expiresAt).toLocaleDateString()}</p>
          </div>
          <div style="text-align: center; margin: 32px 0;">
            <a href="${safeShareUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #d97706, #f59e0b); color: #000; font-weight: bold; text-decoration: none; border-radius: 12px; box-shadow: 0 4px 12px rgba(245, 158, 11, 0.25);">Download Shared File</a>
          </div>
        `,
      });

      await sendEmail({
        to: recipientEmail,
        subject: `File Transfer: ${record.fileName}`,
        html: emailHtml,
      });

      await prisma.sharedFile.update({
        where: { id: record.id },
        data: {
          emailSentTo: recipientEmail,
          emailSentAt: new Date(),
        },
      });

      res.json({ message: `Successfully emailed download link to ${recipientEmail}` });
    } catch (err) {
      console.error("Failed to email transfer:", err);
      next(err);
    }
  }
);

// ---- GET /api/transfer/:id/events --------------------------------------
// Protected — fetches view/download event logs for a specific transfer.
router.get(
  "/:id/events",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const id = req.params.id as string;
      const record = await prisma.sharedFile.findFirst({
        where: { id, uploadedById: req.user!.userId as string },
      });

      if (!record) {
        return next(AppError.notFound("Transfer not found."));
      }

      const events = await prisma.sharedFileEvent.findMany({
        where: { fileId: id },
        orderBy: { createdAt: "desc" },
      });

      res.json(events);
    } catch (err) {
      next(err);
    }
  }
);

// ---- POST /api/transfer/:id/renew --------------------------------------
// Protected — renews/extends an expired (but not permanently deleted) transfer.
router.post(
  "/:id/renew",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const id = req.params.id as string;

      // Validate renewal body with Zod (prevents negative values, invalid units, excessively long expiry)
      const parsed = renewBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return next(AppError.badRequest("Invalid renewal parameters."));
      }
      const { expiryValue, expiryUnit } = parsed.data;

      const record = await prisma.sharedFile.findFirst({
        where: { id, uploadedById: req.user!.userId as string },
      });

      if (!record) {
        return next(AppError.notFound("Transfer not found."));
      }

      // Check if file is physically present on server. If not, cannot renew.
      const fullPath = path.join(UPLOAD_DIR, record.filePath);
      try { assertInsideUploadDir(fullPath); } catch (e) { return next(e); }
      if (!fs.existsSync(fullPath)) {
        return next(AppError.badRequest("Physical file has been permanently deleted off the server. Cannot renew. Please re-upload."));
      }

      const expiresAt = new Date();
      const val = expiryValue; // already validated & typed as number
      const unit = expiryUnit; // already validated as 'minutes' | 'hours' | 'days'

      if (unit === "minutes") {
        expiresAt.setMinutes(expiresAt.getMinutes() + val);
      } else if (unit === "hours") {
        expiresAt.setHours(expiresAt.getHours() + val);
      } else {
        expiresAt.setDate(expiresAt.getDate() + val);
      }

      const updated = await prisma.sharedFile.update({
        where: { id },
        data: {
          expiresAt,
          isDeleted: false,
          deletedAt: null,
        },
      });

      res.json({
        message: "Transfer link renewed successfully",
        expiresAt: updated.expiresAt,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---- DELETE /api/transfer/:id -------------------------------------------
// Protected — revokes a link early, unlinking file from disk and marking deleted in DB.
router.delete(
  "/:id",
  authenticate,
  requireRole("ADMIN", "MANAGER", "STAFF"),
  async (req: Request, res: Response, next: NextFunction): Promise<any> => {
    try {
      const id = req.params.id as string;
      const record = await prisma.sharedFile.findFirst({
        where: { id, uploadedById: req.user!.userId as string },
      });
      if (!record) {
        return next(AppError.notFound("Not found."));
      }

      const fullPath = path.join(UPLOAD_DIR, record.filePath);
      try { assertInsideUploadDir(fullPath); } catch (e) { return next(e); }
      try {
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      } catch (err) {
        console.error("Failed to delete physical file:", err);
      }

      await prisma.sharedFile.update({
        where: { id: record.id },
        data: { isDeleted: true, deletedAt: new Date() },
      });

      res.json({ message: "Transfer deleted successfully" });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

import { Router, type Request, type Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { z } from 'zod';
import { AppError } from '../lib/errors.js';
import { parsePagination } from '../lib/pagination.js';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { PATHS } from '../lib/paths.js';
import { createNotification } from '../lib/notifications.js';
import { renderHrPdfById } from '../lib/pdf/document-pdf.js';
import { canAccessEmployee, assertCanAccessEmployee, managerEmployeeScope } from '../lib/hr-access.js';

const router = Router();
router.use(authenticate);

// ─── HELPERS ──────────────────────────────────────────────────────

type AuthUser = NonNullable<Request['user']>;

/** Employee fields safe to embed in HR document responses (no payroll/PII). */
const safeEmployeeSelect = {
  id: true,
  name: true,
  email: true,
  department: true,
  role: true,
  userId: true,
  managerId: true,
  manager: { select: { id: true, name: true, userId: true } },
} as const;

async function assertCanAccessDocument(user: AuthUser, documentId: string) {
  const document = await prisma.hrDocument.findUnique({
    where: { id: documentId },
    select: { id: true, employeeId: true },
  });
  if (!document) throw AppError.notFound('Document not found');
  await assertCanAccessEmployee(user, document.employeeId);
  return document;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

async function generateDocNumber(docType: string): Promise<string> {
  let prefix = 'HR';
  if (docType === 'WORK_CERTIFICATE') prefix = 'WC';
  else if (docType === 'SALARY_CERTIFICATE') prefix = 'SC';
  else if (docType === 'PAYSLIP') prefix = 'PS';
  else if (docType === 'WARNING_CERTIFICATE') prefix = 'WN';
  else if (docType === 'INTERNSHIP_ACCEPTED_CERTIFICATE') prefix = 'IAC';
  else if (docType === 'INTERNSHIP_LETTER') prefix = 'IL';

  const currentYear = new Date().getFullYear();
  
  // Find count of documents of this type in current year
  const count = await prisma.hrDocument.count({
    where: {
      docType: docType as any,
      docNumber: {
        startsWith: `${prefix}-${currentYear}-`
      }
    }
  });

  const nextNum = (count + 1).toString().padStart(4, '0');
  return `${prefix}-${currentYear}-${nextNum}`;
}

// ─── GET /api/hr/documents ────────────────────────────────────────
// Lists all generated documents (restricted to Admin/Manager, unless filtered by employeeId)
router.get('/', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const { take, skip } = parsePagination(req.query, { maxTake: 100, defaultTake: 50 });
    const { pendingApproval, employeeId } = req.query;

    const where: any = {};
    
    if (employeeId) {
      where.employeeId = employeeId as string;
    }

    // Managers only ever see documents for their direct reports (and their own).
    if (req.user!.role !== 'ADMIN') {
      where.AND = [await managerEmployeeScope(req.user!.userId)];
    }

    if (pendingApproval === 'true') {
      where.status = 'PENDING_APPROVAL';

      // Non-admin managers can only review documents for their direct reports, or escalate to fallback
      if (req.user!.role !== 'ADMIN') {
        const settings = await prisma.agencySettings.findFirst();
        const fallbackId = settings?.hrFallbackApproverId;

        if (fallbackId === req.user!.userId) {
          where.OR = [
            { employee: { manager: { userId: req.user!.userId } } },
            { employee: { managerId: null } }
          ];
        } else {
          where.employee = { manager: { userId: req.user!.userId } };
        }
      }
    }

    const documents = await prisma.hrDocument.findMany({
      where,
      orderBy: [
        { docNumber: 'desc' },
        { version: 'desc' }
      ],
      take,
      skip,
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
            department: true,
            role: true,
            manager: {
              select: {
                id: true,
                name: true,
                userId: true,
              }
            }
          }
        },
        generatedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        approvals: {
          orderBy: { decidedAt: 'desc' },
          include: {
            approver: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/hr/documents/employee/:employeeId ──────────────────
// Lists documents for a specific employee (accessible by Admin/Manager or the staff user themselves)
router.get('/employee/:employeeId', async (req: Request, res: Response, next) => {
  try {
    const employeeId = req.params.employeeId as string;
    const user = req.user!;

    if (user.role === 'CLIENT') {
      throw AppError.forbidden('Access denied');
    }

    await assertCanAccessEmployee(user, employeeId);

    const documents = await prisma.hrDocument.findMany({
      where: { employeeId },
      orderBy: [
        { docNumber: 'desc' },
        { version: 'desc' }
      ],
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true,
          }
        },
        generatedBy: {
          select: {
            id: true,
            name: true,
          }
        },
        approvedBy: {
          select: {
            id: true,
            name: true,
          }
        },
        approvals: {
          orderBy: { decidedAt: 'desc' },
          include: {
            approver: {
              select: {
                id: true,
                name: true,
              }
            }
          }
        }
      }
    });

    res.json({ documents });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/hr/documents/:id ────────────────────────────────────
router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const document = await prisma.hrDocument.findUnique({
      where: { id: req.params.id as string },
      include: {
        employee: { select: safeEmployeeSelect },
        generatedBy: { select: { id: true, name: true, email: true } },
        approvedBy: { select: { id: true, name: true, email: true } },
        approvals: {
          orderBy: { decidedAt: 'desc' },
          include: {
            approver: { select: { id: true, name: true } }
          }
        }
      }
    });

    if (!document) {
      throw AppError.notFound('Document not found');
    }

    // ADMIN: any; MANAGER: direct reports + own; STAFF: own only.
    if (!(await canAccessEmployee(req.user!, document.employee))) {
      throw AppError.forbidden('Access denied');
    }

    res.json({ document });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/hr/documents ───────────────────────────────────────
const createHrDocumentSchema = z.object({
  employeeId: z.string().min(1),
  docType: z.enum(['WORK_CERTIFICATE', 'SALARY_CERTIFICATE', 'PAYSLIP', 'WARNING_CERTIFICATE', 'INTERNSHIP_ACCEPTED_CERTIFICATE', 'INTERNSHIP_LETTER']),
  docNumber: z.string().optional(), // Provided if creating a new version
  content: z.any(),
  status: z.enum(['DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'FINAL']).optional(),
});

router.post('/', requireRole('ADMIN', 'MANAGER'), validate({ body: createHrDocumentSchema }), async (req: Request, res: Response, next) => {
  try {
    const { employeeId, docType, docNumber, content, status } = req.body;
    const user = req.user!;

    // Check if employee exists
    const employee = await prisma.teamMember.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, userId: true, managerId: true, manager: { select: { userId: true } } },
    });
    if (!employee) {
      throw AppError.notFound('Employee not found');
    }
    // Managers may only issue documents for their own direct reports.
    if (user.role !== 'ADMIN') {
      const isDirectReport = !!employee.manager?.userId && employee.manager.userId === user.userId;
      if (!isDirectReport) {
        throw AppError.forbidden('Managers can only create documents for their direct reports.');
      }
    }

    let finalDocNumber = docNumber;
    let nextVersion = 1;

    if (docNumber) {
      // Find highest version of this docNumber to increment
      const lastDoc = await prisma.hrDocument.findFirst({
        where: { docNumber },
        orderBy: { version: 'desc' },
        select: { version: true, employeeId: true, docType: true }
      });
      if (!lastDoc) {
        throw AppError.notFound('Original document not found to increment version.');
      }
      if (lastDoc.employeeId !== employeeId || lastDoc.docType !== docType) {
        throw AppError.badRequest('A new version must keep the original employee and document type.');
      }
      nextVersion = lastDoc.version + 1;
    } else {
      // Generate new document reference number
      finalDocNumber = await generateDocNumber(docType);
    }

    // Determine initial status
    let initialStatus = status || 'DRAFT';
    if (docType === 'WARNING_CERTIFICATE') {
      if (status !== 'DRAFT') {
        initialStatus = 'PENDING_APPROVAL';
      }
    } else {
      // Non-warning certificates go straight to FINAL if not draft — but only
      // an ADMIN may issue a final document directly. A manager's document
      // goes through the approval workflow instead.
      if (status !== 'DRAFT') {
        initialStatus = user.role === 'ADMIN' ? 'FINAL' : 'PENDING_APPROVAL';
      }
    }

    // Create the record
    const document = await prisma.hrDocument.create({
      data: {
        employeeId,
        docType,
        docNumber: finalDocNumber!,
        version: nextVersion,
        status: initialStatus as any,
        generatedById: user.userId,
        content,
      },
    });

    // Write activity log
    await prisma.employeeActivity.create({
      data: {
        employeeId,
        actionType: 'EDITED',
        performedBy: user.email,
        notes: `Generated ${docType.replace('_', ' ')} (${finalDocNumber}) v${nextVersion} with status ${initialStatus}`,
      },
    });

    // Notify if pending approval
    if (initialStatus === 'PENDING_APPROVAL') {
      createNotification({
        title: 'HR Document Awaiting Approval',
        message: `${docType.replace(/_/g, ' ')} for ${employee.name} requires approval.`,
        type: 'HR_DOCUMENT_PENDING_APPROVAL',
        category: 'ACTION_REQUIRED',
        entityType: 'EMPLOYEE',
        entityId: employeeId,
        actionUrl: `/dashboard/team/view/${employeeId}`,
      });
    }

    res.status(201).json({ document });
  } catch (error) {
    next(error);
  }
});

// ─── GET /api/hr/documents/:id/export-pdf ─────────────────────────
// Puppeteer PDF — same PremiumHrDocument design, server-rendered.
router.get('/:id/export-pdf', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const documentId = req.params.id as string;
    await assertCanAccessDocument(req.user!, documentId);

    const { buffer, filename } = await renderHrPdfById(documentId);

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/hr/documents/:id/pdf ───────────────────────────────
// Server-generate (Puppeteer) and cache PDF for this document.
router.post('/:id/pdf', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const documentId = req.params.id as string;
    await assertCanAccessDocument(req.user!, documentId);

    await renderHrPdfById(documentId);

    const updatedDocument = await prisma.hrDocument.findUnique({
      where: { id: documentId },
    });

    res.json({ document: updatedDocument });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/hr/documents/:id/approve ───────────────────────────
router.post('/:id/approve', async (req: Request, res: Response, next) => {
  try {
    const documentId = req.params.id as string;
    const { comment } = req.body;
    const user = req.user!;

    const document = await prisma.hrDocument.findUnique({
      where: { id: documentId },
      include: {
        employee: { select: safeEmployeeSelect }
      }
    });

    if (!document) {
      throw AppError.notFound('Document not found');
    }

    if (document.status !== 'PENDING_APPROVAL') {
      throw AppError.badRequest('Document is not pending approval.');
    }

    // Check permissions: manager, fallback approver, or admin
    const employee = document.employee;
    const settings = await prisma.agencySettings.findFirst();
    const isManager = !!employee.manager && employee.manager.userId === user.userId;
    const isFallback = settings?.hrFallbackApproverId === user.userId;
    const isAdmin = user.role === 'ADMIN';
    // No self-approval: only an ADMIN may approve a document they generated
    // themselves, and nobody but an ADMIN approves their own HR document.
    const isSelfIssued = document.generatedById === user.userId || employee.userId === user.userId;

    if (!isAdmin && ((!isManager && !isFallback) || isSelfIssued)) {
      throw AppError.forbidden('You are not authorized to approve this document.');
    }

    // Start transaction to update status and log approval
    const [updatedDoc] = await prisma.$transaction([
      prisma.hrDocument.update({
        where: { id: documentId },
        data: {
          status: 'APPROVED',
          approvedById: user.userId,
          approvedAt: new Date(),
        }
      }),
      prisma.hrDocumentApproval.create({
        data: {
          hrDocumentId: documentId,
          approverId: user.userId,
          decision: 'APPROVED',
          comment,
        }
      }),
      prisma.employeeActivity.create({
        data: {
          employeeId: employee.id,
          actionType: 'STATUS_CHANGED',
          performedBy: user.email,
          notes: `Approved ${document.docType.replace(/_/g, ' ')} (${document.docNumber}) v${document.version}${comment ? ': ' + comment : ''}`,
        }
      })
    ]);


    createNotification({
      title: 'HR Document Approved ✅',
      message: `${document.docType.replace(/_/g, ' ')} (${document.docNumber}) for ${employee.name} has been approved.`,
      type: 'HR_DOCUMENT_APPROVED',
      category: 'SUCCESS',
      entityType: 'EMPLOYEE',
      entityId: employee.id,
      actionUrl: `/dashboard/team/view/${employee.id}`,
    });
    res.json({ document: updatedDoc });
  } catch (error) {
    next(error);
  }
});


// ─── POST /api/hr/documents/:id/reject ───────────────────────────
router.post('/:id/reject', async (req: Request, res: Response, next) => {
  try {
    const documentId = req.params.id as string;
    const { comment } = req.body;
    const user = req.user!;

    if (!comment || comment.trim().length === 0) {
      throw AppError.badRequest('A comment is required when rejecting a document.');
    }

    const document = await prisma.hrDocument.findUnique({
      where: { id: documentId },
      include: {
        employee: { select: safeEmployeeSelect }
      }
    });

    if (!document) {
      throw AppError.notFound('Document not found');
    }

    if (document.status !== 'PENDING_APPROVAL') {
      throw AppError.badRequest('Document is not pending approval.');
    }

    const employee = document.employee;
    const settings = await prisma.agencySettings.findFirst();
    const isManager = !!employee.manager && employee.manager.userId === user.userId;
    const isFallback = settings?.hrFallbackApproverId === user.userId;
    const isAdmin = user.role === 'ADMIN';
    // No self-approval: only an ADMIN may approve a document they generated
    // themselves, and nobody but an ADMIN approves their own HR document.
    const isSelfIssued = document.generatedById === user.userId || employee.userId === user.userId;

    if (!isAdmin && ((!isManager && !isFallback) || isSelfIssued)) {
      throw AppError.forbidden('You are not authorized to reject this document.');
    }

    // Start transaction to update status and log rejection
    const [updatedDoc] = await prisma.$transaction([
      prisma.hrDocument.update({
        where: { id: documentId },
        data: {
          status: 'REJECTED',
        }
      }),
      prisma.hrDocumentApproval.create({
        data: {
          hrDocumentId: documentId,
          approverId: user.userId,
          decision: 'REJECTED',
          comment,
        }
      }),
      prisma.employeeActivity.create({
        data: {
          employeeId: employee.id,
          actionType: 'STATUS_CHANGED',
          performedBy: user.email,
          notes: `Rejected ${document.docType.replace(/_/g, ' ')} (${document.docNumber}) v${document.version}. Reason: ${comment}`,
        }
      })
    ]);

    res.json({ document: updatedDoc });
  } catch (error) {
    next(error);
  }
});

// ─── POST /api/hr/documents/:id/send-email ───────────────────────
router.post('/:id/send-email', requireRole('ADMIN', 'MANAGER'), async (req: Request, res: Response, next) => {
  try {
    const documentId = req.params.id as string;
    const { to, cc, subject, body, filename } = req.body;

    await assertCanAccessDocument(req.user!, documentId);
    const document = await prisma.hrDocument.findUnique({
      where: { id: documentId },
      select: { id: true, docNumber: true, pdfUrl: true },
    });

    if (!document) {
      throw AppError.notFound('Document not found');
    }

    if (!to || !subject || !body) {
      throw AppError.badRequest('Missing required fields: to, subject, and body are required.');
    }

    let buffer: Buffer;
    try {
      const rendered = await renderHrPdfById(documentId);
      buffer = rendered.buffer;
    } catch (err) {
      // Fallback to cached file if render fails
      if (!document.pdfUrl) {
        throw err;
      }
      const filenameOnDisk = path.basename(document.pdfUrl);
      const filePath = path.resolve(PATHS.EMPLOYEE_DOCS, filenameOnDisk);
      if (!fsSync.existsSync(filePath)) {
        throw AppError.notFound('Document PDF file not found on disk.');
      }
      buffer = await fs.readFile(filePath);
    }

    // Generate styled branding HTML
    const emailHtml = await generateEmailHtml({
      title: subject,
      preheader: subject,
      contentHtml: `
        <p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line;">${escapeHtml(String(body))}</p>
      `,
    });

    const ccList = typeof cc === 'string'
      ? cc.split(',').map((email: string) => email.trim()).filter(Boolean)
      : cc;

    const result = await sendEmail({
      to,
      cc: ccList && ccList.length > 0 ? ccList : undefined,
      subject,
      html: emailHtml,
      attachments: [
        {
          content: buffer,
          filename: filename || `${document.docNumber}.pdf`,
          contentType: 'application/pdf',
        }
      ]
    });

    if (!result.success) {
      throw AppError.badRequest(result.error ?? 'Failed to send email.');
    }

    res.json({ success: true, message: 'Email sent successfully', emailId: result.id });
  } catch (error) {
    next(error);
  }
});

export default router;

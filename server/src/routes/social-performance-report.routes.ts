// Monthly social performance report — generate, preview, export, send.
//
// Route shapes mirror the invoice/proforma document flow: a "by id" renderer,
// a streamed PDF, and a send-email endpoint that always re-renders server-side
// rather than trusting bytes from the client.

import { Router, type Request, type Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { PATHS } from '../lib/paths.js';
import { sendEmail, generateEmailHtml } from '../lib/email.js';
import { AppError } from '../lib/errors.js';
import {
  generateReport,
  loadReportSections,
  reportTitle,
} from '../lib/social/report/social-performance-report.service.js';
import { buildSocialReportHtmlFromSections } from '../lib/pdf/social-report-html.js';
import { renderSocialReportPdf } from '../lib/pdf/render-social-report.js';

const router = Router();

function parsePeriod(month: unknown, year: unknown): { month: number; year: number } {
  const m = Number(month);
  const y = Number(year);
  if (!Number.isInteger(m) || m < 1 || m > 12) throw AppError.badRequest('Month must be 1-12');
  if (!Number.isInteger(y) || y < 2000 || y > 2100) throw AppError.badRequest('Year is out of range');
  return { month: m, year: y };
}

function safeFilename(title: string): string {
  const base = title.replace(/[^\w.\-]+/g, '_').slice(0, 180);
  return base.toLowerCase().endsWith('.pdf') ? base : `${base}.pdf`;
}

/** Render a stored report to PDF, by id. Mirrors renderInvoicePdfById. */
async function renderReportPdfById(reportId: string): Promise<{ buffer: Buffer; filename: string; report: any }> {
  const report = await prisma.socialPerformanceReport.findUnique({
    where: { id: reportId },
    include: { client: { select: { id: true, name: true, company: true, email: true } } },
  });
  if (!report) throw AppError.notFound('Report not found');

  const sections = await loadReportSections(reportId);
  if (sections.length === 0) throw AppError.badRequest('Report has no sections — generate it first');

  const html = buildSocialReportHtmlFromSections(sections, { forPrint: true });
  const buffer = await renderSocialReportPdf(html);

  return { buffer, filename: safeFilename(report.title), report };
}

// ── List reports ─────────────────────────────────────────────────────────────
router.get('/', async (req: Request, res: Response, next) => {
  try {
    const { clientId } = req.query as { clientId?: string };
    const where: any = {};
    if (clientId) where.clientId = clientId;

    const reports = await prisma.socialPerformanceReport.findMany({
      where,
      orderBy: [{ year: 'desc' }, { month: 'desc' }],
      take: 100,
      include: { client: { select: { id: true, name: true, company: true } } },
    });
    res.json(reports);
  } catch (err) {
    next(err);
  }
});

// ── Generate (or regenerate) a report ────────────────────────────────────────
router.post('/generate', async (req: Request, res: Response, next) => {
  try {
    const { clientId } = req.body as { clientId?: string };
    if (!clientId) throw AppError.badRequest('clientId is required');
    const { month, year } = parsePeriod(req.body.month, req.body.year);

    const client = await prisma.client.findUnique({ where: { id: clientId } });
    if (!client) throw AppError.notFound('Client not found');

    const result = await generateReport(clientId, month, year, (req as any).user?.id ?? null);

    // The facts drive the UI's data-coverage warnings, so return them alongside
    // the report — the point of the preview is seeing what's missing.
    res.json({
      report: {
        id: result.id,
        clientId: result.clientId,
        month: result.month,
        year: result.year,
        title: result.title,
        status: result.status,
        sectionCount: result.sections.length,
      },
      facts: result.facts,
      narrative: result.narrative,
    });
  } catch (err) {
    next(err);
  }
});

// ── Fetch a stored report by client + period ─────────────────────────────────
router.get('/:clientId/:month/:year', async (req: Request, res: Response, next) => {
  try {
    const { clientId } = req.params as { clientId: string };
    const { month, year } = parsePeriod(req.params.month, req.params.year);

    const report = await prisma.socialPerformanceReport.findUnique({
      where: { clientId_month_year: { clientId, month, year } },
      include: { client: { select: { id: true, name: true, company: true, email: true } } },
    });
    if (!report) {
      res.status(404).json({ error: 'No report for this period yet' });
      return;
    }

    const sections = await loadReportSections(report.id);
    res.json({ report, sections });
  } catch (err) {
    next(err);
  }
});

// ── Preview: the same HTML the PDF is rendered from ──────────────────────────
router.get('/:id/preview', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params as { id: string };
    const report = await prisma.socialPerformanceReport.findUnique({ where: { id } });
    if (!report) throw AppError.notFound('Report not found');

    const sections = await loadReportSections(id);
    if (sections.length === 0) throw AppError.badRequest('Report has no sections — generate it first');

    const html = buildSocialReportHtmlFromSections(sections, { forPrint: false });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    // Rendered in a sandboxed iframe; deny everything it doesn't need.
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src data:; style-src 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com;");
    res.send(html);
  } catch (err) {
    next(err);
  }
});

// ── Update stored sections (manual corrections before sending) ───────────────
router.put('/:id', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params as { id: string };
    const report = await prisma.socialPerformanceReport.findUnique({
      where: { id },
      include: { sections: true },
    });
    if (!report) throw AppError.notFound('Report not found');

    const { title, status, sections } = req.body as {
      title?: string;
      status?: string;
      sections?: { key: string; html: string }[];
    };

    // Snapshot before mutating, same as generation does.
    await prisma.socialPerformanceReportVersion.create({
      data: {
        reportId: id,
        snapshotJson: {
          title: report.title,
          status: report.status,
          sections: report.sections.map(s => ({ key: s.key, order: s.order, content: s.content })),
        } as any,
        createdById: (req as any).user?.id ?? null,
      },
    });

    if (Array.isArray(sections)) {
      for (const s of sections) {
        if (!s?.key || typeof s.html !== 'string') continue;
        await prisma.socialPerformanceReportSection.updateMany({
          where: { reportId: id, key: s.key },
          data: { content: { html: s.html } as any },
        });
      }
    }

    const updated = await prisma.socialPerformanceReport.update({
      where: { id },
      data: {
        ...(title ? { title } : {}),
        ...(status === 'DRAFT' || status === 'FINALIZED' ? { status: status as any } : {}),
      },
    });

    res.json({ report: updated, sections: await loadReportSections(id) });
  } catch (err) {
    next(err);
  }
});

// ── Export PDF ───────────────────────────────────────────────────────────────
router.get('/:id/export-pdf', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params as { id: string };
    const { buffer, filename } = await renderReportPdfById(id);

    // Cached so a later email send can attach it without re-rendering.
    try {
      await fs.writeFile(path.resolve(PATHS.DOCUMENTS, `SocialReport_${id}.pdf`), buffer);
    } catch (fsErr) {
      console.error('[SocialReport] Failed to cache PDF:', fsErr);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

// ── Send by email ────────────────────────────────────────────────────────────
router.post('/:id/send-email', async (req: Request, res: Response, next) => {
  try {
    const { id } = req.params as { id: string };
    const { to, cc, subject, body, filename } = req.body as Record<string, any>;
    if (!to || !subject || !body) {
      throw AppError.badRequest('Missing required fields: to, subject, and body are required.');
    }

    // Always re-render server-side — never trust client-supplied PDF bytes.
    const { buffer, filename: renderedFilename } = await renderReportPdfById(id);

    const emailHtml = await generateEmailHtml({
      title: subject,
      preheader: subject,
      contentHtml: `<p style="margin: 0 0 16px; color: #475569; line-height: 1.6; white-space: pre-line;">${body}</p>`,
    });

    const ccList = typeof cc === 'string'
      ? cc.split(',').map((e: string) => e.trim()).filter(Boolean)
      : cc;

    const result = await sendEmail({
      to,
      cc: ccList && ccList.length > 0 ? ccList : undefined,
      subject,
      html: emailHtml,
      attachments: [
        {
          content: buffer,
          filename: filename || renderedFilename,
          contentType: 'application/pdf',
        },
      ],
    });

    if (!result.success) {
      throw AppError.badRequest(result.error || 'Failed to send email');
    }

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;

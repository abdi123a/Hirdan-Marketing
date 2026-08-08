// Generation and persistence for the monthly social performance report.
//
// Sections are stored as rendered HTML plus the facts they were built from, so
// a report is reproducible after the fact: regenerating next month never
// rewrites a report already sent to a client, and the preview always shows
// exactly what the PDF will contain.

import { prisma } from '../../prisma.js';
import { buildReportFacts, type ReportFacts } from './report-facts.js';
import { composeNarrative, type Narrative } from './narrative.js';
import { renderSections } from '../../pdf/social-report-html.js';

export interface StoredSection {
  key: string;
  order: number;
  html: string;
}

export interface GeneratedReport {
  id: string;
  clientId: string;
  month: number;
  year: number;
  title: string;
  status: string;
  sections: StoredSection[];
  facts: ReportFacts;
  narrative: Narrative;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function reportTitle(clientName: string, month: number, year: number): string {
  return `${clientName} — Social Media Report — ${MONTH_NAMES[month - 1]} ${year}`;
}

/**
 * Build and persist a report for one client-month.
 *
 * Re-generating replaces the stored sections but keeps the report row (and its
 * id, so links stay valid) and snapshots the previous state into a version row.
 */
export async function generateReport(
  clientId: string,
  month: number,
  year: number,
  createdById?: string | null,
): Promise<GeneratedReport> {
  const facts = await buildReportFacts(clientId, month, year);
  const narrative = await composeNarrative(facts);
  const rendered = await renderSections(facts, narrative);

  const title = reportTitle(facts.client.name, month, year);

  const existing = await prisma.socialPerformanceReport.findUnique({
    where: { clientId_month_year: { clientId, month, year } },
    include: { sections: true },
  });

  // Snapshot what was there before overwriting it.
  if (existing) {
    await prisma.socialPerformanceReportVersion.create({
      data: {
        reportId: existing.id,
        snapshotJson: {
          title: existing.title,
          status: existing.status,
          sections: existing.sections.map(s => ({ key: s.key, order: s.order, content: s.content })),
        } as any,
        createdById: createdById ?? null,
      },
    });
  }

  const report = await prisma.socialPerformanceReport.upsert({
    where: { clientId_month_year: { clientId, month, year } },
    create: { clientId, month, year, title, createdById: createdById ?? null },
    update: { title },
  });

  await prisma.socialPerformanceReportSection.deleteMany({ where: { reportId: report.id } });
  await prisma.socialPerformanceReportSection.createMany({
    data: rendered.map((s, i) => ({
      reportId: report.id,
      key: s.key,
      order: i,
      content: { html: s.html } as any,
    })),
  });

  return {
    id: report.id,
    clientId,
    month,
    year,
    title,
    status: report.status,
    sections: rendered.map((s, i) => ({ key: s.key, order: i, html: s.html })),
    facts,
    narrative,
  };
}

/** Load a stored report's sections in slide order. */
export async function loadReportSections(reportId: string): Promise<StoredSection[]> {
  const rows = await prisma.socialPerformanceReportSection.findMany({
    where: { reportId },
    orderBy: { order: 'asc' },
  });
  return rows.map(r => ({
    key: r.key,
    order: r.order,
    html: (r.content as any)?.html ?? '',
  }));
}

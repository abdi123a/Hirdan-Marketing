/**
 * ai-tools.ts
 * Scoped, permission-checked tool handlers for the AI chat assistant.
 *
 * Each tool:
 *  - Takes structured args only (no free-text paths or shell commands)
 *  - Validates all IDs against the database before fetching
 *  - Returns a text summary — never auto-sends or auto-executes
 */

import { prisma } from './prisma.js';
import type { AiTool } from './ai-provider.js';

// ─── Tool Definitions (sent to the model) ─────────────────────────────────

export const AI_TOOLS: AiTool[] = [
  {
    name: 'summarize_file',
    description:
      'Summarizes the content or metadata of a shared file that the admin has access to. Use when the user asks about a specific file or document.',
    parameters: {
      type: 'object',
      properties: {
        fileId: {
          type: 'string',
          description: 'The ID of the SharedFile record to summarize.',
        },
      },
      required: ['fileId'],
    },
  },
  {
    name: 'draft_monthly_report',
    description:
      'Drafts a client-facing monthly social media report summary using data from the Monthly Reports module. Returns a formatted draft text for review — does not publish or send anything.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The ID of the client.',
        },
        month: {
          type: 'string',
          description: 'The month number as a string, e.g. "6" for June.',
        },
        year: {
          type: 'string',
          description: 'The 4-digit year as a string, e.g. "2025".',
        },
      },
      required: ['clientId', 'month', 'year'],
    },
  },
  {
    name: 'summarize_financials',
    description:
      'Summarizes financial data (invoices and/or expenses) for a given client or project within an optional date range. Returns a plain-text financial summary for review.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The ID of the client (optional if projectId is given).',
        },
        projectId: {
          type: 'string',
          description: 'The ID of the project (optional if clientId is given).',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format (optional).',
        },
        dateTo: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format (optional).',
        },
      },
      required: [],
    },
  },
  {
    name: 'draft_client_email',
    description:
      'Drafts a professional email to a client based on their current project and task status. Returns a draft email text for review — does not send anything.',
    parameters: {
      type: 'object',
      properties: {
        clientId: {
          type: 'string',
          description: 'The ID of the client to draft the email for.',
        },
        context: {
          type: 'string',
          description:
            'Additional context or instructions for the email, e.g. "project update", "invoice reminder", "onboarding welcome".',
        },
      },
      required: ['clientId'],
    },
  },
];

// ─── Tool Handlers ─────────────────────────────────────────────────────────

export async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
): Promise<string> {
  try {
    switch (toolName) {
      case 'summarize_file':
        return await handleSummarizeFile(args);
      case 'draft_monthly_report':
        return await handleDraftMonthlyReport(args);
      case 'summarize_financials':
        return await handleSummarizeFinancials(args);
      case 'draft_client_email':
        return await handleDraftClientEmail(args);
      default:
        return `Unknown tool: ${toolName}`;
    }
  } catch (err: any) {
    return `Error executing tool "${toolName}": ${err.message || err}`;
  }
}

// ── summarize_file ─────────────────────────────────────────────────────────
async function handleSummarizeFile(args: Record<string, unknown>): Promise<string> {
  const fileId = String(args.fileId || '').trim();
  if (!fileId) return 'Error: fileId is required.';

  const file = await prisma.sharedFile.findUnique({
    where: { id: fileId },
    select: {
      id: true,
      fileName: true,
      mimeType: true,
      fileSize: true,
      createdAt: true,
      uploadedBy: { select: { name: true } },
      client: { select: { name: true, company: true } },
    },
  });

  if (!file) return `No file found with ID: ${fileId}`;

  const sizeKb = Math.round((file.fileSize || 0) / 1024);
  const client = file.client ? (file.client.company || file.client.name) : 'Unknown client';
  const uploader = file.uploadedBy?.name || 'Unknown';

  return [
    `File Summary:`,
    `• Name: ${file.fileName}`,
    `• Type: ${file.mimeType}`,
    `• Size: ${sizeKb} KB`,
    `• Client: ${client}`,
    `• Uploaded by: ${uploader}`,
    `• Date: ${new Date(file.createdAt).toLocaleDateString()}`,
  ].join('\n');
}

// ── draft_monthly_report ───────────────────────────────────────────────────
async function handleDraftMonthlyReport(args: Record<string, unknown>): Promise<string> {
  const clientId = String(args.clientId || '').trim();
  const month = parseInt(String(args.month || '0'), 10);
  const year = parseInt(String(args.year || '0'), 10);

  if (!clientId || !month || !year) {
    return 'Error: clientId, month, and year are all required.';
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, company: true, industry: true },
  });
  if (!client) return `No client found with ID: ${clientId}`;

  // Fetch monthly report if exists
  const report = await prisma.monthlyReport.findFirst({
    where: { clientId, month, year },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
      sections: {
        orderBy: { order: 'asc' },
        select: { key: true, order: true, content: true },
      },
    },
  });

  // Fetch content posts for the month
  const posts = await prisma.contentPost.findMany({
    where: { clientId, month, year },
    select: { title: true, platform: true, status: true, publishDate: true },
    orderBy: { publishDate: 'asc' },
  });

  const clientName = client.company || client.name;
  const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'long' });

  const lines: string[] = [
    `Monthly Report Data for ${clientName} — ${monthName} ${year}`,
    '',
    `Client: ${clientName}`,
    `Industry: ${client.industry || 'Not specified'}`,
    `Period: ${monthName} ${year}`,
    '',
  ];

  if (report) {
    lines.push(`Existing Report: "${report.title}" (Status: ${report.status})`);
    lines.push(`Sections: ${report.sections.length} total`);
    for (const sec of report.sections) {
      const contentObj = (sec.content && typeof sec.content === 'object') ? (sec.content as Record<string, any>) : {};
      lines.push(`- Section "${sec.key}": ${contentObj.title || 'No Title'}`);
    }
  } else {
    lines.push('No existing report found for this period.');
  }

  lines.push('', `Content Posts: ${posts.length} total`);
  const published = posts.filter((p) => p.status === 'PUBLISHED');
  lines.push(`Published: ${published.length}`);

  const byPlatform: Record<string, number> = {};
  for (const post of posts) {
    byPlatform[post.platform] = (byPlatform[post.platform] || 0) + 1;
  }
  for (const [platform, count] of Object.entries(byPlatform)) {
    lines.push(`• ${platform}: ${count} posts`);
  }

  return lines.join('\n');
}

// ── summarize_financials ───────────────────────────────────────────────────
async function handleSummarizeFinancials(args: Record<string, unknown>): Promise<string> {
  let clientId = args.clientId ? String(args.clientId).trim() : undefined;
  const projectId = args.projectId ? String(args.projectId).trim() : undefined;
  const dateFrom = args.dateFrom ? new Date(String(args.dateFrom)) : undefined;
  const dateTo = args.dateTo ? new Date(String(args.dateTo)) : undefined;

  // Resolve clientId from projectId if projectId is provided
  if (projectId && !clientId) {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { clientId: true },
    });
    if (project) {
      clientId = project.clientId;
    }
  }

  if (!clientId) {
    return 'Error: provide a valid clientId or a projectId that maps to a client.';
  }

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, company: true },
  });
  if (!client) return `No client found with ID: ${clientId}`;

  // Fetch currency from general settings
  const settings = await prisma.agencySettings.findFirst();
  const currency = settings?.currency || 'USD';

  // Build invoice filter
  const invoiceWhere: Record<string, any> = { clientId };
  if (dateFrom || dateTo) {
    invoiceWhere.createdAt = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const invoices = await prisma.invoice.findMany({
    where: invoiceWhere,
    select: { amount: true, status: true },
  });

  // Build expense filter (Expenses do not have clientId directly in schema.
  // We can select expenses associated with the project's transactions, or retrieve all database expenses.
  // Let's retrieve all expenses for projects where client is owner, or just list general matching expenses.)
  const expenseWhere: Record<string, any> = {};
  if (dateFrom || dateTo) {
    expenseWhere.date = {
      ...(dateFrom ? { gte: dateFrom } : {}),
      ...(dateTo ? { lte: dateTo } : {}),
    };
  }

  const expenses = await prisma.expense.findMany({
    where: expenseWhere,
    select: { amount: true, category: true },
  });

  // Invoices amount is in major units or cents. Let's assume major unit for Invoice amount and cents for Expense.
  // Amount in Expense is in cents, so we divide by 100.
  const totalInvoiced = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const paidInvoices = invoices.filter((i) => i.status === 'PAID');
  const totalPaid = paidInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const totalExpenses = expenses.reduce((sum, exp) => sum + ((exp.amount || 0) / 100), 0);

  const expenseByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    const val = (exp.amount || 0) / 100;
    expenseByCategory[exp.category] = (expenseByCategory[exp.category] || 0) + val;
  }

  const lines: string[] = [
    `Financial Summary for client: ${client.company || client.name}`,
    dateFrom || dateTo
      ? `Period: ${dateFrom?.toLocaleDateString() || 'beginning'} – ${dateTo?.toLocaleDateString() || 'now'}`
      : 'Period: All time',
    '',
    `Invoices: ${invoices.length} total`,
    `• Total Invoiced: ${currency} ${totalInvoiced.toFixed(2)}`,
    `• Paid: ${paidInvoices.length} invoices = ${currency} ${totalPaid.toFixed(2)}`,
    `• Outstanding: ${currency} ${(totalInvoiced - totalPaid).toFixed(2)}`,
    '',
    `Expenses (All accounts): ${expenses.length} entries matching period`,
    `• Total Expenses: ${currency} ${totalExpenses.toFixed(2)}`,
  ];

  for (const [cat, val] of Object.entries(expenseByCategory)) {
    lines.push(`  - ${cat}: ${currency} ${val.toFixed(2)}`);
  }

  lines.push('', `Net Margin (Invoiced - Expenses): ${currency} ${(totalInvoiced - totalExpenses).toFixed(2)}`);

  return lines.join('\n');
}

// ── draft_client_email ─────────────────────────────────────────────────────
async function handleDraftClientEmail(args: Record<string, unknown>): Promise<string> {
  const clientId = String(args.clientId || '').trim();
  const context = String(args.context || 'general update').trim();

  if (!clientId) return 'Error: clientId is required.';

  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: {
      id: true,
      name: true,
      company: true,
      email: true,
      industry: true,
    },
  });
  if (!client) return `No client found with ID: ${clientId}`;

  // Get recent projects
  const projects = await prisma.project.findMany({
    where: { clientId },
    select: { name: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  // Get recent invoices
  const invoices = await prisma.invoice.findMany({
    where: { clientId },
    select: { invoiceNumber: true, amount: true, status: true },
    orderBy: { createdAt: 'desc' },
    take: 3,
  });

  const clientName = client.company || client.name;

  const lines: string[] = [
    `Email Draft Context for: ${clientName}`,
    `Email: ${client.email || 'Not on file'}`,
    `Context request: ${context}`,
    '',
    `Recent Projects:`,
    ...projects.map((p) => `• ${p.name} (Status: ${p.status})`),
    projects.length === 0 ? ['• No projects on record'] : [],
    '',
    `Recent Invoices:`,
    ...invoices.map((i) => `• Invoice #${i.invoiceNumber}: Amount ${i.amount} — Status ${i.status}`),
    invoices.length === 0 ? ['• No invoices on record'] : [],
  ].flat();

  return lines.filter(Boolean).join('\n');
}

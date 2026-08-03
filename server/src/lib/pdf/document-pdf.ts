import fs from 'fs/promises';
import path from 'path';
import { prisma } from '../prisma.js';
import { AppError } from '../errors.js';
import { PATHS } from '../paths.js';
import { ensureVerificationToken } from './ensure-verification-token.js';
import { renderInvoicePdf } from './render-invoice.js';
import { renderHrDocumentPdf } from './render-hr.js';
import type { InvoicePdfAgency, InvoicePdfItem } from './invoice-html.js';
import type { HrDocumentType, HrPdfAgency, HrPdfContent } from './hr-html.js';

async function loadAgencySettings(): Promise<InvoicePdfAgency> {
  const settings = await prisma.agencySettings.findFirst({
    select: {
      agencyName: true,
      logo: true,
      address: true,
      adminEmail: true,
      phone: true,
      website: true,
      defaultInvoiceNotes: true,
      currency: true,
      timezone: true,
      primaryColor: true,
      signature: true,
      stamp: true,
    },
  });
  return settings || {};
}

function mapItems(
  items: Array<{ description: string; quantity: number; unitPrice: number }> | undefined
): InvoicePdfItem[] {
  return (items || []).map((it) => ({
    description: it.description,
    quantity: it.quantity,
    unitPrice: it.unitPrice,
  }));
}

export async function renderInvoicePdfById(idOrNumber: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const invoice = await prisma.invoice.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { invoiceNumber: idOrNumber }],
    },
    include: {
      client: true,
      items: { orderBy: { position: 'asc' } },
    },
  });
  if (!invoice) throw AppError.notFound('Invoice not found');

  const agency = await loadAgencySettings();
  const verificationToken = await ensureVerificationToken('invoice', invoice.id);
  const displayId = invoice.invoiceNumber || invoice.id;

  const buffer = await renderInvoicePdf({
    type: 'Invoice',
    id: displayId,
    date: invoice.date,
    dueDate: invoice.dueDate,
    client: invoice.client.company || invoice.client.name,
    clientEmail: invoice.client.email,
    clientAddress: invoice.client.address,
    items: mapItems(invoice.items),
    notes: invoice.notes,
    taxRate: invoice.taxRate,
    discount: invoice.discount,
    discountType: invoice.discountType,
    deposit: invoice.deposit,
    paymentMethod: invoice.paymentMethod,
    amount: invoice.amount,
    status: invoice.status,
    showSignature: invoice.showSignature,
    showStamp: invoice.showStamp,
    deliveryNoteEnabled: invoice.deliveryNoteEnabled,
    deliveryNoteTitle: invoice.deliveryNoteTitle,
    deliveryNoteContent: invoice.deliveryNoteContent,
    agency,
    verificationToken,
  });

  const safe = displayId.replace(/[^\w\-]+/g, '_').slice(0, 80);
  return { buffer, filename: `${safe}.pdf` };
}

export async function renderProformaPdfById(idOrNumber: string): Promise<{
  buffer: Buffer;
  filename: string;
}> {
  const proforma = await prisma.proforma.findFirst({
    where: {
      OR: [{ id: idOrNumber }, { proformaNumber: idOrNumber }],
    },
    include: {
      client: true,
      items: { orderBy: { position: 'asc' } },
    },
  });
  if (!proforma) throw AppError.notFound('Proforma not found');

  const agency = await loadAgencySettings();
  const verificationToken = await ensureVerificationToken('proforma', proforma.id);
  const displayId = proforma.proformaNumber || proforma.id;

  const buffer = await renderInvoicePdf({
    type: 'Proforma',
    id: displayId,
    date: proforma.date,
    dueDate: proforma.dueDate,
    client: proforma.client.company || proforma.client.name,
    clientEmail: proforma.client.email,
    clientAddress: proforma.client.address,
    items: mapItems(proforma.items),
    notes: proforma.notes,
    taxRate: proforma.taxRate,
    discount: proforma.discount,
    discountType: proforma.discountType,
    deposit: proforma.deposit,
    amount: proforma.amount,
    status: proforma.status,
    showSignature: proforma.showSignature,
    showStamp: proforma.showStamp,
    deliveryNoteEnabled: proforma.deliveryNoteEnabled,
    deliveryNoteTitle: proforma.deliveryNoteTitle,
    deliveryNoteContent: proforma.deliveryNoteContent,
    agency,
    verificationToken,
  });

  const safe = displayId.replace(/[^\w\-]+/g, '_').slice(0, 80);
  return { buffer, filename: `${safe}.pdf` };
}

async function loadHrAgencySettings(): Promise<HrPdfAgency> {
  const settings = await prisma.agencySettings.findFirst({
    select: {
      agencyName: true,
      logo: true,
      address: true,
      adminEmail: true,
      phone: true,
      website: true,
      currency: true,
      timezone: true,
      primaryColor: true,
      signature: true,
      stamp: true,
    },
  });
  return settings || {};
}

function parseHrContent(content: unknown): Partial<HrPdfContent> {
  if (!content || typeof content !== 'object' || Array.isArray(content)) {
    return {};
  }
  return content as Partial<HrPdfContent>;
}

export async function renderHrPdfById(id: string): Promise<{
  buffer: Buffer;
  filename: string;
  pdfUrl: string;
}> {
  const document = await prisma.hrDocument.findUnique({
    where: { id },
  });
  if (!document) throw AppError.notFound('HR document not found');

  const agency = await loadHrAgencySettings();
  const verificationToken = await ensureVerificationToken('hr_document', document.id);

  const contentFields = parseHrContent(document.content);
  const data: HrPdfContent = {
    date: new Date().toISOString().split('T')[0]!,
    employeeName: '',
    employeeId: '',
    employeeTitle: '',
    employeeDepartment: '',
    employeeHireDate: '',
    employeeContractType: 'Full-Time',
    employeeStatus: 'ACTIVE',
    ...contentFields,
    docNumber: document.docNumber,
    status: document.status,
  };

  const buffer = await renderHrDocumentPdf({
    docType: document.docType as HrDocumentType,
    data,
    agency,
    verificationToken,
  });

  await fs.mkdir(PATHS.EMPLOYEE_DOCS, { recursive: true });
  const filename = `hr-${document.docNumber.toLowerCase()}-v${document.version}-${Date.now()}.pdf`;
  const filePath = path.resolve(PATHS.EMPLOYEE_DOCS, filename);
  await fs.writeFile(filePath, buffer);

  const pdfUrl = `/uploads/employee-docs/${filename}`;
  await prisma.hrDocument.update({
    where: { id: document.id },
    data: { pdfUrl },
  });

  return {
    buffer,
    filename: `${document.docNumber}.pdf`,
    pdfUrl,
  };
}

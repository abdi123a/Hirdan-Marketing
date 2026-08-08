export const HR_DOC_TYPES = [
  'WORK_CERTIFICATE',
  'SALARY_CERTIFICATE',
  'PAYSLIP',
  'WARNING_CERTIFICATE',
  'INTERNSHIP_ACCEPTED_CERTIFICATE',
  'INTERNSHIP_LETTER',
] as const;

export type HrDocType = (typeof HR_DOC_TYPES)[number];

export const HR_DOC_TYPE_LABELS: Record<HrDocType, string> = {
  WORK_CERTIFICATE: 'Work Certificate',
  SALARY_CERTIFICATE: 'Salary Certificate',
  PAYSLIP: 'Payslip',
  WARNING_CERTIFICATE: 'Warning Notice',
  INTERNSHIP_ACCEPTED_CERTIFICATE: 'Internship Confirmation',
  INTERNSHIP_LETTER: 'Internship Completion',
};

export function hrDocTypeLabel(docType?: string | null) {
  const key = String(docType || '') as HrDocType;
  return HR_DOC_TYPE_LABELS[key] || String(docType || 'Document').replace(/_/g, ' ');
}

export function hrStatusTone(
  status?: string | null
): 'default' | 'success' | 'warning' | 'destructive' | 'gold' {
  const s = String(status || '').toUpperCase();
  if (s === 'FINAL' || s === 'APPROVED') return 'success';
  if (s === 'PENDING_APPROVAL') return 'warning';
  if (s === 'REJECTED') return 'destructive';
  if (s === 'DRAFT') return 'gold';
  return 'default';
}

export function hrStatusLabel(status?: string | null) {
  return String(status || 'UNKNOWN')
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export type HrDocumentRow = {
  id: string;
  docType: string;
  docNumber: string;
  status?: string;
  generatedAt?: string;
  createdAt?: string;
  employee?: { id: string; name: string; email?: string | null; department?: string | null };
  content?: Record<string, unknown> | null;
};

export function hrDocFromApi(raw: Record<string, unknown>): HrDocumentRow {
  return {
    id: String(raw.id),
    docType: String(raw.docType || raw.type || ''),
    docNumber: String(raw.docNumber || ''),
    status: raw.status as string | undefined,
    generatedAt: (raw.generatedAt as string) || (raw.createdAt as string),
    createdAt: raw.createdAt as string | undefined,
    employee: raw.employee as HrDocumentRow['employee'],
    content: (raw.content as Record<string, unknown>) || null,
  };
}

export function hrDocTitle(doc: HrDocumentRow) {
  const fromContent = doc.content?.sectionTitle;
  if (typeof fromContent === 'string' && fromContent.trim()) return fromContent.trim();
  return `${hrDocTypeLabel(doc.docType)} · ${doc.docNumber}`;
}

export function buildHrContent(params: {
  employee: {
    name: string;
    role?: string | null;
    department?: string | null;
    startDate?: string | null;
    gender?: string | null;
  };
  title: string;
  notes?: string;
}) {
  const { employee, title, notes } = params;
  const noteBlock = notes?.trim()
    ? `<p>${notes.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;')}</p>`
    : '';

  return {
    date: new Date().toISOString().slice(0, 10),
    employeeName: employee.name,
    employeeTitle: employee.role || '',
    employeeDepartment: employee.department || '',
    employeeHireDate: employee.startDate || '',
    gender: employee.gender || '',
    sectionTitle: title.trim(),
    letterText: noteBlock,
    closingText: '',
  };
}

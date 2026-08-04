import QRCode from 'qrcode';
import { resolveAssetUrl } from './content-plan-html.js';
import { getShortVerificationUrl } from '../short-url.js';

export type HrDocumentType =
  | 'WORK_CERTIFICATE'
  | 'SALARY_CERTIFICATE'
  | 'PAYSLIP'
  | 'WARNING_CERTIFICATE'
  | 'INTERNSHIP_ACCEPTED_CERTIFICATE'
  | 'INTERNSHIP_LETTER';

export type HrPdfAllowance = { label: string; amount: number | string };

export type HrPdfContent = {
  id?: string;
  docNumber: string;
  date: string;
  employeeName: string;
  employeeId: string;
  employeeTitle: string;
  employeeDepartment: string;
  employeeHireDate: string;
  employeeContractType: string;
  employeeStatus: string;
  employeeEndDate?: string;
  basicSalary?: number;
  housingAllowance?: number;
  transportAllowance?: number;
  otherAllowances?: HrPdfAllowance[];
  grossTotal?: number;
  currency?: string;
  bankName?: string;
  accountNumber?: string;
  paymentMethod?: string;
  incidentDate?: string;
  warningLevel?: string;
  reason?: string;
  issuedBy?: string;
  hrSignatory?: string;
  purpose?: string;
  coordinatorName?: string;
  degreeMajor?: string;
  internshipDuration?: string;
  workSchedule?: string;
  natureOfInternship?: string;
  supervisorName?: string;
  supervisorTitle?: string;
  institutionName?: string;
  task1?: string;
  task2?: string;
  task3?: string;
  gender?: string;
  status?: string;
  showSignature?: boolean;
  showStamp?: boolean;
  sectionTitle?: string;
  letterText?: string;
  closingText?: string;
};

export type HrPdfAgency = {
  agencyName?: string | null;
  logo?: string | null;
  address?: string | null;
  adminEmail?: string | null;
  phone?: string | null;
  website?: string | null;
  currency?: string | null;
  timezone?: string | null;
  primaryColor?: string | null;
  signature?: string | null;
  stamp?: string | null;
};

export type HrPdfInput = {
  docType: HrDocumentType;
  data: HrPdfContent;
  agency: HrPdfAgency;
  verificationToken?: string | null;
};

const ACCENT = '#f6b317';
const SECONDARY = '#64748b';
const TEXT_DARK = '#0f172a';
const LIGHT_BG = '#f8fafc';
const BORDER = '#e2e8f0';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(date: string | Date, timezone: string): string {
  if (!date || date === 'N/A') return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (Number.isNaN(d.getTime())) return String(date);
  try {
    return new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeZone: timezone || 'UTC',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency || 'USD',
    }).format(amount);
  } catch {
    return `${amount}`;
  }
}

function docTitle(docType: HrDocumentType): string {
  switch (docType) {
    case 'WORK_CERTIFICATE':
      return 'Employment Certificate';
    case 'SALARY_CERTIFICATE':
      return 'Salary Certificate';
    case 'PAYSLIP':
      return 'Salary Payslip';
    case 'WARNING_CERTIFICATE':
      return 'Disciplinary Warning';
    case 'INTERNSHIP_ACCEPTED_CERTIFICATE':
      return 'Internship Confirmation';
    case 'INTERNSHIP_LETTER':
      return 'Internship Completion';
    default:
      return 'HR Document';
  }
}

function genderPrefix(gender?: string): string {
  return gender?.toLowerCase() === 'female' ? 'Ms.' : 'Mr.';
}

function getLast3Months(baseDateStr: string): Array<{ label: string; key: string }> {
  let baseDate = new Date(baseDateStr);
  if (Number.isNaN(baseDate.getTime())) {
    baseDate = new Date();
  }
  const months: Array<{ label: string; key: string }> = [];
  for (let i = 2; i >= 0; i--) {
    const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
    months.push({
      label: d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      key: `${d.getFullYear()}-${d.getMonth() + 1}`,
    });
  }
  return months;
}

function iconPhone(): string {
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
}

function iconEmail(): string {
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.53 5.33a2 2 0 0 1-2.94 0L2 7"/></svg>`;
}

function iconWeb(): string {
  return `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>`;
}

function sectionHeading(primary: string, label: string, accentColor?: string): string {
  const color = accentColor || primary;
  return `
    <div class="section-heading">
      <div class="section-heading__rule" style="background:${escapeHtml(color)}"></div>
      <div class="section-heading__label" style="color:${escapeHtml(color)}">${escapeHtml(label)}</div>
    </div>`;
}

function renderLetterHtml(text: string, paraClass = 'para para--justify'): string {
  if (!text?.trim()) return '';

  const looksHtml = /<\/?[a-z][\s\S]*>/i.test(text);
  if (!looksHtml) {
    return text
      .replace(/\r\n/g, '\n')
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean)
      .map((block) => `<p class="${paraClass}" style="white-space:pre-wrap">${escapeHtml(block)}</p>`)
      .join('');
  }

  // Sanitize but keep formatting tags
  const stripped = text
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  const safe = stripped.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    const allowed = new Set(['b', 'strong', 'i', 'em', 'u', 's', 'br', 'p', 'div', 'span', 'ul', 'ol', 'li', 'font']);
    if (!allowed.has(t)) return '';
    if (match.startsWith('</')) return `</${t}>`;
    const styleMatch = attrs.match(/style\s*=\s*("([^"]*)"|'([^']*)')/i);
    let attrStr = '';
    if (styleMatch) {
      const style = (styleMatch[2] || styleMatch[3] || '')
        .replace(/expression\s*\(/gi, '')
        .replace(/url\s*\(/gi, '')
        .replace(/javascript:/gi, '');
      if (style.trim()) attrStr = ` style="${style}"`;
    }
    return `<${t}${attrStr}>`;
  });

  // Ensure paragraphs get the document class styling
  return safe
    .replace(/<p(\s[^>]*)?>/gi, `<p class="${paraClass}"$1>`)
    .replace(/<p class="[^"]*"\s+class="/gi, `<p class="${paraClass} `);
}

function buildWorkCertificate(
  data: HrPdfContent,
  agencyName: string,
  primary: string,
  timezone: string
): string {
  const title = data.sectionTitle || 'Certificate of Employment';

  if (data.letterText?.trim()) {
    return `
    <div class="body-text body-text--spaced">
      ${sectionHeading(primary, title)}
      ${renderLetterHtml(data.letterText)}
    </div>`;
  }

  const terminated =
    data.employeeStatus === 'TERMINATED' && data.employeeEndDate
      ? `<span> His/Her employment with our organization concluded on <strong>${escapeHtml(formatDate(data.employeeEndDate, timezone))}</strong>.</span>`
      : `<span> He/She is currently active, in good standing, and continues to be employed by <strong>${escapeHtml(agencyName)}</strong>.</span>`;

  return `
    <div class="body-text body-text--spaced">
      ${sectionHeading(primary, title)}
      <p class="para">To Whom It May Concern,</p>
      <p class="para para--justify">
        This is to formally certify that <strong>${escapeHtml(data.employeeName)}</strong> is employed with <strong>${escapeHtml(agencyName)}</strong>.
        He/She holds the position of <strong>${escapeHtml(data.employeeTitle)}</strong> in the <strong>${escapeHtml(data.employeeDepartment || 'N/A')}</strong> department, and has been part of our team since <strong>${escapeHtml(formatDate(data.employeeHireDate, timezone))}</strong>.
      </p>
      <p class="para para--justify">
        Their employment status is currently recorded as <strong>${escapeHtml(data.employeeContractType || 'Full-Time')}</strong>.
        ${terminated}
      </p>
      <p class="para para--justify para--last">
        This certificate is issued upon the request of the employee without any liability or financial obligation on the part of <strong>${escapeHtml(agencyName)}</strong>.
      </p>
    </div>`;
}

function buildSalaryCertificate(
  data: HrPdfContent,
  agencyName: string,
  primary: string,
  timezone: string,
  currency: string
): string {
  const title = data.sectionTitle || 'Compensation Verification';
  const purposeBlock = data.purpose
    ? `<p class="para para--italic">This certificate has been issued at the employee's request for the specific purpose of: <strong>${escapeHtml(data.purpose)}</strong>.</p>`
    : '';

  const housingRow =
    data.housingAllowance != null && data.housingAllowance !== 0
      ? `<tr><td class="td-secondary">Housing Allowance</td><td class="td-right">${escapeHtml(formatMoney(data.housingAllowance, currency))}</td></tr>`
      : '';

  const transportRow =
    data.transportAllowance != null && data.transportAllowance !== 0
      ? `<tr><td class="td-secondary">Transport Allowance</td><td class="td-right">${escapeHtml(formatMoney(data.transportAllowance, currency))}</td></tr>`
      : '';

  const otherRows = (data.otherAllowances || [])
    .map(
      (item) =>
        `<tr><td class="td-secondary">${escapeHtml(item.label)}</td><td class="td-right">${escapeHtml(formatMoney(Number(item.amount || 0), currency))}</td></tr>`
    )
    .join('');

  const intro = data.letterText?.trim()
    ? renderLetterHtml(data.letterText)
    : `
      <p class="para">To Whom It May Concern,</p>
      <p class="para para--justify">
        This is to certify that <strong>${escapeHtml(data.employeeName)}</strong> is employed with <strong>${escapeHtml(agencyName)}</strong> as a <strong>${escapeHtml(data.employeeTitle)}</strong> since <strong>${escapeHtml(formatDate(data.employeeHireDate, timezone))}</strong>.
      </p>
      ${purposeBlock}
      <p class="para">A detailed breakdown of their gross monthly compensation is provided below:</p>`;

  const closing = data.closingText?.trim()
    ? `<div class="para para--small">${renderLetterHtml(data.closingText, 'para para--small')}</div>`
    : `<p class="para para--small">
        * All disbursals are made in <strong>${escapeHtml(data.currency || currency)}</strong> via <strong>${escapeHtml(data.paymentMethod || 'Bank Transfer')}</strong> to Bank: <strong>${escapeHtml(data.bankName || 'N/A')}</strong> (Account: <strong>${escapeHtml(data.accountNumber || 'N/A')}</strong>).
      </p>`;

  return `
    <div class="body-text">
      ${sectionHeading(primary, title)}
      ${intro}
      <div class="salary-table-wrap">
        <table class="salary-table">
          <thead>
            <tr>
              <th>Salary Component</th>
              <th class="th-right">Monthly Amount</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="td-bold">Basic Salary</td>
              <td class="td-right td-bold">${escapeHtml(formatMoney(data.basicSalary || 0, currency))}</td>
            </tr>
            ${housingRow}
            ${transportRow}
            ${otherRows}
            <tr class="salary-table__total">
              <td class="td-total">Total Gross Monthly</td>
              <td class="td-right td-total">${escapeHtml(formatMoney(data.grossTotal || 0, currency))}</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${closing}
    </div>`;
}

function buildPayslip(data: HrPdfContent, primary: string, currency: string): string {
  const months = getLast3Months(data.date);

  const monthBlocks = months
    .map((m) => {
      const housingLine =
        data.housingAllowance != null && data.housingAllowance !== 0
          ? `<div class="payslip-line"><span class="payslip-line__label">Housing Allowance</span><span>${escapeHtml(formatMoney(data.housingAllowance, currency))}</span></div>`
          : '';
      const transportLine =
        data.transportAllowance != null && data.transportAllowance !== 0
          ? `<div class="payslip-line"><span class="payslip-line__label">Transport Allowance</span><span>${escapeHtml(formatMoney(data.transportAllowance, currency))}</span></div>`
          : '';
      const otherLines = (data.otherAllowances || [])
        .map(
          (a) =>
            `<div class="payslip-line"><span class="payslip-line__label">${escapeHtml(a.label)}</span><span>${escapeHtml(formatMoney(Number(a.amount || 0), currency))}</span></div>`
        )
        .join('');

      return `
        <div class="payslip-card">
          <div class="payslip-badge">Disbursed &amp; Paid</div>
          <div class="payslip-card__header">
            <div>
              <h4 class="payslip-card__title">Payslip Receipt</h4>
              <span class="payslip-card__cycle">Cycle: ${escapeHtml(m.label)}</span>
            </div>
            <div class="payslip-card__account">
              <span class="payslip-card__account-label">Disbursal Account</span>
              <span class="payslip-card__account-value">${escapeHtml(data.bankName || '')} - ${escapeHtml(data.accountNumber || '')}</span>
            </div>
          </div>
          <div class="payslip-grid">
            <div class="payslip-grid__left">
              <div class="payslip-line"><span class="payslip-line__label">Basic Salary</span><span class="payslip-line__value">${escapeHtml(formatMoney(data.basicSalary || 0, currency))}</span></div>
              ${housingLine}
              ${transportLine}
              ${otherLines}
            </div>
            <div class="payslip-grid__right">
              <div class="payslip-meta">
                <span class="payslip-meta__label">Employee</span>
                <span class="payslip-meta__value">${escapeHtml(data.employeeName)}</span>
              </div>
              <div class="payslip-meta payslip-meta--spaced">
                <span class="payslip-meta__label">Designation</span>
                <span>${escapeHtml(data.employeeTitle)} (${escapeHtml(data.employeeDepartment)})</span>
              </div>
              <div class="payslip-net">
                <span class="payslip-net__label">Net Deposited</span>
                <span class="payslip-net__value">${escapeHtml(formatMoney(data.grossTotal || 0, currency))}</span>
              </div>
            </div>
          </div>
        </div>`;
    })
    .join('');

  return `
    <div class="payslip-body">
      ${sectionHeading(primary, 'Historical Payroll Statements (Last 3 Cycles)')}
      ${monthBlocks}
    </div>`;
}

function buildWarningCertificate(data: HrPdfContent, primary: string, timezone: string): string {
  const title = data.sectionTitle || 'Formal Disciplinary Action Letter';
  const intro = data.letterText?.trim()
    ? renderLetterHtml(data.letterText)
    : `
      <p class="para">Dear <strong>${escapeHtml(data.employeeName)}</strong>,</p>
      <p class="para para--justify">
        This letter serves as a formal disciplinary warning regarding documented performance concerns or behavioral policy violations.
        We hold our employees to the highest professional standards, and it has become necessary to address areas where those standards have not been met.
      </p>`;

  const closing = data.closingText?.trim()
    ? renderLetterHtml(data.closingText)
    : `
      <p class="para para--justify">
        Please be advised that immediate and sustained improvement is required.
        Failure to correct these performance issues or any further violations of company policies will result in additional disciplinary actions, up to and including termination of employment.
      </p>
      ${data.issuedBy ? `<p class="para">This warning letter is formally issued by: <strong>${escapeHtml(data.issuedBy)}</strong>.</p>` : ''}`;

  return `
    <div class="body-text">
      ${sectionHeading('#ef4444', title, '#ef4444')}
      <div class="warning-banner">
        <div>
          <span class="warning-banner__label">Warning Level</span>
          <span class="warning-banner__level">${escapeHtml(data.warningLevel || '1st Warning')}</span>
        </div>
        <div class="warning-banner__right">
          <span class="warning-banner__date-label">Date of Incident</span>
          <span class="warning-banner__date">${data.incidentDate ? escapeHtml(formatDate(data.incidentDate, timezone)) : 'N/A'}</span>
        </div>
      </div>
      ${intro}
      <div class="reason-box">
        <h4 class="reason-box__title">Description of Infraction / Concerns</h4>
        <p class="reason-box__text">${escapeHtml(data.reason || 'No description provided.')}</p>
      </div>
      ${closing}
    </div>`;
}

function buildInternshipAccepted(
  data: HrPdfContent,
  agencyName: string,
  primary: string,
  timezone: string
): string {
  const prefix = genderPrefix(data.gender);
  const subject =
    data.sectionTitle ||
    `Subject: Internship Confirmation for ${prefix} ${data.employeeName}`;

  if (data.letterText?.trim()) {
    return `
    <div class="body-text body-text--compact">
      <div class="internship-subject">${escapeHtml(subject)}</div>
      ${renderLetterHtml(data.letterText, 'para para--tight')}
    </div>`;
  }

  return `
    <div class="body-text body-text--compact">
      <div class="internship-subject">${escapeHtml(subject)}</div>
      <p class="para para--tight">Dear ${escapeHtml(data.coordinatorName || 'Internship Committee')},</p>
      <p class="para para--justify para--tight">
        We are pleased to inform you that <strong>${escapeHtml(prefix)} ${escapeHtml(data.employeeName)}</strong>, a student from your
        institution pursuing a <strong>${escapeHtml(data.degreeMajor || 'Bachelor of Science in IT')}</strong>, has been
        officially accepted for an internship position at <strong>${escapeHtml(agencyName)}</strong>.
      </p>
      <p class="para para--tight">The details of the internship placement are outlined below:</p>
      <div class="info-box">
        <ul class="info-list">
          <li>• <strong>Position Title:</strong> ${escapeHtml(data.employeeTitle || 'Digital Marketing Intern')}</li>
          <li>• <strong>Department:</strong> ${escapeHtml(data.employeeDepartment || 'Marketing')}</li>
          <li>• <strong>Internship Duration:</strong> ${escapeHtml(data.internshipDuration || '3 Months')}</li>
          <li>• <strong>Start Date:</strong> ${data.employeeHireDate ? escapeHtml(formatDate(data.employeeHireDate, timezone)) : 'Commencement Date'}</li>
          <li>• <strong>End Date:</strong> ${data.employeeEndDate ? escapeHtml(formatDate(data.employeeEndDate, timezone)) : 'Expected Completion Date'}</li>
          <li>• <strong>Work Schedule:</strong> ${escapeHtml(data.workSchedule || 'Full-time, 40 hours per week')}</li>
          <li>• <strong>Nature of Internship:</strong> ${escapeHtml(data.natureOfInternship || 'Paid')}</li>
        </ul>
      </div>
      <p class="para para--tight">
        During this internship, the student will work under the direct supervision of <strong>${escapeHtml(data.supervisorName || 'Supervisor Name')}</strong> (${escapeHtml(data.supervisorTitle || 'Supervisor Title')}). Their primary responsibilities and learning objectives will include:
      </p>
      <ol class="task-list">
        <li>1. ${escapeHtml(data.task1 || 'Assisting in the development of client software applications')}</li>
        <li>2. ${escapeHtml(data.task2 || 'Analyzing weekly website traffic data and creating reports')}</li>
        <li>3. ${escapeHtml(data.task3 || 'Participating in team strategy and brainstorming meetings')}</li>
      </ol>
      <p class="para para--justify para--tight">
        If you require any additional information or specific academic paperwork filled out,
        please do not hesitate to reach out.
      </p>
    </div>`;
}

function buildInternshipLetter(
  data: HrPdfContent,
  agencyName: string,
  primary: string,
  timezone: string
): string {
  const title = data.sectionTitle || 'Internship Completion Certificate';

  if (data.letterText?.trim()) {
    return `
    <div class="body-text body-text--compact">
      ${sectionHeading(primary, title)}
      ${renderLetterHtml(data.letterText, 'para para--tight')}
    </div>`;
  }

  return `
    <div class="body-text body-text--compact">
      ${sectionHeading(primary, title)}
      <div class="completion-header">
        <div class="completion-header__title">TO WHOM IT MAY CONCERN</div>
        <div class="completion-header__line"></div>
      </div>
      <p class="para para--justify para--tight">
        This is to officially certify that <strong>${escapeHtml(data.employeeName)}</strong>, a student from <strong>${escapeHtml(data.institutionName || 'University of Technology')}</strong> pursuing a <strong>${escapeHtml(data.degreeMajor || 'Bachelor of Science in IT')}</strong>, has successfully completed their internship program at <strong>${escapeHtml(agencyName)}</strong>.
      </p>
      <p class="para para--tight">The details of the internship placement are outlined below:</p>
      <div class="info-box">
        <ul class="info-list">
          <li>• <strong>Position Title:</strong> ${escapeHtml(data.employeeTitle || 'Digital Marketing Intern')}</li>
          <li>• <strong>Department:</strong> ${escapeHtml(data.employeeDepartment || 'Marketing')}</li>
          <li>• <strong>Internship Duration:</strong> ${escapeHtml(data.internshipDuration || '3 Months')}</li>
          <li>• <strong>Start Date:</strong> ${data.employeeHireDate ? escapeHtml(formatDate(data.employeeHireDate, timezone)) : 'Commencement Date'}</li>
          <li>• <strong>End Date:</strong> ${data.employeeEndDate ? escapeHtml(formatDate(data.employeeEndDate, timezone)) : 'Expected Completion Date'}</li>
        </ul>
      </div>
      <p class="para para--justify para--tight">
        During the course of the internship, <strong>${escapeHtml(data.employeeName)}</strong> demonstrated exceptional dedication, professional conduct, and technical proficiency. They were primarily involved in the following projects and responsibilities:
      </p>
      <ol class="task-list">
        <li>1. ${escapeHtml(data.task1 || 'Assisting in the development of client software applications')}</li>
        <li>2. ${escapeHtml(data.task2 || 'Analyzing weekly website traffic data and creating reports')}</li>
        <li>3. ${escapeHtml(data.task3 || 'Participating in team strategy and brainstorming meetings')}</li>
      </ol>
      <p class="para para--justify para--tight">
        Their contribution was highly valuable, and they successfully achieved all the learning objectives set out for this placement. We found them to be self-motivated, eager to learn, and a supportive team player.
      </p>
      <p class="para para--justify para--tight">
        We wish them all the success in their future academic and professional endeavors.
      </p>
    </div>`;
}

function buildBody(
  docType: HrDocumentType,
  data: HrPdfContent,
  agencyName: string,
  primary: string,
  timezone: string,
  currency: string
): string {
  switch (docType) {
    case 'WORK_CERTIFICATE':
      return buildWorkCertificate(data, agencyName, primary, timezone);
    case 'SALARY_CERTIFICATE':
      return buildSalaryCertificate(data, agencyName, primary, timezone, currency);
    case 'PAYSLIP':
      return buildPayslip(data, primary, currency);
    case 'WARNING_CERTIFICATE':
      return buildWarningCertificate(data, primary, timezone);
    case 'INTERNSHIP_ACCEPTED_CERTIFICATE':
      return buildInternshipAccepted(data, agencyName, primary, timezone);
    case 'INTERNSHIP_LETTER':
      return buildInternshipLetter(data, agencyName, primary, timezone);
    default:
      return '';
  }
}

const EMBEDDED_CSS = `
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
html, body {
  width: 210mm;
  min-height: 297mm;
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  color: ${TEXT_DARK};
  background: #fff;
  -webkit-print-color-adjust: exact;
  print-color-adjust: exact;
}
.doc {
  width: 210mm;
  min-height: 297mm;
  position: relative;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: #fff;
}
.watermark-bg {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-45deg);
  opacity: 0.03;
  pointer-events: none;
  z-index: 0;
  width: 140%;
  display: flex;
  justify-content: center;
  align-items: center;
}
.watermark-bg img {
  width: 100%;
  height: auto;
  filter: grayscale(100%);
}
.watermark-bg__text {
  font-size: 180px;
  font-weight: 900;
  color: ${TEXT_DARK};
  text-transform: uppercase;
  text-align: center;
  line-height: 0.9;
}
.top-bar {
  display: flex;
  height: 10px;
  width: 100%;
  z-index: 1;
  position: relative;
}
.top-bar__primary { flex: 1; }
.top-bar__accent { width: 30%; background: ${ACCENT}; }
.status-watermark {
  position: absolute;
  top: 35%;
  left: 50%;
  transform: translate(-50%, -50%) rotate(-30deg);
  font-size: 64px;
  font-weight: 900;
  border: 8px double;
  padding: 16px 40px;
  border-radius: 16px;
  text-transform: uppercase;
  pointer-events: none;
  z-index: 99;
  letter-spacing: 4px;
}
.status-watermark--pending {
  color: rgba(100, 116, 139, 0.15);
  border-color: rgba(100, 116, 139, 0.15);
}
.status-watermark--rejected {
  color: rgba(239, 68, 68, 0.15);
  border-color: rgba(239, 68, 68, 0.15);
}
.content-wrap {
  padding: 28px 48px 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  z-index: 1;
  position: relative;
}
.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}
.header__logo {
  height: 64px;
  width: auto;
  object-fit: contain;
  max-width: 220px;
  margin-bottom: 12px;
  display: block;
}
.header__agency-name {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -1px;
  margin-bottom: 8px;
  line-height: 1;
}
.header__address {
  font-size: 11px;
  color: ${SECONDARY};
  line-height: 1.5;
  max-width: 280px;
}
.header__right { text-align: right; }
.header__title {
  font-size: 28px;
  font-weight: 900;
  letter-spacing: -0.5px;
  text-transform: uppercase;
  line-height: 1.1;
  margin-bottom: 16px;
}
.meta-row {
  display: flex;
  gap: 20px;
  text-align: right;
  justify-content: flex-end;
}
.meta-item__label {
  font-size: 8px;
  font-weight: 800;
  color: ${SECONDARY};
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 2px;
}
.meta-item__value {
  font-size: 12px;
  font-weight: 800;
  color: ${TEXT_DARK};
}
.meta-item__value--primary { font-weight: 900; }
.body-main { flex: 1; z-index: 2; position: relative; }
.body-text { font-size: 14px; line-height: 1.8; color: ${TEXT_DARK}; }
.body-text--spaced { display: flex; flex-direction: column; gap: 0; }
.body-text--compact { font-size: 13px; line-height: 1.5; display: flex; flex-direction: column; gap: 8px; }
.section-heading {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 24px;
}
.section-heading__rule { width: 20px; height: 2px; }
.section-heading__label {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
}
.para { margin-bottom: 16px; }
.para--justify { text-align: justify; }
.para--italic { margin-bottom: 24px; font-style: italic; color: ${SECONDARY}; }
.para--small { margin-bottom: 24px; font-size: 12px; color: ${SECONDARY}; }
.para--last { margin-bottom: 40px; }
.body-text ul, .body-text ol { margin: 0 0 12px 20px; padding: 0; }
.body-text li { margin-bottom: 4px; }
.body-text strong, .body-text b { font-weight: 700; }
.body-text em, .body-text i { font-style: italic; }
.body-text u { text-decoration: underline; }
.para--tight { margin-bottom: 4px; }
.salary-table-wrap {
  border: 1px solid ${BORDER};
  border-radius: 12px;
  overflow: hidden;
  margin-bottom: 32px;
  background: ${LIGHT_BG};
}
.salary-table { width: 100%; border-collapse: collapse; }
.salary-table th {
  padding: 12px 16px;
  text-align: left;
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
}
.salary-table th.th-right { text-align: right; }
.salary-table thead tr { border-bottom: 1px solid ${BORDER}; background: #f1f5f9; }
.salary-table tbody tr { border-bottom: 1px solid ${BORDER}; }
.salary-table td { padding: 12px 16px; }
.td-secondary { color: ${SECONDARY}; }
.td-bold { font-weight: 600; }
.td-right { text-align: right; }
.salary-table__total { background: rgba(90, 66, 138, 0.05); }
.td-total { padding: 14px 16px; font-weight: 900; font-size: 15px; }
.payslip-body { display: flex; flex-direction: column; gap: 32px; }
.payslip-card {
  border: 2px solid ${BORDER};
  border-radius: 16px;
  padding: 20px;
  background: #fff;
  position: relative;
  page-break-inside: avoid;
}
.payslip-badge {
  position: absolute;
  top: 20px;
  right: 20px;
  border: 3px solid #10b981;
  border-radius: 8px;
  padding: 4px 12px;
  color: #10b981;
  font-size: 11px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 1px;
  transform: rotate(-5deg);
}
.payslip-card__header {
  display: flex;
  justify-content: space-between;
  border-bottom: 1px solid ${BORDER};
  padding-bottom: 12px;
  margin-bottom: 16px;
}
.payslip-card__title {
  font-size: 13px;
  font-weight: 900;
  text-transform: uppercase;
}
.payslip-card__cycle { font-size: 11px; color: ${SECONDARY}; font-weight: 700; }
.payslip-card__account { text-align: right; padding-right: 120px; }
.payslip-card__account-label { font-size: 10px; color: ${SECONDARY}; display: block; }
.payslip-card__account-value { font-size: 11px; font-weight: 700; }
.payslip-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  font-size: 12px;
}
.payslip-grid__left { border-right: 1px solid ${BORDER}; padding-right: 20px; }
.payslip-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 6px;
}
.payslip-line__label { color: ${SECONDARY}; }
.payslip-line__value { font-weight: 600; }
.payslip-grid__right {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}
.payslip-meta__label {
  font-size: 9px;
  color: ${SECONDARY};
  text-transform: uppercase;
  display: block;
  font-weight: 800;
}
.payslip-meta__value { font-weight: 700; font-size: 13px; }
.payslip-meta--spaced { margin-top: 8px; }
.payslip-net {
  margin-top: 12px;
  background: rgba(90, 66, 138, 0.05);
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.payslip-net__label { font-weight: 800; font-size: 12px; }
.payslip-net__value { font-weight: 900; font-size: 14px; }
.warning-banner {
  background: rgba(239, 68, 68, 0.05);
  border-left: 4px solid #ef4444;
  padding: 16px 20px;
  border-radius: 0 12px 12px 0;
  margin-bottom: 28px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.warning-banner__label {
  font-size: 10px;
  color: #ef4444;
  text-transform: uppercase;
  font-weight: 900;
  display: block;
  letter-spacing: 0.5px;
}
.warning-banner__level { font-size: 16px; font-weight: 900; color: #b91c1c; }
.warning-banner__right { text-align: right; }
.warning-banner__date-label {
  font-size: 10px;
  color: ${SECONDARY};
  text-transform: uppercase;
  display: block;
}
.warning-banner__date { font-size: 13px; font-weight: 700; }
.reason-box {
  border: 1px solid ${BORDER};
  padding: 20px;
  border-radius: 12px;
  background: ${LIGHT_BG};
  margin-bottom: 24px;
}
.reason-box__title {
  font-size: 11px;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 1px;
  margin-bottom: 8px;
}
.reason-box__text {
  margin: 0;
  font-size: 13px;
  white-space: pre-wrap;
  line-height: 1.6;
}
.internship-subject {
  font-weight: 700;
  margin-bottom: 2px;
  font-size: 14px;
}
.info-box {
  background: ${LIGHT_BG};
  border: 1px solid ${BORDER};
  border-radius: 8px;
  padding: 10px 14px;
  margin-bottom: 4px;
}
.info-list {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.task-list {
  padding-left: 20px;
  margin: 0 0 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.completion-header { text-align: center; margin: 4px 0; padding: 2px 0; }
.completion-header__title {
  font-size: 16px;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 2px;
  margin-bottom: 4px;
}
.completion-header__line {
  width: 80px;
  height: 3px;
  background: ${ACCENT};
  margin: 0 auto;
}
.signatures {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  page-break-inside: avoid;
  margin-bottom: 20px;
  margin-top: 12px;
}
.signatures__left { width: 40%; }
.ack-block {
  border-top: 1px solid ${SECONDARY};
  padding-top: 8px;
  margin-top: 64px;
  width: 200px;
}
.ack-block__label {
  font-size: 9px;
  color: ${SECONDARY};
  text-transform: uppercase;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.ack-block__sub {
  font-size: 11px;
  color: ${TEXT_DARK};
  font-weight: 500;
  margin-top: 2px;
}
.signatures__right {
  text-align: right;
  min-width: 220px;
  position: relative;
}
.sign-box {
  width: 220px;
  height: 110px;
  margin-bottom: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-left: auto;
}
.sign-box__line {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 1.5px;
  background: ${SECONDARY};
  z-index: 0;
  opacity: 0.5;
}
.sign-box__signature {
  position: absolute;
  bottom: 4px;
  left: 0;
  right: 0;
  height: 80px;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 10;
}
.sign-box__signature img {
  max-height: 100%;
  max-width: 100%;
  object-fit: contain;
  filter: contrast(1.1) brightness(0.95);
}
.sign-box__stamp {
  position: absolute;
  left: 50%;
  top: 0;
  height: 110px;
  width: 110px;
  transform: translateX(-50%) rotate(-10deg);
  z-index: 999;
  pointer-events: none;
}
.sign-box__stamp img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  opacity: 0.95;
  filter: drop-shadow(0 4px 10px rgba(0,0,0,0.12));
}
.sign-box__caption {
  font-size: 9px;
  font-weight: 900;
  color: ${TEXT_DARK};
  text-transform: uppercase;
  letter-spacing: 1.5px;
  text-align: center;
}
.footer {
  margin-top: auto;
  color: #fff;
  padding: 24px 48px;
  z-index: 1;
  position: relative;
}
.footer__accent {
  width: 70%;
  height: 4px;
  background: ${ACCENT};
  border-radius: 40px;
  position: absolute;
  top: 0;
  left: 15%;
}
.footer__row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.footer__left {
  display: flex;
  align-items: center;
  gap: 16px;
}
.footer__qr {
  padding: 6px;
  background: #fff;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
}
.footer__qr img { width: 52px; height: 52px; display: block; }
.footer__brand { font-size: 14px; font-weight: 900; color: #fff; margin-bottom: 2px; }
.footer__brand-sub { font-size: 8px; color: rgba(255,255,255,0.4); font-weight: 500; }
.footer__right { text-align: right; }
.footer__contacts {
  display: flex;
  gap: 20px;
  align-items: center;
  justify-content: flex-end;
  opacity: 0.9;
}
.footer__item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  font-weight: 600;
}
.footer__item--accent { color: ${ACCENT}; font-weight: 900; }
.footer__tagline {
  font-size: 9px;
  color: rgba(255,255,255,0.3);
  margin-top: 6px;
  font-weight: 500;
  font-style: italic;
}
`;

export async function buildHrDocumentHtml(input: HrPdfInput): Promise<string> {
  const agency = input.agency || {};
  const data = input.data;
  const primary = agency.primaryColor || '#5A428A';
  const agencyName = agency.agencyName || 'Hirdan Marketing';
  const currency = data.currency || agency.currency || 'USD';
  const timezone = agency.timezone || 'UTC';
  const logoUrl = resolveAssetUrl(agency.logo);
  const signatureUrl = resolveAssetUrl(agency.signature);
  const stampUrl = resolveAssetUrl(agency.stamp);
  const website = (agency.website || '').replace(/^https?:\/\//i, '');

  const showSignature = data.showSignature ?? true;
  const showStamp = data.showStamp ?? true;
  const title = docTitle(input.docType);

  const verificationToken = input.verificationToken || '';
  const verificationUrl = verificationToken ? getShortVerificationUrl(verificationToken) : '';
  let qrDataUrl = '';
  if (verificationUrl) {
    qrDataUrl = await QRCode.toDataURL(verificationUrl, {
      width: 160,
      margin: 1,
      errorCorrectionLevel: 'H',
      color: { dark: primary, light: '#ffffff' },
    });
  }

  const watermarkBg = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" />`
    : `<div class="watermark-bg__text">${escapeHtml(agencyName)}</div>`;

  const logoBlock = logoUrl
    ? `<img class="header__logo" src="${escapeHtml(logoUrl)}" alt="${escapeHtml(agencyName)}" />`
    : `<div class="header__agency-name" style="color:${escapeHtml(primary)}">${escapeHtml(agencyName)}</div>`;

  const statusWatermark =
    data.status === 'PENDING_APPROVAL' || data.status === 'REJECTED'
      ? `<div class="status-watermark ${data.status === 'REJECTED' ? 'status-watermark--rejected' : 'status-watermark--pending'}">${escapeHtml(data.status.replace('_', ' '))}</div>`
      : '';

  const bodyHtml = buildBody(input.docType, data, agencyName, primary, timezone, currency);

  const ackBlock =
    input.docType === 'WARNING_CERTIFICATE'
      ? `
        <div class="ack-block">
          <div class="ack-block__label">Employee Acknowledgment</div>
          <div class="ack-block__sub">Signature &amp; Date</div>
        </div>`
      : '';

  const signatureBlock =
    showSignature || showStamp
      ? `
        <div class="signatures__right">
          <div class="sign-box">
            <div class="sign-box__line"></div>
            ${
              showSignature && signatureUrl
                ? `<div class="sign-box__signature"><img src="${escapeHtml(signatureUrl)}" alt="Signature" /></div>`
                : ''
            }
            ${
              showStamp && stampUrl
                ? `<div class="sign-box__stamp"><img src="${escapeHtml(stampUrl)}" alt="Stamp" /></div>`
                : ''
            }
          </div>
          <div class="sign-box__caption">${escapeHtml(data.hrSignatory || 'Authorized HR Signatory')}</div>
        </div>`
      : '';

  const contacts: string[] = [];
  if (agency.phone) {
    contacts.push(
      `<div class="footer__item">${iconPhone()}<span>${escapeHtml(agency.phone)}</span></div>`
    );
  }
  if (agency.adminEmail) {
    contacts.push(
      `<div class="footer__item">${iconEmail()}<span>${escapeHtml(agency.adminEmail)}</span></div>`
    );
  }
  if (website) {
    contacts.push(
      `<div class="footer__item footer__item--accent">${iconWeb()}<span>${escapeHtml(website)}</span></div>`
    );
  }

  const css = EMBEDDED_CSS.replace(/\$\{ACCENT\}/g, ACCENT)
    .replace(/\$\{SECONDARY\}/g, SECONDARY)
    .replace(/\$\{TEXT_DARK\}/g, TEXT_DARK)
    .replace(/\$\{LIGHT_BG\}/g, LIGHT_BG)
    .replace(/\$\{BORDER\}/g, BORDER);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)} ${escapeHtml(data.docNumber)}</title>
  <style>${css}</style>
</head>
<body>
  <div class="doc">
    <div class="watermark-bg">${watermarkBg}</div>

    <div class="top-bar">
      <div class="top-bar__primary" style="background:${escapeHtml(primary)}"></div>
      <div class="top-bar__accent"></div>
    </div>

    ${statusWatermark}

    <div class="content-wrap">
      <header class="header">
        <div class="header__left">
          ${logoBlock}
          <div class="header__address">
            ${agency.address ? `<div>${escapeHtml(agency.address)}</div>` : ''}
            ${agency.adminEmail ? `<div>${escapeHtml(agency.adminEmail)}</div>` : ''}
          </div>
        </div>
        <div class="header__right">
          <div class="header__title" style="color:${escapeHtml(primary)}">${escapeHtml(title)}</div>
          <div class="meta-row">
            <div>
              <div class="meta-item__label">Doc Ref No.</div>
              <div class="meta-item__value meta-item__value--primary" style="color:${escapeHtml(primary)}">${escapeHtml(data.docNumber)}</div>
            </div>
            <div>
              <div class="meta-item__label">Date Issued</div>
              <div class="meta-item__value">${escapeHtml(formatDate(data.date, timezone))}</div>
            </div>
          </div>
        </div>
      </header>

      <div class="body-main">${bodyHtml}</div>

      <div class="signatures">
        <div class="signatures__left">${ackBlock}</div>
        ${signatureBlock}
      </div>
    </div>

    <footer class="footer" style="background:${escapeHtml(primary)}">
      <div class="footer__accent"></div>
      <div class="footer__row">
        <div class="footer__left">
          ${
            qrDataUrl
              ? `<div class="footer__qr"><img src="${qrDataUrl}" alt="Verification QR" /></div>`
              : ''
          }
          <div>
            <div class="footer__brand">${escapeHtml(agencyName)}</div>
            <div class="footer__brand-sub">${verificationToken ? 'Verified Secure Digital HR Document' : 'Official HR Document'}</div>
          </div>
        </div>
        <div class="footer__right">
          <div class="footer__contacts">${contacts.join('')}</div>
          <div class="footer__tagline">Empowering your brand's future through strategic digital growth</div>
        </div>
      </div>
    </footer>
  </div>
</body>
</html>`;
}

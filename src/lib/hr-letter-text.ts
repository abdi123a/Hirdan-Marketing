import { formatDate } from "@/lib/utils";

export type HrLetterDocType =
  | "WORK_CERTIFICATE"
  | "SALARY_CERTIFICATE"
  | "PAYSLIP"
  | "WARNING_CERTIFICATE"
  | "INTERNSHIP_ACCEPTED_CERTIFICATE"
  | "INTERNSHIP_LETTER";

export type HrLetterFields = {
  employeeName?: string;
  employeeTitle?: string;
  employeeDepartment?: string;
  employeeHireDate?: string;
  employeeContractType?: string;
  employeeStatus?: string;
  employeeEndDate?: string;
  gender?: string;
  purpose?: string;
  currency?: string;
  paymentMethod?: string;
  bankName?: string;
  accountNumber?: string;
  issuedBy?: string;
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
  sectionTitle?: string;
  letterText?: string;
  closingText?: string;
};

export type HrLetterContent = {
  sectionTitle: string;
  letterText: string;
  closingText: string;
};

function salutation(gender?: string) {
  return gender?.toLowerCase() === "female" ? "Ms." : "Mr.";
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function strong(value: string) {
  return `<strong>${esc(value)}</strong>`;
}

function p(html: string) {
  return `<p>${html}</p>`;
}

/** Allow only safe formatting tags for HR letter HTML. */
export function sanitizeHrLetterHtml(html: string): string {
  if (!html) return "";
  const stripped = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe>/gi, "")
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");

  return stripped.replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
    const t = tag.toLowerCase();
    const safe = new Set([
      "b", "strong", "i", "em", "u", "s", "br", "p", "div", "span",
      "ul", "ol", "li", "font",
    ]);
    if (!safe.has(t)) return "";
    if (match.startsWith("</")) return `</${t}>`;

    const allowed: string[] = [];
    const styleMatch = attrs.match(/style\s*=\s*("([^"]*)"|'([^']*)')/i);
    if (styleMatch) {
      const style = (styleMatch[2] || styleMatch[3] || "")
        .replace(/expression\s*\(/gi, "")
        .replace(/url\s*\(/gi, "")
        .replace(/javascript:/gi, "");
      if (style.trim()) allowed.push(`style="${style}"`);
    }
    const attrStr = allowed.length ? ` ${allowed.join(" ")}` : "";
    const selfClose = /\/>$/.test(match) ? " /" : "";
    return `<${t}${attrStr}${selfClose}>`;
  });
}

export function looksLikeHtml(text: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(text || "");
}

/** Convert legacy plain letter text into simple HTML paragraphs. */
export function plainLetterToHtml(text: string): string {
  if (!text?.trim()) return "";
  if (looksLikeHtml(text)) return sanitizeHrLetterHtml(text);
  return text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => `<p>${esc(block).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/** Build default editable letter HTML from current fields (with bold names/values). */
export function buildDefaultLetterContent(
  docType: HrLetterDocType,
  fields: HrLetterFields,
  agencyName: string
): HrLetterContent {
  const name = fields.employeeName || "[Employee Name]";
  const title = fields.employeeTitle || "[Job Title]";
  const dept = fields.employeeDepartment || "N/A";
  const hire = fields.employeeHireDate ? formatDate(fields.employeeHireDate) : "[Hire Date]";
  const contract = fields.employeeContractType || "Full-Time";
  const agency = agencyName || "[Agency]";
  const prefix = salutation(fields.gender);

  switch (docType) {
    case "WORK_CERTIFICATE": {
      const statusLine =
        fields.employeeStatus === "TERMINATED" && fields.employeeEndDate
          ? ` His/Her employment with our organization concluded on ${strong(formatDate(fields.employeeEndDate))}.`
          : ` He/She is currently active, in good standing, and continues to be employed by ${strong(agency)}.`;

      return {
        sectionTitle: "Certificate of Employment",
        letterText: [
          p("To Whom It May Concern,"),
          p(
            `This is to formally certify that ${strong(name)} is employed with ${strong(agency)}. ` +
            `He/She holds the position of ${strong(title)} in the ${strong(dept)} department, ` +
            `and has been part of our team since ${strong(hire)}.`
          ),
          p(
            `Their employment status is currently recorded as ${strong(contract)}.${statusLine}`
          ),
          p(
            `This certificate is issued upon the request of the employee without any liability or financial obligation on the part of ${strong(agency)}.`
          ),
        ].join(""),
        closingText: "",
      };
    }

    case "SALARY_CERTIFICATE": {
      const purposeBlock = fields.purpose
        ? p(
            `This certificate has been issued at the employee's request for the specific purpose of: ${strong(fields.purpose)}.`
          )
        : "";

      return {
        sectionTitle: "Compensation Verification",
        letterText: [
          p("To Whom It May Concern,"),
          p(
            `This is to certify that ${strong(name)} is employed with ${strong(agency)} as a ${strong(title)} since ${strong(hire)}.`
          ),
          purposeBlock,
          p("A detailed breakdown of their gross monthly compensation is provided below:"),
        ].join(""),
        closingText: p(
          `* All disbursals are made in ${strong(fields.currency || "USD")} via ${strong(fields.paymentMethod || "Bank Transfer")} ` +
          `to Bank: ${strong(fields.bankName || "N/A")} (Account: ${strong(fields.accountNumber || "N/A")}).`
        ),
      };
    }

    case "WARNING_CERTIFICATE":
      return {
        sectionTitle: "Formal Disciplinary Action Letter",
        letterText: [
          p(`Dear ${strong(name)},`),
          p(
            "This letter serves as a formal disciplinary warning regarding documented performance concerns or behavioral policy violations. " +
            "We hold our employees to the highest professional standards, and it has become necessary to address areas where those standards have not been met."
          ),
        ].join(""),
        closingText: [
          p(
            "Please be advised that immediate and sustained improvement is required. " +
            "Failure to correct these performance issues or any further violations of company policies will result in additional disciplinary actions, up to and including termination of employment."
          ),
          p(
            fields.issuedBy
              ? `This warning letter is formally issued by: ${strong(fields.issuedBy)}.`
              : "This warning letter is formally issued by the HR department."
          ),
        ].join(""),
      };

    case "INTERNSHIP_ACCEPTED_CERTIFICATE": {
      const major = fields.degreeMajor || "Bachelor of Science in IT";
      const duration = fields.internshipDuration || "3 Months";
      const start = fields.employeeHireDate ? formatDate(fields.employeeHireDate) : "Commencement Date";
      const end = fields.employeeEndDate ? formatDate(fields.employeeEndDate) : "Expected Completion Date";
      const schedule = fields.workSchedule || "Full-time, 40 hours per week";
      const nature = fields.natureOfInternship || "Paid";
      const supervisor = fields.supervisorName || "Supervisor Name";
      const supervisorTitle = fields.supervisorTitle || "Supervisor Title";
      const coordinator = fields.coordinatorName || "Internship Committee";

      return {
        sectionTitle: `Subject: Internship Confirmation for ${prefix} ${name}`,
        letterText: [
          p(`Dear ${esc(coordinator)},`),
          p(
            `We are pleased to inform you that ${strong(`${prefix} ${name}`)}, a student from your institution pursuing a ${strong(major)}, ` +
            `has been officially accepted for an internship position at ${strong(agency)}.`
          ),
          p("The details of the internship placement are outlined below:"),
          `<ul>` +
            `<li><strong>Position Title:</strong> ${esc(title || "Digital Marketing Intern")}</li>` +
            `<li><strong>Department:</strong> ${esc(dept || "Marketing")}</li>` +
            `<li><strong>Internship Duration:</strong> ${esc(duration)}</li>` +
            `<li><strong>Start Date:</strong> ${esc(start)}</li>` +
            `<li><strong>End Date:</strong> ${esc(end)}</li>` +
            `<li><strong>Work Schedule:</strong> ${esc(schedule)}</li>` +
            `<li><strong>Nature of Internship:</strong> ${esc(nature)}</li>` +
          `</ul>`,
          p(
            `During this internship, the student will work under the direct supervision of ${strong(supervisor)} (${esc(supervisorTitle)}). ` +
            "Their primary responsibilities and learning objectives will include:"
          ),
          `<ol>` +
            `<li>${esc(fields.task1 || "Assisting in the development of client software applications")}</li>` +
            `<li>${esc(fields.task2 || "Analyzing weekly website traffic data and creating reports")}</li>` +
            `<li>${esc(fields.task3 || "Participating in team strategy and brainstorming meetings")}</li>` +
          `</ol>`,
          p("If you require any additional information or specific academic paperwork filled out, please do not hesitate to reach out."),
        ].join(""),
        closingText: "",
      };
    }

    case "INTERNSHIP_LETTER": {
      const major = fields.degreeMajor || "Bachelor of Science in IT";
      const institution = fields.institutionName || "University of Technology";
      const duration = fields.internshipDuration || "3 Months";
      const start = fields.employeeHireDate ? formatDate(fields.employeeHireDate) : "Commencement Date";
      const end = fields.employeeEndDate ? formatDate(fields.employeeEndDate) : "Expected Completion Date";

      return {
        sectionTitle: "Internship Completion Certificate",
        letterText: [
          p("<strong>TO WHOM IT MAY CONCERN</strong>"),
          p(
            `This is to officially certify that ${strong(name)}, a student from ${strong(institution)} pursuing a ${strong(major)}, ` +
            `has successfully completed their internship program at ${strong(agency)}.`
          ),
          p("The details of the internship placement are outlined below:"),
          `<ul>` +
            `<li><strong>Position Title:</strong> ${esc(title || "Digital Marketing Intern")}</li>` +
            `<li><strong>Department:</strong> ${esc(dept || "Marketing")}</li>` +
            `<li><strong>Internship Duration:</strong> ${esc(duration)}</li>` +
            `<li><strong>Start Date:</strong> ${esc(start)}</li>` +
            `<li><strong>End Date:</strong> ${esc(end)}</li>` +
          `</ul>`,
          p(
            `During the course of the internship, ${strong(name)} demonstrated exceptional dedication, professional conduct, and technical proficiency. ` +
            "They were primarily involved in the following projects and responsibilities:"
          ),
          `<ol>` +
            `<li>${esc(fields.task1 || "Assisting in the development of client software applications")}</li>` +
            `<li>${esc(fields.task2 || "Analyzing weekly website traffic data and creating reports")}</li>` +
            `<li>${esc(fields.task3 || "Participating in team strategy and brainstorming meetings")}</li>` +
          `</ol>`,
          p("Their contribution was highly valuable, and they successfully achieved all the learning objectives set out for this placement. We found them to be self-motivated, eager to learn, and a supportive team player."),
          p("We wish them all the success in their future academic and professional endeavors."),
        ].join(""),
        closingText: "",
      };
    }

    case "PAYSLIP":
    default:
      return {
        sectionTitle: "Historical Payroll Statements (Last 3 Cycles)",
        letterText: "",
        closingText: "",
      };
  }
}

/** Ensure loaded/saved docs always have editable HTML letter fields. */
export function ensureLetterContent(
  docType: HrLetterDocType,
  fields: HrLetterFields,
  agencyName: string
): HrLetterContent {
  const defaults = buildDefaultLetterContent(docType, fields, agencyName);
  return {
    sectionTitle: fields.sectionTitle?.trim() ? fields.sectionTitle : defaults.sectionTitle,
    letterText:
      fields.letterText != null && fields.letterText !== ""
        ? plainLetterToHtml(fields.letterText)
        : defaults.letterText,
    closingText:
      fields.closingText != null && fields.closingText !== ""
        ? plainLetterToHtml(fields.closingText)
        : defaults.closingText,
  };
}

import { useAgencyStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useRef, useEffect } from "react";
import { ProtectedBrandingImage } from "./ProtectedBrandingImage";

interface PremiumHrDocumentProps {
  docType: 'WORK_CERTIFICATE' | 'SALARY_CERTIFICATE' | 'PAYSLIP' | 'WARNING_CERTIFICATE' | 'INTERNSHIP_ACCEPTED_CERTIFICATE' | 'INTERNSHIP_LETTER';
  data: {
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
    
    // Salary breakdown
    basicSalary?: number;
    housingAllowance?: number;
    transportAllowance?: number;
    otherAllowances?: Array<{ label: string; amount: number | string }>;
    grossTotal?: number;
    currency?: string;
    bankName?: string;
    accountNumber?: string;
    paymentMethod?: string;

    // Warning details
    incidentDate?: string;
    warningLevel?: string;
    reason?: string;
    issuedBy?: string;
    hrSignatory?: string;

    // Salary cert details
    purpose?: string;

    // Internship details
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

    // Document status
    status?: string;
    showSignature?: boolean;
    showStamp?: boolean;
  };
  settings: {
    agencyName: string;
    logo?: string;
    address?: string;
    adminEmail?: string;
    phone?: string;
    website?: string;
    currency: string;
    primaryColor?: string;
    signature?: string;
    stamp?: string;
  };
}

export function PremiumHrDocument({ docType, data, settings: rawSettings }: PremiumHrDocumentProps) {
  const settings = rawSettings || { agencyName: "", currency: "USD" };
  const showSignature = data.showSignature ?? true;
  const showStamp = data.showStamp ?? true;

  // Colors
  const primaryColor = settings.primaryColor || '#504188';
  const accentColor = '#f6b317';
  const secondary = '#64748b';
  const textDark = '#0f172a';
  const lightBg = '#f8fafc';
  const borderColor = '#e2e8f0';

  const formatMoney = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: data.currency || settings.currency || 'USD'
    }).format(amount);
  };

  // Helper to generate last 3 months
  const getLast3Months = (baseDateStr: string) => {
    let baseDate = new Date(baseDateStr);
    if (isNaN(baseDate.getTime())) {
      baseDate = new Date();
    }
    const months = [];
    const locale = 'en-US';
    
    for (let i = 2; i >= 0; i--) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() - i, 1);
      months.push({
        label: d.toLocaleDateString(locale, { month: 'long', year: 'numeric' }),
        key: `${d.getFullYear()}-${d.getMonth() + 1}`
      });
    }
    return months;
  };

  const payslipMonths = getLast3Months(data.date);

  return (
    <div
      className="print-content"
      style={{
        width: '210mm',
        minHeight: '297mm',
        background: '#ffffff',
        fontFamily: "'Inter', -apple-system, sans-serif",
        position: 'relative',
        margin: '0 auto',
        color: textDark,
        boxSizing: 'border-box',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: '1px solid #e2e8f0',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
      }}
    >
      {/* ───────────────── HUGE SIDEWAYS WATERMARK ───────────────── */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        opacity: 0.03,
        pointerEvents: 'none',
        zIndex: 0,
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        width: '140%',
      }}>
        {settings.logo ? (
          <ProtectedBrandingImage
            src={settings.logo}
            alt="watermark"
            style={{ width: '100%', height: 'auto', filter: 'grayscale(100%)', opacity: 1 }}
          />
        ) : (
          <div style={{
            fontSize: '180px', fontWeight: 900,
            color: textDark, textTransform: 'uppercase',
            textAlign: 'center', lineHeight: 0.9,
          }}>
            {settings.agencyName}
          </div>
        )}
      </div>

      {/* ───────────────── TOP COLOR BAR ───────────────── */}
      <div style={{ display: 'flex', height: '10px', width: '100%', zIndex: 1, position: 'relative' }}>
        <div style={{ flex: 1, background: primaryColor }}></div>
        <div style={{ width: '30%', background: accentColor }}></div>
      </div>

      {/* ───────────────── STATUS WATERMARK ───────────────── */}
      {(data.status === 'PENDING_APPROVAL' || data.status === 'REJECTED') && (
        <div style={{
          position: 'absolute',
          top: '35%',
          left: '50%',
          transform: 'translate(-50%, -50%) rotate(-30deg)',
          fontSize: '64px',
          fontWeight: 900,
          color: data.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)',
          border: `8px double ${data.status === 'REJECTED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(100, 116, 139, 0.15)'}`,
          padding: '16px 40px',
          borderRadius: '16px',
          textTransform: 'uppercase',
          pointerEvents: 'none',
          zIndex: 99,
          letterSpacing: '4px',
        }}>
          {data.status.replace('_', ' ')}
        </div>
      )}

      <div style={{ padding: '40px 48px 0 48px', flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, position: 'relative' }}>

        {/* ───────────────── HEADER ───────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '40px' }}>
          <div>
            {settings.logo ? (
              <ProtectedBrandingImage
                src={settings.logo}
                alt={settings.agencyName}
                style={{ height: '64px', width: 'auto', objectFit: 'contain', maxWidth: '220px', marginBottom: '12px' }}
              />
            ) : (
              <div style={{
                fontSize: '28px', fontWeight: 900, color: primaryColor,
                letterSpacing: '-1px', marginBottom: '8px', lineHeight: 1
              }}>
                {settings.agencyName}
              </div>
            )}
            <div style={{ fontSize: '11px', color: secondary, lineHeight: 1.5, maxWidth: '280px' }}>
              {settings.address && <div>{settings.address}</div>}
              {settings.adminEmail && <div>{settings.adminEmail}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '28px', fontWeight: 900, color: primaryColor,
              letterSpacing: '-0.5px', textTransform: 'uppercase', lineHeight: 1.1, marginBottom: '16px'
            }}>
              {docType === 'WORK_CERTIFICATE' && 'Employment Certificate'}
              {docType === 'SALARY_CERTIFICATE' && 'Salary Certificate'}
              {docType === 'PAYSLIP' && 'Salary Payslip'}
              {docType === 'WARNING_CERTIFICATE' && 'Disciplinary Warning'}
              {docType === 'INTERNSHIP_ACCEPTED_CERTIFICATE' && 'Internship Confirmation'}
              {docType === 'INTERNSHIP_LETTER' && 'Internship Completion'}
            </div>

            <div style={{ display: 'flex', gap: '20px', textAlign: 'right', justifyContent: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '8px', fontWeight: 800, color: secondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Doc Ref No.</div>
                <div style={{ fontSize: '12px', fontWeight: 900, color: primaryColor }}>{data.docNumber}</div>
              </div>
              <div>
                <div style={{ fontSize: '8px', fontWeight: 800, color: secondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '2px' }}>Date Issued</div>
                <div style={{ fontSize: '12px', fontWeight: 800, color: textDark }}>{formatDate(data.date)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────── DOCUMENT CONTENT ───────────────── */}
        <div style={{ flex: 1, zIndex: 2, position: 'relative' }}>

          {/* 1. WORK CERTIFICATE */}
          {docType === 'WORK_CERTIFICATE' && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: textDark, display: 'flex', flexDirection: 'column', gap: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '28px' }}>
                <div style={{ width: '20px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Certificate of Employment
                </div>
              </div>

              <p style={{ marginBottom: '20px' }}>To Whom It May Concern,</p>
              
              <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                This is to formally certify that <strong>{data.employeeName}</strong> (Employee ID: <strong>{data.employeeId}</strong>) is employed with <strong>{settings.agencyName}</strong>. 
                He/She holds the position of <strong>{data.employeeTitle}</strong> in the <strong>{data.employeeDepartment || 'N/A'}</strong> department, and has been part of our team since <strong>{formatDate(data.employeeHireDate)}</strong>.
              </p>

              <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                Their employment status is currently recorded as <strong>{data.employeeContractType || 'Full-Time'}</strong>.
                {data.employeeStatus === 'TERMINATED' && data.employeeEndDate ? (
                  <span> His/Her employment with our organization concluded on <strong>{formatDate(data.employeeEndDate)}</strong>.</span>
                ) : (
                  <span> He/She is currently active, in good standing, and continues to be employed by <strong>{settings.agencyName}</strong>.</span>
                )}
              </p>

              <p style={{ marginBottom: '40px', textAlign: 'justify' }}>
                This certificate is issued upon the request of the employee without any liability or financial obligation on the part of <strong>{settings.agencyName}</strong>.
              </p>
            </div>
          )}

          {/* 2. SALARY CERTIFICATE */}
          {docType === 'SALARY_CERTIFICATE' && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: textDark }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '20px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Compensation Verification
                </div>
              </div>

              <p style={{ marginBottom: '16px' }}>To Whom It May Concern,</p>

              <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                This is to certify that <strong>{data.employeeName}</strong> (Employee ID: <strong>{data.employeeId}</strong>) is employed with <strong>{settings.agencyName}</strong> as a <strong>{data.employeeTitle}</strong> since <strong>{formatDate(data.employeeHireDate)}</strong>.
              </p>

              {data.purpose && (
                <p style={{ marginBottom: '24px', fontStyle: 'italic', color: secondary }}>
                  This certificate has been issued at the employee's request for the specific purpose of: <strong>{data.purpose}</strong>.
                </p>
              )}

              <p style={{ marginBottom: '12px' }}>A detailed breakdown of their gross monthly compensation is provided below:</p>

              <div style={{ border: `1px solid ${borderColor}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '32px', background: lightBg }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${borderColor}`, background: '#f1f5f9' }}>
                      <th style={{ padding: '12px 16px', textAlign: 'left', fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase' }}>Salary Component</th>
                      <th style={{ padding: '12px 16px', textAlign: 'right', fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase' }}>Monthly Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>Basic Salary</td>
                      <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>{formatMoney(data.basicSalary || 0)}</td>
                    </tr>
                    {!!data.housingAllowance && (
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '12px 16px', color: secondary }}>Housing Allowance</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: textDark }}>{formatMoney(data.housingAllowance)}</td>
                      </tr>
                    )}
                    {!!data.transportAllowance && (
                      <tr style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '12px 16px', color: secondary }}>Transport Allowance</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: textDark }}>{formatMoney(data.transportAllowance)}</td>
                      </tr>
                    )}
                    {Array.isArray(data.otherAllowances) && data.otherAllowances.map((item, idx) => (
                      <tr key={idx} style={{ borderBottom: `1px solid ${borderColor}` }}>
                        <td style={{ padding: '12px 16px', color: secondary }}>{item.label}</td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', color: textDark }}>{formatMoney(Number(item.amount || 0))}</td>
                      </tr>
                    ))}
                    <tr style={{ background: 'rgba(80, 65, 136, 0.05)', color: primaryColor }}>
                      <td style={{ padding: '14px 16px', fontWeight: 900, fontSize: '15px' }}>Total Gross Monthly</td>
                      <td style={{ padding: '14px 16px', textAlign: 'right', fontWeight: 900, fontSize: '15px' }}>{formatMoney(data.grossTotal || 0)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p style={{ marginBottom: '24px', fontSize: '12px', color: secondary }}>
                * All disbursals are made in <strong>{data.currency || 'USD'}</strong> via <strong>{data.paymentMethod || 'Bank Transfer'}</strong> to Bank: <strong>{data.bankName || 'N/A'}</strong> (Account: <strong>{data.accountNumber || 'N/A'}</strong>).
              </p>
            </div>
          )}

          {/* 3. LAST 3 MONTHS PAYSLIP */}
          {docType === 'PAYSLIP' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '20px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Historical Payroll Statements (Last 3 Cycles)
                </div>
              </div>

              {payslipMonths.map((m, idx) => (
                <div key={m.key} style={{
                  border: `2px solid ${borderColor}`,
                  borderRadius: '16px',
                  padding: '20px',
                  background: '#ffffff',
                  position: 'relative',
                  pageBreakInside: 'avoid',
                }}>
                  {/* Watermark "PAID" badge inside each payslip */}
                  <div style={{
                    position: 'absolute',
                    top: '20px',
                    right: '20px',
                    border: '3px solid #10b981',
                    borderRadius: '8px',
                    padding: '4px 12px',
                    color: '#10b981',
                    fontSize: '11px',
                    fontWeight: 900,
                    textTransform: 'uppercase',
                    letterSpacing: '1px',
                    transform: 'rotate(-5deg)',
                  }}>
                    Disbursed & Paid
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: `1px solid ${borderColor}`, paddingBottom: '12px', marginBottom: '16px' }}>
                    <div>
                      <h4 style={{ fontSize: '13px', fontWeight: 900, color: primaryColor, textTransform: 'uppercase' }}>Payslip Receipt</h4>
                      <span style={{ fontSize: '11px', color: secondary, fontWeight: 700 }}>Cycle: {m.label}</span>
                    </div>
                    <div style={{ textAlign: 'right', paddingRight: '120px' }}>
                      <span style={{ fontSize: '10px', color: secondary, display: 'block' }}>Disbursal Account</span>
                      <span style={{ fontSize: '11px', fontWeight: 700 }}>{data.bankName} - {data.accountNumber}</span>
                    </div>
                  </div>

                  <div style={{ gridTemplateColumns: '1fr 1fr', display: 'grid', gap: '20px', fontSize: '12px' }}>
                    {/* Salary Grid */}
                    <div style={{ borderRight: `1px solid ${borderColor}`, paddingRight: '20px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <span style={{ color: secondary }}>Basic Salary</span>
                        <span style={{ fontWeight: 600 }}>{formatMoney(data.basicSalary || 0)}</span>
                      </div>
                      {!!data.housingAllowance && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: secondary }}>Housing Allowance</span>
                          <span>{formatMoney(data.housingAllowance)}</span>
                        </div>
                      )}
                      {!!data.transportAllowance && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: secondary }}>Transport Allowance</span>
                          <span>{formatMoney(data.transportAllowance)}</span>
                        </div>
                      )}
                      {Array.isArray(data.otherAllowances) && data.otherAllowances.map((allowance, aIdx) => (
                        <div key={aIdx} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ color: secondary }}>{allowance.label}</span>
                          <span>{formatMoney(Number(allowance.amount || 0))}</span>
                        </div>
                      ))}
                    </div>

                    {/* Disbursal metadata */}
                    <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        <div>
                          <span style={{ fontSize: '9px', color: secondary, textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>Employee</span>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{data.employeeName}</span>
                        </div>
                        <div style={{ marginTop: '8px' }}>
                          <span style={{ fontSize: '9px', color: secondary, textTransform: 'uppercase', display: 'block', fontWeight: 800 }}>Designation</span>
                          <span>{data.employeeTitle} ({data.employeeDepartment})</span>
                        </div>
                      </div>

                      <div style={{
                        marginTop: '12px',
                        background: 'rgba(80, 65, 136, 0.05)',
                        padding: '10px 14px',
                        borderRadius: '8px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}>
                        <span style={{ fontWeight: 800, color: primaryColor, fontSize: '12px' }}>Net Deposited</span>
                        <span style={{ fontWeight: 900, color: primaryColor, fontSize: '14px' }}>{formatMoney(data.grossTotal || 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4. WARNING CERTIFICATE */}
          {docType === 'WARNING_CERTIFICATE' && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: textDark }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
                <div style={{ width: '20px', height: '2px', background: '#ef4444' }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Formal Disciplinary Action Letter
                </div>
              </div>

              <div style={{ background: 'rgba(239, 68, 68, 0.05)', borderLeft: '4px solid #ef4444', padding: '16px 20px', borderRadius: '0 12px 12px 0', marginBottom: '28px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '10px', color: '#ef4444', textTransform: 'uppercase', fontWeight: 900, display: 'block', letterSpacing: '0.5px' }}>Warning Level</span>
                    <span style={{ fontSize: '16px', fontWeight: 900, color: '#b91c1c' }}>{data.warningLevel || '1st Warning'}</span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '10px', color: secondary, textTransform: 'uppercase', display: 'block' }}>Date of Incident</span>
                    <span style={{ fontSize: '13px', fontWeight: 700 }}>{data.incidentDate ? formatDate(data.incidentDate) : 'N/A'}</span>
                  </div>
                </div>
              </div>

              <p style={{ marginBottom: '16px' }}>Dear <strong>{data.employeeName}</strong> (Employee ID: <strong>{data.employeeId}</strong>),</p>

              <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                This letter serves as a formal disciplinary warning regarding documented performance concerns or behavioral policy violations. 
                We hold our employees to the highest professional standards, and it has become necessary to address areas where those standards have not been met.
              </p>

              <div style={{ border: `1px solid ${borderColor}`, padding: '20px', borderRadius: '12px', background: lightBg, marginBottom: '24px' }}>
                <h4 style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>Description of Infraction / Concerns</h4>
                <p style={{ margin: 0, fontSize: '13px', color: textDark, whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{data.reason || 'No description provided.'}</p>
              </div>

              <p style={{ marginBottom: '20px', textAlign: 'justify' }}>
                Please be advised that immediate and sustained improvement is required. 
                Failure to correct these performance issues or any further violations of company policies will result in additional disciplinary actions, up to and including termination of employment.
              </p>

              {data.issuedBy && (
                <p style={{ marginBottom: '32px' }}>
                  This warning letter is formally issued by: <strong>{data.issuedBy}</strong>.
                </p>
              )}
            </div>
          )}

          {/* 5. INTERNSHIP ACCEPTED CERTIFICATE */}
          {docType === 'INTERNSHIP_ACCEPTED_CERTIFICATE' && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: textDark, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '20px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Internship Confirmation Letter
                </div>
              </div>

              <div style={{ marginBottom: '4px' }}>
                <strong>Date:</strong> {formatDate(data.date)}
              </div>

              <div style={{ fontWeight: 700, marginBottom: '4px', fontSize: '15px', color: primaryColor }}>
                Subject: Internship Confirmation for {data.employeeName}
              </div>

              <p style={{ marginBottom: '8px' }}>
                Dear {data.coordinatorName || 'Internship Committee'},
              </p>
              
              <p style={{ marginBottom: '8px', textAlign: 'justify' }}>
                We are pleased to inform you that <strong>{data.employeeName}</strong>, a student from your 
                institution pursuing a <strong>{data.degreeMajor || 'Bachelor of Science in IT'}</strong>, has been 
                officially accepted for an internship position at <strong>{settings.agencyName}</strong>.
              </p>

              <p style={{ marginBottom: '4px' }}>
                The details of the internship placement are outlined below:
              </p>

              <div style={{ background: lightBg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>• <strong>Position Title:</strong> {data.employeeTitle || 'Digital Marketing Intern'}</li>
                  <li>• <strong>Department:</strong> {data.employeeDepartment || 'Marketing'}</li>
                  <li>• <strong>Internship Duration:</strong> {data.internshipDuration || '3 Months'}</li>
                  <li>• <strong>Start Date:</strong> {data.employeeHireDate ? formatDate(data.employeeHireDate) : 'Commencement Date'}</li>
                  <li>• <strong>End Date:</strong> {data.employeeEndDate ? formatDate(data.employeeEndDate) : 'Expected Completion Date'}</li>
                  <li>• <strong>Work Schedule:</strong> {data.workSchedule || 'Full-time, 40 hours per week'}</li>
                  <li>• <strong>Nature of Internship:</strong> {data.natureOfInternship || 'Paid'}</li>
                </ul>
              </div>

              <p style={{ marginBottom: '4px' }}>
                During this internship, the student will work under the direct supervision of <strong>{data.supervisorName || 'Supervisor Name'}</strong> ({data.supervisorTitle || 'Supervisor Title'}). Their primary responsibilities and learning objectives will include:
              </p>

              <ol style={{ paddingLeft: '20px', margin: '0 0 8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>1. {data.task1 || 'Assisting in the development of client software applications'}</li>
                <li>2. {data.task2 || 'Analyzing weekly website traffic data and creating reports'}</li>
                <li>3. {data.task3 || 'Participating in team strategy and brainstorming meetings'}</li>
              </ol>

              <p style={{ marginBottom: '8px', textAlign: 'justify' }}>
                We ensure that the student will receive hands-on industry experience that aligns 
                with your academic requirements. We will also cooperate with your department to 
                provide any necessary performance evaluations or grading rubrics at the end of the term.
              </p>

              <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                If you require any additional information or specific academic paperwork filled out, 
                please do not hesitate to reach out.
              </p>
            </div>
          )}

          {/* 6. INTERNSHIP LETTER (COMPLETION) */}
          {docType === 'INTERNSHIP_LETTER' && (
            <div style={{ fontSize: '14px', lineHeight: 1.8, color: textDark, display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                <div style={{ width: '20px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '11px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Internship Completion Certificate
                </div>
              </div>

              <div style={{ textAlign: 'center', margin: '10px 0', padding: '5px 0' }}>
                <div style={{ fontSize: '18px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '2px', color: primaryColor, marginBottom: '4px' }}>
                  TO WHOM IT MAY CONCERN
                </div>
                <div style={{ width: '80px', height: '3px', background: accentColor, margin: '0 auto' }}></div>
              </div>

              <p style={{ marginBottom: '8px', textAlign: 'justify' }}>
                This is to officially certify that <strong>{data.employeeName}</strong>, a student from <strong>{data.institutionName || 'University of Technology'}</strong> pursuing a <strong>{data.degreeMajor || 'Bachelor of Science in IT'}</strong>, has successfully completed their internship program at <strong>{settings.agencyName}</strong>.
              </p>

              <p style={{ marginBottom: '4px' }}>
                The details of the internship placement are outlined below:
              </p>

              <div style={{ background: lightBg, border: `1px solid ${borderColor}`, borderRadius: '12px', padding: '16px', marginBottom: '8px' }}>
                <ul style={{ listStyleType: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <li>• <strong>Position Title:</strong> {data.employeeTitle || 'Digital Marketing Intern'}</li>
                  <li>• <strong>Department:</strong> {data.employeeDepartment || 'Marketing'}</li>
                  <li>• <strong>Internship Duration:</strong> {data.internshipDuration || '3 Months'}</li>
                  <li>• <strong>Start Date:</strong> {data.employeeHireDate ? formatDate(data.employeeHireDate) : 'Commencement Date'}</li>
                  <li>• <strong>End Date:</strong> {data.employeeEndDate ? formatDate(data.employeeEndDate) : 'Expected Completion Date'}</li>
                </ul>
              </div>

              <p style={{ marginBottom: '4px', textAlign: 'justify' }}>
                During the course of the internship, <strong>{data.employeeName}</strong> demonstrated exceptional dedication, professional conduct, and technical proficiency. They were primarily involved in the following projects and responsibilities:
              </p>

              <ol style={{ paddingLeft: '20px', margin: '0 0 8px 0', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <li>1. {data.task1 || 'Assisting in the development of client software applications'}</li>
                <li>2. {data.task2 || 'Analyzing weekly website traffic data and creating reports'}</li>
                <li>3. {data.task3 || 'Participating in team strategy and brainstorming meetings'}</li>
              </ol>

              <p style={{ marginBottom: '8px', textAlign: 'justify' }}>
                Their contribution was highly valuable, and they successfully achieved all the learning objectives set out for this placement. We found them to be self-motivated, eager to learn, and a supportive team player.
              </p>

              <p style={{ marginBottom: '16px', textAlign: 'justify' }}>
                We wish them all the success in their future academic and professional endeavors.
              </p>
            </div>
          )}

        </div>

        {/* ───────────────── SIGNATURES & STAMP BLOCK ───────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', pageBreakInside: 'avoid', marginBottom: '40px', marginTop: '30px' }}>
          
          <div style={{ width: '40%' }}>
            {docType === 'WARNING_CERTIFICATE' && (
              <div style={{ borderTop: `1px solid ${secondary}`, paddingTop: '8px', marginTop: '64px', width: '200px' }}>
                <div style={{ fontSize: '9px', color: secondary, textTransform: 'uppercase', fontWeight: 800, letterSpacing: '0.5px' }}>Employee Acknowledgment</div>
                <div style={{ fontSize: '11px', color: textDark, fontWeight: 500, marginTop: '2px' }}>Signature & Date</div>
              </div>
            )}
          </div>

          {/* Signature & Stamp Block - Layered Layout */}
          {(showSignature || showStamp) && (
            <div style={{ textAlign: 'right', minWidth: '220px', position: 'relative' }}>
              <div style={{
                width: '220px',
                height: '110px',
                marginBottom: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}>
                {/* Horizontal Line */}
                <div style={{
                  position: 'absolute',
                  bottom: '0',
                  left: '0',
                  right: '0',
                  height: '1.5px',
                  background: secondary,
                  zIndex: 0,
                  opacity: 0.5
                }} />

                {/* Signature - Layer 1 */}
                {showSignature && settings.signature && (
                  <div style={{
                    position: 'absolute',
                    bottom: '4px',
                    left: '0',
                    right: '0',
                    height: '80px',
                    display: 'flex',
                    alignItems: 'flex-end',
                    justifyContent: 'center',
                    zIndex: 10,
                  }}>
                    <ProtectedBrandingImage 
                      src={settings.signature} 
                      alt="Signature" 
                      style={{ 
                        maxHeight: '100%', 
                        maxWidth: '100%', 
                        objectFit: 'contain', 
                        filter: 'contrast(1.1) brightness(0.95)' 
                      }}
                    />
                  </div>
                )}

                {/* Stamp - Layer 2 */}
                {showStamp && settings.stamp && (
                  <div style={{
                    position: 'absolute', 
                    left: '50%',
                    top: '0', 
                    height: '110px', 
                    width: '110px', 
                    transform: 'translateX(-50%) rotate(-10deg)',
                    zIndex: 999,
                    pointerEvents: 'none'
                  }}>
                    <ProtectedBrandingImage 
                      src={settings.stamp} 
                      alt="Stamp" 
                      style={{ 
                        width: '100%', 
                        height: '100%', 
                        objectFit: 'contain', 
                        opacity: 0.95,
                        filter: 'drop-shadow(0 4px 10px rgba(0,0,0,0.12))'
                      }}
                    />
                  </div>
                )}
              </div>
              
              <div style={{ 
                fontSize: '9px', 
                fontWeight: 900, 
                color: textDark, 
                textTransform: 'uppercase', 
                letterSpacing: '1.5px', 
                textAlign: 'center' 
              }}>
                {data.hrSignatory || 'Authorized HR Signatory'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ───────────────── FOOTER ───────────────── */}
      <div style={{
        marginTop: 'auto',
        background: primaryColor,
        color: '#ffffff',
        padding: '24px 48px',
        zIndex: 1,
        position: 'relative'
      }}>
        {/* Gold Floating Accent Line */}
        <div style={{
          width: '70%',
          height: '4px',
          background: accentColor,
          borderRadius: '40px',
          position: 'absolute',
          top: 0,
          left: '15%',
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: '14px', fontWeight: 900, color: '#ffffff', marginBottom: '4px' }}>
              {settings.agencyName}
            </div>
            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 500 }}>
              Official HR Document • Confidential
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ display: 'flex', gap: '20px', alignItems: 'center', justifyContent: 'flex-end', opacity: 0.9 }}>
              {settings.phone && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span style={{ fontSize: '10px', fontWeight: 600 }}>{settings.phone}</span>
                </div>
              )}
              {settings.adminEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.53 5.33a2 2 0 0 1-2.94 0L2 7" />
                  </svg>
                  <span style={{ fontSize: '10px', fontWeight: 600 }}>{settings.adminEmail}</span>
                </div>
              )}
              {settings.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: accentColor }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                  <span style={{ fontSize: '10px', fontWeight: 900 }}>{settings.website.replace('https://', '').replace('http://', '')}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', marginTop: '6px', fontWeight: 500, fontStyle: 'italic' }}>
              Empowering your brand's future through strategic digital growth
            </div>
          </div>
        </div>
      </div>

      {/* ───────────────── PRINT STYLES ───────────────── */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @page {
          size: auto;
          margin: 0;
        }
        @media print {
          html, body, #root {
            height: auto !important;
            min-height: auto !important;
            overflow: visible !important;
            position: static !important;
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          body * {
            visibility: hidden;
          }
          .print-content, .print-content * {
            visibility: visible;
          }
          .print-content {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            box-shadow: none !important;
            border: none !important;
            height: auto !important;
            overflow: visible !important;
            page-break-after: auto;
          }
          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
        }
      `}} />
    </div>
  );
}

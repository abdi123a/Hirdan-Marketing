import { QRCodeSVG } from "qrcode.react";
import { useAgencyStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { deriveSubtotalFromTotal, parseAmountNumber, sumItems } from "@/lib/money";
import { useState, useEffect, useRef } from "react";

import { ProtectedBrandingImage } from "./ProtectedBrandingImage";
 
interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
}

interface PremiumInvoiceProps {
  type: 'Invoice' | 'Proforma';
  data: {
    id: string;
    date: string;
    dueDate: string;
    client: string;
    clientEmail?: string;
    clientAddress?: string;
    items?: InvoiceItem[];
    notes?: string;
    taxRate?: number;
    discount?: number;
    discountType?: 'percentage' | 'fixed';
    deposit?: number;
    paymentMethod?: string;
    amount?: string | number;
    status?: string;
    showSignature?: boolean;
    showStamp?: boolean;
    deliveryNoteEnabled?: boolean;
    deliveryNoteTitle?: string;
    deliveryNoteContent?: string;
  };
  settings: {
    agencyName: string;
    logo?: string;
    address?: string;
    adminEmail?: string;
    phone?: string;
    website?: string;
    defaultInvoiceNotes?: string;
    currency: string;
    timezone: string;
    primaryColor?: string;
    signature?: string;
    stamp?: string;
  };
  showSignature?: boolean;
  showStamp?: boolean;
}

export function PremiumInvoice({ type, data, settings, showSignature: propShowSignature, showStamp: propShowStamp }: PremiumInvoiceProps) {
  const showSignature = propShowSignature ?? data.showSignature ?? true;
  const showStamp = propShowStamp ?? data.showStamp ?? true;
  const { getVerificationToken } = useAgencyStore();

  const taxRate = data.taxRate ?? 0;
  const discount = data.discount ?? 0;

  const originalItemCount = data.items?.length ?? 0;

  // If line items are missing, fall back to `data.amount`
  const subtotalFromItems = sumItems(data.items);
  const subtotal = originalItemCount
    ? subtotalFromItems
    : deriveSubtotalFromTotal(parseAmountNumber(data.amount ?? 0), taxRate);

  const tax = subtotal * taxRate / 100;

  const discountAmount = data.discountType === 'percentage'
    ? (subtotal * (data.discount || 0) / 100)
    : (data.discount || 0);

  const total = subtotal + tax - discountAmount;
  const balanceDue = total - (data.deposit ?? 0);

  const itemsForTable = data.items?.length
    ? data.items
    : [
      {
        description: "Services rendered",
        quantity: 1,
        unitPrice: subtotal,
      },
    ];

  const documentType = type === 'Invoice' ? 'invoice' : 'proforma';

  const [verificationToken, setVerificationToken] = useState<string>('');
  const phoneRowRef = useRef<HTMLDivElement | null>(null);
  const phoneIconRef = useRef<SVGSVGElement | null>(null);
  const phoneTextRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const fetchToken = async () => {
      const token = await getVerificationToken(documentType as 'invoice' | 'proforma', data.id);
      setVerificationToken(token);
    };
    fetchToken();
  }, [documentType, data.id, getVerificationToken]);

  const verificationUrl = verificationToken
    ? `${window.location.origin}/verify/${verificationToken}`
    : '';

  useEffect(() => {
    // #region agent log
    fetch('http://127.0.0.1:7891/ingest/c6d26856-ebcd-4639-9d6e-816efcb76a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b217a'},body:JSON.stringify({sessionId:'1b217a',runId:'pre-fix',hypothesisId:'H6',location:'src/components/PremiumInvoice.tsx:107',message:'PremiumInvoice rendered',data:{docType:type,hasPhone:!!settings.phone,hasEmail:!!settings.adminEmail,hasWebsite:!!settings.website,userAgent:typeof navigator!=='undefined'?navigator.userAgent:'unknown'},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [type, settings.phone, settings.adminEmail, settings.website]);

  useEffect(() => {
    if (!settings.phone || !phoneRowRef.current || !phoneIconRef.current || !phoneTextRef.current) return;
    const rowRect = phoneRowRef.current.getBoundingClientRect();
    const iconRect = phoneIconRef.current.getBoundingClientRect();
    const textRect = phoneTextRef.current.getBoundingClientRect();
    const iconCenter = iconRect.top + iconRect.height / 2;
    const textCenter = textRect.top + textRect.height / 2;
    const textStyle = window.getComputedStyle(phoneTextRef.current);
    const iconStyle = window.getComputedStyle(phoneIconRef.current);

    // #region agent log
    fetch('http://127.0.0.1:7891/ingest/c6d26856-ebcd-4639-9d6e-816efcb76a2c',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'1b217a'},body:JSON.stringify({sessionId:'1b217a',runId:'pre-fix',hypothesisId:'H1',location:'src/components/PremiumInvoice.tsx:110',message:'Footer phone row layout metrics',data:{docType:type,hasPhone:!!settings.phone,rowHeight:rowRect.height,iconHeight:iconRect.height,textHeight:textRect.height,iconCenterOffsetToTextCenter:Math.round((iconCenter-textCenter)*100)/100,rowAlignItems:window.getComputedStyle(phoneRowRef.current).alignItems,textLineHeight:textStyle.lineHeight,textFontSize:textStyle.fontSize,iconDisplay:iconStyle.display,iconVerticalAlign:iconStyle.verticalAlign},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
  }, [settings.phone, type]);

  // Clean client approval/revision comments from notes for the official invoice document layout
  const cleanedNotes = data.notes
    ? data.notes.replace(/(?:\r?\n)?\[Client\s+[^\]]+\]\s*:\s*"[\s\S]*?"/gi, '').trim()
    : '';

  // Brand Colors
  const primaryColor = settings.primaryColor || '#504188'; // Default Deep Purple
  const accentColor = '#f6b317';  // Gold/Yellow

  const secondary = '#64748b';
  const textDark = '#0f172a';
  const lightBg = '#f8fafc';
  const borderColor = '#e2e8f0';

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
      }}
    >
      {/* ───────────────── HUGE SIDEWAYS WATERMARK ───────────────── */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%) rotate(-45deg)',
        opacity: 0.05,
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
            fontSize: '200px', fontWeight: 900,
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

      <div style={{ padding: '32px 40px 0 40px', flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, position: 'relative' }}>

        {/* ───────────────── HEADER ───────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '32px' }}>

          <div style={{ flex: 1 }}>
            {settings.logo ? (
              <ProtectedBrandingImage
                src={settings.logo}
                alt={settings.agencyName}
                style={{ height: '72px', width: 'auto', objectFit: 'contain', maxWidth: '250px', marginBottom: '16px' }}
              />
            ) : (
              <div style={{
                fontSize: '32px', fontWeight: 900, color: primaryColor,
                letterSpacing: '-1px', marginBottom: '12px', lineHeight: 1
              }}>
                {settings.agencyName}
              </div>
            )}
            <div style={{ fontSize: '11px', color: secondary, lineHeight: 1.5, maxWidth: '280px' }}>
              {settings.address && <div>{settings.address}</div>}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontSize: '42px', fontWeight: 900, color: primaryColor,
              letterSpacing: '-1.5px', textTransform: 'uppercase', lineHeight: 1, marginBottom: '20px'
            }}>
              {type === 'Invoice' ? 'Invoice' : 'Proforma'}
            </div>

            <div style={{ display: 'flex', gap: '24px', textAlign: 'right', justifyContent: 'flex-end' }}>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: secondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>{type === 'Invoice' ? 'Invoice No.' : 'Proforma No.'}</div>
                <div style={{ fontSize: '13px', fontWeight: 900, color: primaryColor }}>{data.id}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: secondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Date Issued</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: textDark }}>{formatDate(data.date)}</div>
              </div>
              <div>
                <div style={{ fontSize: '9px', fontWeight: 800, color: secondary, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>Due Date</div>
                <div style={{ fontSize: '13px', fontWeight: 800, color: textDark }}>{formatDate(data.dueDate)}</div>
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────── BILLING INFO REDESIGNED ───────────────── */}
        <div style={{ display: 'flex', marginBottom: '32px' }}>
          <div style={{
            flex: 1, maxWidth: '400px', padding: '24px', background: lightBg, borderRadius: '16px',
            position: 'relative', overflow: 'hidden', border: `1px solid ${borderColor}`
          }}>
            {/* Background Accent Ornament */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '120px', height: '120px', background: accentColor, opacity: 0.15, borderRadius: '50%', transform: 'translate(30%, -30%)' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '16px', height: '2px', background: primaryColor }}></div>
                <div style={{ fontSize: '10px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                  Billed To
                </div>
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: textDark, marginBottom: '6px', letterSpacing: '-0.5px' }}>
                {data.client}
              </div>
              <div style={{ fontSize: '12px', color: secondary, lineHeight: 1.6, whiteSpace: 'pre-line', fontWeight: 500 }}>
                {data.clientAddress && <div>{data.clientAddress}</div>}
                {data.clientEmail && <div style={{ marginTop: '4px', fontWeight: 700, color: primaryColor }}>{data.clientEmail}</div>}
              </div>
            </div>
          </div>
        </div>

        {/* ───────────────── TABLE ───────────────── */}
        <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, marginBottom: '32px' }}>
          <thead>
            <tr>
              <th style={{ padding: '12px 16px', background: primaryColor, color: '#ffffff', textAlign: 'left', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '8px 0 0 8px' }}>Description</th>
              <th style={{ padding: '12px 16px', background: primaryColor, color: '#ffffff', textAlign: 'center', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', width: '60px' }}>Qty</th>
              <th style={{ padding: '12px 16px', background: primaryColor, color: '#ffffff', textAlign: 'right', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', width: '100px' }}>Rate</th>
              <th style={{ padding: '12px 16px', background: primaryColor, color: accentColor, textAlign: 'right', fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', width: '120px', borderRadius: '0 8px 8px 0' }}>Amount</th>
            </tr>
          </thead>
          <tbody>
            {itemsForTable.map((item, index) => (
              <tr key={index}>
                <td style={{ 
                  padding: '16px', 
                  borderBottom: `1px solid ${borderColor}`, 
                  fontSize: '12px', 
                  color: secondary, 
                  fontWeight: 500, 
                  verticalAlign: 'top',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  lineHeight: 1.6
                }}
                  dangerouslySetInnerHTML={{ __html: item.description }}
                />
                <td style={{ padding: '16px', borderBottom: `1px solid ${borderColor}`, fontSize: '12px', color: secondary, textAlign: 'center', verticalAlign: 'top', fontWeight: 600 }}>
                  {item.quantity}
                </td>
                <td style={{ padding: '16px', borderBottom: `1px solid ${borderColor}`, fontSize: '12px', color: secondary, textAlign: 'right', verticalAlign: 'top', fontWeight: 600 }}>
                  {formatCurrency(item.unitPrice)}
                </td>
                <td style={{ padding: '16px', borderBottom: `1px solid ${borderColor}`, fontSize: '13px', color: primaryColor, fontWeight: 900, textAlign: 'right', verticalAlign: 'top' }}>
                  {formatCurrency(item.quantity * item.unitPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ───────────────── DELIVERY NOTE ───────────────── */}
        {data.deliveryNoteEnabled && (data.deliveryNoteTitle || data.deliveryNoteContent) && (
          <div style={{
            marginBottom: '32px',
            padding: '24px',
            background: lightBg,
            borderRadius: '16px',
            border: `1px solid ${borderColor}`,
            position: 'relative',
            overflow: 'hidden'
          }}>
            {/* Background Accent Ornament */}
            <div style={{ position: 'absolute', top: 0, right: 0, width: '80px', height: '80px', background: primaryColor, opacity: 0.03, borderRadius: '50%', transform: 'translate(20%, -20%)' }} />

            <div style={{ position: 'relative', zIndex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                <div style={{ width: '16px', height: '2px', background: primaryColor }}></div>
                {data.deliveryNoteTitle && (
                  <div style={{ fontSize: '10px', fontWeight: 800, color: primaryColor, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    {data.deliveryNoteTitle}
                  </div>
                )}
              </div>
              {data.deliveryNoteContent && (
                <div
                  style={{ fontSize: '12px', color: secondary, lineHeight: 1.6, fontWeight: 500 }}
                  dangerouslySetInnerHTML={{ __html: data.deliveryNoteContent }}
                />
              )}
            </div>
          </div>
        )}

        {/* ───────────────── TOTALS & NOTES & SIGNATURE ───────────────── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', pageBreakInside: 'avoid', marginBottom: '40px' }}>

          {/* Notes - Redesigned Section */}
          <div style={{ flex: 1, paddingRight: '40px' }}>
            <div style={{
              background: '#F9FAFB',
              borderRadius: '16px',
              padding: '24px',
              border: `1px solid ${borderColor}`,
              position: 'relative',
              overflow: 'hidden'
            }}>
              {/* Note Icon Background Accent */}
              <div style={{ position: 'absolute', top: '-10px', right: '-10px', opacity: 0.03, transform: 'rotate(-15deg)' }}>
                <svg width="100" height="100" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
              </div>

              <div style={{
                fontSize: '11px',
                fontWeight: 900,
                color: primaryColor,
                textTransform: 'uppercase',
                letterSpacing: '1.5px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <div style={{ width: '12px', height: '12px', background: accentColor, borderRadius: '3px' }}></div>
                Payment Methods & Conditions
              </div>

              <div style={{ fontSize: '12px', color: secondary, lineHeight: 1.7, fontWeight: 500, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {cleanedNotes || settings.defaultInvoiceNotes || "Bank Transfer, Credit Card. Please make payment by the due date. Thank you for your business!"}
                {data.paymentMethod && <div style={{ marginTop: '8px', fontWeight: 700, color: primaryColor }}>Paid via: {data.paymentMethod}</div>}
              </div>

              <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px dashed ${borderColor}`, fontSize: '10px', color: primaryColor, fontWeight: 800, textTransform: 'uppercase' }}>
                Status: {data.status ?? (balanceDue <= 0 ? 'Full Paid' : (data.deposit ?? 0) > 0 ? 'Partially Paid' : 'Pending')} • {type === 'Invoice' ? 'Invoice' : 'Proforma'}: {data.id}
              </div>
            </div>
          </div>

          {/* Totals & Signature */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', alignItems: 'flex-end' }}>
            <div style={{ width: '300px', borderRadius: '12px', overflow: 'hidden', border: `2px solid ${primaryColor}`, background: '#ffffff' }}>
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ color: secondary, fontWeight: 600 }}>Subtotal</span>
                  <span style={{ color: textDark, fontWeight: 800 }}>{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: secondary, fontWeight: 600 }}>TVA ({taxRate}%)</span>
                    <span style={{ color: textDark, fontWeight: 800 }}>{formatCurrency(tax)}</span>
                  </div>
                )}
                {discountAmount > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: secondary, fontWeight: 600 }}>Discount {data.discountType === 'percentage' ? `(${data.discount}%)` : ''}</span>
                    <span style={{ color: '#ef4444', fontWeight: 800 }}>-{formatCurrency(discountAmount)}</span>
                  </div>
                )}
                {(data.deposit ?? 0) > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                    <span style={{ color: secondary, fontWeight: 600 }}>Deposit / Paid</span>
                    <span style={{ color: '#10b981', fontWeight: 800 }}>-{formatCurrency(data.deposit || 0)}</span>
                  </div>
                )}
              </div>

              <div style={{ padding: '20px', background: primaryColor, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `3px solid ${accentColor}` }}>
                <div style={{ fontSize: '14px', fontWeight: 800, color: '#ffffff', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: 1.2 }}>
                  {balanceDue <= 0 ? (
                    <>Total<br />Paid</>
                  ) : (
                    <>Balance<br />Due</>
                  )}
                </div>
                <span style={{ fontSize: '24px', fontWeight: 900, letterSpacing: '-1px', color: accentColor }}>{formatCurrency(balanceDue)}</span>
              </div>
            </div>


            {/* Signature & Stamp Block - Accurate Layering */}
            {(showSignature || showStamp) && (
              <div style={{ textAlign: 'right', paddingRight: '20px', minWidth: '220px' }}>
                <div style={{
                  width: '220px',
                  height: '110px', // slightly taller
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  position: 'relative',
                }}>
                  {/* The Horizontal Line - Forced to the background */}
                  <div style={{
                    position: 'absolute',
                    bottom: '0',
                    left: '0',
                    right: '0',
                    height: '2px',
                    background: secondary,
                    zIndex: 0,
                    opacity: 0.6
                  }} />

                  {/* Signature - Anchored to the line, Layer 1 */}
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

                  {/* Stamp - Anchored towards the top, Layer 2 (Absolute Priority) */}
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
                          filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.15))'
                        }}
                      />
                    </div>
                  )}
                </div>
                <div style={{ 
                  fontSize: '10px', 
                  fontWeight: 900, 
                  color: textDark, 
                  textTransform: 'uppercase', 
                  letterSpacing: '1.5px', 
                  textAlign: 'center' 
                }}>
                  Authorized Signature
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ───────────────── TRUE FOOTER (Unique High-End Badge Layout - Revised) ───────────────── */}
      <div style={{
        marginTop: 'auto',
        background: primaryColor,
        color: '#ffffff',
        padding: '28px 40px',
        zIndex: 1,
        position: 'relative'
      }}>
        {/* Floating Accent Line - Thicker & Bold */}
        <div style={{
          width: '70%',
          height: '5px',
          background: accentColor,
          borderRadius: '40px',
          position: 'absolute',
          top: 0,
          left: '15%',
        }}></div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {/* Left: THE SEAL (Larger QR) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
            {verificationToken && (
              <div style={{
                padding: '8px',
                background: '#ffffff',
                borderRadius: '12px',
                position: 'relative',
                boxShadow: '0 8px 24px rgba(0,0,0,0.15)'
              }}>
                <QRCodeSVG
                  value={verificationUrl}
                  size={80}
                  level="H"
                  fgColor={primaryColor}
                  bgColor="transparent"
                />
              </div>
            )}
            <div>
              <div style={{ fontSize: '11px', fontWeight: 900, color: accentColor, textTransform: 'uppercase', letterSpacing: '1.5px' }}>
                Verified Original
              </div>
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                Secure Digital Verification
              </div>
            </div>
          </div>

          {/* Center/Right: Branded Info */}
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: '16px', fontWeight: 900, marginBottom: '8px' }}>
              Thank You For Your Business
            </div>

            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', justifyContent: 'flex-end', opacity: 0.9 }}>
              {settings.phone && (
                <div ref={phoneRowRef} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg ref={phoneIconRef} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                  <span ref={phoneTextRef} style={{ fontSize: '11px', fontWeight: 600 }}>{settings.phone}</span>
                </div>
              )}
              {settings.adminEmail && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.53 5.33a2 2 0 0 1-2.94 0L2 7" />
                  </svg>
                  <span style={{ fontSize: '11px', fontWeight: 600 }}>{settings.adminEmail}</span>
                </div>
              )}
               {settings.website && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: accentColor }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                    <path d="M2 12h20" />
                  </svg>
                  <span style={{ fontSize: '11px', fontWeight: 900 }}>{settings.website.replace('https://', '').replace('http://', '')}</span>
                </div>
              )}
            </div>

            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', marginTop: '8px', fontWeight: 500, fontStyle: 'italic' }}>
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

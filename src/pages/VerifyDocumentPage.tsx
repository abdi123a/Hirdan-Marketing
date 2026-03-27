import { useParams, Link } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import { deriveSubtotalFromTotal, parseAmountNumber } from "@/lib/money";
import { ShieldCheck, AlertTriangle, FileText, Calendar, User, Mail, MapPin, ExternalLink, Building2, Loader2 } from "lucide-react";

export default function VerifyDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const { verifyDocument, clients, settings, fetchSettings } = useAgencyStore();
  const [result, setResult] = useState<{ type: 'invoice' | 'proforma'; document: any } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSettings(); // Ensure we have agency name/logo
    if (token) {
      verifyDocument(token).then(res => {
        setResult(res);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, [token, verifyDocument, fetchSettings]);

  const accent = settings.primaryColor || '#504188'; // Use settings color or fallback
  const secondary = '#f6b317'; // Hardcoded secondary color
  const accentDark = '#3a2f64'; // Darker shade for gradient

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#ffffff',
      }}>
        <Loader2 className="animate-spin" size={48} color={accent} />
      </div>
    );
  }

  if (!result) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 md:p-10 font-['Inter',_-apple-system,_sans-serif]">
        {settings.logo && (
          <div className="flex justify-center w-full mb-10">
            <img src={settings.logo} alt={settings.agencyName} className="h-12 md:h-16 w-auto object-contain" />
          </div>
        )}
        <div className="max-w-[480px] w-full bg-white shadow-[0_10px_40px_-10px_rgba(0,0,0,0.1)] rounded-[24px] border border-[#e2e8f0] p-10 md:p-14 text-center">
          <div className="w-20 h-20 rounded-full bg-[#ef44441a] flex items-center justify-center mx-auto mb-7">
            <AlertTriangle size={36} color="#ef4444" />
          </div>
          <h1 className="text-2xl md:text-[26px] font-extrabold text-[#0f172a] mb-3 tracking-tight">
            Document Not Found
          </h1>
          <p className="text-sm text-[#64748b] leading-relaxed mb-9 max-w-[340px] mx-auto">
            The verification link is invalid or the document has been removed. Please contact the issuing agency for assistance.
          </p>
          <Link
            to="/"
            className="inline-flex items-center gap-2 px-7 py-3 text-white rounded-xl no-underline text-xs font-bold transition-all shadow-md hover:scale-105"
            style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}
          >
            <ExternalLink size={14} />
            Go to Homepage
          </Link>
        </div>
      </div>
    );
  }

  const { type, document: doc } = result;
  const isInvoice = type === 'invoice';
  const docLabel = isInvoice ? 'Invoice' : 'Proforma Invoice';

  const clientName = (doc.client && typeof doc.client === 'object') ? (doc.client.company || doc.client.name) : doc.client;

  const taxRate = ("taxRate" in doc ? doc.taxRate : settings.taxRate) ?? 0;

  const rawItems = doc.items || [];
  const subtotalFromItems = rawItems.reduce((sum: number, item: any) => sum + (item.quantity * item.unitPrice), 0);

  const parsedAmount = parseAmountNumber(doc.amount);
  const subtotal = rawItems.length
    ? subtotalFromItems
    : deriveSubtotalFromTotal(parsedAmount, taxRate);

  const items = rawItems.length
    ? rawItems
    : [{ description: "Services rendered", quantity: 1, unitPrice: subtotal }];

  const tax = subtotal * taxRate / 100;
  const total = subtotal + tax;

  return (
    <div style={{
      minHeight: '100vh',
      background: '#ffffff',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '40px 20px',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* ─── Centered Logo ─── */}
      {settings.logo && (
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '32px' }}>
          <img src={settings.logo} alt={settings.agencyName} style={{ height: '64px', width: 'auto', objectFit: 'contain' }} />
        </div>
      )}

      {/* ─── Verification Success Banner ─── */}
      <div className="w-full max-w-[760px] mx-auto mb-5 bg-[#22c55e14] rounded-2xl border border-[#22c55e33] p-5 md:p-7 flex items-center gap-4">
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%',
          background: '#22c55e',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, boxShadow: '0 4px 12px rgba(34,197,94,0.25)',
        }}>
          <ShieldCheck size={24} color="#ffffff" />
        </div>
        <div>
          <h2 style={{
            fontSize: '16px', fontWeight: 800, color: '#16a34a',
            marginBottom: '2px', letterSpacing: '-0.3px',
          }}>
            ✓ Document Verified
          </h2>
          <p style={{ fontSize: '13px', color: '#475569', margin: 0, lineHeight: 1.5 }}>
            This is an authentic {docLabel.toLowerCase()} issued by <strong style={{ color: '#0f172a' }}>{settings.agencyName}</strong>
          </p>
        </div>
      </div>

      {/* ─── Document Card ─── */}
      <div className="w-full max-w-[760px] mx-auto bg-white rounded-[20px] border border-[#e2e8f0] overflow-hidden shadow-[0_20px_50px_rgba(0,0,0,0.06)]">
        {/* Card Hero Header */}
        <div 
          className="relative overflow-hidden p-8 md:p-10 border-b-4 border-[#f6b317]"
          style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,_rgba(255,255,255,0.15),_transparent_50%)]" />
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6 md:items-center">
            <div>
              <div className="text-[10px] font-bold text-white/80 uppercase tracking-[4px] mb-2">
                {docLabel}
              </div>
              <div className="text-3xl md:text-[42px] font-black text-white tracking-[-1px] md:tracking-[-2px] leading-none">
                {doc.invoiceNumber || doc.proformaNumber || doc.id}
              </div>
            </div>
            <div 
              className={`inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider text-white shadow-lg ${
                doc.status === 'Paid' || doc.status === 'Accepted' ? 'bg-[#22c55e]' : 
                doc.status === 'Overdue' || doc.status === 'Expired' ? 'bg-[#ef4444]' : 'bg-[#f59e0b]'
              }`}
            >
              {doc.status}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 p-8 border-b border-[#e2e8f0] bg-white text-left">
          <DetailItem icon={<User size={16} />} label="Client" value={clientName} accent={accent} />
          <DetailItem icon={<Calendar size={16} />} label="Issue Date" value={formatDate(doc.date)} accent={accent} />
          <DetailItem icon={<Building2 size={16} />} label="Issued By" value={settings.agencyName} accent={accent} />
        </div>

        {/* Line Items */}
        {items.length > 0 && (
          <div className="p-5 md:p-8 border-b border-[#e2e8f0] bg-[#f8fafc]">
            <div className="text-[10px] font-extrabold text-[#f6b317] uppercase tracking-[3px] mb-6 flex items-center gap-2.5">
              <span className="w-5 h-0.5 bg-[#f6b317]"></span>
              Services & Line Items
            </div>

            {/* Desktop Header */}
            <div className="hidden md:grid md:grid-cols-[1fr_60px_100px_110px] gap-4 px-4 mb-2 text-[10px] font-extrabold text-[#64748b] uppercase tracking-wider">
              <div>Description</div>
              <div className="text-center">Qty</div>
              <div className="text-right">Price</div>
              <div className="text-right">Total</div>
            </div>

            <div className="space-y-3">
              {items.map((item: any, i: number) => (
                <div key={i} className="bg-white p-4 md:p-4 rounded-2xl md:rounded-xl border border-[#e2e8f0] shadow-[0_4px_12px_-4px_rgba(0,0,0,0.05)] md:shadow-[0_1px_2px_rgba(0,0,0,0.02)]">
                  {/* Desktop Item Layout */}
                  <div className="hidden md:grid md:grid-cols-[1fr_60px_100px_110px] gap-4 items-center">
                    <div className="text-[#0f172a] text-sm font-semibold truncate" title={item.description}>{item.description}</div>
                    <div className="text-[#475569] text-sm text-center">{item.quantity}</div>
                    <div className="text-[#475569] text-sm text-right">{formatCurrency(item.unitPrice)}</div>
                    <div className="text-[#0f172a] text-sm font-black text-right">{formatCurrency(item.quantity * item.unitPrice)}</div>
                  </div>

                  {/* Mobile Item Layout (Matches Screenshot) */}
                  <div className="md:hidden flex flex-col">
                    <div className="text-[#0f172a] text-[15px] font-black mb-3">{item.description}</div>
                    <div className="pt-3 border-t border-[#f1f5f9] flex justify-between items-end">
                      <div className="flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-wider">Quantity & Price</span>
                        <div className="text-[13px] text-[#64748b] font-medium">
                          {item.quantity} × {formatCurrency(item.unitPrice)}
                        </div>
                      </div>
                      <div className="text-right flex flex-col gap-1">
                        <span className="text-[9px] font-bold text-[#94a3b8] uppercase tracking-wider">Subtotal</span>
                        <div className="text-[18px] font-black text-[#0f172a] leading-none">
                          {formatCurrency(item.quantity * item.unitPrice)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="p-8 bg-white">
          <div className="flex justify-end">
            <div className="w-full md:w-80">
              <div className="flex flex-col gap-3 p-6 bg-[#f8fafc] rounded-t-2xl border border-[#e2e8f0] border-b-0">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748b]">Subtotal</span>
                  <span className="text-[#0f172a] font-semibold">{formatCurrency(subtotal)}</span>
                </div>
                {taxRate > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-[#64748b]">Tax ({taxRate}%)</span>
                    <span className="text-[#0f172a] font-semibold">{formatCurrency(tax)}</span>
                  </div>
                )}
              </div>
              <div 
                className="rounded-b-2xl p-5 flex justify-between items-center shadow-lg"
                style={{ background: `linear-gradient(135deg, ${accent}, ${accentDark})` }}
              >
                <span className="text-[10px] font-extrabold text-white/90 uppercase tracking-[2px]">Total Amount</span>
                <span 
                  className="text-2xl md:text-[32px] font-black tracking-tighter"
                  style={{ color: secondary }}
                >{formatCurrency(total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── Bottom Branding ─── */}
      <div style={{ maxWidth: '760px', margin: 'auto auto 0', textAlign: 'center' }}>
        <p style={{ fontSize: '13px', color: '#94a3b8', margin: 0 }}>
          © {new Date().getFullYear()} {settings.agencyName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function DetailItem({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-start gap-4 p-4 md:p-5 bg-[#f8fafc] rounded-2xl border border-[#e2e8f0] transition-all hover:bg-white hover:shadow-sm">
      <div 
        className="w-9 h-9 rounded-[10px] bg-white flex items-center justify-center shrink-0 border border-[#e2e8f0] shadow-[0_2px_4px_rgba(0,0,0,0.02)]"
        style={{ color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[10px] font-bold text-[#64748b] uppercase tracking-[1.5px] mb-1">
          {label}
        </div>
        <div className="text-[15px] font-bold text-[#0f172a] tracking-tight truncate">
          {value}
        </div>
      </div>
    </div>
  );
}

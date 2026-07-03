import { useParams, Link } from "react-router-dom";
import { useAgencyStore, type PublicVerificationDocument } from "@/lib/store";
import { formatDate } from "@/lib/utils";
import { useEffect, useState } from "react";
import {
  ShieldCheck,
  AlertTriangle,
  Calendar,
  Building2,
  ExternalLink,
  Loader2,
  CircleDollarSign,
  UserRound,
} from "lucide-react";

export default function VerifyDocumentPage() {
  const { token } = useParams<{ token: string }>();
  const { verifyDocument, settings, fetchSettings } = useAgencyStore();
  const [result, setResult] = useState<{ type: "invoice" | "proforma" | "subscription" | "monthly_report"; document: PublicVerificationDocument } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        await fetchSettings();
        if (token) {
          const res = await verifyDocument(token);
          setResult(res);
        }
      } catch (error) {
        console.error("Failed to load verification data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [token, verifyDocument, fetchSettings]);

  const accent = settings.primaryColor || "#504188";
  const secondary = "#f6b317";
  const accentDark = "#3a2f64";

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ffffff",
        }}
      >
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
          <h1 className="text-2xl md:text-[26px] font-extrabold text-[#0f172a] mb-3 tracking-tight">Document Not Found</h1>
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
  const isInvoice = type === "invoice";
  const isProforma = type === "proforma";
  const isSubscription = type === "subscription";
  const isMonthlyReport = type === "monthly_report";

  const docLabel =
    isInvoice ? "Invoice" :
    isProforma ? "Proforma" :
    isSubscription ? "Subscription" :
    "Monthly Report";

  const statusPillClass =
    doc.status === "Paid" || doc.status === "Accepted" || doc.status === "Active" || doc.status === "Finalized"
      ? "bg-[#22c55e]"
      : doc.status === "Partially Paid" || doc.status === "Draft"
        ? "bg-[#10b981]"
        : doc.status === "Overdue" || doc.status === "Expired" || doc.status === "Cancelled"
          ? "bg-[#ef4444]"
          : "bg-[#f59e0b]";

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #fafbfc 0%, #ffffff 45%)",
        fontFamily: "'Inter', -apple-system, sans-serif",
        padding: "40px 20px 48px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {settings.logo && (
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "28px" }}>
          <img src={settings.logo} alt={settings.agencyName} style={{ height: "56px", width: "auto", objectFit: "contain" }} />
        </div>
      )}

      <div className="w-full max-w-[560px] mx-auto mb-6 bg-[#f0fdf414] rounded-2xl border border-[#22c55e26] p-5 md:p-6 flex items-start gap-4 shadow-[0_1px_0_rgba(255,255,255,0.8)_inset]">
        <div
          style={{
            width: "44px",
            height: "44px",
            borderRadius: "14px",
            background: "linear-gradient(145deg, #22c55e, #16a34a)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            boxShadow: "0 8px 20px -6px rgba(34, 197, 94, 0.45)",
          }}
        >
          <ShieldCheck size={22} color="#ffffff" strokeWidth={2.25} />
        </div>
        <div className="min-w-0 pt-0.5">
          <h2 className="text-[15px] font-extrabold text-[#15803d] tracking-tight mb-1">Verification successful</h2>
          <p className="text-[13px] text-[#475569] m-0 leading-relaxed">
            This {docLabel.toLowerCase()} is authentic and was issued by{" "}
            <span className="font-semibold text-[#0f172a]">{settings.agencyName}</span>.
          </p>
        </div>
      </div>

      <div className="w-full max-w-[560px] mx-auto bg-white rounded-[22px] border border-[#e8ecf1] overflow-hidden shadow-[0_24px_64px_-24px_rgba(15,23,42,0.12),0_0_0_1px_rgba(15,23,42,0.04)]">
        <div
          className="relative overflow-hidden px-8 py-9 md:px-10 md:py-10 border-b border-white/10"
          style={{ background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)` }}
        >
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_100%_0%,rgba(255,255,255,0.12),transparent)] pointer-events-none" />
          <div className="relative z-10 space-y-5">
            <div>
              <p className="text-[10px] font-bold text-white/70 uppercase tracking-[0.2em] mb-2">{docLabel} {isMonthlyReport ? "title" : "number"}</p>
              <p className="text-[28px] md:text-[34px] font-black text-white tracking-[-0.03em] leading-tight">
                {isInvoice || isProforma ? doc.documentNumber : isSubscription ? doc.plan : doc.title}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">{isSubscription ? "Plan" : "Document"} status</span>
              <span
                className={`inline-flex items-center px-3 py-1 rounded-lg text-[11px] font-extrabold uppercase tracking-wide text-white shadow-md ${statusPillClass}`}
              >
                {doc.status}
              </span>
            </div>
          </div>
        </div>

        <div className="p-6 md:p-8 space-y-4 bg-[#fafbfc]">
          <DetailRow icon={<UserRound size={17} />} label="Recipient" value={doc.clientMask} accent={accent} />
          {isMonthlyReport ? (
            <DetailRow icon={<Calendar size={17} />} label="Period" value={`${doc.month}/${doc.year}`} accent={accent} />
          ) : isSubscription ? (
            <>
              <DetailRow icon={<Calendar size={17} />} label="Start date" value={formatDate(doc.startDate || '')} accent={accent} />
              <DetailRow icon={<Calendar size={17} />} label="Valid until" value={formatDate(doc.endDate || '')} accent={accent} />
            </>
          ) : (
            <DetailRow icon={<Calendar size={17} />} label="Issue date" value={formatDate(doc.date || '')} accent={accent} />
          )}
          <DetailRow icon={<Building2 size={17} />} label="Issued by" value={settings.agencyName || "—"} accent={accent} />
        </div>

        {(isInvoice || isProforma || isSubscription) && (
          <div className="px-6 md:px-8 pb-8 md:pb-9 pt-0 bg-[#fafbfc]">
            <div
              className="rounded-2xl px-6 py-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
              style={{
                background: `linear-gradient(135deg, ${accent} 0%, ${accentDark} 100%)`,
                boxShadow: "0 12px 32px -12px rgba(15, 23, 42, 0.25)",
              }}
            >
              <div className="flex items-center gap-3 text-white/90">
                <div className="w-10 h-10 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <CircleDollarSign size={22} className="text-white" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/75 mb-0.5">
                    {isSubscription ? "Subscription fee" : "Total amount"}
                  </p>
                  <p className="text-xs text-white/80 m-0">Document total (incl. tax where applicable)</p>
                </div>
              </div>
              <p className="text-[26px] md:text-[32px] font-black tracking-tight tabular-nums m-0 sm:text-right" style={{ color: secondary }}>
                {doc.amountFormatted}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="max-w-[560px] mx-auto mt-10 text-center">
        <p className="text-[12px] text-[#94a3b8] m-0">
          © {new Date().getFullYear()} {settings.agencyName}. All rights reserved.
        </p>
      </div>
    </div>
  );
}

function DetailRow({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center gap-4 p-4 md:p-5 rounded-2xl bg-white border border-[#e8ecf1] shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div
        className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-[#e8ecf1] bg-[#fafbfc]"
        style={{ color: accent }}
      >
        {icon}
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-[10px] font-bold text-[#64748b] uppercase tracking-[0.12em] mb-1 m-0">{label}</p>
        <p className="text-[15px] font-semibold text-[#0f172a] m-0 tracking-tight tabular-nums">{value}</p>
      </div>
    </div>
  );
}

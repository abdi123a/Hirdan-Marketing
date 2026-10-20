import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Phone, Mail, MapPin, Globe, UserPlus, ArrowLeftRight, ChevronRight, MessageCircle, CheckCircle2, AlertCircle, X } from "lucide-react";
import { getFullUrl } from "@/lib/api-client";
import hirdanLogo from "@/assets/hirdan-logo.png";
import cardBg from "@/assets/business-card-bg.jpg";
import verifiedBadge from "@/assets/verified-badge.svg";

// Public digital business card — hirdan.cc/c/:slug forwards here. No login, always light.

const API_BASE = import.meta.env.VITE_API_URL || "/api";

interface CardData {
  card: {
    name: string;
    title: string;
    photoUrl: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
    bio: string | null;
  };
  company: {
    agencyName: string;
    logo: string | null;
    whiteLogo: string | null;
    website: string | null;
    address: string | null;
    primaryColor: string | null;
    socialLinks: Array<{ platform: string; url: string }>;
  };
  walletEnabled?: boolean;
}

// Company social links come from Settings; match each to one of our bundled icons
const SOCIAL_ICONS: Array<[RegExp, string]> = [
  [/instagram/i, "/social-icons/instagram.png"],
  [/facebook|fb\.com/i, "/social-icons/Facebook.png"],
  [/tiktok/i, "/social-icons/tiktok.png"],
  [/linkedin/i, "/social-icons/linkedin.png"],
  [/youtube|youtu\.be/i, "/social-icons/youtube.png"],
  [/threads/i, "/social-icons/Threads.png"],
  [/pinterest/i, "/social-icons/pinterest.png"],
  [/twitter|x\.com/i, "/social-icons/twitter.png"],
];
const socialIcon = (l: { platform: string; url: string }) => SOCIAL_ICONS.find(([re]) => re.test(`${l.platform} ${l.url}`))?.[1];

const toUrl = (v: string) => (/^https?:\/\//i.test(v) ? v : `https://${v}`);
const digits = (v: string) => v.replace(/[^\d]/g, "");
const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

const GOLD = "#F4B019";

export default function BusinessCardPage() {
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const walletKey = searchParams.get("wallet"); // only on the link sent to the employee
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading, error } = useQuery<CardData>({
    queryKey: ["business-card", slug],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/card/${slug}`);
      if (!res.ok) throw new Error("not found");
      return res.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  if (isLoading) {
    return <div className="min-h-screen bg-[#f6f5fa]" />;
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#f6f5fa] flex flex-col items-center justify-center gap-3 px-6 text-center text-[#1f1b2e]">
        <AlertCircle className="h-10 w-10 text-[#8a84a0]" />
        <p className="text-lg font-medium">This card isn't available</p>
        <p className="text-sm text-[#6b6585]">The link may be wrong or the card was turned off.</p>
      </div>
    );
  }

  const { card, company: agency } = data;
  const brand = agency.primaryColor || "#504289";
  const company = agency.agencyName || "Hirdan Marketing";
  const logo = agency.whiteLogo || agency.logo;
  const website = agency.website;
  const whatsapp = card.whatsapp || card.phone;
  const socials = agency.socialLinks.filter(socialIcon);
  const photo = card.photoUrl ? getFullUrl(card.photoUrl) : null;

  const rows = [
    card.phone && { href: `tel:${card.phone}`, icon: Phone, value: card.phone },
    whatsapp && { href: `https://wa.me/${digits(whatsapp)}`, icon: MessageCircle, value: "WhatsApp" },
    card.email && { href: `mailto:${card.email}`, icon: Mail, value: card.email },
    website && { href: toUrl(website), icon: Globe, value: website.replace(/^https?:\/\//, "") },
    agency.address && { href: `https://maps.google.com/?q=${encodeURIComponent(agency.address)}`, icon: MapPin, value: agency.address },
  ].filter(Boolean) as Array<{ href: string; icon: typeof Phone; value: string }>;

  return (
    <div className="min-h-screen bg-[#f6f5fa] text-[#1f1b2e] sm:py-10">
      <div className="mx-auto w-full max-w-md overflow-hidden bg-white sm:rounded-3xl sm:shadow-xl">
        {/* Cover: cinema-lens stock photo (Pexels #10476056, free licence) toned into the brand purple */}
        <div className="relative h-44 overflow-hidden min-[380px]:h-52" style={{ background: brand }}>
          <img src={cardBg} alt="" className="absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-luminosity [filter:grayscale(1)_contrast(1.1)]" />
          <div className="absolute inset-0" style={{ background: `linear-gradient(180deg, ${brand}40, ${brand}d9)` }} />
          <div className="relative px-5 pt-5">
            {logo ? (
              <img src={getFullUrl(logo)} alt={company} className="h-7 max-w-[150px] object-contain" />
            ) : (
              <img src={hirdanLogo} alt={company} className="h-7 object-contain brightness-0 invert" />
            )}
          </div>
        </div>

        <div className="relative -mt-14 px-5 pb-8 text-center min-[380px]:-mt-16">
          <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white min-[380px]:h-32 min-[380px]:w-32">
            {photo ? (
              <img src={photo} alt={card.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-semibold" style={{ background: GOLD, color: brand }}>
                {initials(card.name)}
              </div>
            )}
          </div>

          <h1 className="mt-3 break-words text-xl font-semibold leading-tight min-[380px]:text-2xl">
            {card.name}
            <img src={verifiedBadge} alt="Verified" className="ml-1.5 inline-block h-5 w-5 -translate-y-[2px] align-middle" />
          </h1>
          <p className="mt-1 text-[15px] font-medium" style={{ color: brand }}>{card.title}</p>
          <p className="text-sm text-[#8a84a0]">{company}</p>
          {card.bio && <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-[#4a4560]">{card.bio}</p>}

          <div className="mt-6 grid grid-cols-1 gap-2.5 min-[340px]:grid-cols-2">
            <a
              href={`${API_BASE}/card/${slug}/vcard`}
              className="flex h-12 items-center justify-center gap-2 rounded-xl text-[15px] font-medium text-white"
              style={{ background: brand }}
            >
              <UserPlus className="h-[18px] w-[18px]" /> Save contact
            </a>
            <button
              onClick={() => setFormOpen(true)}
              className="flex h-12 items-center justify-center gap-2 rounded-xl border border-[#d6d1e4] text-[15px] font-medium"
              style={{ color: brand }}
            >
              <ArrowLeftRight className="h-[18px] w-[18px]" /> Share details
            </button>
          </div>

          {walletKey && data.walletEnabled && (
            <a
              href={`${API_BASE}/card/${slug}/wallet?k=${encodeURIComponent(walletKey)}`}
              className="mx-auto mt-3 flex h-12 w-full max-w-[260px] items-center justify-center gap-3 rounded-xl bg-black text-white"
              aria-label="Add to Apple Wallet"
            >
              <WalletGlyph />
              <span className="text-left leading-none">
                <span className="block text-[11px]">Add to</span>
                <span className="block text-[17px] font-medium tracking-tight">Apple Wallet</span>
              </span>
            </a>
          )}

          <div className="mt-6 text-left">
            {rows.map(({ href, icon: Icon, value }) => (
              <a
                key={value}
                href={href}
                target={href.startsWith("http") ? "_blank" : undefined}
                rel="noreferrer"
                className="flex items-center gap-3.5 border-t border-[#ece9f3] py-3.5 text-[15px]"
              >
                <Icon className="h-5 w-5 shrink-0" style={{ color: brand }} />
                <span className="min-w-0 flex-1 truncate">{value}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-[#b8b2c9]" />
              </a>
            ))}
          </div>

          {socials.length > 0 && (
            <div className="mt-6 flex justify-center gap-4">
              {socials.map((s) => (
                <a key={s.url} href={toUrl(s.url)} target="_blank" rel="noreferrer" aria-label={s.platform || "Social media"}>
                  <img src={socialIcon(s)} alt="" className="h-8 w-8 rounded-lg" />
                </a>
              ))}
            </div>
          )}
        </div>
      </div>

      {formOpen && <LeadForm slug={slug!} name={card.name} brand={brand} onClose={() => setFormOpen(false)} />}
    </div>
  );
}

/** Simple Apple Wallet glyph (stacked cards) for the black Add to Apple Wallet button. */
function WalletGlyph() {
  return (
    <svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true">
      <rect x="1" y="1" width="28" height="22" rx="4" fill="#fff" />
      <rect x="3" y="3" width="24" height="5" rx="1.5" fill="#34AADC" />
      <rect x="3" y="6.5" width="24" height="5" rx="1.5" fill="#FFCC00" />
      <rect x="3" y="10" width="24" height="5" rx="1.5" fill="#4CD964" />
      <rect x="3" y="13.5" width="24" height="5" rx="1.5" fill="#FF3B30" />
      <path d="M1 15h8.5a5.5 5.5 0 0 0 11 0H29v4a4 4 0 0 1-4 4H5a4 4 0 0 1-4-4z" fill="#d9d9d9" />
    </svg>
  );
}

function LeadForm({ slug, name, brand, onClose }: { slug: string; name: string; brand: string; onClose: () => void }) {
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");
  const firstName = name.split(/\s+/)[0];

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    const body = Object.fromEntries(new FormData(e.currentTarget));
    setState("sending");
    try {
      const res = await fetch(`${API_BASE}/card/${slug}/leads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(res.status === 429 ? "Too many tries. Wait a few minutes and try again." : data.message || "Couldn't send. Check your details and try again.");
      }
      setState("sent");
    } catch (err) {
      setError((err as Error).message);
      setState("idle");
    }
  };

  const input = "w-full h-11 rounded-lg border border-[#d6d1e4] px-3 text-sm outline-none focus:border-[#5c4289] bg-white";

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 text-[#1f1b2e]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold">Share your details with {firstName}</h2>
            <p className="text-sm text-[#6b6585]">We'll get back to you soon.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-[#8a84a0]"><X className="h-5 w-5" /></button>
        </div>

        {state === "sent" ? (
          <div className="py-10 flex flex-col items-center gap-3 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600" />
            <p className="font-medium">Thanks, your details were sent</p>
            <button onClick={onClose} className="mt-2 text-sm font-medium" style={{ color: brand }}>Back to card</button>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-5 space-y-2.5">
            <input name="name" required maxLength={120} placeholder="Your name" autoComplete="name" className={input} />
            <input name="phone" required minLength={5} maxLength={40} type="tel" placeholder="Phone or WhatsApp" autoComplete="tel" className={input} />
            <input name="email" type="email" maxLength={190} placeholder="Email (optional)" autoComplete="email" className={input} />
            <input name="company" maxLength={120} placeholder="Company (optional)" autoComplete="organization" className={input} />
            <textarea name="message" maxLength={2000} rows={3} placeholder="How can we help?" className={`${input} h-auto py-2.5`} />
            <input name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button disabled={state === "sending"} className="w-full h-12 rounded-xl text-white font-medium disabled:opacity-70" style={{ background: brand }}>
              {state === "sending" ? "Sending…" : "Send"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

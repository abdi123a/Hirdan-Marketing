import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

export const cardBase =
  "bg-card rounded-2xl border border-border/60 shadow-sm transition-[transform,box-shadow,border-color] duration-200 ease-out";

export const toneChip = {
  primary: "bg-primary/10 text-primary",
  gold: "bg-secondary/15 text-secondary",
  green: "bg-emerald-500/10 text-emerald-600",
  red: "bg-destructive/10 text-destructive",
  blue: "bg-blue-500/10 text-blue-600",
  purple: "bg-violet-500/10 text-violet-600",
  cyan: "bg-cyan-500/10 text-cyan-600",
  orange: "bg-orange-500/10 text-orange-600",
} as const;

export type ToneKey = keyof typeof toneChip;

export function SectionHeading({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ElementType;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4 mb-4">
      <div className="flex items-center gap-2.5 min-w-0">
        <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Icon className="w-4 h-4" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-bold tracking-tight text-foreground leading-none">{title}</h3>
          {subtitle && (
            <p className="text-[12px] text-muted-foreground font-medium mt-1 truncate">{subtitle}</p>
          )}
        </div>
      </div>
      {action}
    </div>
  );
}

export function QuickAction({
  icon: Icon,
  label,
  to,
  onClick,
  tone = "primary",
}: {
  icon: React.ElementType;
  label: string;
  to?: string;
  onClick?: () => void;
  tone?: ToneKey;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-3.5 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/50 hover:border-primary/35 hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.98] transition-[transform,box-shadow,border-color,background-color] duration-200 ease-out group h-full">
      <div
        className={cn(
          "w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 ease-out group-hover:scale-110",
          toneChip[tone]
        )}
      >
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-[12px] font-semibold text-foreground leading-tight">{label}</span>
    </div>
  );
  if (to) return <Link to={to} className="block h-full">{inner}</Link>;
  return (
    <button type="button" onClick={onClick} className="block w-full h-full text-left">
      {inner}
    </button>
  );
}

export function KpiCard({
  label,
  value,
  hint,
  icon: Icon,
  to,
  tone = "primary",
  accent,
}: {
  label: string;
  value: string;
  hint?: React.ReactNode;
  icon: React.ElementType;
  to: string;
  tone?: ToneKey;
  accent?: "profit" | "loss" | "warn";
}) {
  const accentClass =
    accent === "profit"
      ? "border-[hsl(140_35%_40%)]/25 bg-[hsl(140_35%_40%)]/5"
      : accent === "loss"
        ? "border-destructive/25 bg-destructive/5"
        : accent === "warn"
          ? "border-secondary/35 bg-secondary/[0.04]"
          : "";

  return (
    <Link
      to={to}
      className={cn(
        cardBase,
        accentClass,
        "p-5 hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] flex flex-col justify-between group relative overflow-hidden"
      )}
    >
      <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full bg-primary/[0.04] pointer-events-none" />
      <div className="relative flex justify-between items-start mb-3">
        <p className="text-[11px] font-semibold text-muted-foreground tracking-wide">{label}</p>
        <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center transition-transform duration-200 group-hover:scale-110", toneChip[tone])}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
      <h3 className="relative text-2xl font-black text-foreground tabular-nums tracking-tight group-hover:text-primary transition-colors duration-200">
        {value}
      </h3>
      {hint && <div className="relative mt-3 text-[11px] text-muted-foreground font-medium">{hint}</div>}
    </Link>
  );
}

export function StatPill({
  icon: Icon,
  label,
  value,
  tone = "primary",
  to,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  tone?: ToneKey;
  to: string;
}) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/60 shadow-sm hover:shadow-md hover:border-primary/30 hover:-translate-y-0.5 active:translate-y-0 transition-[transform,box-shadow,border-color] duration-200 ease-out group"
    >
      <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", toneChip[tone])}>
        <Icon className="w-4 h-4" />
      </div>
      <div className="min-w-0">
        <p className="text-lg font-black text-foreground leading-none tabular-nums group-hover:text-primary transition-colors">
          {value}
        </p>
        <p className="text-[11px] font-semibold text-muted-foreground mt-1 truncate">{label}</p>
      </div>
    </Link>
  );
}

/** Brand gradient header strip used on role dashboards */
export function DashboardHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: React.ReactNode;
  subtitle: string;
  actions?: React.ReactNode;
}) {
  return (
    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-[hsl(260,42%,46%)] to-[hsl(260,38%,36%)] p-6 md:p-7 shadow-md">
      <div className="absolute -right-10 -top-12 w-52 h-52 rounded-full bg-white/10 pointer-events-none" />
      <div className="absolute -right-24 top-8 w-72 h-72 rounded-full border-[6px] border-white/10 pointer-events-none" />
      <div className="absolute left-1/3 -bottom-16 w-40 h-40 rounded-full bg-secondary/20 blur-2xl pointer-events-none" />
      <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-5">
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-white/65">{eyebrow}</p>
          <h1 className="text-2xl md:text-3xl font-black text-white tracking-tight mt-1.5 text-balance">
            {title}
          </h1>
          <p className="text-sm text-white/80 mt-1.5 font-medium max-w-xl">{subtitle}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
      </div>
    </div>
  );
}

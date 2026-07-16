import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import hirdanLogo from '@/assets/hirdan-logo.png';
import {
  Sparkles,
  LayoutDashboard,
  CreditCard,
  FolderKanban,
  Zap,
  Share2,
  CalendarDays,
  FileText,
  Trophy,
  Check,
  Building,
  Clock,
  Instagram,
  Download,
  FileSpreadsheet,
  ArrowRight,
  ArrowLeft,
  X,
  // Checklist icons
  ShieldCheck,
  MessageSquare,
  BarChart3,
  Bell,
  Rocket,
  FileDown,
  TrendingUp,
  Handshake,
  Layers,
  ListTodo,
  Activity,
  Calendar,
  Image,
  CheckCircle2,
  Tag,
  RefreshCw,
  FileCheck,
  FolderOpen,
  LifeBuoy,
  Settings2
} from 'lucide-react';

interface ClientPortalTourProps {
  clientId: string;
  open: boolean;
  onClose: () => void;
  allowedSections: string[];
  logo?: string | null;
  agencyName?: string | null;
}

// Custom step definitions with rich details and real icons
const ALL_TOUR_STEPS = [
  {
    id: 'welcome',
    title: 'Welcome to Your Workspace',
    subtitle: 'Ready to scale your business?',
    description: 'Your dedicated, secure client portal. We bring together your projects, communication, documents, and financials in one hub.',
    icon: Sparkles,
    features: [
      { text: 'Centralized task dashboard', icon: Zap },
      { text: 'Real-time approvals system', icon: MessageSquare },
      { text: 'Secure account encryption', icon: ShieldCheck },
    ],
  },
  {
    id: 'overview',
    title: 'Command Center',
    subtitle: 'Your operations at a glance',
    description: 'Get a quick bird\'s-eye view of your account activity, including pending tasks, ongoing projects, and recent updates.',
    icon: LayoutDashboard,
    features: [
      { text: 'Key metrics dashboard', icon: BarChart3 },
      { text: 'Unified notifications list', icon: Bell },
      { text: 'One-click task navigation', icon: Rocket },
    ],
  },
  {
    id: 'financials',
    title: 'Financials & Billing',
    subtitle: 'Frictionless payment tracking',
    description: 'Manage payments, invoices, and estimates directly. Review draft proformas, track pending items, and pay securely.',
    icon: CreditCard,
    features: [
      { text: 'Review and download PDF invoices', icon: FileDown },
      { text: 'Real-time payment status updates', icon: TrendingUp },
      { text: 'Clear budget utilization logs', icon: Handshake },
    ],
  },
  {
    id: 'projects',
    title: 'Project Tracking',
    subtitle: 'Never lose track of deliverables',
    description: 'Track campaigns, design sprints, or development. Review active task breakdowns and know exactly what is next.',
    icon: FolderKanban,
    features: [
      { text: 'Kanban project milestone cards', icon: Layers },
      { text: 'Live checklist task tracking', icon: ListTodo },
      { text: 'Direct comments on specific tasks', icon: MessageSquare },
    ],
  },
  {
    id: 'subscriptions',
    title: 'Service Subscriptions',
    subtitle: 'Active packages and plans',
    description: 'See the service packages you are subscribed to, check renewal schedules, and see covered entitlements.',
    icon: Zap,
    features: [
      { text: 'Entitlements and limits tracking', icon: Activity },
      { text: 'Billing renewal schedules', icon: Calendar },
      { text: 'Easy plan adjustments', icon: Sparkles },
    ],
  },
  {
    id: 'social',
    title: 'Social Review',
    subtitle: 'Approve assets and copy',
    description: 'View social media creatives, review written copy, see placements, and approve or request changes before publishing.',
    icon: Share2,
    features: [
      { text: 'High-fidelity creative previews', icon: Image },
      { text: 'Annotation and feedback system', icon: MessageSquare },
      { text: 'One-tap approval buttons', icon: CheckCircle2 },
    ],
  },
  {
    id: 'planner',
    title: 'Content Planner',
    subtitle: 'Your content calendar',
    description: 'Get a monthly view of your marketing strategy. The calendar visualizes planned, drafted, and scheduled posts.',
    icon: CalendarDays,
    features: [
      { text: 'Calendar layout showing posts', icon: CalendarDays },
      { text: 'Social platform channels tags', icon: Tag },
      { text: 'Sign-off on the full month', icon: RefreshCw },
    ],
  },
  {
    id: 'documents',
    title: 'Document Hub',
    subtitle: 'All assets in one safe place',
    description: 'Access contracts, design guidelines, reports, and brand assets anytime. No more digging through emails.',
    icon: FileText,
    features: [
      { text: 'Safe storage for agreements', icon: FileCheck },
      { text: 'Document groups by project', icon: FolderOpen },
      { text: 'High-speed direct downloads', icon: Download },
    ],
  },
  {
    id: 'done',
    title: 'You\'re All Set!',
    subtitle: 'Welcome to the inner circle',
    description: 'You\'re equipped to navigate your portal. You can replay this tour anytime from the settings panel.',
    icon: Trophy,
    features: [
      { text: 'Live support channels', icon: LifeBuoy },
      { text: 'Settings tab preferences', icon: Settings2 },
      { text: 'Exceptional results ahead!', icon: Handshake },
    ],
  }
];

// Helper Component for Step Previews
interface MockupShowcaseProps {
  stepId: string;
  logo: string | null | undefined;
  agencyName: string | null | undefined;
}

function MockupShowcase({ stepId, logo, agencyName }: MockupShowcaseProps) {
  const brandLogo = logo || hirdanLogo;
  const brandName = agencyName || 'Agency';

  switch (stepId) {
    case 'welcome':
      return (
        <motion.div
          key="welcome"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="relative flex flex-col items-center justify-center h-full w-full max-w-sm"
        >
          <div className="absolute w-48 h-48 rounded-full bg-primary/20 blur-2xl animate-pulse" />
          
          <div className="absolute inset-0 pointer-events-none">
            {/* Orbiting badges */}
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute top-4 left-0 bg-card/95 backdrop-blur-md border border-border/80 p-2.5 rounded-xl shadow-lg flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
                <Check className="w-3 h-3" />
              </div>
              <div className="text-[10px]">
                <p className="font-semibold text-foreground">Task Complete</p>
                <p className="text-muted-foreground/70">Portal Setup</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ y: [0, 8, 0] }}
              transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-16 right-0 bg-card/95 backdrop-blur-md border border-border/80 p-2.5 rounded-xl shadow-lg flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded bg-primary/20 text-primary flex items-center justify-center">
                <CreditCard className="w-3 h-3" />
              </div>
              <div className="text-[10px]">
                <p className="font-semibold text-foreground">Invoice Paid</p>
                <p className="text-muted-foreground/70">#INV-0012</p>
              </div>
            </motion.div>

            <motion.div
              animate={{ x: [0, -6, 0] }}
              transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
              className="absolute bottom-4 left-6 bg-card/95 backdrop-blur-md border border-border/80 p-2.5 rounded-xl shadow-lg flex items-center gap-2"
            >
              <div className="w-5 h-5 rounded bg-pink-500/20 text-pink-500 flex items-center justify-center">
                <Share2 className="w-3 h-3" />
              </div>
              <div className="text-[10px]">
                <p className="font-semibold text-foreground">Social Post</p>
                <p className="text-muted-foreground/70">IG Campaign</p>
              </div>
            </motion.div>
          </div>

          <div className="z-10 bg-card/90 backdrop-blur-lg border border-border p-6 rounded-2xl shadow-2xl w-full text-center relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-primary" />
            <img src={brandLogo} alt="Logo" className="h-12 max-h-12 w-auto object-contain mx-auto mb-4" />
            <p className="text-xs text-muted-foreground mb-4 max-w-[220px] mx-auto">Your portal is set up and synced with our teams.</p>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 border border-emerald-500/25 text-[10px] font-semibold uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" /> Connection Established
            </div>
          </div>
        </motion.div>
      );

    case 'overview':
      return (
        <motion.div
          key="overview"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm"
        >
          <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500/80" />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground/60">Overview.tsx</span>
          </div>

          <p className="text-[10px] font-bold text-muted-foreground mb-3 uppercase tracking-wider">WORKSPACE METRICS</p>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-muted/40 border border-border/60 p-3 rounded-xl">
              <p className="text-[10px] font-medium text-muted-foreground">Active Tasks</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold text-foreground">8</span>
                <span className="text-[9px] text-emerald-600 font-bold">+2 new</span>
              </div>
              <div className="w-full bg-muted/80 h-1 rounded-full mt-2.5 overflow-hidden">
                <div className="bg-primary h-full rounded-full w-[65%]" />
              </div>
            </div>
            <div className="bg-muted/40 border border-border/60 p-3 rounded-xl">
              <p className="text-[10px] font-medium text-muted-foreground">Active Projects</p>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-xl font-bold text-foreground">3</span>
                <span className="text-[9px] text-primary font-bold">On track</span>
              </div>
              <div className="w-full bg-muted/80 h-1 rounded-full mt-2.5 overflow-hidden">
                <div className="bg-primary/70 h-full rounded-full w-[80%]" />
              </div>
            </div>
          </div>

          <div className="bg-muted/40 border border-border/60 p-3 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Latest Proforma</p>
                <p className="text-[9px] text-muted-foreground">Invoice #2026-08</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-xs font-bold text-foreground">1,450 DJF</p>
              <span className="text-[8px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded-full">APPROVED</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/40">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] text-muted-foreground font-medium">Growth Index</span>
              <span className="text-[10px] text-emerald-600 font-semibold">+14.2%</span>
            </div>
            <svg viewBox="0 0 100 20" className="w-full h-8 text-primary overflow-visible">
              <path
                d="M0 15 Q20 5, 40 12 T80 4 T100 2"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <path
                d="M0 15 Q20 5, 40 12 T80 4 T100 2 L100 20 L0 20 Z"
                fill="url(#grad)"
                className="opacity-10"
              />
              <defs>
                <linearGradient id="grad" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="currentColor" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                </linearGradient>
              </defs>
            </svg>
          </div>
        </motion.div>
      );

    case 'financials':
      return (
        <motion.div
          key="financials"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-sm space-y-4"
        >
          <div className="relative bg-gradient-to-tr from-primary to-primary/80 text-primary-foreground p-5 rounded-2xl shadow-xl overflow-hidden aspect-[1.6/1] flex flex-col justify-between border border-primary/20">
            <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-white/10 blur-xl pointer-events-none" />
            <div className="flex items-start justify-between">
              <div>
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">Agency Account Balance</p>
                <p className="text-2xl font-black mt-0.5">4,850 DJF</p>
              </div>
              <Building className="w-6 h-6 opacity-80" />
            </div>

            <div className="flex items-end justify-between mt-4">
              <div>
                <p className="text-[8px] font-semibold tracking-widest opacity-60">CLIENT ACCOUNT</p>
                <p className="text-xs font-bold uppercase tracking-wider">Hirdan Client</p>
              </div>
              <div className="flex flex-col items-end">
                <span className="w-8 h-5 bg-white/20 rounded border border-white/10 flex items-center justify-center mb-0.5">
                  <div className="w-3.5 h-3.5 bg-white/40 rounded-full" />
                </span>
                <span className="text-[8px] font-mono tracking-widest opacity-60">★★★★ 4910</span>
              </div>
            </div>
          </div>

          <div className="bg-card/90 backdrop-blur-lg border border-border p-4 rounded-xl shadow-xl space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground mb-2 uppercase tracking-wider">RECENT BILLS</p>
            <div className="flex items-center justify-between text-xs py-1.5 border-b border-border/40">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span className="font-semibold text-foreground/90">#INV-2026-004</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground font-bold">1,200 DJF</span>
                <span className="text-[8px] bg-emerald-500/10 text-emerald-600 px-1.5 py-0.5 rounded border border-emerald-500/20 font-bold">PAID</span>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs py-1.5">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                <span className="font-semibold text-foreground/90">#PRO-2026-009</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-foreground font-bold">3,650 DJF</span>
                <span className="text-[8px] bg-amber-500/10 text-amber-650 px-1.5 py-0.5 rounded border border-amber-500/20 font-bold">PENDING</span>
              </div>
            </div>
          </div>
        </motion.div>
      );

    case 'projects':
      return (
        <motion.div
          key="projects"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm"
        >
          <div className="flex items-center justify-between mb-4 border-b border-border/60 pb-3">
            <div>
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">ACTIVE PROJECT</span>
              <h4 className="text-sm font-bold text-foreground mt-0.5">Q3 Marketing Launch</h4>
            </div>
            <span className="text-[9px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-full">IN PROGRESS</span>
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs mb-1.5">
                <span className="text-muted-foreground font-medium">Milestones Completed</span>
                <span className="text-foreground font-bold">75%</span>
              </div>
              <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
                <div className="bg-primary h-full rounded-full w-[75%]" />
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className="line-through text-muted-foreground">Competitive Landscape Audit</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-600 flex items-center justify-center border border-emerald-500/30">
                  <Check className="w-2.5 h-2.5" />
                </div>
                <span className="line-through text-muted-foreground">Creative Ad Sets Designs</span>
              </div>
              <div className="flex items-center gap-2.5 text-xs text-foreground/90">
                <div className="w-4 h-4 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center text-primary animate-pulse">
                  <Clock className="w-2.5 h-2.5" />
                </div>
                <span className="font-semibold text-foreground">Landing Page Development</span>
              </div>
            </div>
          </div>
        </motion.div>
      );

    case 'subscriptions':
      return (
        <motion.div
          key="subscriptions"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-primary/20 to-transparent blur-xl pointer-events-none" />
          
          <div className="flex items-center justify-between mb-4">
            <div className="inline-flex items-center gap-1 bg-primary/15 text-primary border border-primary/25 px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider">
              <Zap className="w-2.5 h-2.5" /> Premium Tier
            </div>
            <span className="text-[10px] text-muted-foreground">Renews Aug 1, 2026</span>
          </div>

          <h3 className="text-xl font-bold text-foreground mb-0.5">Scale Package</h3>
          <p className="text-xs text-muted-foreground mb-4">Monthly design and marketing retainer.</p>

          <div className="bg-muted/40 border border-border/60 p-3 rounded-xl mb-4">
            <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">USAGE LIMITS</p>
            <div className="flex items-baseline gap-1 mt-1 mb-1.5">
              <span className="text-lg font-bold text-foreground">42 / 50</span>
              <span className="text-[10px] text-muted-foreground/80">credits used</span>
            </div>
            <div className="w-full bg-muted h-1.5 rounded-full overflow-hidden">
              <div className="bg-primary h-full rounded-full w-[84%]" />
            </div>
          </div>

          <div className="space-y-2 text-xs">
            <div className="flex items-center gap-2 text-foreground/80">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Dedicated Design Team</span>
            </div>
            <div className="flex items-center gap-2 text-foreground/80">
              <Check className="w-3.5 h-3.5 text-primary" />
              <span>Unlimited Revision Loops</span>
            </div>
          </div>
        </motion.div>
      );

    case 'social':
      return (
        <motion.div
          key="social"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <img src={brandLogo} alt="Logo" className="w-7 h-7 rounded-full object-contain" />
              <div>
                <p className="text-xs font-bold text-foreground">{brandName.toLowerCase()}_agency</p>
                <p className="text-[8px] text-muted-foreground">Instagram post preview</p>
              </div>
            </div>
            <span className="text-[8px] font-bold bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded">AWAITING REVIEW</span>
          </div>

          <div className="aspect-square w-full rounded-lg bg-gradient-to-br from-primary via-primary/40 to-primary/10 mb-3 flex flex-col justify-center items-center text-center p-4 relative overflow-hidden group">
            <div className="absolute inset-0 bg-black/10" />
            <Instagram className="w-9 h-9 text-white drop-shadow-md mb-2 animate-bounce" />
            <h5 className="text-white font-extrabold text-xs tracking-tight z-10">THE FUTURE OF MARKETING</h5>
            <p className="text-white/80 text-[9px] mt-0.5 z-10">Creative Asset #3</p>
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 text-[10px] h-7.5 bg-muted border border-border text-foreground hover:bg-muted/80 font-semibold"
            >
              Request Edit
            </Button>
            <Button
              size="sm"
              className="flex-1 text-[10px] h-7.5 bg-primary hover:bg-primary/90 text-primary-foreground border-0 font-semibold"
            >
              Approve Asset
            </Button>
          </div>
        </motion.div>
      );

    case 'planner':
      return (
        <motion.div
          key="planner"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm"
        >
          <div className="flex items-center justify-between mb-4">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest">CONTENT CALENDAR</span>
            <span className="text-xs text-foreground font-bold">July 2026</span>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[8px] text-muted-foreground font-bold mb-2">
            <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
          </div>
          <div className="grid grid-cols-7 gap-1">
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">29</div>
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">30</div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">1</span>
              <span className="w-1 h-1 rounded-full bg-emerald-500 mx-auto" />
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">2</span>
              <span className="w-1 h-1 rounded-full bg-emerald-500 mx-auto" />
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1 relative border-primary/30">
              <span className="text-foreground text-[8px] font-bold">3</span>
              <span className="w-1 h-1 rounded-full bg-primary mx-auto animate-ping" />
            </div>
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">4</div>
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">5</div>

            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">6</span>
              <span className="w-1 h-1 rounded-full bg-emerald-500 mx-auto" />
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">7</span>
              <span className="w-1 h-1 rounded-full bg-amber-500 mx-auto" />
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">8</span>
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">9</span>
              <span className="w-1 h-1 rounded-full bg-emerald-500 mx-auto" />
            </div>
            <div className="aspect-square bg-muted/40 border border-border rounded flex flex-col justify-between p-1">
              <span className="text-foreground text-[8px] font-bold">10</span>
            </div>
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">11</div>
            <div className="aspect-square bg-muted/20 border border-border/40 rounded flex items-center justify-center text-muted-foreground/80 text-[8px]">12</div>
          </div>

          <div className="mt-4 pt-3 border-t border-border/50 flex items-center justify-between text-[8px]">
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /><span className="text-muted-foreground">Published</span></div>
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-amber-500" /><span className="text-muted-foreground">In Review</span></div>
            <div className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-primary" /><span className="text-muted-foreground">Active</span></div>
          </div>
        </motion.div>
      );

    case 'documents':
      return (
        <motion.div
          key="documents"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ duration: 0.4 }}
          className="bg-card/90 backdrop-blur-lg border border-border p-5 rounded-2xl shadow-2xl w-full max-w-sm space-y-3"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">SECURE DOCUMENTS</span>
            <span className="text-[9px] font-semibold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-2 py-0.5 rounded">SYNCED</span>
          </div>

          <div className="space-y-2">
            <div className="bg-muted/40 border border-border hover:bg-muted/60 p-2.5 rounded-xl flex items-center justify-between transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-rose-500/10 border border-rose-500/20 text-rose-600 flex items-center justify-center rounded-lg">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Service_Contract.pdf</p>
                  <p className="text-[9px] text-muted-foreground">Signed • 2.4 MB</p>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </div>

            <div className="bg-muted/40 border border-border hover:bg-muted/60 p-2.5 rounded-xl flex items-center justify-between transition-all">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 bg-primary/10 border border-primary/20 text-primary flex items-center justify-center rounded-lg">
                  <FileSpreadsheet className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xs font-bold text-foreground">Q2_Growth_Report.xlsx</p>
                  <p className="text-[9px] text-muted-foreground">Audit Sheet • 1.1 MB</p>
                </div>
              </div>
              <Download className="w-3.5 h-3.5 text-muted-foreground" />
            </div>
          </div>
        </motion.div>
      );

    case 'done':
      return (
        <motion.div
          key="done"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.85 }}
          transition={{ duration: 0.4 }}
          className="relative flex flex-col items-center justify-center h-full w-full max-w-sm text-center"
        >
          <div className="absolute w-44 h-44 rounded-full bg-primary/15 blur-2xl animate-pulse" />
          
          <motion.div
            animate={{ scale: [1, 1.03, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="z-10 bg-card/90 backdrop-blur-lg border border-border p-6 rounded-2xl shadow-2xl relative w-full"
          >
            <div className="w-20 h-20 bg-gradient-to-tr from-primary to-primary/80 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/20 border border-primary/30">
              <Trophy className="w-10 h-10 text-primary-foreground font-black animate-bounce" />
            </div>
            <h4 className="text-lg font-bold text-foreground mb-1.5">You're Onboarded!</h4>
            <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">Your account configuration is complete. Welcome to {brandName}.</p>
          </motion.div>
        </motion.div>
      );

    default:
      return null;
  }
}

export function ClientPortalTour({ clientId, open, onClose, allowedSections, logo, agencyName }: ClientPortalTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const brandLogo = logo || hirdanLogo;
  const brandName = agencyName || 'Agency';

  // Filter tour steps to include welcome, allowed sections, and done
  const activeSteps = ALL_TOUR_STEPS.filter(step => {
    if (step.id === 'welcome' || step.id === 'done') return true;
    return allowedSections.includes(step.id);
  });

  const handleClose = () => {
    localStorage.setItem(`portal_tour_done_${clientId}`, '1');
    onClose();
  };

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [open]);
  if (!open) return null;

  const step = activeSteps[currentStep];
  const isLast = currentStep === activeSteps.length - 1;
  const isFirst = currentStep === 0;

  return (
    <AnimatePresence>
      {/* Root: locked to the true device viewport height (100dvh) so mobile never needs to scroll */}
      <div className="fixed inset-0 z-[100] w-full h-[100dvh] bg-background flex flex-col lg:flex-row overflow-hidden select-none">
        
        {/* Left Panel: High fidelity mockup preview (hidden on mobile, visible on lg and above) */}
        <div className="hidden lg:flex lg:w-[42%] bg-background text-foreground relative flex flex-col justify-between p-8 lg:p-12 border-r border-border/80 shrink-0 h-full overflow-hidden">
          
          {/* Subtle grid lines background overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30" />
          
          {/* Ambient Glows */}
          <div className="absolute w-[400px] h-[400px] rounded-full bg-primary/10 blur-3xl opacity-15 -top-20 -left-20 pointer-events-none transition-all duration-700" />
          <div className="absolute w-[300px] h-[300px] rounded-full bg-primary/5 blur-3xl opacity-20 -bottom-20 -right-20 pointer-events-none" />

          {/* Branding Header: Logo image ONLY, no text name */}
          <div className="z-10 flex items-center gap-2">
            <img src={brandLogo} alt="Logo" className="h-10 max-h-10 w-auto object-contain" />
          </div>

          {/* Center Showcase Area with Transitions */}
          <div className="z-10 flex-1 flex items-center justify-center w-full py-8">
            <AnimatePresence mode="wait">
              <MockupShowcase key={step.id} stepId={step.id} logo={logo} agencyName={agencyName} />
            </AnimatePresence>
          </div>

          {/* Bottom badge */}
          <div className="z-10 flex items-center justify-between text-[10px] text-muted-foreground tracking-wider font-semibold uppercase">
            <span>© 2026 {brandName}</span>
            <span>Interactive Guide</span>
          </div>
        </div>

        {/* Right Panel: Guided content & navigation.
            Mobile: strict 3-row flex column (header / content / footer), no scrolling.
            Desktop (lg+): original centered, scrollable-if-needed layout. */}
        <div className="w-full lg:w-[58%] h-full flex flex-col min-h-0 p-4 sm:p-5 md:p-8 lg:p-12 bg-card relative overflow-hidden lg:overflow-y-auto">

          {/* Subtle grid lines background overlay for mobile */}
          <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border))_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 lg:hidden pointer-events-none" />

          {/* Row 1 — Header / progress (fixed height, never shrinks) */}
          <div className="shrink-0 flex items-center justify-between w-full border-b border-border/60 pb-3 lg:pb-4 mb-3 lg:mb-4 gap-3 relative z-10">
            <div className="flex items-center gap-2.5 min-w-0">
              {/* Mobile-only logo (made 2x bigger) */}
              <img src={brandLogo} alt="Logo" className="lg:hidden h-14 max-h-14 w-auto object-contain shrink-0" />

              {/* Step Indicators */}
              <div className="flex items-center gap-1">
                {activeSteps.map((s, idx) => (
                  <button
                    key={s.id}
                    onClick={() => setCurrentStep(idx)}
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      idx === currentStep
                        ? 'w-6 bg-primary shadow-sm shadow-primary/20'
                        : idx < currentStep
                        ? 'w-1.5 bg-primary/45 hover:bg-primary/70'
                        : 'w-1 bg-muted hover:bg-muted-foreground/30'
                    }`}
                    title={s.title}
                  />
                ))}
              </div>
            </div>

            {/* Close button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-full shrink-0"
              onClick={handleClose}
            >
              <X className="h-4.5 w-4.5" />
            </Button>
          </div>

          {/* Row 2 — Core content. flex-1 + min-h-0 = takes exactly the remaining space, never overflows. */}
          <div className="flex-1 min-h-0 flex flex-col lg:justify-center max-w-xl w-full mx-auto relative z-10">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentStep}
                initial={{ y: 15, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -15, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="w-full h-full flex-1 min-h-0 flex flex-col lg:block"
              >

                {/* ===== MOBILE COMPACT LAYOUT (< lg) ===== */}
                <div className="lg:hidden flex flex-col h-full min-h-0 gap-3">

                  {/* Icon + subtitle + title (fixed height block) */}
                  <div className="shrink-0 flex items-start gap-3">
                    <div className="w-11 h-11 rounded-xl flex items-center justify-center relative border shadow-sm text-primary bg-primary/10 border-primary/20 shrink-0">
                      <step.icon className="w-5.5 h-5.5" />
                    </div>
                    <div className="min-w-0 flex-1 pt-0.5">
                      <span className="text-[11px] font-black tracking-wider uppercase text-primary block">
                        {step.subtitle}
                      </span>
                      <h2 className="text-xl lg:text-2xl font-display font-black text-foreground tracking-tight leading-tight line-clamp-2">
                        {step.title}
                      </h2>
                    </div>
                  </div>

                  {/* Description, clamped to 3 lines so it can't grow unpredictably */}
                  <p className="shrink-0 text-muted-foreground leading-normal text-[13px] line-clamp-3">
                    {step.description}
                  </p>

                  {/* Mockup preview: fills all remaining space, content scaled + clipped so it always fits */}
                  <div className="flex-1 min-h-0 w-full relative overflow-hidden rounded-xl border border-border/50 bg-muted/10">
                    <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
                      <div className="scale-[1.0] origin-center flex items-center justify-center" style={{ width: '384px', height: '400px' }}>
                        <MockupShowcase stepId={step.id} logo={logo} agencyName={agencyName} />
                      </div>
                    </div>
                  </div>

                  {/* Feature chips: one fixed-height row (3-col grid), text clamped so it never wraps the row taller */}
                  <div className="shrink-0 grid grid-cols-3 gap-2">
                    {step.features.map((feature, i) => (
                      <div
                        key={i}
                        className="flex flex-col items-center justify-center gap-1.5 bg-muted/40 border border-border/50 rounded-xl px-2 py-2.5 text-center"
                      >
                        <div className="rounded-lg p-1.5 bg-primary/10 text-primary border border-primary/20 shrink-0">
                          <feature.icon className="w-3.5 h-3.5" />
                        </div>
                        <span className="text-[10px] leading-tight text-foreground/80 font-bold line-clamp-2">
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* ===== DESKTOP LAYOUT (lg+), unchanged from original ===== */}
                <div className="hidden lg:block space-y-3.5">
                  <div className="w-16 h-16 rounded-2xl flex items-center justify-center relative border shadow-sm text-primary bg-primary/10 border-primary/20 shrink-0">
                    <step.icon className="w-8 h-8" />
                  </div>

                  <span className="text-xs font-bold tracking-widest uppercase text-primary block">
                    {step.subtitle}
                  </span>

                  <h2 className="text-4xl font-display font-black text-foreground tracking-tight">
                    {step.title}
                  </h2>

                  <p className="text-muted-foreground leading-normal text-base">
                    {step.description}
                  </p>

                  <div className="space-y-2.5 bg-muted/40 p-4 rounded-xl border border-border/50">
                    <h4 className="text-[9px] font-black uppercase tracking-wider text-muted-foreground mb-2">
                      Section capabilities
                    </h4>
                    {step.features.map((feature, i) => (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.1 }}
                        key={i}
                        className="flex items-start gap-2 text-sm text-foreground/90 font-medium"
                      >
                        <div className="mt-0.5 rounded-md p-1 bg-primary/10 text-primary border border-primary/20 shrink-0">
                          <feature.icon className="w-3.5 h-3.5" />
                        </div>
                        <span>{feature.text}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Row 3 — Bottom action footer (fixed height, never shrinks, always visible) */}
          <div className="shrink-0 border-t border-border/80 pt-3.5 lg:pt-4 flex items-center justify-between w-full max-w-xl mx-auto mt-3.5 lg:mt-4 relative z-10">
            <Button
              variant="outline"
              onClick={() => setCurrentStep(prev => prev - 1)}
              disabled={isFirst}
              className={`h-12 px-4 text-sm font-bold gap-2 border-border/80 whitespace-nowrap ${
                isFirst ? 'opacity-0 pointer-events-none' : ''
              }`}
            >
              <ArrowLeft className="h-4.5 w-4.5 shrink-0" />
              <span className="hidden sm:inline">Previous</span>
            </Button>

            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                onClick={handleClose}
                className="text-muted-foreground hover:text-foreground text-sm font-bold px-3 h-12"
              >
                Skip
              </Button>

              {!isLast ? (
                <Button
                  variant="hero"
                  onClick={() => setCurrentStep(prev => prev + 1)}
                  className="h-12 px-6 text-sm shadow-premium font-bold gap-2 whitespace-nowrap"
                >
                  Next <ArrowRight className="h-4.5 w-4.5 shrink-0" />
                </Button>
              ) : (
                <Button
                  variant="hero"
                  onClick={handleClose}
                  className="h-12 px-7 text-sm shadow-premium font-extrabold gap-2 whitespace-nowrap bg-gradient-gold text-secondary-foreground"
                >
                  Get Started <Sparkles className="h-4.5 w-4.5 text-secondary-foreground shrink-0" />
                </Button>
              )}
            </div>
          </div>

        </div>
      </div>
    </AnimatePresence>
  );
}

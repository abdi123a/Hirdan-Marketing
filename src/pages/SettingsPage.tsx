import { useState, useRef, useEffect, Fragment, type ComponentProps, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Puzzle, Globe, User, Users, LayoutGrid, Bell, Palette, Clock, Shield, Link, Mail, Phone, MapPin, Upload,
  Image as ImageIcon, Check, CreditCard, FileText, Percent, X, Plus, Trash2, HelpCircle, AlertCircle, Settings,
  Briefcase, Loader2, Sparkles, GitCommit, Tag, History, ArrowUpCircle, Terminal, Package, Calendar, SendHorizontal,
  Eye, EyeOff, RotateCcw, Server, Wallet, ArrowLeftRight, Building2, Smartphone, Banknote, Edit2, Database, Download,
  Cloud, CloudOff, PlusCircle, CheckCircle2, Copy, Inbox, type LucideIcon,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyStore, AgencySettings, PaymentMethod, SocialLink, VersionEntry } from "@/lib/store";
import { usePermissions } from "@/hooks/usePermissions";
import { ProtectedBrandingImage } from "@/components/ProtectedBrandingImage";
import { Progress } from "@/components/ui/progress";
import { apiFetch, downloadProtectedFile } from "@/lib/api-client";
import UsersPage from "./UsersPage";
import PluginsPage from "./PluginsPage";
import LandingPageEditor from "./LandingPageEditor";

// Comprehensive Timezones list with countries
const timezones = [
  { group: "Africa", zones: [
    { value: "Africa/Djibouti", label: "Djibouti (EAT)" },
    { value: "Africa/Nairobi", label: "Kenya, Nairobi (EAT)" },
    { value: "Africa/Cairo", label: "Egypt, Cairo (EET)" },
    { value: "Africa/Johannesburg", label: "South Africa (SAST)" },
    { value: "Africa/Lagos", label: "Nigeria, Lagos (WAT)" },
    { value: "Africa/Casablanca", label: "Morocco, Casablanca (WET)" },
  ]},
  { group: "Americas", zones: [
    { value: "America/New_York", label: "USA, New York (ET)" },
    { value: "America/Chicago", label: "USA, Chicago (CT)" },
    { value: "America/Denver", label: "USA, Denver (MT)" },
    { value: "America/Los_Angeles", label: "USA, Los_Angeles (PT)" },
    { value: "America/Toronto", label: "Canada, Toronto (ET)" },
    { value: "America/Sao_Paulo", label: "Brazil, Sao_Paulo (BRT)" },
  ]},
  { group: "Europe", zones: [
    { value: "Europe/London", label: "UK, London (GMT)" },
    { value: "Europe/Paris", label: "France, Paris (CET)" },
    { value: "Europe/Berlin", label: "Germany, Berlin (CET)" },
    { value: "Europe/Istanbul", label: "Turkey, Istanbul (TRT)" },
    { value: "Europe/Moscow", label: "Russia, Moscow (MSK)" },
  ]},
  { group: "Asia/Pacific", zones: [
    { value: "Asia/Dubai", label: "UAE, Dubai (GST)" },
    { value: "Asia/Tokyo", label: "Japan, Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "China, Shanghai (CST)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Australia/Sydney", label: "Australia, Sydney (AEST)" },
  ]},
];

const currencies = [
  { value: "DJF", label: "DJF (Djibouti Franc)", symbol: "Fdj" },
  { value: "USD", label: "USD (US Dollar)", symbol: "$" },
  { value: "EUR", label: "EUR (Euro)", symbol: "€" },
  { value: "GBP", label: "GBP (British Pound)", symbol: "£" },
  { value: "AED", label: "AED (UAE Dirham)", symbol: "د.إ" },
  { value: "SAR", label: "SAR (Saudi Riyal)", symbol: "ر.س" },
  { value: "KES", label: "KES (Kenyan Shilling)", symbol: "KSh" },
  { value: "ETB", label: "ETB (Ethiopian Birr)", symbol: "Br" },
];

// ─── Email Template Definitions ────────────────────────────────────────────
interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  variables: string;
  body: string;
}

const DEFAULT_EMAIL_TEMPLATES: EmailTemplate[] = [
  {
    id: 'client-welcome',
    name: 'Client Welcome',
    subject: 'Welcome to Hirdan Marketing, {{client_name}}!',
    variables: '{{client_name}}, {{agency_name}}, {{portal_link}}, {{account_manager}}',
    body: `Hi {{client_name}},\n\nWelcome aboard! We're thrilled to have you as part of the Hirdan Marketing family.\n\nYour dedicated account manager {{account_manager}} will be in touch shortly. In the meantime, you can access your client portal here:\n\n{{portal_link}}\n\nIf you have any questions, don't hesitate to reach out.\n\nWarm regards,\nThe {{agency_name}} Team`,
  },
  {
    id: 'invoice-sent',
    name: 'Invoice Sent',
    subject: 'Invoice #{{invoice_number}} from {{agency_name}}',
    variables: '{{client_name}}, {{invoice_number}}, {{amount}}, {{due_date}}, {{invoice_link}}, {{agency_name}}',
    body: `Hi {{client_name}},\n\nPlease find attached Invoice #{{invoice_number}} for {{amount}}, due on {{due_date}}.\n\nYou can view and pay your invoice online:\n\n{{invoice_link}}\n\nIf you have any questions regarding this invoice, feel free to contact us.\n\nThank you for your business.\n\nBest regards,\n{{agency_name}}`,
  },
  {
    id: 'subscription-renewal',
    name: 'Subscription Renewal Reminder',
    subject: 'Your {{package_name}} subscription renews on {{renewal_date}}',
    variables: '{{client_name}}, {{package_name}}, {{renewal_date}}, {{amount}}, {{portal_link}}, {{agency_name}}',
    body: `Hi {{client_name}},\n\nThis is a friendly reminder that your {{package_name}} subscription is set to renew on {{renewal_date}} for {{amount}}.\n\nNo action is required — we'll take care of it automatically. If you'd like to make any changes to your plan, please log in to your portal before the renewal date:\n\n{{portal_link}}\n\nThank you for your continued partnership.\n\nBest regards,\n{{agency_name}}`,
  },
  {
    id: 'project-update',
    name: 'Project Update',
    subject: 'Update on your project: {{project_name}}',
    variables: '{{client_name}}, {{project_name}}, {{update_summary}}, {{project_link}}, {{agency_name}}',
    body: `Hi {{client_name}},\n\nWe have an update on your project "{{project_name}}":\n\n{{update_summary}}\n\nYou can review the full details in your project portal:\n\n{{project_link}}\n\nAs always, reach out if you have any questions or feedback.\n\nBest regards,\n{{agency_name}}`,
  },
  {
    id: 'invoice-overdue',
    name: 'Invoice Overdue Notice',
    subject: 'Action Required: Invoice #{{invoice_number}} is Overdue',
    variables: '{{client_name}}, {{invoice_number}}, {{amount}}, {{overdue_days}}, {{invoice_link}}, {{agency_name}}',
    body: `Hi {{client_name}},\n\nThis is a reminder that Invoice #{{invoice_number}} for {{amount}} is now {{overdue_days}} days overdue.\n\nPlease settle the outstanding balance at your earliest convenience:\n\n{{invoice_link}}\n\nIf you've already made this payment, please disregard this notice. For any concerns, feel free to contact us directly.\n\nBest regards,\n{{agency_name}}`,
  },
  {
    id: 'proposal-sent',
    name: 'Proposal / Proforma Sent',
    subject: 'Your Proposal from {{agency_name}} is Ready',
    variables: '{{client_name}}, {{proposal_number}}, {{proposal_link}}, {{expiry_date}}, {{agency_name}}',
    body: `Hi {{client_name}},\n\nThank you for your interest in our services! We've prepared a tailored proposal for you.\n\nYou can review Proposal #{{proposal_number}} via the link below — it will be valid until {{expiry_date}}:\n\n{{proposal_link}}\n\nWe'd love to discuss this further at your convenience. Please don't hesitate to reach out with any questions.\n\nLooking forward to working together!\n\nBest regards,\n{{agency_name}}`,
  },
  {
    id: 'contact-reply',
    name: 'Contact Form Reply',
    subject: 'Re: Your message to {{agency_name}}',
    variables: '{{client_name}}, {{original_message}}, {{agency_name}}, {{reply_message}}',
    body: `Hi {{client_name}},\n\nThank you for reaching out to us. We received your message and wanted to follow up:\n\n{{reply_message}}\n\nIf you have further questions, feel free to reply to this email directly.\n\nWarm regards,\n{{agency_name}}`,
  },
];

// ─── Tab navigation (mobile bar + desktop sidebar render from this) ────────
type Tone = 'blue' | 'purple' | 'emerald';
// [mobile text, desktop active state, desktop badge]
const TONES: Record<Tone, [string, string, string]> = {
  blue: ['text-blue-600 dark:text-blue-400', 'data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400', 'bg-blue-500/10 text-blue-600 dark:text-blue-400'],
  purple: ['text-purple-600 dark:text-purple-400', 'data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400', 'bg-purple-500/10 text-purple-600 dark:text-purple-400'],
  emerald: ['text-emerald-600 dark:text-emerald-400', 'data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 dark:data-[state=active]:text-emerald-400', 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'],
};
const GROUPS = ['Account & Branding', 'Finance & Localization', 'Integrations', 'System'];
const TABS: { value: string; icon: LucideIcon; short: string; label: string; group: number; tone?: Tone; plainSide?: boolean; badge?: string }[] = [
  { value: 'general', icon: User, short: 'General', label: 'General', group: 0 },
  { value: 'branding', icon: Palette, short: 'Branding', label: 'Identity & Branding', group: 0 },
  { value: 'social', icon: Link, short: 'Social', label: 'Social Links', group: 0 },
  { value: 'users', icon: Users, short: 'Users', label: 'Users', group: 0 },
  { value: 'landing-page', icon: LayoutGrid, short: 'Landing Page', label: 'Landing Page', group: 0 },
  { value: 'localization', icon: Globe, short: 'Localization', label: 'Localization', group: 1 },
  { value: 'billing', icon: CreditCard, short: 'Billing', label: 'Billing & Tax', group: 1 },
  { value: 'accounts', icon: Wallet, short: 'Accounts', label: 'Accounts', group: 1 },
  { value: 'payments', icon: Settings, short: 'Payments', label: 'Payment Gateways', group: 1 },
  { value: 'notifications', icon: Bell, short: 'Alerts', label: 'Notifications', group: 2 },
  { value: 'email', icon: Mail, short: 'Mail', label: 'Mail Config', group: 2, tone: 'blue', badge: 'SMTP' },
  { value: 'email-templates', icon: FileText, short: 'Email Templates', label: 'Email Templates', group: 2, tone: 'blue' },
  { value: 'ai', icon: Sparkles, short: 'AI', label: 'AI Settings', group: 2, tone: 'purple', badge: 'Beta' },
  { value: 'system', icon: Terminal, short: 'System', label: 'System & Versioning', group: 3 },
  { value: 'backups', icon: Database, short: 'Backup', label: 'Database Backups', group: 3, tone: 'blue', plainSide: true },
  { value: 'plugins', icon: Puzzle, short: 'Plugins', label: 'Plugins', group: 2, tone: 'emerald' },
];

type ImageKey = 'logo' | 'whiteLogo' | 'favicon' | 'signature' | 'stamp';
const IMAGE_SLOTS: { key: ImageKey; label: string; alt: string; icon: LucideIcon; noun: string; empty: string; hint: string }[] = [
  { key: 'logo', label: 'Main Logo', alt: 'Main Logo', icon: ImageIcon, noun: 'Logo', empty: 'Upload Logo', hint: 'PNG, SVG or JPG' },
  { key: 'whiteLogo', label: 'White Logo (Dark Mode)', alt: 'White Logo', icon: ImageIcon, noun: 'Logo', empty: 'Upload White Logo', hint: 'PNG, SVG or JPG' },
  { key: 'favicon', label: 'Favicon', alt: 'Favicon', icon: Globe, noun: 'Icon', empty: 'Upload Icon', hint: '32x32px or 64x64px' },
  { key: 'signature', label: 'Authorized Signature', alt: 'Signature', icon: FileText, noun: 'Signature', empty: 'Upload Signature', hint: 'PNG with transparency' },
  { key: 'stamp', label: 'Company Stamp', alt: 'Stamp', icon: Shield, noun: 'Stamp', empty: 'Upload Stamp', hint: 'PNG with transparency' },
];

const GENERAL_FIELDS: { id: 'agencyName' | 'adminEmail' | 'phone' | 'website' | 'address'; icon: LucideIcon; label: string; placeholder: string; type?: string }[][] = [
  [
    { id: 'agencyName', icon: User, label: 'Agency Name', placeholder: 'Your Agency Name' },
    { id: 'adminEmail', icon: Mail, label: 'Admin Email', placeholder: 'admin@example.com', type: 'email' },
    { id: 'phone', icon: Phone, label: 'Phone Number', placeholder: '+1 (555) 000-0000' },
  ],
  [
    { id: 'website', icon: Globe, label: 'Website URL', placeholder: 'https://example.com' },
    { id: 'address', icon: MapPin, label: 'Office Address', placeholder: '123 Agency St, City, Country' },
  ],
];

const NOTIFICATIONS: { key: keyof AgencySettings['notifications']; icon: LucideIcon; title: string; desc: string }[] = [
  { key: 'emailAlerts', icon: Mail, title: 'Email Alerts', desc: 'Receive weekly summary reports and important system updates via email.' },
  { key: 'projectUpdates', icon: Shield, title: 'Project Updates', desc: 'Get notified immediately when a project status changes or a new task is created.' },
  { key: 'billingAlerts', icon: CreditCard, title: 'Billing & Invoices', desc: 'Receive notifications for paid invoices, overdue payments and new proformas.' },
];

const AI_PROVIDERS = [
  { id: 'openai', name: 'OpenAI', desc: 'GPT-4o & GPT-4o-mini models', icon: Sparkles, color: 'from-green-500/10 to-emerald-500/5 hover:border-green-500/30' },
  { id: 'claude', name: 'Anthropic Claude', desc: 'Claude 3.5 Sonnet models', icon: Server, color: 'from-orange-500/10 to-amber-500/5 hover:border-orange-500/30' },
  { id: 'gemini', name: 'Google Gemini', desc: 'Gemini 3.5 Flash (Free tier)', icon: Globe, color: 'from-blue-500/10 to-cyan-500/5 hover:border-blue-500/30' },
] as const;

const AI_KEYS = [
  { id: 'openAiApiKey', label: 'OpenAI API Key', href: 'https://platform.openai.com/api-keys', placeholder: 'sk-...' },
  { id: 'claudeApiKey', label: 'Anthropic Claude API Key', href: 'https://console.anthropic.com/settings/keys', placeholder: 'sk-ant-...' },
  { id: 'geminiApiKey', label: 'Google Gemini API Key', href: 'https://aistudio.google.com/app/apikey', placeholder: 'AIzaSy...' },
] as const;

const SOCIAL_ICON_OPTIONS: { icon: string; platform: string; label: string }[] = [
  { icon: 'fa-facebook-f',    platform: 'Facebook',   label: 'Facebook' },
  { icon: 'fa-twitter',       platform: 'Twitter',    label: 'Twitter (X)' },
  { icon: 'fa-instagram',     platform: 'Instagram',  label: 'Instagram' },
  { icon: 'fa-linkedin-in',   platform: 'LinkedIn',   label: 'LinkedIn' },
  { icon: 'fa-youtube',       platform: 'YouTube',    label: 'YouTube' },
  { icon: 'fa-tiktok',        platform: 'TikTok',     label: 'TikTok' },
  { icon: 'fa-snapchat',      platform: 'Snapchat',   label: 'Snapchat' },
  { icon: 'fa-pinterest',     platform: 'Pinterest',  label: 'Pinterest' },
  { icon: 'fa-telegram',      platform: 'Telegram',   label: 'Telegram' },
  { icon: 'fa-whatsapp',      platform: 'WhatsApp',   label: 'WhatsApp' },
  { icon: 'fa-discord',       platform: 'Discord',    label: 'Discord' },
  { icon: 'fa-reddit',        platform: 'Reddit',     label: 'Reddit' },
  { icon: 'fa-github',        platform: 'GitHub',     label: 'GitHub' },
  { icon: 'fa-dribbble',      platform: 'Dribbble',   label: 'Dribbble' },
  { icon: 'fa-behance',       platform: 'Behance',    label: 'Behance' },
  { icon: 'fa-vimeo-v',       platform: 'Vimeo',      label: 'Vimeo' },
  { icon: 'fa-twitch',        platform: 'Twitch',     label: 'Twitch' },
  { icon: 'fa-medium',        platform: 'Medium',     label: 'Medium' },
  { icon: 'fa-globe',         platform: 'Website',    label: 'Website / Other' },
];
const faClass = (icon: string) => `${icon === 'fa-globe' ? 'fas' : 'fab'} ${icon}`;

const PRESET_COLORS = ['#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#10b981', '#0ea5e9', '#18181b', '#312e81', '#065f46'];

interface SettingsAccount {
  id: string;
  name: string;
  type: 'BANK' | 'MOBILE_WALLET' | 'CASH';
  currency: string;
  color: string | null;
  icon: string | null;
  image: string | null;
  notes: string | null;
  balance: number;
}

const today = () => new Date().toISOString().split("T")[0];
const emptyTransfer = () => ({ fromAccountId: "", toAccountId: "", amount: "", note: "", date: today() });
const emptyDeposit = (accountId = "") => ({ accountId, amount: "", category: "OWNER_INVESTMENT", description: "", date: today() });
const accountIcon = (type: string) => type === "BANK" ? Building2 : type === "MOBILE_WALLET" ? Smartphone : Banknote;
const isValidAmount = (amount: string) => !!amount && parseFloat(amount) > 0;
const errMsg = (err: unknown) => (err as Error)?.message;

const bumpVersion = (current: string | undefined, type: 'major' | 'minor' | 'patch') => {
  const [major, minor, patch] = (current || '1.0.0').split('.').map(Number);
  if (type === 'major') return `${major + 1}.0.0`;
  if (type === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

function SecretInput(props: ComponentProps<typeof Input>) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input {...props} type={show ? 'text' : 'password'} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow(s => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Section({ title, description, body, children }: { title: ReactNode; description: string; body: string; children: ReactNode }) {
  return (
    <Card className="shadow-card border-border overflow-hidden">
      <CardHeader className="bg-muted/30 border-b pb-6">
        <CardTitle className={typeof title === "string" ? "font-display text-xl" : "font-display text-xl flex items-center gap-2"}>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className={body}>{children}</CardContent>
    </Card>
  );
}

function Field({ id, icon: Icon, label, children }: { id: string; icon: LucideIcon; label: string; children: ReactNode }) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id} className="font-semibold flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" /> {label}
      </Label>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();
  const { canManage } = usePermissions();
  const canManageUsers = canManage('users');
  const navigate = useNavigate();
  const { settings, updateSettings, fetchSettings, uploadFile } = useAgencyStore();
  const [formData, setFormData] = useState<AgencySettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [showTestEmailDialog, setShowTestEmailDialog] = useState(false);
  const [testEmailTarget, setTestEmailTarget] = useState('');
  const [webhookUrlCopied, setWebhookUrlCopied] = useState(false);
  const [emailHealth, setEmailHealth] = useState<{ canSend: boolean; canReceive: boolean; webhookUrl: string } | null>(null);
  const [backups, setBackups] = useState<{ filename: string; size: number; createdAt: string }[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isUploadingToDrive, setIsUploadingToDrive] = useState<string | null>(null);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const fail = (title: string, err: unknown, fallback: string) =>
    toast({ title, description: errMsg(err) || fallback, variant: "destructive" });

  const handleTestAiConnection = async () => {
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      await updateSettings(formData);
      const res = await apiFetch<{ success: boolean; reply?: string; error?: string }>('/ai/test-connection', { method: 'POST' });
      if (res.success) {
        setAiTestResult({ success: true, message: `Successfully connected! Active AI says: "${res.reply}"` });
        toast({ title: "Connection Successful", description: "AI Integration is working properly." });
      } else {
        setAiTestResult({ success: false, message: res.error || "Connection failed." });
      }
    } catch (err) {
      setAiTestResult({ success: false, message: errMsg(err) || "An unexpected error occurred." });
      fail("Connection Failed", err, "Please check your API credentials.");
    } finally {
      setIsTestingAi(false);
    }
  };

  const fetchEmailHealth = async () => {
    try {
      const res = await apiFetch<{ canSend: boolean; canReceive: boolean; webhookUrl: string }>('/settings/email');
      setEmailHealth({ canSend: !!res.canSend, canReceive: !!res.canReceive, webhookUrl: res.webhookUrl });
    } catch {
      // Non-admin or offline — checklist falls back to form fields.
    }
  };

  const fetchBackups = async () => {
    setLoadingBackups(true);
    try {
      const res = await apiFetch<{ backups: typeof backups }>('/settings/backups');
      setBackups(res.backups);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingBackups(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await apiFetch<{ success: boolean; filename: string; uploadedToGDrive?: boolean; uploadError?: string }>('/settings/backups', { method: 'POST' });
      if (res.success) {
        toast({
          title: "Backup Complete",
          description: `Backup ${res.filename} created successfully.${res.uploadedToGDrive ? ' Auto-uploaded to Google Drive.' : ''}`,
        });
        if (res.uploadError) toast({ title: "Google Drive Upload Failed", description: res.uploadError, variant: "destructive" });
        fetchBackups();
      }
    } catch (err) {
      fail("Backup Failed", err, "Could not trigger database backup.");
    } finally {
      setIsBackingUp(false);
    }
  };

  const handleDeleteBackup = async (filename: string) => {
    try {
      await apiFetch(`/settings/backups/${filename}`, { method: 'DELETE' });
      toast({ title: "Backup Deleted", description: `Successfully deleted ${filename}.` });
      fetchBackups();
    } catch (err) {
      fail("Delete Failed", err, "Could not delete backup file.");
    }
  };

  const handleUploadBackupToGDrive = async (filename: string) => {
    setIsUploadingToDrive(filename);
    try {
      const res = await apiFetch<{ success: boolean; fileId: string }>(`/settings/backups/${filename}/upload-gdrive`, { method: 'POST' });
      if (res.success) toast({ title: "Upload Successful", description: `Backup uploaded to Google Drive. File ID: ${res.fileId}` });
    } catch (err) {
      fail("Upload Failed", err, "Could not upload backup to Google Drive.");
    } finally {
      setIsUploadingToDrive(null);
    }
  };

  const handleRestoreBackup = async (filename: string) => {
    if (!window.confirm(
      "⚠️ WARNING: Restoring this backup will completely overwrite your current database. This action cannot be undone. Are you sure you want to continue?"
    )) return;

    setIsRestoring(filename);
    try {
      const res = await apiFetch<{ success: boolean }>(`/settings/backups/${filename}/restore`, { method: 'POST' });
      if (res.success) {
        toast({ title: "Restore Complete ✓", description: `Database successfully restored from backup ${filename}.` });
        fetchSettings();
      }
    } catch (err) {
      fail("Restore Failed", err, "Could not restore database from backup.");
    } finally {
      setIsRestoring(null);
    }
  };

  const queryParams = new URLSearchParams(window.location.search);
  const tabParam = queryParams.get("tab");
  const [activeTab, setActiveTab] = useState(tabParam || "general");
  const isLandingEditor = activeTab === "landing-page";

  // Google Drive OAuth redirect lands here with ?code=
  useEffect(() => {
    const code = queryParams.get("code");
    if (!code) return;
    const clearCode = () => {
      queryParams.delete("code");
      window.history.replaceState({}, '', `${window.location.pathname}?${queryParams.toString()}`);
    };
    apiFetch<{ success: boolean }>('/settings/backups/gdrive-oauth-callback', {
      method: 'POST',
      body: JSON.stringify({ code, redirectUri: window.location.origin + "/dashboard/settings" }),
    }).then(res => {
      if (!res.success) return;
      toast({ title: "Google Drive Authorized", description: "Successfully connected to Google Drive using your account!" });
      setActiveTab("plugins");
      queryParams.set("tab", "plugins");
      clearCode();
      fetchSettings();
    }, err => {
      fail("Authorization Failed", err, "Failed to exchange Google OAuth code.");
      clearCode();
    });
  }, []);

  useEffect(() => {
    if (tabParam) setActiveTab(tabParam);
  }, [tabParam]);

  useEffect(() => {
    if (activeTab === 'backups') fetchBackups();
  }, [activeTab]);

  // Email Templates state
  const [emailTemplates, setEmailTemplates] = useState<EmailTemplate[]>(DEFAULT_EMAIL_TEMPLATES);
  const [activeTemplateId, setActiveTemplateId] = useState<string>(DEFAULT_EMAIL_TEMPLATES[0].id);
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const activeTemplate = emailTemplates.find(t => t.id === activeTemplateId) ?? emailTemplates[0];

  const updateActiveTemplate = (fields: Partial<Pick<EmailTemplate, 'subject' | 'body'>>) =>
    setEmailTemplates(prev => prev.map(t => t.id === activeTemplateId ? { ...t, ...fields } : t));

  const handleSaveTemplate = async () => {
    setIsSavingTemplate(true);
    // ponytail: templates are not persisted (no backend endpoint yet) — edits live until reload.
    await new Promise(r => setTimeout(r, 600));
    setIsSavingTemplate(false);
    toast({ title: 'Template saved', description: `"${activeTemplate.name}" has been updated.` });
  };

  // Version control state
  const [newVersionEntry, setNewVersionEntry] = useState<Omit<VersionEntry, 'date'>>({ version: '', description: '', author: '' });
  const [bumpType, setBumpType] = useState<'major' | 'minor' | 'patch'>('patch');
  const [showAddVersion, setShowAddVersion] = useState(false);
  const bumpedVersion = bumpVersion(formData.appVersion, bumpType);
  const closeAddVersion = () => { setShowAddVersion(false); setNewVersionEntry({ version: '', description: '', author: '' }); };

  // Financial Accounts state
  const [settingsAccounts, setSettingsAccounts] = useState<SettingsAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Partial<SettingsAccount> | null>(null);
  const [transferPayload, setTransferPayload] = useState<ReturnType<typeof emptyTransfer> | null>(null);
  const [depositPayload, setDepositPayload] = useState<ReturnType<typeof emptyDeposit> | null>(null);
  const openNewAccount = () => setEditingAccount({ name: "", type: "BANK", currency: "USD", notes: "" });

  const fetchSettingsAccounts = async () => {
    setLoadingAccounts(true);
    try {
      const res = await apiFetch<{ accounts: SettingsAccount[] }>("/accounts");
      setSettingsAccounts(res.accounts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingAccounts(false);
    }
  };

  const saveAccount = async () => {
    if (!editingAccount?.name?.trim()) {
      toast({ title: "Account name is required", variant: "destructive" });
      return;
    }
    try {
      await apiFetch(editingAccount.id ? `/accounts/${editingAccount.id}` : "/accounts", {
        method: editingAccount.id ? "PUT" : "POST",
        body: JSON.stringify(editingAccount),
      });
      toast({ title: editingAccount.id ? "Account updated successfully" : "Account created successfully" });
      setEditingAccount(null);
      fetchSettingsAccounts();
    } catch {
      toast({ title: "Failed to save account", variant: "destructive" });
    }
  };

  const archiveAccount = async (id: string) => {
    if (!window.confirm("Archive this account?")) return;
    try {
      await apiFetch(`/accounts/${id}`, { method: "DELETE" });
      toast({ title: "Account archived successfully" });
      fetchSettingsAccounts();
    } catch {
      toast({ title: "Failed to archive account", variant: "destructive" });
    }
  };

  const submitTransfer = async () => {
    const { fromAccountId, toAccountId, amount, note, date } = transferPayload!;
    if (!fromAccountId || !toAccountId) return toast({ title: "Please select both accounts", variant: "destructive" });
    if (fromAccountId === toAccountId) return toast({ title: "Source and destination accounts must be different", variant: "destructive" });
    if (!isValidAmount(amount)) return toast({ title: "Please enter a valid amount", variant: "destructive" });
    try {
      await apiFetch("/accounts/transfer", {
        method: "POST",
        body: JSON.stringify({ fromAccountId, toAccountId, amount: parseFloat(amount), note, date: new Date(date).toISOString() }),
      });
      toast({ title: "Transfer completed successfully!" });
      setTransferPayload(null);
      fetchSettingsAccounts();
    } catch {
      toast({ title: "Transfer failed", variant: "destructive" });
    }
  };

  const submitDeposit = async () => {
    const { accountId, amount, category, description, date } = depositPayload!;
    if (!accountId) return toast({ title: "Please select an account", variant: "destructive" });
    if (!isValidAmount(amount)) return toast({ title: "Please enter a valid amount", variant: "destructive" });
    try {
      await apiFetch("/accounts/deposit", {
        method: "POST",
        body: JSON.stringify({ accountId, amount: parseFloat(amount), category, description, date: new Date(date).toISOString() }),
      });
      toast({ title: "Deposit recorded successfully!" });
      setDepositPayload(null);
      fetchSettingsAccounts();
    } catch {
      toast({ title: "Failed to record deposit", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchSettingsAccounts();
    fetchEmailHealth();
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const fileInputs = useRef<Partial<Record<ImageKey, HTMLInputElement | null>>>({});
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast({ title: "Settings Saved", description: "Your agency preferences have been updated successfully." });
    } catch {
      toast({ title: "Save Failed", description: "There was an error saving your settings. Please try again.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({
      ...prev,
      [id]: type === 'number' ? (value === '' ? null : parseFloat(value)) : value
    }));
  };

  // Persisted (pre-fetch) settings may still hold the legacy object shape.
  const socialLinks = (s: AgencySettings): SocialLink[] => Array.isArray(s.socialLinks) ? s.socialLinks : [];
  const setSocialLinks = (fn: (links: SocialLink[]) => SocialLink[]) =>
    setFormData(prev => ({ ...prev, socialLinks: fn(socialLinks(prev)) }));

  const updateSocialLink = (id: string, field: keyof SocialLink, value: string) =>
    setSocialLinks(links => links.map(s => s.id !== id ? s : field === 'icon'
      ? { ...s, icon: value, platform: SOCIAL_ICON_OPTIONS.find(o => o.icon === value)?.platform || s.platform }
      : { ...s, [field]: value }));

  const addSocialLink = () =>
    setSocialLinks(links => [...links, { id: crypto.randomUUID(), platform: 'Facebook', icon: 'fa-facebook-f', url: '' }]);

  const tooLarge = (file: File) => {
    if (file.size <= 5 * 1024 * 1024) return false;
    toast({ title: "File too large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
    return true;
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: ImageKey) => {
    const file = e.target.files?.[0];
    if (!file || tooLarge(file)) return;
    setIsUploading(prev => ({ ...prev, [key]: true }));
    setUploadProgress(prev => ({ ...prev, [key]: 0 }));
    try {
      const url = await uploadFile(file, progress => setUploadProgress(prev => ({ ...prev, [key]: progress })), key === 'signature' || key === 'stamp');
      setFormData(prev => ({ ...prev, [key]: url }));
      toast({ title: "Upload Successful", description: "Your image has been uploaded to the server." });
    } catch {
      toast({ title: "Upload Failed", description: "There was an error uploading your image. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(prev => ({ ...prev, [key]: false }));
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
    }
  };

  const setPaymentMethods = (fn: (methods: PaymentMethod[]) => PaymentMethod[]) =>
    setFormData(prev => ({ ...prev, paymentMethods: fn(prev.paymentMethods || []) }));

  const handlePaymentMethodChange = <K extends keyof PaymentMethod>(id: string, field: K, value: PaymentMethod[K]) =>
    setPaymentMethods(methods => methods.map(m => m.id === id ? { ...m, [field]: value } : m));

  const handlePaymentMethodImageChange = async (id: string, file: File) => {
    if (tooLarge(file)) return;
    try {
      handlePaymentMethodChange(id, 'image', await uploadFile(file));
      toast({ title: "Upload Successful", description: "Payment method image has been updated." });
    } catch {
      toast({ title: "Upload Failed", description: "There was an error uploading the image. Please try again.", variant: "destructive" });
    }
  };

  const removeImage = (e: React.MouseEvent, key: ImageKey) => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, [key]: '' }));
  };

  const sendTestEmail = async () => {
    setIsTestingEmail(true);
    setEmailStatus('idle');
    try {
      await apiFetch('/settings/email/test', { method: 'POST', body: JSON.stringify({ to: testEmailTarget }) });
      setEmailStatus('success');
      setShowTestEmailDialog(false);
      toast({ title: 'Test email sent!', description: `Delivery confirmation sent to ${testEmailTarget}. Check your inbox.` });
    } catch (err) {
      setEmailStatus('error');
      fail('Test failed', err, 'Check your API key and sender address.');
    } finally {
      setIsTestingEmail(false);
    }
  };

  const saveMailConfig = async () => {
    setIsSaving(true);
    try {
      const hasApiKey = formData.resendApiKey?.startsWith('re_');
      const hasWebhook = formData.resendWebhookSecret?.startsWith('whsec_');
      const shouldEnable = formData.mailEnabled || (hasApiKey && !!formData.emailFrom);

      await updateSettings({
        mailerName: formData.mailerName || '',
        resendApiKey: formData.resendApiKey || '',
        resendWebhookSecret: formData.resendWebhookSecret || '',
        resendInboundDomain: formData.resendInboundDomain || '',
        emailFrom: formData.emailFrom || '',
        mailEnabled: shouldEnable,
      });

      // Sync into process.env immediately via the dedicated email endpoint (undefined keys are dropped).
      if (hasApiKey || hasWebhook || formData.emailFrom) {
        await apiFetch('/settings/email', {
          method: 'POST',
          body: JSON.stringify({
            resendApiKey: hasApiKey ? formData.resendApiKey : undefined,
            emailFrom: formData.emailFrom || undefined,
            mailerName: formData.mailerName || undefined,
            resendWebhookSecret: hasWebhook ? formData.resendWebhookSecret : undefined,
            resendInboundDomain: formData.resendInboundDomain || undefined,
            mailEnabled: shouldEnable,
          }),
        });
      }

      if (shouldEnable && !formData.mailEnabled) setFormData(p => ({ ...p, mailEnabled: true }));
      await fetchEmailHealth();

      toast({
        title: 'Mail config saved',
        description: hasWebhook
          ? 'Send + receive credentials updated. Inbound webhooks can now be verified.'
          : 'Send credentials updated. Add a webhook secret to receive mail in Email Center.',
      });
    } catch (err) {
      fail('Save failed', err, 'Please check your settings and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const copyWebhookUrl = async () => {
    try {
      await navigator.clipboard.writeText(webhookUrl);
      setWebhookUrlCopied(true);
      setTimeout(() => setWebhookUrlCopied(false), 2000);
    } catch {
      toast({ title: 'Copy failed', description: 'Copy the URL manually.', variant: 'destructive' });
    }
  };

  // Mail readiness checklist
  const canSend = emailHealth?.canSend ?? !!(formData.resendApiKey?.startsWith('re_') && formData.emailFrom?.includes('@'));
  const canReceive = emailHealth?.canReceive ?? !!formData.resendWebhookSecret?.startsWith('whsec_');
  const inboundDomain = formData.resendInboundDomain || (formData.emailFrom?.includes('@') ? formData.emailFrom.split('@')[1] : '');
  const webhookUrl = emailHealth?.webhookUrl || 'https://api.yourdomain.com/api/email/webhooks/resend';

  const tabs = TABS.filter(t => t.value !== 'users' || canManageUsers);
  const accountOptions = settingsAccounts.map(acc => {
    const AccIcon = accountIcon(acc.type);
    return (
      <SelectItem key={acc.id} value={acc.id}>
        <div className="flex items-center gap-2">
          {acc.image ? (
            <img src={acc.image} alt={acc.name} className="h-5 w-5 rounded-full object-cover shrink-0" />
          ) : (
            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <AccIcon className="h-3 w-3" />
            </div>
          )}
          <span>{acc.name}</span>
        </div>
      </SelectItem>
    );
  });

  return (
    <div className={`animate-in fade-in duration-500 ${isLandingEditor ? "w-full" : "max-w-[1400px]"}`}>
      {/* Page Header */}
      {!isLandingEditor && (
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your agency portal and branding preferences</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-white px-8 h-11 transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>
      )}

      <Tabs value={activeTab} onValueChange={(val) => { setActiveTab(val); navigate(`/dashboard/settings?tab=${val}`, { replace: true }); }} className="w-full">
        {/* ── Mobile: horizontal scrollable tab bar ── */}
        {!isLandingEditor && (
        <TabsList className="lg:hidden bg-muted/50 p-1 mb-6 flex overflow-x-auto whitespace-nowrap scrollbar-none justify-start border border-border/50 rounded-xl w-full">
          {tabs.map(t => (
            <TabsTrigger key={t.value} value={t.value} className={`gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0 ${t.tone ? TONES[t.tone][0] : ''}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.short}
            </TabsTrigger>
          ))}
        </TabsList>
        )}

        {/* ── Desktop: sidebar + content flex wrapper ── */}
        <div className={isLandingEditor ? "" : "lg:flex lg:gap-8 lg:items-start"}>

        {/* ── Desktop sidebar (hidden on mobile) ── */}
        {!isLandingEditor && (
        <div className="hidden lg:block lg:w-[260px] lg:shrink-0">
          <div className="sticky top-20 space-y-3">
            {/* Agency Info Card */}
            <div className="rounded-2xl border border-border bg-card p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md"
                  style={{ backgroundColor: formData.primaryColor || '#3b82f6' }}
                >
                  {formData.agencyName?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{formData.agencyName || 'Your Agency'}</p>
                  <p className="text-xs text-muted-foreground truncate">{formData.adminEmail || 'admin@example.com'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>v{formData.appVersion || '1.0.0'} — Active</span>
              </div>
            </div>

            {GROUPS.map((group, gi) => (
              <Fragment key={group}>
                {gi > 0 && <div className="h-px bg-border/50 mx-3" />}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">{group}</p>
                  <TabsList className="flex flex-col w-full bg-transparent p-0 gap-0.5 h-auto">
                    {tabs.filter(t => t.group === gi).map(t => (
                      <TabsTrigger
                        key={t.value}
                        value={t.value}
                        className={`w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl ${t.tone && !t.plainSide ? TONES[t.tone][1] : 'data-[state=active]:bg-primary/10 data-[state=active]:text-primary'} data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold`}
                      >
                        <t.icon className="h-4 w-4 shrink-0" />
                        <span>{t.label}</span>
                        {t.badge && t.tone && (
                          <span className={`ml-auto text-[9px] font-bold ${TONES[t.tone][2]} px-1.5 py-0.5 rounded-full uppercase tracking-wider`}>{t.badge}</span>
                        )}
                      </TabsTrigger>
                    ))}
                  </TabsList>
                </div>
              </Fragment>
            ))}
          </div>
        </div>
        )}

        {/* ── Tab content area (visible on all screen sizes) ── */}
        <div className={isLandingEditor ? "w-full" : "lg:flex-1 lg:min-w-0"}>

        <TabsContent value="general" className="mt-0 outline-none space-y-6">
          <Section title="General Information" description="Basic information about your agency and contact details." body="p-8">
            <div className="grid md:grid-cols-2 gap-8">
              {GENERAL_FIELDS.map((column, ci) => (
                <div key={ci} className="space-y-6">
                  {column.map(f => (
                    <Field key={f.id} id={f.id} icon={f.icon} label={f.label}>
                      <Input id={f.id} type={f.type} value={formData[f.id]} onChange={handleInputChange} placeholder={f.placeholder} className="h-11 focus-visible:ring-primary" />
                    </Field>
                  ))}
                </div>
              ))}
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="branding" className="mt-0 outline-none space-y-6">
          <Section title="Identity & Branding" description="Customize your logos, icons and primary colors." body="p-8 space-y-10">
            {IMAGE_SLOTS.map(({ key }) => (
              <input key={key} type="file" ref={el => { fileInputs.current[key] = el; }} onChange={(e) => handleFileChange(e, key)} accept="image/*" className="hidden" />
            ))}

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
              {IMAGE_SLOTS.map(({ key, label, alt, icon: SlotIcon, noun, empty, hint }) => {
                const dark = key === 'whiteLogo';
                const progress = uploadProgress[key] || 0;
                return (
                  <div key={key} className="space-y-4">
                    <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">{label}</Label>
                    <div
                      className={`group relative border border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-4 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg active:scale-[0.98] ${dark ? 'border-slate-700/50 bg-slate-900 group-hover:border-white/30 hover:shadow-slate-900/40' : 'border-border bg-muted/20 group-hover:border-primary/50 hover:bg-muted/30'}`}
                      onClick={() => fileInputs.current[key]?.click()}
                    >
                      {isUploading[key] ? (
                        <div className="flex flex-col items-center gap-2 w-full px-8">
                          <div className="flex items-center gap-2">
                            <Loader2 className={`h-5 w-5 animate-spin ${dark ? 'text-white' : 'text-primary'}`} />
                            <span className={`text-sm font-bold ${dark ? 'text-white' : 'text-primary'}`}>{progress}%</span>
                          </div>
                          <Progress value={progress} className={dark ? "h-1.5 w-full bg-white/20" : "h-1.5 w-full"} />
                          <p className={`text-[10px] items-center uppercase font-bold tracking-widest mt-1 ${dark ? 'text-white/70' : 'text-muted-foreground'}`}>Uploading {noun}...</p>
                        </div>
                      ) : formData[key] && key === 'favicon' ? (
                        <div className="relative w-20 h-20 flex items-center justify-center">
                          <ProtectedBrandingImage src={formData.favicon} alt={alt} className="w-full h-full object-contain rounded-lg shadow-sm" />
                          <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg gap-2">
                            <Upload className="h-4 w-4 text-primary" />
                            <X className="h-4 w-4 text-destructive" onClick={(e) => removeImage(e, key)} />
                          </div>
                        </div>
                      ) : formData[key] ? (
                        <div className="relative w-full h-full flex items-center justify-center p-4">
                          <ProtectedBrandingImage src={formData[key]} alt={alt} className={dark ? "max-h-full object-contain" : "max-h-full object-contain drop-shadow-sm"} />
                          <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2 ${dark ? 'bg-slate-800/80 text-white' : 'bg-background/80'}`}>
                            <Button variant="secondary" size="sm" className={dark ? "gap-2 bg-white/10 text-white hover:bg-white/20" : "gap-2 shadow-sm"}>
                              <Upload className="h-4 w-4" /> Change
                            </Button>
                            <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => removeImage(e, key)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className={`p-3 rounded-full shadow-sm border group-hover:scale-110 transition-transform ${dark ? 'bg-white/10 border-white/20' : 'bg-background border-border'}`}>
                            <SlotIcon className={`h-6 w-6 ${dark ? 'text-white/70' : 'text-muted-foreground'}`} />
                          </div>
                          <div className="text-center">
                            <p className={`text-sm font-medium ${dark ? 'text-white' : ''}`}>{empty}</p>
                            <p className={`text-xs mt-1 ${dark ? 'text-white/50' : 'text-muted-foreground'}`}>{hint}</p>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <Separator />

            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <Label className="text-xl font-bold flex items-center gap-2">
                    <Palette className="h-5 w-5 text-primary" /> Primary Theme Color
                  </Label>
                  <p className="text-sm text-muted-foreground">This color will be used for buttons, links, and highlights.</p>
                </div>
                <div className="flex items-center gap-4 bg-muted/30 p-2.5 pl-4 rounded-2xl border border-border/50 self-start md:self-center shadow-sm">
                  <input
                    type="color"
                    ref={colorInputRef}
                    value={formData.primaryColor || '#3b82f6'}
                    onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                    className="sr-only"
                  />
                  <div
                    className="h-12 w-12 rounded-xl shadow-md flex items-center justify-center ring-4 ring-background cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 group relative"
                    style={{ backgroundColor: formData.primaryColor }}
                    onClick={() => colorInputRef.current?.click()}
                  >
                    <Check className="h-5 w-5 text-white drop-shadow-sm" />
                    <div className="absolute -top-1 -right-1 bg-primary text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Edit</div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <Label htmlFor="primaryColorInput" className="text-[10px] items-center font-bold text-muted-foreground uppercase tracking-widest px-0.5 flex gap-1">
                      <Palette className="h-2.5 w-2.5" /> Hex Code
                    </Label>
                    <div className="relative">
                      <Input
                        id="primaryColorInput"
                        value={formData.primaryColor}
                        onChange={(e) => {
                          const val = e.target.value;
                          setFormData(prev => ({ ...prev, primaryColor: val && !val.startsWith('#') ? '#' + val : val }));
                        }}
                        placeholder="#000000"
                        className="font-mono text-base font-bold border-none h-8 px-0.5 focus-visible:ring-0 bg-transparent uppercase w-28 tracking-wider"
                      />
                      <div className="absolute bottom-1 left-0.5 right-0 h-[1px] bg-primary/20"></div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {PRESET_COLORS.map(color => (
                  <button
                    key={color}
                    onClick={() => setFormData(prev => ({ ...prev, primaryColor: color }))}
                    className={`h-12 w-12 rounded-xl transition-all duration-300 border-2 flex items-center justify-center ${formData.primaryColor === color ? 'border-primary shadow-xl scale-125 ring-4 ring-primary/20 z-10' : 'border-transparent hover:scale-110 hover:border-border'}`}
                    style={{ backgroundColor: color }}
                  >
                    {formData.primaryColor === color && <Check className="h-6 w-6 text-white drop-shadow-sm" />}
                  </button>
                ))}
              </div>
            </div>
          </Section>

          {/* Site Availability & Analytics */}
          <Section
            title={<><Globe className="h-5 w-5 text-primary" /> Landing Page &amp; SEO Configuration</>}
            description="Control your landing page visibility, coming soon page, and search engine indexation."
            body="p-8 space-y-6"
          >
            <div className="flex items-start justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
              <div className="space-y-1 pr-4">
                <p className="font-bold flex items-center gap-2 text-foreground">
                  <Shield className="h-4 w-4 text-primary" /> Development Mode (Coming Soon Page)
                </p>
                <p className="text-sm text-muted-foreground max-w-xl">
                  When enabled, visitors will see a Coming Soon page. Google and other search engines will be instructed not to index your website (using robots noindex tag).
                </p>
              </div>
              <Switch
                checked={formData.developmentMode}
                onCheckedChange={(val) => setFormData(prev => ({ ...prev, developmentMode: val }))}
                className="data-[state=checked]:bg-primary"
              />
            </div>

            <div className="grid gap-4 border p-6 rounded-2xl bg-muted/20">
              <div className="grid gap-2">
                <Label htmlFor="comingSoonMessage" className="font-semibold text-sm">Coming Soon Message</Label>
                <Textarea
                  id="comingSoonMessage"
                  value={formData.comingSoonMessage || ''}
                  onChange={handleInputChange}
                  placeholder="We're currently working on something amazing. Check back soon!"
                  className="min-h-[100px] bg-background focus-visible:ring-primary"
                />
                <p className="text-xs text-muted-foreground">This message will be prominently displayed on the Coming Soon screen.</p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comingSoonCountdown" className="font-semibold text-sm">Launch Countdown Target Date</Label>
                <Input
                  type="datetime-local"
                  id="comingSoonCountdown"
                  value={formData.comingSoonCountdown || ''}
                  onChange={handleInputChange}
                  className="bg-background focus-visible:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Set the target date and time when the website goes live. The Coming Soon page will display a countdown timer.
                </p>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comingSoonBullets" className="font-semibold text-sm">Coming Soon Page Bullet Points (Features)</Label>
                <Textarea
                  id="comingSoonBullets"
                  value={formData.comingSoonBullets || ''}
                  onChange={handleInputChange}
                  placeholder="Full-Service Digital Marketing, Data-Driven Strategy, Premium Brand Identity, Targeted Campaign Management"
                  className="min-h-[80px] bg-background focus-visible:ring-primary"
                />
                <p className="text-xs text-muted-foreground">
                  Enter key features or marketing bullet points for your coming soon page, separated by commas.
                </p>
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="localization" className="mt-0 outline-none space-y-6">
          <Section title="Localization & Regions" description="Setup your regional preferences for numbers and dates." body="p-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8 border-b pb-8">
              <div className="space-y-6">
                <Field id="timezone" icon={Clock} label="Default Timezone (Country based)">
                  <Select value={formData.timezone} onValueChange={(val) => setFormData(prev => ({ ...prev, timezone: val }))}>
                    <SelectTrigger className="h-12 focus:ring-primary bg-background">
                      <SelectValue placeholder="Select timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {timezones.map(group => (
                        <SelectGroup key={group.group}>
                          <SelectLabel className="text-primary font-bold px-2 py-1.5 uppercase text-[10px] tracking-widest">{group.group}</SelectLabel>
                          {group.zones.map(zone => (
                            <SelectItem key={zone.value} value={zone.value} className="pl-4">{zone.label}</SelectItem>
                          ))}
                        </SelectGroup>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>

              <div className="space-y-6">
                <Field id="currency" icon={Globe} label="Base Currency">
                  <Select value={formData.currency} onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}>
                    <SelectTrigger className="h-12 focus:ring-primary bg-background">
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map(curr => (
                        <SelectItem key={curr.value} value={curr.value}>
                          <span className="font-bold mr-2">{curr.symbol}</span> {curr.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
            </div>

            <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
              <div className="flex items-start gap-4">
                <div className="p-2 bg-primary/20 rounded-lg text-primary">
                  <Check className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-bold text-lg text-primary">Universal Formatting Active</h4>
                  <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                    Changes made here will apply **universally** across the entire Hirdan Marketing system.
                    All dashboards, invoices, and reports will automatically use **{formData.currency}** formatting
                    and the **{formData.timezone}** timezone.
                  </p>
                </div>
              </div>
            </div>
          </Section>
        </TabsContent>

        <TabsContent value="billing" className="mt-0 outline-none space-y-6">
          <Section title="Billing & Tax Configuration" description="Configure default tax rates and invoice settings." body="p-8 space-y-8">
            <div className="grid md:grid-cols-2 gap-8">
              <div className="space-y-6">
                <Field id="taxRate" icon={Percent} label="Default Tax Rate (%)">
                  <Input id="taxRate" type="number" value={formData.taxRate} onChange={handleInputChange} className="h-11 focus-visible:ring-primary" />
                </Field>
              </div>
            </div>

            <Field id="defaultInvoiceNotes" icon={FileText} label="Default Invoice Notes">
              <Textarea
                id="defaultInvoiceNotes"
                value={formData.defaultInvoiceNotes}
                onChange={handleInputChange}
                rows={4}
                className="resize-none focus-visible:ring-primary rounded-xl"
                placeholder="Terms, payment methods, or a thank you note..."
              />
            </Field>
          </Section>
        </TabsContent>

        <TabsContent value="payments" className="mt-0 outline-none space-y-4">
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/20 border-b py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Payment Gateways</CardTitle>
                <CardDescription className="text-xs">Manage your agency's payment methods.</CardDescription>
              </div>
              <Button
                onClick={() => setPaymentMethods(methods => [...methods, { id: Math.random().toString(36).substr(2, 9), name: 'New Payment Method', type: 'other', details: '', isActive: true }])}
                variant="outline"
                size="sm"
                className="gap-2 h-8 text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5"
              >
                <Plus className="h-3.5 w-3.5 text-primary" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="grid gap-3">
                {formData.paymentMethods.length === 0 ? (
                  <div className="text-center py-8 bg-muted/10 border border-dashed rounded-xl">
                    <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground">No payment methods added yet.</p>
                  </div>
                ) : (
                  formData.paymentMethods.map((method) => (
                    <div
                      key={method.id}
                      className={`group border rounded-xl p-4 transition-all duration-200 ${method.isActive ? 'bg-background hover:shadow-sm' : 'bg-muted/20 opacity-60'}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="relative group shrink-0">
                              {method.image ? (
                                <img src={method.image} className="h-10 w-10 rounded-lg object-cover border" alt={method.name} />
                              ) : (
                                <div className={`p-2.5 rounded-lg ${
                                  method.type === 'stripe' ? 'bg-indigo-50 text-indigo-500' :
                                  method.type === 'paypal' ? 'bg-blue-50 text-blue-500' :
                                  method.type === 'bank' ? 'bg-emerald-50 text-emerald-500' :
                                  'bg-slate-50 text-slate-500'
                                }`}>
                                  {method.type === 'bank' ? <Briefcase className="h-4 w-4" /> : method.type === 'other' ? <HelpCircle className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
                                </div>
                              )}
                              <label className="absolute inset-0 bg-black/60 flex flex-col items-center justify-center rounded-lg cursor-pointer opacity-0 group-hover:opacity-100 transition-opacity">
                                <Upload className="h-3.5 w-3.5 text-white mb-0.5" />
                                <span className="text-[8px] text-white font-bold uppercase tracking-wider">Logo</span>
                                <input
                                  type="file"
                                  accept="image/*"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handlePaymentMethodImageChange(method.id, file);
                                  }}
                                />
                              </label>
                              {method.image && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handlePaymentMethodChange(method.id, 'image', '');
                                  }}
                                  className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Remove image"
                                >
                                  <Trash2 className="h-2.5 w-2.5" />
                                </button>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Input
                                value={method.name}
                                onChange={(e) => handlePaymentMethodChange(method.id, 'name', e.target.value)}
                                className="font-bold text-base border-none p-0 focus-visible:ring-0 bg-transparent h-auto"
                                placeholder="Method Name"
                              />
                              <div className="flex items-center gap-2 mt-0.5">
                                <Select value={method.type} onValueChange={(val) => handlePaymentMethodChange(method.id, 'type', val as PaymentMethod['type'])}>
                                  <SelectTrigger className="h-6 w-fit text-[9px] uppercase tracking-wider font-bold bg-muted/30 border-none shadow-none focus:ring-0 px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="stripe">Stripe</SelectItem>
                                    <SelectItem value="paypal">PayPal</SelectItem>
                                    <SelectItem value="bank">Bank Transfer</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                {method.isActive ? (
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Active</span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">Hidden</span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Payment Instructions</Label>
                            <Textarea
                              value={method.details}
                              onChange={(e) => handlePaymentMethodChange(method.id, 'details', e.target.value)}
                              placeholder="Enter details..."
                              className="min-h-[60px] bg-muted/5 border-muted-foreground/10 focus:border-primary/20 transition-all rounded-lg text-xs leading-relaxed"
                            />
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center gap-2 shrink-0">
                          <div className="flex items-center gap-2 bg-muted/30 p-1 px-2 rounded-lg border">
                            <span className="text-[9px] font-bold text-muted-foreground">{method.isActive ? 'ON' : 'OFF'}</span>
                            <Switch
                              checked={method.isActive}
                              onCheckedChange={(val) => handlePaymentMethodChange(method.id, 'isActive', val)}
                              className="data-[state=checked]:bg-primary h-4 w-8"
                            />
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setPaymentMethods(methods => methods.filter(m => m.id !== method.id))}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mt-6 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 opacity-70" />
                <div>
                  <h4 className="font-bold text-sm text-primary">Instructions Visibility</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    These details appear on client invoices and portal. **Do not share secret keys here.**
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl">Social Media Links</CardTitle>
                  <CardDescription>Add the social profiles you want displayed on your landing page and Coming Soon page.</CardDescription>
                </div>
                <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={addSocialLink}>
                  <Plus className="h-3.5 w-3.5" /> Add Social
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-8">
              {socialLinks(formData).length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center border-2 border-dashed border-border rounded-2xl gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                    <Link className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <p className="font-semibold text-sm">No social links yet</p>
                  <p className="text-xs text-muted-foreground max-w-xs">Click "Add Social" to connect your agency's social media profiles. They'll appear in the landing page footer and Coming Soon page.</p>
                  <Button type="button" variant="outline" size="sm" onClick={addSocialLink} className="mt-1 gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Social Link
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {socialLinks(formData).map((link) => (
                    <div key={link.id} className="flex items-center gap-3 p-3 rounded-xl border bg-muted/10 hover:bg-muted/20 transition-all">
                      <div className="w-10 h-10 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                        <i className={faClass(link.icon)} style={{ fontSize: '16px' }} />
                      </div>

                      <Select value={link.icon} onValueChange={(val) => updateSocialLink(link.id, 'icon', val)}>
                        <SelectTrigger className="h-10 w-[110px] sm:w-[155px] shrink-0 text-xs font-semibold focus:ring-primary">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {SOCIAL_ICON_OPTIONS.map(opt => (
                            <SelectItem key={opt.icon} value={opt.icon}>
                              <div className="flex items-center gap-2">
                                <i className={`${faClass(opt.icon)} w-4`} />
                                <span>{opt.label}</span>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>

                      <Input
                        value={link.url}
                        onChange={(e) => updateSocialLink(link.id, 'url', e.target.value)}
                        placeholder={`https://${link.platform.toLowerCase()}.com/your-page`}
                        className="flex-1 min-w-0 h-10 focus-visible:ring-primary text-sm"
                      />

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSocialLinks(links => links.filter(s => s.id !== link.id))}
                        className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg shrink-0"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 outline-none space-y-6">
          <Section title="Notifications" description="Configure how you want to be alerted about agency activities." body="p-8 space-y-4">
            {NOTIFICATIONS.map(({ key, icon: NotifIcon, title, desc }) => (
              <div key={key} className="flex items-center justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <NotifIcon className="h-4 w-4 text-primary" /> {title}
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">{desc}</p>
                </div>
                <Switch
                  checked={formData.notifications[key]}
                  onCheckedChange={(val) => setFormData(prev => ({ ...prev, notifications: { ...prev.notifications, [key]: val } }))}
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            ))}
          </Section>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-purple-500/20 overflow-hidden ring-1 ring-purple-500/10">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-transparent border-b pb-6">
              <CardTitle className="font-display text-xl text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5 animate-pulse text-purple-500" /> AI Integration
              </CardTitle>
              <CardDescription>
                Select your main AI provider and configure individual API keys. The chosen active provider will power the AI Assistant, social media plan generator, monthly report drafter, and task generator.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="space-y-3">
                <Label className="text-sm font-semibold text-foreground">Select Main AI Provider</Label>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {AI_PROVIDERS.map((p) => {
                    const isSelected = (formData.mainAiProvider || 'openai') === p.id;
                    return (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => setFormData((prev) => ({ ...prev, mainAiProvider: p.id }))}
                        className={`flex flex-col text-left p-5 rounded-2xl border transition-all duration-300 relative overflow-hidden bg-gradient-to-br ${
                          isSelected
                            ? 'border-purple-500 ring-2 ring-purple-500/20 bg-purple-50/30 dark:bg-purple-950/10 shadow-sm'
                            : 'border-border/60 hover:bg-muted/10 bg-card'
                        } ${p.color}`}
                      >
                        <div className="flex items-center gap-3 mb-2">
                          <div className={`p-2 rounded-xl border ${
                            isSelected
                              ? 'bg-purple-100 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800 dark:text-purple-300'
                              : 'bg-muted border-border/40 text-muted-foreground'
                          }`}>
                            <p.icon className="h-5 w-5" />
                          </div>
                          <span className="font-bold text-foreground">{p.name}</span>
                          {isSelected && (
                            <span className="absolute top-4 right-4 flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-purple-500"></span>
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{p.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <Separator className="bg-border/60" />

              <div className="space-y-6 max-w-xl">
                <Label className="text-sm font-semibold text-foreground">API Credentials Configuration</Label>
                {AI_KEYS.map(k => (
                  <div key={k.id} className="space-y-2">
                    <div className="flex justify-between items-center">
                      <Label htmlFor={k.id} className="font-medium text-xs text-muted-foreground uppercase tracking-wider">{k.label}</Label>
                      <a href={k.href} target="_blank" rel="noopener noreferrer" className="text-[11px] text-purple-600 hover:underline">Get key</a>
                    </div>
                    <SecretInput
                      id={k.id}
                      value={formData[k.id] || ''}
                      onChange={handleInputChange}
                      placeholder={k.placeholder}
                      className="h-11 pr-10 focus-visible:ring-purple-500 border-border/80 rounded-xl"
                    />
                  </div>
                ))}
              </div>

              <div className="pt-4 border-t border-border/40 flex flex-col md:flex-row gap-4 items-start md:items-center">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestAiConnection}
                  disabled={isTestingAi}
                  className="rounded-xl border-purple-200 text-purple-700 hover:bg-purple-50 dark:border-purple-900 dark:text-purple-300 dark:hover:bg-purple-950/20 px-6 h-11 shrink-0"
                >
                  {isTestingAi ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-purple-500" />
                      Testing API Key...
                    </>
                  ) : (
                    "Test Connection"
                  )}
                </Button>

                {aiTestResult && (
                  <div className={`text-xs px-4 py-3 rounded-xl border flex items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200 ${
                    aiTestResult.success
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/15 dark:border-emerald-900/50 dark:text-emerald-400'
                      : 'bg-destructive/10 border-destructive/20 text-destructive dark:bg-destructive/10 dark:border-destructive/25'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${aiTestResult.success ? 'bg-emerald-500' : 'bg-destructive'}`} />
                    <span className="font-medium">{aiTestResult.message}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── MAIL CONFIG ─────────── */}
        <TabsContent value="email" className="mt-0 outline-none space-y-5">
          <Dialog open={showTestEmailDialog} onOpenChange={setShowTestEmailDialog}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <SendHorizontal className="h-5 w-5 text-blue-500" />
                  Send Test Email
                </DialogTitle>
                <DialogDescription>
                  Enter the email address you want to receive the test email. We'll send a delivery confirmation to that inbox.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label htmlFor="test-email-input" className="text-sm font-semibold">Recipient Email</Label>
                <Input
                  id="test-email-input"
                  type="email"
                  placeholder="you@example.com"
                  value={testEmailTarget}
                  onChange={(e) => setTestEmailTarget(e.target.value)}
                  className="h-11 focus-visible:ring-blue-500"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && testEmailTarget) {
                      e.preventDefault();
                      if (!isTestingEmail) sendTestEmail();
                    }
                  }}
                />
                <p className="text-[11px] text-muted-foreground">The test email will be sent from your configured sender address.</p>
              </div>
              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setShowTestEmailDialog(false)} disabled={isTestingEmail}>Cancel</Button>
                <Button
                  disabled={isTestingEmail || !testEmailTarget}
                  className="gap-2 bg-blue-600 hover:bg-blue-700 text-white"
                  onClick={sendTestEmail}
                >
                  {isTestingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
                  {isTestingEmail ? 'Sending…' : 'Send Test Email'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Readiness checklist */}
          <div className="grid md:grid-cols-2 gap-4">
            {[
              { ok: canSend, title: 'Sending', text: canSend
                ? 'API key + From address look set. Use Test to confirm delivery.'
                : 'Needs a Resend API key (re_…) and a verified From address.' },
              { ok: canReceive, title: 'Receiving (Email Center)', text: canReceive
                ? `Webhook secret set. Point Resend at your webhook URL${inboundDomain ? ` and enable inbound for ${inboundDomain}` : ''}.`
                : 'Needs the Resend webhook signing secret (whsec_…). Without it, inbound mail is rejected.' },
            ].map(c => (
              <div key={c.title} className={`p-4 rounded-2xl border ${c.ok ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
                <div className="flex items-center gap-2 mb-2">
                  {c.ok ? <CheckCircle2 className="h-4 w-4 text-green-600" /> : <AlertCircle className="h-4 w-4 text-amber-600" />}
                  <p className="text-sm font-semibold">{c.title}</p>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">{c.text}</p>
              </div>
            ))}
            <div className="md:col-span-2 p-4 rounded-2xl border border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted-foreground mb-1">Resend webhook endpoint</p>
                <code className="text-xs font-mono break-all text-foreground">{webhookUrl}</code>
              </div>
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0" onClick={copyWebhookUrl}>
                {webhookUrlCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {webhookUrlCopied ? 'Copied' : 'Copy URL'}
              </Button>
            </div>
          </div>

          {/* Test + status bar */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/30">
            <button
              id="test-email-btn"
              disabled={isTestingEmail || !formData.resendApiKey?.startsWith('re_') || !formData.emailFrom}
              onClick={() => {
                setTestEmailTarget(formData.adminEmail || '');
                setEmailStatus('idle');
                setShowTestEmailDialog(true);
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              <SendHorizontal className="h-4 w-4" />
              Test your email integration
            </button>
            <div className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              emailStatus === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
              emailStatus === 'error'   ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
              'opacity-0'
            }`}>
              {emailStatus === 'success' ? '✓ Delivered' : emailStatus === 'error' ? '✗ Failed' : ''}
            </div>
          </div>

          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-5">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="font-display text-xl flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Resend Configuration
                  </CardTitle>
                  <CardDescription className="mt-1">
                    API credentials for sending and the webhook secret required for Email Center inbox.
                  </CardDescription>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted-foreground">Mail enabled</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="mailEnabled"
                      checked={formData.mailEnabled}
                      onCheckedChange={(val) => setFormData(p => ({ ...p, mailEnabled: val }))}
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      formData.mailEnabled ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {formData.mailEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-x-10 gap-y-7">
                <div className="space-y-2">
                  <Label htmlFor="mailerName" className="text-sm font-semibold text-foreground/80">Mailer Name</Label>
                  <Input
                    id="mailerName"
                    value={formData.mailerName || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. Hirdan Marketing"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Shown as the sender name in email clients.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="emailFrom" className="text-sm font-semibold text-foreground/80">From address</Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    value={formData.emailFrom || ''}
                    onChange={handleInputChange}
                    placeholder="noreply@yourdomain.com"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Must use a verified domain in your Resend account.</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resendApiKey" className="text-sm font-semibold text-foreground/80">Resend API Key</Label>
                  <SecretInput
                    id="resendApiKey"
                    value={formData.resendApiKey || ''}
                    onChange={handleInputChange}
                    placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                    className="h-11 pr-10 focus-visible:ring-blue-500 font-mono"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Required for sending.{' '}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Get a key ↗</a>
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resendInboundDomain" className="text-sm font-semibold text-foreground/80">Inbound domain</Label>
                  <Input
                    id="resendInboundDomain"
                    value={formData.resendInboundDomain || ''}
                    onChange={handleInputChange}
                    placeholder="hirdanmarketing.com"
                    className="h-11 focus-visible:ring-blue-500 font-mono"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Domain used for Message-IDs and Resend inbound. Defaults to the From address domain.
                  </p>
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="resendWebhookSecret" className="text-sm font-semibold text-foreground/80 flex items-center gap-2">
                    <Inbox className="h-3.5 w-3.5 text-blue-500" />
                    Webhook signing secret
                    <span className="text-[10px] font-normal text-amber-600">(required to receive mail)</span>
                  </Label>
                  <SecretInput
                    id="resendWebhookSecret"
                    value={formData.resendWebhookSecret || ''}
                    onChange={handleInputChange}
                    placeholder="whsec_xxxxxxxxxxxxxxxxxxxx"
                    className="h-11 pr-10 focus-visible:ring-blue-500 font-mono"
                    autoComplete="off"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    From Resend → Webhooks → your endpoint → Signing secret. Must start with{' '}
                    <code className="font-mono bg-muted px-1 rounded">whsec_</code>.{' '}
                    <a href="https://resend.com/webhooks" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Open Resend webhooks ↗</a>
                  </p>
                </div>
              </div>

              <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex gap-3">
                <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Email Center receive checklist</p>
                  <ol className="text-xs text-muted-foreground mt-1.5 leading-relaxed list-decimal pl-4 space-y-1">
                    <li>Save API key, From address, and webhook signing secret here.</li>
                    <li>In Resend, create a webhook for <code className="font-mono bg-muted px-1 rounded">email.received</code> (and delivery events) pointing at the URL above.</li>
                    <li>Enable Resend inbound for your domain; mailbox addresses in Email Center must match receiving addresses.</li>
                  </ol>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-6"
                  onClick={() => setFormData(p => ({
                    ...p,
                    mailerName: '',
                    emailFrom: '',
                    resendApiKey: '',
                    resendWebhookSecret: '',
                    resendInboundDomain: '',
                    mailEnabled: false,
                  }))}
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
                <Button
                  id="save-mail-config-btn"
                  disabled={isSaving}
                  onClick={saveMailConfig}
                  className="gap-2 h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── EMAIL TEMPLATES ─────────── */}
        <TabsContent value="email-templates" className="mt-0 outline-none">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-5">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <FileText className="h-5 w-5 text-blue-500" />
                Email Templates
              </CardTitle>
              <CardDescription>
                Customize the automated emails sent to your clients. Use{' '}
                <code className="text-[11px] bg-muted px-1 py-0.5 rounded font-mono">{'{{variable}}'}</code>{' '}
                placeholders — they'll be replaced with real data when the email is sent.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex flex-col lg:flex-row min-h-[520px]">
                <div className="w-full lg:w-64 lg:shrink-0 border-b lg:border-b-0 lg:border-r border-border flex flex-col">
                  <div className="px-3 py-3 border-b border-border">
                    <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60">Templates</p>
                  </div>
                  <div className="flex-1 overflow-y-auto py-2">
                    {emailTemplates.map(tpl => (
                      <button
                        key={tpl.id}
                        onClick={() => setActiveTemplateId(tpl.id)}
                        className={`w-full flex items-center gap-3 px-4 py-3 text-left text-sm transition-all group ${
                          tpl.id === activeTemplateId
                            ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 font-semibold border-l-2 border-blue-500'
                            : 'text-muted-foreground hover:bg-muted/60 border-l-2 border-transparent'
                        }`}
                      >
                        <div className={`shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ${
                          tpl.id === activeTemplateId
                            ? 'bg-blue-500/20 text-blue-500'
                            : 'bg-muted text-muted-foreground group-hover:bg-muted/80'
                        }`}>
                          <Mail className="h-3.5 w-3.5" />
                        </div>
                        <span className="truncate leading-snug">{tpl.name}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex-1 flex flex-col min-w-0 p-6 gap-5">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-blue-500" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-base text-foreground">{activeTemplate.name}</h3>
                      <p className="text-xs text-muted-foreground">Customize this email's subject and body</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/60" />

                  <div className="space-y-2">
                    <Label htmlFor="tpl-subject" className="text-sm font-semibold">Subject</Label>
                    <Input
                      id="tpl-subject"
                      value={activeTemplate.subject}
                      onChange={e => updateActiveTemplate({ subject: e.target.value })}
                      className="h-11 focus-visible:ring-blue-500 font-medium"
                      placeholder="Email subject line..."
                    />
                  </div>

                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Available Variables</Label>
                    <div className="min-h-[52px] p-3 rounded-xl bg-muted/40 border border-border text-xs text-muted-foreground font-mono leading-relaxed">
                      {activeTemplate.variables}
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Copy a variable and paste it in the body below — it will be replaced automatically.
                    </p>
                  </div>

                  {/* Body toolbar (visual, non-functional placeholder matching design) */}
                  <div className="space-y-2">
                    <Label htmlFor="tpl-body" className="text-sm font-semibold">Body</Label>
                    <div className="flex items-center gap-1 px-3 py-2 rounded-t-xl border border-b-0 border-border bg-muted/30">
                      {[['B', 'font-bold', 'Bold'], ['I', 'italic', 'Italic'], ['U', 'underline', 'Underline']].map(([text, style, title]) => (
                        <button key={text} type="button" className={`px-2 py-1 rounded text-xs ${style} hover:bg-muted transition-colors`} title={title}>{text}</button>
                      ))}
                      <div className="h-4 w-px bg-border mx-1" />
                      <button type="button" className="px-2 py-1 rounded text-xs hover:bg-muted transition-colors" title="Insert Link">
                        <Link className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <Textarea
                      id="tpl-body"
                      value={activeTemplate.body}
                      onChange={e => updateActiveTemplate({ body: e.target.value })}
                      className="rounded-t-none min-h-[200px] font-mono text-sm focus-visible:ring-blue-500 resize-y"
                      placeholder="Write the email body here..."
                    />
                  </div>

                  <div className="flex items-start gap-2.5 bg-amber-500/8 border border-amber-500/20 rounded-xl px-4 py-3">
                    <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700 dark:text-amber-400 leading-relaxed">
                      Please avoid using <strong>bold formatting</strong> on variable names or brackets (e.g.{' '}
                      <code className="font-mono bg-amber-500/10 px-1 rounded">{'{{client_name}}'}</code>){' '}
                      — this can break variable substitution.
                    </p>
                  </div>

                  <div className="mt-auto">
                    <Button
                      onClick={handleSaveTemplate}
                      disabled={isSavingTemplate}
                      className="w-full h-11 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 gap-2"
                    >
                      {isSavingTemplate ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── SYSTEM / VERSION CONTROL ─────────── */}
        <TabsContent value="system" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b pb-6">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> System Version
              </CardTitle>
              <CardDescription>Manage the application version and track changes over time.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="flex-1 space-y-4">
                  <div className="inline-flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4">
                    <Tag className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Current Version</p>
                      <p className="text-3xl font-bold font-mono text-primary">v{formData.appVersion || '1.0.0'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formData.updatedAt ? new Date(formData.updatedAt).toLocaleString() : '—'}
                  </p>
                </div>

                <div className="space-y-3 min-w-[220px]">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Bump</p>
                  <div className="flex flex-col gap-2">
                    {(['major', 'minor', 'patch'] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setBumpType(type)}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                          bumpType === type
                            ? 'border-primary bg-primary/10 text-primary shadow-sm'
                            : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                        }`}
                      >
                        <span className="capitalize">{type}</span>
                        <span className="font-mono text-xs">→ v{bumpVersion(formData.appVersion, type)}</span>
                      </button>
                    ))}
                  </div>
                  <Button onClick={() => setShowAddVersion(true)} className="w-full gap-2 bg-primary hover:bg-primary/90" size="sm">
                    <ArrowUpCircle className="h-4 w-4" /> Bump & Log Version
                  </Button>
                </div>
              </div>

              {showAddVersion && (
                <div className="mt-6 p-6 border border-primary/30 bg-primary/5 rounded-2xl space-y-4 animate-in fade-in zoom-in duration-200">
                  <p className="font-semibold flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-primary" />
                    Log New Version Entry
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version (auto from bump)</Label>
                      <Input
                        value={newVersionEntry.version || bumpedVersion}
                        onChange={(e) => setNewVersionEntry(p => ({ ...p, version: e.target.value }))}
                        placeholder="e.g. 1.2.0"
                        className="h-10 font-mono"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Author</Label>
                      <Input
                        value={newVersionEntry.author}
                        onChange={(e) => setNewVersionEntry(p => ({ ...p, author: e.target.value }))}
                        placeholder="Your name"
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What changed?</Label>
                    <Textarea
                      value={newVersionEntry.description}
                      onChange={(e) => setNewVersionEntry(p => ({ ...p, description: e.target.value }))}
                      placeholder="Describe the changes in this version..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={closeAddVersion}>Cancel</Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 gap-2"
                      onClick={() => {
                        const version = newVersionEntry.version || bumpedVersion;
                        const entry: VersionEntry = {
                          version,
                          description: newVersionEntry.description || 'No description provided.',
                          author: newVersionEntry.author || 'Unknown',
                          date: new Date().toISOString(),
                        };
                        setFormData(prev => ({ ...prev, appVersion: version, versionHistory: [entry, ...(prev.versionHistory || [])] }));
                        closeAddVersion();
                        toast({ title: `Version bumped to v${version}`, description: 'Click "Save Changes" to persist this update.' });
                      }}
                    >
                      <Check className="h-4 w-4" /> Confirm Bump
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Section
            title={<><History className="h-5 w-5 text-primary" /> Version History</>}
            description="A full log of all version changes made to this system."
            body="p-8"
          >
            {(formData.versionHistory || []).length === 0 ? (
              <div className="text-center py-10 text-muted-foreground">
                <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No version history yet.</p>
                <p className="text-sm">Bump a version above to start tracking changes.</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[22px] top-3 bottom-3 w-px bg-border" />
                <div className="space-y-6">
                  {formData.versionHistory.map((entry, idx) => (
                    <div key={idx} className="flex gap-5 group">
                      <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                        idx === 0
                          ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                          : 'bg-background border-border text-muted-foreground group-hover:border-primary/50'
                      }`}>
                        <GitCommit className="h-4 w-4" />
                      </div>
                      <div className={`flex-1 pb-2 rounded-2xl border px-5 py-4 transition-all ${
                        idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/20 group-hover:bg-muted/30'
                      }`}>
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className={`font-mono font-bold text-sm ${idx === 0 ? 'text-primary' : 'text-foreground'}`}>v{entry.version}</span>
                          {idx === 0 && (
                            <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Latest</span>
                          )}
                          <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-foreground/90 leading-relaxed">{entry.description}</p>
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="h-3 w-3" /> {entry.author}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Section>
        </TabsContent>

        {/* ── Accounts Management Tab ── */}
        <TabsContent value="accounts" className="mt-0 outline-none space-y-6">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <div>
              <h2 className="text-xl font-bold tracking-tight">Financial Accounts</h2>
              <p className="text-sm text-muted-foreground">Configure your bank accounts, mobile wallets, and cash pools.</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setDepositPayload(emptyDeposit())} className="gap-1.5">
                <PlusCircle className="h-4 w-4" /> Deposit Money
              </Button>
              <Button variant="outline" size="sm" onClick={() => setTransferPayload(emptyTransfer())} className="gap-1.5">
                <ArrowLeftRight className="h-4 w-4" /> Transfer Money
              </Button>
              <Button size="sm" onClick={openNewAccount} className="gap-1.5">
                <Plus className="h-4 w-4" /> Add Account
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {loadingAccounts ? (
              <div className="md:col-span-3 flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : settingsAccounts.length === 0 ? (
              <Card className="md:col-span-3 border p-8 text-center">
                <Wallet className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="font-semibold text-sm">No accounts found</p>
                <p className="text-xs text-muted-foreground mt-1 mb-4">Create accounts to start tracking expenses.</p>
                <Button size="sm" onClick={openNewAccount}>Create Account</Button>
              </Card>
            ) : (
              settingsAccounts.map(acc => {
                const AccIcon = accountIcon(acc.type);
                return (
                  <Card key={acc.id} className="border shadow-sm overflow-hidden flex flex-col justify-between">
                    <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
                      <div className="flex items-center gap-2.5">
                        {acc.image ? (
                          <div className="h-9 w-9 rounded-xl overflow-hidden border shrink-0">
                            <img src={acc.image} alt={acc.name} className="h-full w-full object-cover" />
                          </div>
                        ) : (
                          <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                            <AccIcon className="h-4.5 w-4.5" />
                          </div>
                        )}
                        <div>
                          <CardTitle className="text-sm font-bold truncate max-w-[140px]">{acc.name}</CardTitle>
                          <span className="text-[10px] text-muted-foreground uppercase font-medium tracking-wide">
                            {acc.type.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingAccount(acc)}>
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 hover:text-red-700" onClick={() => archiveAccount(acc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 pb-4">
                      <p className="text-xs text-muted-foreground uppercase font-semibold">Running Balance</p>
                      <div className="flex justify-between items-center mt-1">
                        <p className={`text-2xl font-bold ${acc.balance < 0 ? "text-red-500" : "text-emerald-600"}`}>
                          {acc.balance < 0 ? "-" : ""}${Math.abs(acc.balance / 100).toFixed(2)}
                        </p>
                        <Button variant="outline" className="h-7 px-2.5 text-xs gap-1" onClick={() => setDepositPayload(emptyDeposit(acc.id))}>
                          <PlusCircle className="h-3.5 w-3.5" /> Deposit
                        </Button>
                      </div>
                      {acc.notes && (
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 border-t pt-2">{acc.notes}</p>
                      )}
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>

          {/* Add/Edit Account Dialog */}
          {editingAccount && (
            <Dialog open onOpenChange={() => setEditingAccount(null)}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>{editingAccount.id ? "Edit Account" : "Add Account"}</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="accName">Account Name</Label>
                    <Input
                      id="accName"
                      placeholder="E.g., Business Checking, PayPal, Cash..."
                      value={editingAccount.name || ""}
                      onChange={e => setEditingAccount(p => ({ ...p, name: e.target.value }))}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accType">Account Type</Label>
                    <Select
                      value={editingAccount.type || "BANK"}
                      onValueChange={val => setEditingAccount(p => ({ ...p, type: val as SettingsAccount['type'] }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="BANK">Bank Account</SelectItem>
                        <SelectItem value="MOBILE_WALLET">Mobile Wallet</SelectItem>
                        <SelectItem value="CASH">Cash Pool</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Profile Image / Logo</Label>
                    <div className="flex items-center gap-3">
                      {editingAccount.image ? (
                        <div className="relative group h-12 w-12 rounded-xl overflow-hidden border shrink-0">
                          <img src={editingAccount.image} className="h-full w-full object-cover" alt="Account Logo" />
                          <button
                            type="button"
                            onClick={() => setEditingAccount(p => ({ ...p, image: null }))}
                            className="absolute inset-0 bg-black/60 flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold"
                          >
                            Remove
                          </button>
                        </div>
                      ) : (
                        <div className="h-12 w-12 rounded-xl border border-dashed flex items-center justify-center text-muted-foreground bg-muted/20 shrink-0">
                          <Wallet className="h-5 w-5" />
                        </div>
                      )}
                      <div className="flex-1">
                        <Input
                          type="file"
                          accept="image/*"
                          className="text-xs h-9 cursor-pointer"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.size > 5 * 1024 * 1024) {
                              toast({ title: "File too large", description: "Image must be under 5MB", variant: "destructive" });
                              return;
                            }
                            try {
                              const url = await uploadFile(file);
                              setEditingAccount(p => ({ ...p, image: url }));
                              toast({ title: "Image uploaded successfully" });
                            } catch {
                              toast({ title: "Failed to upload image", variant: "destructive" });
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="accNotes">Notes / Description</Label>
                    <Textarea
                      id="accNotes"
                      placeholder="Account number, bank name, or location..."
                      value={editingAccount.notes || ""}
                      onChange={e => setEditingAccount(p => ({ ...p, notes: e.target.value }))}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setEditingAccount(null)}>Cancel</Button>
                  <Button onClick={saveAccount}>Save Account</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Transfer Dialog */}
          {transferPayload && (
            <Dialog open onOpenChange={() => setTransferPayload(null)}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Transfer Money</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>From Account</Label>
                    <Select value={transferPayload.fromAccountId} onValueChange={val => setTransferPayload(p => p && { ...p, fromAccountId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select source account" />
                      </SelectTrigger>
                      <SelectContent>{accountOptions}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>To Account</Label>
                    <Select value={transferPayload.toAccountId} onValueChange={val => setTransferPayload(p => p && { ...p, toAccountId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>{accountOptions}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={transferPayload.amount}
                        onChange={e => setTransferPayload(p => p && { ...p, amount: e.target.value })}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={transferPayload.date} onChange={e => setTransferPayload(p => p && { ...p, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Note / Purpose</Label>
                    <Textarea
                      placeholder="Reason for transfer..."
                      value={transferPayload.note}
                      onChange={e => setTransferPayload(p => p && { ...p, note: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setTransferPayload(null)}>Cancel</Button>
                  <Button onClick={submitTransfer}>Transfer</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Deposit Dialog */}
          {depositPayload && (
            <Dialog open onOpenChange={() => setDepositPayload(null)}>
              <DialogContent className="sm:max-w-[400px]">
                <DialogHeader>
                  <DialogTitle>Deposit Money</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label>Account</Label>
                    <Select value={depositPayload.accountId} onValueChange={val => setDepositPayload(p => p && { ...p, accountId: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select destination account" />
                      </SelectTrigger>
                      <SelectContent>{accountOptions}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Amount</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-semibold">$</span>
                      <Input
                        type="number"
                        placeholder="0.00"
                        value={depositPayload.amount}
                        onChange={e => setDepositPayload(p => p && { ...p, amount: e.target.value })}
                        className="pl-7"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={depositPayload.category} onValueChange={val => setDepositPayload(p => p && { ...p, category: val })}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="OWNER_INVESTMENT">Owner Investment / Capital</SelectItem>
                        <SelectItem value="REVENUE">Revenue / Invoice Payment</SelectItem>
                        <SelectItem value="REFUND">Refund</SelectItem>
                        <SelectItem value="OTHER">Other Income</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Date</Label>
                    <Input type="date" value={depositPayload.date} onChange={e => setDepositPayload(p => p && { ...p, date: e.target.value })} />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Description / Notes</Label>
                    <Textarea
                      placeholder="Source or reason for deposit..."
                      value={depositPayload.description}
                      onChange={e => setDepositPayload(p => p && { ...p, description: e.target.value })}
                      rows={2}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setDepositPayload(null)}>Cancel</Button>
                  <Button onClick={submitDeposit}>Deposit</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </TabsContent>
        {canManageUsers && (
        <TabsContent value="users" className="mt-0 outline-none">
          <UsersPage />
        </TabsContent>
        )}
        <TabsContent value="landing-page" className="mt-0 outline-none">
          <LandingPageEditor />
        </TabsContent>
        <TabsContent value="backups" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-blue-500/10 to-transparent border-b pb-6">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" /> Database Backups Management
              </CardTitle>
              <CardDescription>Manually trigger full database backups and download or manage previously saved SQL snapshots.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              {settings.googleDriveEnabled && (settings.googleDriveServiceAccountJson || settings.googleDriveRefreshToken) ? (
                <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-sm text-green-700 dark:text-green-400">
                  <Cloud className="h-5 w-5" />
                  <div>
                    <p className="font-semibold">Cloud Sync Active</p>
                    <p>New backups are automatically securely uploaded to your configured Google Drive.</p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-sm text-yellow-700 dark:text-yellow-400">
                  <div className="flex items-center gap-3">
                    <CloudOff className="h-5 w-5 shrink-0" />
                    <div>
                      <p className="font-semibold">Cloud Sync Disabled</p>
                      <p>Backups are only stored locally. Enable Google Drive sync in the Plugins tab to secure them in the cloud.</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="bg-yellow-50/50 border-yellow-500/30 hover:bg-yellow-500/20 text-yellow-700 h-9 shrink-0"
                    onClick={() => navigate("/dashboard/plugins")}
                  >
                    Setup Google Drive
                  </Button>
                </div>
              )}

              <div className="flex justify-between items-center flex-wrap gap-4">
                <div>
                  <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Database className="h-4 w-4 text-blue-500" /> Local Backups Directory
                  </h3>
                  <p className="text-xs text-muted-foreground">List of backups stored locally on the server. Old backups are automatically pruned.</p>
                </div>
                <Button onClick={handleCreateBackup} disabled={isBackingUp} className="bg-blue-600 hover:bg-blue-700 text-white gap-2 px-6 h-11">
                  {isBackingUp ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {isBackingUp ? 'Creating Backup...' : 'Backup Database Now'}
                </Button>
              </div>

              {loadingBackups ? (
                <div className="text-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-500 mb-2" />
                  <p className="text-xs text-muted-foreground">Loading backups list...</p>
                </div>
              ) : backups.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-2xl bg-muted/10 text-muted-foreground">
                  <Database className="h-10 w-10 mx-auto mb-3 opacity-30 text-blue-500" />
                  <p className="font-medium">No database backups found.</p>
                  <p className="text-xs">Trigger a manual backup above to create one.</p>
                </div>
              ) : (
                <div className="border border-border/80 rounded-2xl overflow-hidden bg-background">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm border-collapse">
                      <thead>
                        <tr className="bg-muted/40 border-b border-border/60 text-xs font-semibold text-muted-foreground">
                          <th className="p-4">Filename</th>
                          <th className="p-4">Size</th>
                          <th className="p-4">Created Date</th>
                          <th className="p-4 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/50">
                        {backups.map((backup) => {
                          const busy = isRestoring !== null || isUploadingToDrive !== null;
                          return (
                            <tr key={backup.filename} className="hover:bg-muted/10">
                              <td className="p-4 font-mono text-xs font-medium text-foreground">{backup.filename}</td>
                              <td className="p-4 text-xs text-muted-foreground">{(backup.size / 1024 / 1024).toFixed(2)} MB</td>
                              <td className="p-4 text-xs text-muted-foreground">
                                {new Date(backup.createdAt).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </td>
                              <td className="p-4 text-right flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => downloadProtectedFile(`/settings/backups/${backup.filename}/download`, backup.filename)}
                                  disabled={busy}
                                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-blue-500 hover:bg-blue-500/5"
                                  title="Download SQL Backup File"
                                >
                                  <Download className="h-4 w-4" />
                                </Button>
                                {(formData.googleDriveServiceAccountJson || formData.googleDriveRefreshToken) && (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUploadBackupToGDrive(backup.filename)}
                                    disabled={busy}
                                    className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-green-600 hover:bg-green-50"
                                    title="Upload Backup to Google Drive"
                                  >
                                    {isUploadingToDrive === backup.filename ? <Loader2 className="h-4 w-4 animate-spin text-green-500" /> : <Cloud className="h-4 w-4" />}
                                  </Button>
                                )}
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRestoreBackup(backup.filename)}
                                  disabled={busy}
                                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-orange-500 hover:bg-orange-500/5"
                                  title="Restore Database from Backup"
                                >
                                  {isRestoring === backup.filename ? <Loader2 className="h-4 w-4 animate-spin text-orange-500" /> : <RotateCcw className="h-4 w-4 text-orange-500" />}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDeleteBackup(backup.filename)}
                                  disabled={busy}
                                  className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/5"
                                  title="Delete Local Backup"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="plugins" className="mt-0 outline-none">
          <PluginsPage />
        </TabsContent>
        </div>{/* end content area */}
        </div>{/* end desktop layout wrapper */}
      </Tabs>
    </div>
  );
}

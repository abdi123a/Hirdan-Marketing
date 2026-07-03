import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { useAuthStore, type ClientUser } from '@/lib/auth-store';
import { useAgencyStore } from '@/lib/store';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  LogOut, FileText, Receipt, User, Building2, Mail, Phone,
  Globe, MapPin, Download, Eye, Calendar, Clock,
  ChevronLeft, ChevronRight, X, Printer, Loader2, Share2, ExternalLink, Image, Video,
  Zap, Package, CheckCircle2, Briefcase, Layers, Home, TrendingUp, Settings,
  AlertCircle
} from 'lucide-react';
import { apiFetch, apiUpload, downloadProtectedFile } from '@/lib/api-client';
import hirdanLogo from '@/assets/hirdan-logo.png';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { PremiumInvoice } from '@/components/PremiumInvoice';
import { DocumentViewer } from '@/components/DocumentViewer';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { useToast } from "@/hooks/use-toast";

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
};

/** Benchmark uplift vs. your invoices — frames “typical agency” pricing for the same scope (client-facing estimate). */
const ESTIMATED_AGENCY_MARKET_MULTIPLIER = 1.35;

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string;
  badge?: string | number;
  section?: 'workspace' | 'resources';
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    Pending: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800',
    Overdue: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    Draft: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800',
    Sent: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800',
    Accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
    Expired: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800',
    Active: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

export default function ClientPortalPage() {
  const { user, logout, setToken, setClientPasswordChangeRequired } = useAuthStore();
  const { clients, invoices, proformas, settings, subscriptions, projects, fetchAllData } = useAgencyStore();
  const isMobile = useIsMobile();
  const prefersReducedMotion = useReducedMotion();

  const sidebarEase: [number, number, number, number] = [0.33, 1, 0.68, 1];
  const sidebarTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { type: 'tween' as const, duration: 0.32, ease: sidebarEase };
  const overlayTransition = prefersReducedMotion
    ? { duration: 0.01 }
    : { duration: 0.28, ease: sidebarEase };

  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isDesktopCollapsed, setIsDesktopCollapsed] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{ title: string, fileUrl: string, type?: string } | null>(null);
  const downloadRef = useRef<HTMLDivElement>(null);
  const [activeDownloadDocument, setActiveDownloadDocument] = useState<{ type: 'Invoice' | 'Proforma', data: any } | null>(null);
  const { toast } = useToast();
  const [accountForm, setAccountForm] = useState({
    name: '',
    company: '',
    email: '',
    phone: '',
    website: '',
    address: '',
    city: '',
    country: '',
  });
  const [isSavingAccount, setIsSavingAccount] = useState(false);
  const [accountSaveMessage, setAccountSaveMessage] = useState<string | null>(null);
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<string | null>(null);
  const [isFirstLoginModalOpen, setIsFirstLoginModalOpen] = useState(false);
  const [showForcedPasswordForm, setShowForcedPasswordForm] = useState(false);

  const [portalData, setPortalData] = useState<{ socialProfiles: any[], documents: any[], tasks: any[] } | null>(null);
  const [portalSummary, setPortalSummary] = useState<{
    subscription: any | null;
    cycle: any | null;
    progress: { total: number; completed: number; percentage: number } | null;
  } | null>(null);
  const [taskStats, setTaskStats] = useState<{
    inProgress: number;
    planned: number;
    waitingApproval: number;
    completedVisible: number;
  }>({
    inProgress: 0,
    planned: 0,
    waitingApproval: 0,
    completedVisible: 0,
  });
  const today = new Date();
  const [plannerMonth, setPlannerMonth] = useState(today.getMonth() + 1);
  const [plannerYear, setPlannerYear] = useState(today.getFullYear());
  const [plannerPosts, setPlannerPosts] = useState<any[]>([]);
  const [isPlannerLoading, setIsPlannerLoading] = useState(false);

  useEffect(() => {
    fetchAllData().finally(() => setIsInitialLoading(false));
    apiFetch<{ socialProfiles: any[], documents: any[], tasks: any[] }>('/portal/social')
      .then(res => {
        setPortalData(res);
        const waitingApproval = (res.tasks || []).filter((task: any) => task.status === 'WAITING_APPROVAL').length;
        const completedVisible = (res.tasks || []).filter((task: any) => task.status === 'COMPLETED').length;
        setTaskStats((prev) => ({
          ...prev,
          waitingApproval,
          completedVisible,
        }));
      })
      .catch(console.error);

    apiFetch<{ subscription: any | null; cycle: any | null; progress: { total: number; completed: number; percentage: number } | null }>('/portal/social/summary')
      .then((res) => setPortalSummary(res))
      .catch(console.error);

    Promise.all([
      apiFetch<{ tasks: any[] }>('/portal/social/tasks?status=IN_PROGRESS'),
      apiFetch<{ tasks: any[] }>('/portal/social/tasks?status=PLANNED'),
    ])
      .then(([inProgressRes, plannedRes]) => {
        setTaskStats((prev) => ({
          ...prev,
          inProgress: inProgressRes.tasks?.length || 0,
          planned: plannedRes.tasks?.length || 0,
        }));
      })
      .catch(console.error);
  }, [fetchAllData]);

  useEffect(() => {
    setIsPlannerLoading(true);
    apiFetch<{ posts: any[] }>(`/portal/social/planner?month=${plannerMonth}&year=${plannerYear}`)
      .then((res) => setPlannerPosts(res.posts || []))
      .catch(console.error)
      .finally(() => setIsPlannerLoading(false));
  }, [plannerMonth, plannerYear]);

  // handlePrint removed as modal is gone

  const handleDownloadDirect = async (doc: { type: 'Invoice' | 'Proforma', data: any }) => {
    toast({ 
      title: "Processing PDF", 
      description: `Generating your ${doc.type.toLowerCase()}...` 
    });
    
    setActiveDownloadDocument(doc);
    
    setTimeout(async () => {
      if (!downloadRef.current) return;
      
      try {
        const captureScale = 3;
        const jpegQuality = 0.95;

        const element = downloadRef.current.querySelector('.print-content') as HTMLElement || downloadRef.current;

        const images = Array.from(element.querySelectorAll('img'));
        await Promise.all(
          images.map(img => {
            if (img.complete) return Promise.resolve();
            return new Promise(resolve => {
              img.onload = resolve;
              img.onerror = resolve;
            });
          })
        );
        
        const canvas = await html2canvas(element, {
          scale: captureScale, 
          useCORS: true,
          logging: false,
          backgroundColor: "#ffffff",
          width: 794,
          height: element.scrollHeight,
          onclone: (clonedDoc) => {
            const el = clonedDoc.querySelector('.print-content') as HTMLElement;
            if (el) {
              el.style.width = '794px';
              el.style.margin = '0';
              el.style.padding = '0';
            }
          }
        });

        const imgData = canvas.toDataURL("image/jpeg", jpegQuality);
        const pdf = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: "a4",
        });

        const imgProps = pdf.getImageProperties(imgData);
        const pdfWidth = 210;
        const pdfHeightRatio = (imgProps.height * pdfWidth) / imgProps.width;
        const pageHeight = 297;
        
        let heightLeft = pdfHeightRatio;
        let position = 0;

        // If it's roughly one page, fill the full A4 to ensure footer is at the bottom
        if (pdfHeightRatio <= 300) {
          pdf.addImage(imgData, "JPEG", 0, 0, 210, 297, undefined, "FAST");
        } else {
          pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeightRatio, undefined, "FAST");
          heightLeft -= pageHeight;

          // Threshold of 10mm to avoid an empty final page from minor layout overflows
          while (heightLeft > 10) {
            position = heightLeft - pdfHeightRatio;
            pdf.addPage();
            pdf.addImage(imgData, "JPEG", 0, position, pdfWidth, pdfHeightRatio, undefined, "FAST");
            heightLeft -= pageHeight;
          }
        }

        const filename = doc.type === 'Invoice' ? `Invoice_${doc.data.id}` : `Proforma_${doc.data.id}`;
        pdf.save(`${filename}.pdf`);

        toast({ title: "PDF Downloaded", description: `${filename}.pdf has been saved.` });
      } catch (error) {
        console.error("PDF generation failed:", error);
        toast({
          title: "Download Failed",
          description: "There was an error generating the PDF.",
          variant: "destructive"
        });
      } finally {
        setActiveDownloadDocument(null);
      }
    }, 1200);
  };

  const clientUser = user as ClientUser;
  const isForcedPasswordChange = !!clientUser?.requiresPasswordChange;
  const client = clients.find((c) => c.id === clientUser.clientId);
  const fallbackClient = clientUser?.clientId
    ? ({
      id: clientUser.clientId,
      name: clientUser.name || 'Client',
      company: clientUser.company || '',
      email: clientUser.email || '',
      phone: '',
      website: '',
      address: '',
      city: '',
      country: '',
      status: 'Active',
    } as any)
    : null;
  const displayClient = client || fallbackClient;

  useEffect(() => {
    if (!displayClient) return;
    setAccountForm({
      name: displayClient.name || '',
      company: displayClient.company || '',
      email: displayClient.email || '',
      phone: displayClient.phone || '',
      website: displayClient.website || '',
      address: displayClient.address || '',
      city: displayClient.city || '',
      country: displayClient.country || '',
    });
  }, [displayClient]);

  useEffect(() => {
    if (isForcedPasswordChange) {
      setActiveTab('account');
      setIsFirstLoginModalOpen(true);
    }
  }, [isForcedPasswordChange]);

  const clientInvoices = invoices.filter(
    (inv) => inv.client === client?.company || inv.client === client?.name
  );
  const clientProformas = proformas.filter(
    (pro) => pro.client === client?.company || pro.client === client?.name
  );
  const clientProjects = projects.filter((project: any) =>
    project.client === client?.company ||
    project.client === client?.name ||
    project.clientName === client?.name ||
    project.clientName === client?.company ||
    project.clientId === client?.id
  );
  const clientSubscriptions = subscriptions.filter((subscription: any) =>
    subscription.client === client?.company ||
    subscription.client === client?.name ||
    subscription.clientName === client?.name ||
    subscription.clientName === client?.company ||
    subscription.clientId === client?.id
  );

  const handleLogout = () => {
    logout();
    navigate('/client/login', { replace: true });
  };

  const handlePasswordChange = async () => {
    setPasswordMessage(null);
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordMessage('Please fill all password fields.');
      return;
    }
    if (passwordForm.newPassword.length < 8) {
      setPasswordMessage('New password must be at least 8 characters.');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordMessage('New passwords do not match.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await apiFetch<{ accessToken: string; message: string }>('/auth/client-change-password', {
        method: 'POST',
        body: JSON.stringify(passwordForm),
      });
      if (res.accessToken) {
        setToken(res.accessToken);
      }
      setClientPasswordChangeRequired(false);
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setPasswordMessage('Password changed successfully.');

      if (isForcedPasswordChange) {
        setIsFirstLoginModalOpen(false);
        setShowForcedPasswordForm(false);
        setActiveTab('overview');
      }
    } catch (error) {
      console.error(error);
      setPasswordMessage('Unable to change password. Please verify your current password and try again.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!displayClient) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Account Not Found</h2>
          <p className="text-muted-foreground mb-6">Your account could not be located.</p>
          <Button onClick={handleLogout}>Back to Login</Button>
        </div>
      </div>
    );
  }

  const totalInvoiced = clientInvoices.reduce((sum, inv) => {
    const num = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ''));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const totalPaid = clientInvoices.reduce((sum, inv) => {
    const num = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ''));
    const amount = isNaN(num) ? 0 : num;
    if (inv.status === 'Paid') return sum + amount;
    if (inv.status === 'Partially Paid') return sum + (inv.deposit || 0);
    return sum;
  }, 0);

  const estimatedMarketValue =
    totalInvoiced > 0 ? Math.round(totalInvoiced * ESTIMATED_AGENCY_MARKET_MULTIPLIER * 100) / 100 : 0;
  const yourInvestment = totalPaid;
  const totalSaved = Math.max(0, estimatedMarketValue - yourInvestment);
  const savingsPercentOfMarket =
    estimatedMarketValue > 0 ? Math.round((totalSaved / estimatedMarketValue) * 100) : 0;

  const cycleProgress = portalSummary?.progress;
  const completedTasks = cycleProgress?.completed ?? taskStats.completedVisible;
  const totalTasks = cycleProgress?.total ?? 0;
  const profileCount = portalData?.socialProfiles?.length ?? 0;
  const documentCount = portalData?.documents?.length ?? 0;

  const overviewStatTiles: { label: string; value: string; tab: string }[] = [
    {
      label: 'Tasks completed',
      value:
        cycleProgress && totalTasks > 0
          ? `${completedTasks} / ${totalTasks}`
          : String(completedTasks),
      tab: 'social',
    },
    { label: 'In progress', value: String(taskStats.inProgress), tab: 'social' },
    { label: 'Awaiting your review', value: String(taskStats.waitingApproval), tab: 'social' },
    { label: 'Planned tasks', value: String(taskStats.planned), tab: 'planner' },
    { label: 'Posts this month', value: String(plannerPosts.length), tab: 'planner' },
    { label: 'Projects', value: String(clientProjects.length), tab: 'projects' },
    { label: 'Subscriptions', value: String(clientSubscriptions.length), tab: 'subscriptions' },
    { label: 'Documents', value: String(documentCount), tab: 'documents' },
    { label: 'Social profiles', value: String(profileCount), tab: 'social' },
  ];

  const initials = displayClient.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const navItems: NavItem[] = [
    { id: 'overview', label: 'Overview', icon: <Home className="h-4 w-4" />, value: 'overview', section: 'workspace' },
    { id: 'financials', label: 'Financials', icon: <Receipt className="h-4 w-4" />, value: 'financials', badge: clientInvoices.length, section: 'workspace' },
    { id: 'projects', label: 'Projects', icon: <Briefcase className="h-4 w-4" />, value: 'projects', badge: clientProjects.length, section: 'workspace' },
    { id: 'subscriptions', label: 'Subscriptions', icon: <Zap className="h-4 w-4" />, value: 'subscriptions', badge: clientSubscriptions.length, section: 'workspace' },
    { id: 'social', label: 'Social Media', icon: <Share2 className="h-4 w-4" />, value: 'social', section: 'resources' },
    { id: 'planner', label: 'Planner', icon: <Calendar className="h-4 w-4" />, value: 'planner', section: 'resources' },
    { id: 'documents', label: 'Documents', icon: <FileText className="h-4 w-4" />, value: 'documents', badge: portalData?.documents.length || 0, section: 'resources' },
    { id: 'account', label: 'Account', icon: <User className="h-4 w-4" />, value: 'account', section: 'resources' },
  ];
  const workspaceNavItems = navItems.filter((item) => item.section === 'workspace');
  const resourcesNavItems = navItems.filter((item) => item.section === 'resources');

  return (
    <div className="min-h-screen bg-background flex min-w-0">
      {/* Sidebar Navigation */}
      <AnimatePresence>
        {/* Collapsed Icon-Only Sidebar (Desktop) */}
        {isDesktopCollapsed && !isMobile && (
          <motion.div
            initial={{ x: -72 }}
            animate={{ x: 0 }}
            exit={{ x: -72 }}
            transition={sidebarTransition}
            className="z-50 w-[72px] h-screen sticky top-0 self-start bg-card border-r border-border shadow-[4px_0_32px_-16px_rgba(0,0,0,0.08)] dark:shadow-[4px_0_40px_-12px_rgba(0,0,0,0.35)] flex flex-col items-center overflow-hidden"
          >
            {/* Collapsed Header — logo mark */}
            <div className="w-full flex items-center justify-center h-[65px] border-b border-border shrink-0 px-2">
              <img
                src={settings.logo || hirdanLogo}
                alt={settings.agencyName}
                className="h-8 w-10 object-contain"
              />
            </div>

            {/* Collapsed Navigation */}
            <nav className="flex-1 w-full flex flex-col items-center gap-1 py-4 px-2 overflow-y-auto overflow-x-hidden">
              {/* Workspace items */}
              {workspaceNavItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    if (isForcedPasswordChange && item.value !== 'account') return;
                    setActiveTab(item.value);
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  title={item.label}
                  aria-current={activeTab === item.value ? 'page' : undefined}
                  className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 ease-out group shrink-0 ${activeTab === item.value
                      ? 'bg-primary/12 text-primary shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                >
                  <span className={`${activeTab === item.value ? 'text-primary' : 'group-hover:text-foreground'
                    } transition-colors duration-150`}>
                    {item.icon}
                  </span>
                  {item.badge ? (
                    <span className="absolute top-1.5 right-1.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none px-0.5">
                      {item.badge}
                    </span>
                  ) : null}
                  {/* Tooltip */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap text-xs font-medium bg-foreground text-background px-2.5 py-1.5 rounded-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-[60] shadow-lg">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                  </div>
                </motion.button>
              ))}

              {/* Divider between sections */}
              <div className="w-8 h-px bg-border/70 my-1 shrink-0" />

              {/* Resources items */}
              {resourcesNavItems.map((item) => (
                <motion.button
                  key={item.id}
                  onClick={() => {
                    if (isForcedPasswordChange && item.value !== 'account') return;
                    setActiveTab(item.value);
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.94 }}
                  title={item.label}
                  aria-current={activeTab === item.value ? 'page' : undefined}
                  className={`relative w-11 h-11 flex items-center justify-center rounded-xl transition-all duration-200 ease-out group shrink-0 ${activeTab === item.value
                      ? 'bg-primary/12 text-primary shadow-sm shadow-primary/10'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                    }`}
                >
                  <span className={`${activeTab === item.value ? 'text-primary' : 'group-hover:text-foreground'
                    } transition-colors duration-150`}>
                    {item.icon}
                  </span>
                  {item.badge ? (
                    <span className="absolute top-1.5 right-1.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none px-0.5">
                      {item.badge}
                    </span>
                  ) : null}
                  {/* Tooltip */}
                  <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap text-xs font-medium bg-foreground text-background px-2.5 py-1.5 rounded-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-[60] shadow-lg">
                    {item.label}
                    <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                  </div>
                </motion.button>
              ))}
            </nav>

            {/* Collapsed Footer — avatar + expand */}
            <div className="w-full border-t border-border py-3 px-2 flex flex-col items-center gap-2 shrink-0">
              {/* Avatar */}
              <button
                type="button"
                onClick={() => setActiveTab('account')}
                title={displayClient.name}
                className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-display font-bold text-sm hover:bg-primary/20 transition-colors duration-150 group relative shrink-0"
              >
                {initials}
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-3 whitespace-nowrap text-xs font-medium bg-foreground text-background px-2.5 py-1.5 rounded-lg opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-150 pointer-events-none z-[60] shadow-lg">
                  {displayClient.name}
                  <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-foreground" />
                </div>
              </button>
              {/* Expand button */}
              <motion.button
                onClick={() => setIsDesktopCollapsed(false)}
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.94 }}
                title="Expand sidebar"
                className="w-11 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 transition-all duration-200 ease-out text-muted-foreground hover:text-primary shrink-0"
              >
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            </div>
          </motion.div>
        )}

        {/* Full Sidebar (Mobile overlay and Desktop expanded) */}
        {(isMobile ? isMobileSidebarOpen : !isDesktopCollapsed) && (
          <>
            {/* Overlay on mobile */}
            {isMobile && isMobileSidebarOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={overlayTransition}
                onClick={() => setIsMobileSidebarOpen(false)}
                className="fixed inset-0 z-40 bg-foreground/15 backdrop-blur-[6px]"
              />
            )}

            {/* Full Sidebar */}
            <motion.div
              initial={{ x: isMobile ? -288 : 0 }}
              animate={{ x: 0 }}
              exit={{ x: isMobile ? -288 : 0 }}
              transition={sidebarTransition}
              className={`${isMobile ? 'fixed' : 'sticky top-0 self-start'} z-50 w-72 h-screen bg-card border-r border-border shadow-[4px_0_40px_-12px_rgba(0,0,0,0.18)] dark:shadow-[4px_0_48px_-12px_rgba(0,0,0,0.45)] md:shadow-[4px_0_32px_-16px_rgba(0,0,0,0.08)] dark:md:shadow-[4px_0_40px_-12px_rgba(0,0,0,0.35)] overflow-y-auto flex flex-col`}
            >
              {/* Sidebar Header - Desktop only logo */}
              <div className="p-6 border-b border-border hidden md:flex items-center justify-between">
                <img src={settings.logo || hirdanLogo} alt={settings.agencyName} className="h-12 object-contain" />
                <motion.button
                  onClick={() => setIsDesktopCollapsed((prev) => !prev)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 hover:bg-primary/10 rounded-lg transition-all duration-300 ease-out text-muted-foreground hover:text-primary group relative"
                  title={!isDesktopCollapsed ? "Collapse sidebar" : "Expand sidebar"}
                >
                  <motion.div
                    animate={{ rotate: !isDesktopCollapsed ? 0 : 180 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.32, ease: sidebarEase }}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.div>
                  <div
                    className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs bg-foreground text-background px-2 py-1 rounded opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 transition-all duration-150 pointer-events-none z-50"
                  >
                    {!isDesktopCollapsed ? "Collapse" : "Expand"}
                  </div>
                </motion.button>
              </div>

              {/* Sidebar Header - Mobile close button */}
              <div className="p-4 border-b border-border flex md:hidden items-center justify-between">
                <h2 className="text-lg font-display font-bold text-foreground">Menu</h2>
                <motion.button
                  onClick={() => setIsMobileSidebarOpen(false)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-all duration-300 ease-out"
                >
                  <motion.div
                    animate={{ rotate: isMobileSidebarOpen ? 0 : 90 }}
                    transition={prefersReducedMotion ? { duration: 0.01 } : { duration: 0.32, ease: sidebarEase }}
                  >
                    <X className="h-5 w-5" />
                  </motion.div>
                </motion.button>
              </div>

              {/* Navigation Items */}
              <nav className="flex-1 p-4 space-y-5">
                <div>
                  <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Workspace</p>
                  <div className="space-y-1">
                    {workspaceNavItems.map((item) => (
                      <motion.button
                        key={item.id}
                        onClick={() => {
                          if (isForcedPasswordChange && item.value !== 'account') return;
                          setActiveTab(item.value);
                          isMobile && setIsMobileSidebarOpen(false);
                        }}
                        whileHover={{ x: 4 }}
                        aria-current={activeTab === item.value ? 'page' : undefined}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ease-out group border ${activeTab === item.value
                            ? 'bg-primary/10 text-primary font-semibold border-primary/20 shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`${activeTab === item.value ? 'text-primary' : 'group-hover:text-foreground'}`}>
                            {item.icon}
                          </span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        {item.badge ? (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </motion.button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="px-3 pb-2 text-[10px] uppercase tracking-widest font-bold text-muted-foreground">Resources</p>
                  <div className="space-y-1">
                    {resourcesNavItems.map((item) => (
                      <motion.button
                        key={item.id}
                        onClick={() => {
                          if (isForcedPasswordChange && item.value !== 'account') return;
                          setActiveTab(item.value);
                          isMobile && setIsMobileSidebarOpen(false);
                        }}
                        whileHover={{ x: 4 }}
                        aria-current={activeTab === item.value ? 'page' : undefined}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all duration-300 ease-out group border ${activeTab === item.value
                            ? 'bg-primary/10 text-primary font-semibold border-primary/20 shadow-sm'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border-transparent'
                          }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`${activeTab === item.value ? 'text-primary' : 'group-hover:text-foreground'}`}>
                            {item.icon}
                          </span>
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        {item.badge ? (
                          <Badge variant="secondary" className="ml-auto h-5 min-w-5 flex items-center justify-center p-0 text-xs">
                            {item.badge}
                          </Badge>
                        ) : null}
                      </motion.button>
                    ))}
                  </div>
                </div>
              </nav>

              {/* Sidebar Footer */}
              <div className="border-t border-border p-4 space-y-3 mt-auto">
                <div className="grid grid-cols-2 gap-2">
                  <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Open Invoices</p>
                    <p className="text-lg font-display font-bold text-foreground">{clientInvoices.filter((invoice) => invoice.status !== 'Paid').length}</p>
                  </div>
                  <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Documents</p>
                    <p className="text-lg font-display font-bold text-foreground">{portalData?.documents.length || 0}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setActiveTab('account');
                    isMobile && setIsMobileSidebarOpen(false);
                  }}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/50 hover:bg-muted/40 transition-colors text-left"
                >
                  <Avatar className="h-10 w-10 ring-2 ring-primary/10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-display font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{displayClient.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{displayClient.company}</p>
                  </div>
                </button>
                <div className="px-2 py-2 rounded-lg bg-muted/30 border border-border/50">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">Account Status</p>
                  <div className="flex items-center gap-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${displayClient.status === 'Active' ? 'bg-emerald-500' : displayClient.status === 'Paused' ? 'bg-amber-500' : 'bg-red-500'}`} />
                    <p className="text-sm font-semibold text-foreground">{displayClient.status}</p>
                  </div>
                </div>
                <Button
                  onClick={handleLogout}
                  variant="outline"
                  className="w-full justify-start gap-2 text-destructive hover:text-destructive hover:bg-destructive/5"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 overflow-auto flex flex-col min-w-0">
        {/* Top Header */}
        <header className="sticky top-0 z-40 bg-card/80 backdrop-blur-xl border-b border-border">
          <div className="px-4 md:px-8 h-16 flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setIsMobileSidebarOpen((prev) => !prev)}
                className={cn(
                  'md:hidden h-9 w-9 shrink-0 rounded-xl border border-border/50 bg-card/40 text-muted-foreground shadow-sm transition-[background-color,box-shadow,color,border-color,transform] duration-200 ease-out hover:bg-muted/80 hover:text-foreground hover:shadow-md hover:border-border active:scale-[0.96] motion-reduce:transition-colors motion-reduce:active:scale-100',
                  isMobileSidebarOpen && 'border-primary/20 bg-primary/[0.06] text-foreground shadow-md',
                )}
                aria-expanded={isMobileSidebarOpen}
                aria-haspopup="dialog"
                aria-label={isMobileSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
              >
                <span className="relative block h-3.5 w-[18px]" aria-hidden>
                  <span
                    className={cn(
                      'absolute left-0 top-0 h-0.5 w-[18px] rounded-full bg-current transition-[transform,top] duration-300 ease-out motion-reduce:transition-none',
                      isMobileSidebarOpen ? 'top-[6px] rotate-45' : 'top-0 rotate-0',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-0 top-[6px] h-0.5 w-[18px] rounded-full bg-current transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none',
                      isMobileSidebarOpen ? 'scale-x-0 opacity-0' : 'scale-x-100 opacity-100',
                    )}
                  />
                  <span
                    className={cn(
                      'absolute left-0 top-[12px] h-0.5 w-[18px] rounded-full bg-current transition-[transform,top] duration-300 ease-out motion-reduce:transition-none',
                      isMobileSidebarOpen ? 'top-[6px] -rotate-45' : 'top-[12px] rotate-0',
                    )}
                  />
                </span>
              </Button>
              <img src={settings.logo || hirdanLogo} alt={settings.agencyName} className="md:hidden h-12 max-h-[52px] w-auto object-contain" />
              <div className="hidden sm:block">
                <h1 className="text-lg font-display font-bold text-foreground">Client Portal</h1>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {displayClient.status === 'Active' && (
                <Badge variant="outline" className="hidden sm:flex bg-emerald-500/10 text-emerald-600 border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-2" />
                  Active Account
                </Badge>
              )}
              {displayClient.status !== 'Active' && (
                <Badge variant="outline" className="hidden sm:flex bg-amber-500/10 text-amber-600 border-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 mr-1" />
                  {displayClient.status}
                </Badge>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 px-3 sm:px-4 md:px-8 py-6 sm:py-8 min-w-0">
          {/* Welcome Section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="mb-8"
          >
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-bold text-foreground break-words">
              Welcome back, <span className="text-gradient-gold">{displayClient.name.split(' ')[0]}</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              {isForcedPasswordChange
                ? 'Please change your password to unlock full portal access.'
                : 'Manage your account, track projects, and view documents.'}
            </p>
          </motion.div>

          {/* Content based on active tab */}
          <div className="w-full">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-8"
              >
                <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6 md:mb-8">
                    <div>
                      <h2 className="text-lg md:text-xl font-display font-semibold text-foreground">At a glance</h2>
                      <p className="text-sm text-muted-foreground mt-1">
                        Key numbers from your account — tap a tile to open the detail.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-3 gap-3 md:gap-4">
                    {overviewStatTiles.map((tile) => (
                      <button
                        key={tile.label}
                        type="button"
                        onClick={() => setActiveTab(tile.tab)}
                        className="rounded-xl border border-border/70 bg-muted/5 p-4 text-left transition-colors hover:bg-muted/15 hover:border-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                      >
                        <p className="text-[10px] md:text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2 leading-tight">
                          {tile.label}
                        </p>
                        <p className="text-xl md:text-2xl font-display font-bold text-foreground tabular-nums">
                          {tile.value}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Main Dashboard Grid */}
                <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                  <div className="xl:col-span-2 space-y-6">
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-7">
                      <div className="flex items-center justify-between gap-3 mb-6">
                        <h3 className="text-lg font-display font-semibold text-foreground">Subscription timeline</h3>
                        <Badge
                          variant="outline"
                          className="text-[10px] uppercase tracking-wider font-bold border-border/80 text-muted-foreground"
                        >
                          {portalSummary?.subscription ? 'Active' : 'Getting started'}
                        </Badge>
                      </div>
                      {!portalSummary?.subscription || !portalSummary?.cycle ? (
                        <div className="rounded-xl border border-border/60 bg-muted/10 px-6 py-10 text-center">
                          <p className="text-sm text-muted-foreground">
                            No active subscription cycle. Open Subscriptions to see your plans.
                          </p>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="mt-4"
                            onClick={() => setActiveTab('subscriptions')}
                          >
                            View subscriptions
                          </Button>
                        </div>
                      ) : (
                        <div className="space-y-6">
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                            <div>
                              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1.5">
                                Current plan
                              </p>
                              <p className="text-base font-semibold text-foreground">
                                {portalSummary.subscription.package?.name ||
                                  portalSummary.subscription.plan ||
                                  'Subscription'}
                              </p>
                            </div>
                            <div className="sm:text-right">
                              <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1.5">
                                This cycle
                              </p>
                              <p className="text-base font-semibold text-foreground">{portalSummary.cycle.label}</p>
                            </div>
                          </div>

                          {portalSummary.progress && portalSummary.progress.total > 0 && (
                            <div className="rounded-xl border border-border/60 bg-muted/15 p-4">
                              <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                                <span>Tasks in this cycle</span>
                                <span className="text-primary tabular-nums">{portalSummary.progress.percentage}%</span>
                              </div>
                              <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
                                <div
                                  className="h-full rounded-full bg-primary transition-all duration-700"
                                  style={{
                                    width: `${Math.min(100, Math.max(0, portalSummary.progress.percentage))}%`,
                                  }}
                                />
                              </div>
                              <p className="text-xs text-muted-foreground mt-2 tabular-nums">
                                {portalSummary.progress.completed} completed · {portalSummary.progress.total} total
                              </p>
                            </div>
                          )}

                          <div className="grid sm:grid-cols-2 gap-3 text-xs">
                            <div className="rounded-xl border border-border/50 p-4 bg-muted/5">
                              <p className="uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
                                Cycle window
                              </p>
                              <p className="text-sm text-foreground leading-relaxed">
                                {portalSummary.cycle.cycleStart ? formatDate(portalSummary.cycle.cycleStart) : '—'}
                                <span className="text-muted-foreground mx-1">to</span>
                                {portalSummary.cycle.cycleEnd ? formatDate(portalSummary.cycle.cycleEnd) : '—'}
                              </p>
                            </div>
                            <div className="rounded-xl border border-border/50 p-4 bg-muted/5">
                              <p className="uppercase tracking-[0.12em] text-muted-foreground font-semibold mb-2">
                                End Date
                              </p>
                              <p className="text-sm text-foreground">
                                {portalSummary.subscription.endDate
                                  ? formatDate(portalSummary.subscription.endDate)
                                  : 'To be confirmed'}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <h3 className="text-sm font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-6 md:mb-8">
                        Value &amp; savings
                      </h3>
                      {clientInvoices.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/70 bg-muted/5 px-8 py-16 text-center">
                          <p className="text-sm text-muted-foreground">Your summary will show here once billing starts.</p>
                        </div>
                      ) : (
                        <div className="space-y-5 md:space-y-6">
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, ease: 'easeOut' }}
                            className="rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.06] dark:bg-emerald-500/[0.09] px-8 py-12 md:px-12 md:py-14 text-center shadow-[0_1px_0_0_rgba(16,185,129,0.06)_inset]"
                          >
                            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700 dark:text-emerald-400 mb-5">
                              You saved
                            </p>
                            <p className="text-5xl sm:text-6xl md:text-7xl font-display font-bold text-emerald-600 dark:text-emerald-300 tracking-tight tabular-nums leading-none">
                              {formatCurrency(totalSaved)}
                            </p>
                            {savingsPercentOfMarket > 0 && (
                              <p className="mt-6">
                                <span className="inline-flex rounded-full bg-emerald-500/15 px-3.5 py-1 text-xs font-semibold text-emerald-800 dark:text-emerald-300 tabular-nums">
                                  {savingsPercentOfMarket}% below typical market
                                </span>
                              </p>
                            )}
                          </motion.div>

                          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 md:gap-6">
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: 0.05, ease: 'easeOut' }}
                              className="rounded-2xl border border-border/70 bg-card px-8 py-10 md:py-11"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                                Your investment
                              </p>
                              <p className="text-3xl sm:text-4xl font-display font-bold text-foreground tabular-nums tracking-tight">
                                {formatCurrency(yourInvestment)}
                              </p>
                            </motion.div>
                            <motion.div
                              initial={{ opacity: 0, y: 12 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' }}
                              className="rounded-2xl border border-border/70 bg-card px-8 py-10 md:py-11"
                            >
                              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground mb-4">
                                Market value
                              </p>
                              <p className="text-3xl sm:text-4xl font-display font-bold text-foreground tabular-nums tracking-tight">
                                {formatCurrency(estimatedMarketValue)}
                              </p>
                            </motion.div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <h3 className="text-lg font-display font-semibold text-foreground mb-4">Social &amp; content</h3>
                      <div className="space-y-3">
                        {(
                          [
                            {
                              label: 'Profiles connected',
                              value: profileCount,
                              tab: 'social' as const,
                            },
                            {
                              label: 'Posts planned (this month)',
                              value: plannerPosts.length,
                              tab: 'planner' as const,
                            },
                            {
                              label: 'Deliverables completed',
                              value: taskStats.completedVisible,
                              tab: 'social' as const,
                            },
                            {
                              label: 'Tasks in progress',
                              value: taskStats.inProgress,
                              tab: 'social' as const,
                            },
                          ] as const
                        ).map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setActiveTab(item.tab)}
                            className="w-full flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-muted/15 hover:border-primary/20 transition-colors text-left"
                          >
                            <span className="text-sm text-muted-foreground">{item.label}</span>
                            <span className="text-xl font-display font-bold text-foreground tabular-nums shrink-0">
                              {item.value}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="bg-card rounded-xl border border-border shadow-sm p-6">
                      <h3 className="text-lg font-display font-semibold text-foreground mb-4">Quick Access</h3>
                      <div className="grid grid-cols-2 gap-3">
                        {[
                          { label: 'Projects', icon: <Briefcase className="h-4 w-4" />, tab: 'projects' },
                          { label: 'Subscriptions', icon: <Zap className="h-4 w-4" />, tab: 'subscriptions' },
                          { label: 'Social', icon: <Share2 className="h-4 w-4" />, tab: 'social' },
                          { label: 'Financials', icon: <Receipt className="h-4 w-4" />, tab: 'financials' },
                          { label: 'Documents', icon: <FileText className="h-4 w-4" />, tab: 'documents' },
                          { label: 'Planner', icon: <Calendar className="h-4 w-4" />, tab: 'planner' },
                        ].map((item) => (
                          <button
                            key={item.label}
                            type="button"
                            onClick={() => setActiveTab(item.tab)}
                            className="p-3 rounded-lg border border-border/50 bg-muted/10 hover:bg-primary/10 hover:border-primary/20 transition-colors text-sm font-medium text-foreground flex items-center gap-2"
                          >
                            {item.icon}
                            {item.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

              </motion.div>
            )}
            {/* Account Tab */}
            {activeTab === 'account' && (
              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                  <div className="flex items-center justify-between gap-3 mb-6">
                    <h2 className="text-xl font-display font-bold text-foreground flex items-center gap-2">
                      <User className="h-5 w-5 text-primary" />
                      My Account Information
                    </h2>
                    <Badge variant="outline">{displayClient.status}</Badge>
                  </div>

                  <div className="grid md:grid-cols-2 gap-5">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Contact Name</label>
                      <Input value={accountForm.name} onChange={(e) => setAccountForm((p) => ({ ...p, name: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Company</label>
                      <Input value={accountForm.company} onChange={(e) => setAccountForm((p) => ({ ...p, company: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                      <Input type="email" value={accountForm.email} onChange={(e) => setAccountForm((p) => ({ ...p, email: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phone</label>
                      <Input value={accountForm.phone} onChange={(e) => setAccountForm((p) => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Website</label>
                      <Input value={accountForm.website} onChange={(e) => setAccountForm((p) => ({ ...p, website: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Address</label>
                      <Input value={accountForm.address} onChange={(e) => setAccountForm((p) => ({ ...p, address: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">City</label>
                      <Input value={accountForm.city} onChange={(e) => setAccountForm((p) => ({ ...p, city: e.target.value }))} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Country</label>
                      <Input value={accountForm.country} onChange={(e) => setAccountForm((p) => ({ ...p, country: e.target.value }))} />
                    </div>
                  </div>

                  <div className="mt-6 flex items-center gap-3">
                    <Button
                      onClick={async () => {
                        setAccountSaveMessage(null);
                        setIsSavingAccount(true);
                        try {
                          await apiFetch('/clients/me', {
                            method: 'PUT',
                            body: JSON.stringify({
                              name: accountForm.name,
                              company: accountForm.company,
                              email: accountForm.email,
                              phone: accountForm.phone,
                              website: accountForm.website,
                              address: accountForm.address,
                              city: accountForm.city,
                              country: accountForm.country,
                            }),
                          });
                          await fetchAllData();
                          setAccountSaveMessage('Account information updated successfully.');
                        } catch (error) {
                          console.error(error);
                          setAccountSaveMessage('Unable to update your account information. Please try again.');
                        } finally {
                          setIsSavingAccount(false);
                        }
                      }}
                      disabled={isSavingAccount}
                      className="gap-2"
                    >
                      {isSavingAccount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {isSavingAccount ? 'Saving...' : 'Save Changes'}
                    </Button>
                    {accountSaveMessage && (
                      <p className="text-sm text-muted-foreground">{accountSaveMessage}</p>
                    )}
                  </div>
                </div>

                {!isForcedPasswordChange && (
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                    <h2 className="text-xl font-display font-bold text-foreground mb-6">
                      Change Password
                    </h2>
                    <div className="grid md:grid-cols-3 gap-5">
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</label>
                        <Input
                          type="password"
                          autoComplete="current-password"
                          value={passwordForm.currentPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={passwordForm.newPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
                        <Input
                          type="password"
                          autoComplete="new-password"
                          value={passwordForm.confirmPassword}
                          onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                        />
                      </div>
                    </div>

                    <div className="mt-6 flex items-center gap-3">
                      <Button
                        onClick={handlePasswordChange}
                        disabled={isChangingPassword}
                        className="gap-2"
                      >
                        {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        {isChangingPassword ? 'Updating...' : 'Update Password'}
                      </Button>
                      {passwordMessage && (
                        <p className="text-sm text-muted-foreground">{passwordMessage}</p>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
            {/* Financials Tab */}
            {activeTab === 'financials' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-6"
                >
                  <div>
                    <h2 className="text-xl font-display font-bold text-foreground mb-6">Invoices</h2>
                    {clientInvoices.length === 0 ? (
                      <div className="bg-card rounded-xl border border-dashed border-border shadow-sm p-12 text-center">
                        <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Invoices Yet</h3>
                        <p className="text-muted-foreground text-sm">You don't have any invoices at the moment.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientInvoices.map((invoice, i) => (
                          <motion.div
                            key={invoice.id}
                            variants={fadeIn}
                            initial="hidden"
                            animate="visible"
                            custom={i}
                            onClick={() => handleDownloadDirect({ type: 'Invoice', data: invoice })}
                            className="bg-card cursor-pointer rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 overflow-hidden group"
                          >
                            <div className="p-5 md:p-6">
                              <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/15 transition-colors">
                                    <Receipt className="h-6 w-6 text-primary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h4 className="text-base font-display font-semibold text-foreground">{invoice.id}</h4>
                                      <StatusBadge status={invoice.status} />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> {formatDate(invoice.date)}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> Due: {formatDate(invoice.dueDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadDirect({ type: 'Invoice', data: invoice }); }}>
                                    <Download className="h-4 w-4 mr-2" /> Download
                                  </Button>
                                </div>
                              </div>

                              {invoice.items && invoice.items.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-border/50">
                                  <div className="space-y-2 text-sm">
                                    {invoice.items.slice(0, 3).map((item, idx) => (
                                      <div key={idx} className="flex items-center justify-between">
                                        <span className="text-muted-foreground truncate">{item.description}</span>
                                        <span className="font-medium text-foreground ml-2 shrink-0">{item.quantity} × {formatCurrency(item.unitPrice)}</span>
                                      </div>
                                    ))}
                                    {invoice.items.length > 3 && (
                                      <p className="text-xs text-muted-foreground pt-2">{invoice.items.length - 3} more items...</p>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <h2 className="text-xl font-display font-bold text-foreground mb-6">Proformas ({clientProformas.length})</h2>
                    {clientProformas.length === 0 ? (
                      <div className="bg-card rounded-xl border border-dashed border-border shadow-sm p-12 text-center">
                        <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                        <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Proformas</h3>
                        <p className="text-muted-foreground text-sm">You don't have any proforma invoices at the moment.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {clientProformas.map((proforma, i) => (
                          <motion.div
                            key={proforma.id}
                            variants={fadeIn}
                            initial="hidden"
                            animate="visible"
                            custom={i}
                            onClick={() => handleDownloadDirect({ type: 'Proforma', data: proforma })}
                            className="bg-card cursor-pointer rounded-xl border border-border shadow-sm hover:shadow-md hover:border-secondary/20 transition-all duration-300 overflow-hidden group"
                          >
                            <div className="p-5 md:p-6">
                              <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                                <div className="flex items-center gap-4 flex-1">
                                  <div className="w-12 h-12 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0 group-hover:bg-secondary/15 transition-colors">
                                    <FileText className="h-6 w-6 text-secondary" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-1">
                                      <h4 className="text-base font-display font-semibold text-foreground">{proforma.id}</h4>
                                      <StatusBadge status={proforma.status} />
                                    </div>
                                    <div className="flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3.5 w-3.5" /> {formatDate(proforma.date)}
                                      </span>
                                      <span className="flex items-center gap-1">
                                        <Clock className="h-3.5 w-3.5" /> Due: {formatDate(proforma.dueDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-2">
                                  <p className="text-2xl font-display font-bold text-foreground">{formatCurrency(proforma.amount)}</p>
                                  <Button variant="outline" size="sm" onClick={(e) => { e.stopPropagation(); handleDownloadDirect({ type: 'Proforma', data: proforma }); }}>
                                    <Download className="h-4 w-4 mr-2" /> Download
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
            )}

            {/* Projects Tab */}
            {activeTab === 'projects' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl font-display font-bold text-foreground mb-6">Active & Completed Projects</h2>
                  {clientProjects.length === 0 ? (
                    <div className="bg-card rounded-xl border border-dashed border-border shadow-sm p-12 text-center">
                      <Briefcase className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Projects Found</h3>
                      <p className="text-muted-foreground text-sm">Your ongoing and completed projects will appear here.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {clientProjects.map((proj, i) => (
                        <motion.div
                          key={proj.id}
                          variants={fadeIn}
                          initial="hidden"
                          animate="visible"
                          custom={i}
                          className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md hover:border-primary/20 p-6 transition-all duration-300 group"
                        >
                          <div className="flex items-start justify-between mb-4">
                            <Badge variant="outline" className="text-[10px] font-bold uppercase tracking-wider bg-primary/5 text-primary border-primary/10">
                              {proj.status}
                            </Badge>
                            <span className="text-xs font-medium text-muted-foreground">{proj.dueDate ? `Due: ${formatDate(proj.dueDate)}` : 'No due date'}</span>
                          </div>
                          <h4 className="text-lg font-display font-bold text-foreground group-hover:text-primary transition-colors mb-2">{proj.name}</h4>
                          <p className="text-sm text-muted-foreground line-clamp-2 mb-6 h-10">{proj.description || 'No description provided.'}</p>

                          <div className="space-y-3 pt-4 border-t border-border/50">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-bold text-muted-foreground uppercase tracking-widest">Progress</span>
                              <span className="font-display font-black text-primary">{proj.progress}%</span>
                            </div>
                            <div className="w-full bg-muted/50 rounded-full h-2 overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${proj.progress}%` }}
                                transition={{ duration: 1.5, ease: 'easeOut' }}
                                className="bg-primary h-full rounded-full"
                              />
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
            )}

            {/* Subscriptions Tab */}
            {activeTab === 'subscriptions' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl font-display font-bold text-foreground mb-6">Active Subscriptions</h2>
                  {clientSubscriptions.length === 0 ? (
                    <div className="bg-card rounded-xl border border-dashed border-border shadow-sm p-12 text-center">
                      <Zap className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                      <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Active Subscriptions</h3>
                      <p className="text-muted-foreground text-sm">Contact your account manager to start a new service subscription.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {clientSubscriptions.map((sub, i) => (
                        <motion.div
                          key={sub.id}
                          variants={fadeIn}
                          initial="hidden"
                          animate="visible"
                          custom={i}
                          className="bg-card rounded-xl border border-border shadow-sm hover:shadow-md p-6 transition-all duration-300"
                        >
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                            <div className="flex items-start gap-4 flex-1">
                              <div className="w-12 h-12 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                                <Zap className="h-6 w-6 text-amber-600" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-3 mb-2">
                                  <h4 className="text-lg font-display font-bold text-foreground">{sub.plan}</h4>
                                  <Badge variant="outline" className="text-[9px] font-bold uppercase bg-emerald-500/5 text-emerald-600 border-emerald-500/10">
                                    {sub.status}
                                  </Badge>
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {sub.billingCycle} billing cycle
                                </p>
                                <p className="text-xs text-muted-foreground/70 mt-1">End Date: {sub.endDate === 'N/A' ? 'N/A' : formatDate(sub.endDate)}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <p className="text-2xl font-display font-bold text-foreground">{sub.amount}</p>
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Start Date {formatDate(sub.startDate)}</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </motion.div>
            )}

            {/* Social Tab */}
            {activeTab === 'social' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="space-y-8"
                >
                  {clientSubscriptions.filter((s: any) => s.status === 'Active' && s.cycles && s.cycles.length > 0).map((sub: any) => {
                    const currentCycle = sub.cycles?.[0];
                    if (!currentCycle) return null;

                    return (
                      <div key={sub.id} className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20 rounded-xl p-6 md:p-8 shadow-sm relative overflow-hidden">
                        <div className="absolute top-0 right-0 p-8 opacity-5">
                          <Zap className="w-32 h-32 text-primary" />
                        </div>
                        <div className="relative z-10 flex flex-col md:flex-row gap-6 md:items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="secondary" className="bg-primary/20 text-primary border-0 text-[10px] uppercase font-bold tracking-widest">{sub.plan}</Badge>
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Active Subscription</span>
                            </div>
                            <h3 className="text-2xl font-display font-bold text-foreground mb-1">{currentCycle.label} Deliverables</h3>
                            <p className="text-sm text-muted-foreground">
                              {new Date(currentCycle.cycleStart).toLocaleDateString()} – {new Date(currentCycle.cycleEnd).toLocaleDateString()}
                            </p>
                          </div>

                          <div className="bg-card w-full md:w-72 rounded-xl p-4 border border-border/50 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                              <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Cycle Progress</span>
                              <span className="text-sm font-display font-black text-primary">{currentCycle.progress}%</span>
                            </div>
                            <div className="w-full bg-muted/50 rounded-full h-2.5 mb-2 overflow-hidden">
                              <div className="bg-primary h-2.5 rounded-full transition-all duration-1000" style={{ width: `${currentCycle.progress}%` }} />
                            </div>
                            <p className="text-[10px] text-muted-foreground font-medium text-right uppercase tracking-wider">
                              {currentCycle.completedTasks} of {currentCycle.totalTasks} Tasks Completed
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                      <Share2 className="h-5 w-5 text-primary" /> Social Media Profiles
                    </h3>
                    {portalData?.socialProfiles.length === 0 ? (
                      <p className="text-sm text-muted-foreground italic">No social media profiles are currently tracked for your account.</p>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {portalData?.socialProfiles.map(p => (
                          <div key={p.id} className="p-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 hover:border-primary/20 transition-all flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <Share2 className="h-5 w-5 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-foreground">{p.platform}</p>
                              <p className="text-xs text-muted-foreground truncate">{p.handle || 'No handle provided'}</p>
                            </div>
                            {p.profileUrl && (
                              <a href={p.profileUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary/80 shrink-0">
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                    <h3 className="text-lg font-display font-semibold text-foreground mb-4 flex items-center gap-2">
                      <CheckCircle2 className="h-5 w-5 text-emerald-500" /> Completed & Pending Deliverables
                    </h3>
                    {portalData?.tasks.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-sm text-muted-foreground italic">No deliverables available yet.</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {portalData?.tasks.map(t => (
                          <div key={t.id} className="p-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-foreground">{t.title}</p>
                                <p className="text-[10px] uppercase font-bold text-muted-foreground mt-1 tracking-wider">
                                  {t.status === 'WAITING_APPROVAL' ? (
                                    <span className="text-purple-600 bg-purple-500/10 px-2 py-0.5 rounded mr-2">Waiting Approval</span>
                                  ) : (
                                    <span className="text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded mr-2">Completed</span>
                                  )}
                                  {new Date(t.postedAt || t.createdAt).toLocaleDateString()}
                                </p>
                              </div>
                              <div className="flex items-center gap-1 ml-2">
                                {t.platforms?.map((plat: any, i: number) => (
                                  <Badge key={i} variant="secondary" className="text-[9px] uppercase px-1.5 py-0.5 border-border">{plat.platform}</Badge>
                                ))}
                              </div>
                            </div>
                            {t.clientNotes && (
                              <p className="text-xs text-muted-foreground bg-background rounded-lg p-2 border border-border/40 mt-3 mb-3">
                                {t.clientNotes}
                              </p>
                            )}
                            <div className="flex flex-wrap items-center gap-2 mt-2">
                              {t.postUrl && (
                                <a href={t.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline">
                                  <ExternalLink className="h-3.5 w-3.5" /> View Live
                                </a>
                              )}
                              {t.proofUrl && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-6 px-2 text-[10px] font-bold gap-1 text-muted-foreground hover:text-primary"
                                  onClick={() => setSelectedPreviewDoc({
                                    title: t.title,
                                    fileUrl: t.proofUrl!,
                                  })}
                                >
                                  <Eye className="h-3 w-3" /> Proof
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
            )}

            {/* Planner Tab */}
            {activeTab === 'planner' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl font-display font-bold text-foreground mb-6">Content Planner</h2>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                      <div>
                        <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2 mb-2">
                          <Calendar className="h-5 w-5 text-primary" /> Monthly Planner
                        </h3>
                        <p className="text-sm text-muted-foreground">View planned content for the selected month</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => {
                            if (plannerMonth === 1) {
                              setPlannerMonth(12);
                              setPlannerYear((y) => y - 1);
                            } else {
                              setPlannerMonth((m) => m - 1);
                            }
                          }}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <div className="px-4 py-2 rounded-lg bg-muted/40 text-sm font-semibold min-w-[160px] text-center">
                          {new Date(plannerYear, plannerMonth - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-9 px-3"
                          onClick={() => {
                            if (plannerMonth === 12) {
                              setPlannerMonth(1);
                              setPlannerYear((y) => y + 1);
                            } else {
                              setPlannerMonth((m) => m + 1);
                            }
                          }}
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    {isPlannerLoading ? (
                      <div className="py-12 flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : plannerPosts.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-lg">
                        <Calendar className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No planned posts for this month.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {plannerPosts.map((post) => (
                          <div key={post.id} className="p-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-foreground">{post.title}</p>
                                <div className="flex flex-wrap items-center gap-2 mt-2">
                                  <Badge variant="outline" className="text-[10px] uppercase font-bold">{post.platform}</Badge>
                                  <Badge variant="secondary" className="text-[10px] uppercase font-bold">{post.status}</Badge>
                                </div>
                              </div>
                              <div className="text-xs text-muted-foreground shrink-0">
                                {post.publishDate ? `Publish: ${formatDate(post.publishDate)}` : "Publish date not set"}
                              </div>
                            </div>
                            {post.notes ? (
                              <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{post.notes}</p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
            )}

            {/* Documents Tab */}
            {activeTab === 'documents' && (
              isForcedPasswordChange ? null :
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                >
                  <h2 className="text-xl font-display font-bold text-foreground mb-6">Shared Documents</h2>
                  <div className="bg-card rounded-xl border border-border shadow-sm p-6 md:p-8">
                    {portalData?.documents.length === 0 ? (
                      <div className="text-center py-12 border-2 border-dashed border-border/50 rounded-lg">
                        <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                        <p className="text-sm font-medium text-muted-foreground">No documents available</p>
                        <p className="text-xs text-muted-foreground/60 mt-1">Documents shared by the agency will appear here.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {portalData?.documents.map((doc: any) => {
                          const fileUrlStr = doc.fileUrl;

                          return (
                            <div key={doc.id} className="p-4 rounded-lg border border-border/50 bg-muted/10 hover:bg-muted/30 transition-colors flex items-center justify-between flex-col sm:flex-row gap-4">
                              <div className="flex items-start gap-4 flex-1 w-full">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                  <FileText className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-foreground">{doc.title}</p>
                                  <div className="flex items-center gap-2 mt-1">
                                    <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground border-border">{doc.type}</Badge>
                                    <span className="text-[10px] text-muted-foreground">Added {new Date(doc.createdAt).toLocaleDateString()}</span>
                                  </div>
                                  {doc.clientNotes && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{doc.clientNotes}</p>}
                                </div>
                              </div>
                              {fileUrlStr && (
                                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-2 h-9 flex-1 sm:flex-none"
                                    onClick={() => setSelectedPreviewDoc({
                                      title: doc.title,
                                      fileUrl: fileUrlStr,
                                      type: doc.type
                                    })}
                                  >
                                    <Eye className="h-3.5 w-3.5" /> View
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-9 w-9"
                                    onClick={() => downloadProtectedFile(fileUrlStr, doc.title)}
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </motion.div>
            )}
          </div>
        </main>

        {/* Footer */}
        <footer className="border-t border-border mt-12 bg-muted/20">
          <div className="px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
            <p>© 2026 {settings.agencyName}. All rights reserved.</p>
            <div className="flex flex-wrap items-center justify-center md:justify-end gap-4">
              {settings.phone && <span>{settings.phone}</span>}
              {settings.adminEmail && <span>{settings.adminEmail}</span>}
            </div>
          </div>
        </footer>
      </div>

      {/* Document Viewer Modal */}
      <Dialog
        open={isFirstLoginModalOpen}
        onOpenChange={(open) => {
          if (!isForcedPasswordChange) {
            setIsFirstLoginModalOpen(open);
          }
        }}
      >
        <DialogContent className="sm:max-w-xl" onInteractOutside={(e) => isForcedPasswordChange && e.preventDefault()}>
          <DialogHeader>
            <DialogTitle>Change your password</DialogTitle>
            <DialogDescription>
              Change your temporary password to continue.
            </DialogDescription>
          </DialogHeader>

          {!showForcedPasswordForm ? (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                You only need to do this once.
              </p>
              <Button className="w-full" onClick={() => setShowForcedPasswordForm(true)}>
                Change Password
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Current Password</label>
                <Input
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, currentPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, newPassword: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Confirm New Password</label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm((p) => ({ ...p, confirmPassword: e.target.value }))}
                />
              </div>
              {passwordMessage && (
                <p className="text-sm text-muted-foreground">{passwordMessage}</p>
              )}
              <Button className="w-full gap-2" onClick={handlePasswordChange} disabled={isChangingPassword}>
                {isChangingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {isChangingPassword ? 'Saving...' : 'Save New Password'}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Preview modal removed as per user request */}

      {/* General Document Viewer */}
      <DocumentViewer
        isOpen={!!selectedPreviewDoc}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />

      <div className="fixed -left-[9999px] top-0 pointer-events-none" aria-hidden="true">
        {activeDownloadDocument && (
          <div ref={downloadRef}>
            <PremiumInvoice
              type={activeDownloadDocument.type}
              data={activeDownloadDocument.data}
              settings={settings}
            />
          </div>
        )}
      </div>
    </div>
  );
}

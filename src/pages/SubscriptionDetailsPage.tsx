import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft, Mail, Printer, Download, Share2,
  Settings, User, Clock, CreditCard,
  MapPin, Building2, ChevronRight, CheckCircle2,
  FileText, TrendingUp, Calendar, Zap, AlertTriangle, Package as PackageIcon, ShieldCheck,
  Activity, Bell, RefreshCw
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, normalizeFeatureList } from "@/lib/utils";
import { apiFetch } from "@/lib/api-client";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DetailPageSkeleton } from "@/components/ui/PageSkeleton";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles, Plus, Image, Video, SwitchCamera, ListFilter, Brain, Wand2 } from "lucide-react";
import { Trash2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { getShortVerificationUrl } from "@/lib/short-url";
import { QRCodeSVG } from "qrcode.react";
import { Copy, ExternalLink, ShieldCheck as VerifiedIcon } from "lucide-react";

export default function SubscriptionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { subscriptions, clients, packages, services, getVerificationToken, settings, fetchSubscriptions, fetchClients, fetchPackages, fetchServices } = useAgencyStore();
  const [verificationToken, setVerificationToken] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const [cycles, setCycles] = useState<any[]>([]);
  const [loadingCycles, setLoadingCycles] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    cycleStart: "", cycleEnd: "", label: "",
    useAi: true, prompt: "",
  });
  const [generating, setGenerating] = useState(false);
  const [runningBilling, setRunningBilling] = useState(false);

  const handleRunBillingCycle = async () => {
    try {
      setRunningBilling(true);
      const res = await apiFetch<{ success: boolean; message: string }>("/subscriptions/run-billing-cycle", {
        method: "POST",
      });
      if (res.success) {
        toast({
          title: "Billing Check Executed",
          description: res.message || "Manual check completed.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Billing Check Failed",
        description: err.message || "Could not run manual billing cycle",
        variant: "destructive",
      });
    } finally {
      setRunningBilling(false);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const promises = [];
        if (subscriptions.length === 0) promises.push(fetchSubscriptions());
        if (clients.length === 0) promises.push(fetchClients());
        if (packages.length === 0) promises.push(fetchPackages());
        if (services.length === 0) promises.push(fetchServices());
        if (promises.length > 0) {
          await Promise.all(promises);
        }
      } catch (err) {
        console.error("Error loading subscription details dependencies:", err);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, [id, fetchSubscriptions, fetchClients, fetchPackages, fetchServices, subscriptions.length, clients.length, packages.length, services.length]);

  useEffect(() => {
    if (id) {
      getVerificationToken("subscription", id).then(setVerificationToken);
    }
  }, [id, getVerificationToken]);

  useEffect(() => {
    if (id) {
      setLoadingCycles(true);
      apiFetch<{ subscription: any }>(`/subscriptions/${id}`).then(res => {
        if (res.subscription && res.subscription.cycles) {
          setCycles(res.subscription.cycles);
        }
      }).catch(err => {
        console.error("Failed to fetch subscription cycles:", err);
      }).finally(() => {
        setLoadingCycles(false);
      });
    }
  }, [id]);

  useEffect(() => {
    if (generateForm.cycleStart) {
      const d = new Date(generateForm.cycleStart);
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      setGenerateForm(prev => ({ ...prev, label }));
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setGenerateForm(prev => ({ ...prev, cycleEnd: end.toISOString().split("T")[0] }));
    }
  }, [generateForm.cycleStart]);

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await apiFetch<{ count: number; cycle: any }>("/tasks/generate", {
        method: "POST",
        body: JSON.stringify({
          subscriptionId: id,
          cycleStart: generateForm.cycleStart,
          cycleEnd: generateForm.cycleEnd,
          label: generateForm.label,
          useAi: generateForm.useAi,
          ...(generateForm.useAi ? {
            prompt: generateForm.prompt || undefined,
          } : {}),
        }),
      });
      setShowGenerate(false);
      setGenerateForm({
        cycleStart: "", cycleEnd: "", label: "",
        useAi: true, prompt: "",
      });
      toast({
        title: generateForm.useAi ? "AI tasks generated!" : "Tasks generated!",
        description: `${res.count} deliverable tasks created for ${res.cycle.label}.`,
      });

      // refresh cycles
      const refreshRes = await apiFetch<{ subscription: any }>(`/subscriptions/${id}`);
      if (refreshRes.subscription?.cycles) {
        setCycles(refreshRes.subscription.cycles);
      }
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Could not generate tasks", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const handleDeleteCycle = async (cycle: any) => {
    const confirmed = window.confirm(
      `Delete ${cycle.label}? This will remove generated tasks and auto-generated planner posts for that month.`
    );
    if (!confirmed) return;

    try {
      await apiFetch(`/tasks/cycles/${cycle.id}`, { method: "DELETE" });
      toast({ title: "Cycle deleted", description: `${cycle.label} generated tasks were removed.` });
      const refreshRes = await apiFetch<{ subscription: any }>(`/subscriptions/${id}`);
      if (refreshRes.subscription?.cycles) {
        setCycles(refreshRes.subscription.cycles);
      }
    } catch (err: any) {
      toast({
        title: "Delete failed",
        description: err.message || "Could not delete this cycle",
        variant: "destructive",
      });
    }
  };

  const subscription = useMemo(() => subscriptions.find((s) => s.id === id), [subscriptions, id]);
  const client = useMemo(() => clients.find((c) => c.company === subscription?.client || c.name === subscription?.client), [clients, subscription]);

  const linkedPackage = useMemo(() =>
    packages.find(p => p.id === subscription?.packageId),
    [packages, subscription]
  );

  const linkedService = useMemo(() =>
    services.find(s => s.id === subscription?.serviceId),
    [services, subscription]
  );

  if (isLoading) {
    return <DetailPageSkeleton />;
  }

  if (!subscription) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Subscription not found</h2>
        <Button onClick={() => navigate("/dashboard/subscriptions")}>Back to Subscriptions</Button>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === 'Active' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === 'Paused' ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
      s === 'Cancelled' ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
      s === 'Ended' ? "bg-slate-100 text-slate-600 dark:bg-slate-900/30 dark:text-slate-400" :
        "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 hover:bg-primary/5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{subscription.plan} Plan</h1>
              <Badge className={`${statusColor(subscription.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`} variant="outline">{subscription.status}</Badge>
            </div>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
              Ref: <span className="text-foreground">{subscription.id}</span> · End Date <span className="text-foreground">{subscription.endDate}</span>
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunBillingCycle}
            disabled={runningBilling}
            className="h-9 gap-2 text-xs font-semibold border-amber-200 text-amber-700 bg-amber-50/50 hover:bg-amber-50"
          >
            {runningBilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Run Billing Check
          </Button>
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/subscriptions/edit/${subscription.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Manage Subscription
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Linked Item Banner */}
          {(linkedPackage || linkedService) && (
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border border-primary/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-8 opacity-[0.03] group-hover:scale-110 transition-transform">
                {linkedPackage ? <PackageIcon className="w-24 h-24" /> : <ShieldCheck className="w-24 h-24" />}
              </div>
              <div className="flex items-center gap-5">
                <div className="h-16 w-16 rounded-2xl bg-white dark:bg-zinc-900 shadow-sm flex items-center justify-center border border-border/50 shrink-0">
                  {linkedPackage ? <PackageIcon className="h-8 w-8 text-primary" /> : <ShieldCheck className="h-8 w-8 text-emerald-500" />}
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-primary/70">Linked {linkedPackage ? 'Package' : 'Service'}</p>
                    <Badge variant="secondary" className="text-[8px] h-4 font-black uppercase tracking-widest">{linkedPackage ? linkedPackage.type : linkedService?.category}</Badge>
                  </div>
                  <h3 className="text-xl font-display font-bold text-foreground">{linkedPackage?.name || linkedService?.name}</h3>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{linkedPackage?.description || linkedService?.description}</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-xl h-10 px-4 gap-2 text-xs font-bold border border-border/40 bg-background/50 backdrop-blur-sm group-hover:bg-primary group-hover:text-white transition-all shadow-sm"
                onClick={() => navigate(linkedPackage ? `/dashboard/packages/view/${linkedPackage.id}` : `/dashboard/services/view/${linkedService?.id}`)}
              >
                View Details <ArrowLeft className="h-3.5 w-3.5 rotate-180" />
              </Button>
            </div>
          )}

          {/* Subscription Summary */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-blue-400/40 via-blue-400/10 to-transparent" />
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Plan Features & Billing
              </CardTitle>
              <CardDescription>Overview of the current subscription structure</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                <div className="space-y-5">
                  {[
                    { icon: CreditCard, label: "Subscription Fee", value: `${formatCurrency(subscription.amount)} / ${subscription.billingCycle}` },
                    { icon: Calendar, label: "Start Date", value: subscription.startDate },
                    { icon: Clock, label: "End Date", value: subscription.endDate },
                  ].map((item, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border border-border/40 group-hover:border-primary/20 transition-colors">
                        <item.icon className="h-4 w-4 text-muted-foreground/80" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                      </div>
                    </div>
                  ))}

                  <div className="pt-4 border-t border-border/40 mt-4 space-y-3">
                    <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">Automated Billing Rules</p>
                    <div className="space-y-2 text-xs font-semibold text-foreground/80">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-primary" />
                        <span>Invoice Day: Day {client?.invoiceGenerationDay ?? 1} of month</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Bell className="w-3.5 h-3.5 text-primary" />
                        <span>Reminder Grace: {client?.paymentReminderDelay ?? 5} days</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-3.5 h-3.5 text-primary" />
                        <span>Overdue Notice: {client?.overdueNoticeDelay ?? 10} days</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="space-y-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Included Services</h4>
                  <div className="space-y-3">
                    {normalizeFeatureList(subscription.features).length > 0 ? (
                      normalizeFeatureList(subscription.features).map((feature, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm text-foreground/80 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          {feature}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Standard plan features apply.</p>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 bg-muted/10 rounded-xl border border-dashed border-border/60">
                <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">Internal Subscription Notes</p>
                <p className="text-xs text-muted-foreground italic leading-relaxed">
                  {subscription.notes || "No specific administrative notes recorded for this subscription instance."}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Cycle Progress Widget */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-2 border-t-amber-500/20">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <ListFilter className="h-4 w-4 text-amber-500" /> Billing Cycles & Deliverables
              </CardTitle>
              <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => setShowGenerate(true)}>
                <Sparkles className="h-3.5 w-3.5" /> Generate Tasks
              </Button>
            </CardHeader>
            <CardContent className="p-0">
              {loadingCycles ? (
                <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
              ) : cycles.length === 0 ? (
                <div className="text-center py-12 px-4">
                  <PackageIcon className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">No tasks generated yet</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Generate a cycle to auto-create deliverable tasks for this subscription.</p>
                </div>
              ) : (
                <div className="divide-y divide-border/40">
                  {cycles.map((cycle) => (
                    <div key={cycle.id} className="p-5 hover:bg-muted/30 transition-colors">
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <p className="font-bold text-foreground text-sm">{cycle.label}</p>
                          <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mt-0.5">
                            {new Date(cycle.cycleStart).toLocaleDateString()} – {new Date(cycle.cycleEnd).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-display font-black text-primary">{cycle.progress || 0}%</p>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{cycle.completedTasks || 0} / {cycle.totalTasks || 0} Done</p>
                        </div>
                      </div>
                      <Progress value={cycle.progress || 0} className="h-2 mb-2" />
                      <div className="flex items-center justify-end gap-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-[10px] font-bold uppercase text-red-500 hover:text-red-600 hover:bg-red-500/10"
                          onClick={() => handleDeleteCycle(cycle)}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Delete Month
                        </Button>
                        <Button variant="link" size="sm" className="h-6 px-0 text-[10px] font-bold uppercase" onClick={() => navigate('/dashboard/social-media')}>
                          View Tasks &rarr;
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Client Quick Lookup */}
          {client && (
            <Card className="border-border/50 shadow-sm overflow-hidden border-t-2 border-t-blue-500/20">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <User className="w-4 h-4 text-blue-500" /> Account Holder
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 flex items-center justify-center bg-primary/10 text-primary font-black rounded-lg text-xs leading-none">
                    {client.initials}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{client.company || client.name}</h4>
                    <p className="text-[11px] text-muted-foreground font-medium">{client.email}</p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  className="w-full text-xs font-bold h-9 group"
                  onClick={() => navigate(`/dashboard/clients/view/${client.id}`)}
                >
                  View Client Profile
                  <ChevronRight className="w-3.5 h-3.5 ml-1 transition-transform group-hover:translate-x-0.5" />
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Quick Actions / Alerts */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="p-4 bg-muted/10 border-b border-border/40">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Subscription Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="p-4 bg-emerald-500/5 rounded-xl border border-emerald-500/10 space-y-1">
                <div className="flex items-center gap-2 text-emerald-600">
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Healthy Account</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">All payments finalized. High usage activity recorded within the last 7 days.</p>
              </div>

              <div className="p-4 bg-blue-500/5 rounded-xl border border-blue-500/10 space-y-1">
                <div className="flex items-center gap-2 text-blue-600">
                  <TrendingUp className="w-4 h-4" />
                  <span className="text-xs font-bold uppercase">Upgrade Potential</span>
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">Usage is nearing 85% of plan capacity. Recommend Business plan upgrade.</p>
              </div>
            </CardContent>
          </Card>

          {/* Verification Card */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-2 border-t-emerald-500/20">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-display flex items-center gap-2">
                <VerifiedIcon className="w-4 h-4 text-emerald-500" /> Digital Verification
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5 flex flex-col items-center">
              {verificationToken ? (
                <>
                  <div className="p-3 bg-white rounded-2xl shadow-sm border border-border/50 mb-4">
                    <QRCodeSVG
                      value={getShortVerificationUrl(verificationToken)}
                      size={140}
                      level="H"
                      fgColor={settings.primaryColor || "#000000"}
                      bgColor="transparent"
                    />
                  </div>
                  <div className="w-full space-y-2">
                    <Button
                      variant="outline"
                      className="w-full h-9 text-xs font-bold gap-2"
                      onClick={() => {
                        navigator.clipboard.writeText(getShortVerificationUrl(verificationToken));
                        toast({ title: "Link copied", description: "Verification URL copied to clipboard." });
                      }}
                    >
                      <Copy className="h-3.5 w-3.5" /> Copy Link
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full h-9 text-xs font-bold gap-2"
                      onClick={() => window.open(getShortVerificationUrl(verificationToken), "_blank")}
                    >
                      <ExternalLink className="h-3.5 w-3.5" /> View Public Page
                    </Button>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center py-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary opacity-20" />
                  <p className="text-[10px] text-muted-foreground mt-2">Generating secure token...</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Generate Tasks Modal */}
      <Dialog open={showGenerate} onOpenChange={setShowGenerate}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Generate Cycle Tasks
            </DialogTitle>
            <DialogDescription className="text-xs">
              Auto-create deliverable tasks and content planner entries for this subscription.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Cycle Start</Label>
                <Input
                  type="date"
                  value={generateForm.cycleStart}
                  onChange={e => setGenerateForm(prev => ({ ...prev, cycleStart: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label className="text-xs font-bold">Cycle End</Label>
                <Input
                  type="date"
                  value={generateForm.cycleEnd}
                  onChange={e => setGenerateForm(prev => ({ ...prev, cycleEnd: e.target.value }))}
                  className="mt-1.5"
                />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Cycle Label</Label>
              <Input
                placeholder="e.g. March 2026"
                value={generateForm.label}
                onChange={e => setGenerateForm(prev => ({ ...prev, label: e.target.value }))}
                className="mt-1.5"
              />
            </div>

            {/* AI Toggle */}
            <div
              className={`p-4 rounded-xl border-2 cursor-pointer transition-all ${
                generateForm.useAi
                  ? "border-purple-400/60 bg-gradient-to-r from-purple-500/5 to-pink-500/5"
                  : "border-border bg-muted/30"
              }`}
              onClick={() => setGenerateForm(prev => ({ ...prev, useAi: !prev.useAi }))}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${
                    generateForm.useAi ? "bg-purple-500/15" : "bg-muted"
                  }`}>
                    <Brain className={`h-4.5 w-4.5 ${
                      generateForm.useAi ? "text-purple-500" : "text-muted-foreground"
                    }`} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-foreground">AI-Powered Planning</p>
                    <p className="text-[10px] text-muted-foreground font-medium leading-tight mt-0.5">
                      Generate creative titles, descriptions & smart scheduling
                    </p>
                  </div>
                </div>
                <div className={`w-10 h-5.5 rounded-full transition-colors flex items-center px-0.5 ${
                  generateForm.useAi ? "bg-purple-500 justify-end" : "bg-muted-foreground/30 justify-start"
                }`}>
                  <div className="w-4.5 h-4.5 rounded-full bg-white shadow-sm transition-all" />
                </div>
              </div>
            </div>

            {/* AI Options (shown when AI is on) */}
            {generateForm.useAi && (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
                <div>
                  <Label className="text-xs font-bold flex items-center gap-1.5">
                    <Wand2 className="h-3 w-3 text-purple-500" /> Instructions for AI
                  </Label>
                  <Textarea
                    placeholder="e.g. Focus on our new summer collection, emphasize educational content about marketing, keep the tone informative..."
                    value={generateForm.prompt}
                    onChange={e => setGenerateForm(prev => ({ ...prev, prompt: e.target.value }))}
                    className="mt-1.5 min-h-[80px] resize-none text-xs"
                  />
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerate(false)}>Cancel</Button>
            <Button
              variant="hero"
              onClick={handleGenerate}
              disabled={generating || !generateForm.cycleStart || !generateForm.cycleEnd || !generateForm.label}
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating
                ? (generateForm.useAi ? "AI Generating..." : "Generating...")
                : (generateForm.useAi ? "Generate with AI" : "Generate Tasks")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

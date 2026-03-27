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
  Activity
} from "lucide-react";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency } from "@/lib/utils";

export default function SubscriptionDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { subscriptions, clients, packages, services } = useAgencyStore();

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
              Ref: <span className="text-foreground">{subscription.id}</span> · Next Renewal <span className="text-foreground">{subscription.renewal}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
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
            <div className="p-6 rounded-3xl bg-gradient-to-br from-primary/5 via-primary/5 to-transparent border border-primary/10 flex items-center justify-between relative overflow-hidden group">
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
                    { icon: Calendar, label: "Started Date", value: subscription.started },
                    { icon: Clock, label: "Next Billing", value: subscription.renewal },
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
                </div>
                <div className="space-y-5">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Included Services</h4>
                  <div className="space-y-3">
                    {subscription.features && subscription.features.length > 0 ? (
                      subscription.features.map((feature, i) => (
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

          {/* Usage History (Mocked) */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Subscription Usage & History
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Date</TableHead>
                    <TableHead className="font-bold text-xs">Activity</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase">Impact</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[
                    { date: "Mar 01, 2026", activity: "Monthly Renewal Finalized", impact: "Billing Successful" },
                    { date: "Feb 01, 2026", activity: "Monthly Renewal Finalized", impact: "Billing Successful" },
                    { date: "Jan 15, 2026", activity: "Plan Upgraded to Pro", impact: "Scope Increased" },
                    { date: subscription.started, activity: "Subscription Successfully Initialized", impact: "New Client Onboarded" },
                  ].map((act, i) => (
                    <TableRow key={i} className="border-border/30">
                      <TableCell className="text-xs font-medium text-muted-foreground">{act.date}</TableCell>
                      <TableCell className="text-sm font-bold text-foreground">{act.activity}</TableCell>
                      <TableCell className="text-right">
                         <Badge variant="outline" className="text-[9px] font-bold uppercase bg-muted/50 border-0">{act.impact}</Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
        </div>
      </div>
    </div>
  );
}

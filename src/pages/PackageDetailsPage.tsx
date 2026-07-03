import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Mail, Printer, Download, Share2, 
  Settings, User, Clock, CreditCard, 
  MapPin, Building2, ChevronRight, CheckCircle2,
  FileText, TrendingUp, Calendar, Zap, AlertTriangle, Layers, Tag, Briefcase,
  ShieldCheck
} from "lucide-react";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils";

export default function PackageDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { packages, subscriptions, services, projects } = useAgencyStore();

  const pkg = useMemo(() => packages.find((p) => p.id === id), [packages, id]);
  
  const relatedSubscriptions = useMemo(() => 
    subscriptions.filter((s) => s.packageId === pkg?.id || s.plan === pkg?.name), 
    [subscriptions, pkg]
  );

  const linkedServices = useMemo(() => {
    if (!pkg?.serviceIds) return [];
    return services.filter(s => pkg.serviceIds?.includes(s.id));
  }, [pkg, services]);

  if (!pkg) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Package not found</h2>
        <Button onClick={() => navigate("/dashboard/packages")}>Back to Packages</Button>
      </div>
    );
  }

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
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{pkg.name}</h1>
              <Badge className="bg-primary/10 text-primary border-primary/20 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider" variant="outline">{pkg.type}</Badge>
            </div>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
              Service Bundle · MSRP <span className="text-foreground">{formatCurrency(pkg.price)}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/packages/edit/${pkg.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Edit Package
          </Button>
          <Button variant="hero" size="sm" className="h-9 gap-2 text-xs font-semibold shadow-premium" onClick={() => navigate('/dashboard/subscriptions/add')}>
            <Briefcase className="h-3.5 w-3.5" /> Apply Template
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Package Core Details */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-4 border-t-primary/20">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Service Configuration
              </CardTitle>
              <CardDescription>Comprehensive bundle structure and deliverables</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="prose prose-sm max-w-none text-muted-foreground p-5 rounded-xl bg-muted/5 border border-border/40">
                <p className="text-sm italic leading-relaxed font-medium">
                  "{pkg.description || "No public description available for this service package."}"
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                <div className="space-y-4">
                  <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-4">Included Value</h4>
                  <div className="space-y-3">
                    {pkg.features && pkg.features.length > 0 ? (
                      pkg.features.map((feature, i) => (
                        <div key={i} className="flex items-center gap-3 text-sm text-foreground/80 font-semibold p-2 rounded-lg bg-emerald-500/5 group">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 transition-transform group-hover:scale-125" />
                          {feature}
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-muted-foreground italic">Standard service scope applies.</p>
                    )}
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 -mr-2 -mt-2 group-hover:scale-110 transition-transform">
                      <TrendingUp className="w-12 h-12 text-primary" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">Package MSRP</p>
                    <p className="text-3xl font-display font-black text-foreground">{formatCurrency(pkg.price)}</p>
                    <p className="text-[10px] text-muted-foreground mt-4 font-bold border-t border-primary/10 pt-4 uppercase tracking-[0.05em]">Optimized for {pkg.type} Workflow</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Linked Services Section */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-4 border-t-emerald-500/20">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-emerald-500" /> Linked Services
              </CardTitle>
              <CardDescription>Core agency services bundled in this package</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {linkedServices.map((service) => (
                  <div 
                    key={service.id} 
                    className="p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-primary/5 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/dashboard/services/view/${service.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{service.name}</p>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold text-muted-foreground">{service.category}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed mb-3">{service.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/40">
                      <span className="text-[10px] font-bold text-foreground/70 uppercase">Base Rate</span>
                      <span className="text-xs font-black text-primary">{formatCurrency(service.basePrice)}</span>
                    </div>
                  </div>
                ))}
                {linkedServices.length === 0 && (
                  <div className="col-span-full py-8 text-center bg-muted/20 rounded-xl border border-dashed">
                    <p className="text-sm text-muted-foreground italic">No specialized services linked to this bundle yet.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Monthly Deliverables Template */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-4 border-t-amber-500/20">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Share2 className="h-4 w-4 text-amber-500" /> Monthly Deliverables Template
              </CardTitle>
              <CardDescription>Standardized recurring outputs for this subscription tier</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {pkg.deliverables?.map((del, i) => (
                  <div key={i} className="p-5 rounded-xl border border-border/50 bg-muted/5 space-y-3 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-3 opacity-5 group-hover:opacity-10 transition-opacity">
                      <Zap className="w-10 h-10 text-amber-600" />
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-bold text-sm text-foreground">{del.name}</p>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest mt-0.5">{del.type}</p>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 text-[10px] font-black h-5 px-1.5 uppercase">
                        x{del.quantity} / mo
                      </Badge>
                    </div>
                    {del.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                        {del.description}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1 pt-2">
                      {del.platforms.map(p => (
                        <span key={p} className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-muted border border-border/50 text-muted-foreground uppercase tracking-tighter">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                {(!pkg.deliverables || pkg.deliverables.length === 0) && (
                  <div className="col-span-full py-12 text-center bg-muted/20 rounded-xl border border-dashed flex flex-col items-center">
                    <Share2 className="h-8 w-8 text-muted-foreground/20 mb-3" />
                    <p className="text-sm text-muted-foreground italic">No standardized deliverables defined for this package template.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Business Impact / Performance */}
          <Card className="border-border/50 shadow-sm relative overflow-hidden bg-zinc-950/5 dark:bg-zinc-100/5">
             <CardHeader className="bg-muted/10 pb-3 border-b border-border/40 px-8 py-5">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> Bundle Performance Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-8">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Adoption</p>
                  <p className="text-2xl font-bold font-display">{relatedSubscriptions.length} Clients</p>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black">
                    <TrendingUp className="w-2.5 h-2.5" /> +12% MoM
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Profit Margin</p>
                  <p className="text-2xl font-bold font-display">64%</p>
                  <div className="flex items-center gap-1 text-[10px] text-emerald-600 font-black">
                    <CheckCircle2 className="w-2.5 h-2.5" /> Optimal
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Satisfaction</p>
                  <p className="text-2xl font-bold font-display">4.9/5</p>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="w-1.5 h-1.5 rounded-full bg-amber-400" />)}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="p-4 bg-muted/10 border-b border-border/40">
              <CardTitle className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Strategic Information</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
               <div className="space-y-4">
                  {[
                    { label: "Target Client", value: "Mid-Market" },
                    { label: "Delivery Time", value: "Standardized" },
                    { label: "Service Level", value: "Premium" },
                  ].map((item, i) => (
                    <div key={i} className="flex justify-between items-center text-xs">
                      <span className="text-muted-foreground font-medium">{item.label}:</span>
                      <span className="font-bold text-foreground bg-muted/30 px-2 py-0.5 rounded uppercase tracking-tighter">{item.value}</span>
                    </div>
                  ))}
               </div>
               
               <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 space-y-2">
                  <div className="flex items-center gap-2 text-blue-600">
                    <Zap className="w-3.5 h-3.5" />
                    <span className="text-[10px] font-black uppercase tracking-widest">Automation Score</span>
                  </div>
                  <div className="h-1.5 w-full bg-blue-100 dark:bg-blue-900/30 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: '85%' }} />
                  </div>
                  <p className="text-[9px] text-muted-foreground font-medium">Highly scalable service bundle with automated delivery triggers.</p>
               </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
             <CardHeader className="p-4 border-b border-border/40">
              <CardTitle className="text-xs font-black uppercase tracking-widest text-muted-foreground">Recent Subscriptions</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {relatedSubscriptions.slice(0, 5).map((sub, i) => (
                  <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/dashboard/subscriptions/view/${sub.id}`)}>
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center text-[10px] font-bold text-muted-foreground uppercase">{sub.client.slice(0, 2)}</div>
                      <div className="space-y-0.5">
                        <p className="text-xs font-bold text-foreground leading-none group-hover:text-primary transition-colors">{sub.client.split(' ')[0]}</p>
                        <p className="text-[9px] text-muted-foreground uppercase">{formatDate(sub.startDate)}</p>
                      </div>
                    </div>
                    <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all" />
                  </div>
                ))}
                {relatedSubscriptions.length === 0 && (
                   <p className="text-[10px] text-muted-foreground italic text-center py-4">No active subscriptions <br/> on this plan yet.</p>
                )}
                {relatedSubscriptions.length > 5 && (
                  <Button variant="ghost" className="w-full h-8 text-[10px] font-bold uppercase tracking-widest text-primary border-t border-border/10 rounded-none">View All Adoptions</Button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

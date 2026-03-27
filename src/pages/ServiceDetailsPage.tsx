import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Mail, Printer, Download, Share2, 
  Settings, User, Clock, CreditCard, 
  MapPin, Building2, ChevronRight, CheckCircle2,
  FileText, TrendingUp, Calendar, Zap, AlertTriangle, Layers, Tag, Briefcase, Activity,
  Package as PackageIcon
} from "lucide-react";
import { useMemo } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function ServiceDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { services, projects, invoices, packages, subscriptions } = useAgencyStore();

  const service = useMemo(() => services.find((s) => s.id === id), [services, id]);
  
  const relatedProjects = useMemo(() => 
    projects.filter((p) => p.tags?.includes(service?.name || '') || p.tags?.includes(service?.category || '')), 
    [projects, service]
  );

  const includedInPackages = useMemo(() => 
    packages.filter(p => p.serviceIds?.includes(service?.id || '')),
    [packages, service]
  );

  const directSubscriptions = useMemo(() => 
    subscriptions.filter(s => s.serviceId === service?.id),
    [subscriptions, service]
  );

  const usageCount = useMemo(() => {
    return invoices.reduce((count, inv) => {
      const itemsMatching = inv.items?.filter(item => item.description.toLowerCase().includes(service?.name.toLowerCase() || '')) || [];
      return count + itemsMatching.length;
    }, 0);
  }, [invoices, service]);

  if (!service) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Service not found</h2>
        <Button onClick={() => navigate("/dashboard/services")}>Back to Services</Button>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === 'Available' ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

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
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{service.name}</h1>
              <Badge className={`${statusColor(service.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`} variant="outline">{service.status}</Badge>
            </div>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
              Service Catalog · Base <span className="text-foreground">{service.basePrice}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/services/edit/${service.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Edit Service
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Service Core Info */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400/40 via-emerald-400/10 to-transparent" />
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-emerald-500" /> Service Definition
              </CardTitle>
              <CardDescription>Official catalog entry and billing parameters</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4 space-y-8">
              <div className="prose prose-sm max-w-none text-muted-foreground p-5 rounded-xl bg-muted/5 border border-border/40">
                <p className="text-sm italic leading-relaxed font-medium">
                  "{service.description || "No public description available for this service."}"
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 pt-4">
                <div className="space-y-6">
                  {[
                    { icon: Tag, label: "Primary Category", value: service.category },
                    { icon: CreditCard, label: "Base Pricing Model", value: service.basePrice },
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
                <div className="space-y-6">
                  <div className="p-6 rounded-2xl bg-emerald-500/5 border border-emerald-500/10 relative group overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10 -mr-2 -mt-2 group-hover:scale-110 transition-transform">
                      <Activity className="w-12 h-12 text-emerald-500" />
                    </div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Catalog Status</p>
                    <p className="text-3xl font-display font-black text-foreground uppercase">{service.status}</p>
                    <p className="text-[10px] text-muted-foreground mt-4 font-bold border-t border-emerald-500/10 pt-4 uppercase tracking-[0.05em]">Optimized for Profitability</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Availability in Packages */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-4 border-t-primary/20">
            <CardHeader className="p-8 pb-4">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <PackageIcon className="h-4 w-4 text-primary" /> Included in Packages
              </CardTitle>
              <CardDescription>Bundled offerings that feature this service</CardDescription>
            </CardHeader>
            <CardContent className="p-8 pt-4">
              <div className="grid sm:grid-cols-2 gap-4">
                {includedInPackages.map((pkg) => (
                  <div 
                    key={pkg.id} 
                    className="p-4 rounded-xl border border-border/50 bg-muted/5 hover:bg-primary/5 transition-colors cursor-pointer group"
                    onClick={() => navigate(`/dashboard/packages/view/${pkg.id}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm group-hover:text-primary transition-colors">{pkg.name}</p>
                      <Badge variant="outline" className="text-[9px] uppercase font-bold text-primary/70">{pkg.type}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1 leading-relaxed mb-3">{pkg.description}</p>
                    <div className="flex items-center justify-between mt-auto pt-3 border-t border-border/40">
                      <span className="text-[10px] font-bold text-foreground/70 uppercase">Bundle MSRP</span>
                      <span className="text-xs font-black text-primary">{pkg.price}</span>
                    </div>
                  </div>
                ))}
                {includedInPackages.length === 0 && (
                  <div className="col-span-full py-8 text-center bg-muted/20 rounded-xl border border-dashed">
                    <p className="text-sm text-muted-foreground italic">This service is not currently part of any package templates.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Service Deliverables (Mocked) */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-blue-500" /> Standard Deliverables
              </CardTitle>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {[
                    "Client Needs Analysis",
                    "Strategy Development",
                    "Draft Review Process",
                    "Final Assets Handover",
                    "Status Reporting",
                    "Post-delivery Support"
                  ].map((d, i) => (
                    <div key={i} className="flex items-center gap-2.5 text-sm text-foreground/80 font-medium">
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" /> {d}
                    </div>
                  ))}
               </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Info */}
        <div className="space-y-6">
          {/* Marketplace Insights */}
          <Card className="border-border/50 shadow-sm overflow-hidden border-t-2 border-t-emerald-500/20">
             <CardHeader className="p-4 bg-muted/10 border-b border-border/40">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Marketplace Insights</CardTitle>
            </CardHeader>
            <CardContent className="p-5 space-y-6">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Lifetime Usage</p>
                    <p className="text-xl font-bold font-display">{usageCount} Times</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase">Active Adoptions</p>
                    <p className="text-xl font-bold font-display text-emerald-600">{directSubscriptions.length}</p>
                  </div>
               </div>
               
               <div className="pt-4 border-t border-border/10">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-2">Internal Tags</p>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className="text-[10px] bg-muted/30 border-0 h-4 uppercase font-bold">{service.category}</Badge>
                    <Badge variant="outline" className="text-[10px] bg-muted/30 border-0 h-4 uppercase font-bold">In-house</Badge>
                  </div>
               </div>
            </CardContent>
          </Card>

           <Card className="border-border/50 shadow-sm relative overflow-hidden">
             <CardHeader className="p-4 bg-muted/10 border-b border-border/40">
              <CardTitle className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Recent project Activity</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
               <div className="space-y-4">
                {relatedProjects.length > 0 ? (
                  relatedProjects.slice(0, 5).map((proj, i) => (
                    <div key={i} className="flex items-center justify-between group cursor-pointer" onClick={() => navigate(`/dashboard/projects/view/${proj.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600">
                          <Briefcase className="w-4 h-4" />
                        </div>
                        <div className="space-y-0.5">
                          <p className="text-xs font-bold text-foreground leading-none group-hover:text-primary transition-colors">{proj.name}</p>
                          <p className="text-[9px] text-muted-foreground uppercase">{proj.status}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all font-bold" />
                    </div>
                  ))
                ) : (
                  <p className="text-[10px] text-muted-foreground italic text-center py-4">No specific projects <br/> tagged with this service yet.</p>
                )}
               </div>
            </CardContent>
           </Card>
        </div>
      </div>
    </div>
  );
}

import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  ArrowLeft, Mail, Phone, Globe, MapPin, Building2, 
  Briefcase, Receipt, FileText, Settings, User, 
  TrendingUp, CreditCard, Calendar, CheckCircle2, Clock,
  Plus, Layers, Eye, KeyRound, Copy, RefreshCw
} from "lucide-react";
import { useMemo, useState, useEffect } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

export default function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { clients, projects, invoices, proformas, subscriptions, fetchAllData } = useAgencyStore();

  useEffect(() => {
    if (clients.length === 0) {
      fetchAllData();
    }
  }, [clients.length, fetchAllData]);

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);

  const clientProjects = useMemo(() => 
    projects.filter((p) => p.client === client?.company || p.client === client?.name), 
    [projects, client]
  );

  const clientInvoices = useMemo(() => 
    invoices.filter((i) => i.client === client?.company || i.client === client?.name), 
    [invoices, client]
  );

  const clientProformas = useMemo(() => 
    proformas.filter((p) => p.client === client?.company || p.client === client?.name), 
    [proformas, client]
  );

  const clientSubscriptions = useMemo(() => 
    subscriptions.filter((s) => s.client === client?.company || s.client === client?.name), 
    [subscriptions, client]
  );

  const clientServices = useMemo(() => {
    const servicesFromInvoices = clientInvoices.flatMap(inv => inv.items || []).map(item => item.description);
    return Array.from(new Set(servicesFromInvoices)).slice(0, 5); // Limit to top 5
  }, [clientInvoices]);

  if (clients.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-xl font-medium text-muted-foreground animate-pulse">Loading Client Profile...</h2>
      </div>
    );
  }

  if (!client) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Client not found</h2>
        <Button onClick={() => navigate("/dashboard/clients")}>Back to Clients</Button>
      </div>
    );
  }

  const totalRevenue = clientInvoices
    .filter(inv => inv.status === 'Paid')
    .reduce((sum, inv) => sum + parseFloat(inv.amount.replace(/[^0-9.-]+/g, "")), 0);

  const pendingRevenue = clientInvoices
    .filter(inv => inv.status === 'Pending' || inv.status === 'Overdue')
    .reduce((sum, inv) => sum + parseFloat(inv.amount.replace(/[^0-9.-]+/g, "")), 0);

  const statusColor = (s: string) =>
    s === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === "Paused" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
        "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 hover:bg-primary/5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16 border-2 border-primary/10 ring-4 ring-primary/5">
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{client.initials}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{client.company || client.name}</h1>
                <Badge className={`${statusColor(client.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`} variant="outline">{client.status}</Badge>
              </div>
              <p className="text-muted-foreground font-medium flex items-center gap-2">
                <User className="w-3.5 h-3.5" /> {client.name} · <span className="opacity-70">{client.industry}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/clients/edit/${client.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Edit Profile
          </Button>
          <Button variant="hero" size="sm" className="h-9 gap-2 text-xs font-semibold shadow-premium" onClick={() => navigate("/dashboard/projects/add")}>
            <Plus className="h-3.5 w-3.5" /> New Project
          </Button>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: TrendingUp, label: "Total Revenue", value: formatCurrency(totalRevenue), color: "emerald" },
          { icon: CreditCard, label: "Pending", value: formatCurrency(pendingRevenue), color: "amber" },
          { icon: Briefcase, label: "Active Projects", value: client.projects, color: "blue" },
          { icon: Layers, label: "Active Subs", value: clientSubscriptions.length, color: "purple" },
        ].map((stat, i) => (
          <Card key={i} className="group relative overflow-hidden border-border/50 hover:border-primary/20 transition-all duration-300">
            <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <CardContent className="p-5 relative flex items-center gap-4">
              <div className={`w-11 h-11 rounded-xl bg-${stat.color}-500/10 flex items-center justify-center ring-1 ring-${stat.color}-500/20`}>
                <stat.icon className={`h-5 w-5 text-${stat.color}-500`} />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{stat.label}</p>
                <p className="text-2xl font-display font-bold text-foreground mt-0.5">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <Tabs defaultValue="overview" className="w-full">
            <TabsList className="bg-muted/30 p-1 border border-border/40 rounded-xl">
              <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold tracking-tight">Overview</TabsTrigger>
              <TabsTrigger value="projects" className="rounded-lg text-xs font-semibold tracking-tight">Projects ({clientProjects.length})</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold tracking-tight">Financials</TabsTrigger>
              <TabsTrigger value="subscriptions" className="rounded-lg text-xs font-semibold tracking-tight">Subscriptions</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
                <CardHeader>
                  <CardTitle className="text-lg font-display flex items-center gap-2">
                    <User className="h-4 w-4 text-primary" /> Professional Profile
                  </CardTitle>
                  <CardDescription>Essential contact and business information</CardDescription>
                </CardHeader>
                <CardContent className="grid sm:grid-cols-2 gap-8 pt-2">
                  <div className="space-y-5">
                    {[
                      { icon: Mail, label: "Email Address", value: client.email },
                      { icon: Phone, label: "Phone Number", value: client.phone || "Not provided" },
                      { icon: Globe, label: "Website", value: client.website || "Not provided" },
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
                    {[
                      { icon: MapPin, label: "Location", value: `${client.address ? client.address + ', ' : ''}${client.city ? client.city + ', ' : ''}${client.country || "Not provided"}` },
                      { icon: Building2, label: "Industry", value: client.industry || "Not provided" },
                      { icon: Calendar, label: "Member Since", value: "January 2025" }, // Mocked
                    ].map((item, i) => (
                      <div key={i} className="flex items-start gap-4">
                        <div className="w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border border-border/40">
                          <item.icon className="h-4 w-4 text-muted-foreground/80" />
                        </div>
                        <div>
                          <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                          <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Notes */}
              <Card className="border-border/50 shadow-sm border-l-4 border-l-primary/40 bg-primary/[0.01]">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-display">Administrative Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground/90 leading-relaxed italic pr-4">
                    {client.notes || "No internal notes have been recorded for this client yet."}
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="projects" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold text-xs">Project Name</TableHead>
                        <TableHead className="font-bold text-xs">Status</TableHead>
                        <TableHead className="font-bold text-xs">Progress</TableHead>
                        <TableHead className="font-bold text-xs">Due Date</TableHead>
                        <TableHead className="text-right font-bold text-xs">Budget</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProjects.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No projects recorded</TableCell>
                        </TableRow>
                      ) : (
                        clientProjects.map((proj) => (
                          <TableRow key={proj.id} className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => navigate(`/dashboard/projects/view/${proj.id}`)}>
                            <TableCell className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">{proj.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter bg-muted/50 border-0">{proj.status}</Badge>
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                  <div className="h-full bg-primary" style={{ width: `${proj.progress}%` }} />
                                </div>
                                <span className="text-[10px] text-muted-foreground font-bold">{proj.progress}%</span>
                              </div>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{proj.dueDate}</TableCell>
                            <TableCell className="text-right font-bold text-sm tracking-tight">{proj.budget}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="billing" className="mt-6 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Invoices */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-display">Invoices</CardTitle>
                      <CardDescription className="text-xs">Summary of all billings</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={() => navigate('/dashboard/invoices/add')}>
                      <Plus className="w-3.5 h-3.5" /> New Invoice
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">Date</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">Due</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">Status</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase tracking-tight">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientInvoices.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No invoices found</TableCell>
                        </TableRow>
                      ) : (
                        clientInvoices.map((inv) => (
                          <TableRow key={inv.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => navigate(`/dashboard/invoices/view/${inv.id}`)}>
                            <TableCell className="font-bold text-sm">{inv.id}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{formatDate(inv.date)}</TableCell>
                            <TableCell className="text-xs text-muted-foreground font-medium">{formatDate(inv.dueDate)}</TableCell>
                            <TableCell>
                              <Badge className={`${
                                inv.status === 'Paid' ? "bg-emerald-50 text-emerald-600" :
                                inv.status === 'Overdue' ? "bg-red-50 text-red-600" :
                                "bg-amber-50 text-amber-600"
                                } text-[9px] font-bold uppercase tracking-wider border-0`}>{inv.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm tracking-tight text-foreground">{formatCurrency(inv.amount)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Proformas */}
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-display">Proforma Invoices</CardTitle>
                      <CardDescription className="text-xs">Initial quotes and proposals</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" className="h-8 text-xs font-bold gap-1.5" onClick={() => navigate('/dashboard/proforma/add')}>
                      <Plus className="w-3.5 h-3.5" /> New Proforma
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/20">
                      <TableRow>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">ID</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">Date</TableHead>
                        <TableHead className="font-bold text-xs uppercase tracking-tight">Status</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase tracking-tight">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientProformas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No proformas recorded</TableCell>
                        </TableRow>
                      ) : (
                        clientProformas.map((pro) => (
                          <TableRow key={pro.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/dashboard/proforma/view/${pro.id}`)}>
                            <TableCell className="font-bold text-sm tracking-tight">{pro.id}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{pro.date}</TableCell>
                            <TableCell>
                              <Badge className="text-[10px] font-bold uppercase tracking-tight bg-muted/60 border-0">{pro.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm tracking-tight text-foreground">{pro.amount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="subscriptions" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardContent className="p-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow>
                        <TableHead className="font-bold text-xs uppercase">Plan</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Billing</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Renewal</TableHead>
                        <TableHead className="font-bold text-xs uppercase">Status</TableHead>
                        <TableHead className="text-right font-bold text-xs uppercase">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clientSubscriptions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-12 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No subscriptions active</TableCell>
                        </TableRow>
                      ) : (
                        clientSubscriptions.map((sub) => (
                          <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => navigate(`/dashboard/subscriptions/view/${sub.id}`)}>
                            <TableCell className="font-bold group-hover:text-primary transition-colors">{sub.plan}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{sub.billingCycle}</TableCell>
                            <TableCell className="text-xs font-medium text-foreground/80">{sub.renewal}</TableCell>
                            <TableCell>
                              <Badge className={`${sub.status === 'Active' ? "bg-emerald-50 text-emerald-600" : "bg-muted text-muted-foreground/60"} text-[9px] font-bold uppercase border-0 tracking-wider`}>{sub.status}</Badge>
                            </TableCell>
                            <TableCell className="text-right font-bold text-sm tracking-tight text-foreground">{sub.amount}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Portal Access */}
          <ClientPortalAccessCard client={client} />

          {/* Services Provided */}
          <Card className="border-border/50 shadow-premium overflow-hidden border-t-2 border-t-primary/20">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Settings className="w-4 h-4 text-primary" /> Provided Services
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 pt-5">
              <div className="space-y-4">
                {clientServices.length > 0 ? (
                  clientServices.map((service, i) => (
                    <div key={i} className="flex items-center justify-between text-sm group">
                      <span className="text-muted-foreground font-medium flex items-center gap-2.5 truncate">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" /> 
                        {service}
                      </span>
                      <Badge variant="secondary" className="text-[10px] font-bold opacity-0 group-hover:opacity-100 transition-opacity">Active</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6">
                    <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-3">
                      <Settings className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                    <p className="text-[11px] text-muted-foreground font-medium uppercase tracking-wider">No specific services <br/> recorded via billing</p>
                  </div>
                )}
              </div>
              {clientServices.length > 0 && (
                <Button variant="ghost" className="w-full mt-4 text-[11px] font-bold uppercase tracking-widest text-primary h-8 hover:bg-primary/5">
                  View Service History
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border-border/50 shadow-sm relative overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" /> Recent Activity
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="space-y-8 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1.5px] before:bg-gradient-to-b before:from-primary/30 before:via-border before:to-transparent">
                {[
                  { icon: Receipt, label: "Payment Received", detail: "Invoice INV-001 finalized.", date: "Mar 22, 2026", color: "bg-emerald-500" },
                  { icon: Briefcase, label: "Milestone Met", detail: "Design phase completed.", date: "Mar 15, 2026", color: "bg-blue-500" },
                  { icon: Mail, label: "Contract Signed", detail: "Services agreement updated.", date: "Feb 28, 2026", color: "bg-primary" },
                ].map((act, i) => (
                  <div key={i} className="relative pl-8 group">
                    <div className={`absolute left-0 top-1 w-5 h-5 rounded-full ${act.color} flex items-center justify-center ring-4 ring-background shadow-sm transition-transform group-hover:scale-110`}>
                      <act.icon className="h-2.5 w-2.5 text-white" />
                    </div>
                    <div className="space-y-0.5">
                      <p className="text-sm font-bold text-foreground/90">{act.label}</p>
                      <p className="text-xs text-muted-foreground/80 leading-relaxed font-medium">{act.detail}</p>
                      <span className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-tighter mt-1 block">{act.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function ClientPortalAccessCard({ client }: { client: any }) {
  const { toast } = useToast();
  const { generatePortalAccess, fetchClients } = useAgencyStore();
  const [showCode, setShowCode] = useState(false);
  const [tempCode, setTempCode] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const hasAccess = !!client.userId;

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      const res = await generatePortalAccess(client.id);
      const code = res.accessCode;
      
      // Refresh local clients list to update userId field
      await fetchClients();

      setTempCode(code);
      setShowCode(true);
      toast({
        title: hasAccess ? 'Access code reset' : 'Access code generated',
        description: `Portal access code for this client: ${code}`,
      });
    } catch (error) {
      toast({
        title: 'Operation failed',
        description: 'Could not manage portal access. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    if (tempCode) {
      navigator.clipboard.writeText(tempCode);
      toast({
        title: 'Copied!',
        description: 'Access code copied to clipboard.',
      });
    }
  };

  return (
    <Card className={`border-border/50 shadow-premium overflow-hidden border-t-2 ${hasAccess ? 'border-t-emerald-500/40' : 'border-t-secondary/40'}`}>
      <CardHeader className={`pb-3 border-b border-border/40 ${hasAccess ? 'bg-emerald-500/5' : 'bg-secondary/5'}`}>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <KeyRound className={`w-4 h-4 ${hasAccess ? 'text-emerald-500' : 'text-secondary'}`} /> Portal Access
          </CardTitle>
          {hasAccess && (
            <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px] font-bold uppercase tracking-tight">Enabled</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {hasAccess ? 'Manage or reset client login credentials' : 'Create login credentials for the client portal'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-5">
        {tempCode ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1.5">Access Code</p>
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono font-bold text-foreground tracking-[0.3em]">
                  {showCode ? tempCode : '••••••'}
                </code>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted"
                    onClick={() => setShowCode(!showCode)}
                  >
                    <Eye className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted"
                    onClick={handleCopy}
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1">Login Email</p>
              <p className="text-sm font-medium text-foreground">{client.email}</p>
            </div>
            <p className="text-[10px] text-amber-600 bg-amber-500/5 p-2 rounded-lg border border-amber-500/10 font-medium leading-relaxed">
              For security, this code is shown only once. Please provide it to your client immediately.
            </p>
          </div>
        ) : (
          <div className="text-center py-4">
            <div className={`w-12 h-12 rounded-full ${hasAccess ? 'bg-emerald-500/10' : 'bg-secondary/10'} flex items-center justify-center mx-auto mb-3`}>
              <KeyRound className={`h-5 w-5 ${hasAccess ? 'text-emerald-500/50' : 'text-secondary/50'}`} />
            </div>
            {hasAccess ? (
              <div className="space-y-4">
                <div className="p-2.5 rounded-xl bg-muted/30 border border-border/40 text-left">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-0.5">Linked Email</p>
                  <p className="text-sm font-bold text-foreground truncate">{client.email}</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs font-bold gap-1.5"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  {isLoading ? 'Resetting...' : 'Reset Access Code'}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground font-medium mb-4">
                  Client currently has no portal access credentials.
                </p>
                <Button
                  variant="hero"
                  size="sm"
                  className="h-9 text-xs font-bold gap-1.5 shadow-premium w-full"
                  onClick={handleGenerate}
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="w-3.5 h-3.5" />
                  )}
                  {isLoading ? 'Generating...' : 'Setup Portal Access'}
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

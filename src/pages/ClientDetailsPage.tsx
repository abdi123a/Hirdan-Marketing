import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { 
  ArrowLeft, Mail, Phone, Globe, MapPin, Building2, 
  Briefcase, Receipt, FileText, Settings, User, 
  TrendingUp, CreditCard, Calendar, CheckCircle2, Clock,
  Plus, Layers, Eye, EyeOff, KeyRound, Copy, RefreshCw,
  Trash2, Pencil, Upload, Download, ExternalLink, Share2,
  Loader2, Zap, ChevronDown, ChevronRight, Video, MoreVertical, AlertCircle, Home
} from "lucide-react";
import { useMemo, useState, useEffect, useRef, useCallback } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiUpload, downloadProtectedFile } from "@/lib/api-client";
import { DocumentViewer } from "@/components/DocumentViewer";
import { Progress } from "@/components/ui/progress";
import { AccountsSkeleton, InlineTableSkeleton } from "@/components/ui/PageSkeleton";
import { ClientMonthlyPlannerTab } from "@/pages/SocialMediaPlannerPage";

interface ClientMeeting {
  id: string;
  title: string;
  date: string;
  location?: string | null;
  notes?: string | null;
}

const CLIENT_DETAIL_TABS = ["overview", "projects", "billing", "subscriptions", "social", "planner", "documents", "meetings"] as const;

export default function ClientDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { clients, projects, invoices, proformas, subscriptions, fetchAllData } = useAgencyStore();
  const { toast } = useToast();
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{ title: string, fileUrl: string, type?: string } | null>(null);
  const [meetings, setMeetings] = useState<ClientMeeting[]>([]);
  const [meetingsLoading, setMeetingsLoading] = useState(false);
  const [meetingDialogOpen, setMeetingDialogOpen] = useState(false);
  const [editingMeeting, setEditingMeeting] = useState<ClientMeeting | null>(null);
  const [meetingForm, setMeetingForm] = useState({ title: '', date: '', time: '', location: '', notes: '' });
  const [isSavingMeeting, setIsSavingMeeting] = useState(false);
  const [deletingMeetingId, setDeletingMeetingId] = useState<string | null>(null);

  const tabParam = searchParams.get("tab") || "overview";
  const activeTab = (CLIENT_DETAIL_TABS as readonly string[]).includes(tabParam) ? tabParam : "overview";

  useEffect(() => {
    if (clients.length === 0) {
      fetchAllData();
    }
  }, [clients.length, fetchAllData]);

  const client = useMemo(() => clients.find((c) => c.id === id), [clients, id]);

  const fetchMeetings = useCallback(async () => {
    if (!id) return;
    setMeetingsLoading(true);
    try {
      const res = await apiFetch<{ meetings: ClientMeeting[] }>(`/clients/${id}/meetings`);
      setMeetings(res.meetings || []);
    } catch (e) {
      console.error(e);
    } finally {
      setMeetingsLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  // Auto-navigate back to clients list when client is deleted (no longer in store)
  useEffect(() => {
    if (clients.length > 0 && !client) {
      navigate("/dashboard/clients", { replace: true });
    }
  }, [clients, client, navigate]);

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
    // Returning null while the redirect useEffect fires
    return null;
  }

  const totalRevenue = clientInvoices.reduce((sum, inv) => {
    const amount = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ""));
    if (inv.status === 'Paid') return sum + amount;
    if (inv.status === 'Partially Paid') return sum + (inv.deposit || 0);
    return sum;
  }, 0);

  const pendingRevenue = clientInvoices.reduce((sum, inv) => {
    const totalAmount = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ""));
    if (inv.status === 'Pending' || inv.status === 'Overdue') {
      return sum + totalAmount;
    }
    if (inv.status === 'Partially Paid') {
      const paid = inv.deposit || 0;
      return sum + Math.max(0, totalAmount - paid);
    }
    return sum;
  }, 0);

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
          <Tabs
            value={activeTab}
            onValueChange={(v) => {
              const next = new URLSearchParams(searchParams);
              if (v === "overview") next.delete("tab");
              else next.set("tab", v);
              setSearchParams(next, { replace: true });
            }}
            className="w-full"
          >
            <TabsList className="bg-muted/30 p-1 border border-border/40 rounded-xl flex-wrap">
              <TabsTrigger value="overview" className="rounded-lg text-xs font-semibold tracking-tight">Overview</TabsTrigger>
              <TabsTrigger value="projects" className="rounded-lg text-xs font-semibold tracking-tight">Projects ({clientProjects.length})</TabsTrigger>
              <TabsTrigger value="billing" className="rounded-lg text-xs font-semibold tracking-tight">Financials</TabsTrigger>
              <TabsTrigger value="subscriptions" className="rounded-lg text-xs font-semibold tracking-tight">Subscriptions</TabsTrigger>
              <TabsTrigger value="social" className="rounded-lg text-xs font-semibold tracking-tight gap-1"><Share2 className="h-3 w-3" /> Social</TabsTrigger>
              <TabsTrigger value="planner" className="rounded-lg text-xs font-semibold tracking-tight gap-1"><Calendar className="h-3 w-3" /> Planner</TabsTrigger>
              <TabsTrigger value="documents" className="rounded-lg text-xs font-semibold tracking-tight gap-1"><FileText className="h-3 w-3" /> Documents</TabsTrigger>
              <TabsTrigger value="meetings" className="rounded-lg text-xs font-semibold tracking-tight gap-1"><Calendar className="h-3 w-3" /> Meetings {meetings.length > 0 && `(${meetings.length})`}</TabsTrigger>
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
                        <TableHead className="font-bold text-xs uppercase">End Date</TableHead>
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
                            <TableCell className="text-xs font-medium text-foreground/80">{sub.endDate}</TableCell>
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

            {/* Social Profiles Tab */}
            <TabsContent value="social" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ClientSocialProfilesTab clientId={client.id} />
            </TabsContent>

            {/* Content Planner Tab */}
            <TabsContent value="planner" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ClientMonthlyPlannerTab
                clientId={client.id}
                clientName={client.name}
                clientCompany={client.company}
              />
            </TabsContent>

            {/* Documents Tab */}
            <TabsContent value="documents" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ClientDocumentsTab clientId={client.id} setPreviewDoc={setSelectedPreviewDoc} />
            </TabsContent>

            {/* Meetings Tab */}
            <TabsContent value="meetings" className="mt-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <Card className="border-border/50 shadow-sm overflow-hidden">
                <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base font-display flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-primary" /> Meetings
                      </CardTitle>
                      <CardDescription className="text-xs">Face-to-face meetings with this client</CardDescription>
                    </div>
                    <Button
                      variant="hero"
                      size="sm"
                      className="h-8 text-xs font-bold gap-1.5"
                      onClick={() => {
                        setEditingMeeting(null);
                        setMeetingForm({ title: '', date: '', time: '09:00', location: '', notes: '' });
                        setMeetingDialogOpen(true);
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> Schedule Meeting
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {meetingsLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                    </div>
                  ) : meetings.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center px-8">
                      <div className="w-14 h-14 rounded-full bg-primary/5 flex items-center justify-center mb-4">
                        <Calendar className="h-6 w-6 text-primary/40" />
                      </div>
                      <p className="text-sm font-semibold text-foreground mb-1">No meetings scheduled</p>
                      <p className="text-xs text-muted-foreground mb-4">Schedule a face-to-face meeting with this client.</p>
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-1.5 text-xs"
                        onClick={() => {
                          setEditingMeeting(null);
                          setMeetingForm({ title: '', date: '', time: '09:00', location: '', notes: '' });
                          setMeetingDialogOpen(true);
                        }}
                      >
                        <Plus className="w-3.5 h-3.5" /> Schedule First Meeting
                      </Button>
                    </div>
                  ) : (
                    <Table>
                      <TableHeader className="bg-muted/20">
                        <TableRow>
                          <TableHead className="font-bold text-xs uppercase tracking-tight">Title</TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-tight">Date & Time</TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-tight">Location</TableHead>
                          <TableHead className="font-bold text-xs uppercase tracking-tight">Notes</TableHead>
                          <TableHead className="text-right font-bold text-xs uppercase tracking-tight">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {meetings
                          .slice()
                          .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                          .map((meeting) => {
                            const d = new Date(meeting.date);
                            const isPast = d < new Date();
                            return (
                              <TableRow key={meeting.id} className={isPast ? 'opacity-50' : ''}>
                                <TableCell className="font-semibold text-sm">
                                  {meeting.title}
                                  {!isPast && (
                                    <Badge className="ml-2 text-[9px] bg-emerald-50 text-emerald-600 border-0 font-bold uppercase">Upcoming</Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  <span className="font-medium text-foreground">{d.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
                                  <br />
                                  {d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground">
                                  {meeting.location ? (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3 text-muted-foreground/60" /> {meeting.location}
                                    </span>
                                  ) : <span className="text-muted-foreground/40">—</span>}
                                </TableCell>
                                <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                                  {meeting.notes || <span className="text-muted-foreground/40">—</span>}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-primary"
                                      onClick={() => {
                                        setEditingMeeting(meeting);
                                        const dt = new Date(meeting.date);
                                        const dateStr = dt.toISOString().split('T')[0];
                                        const timeStr = dt.toTimeString().slice(0, 5);
                                        setMeetingForm({
                                          title: meeting.title,
                                          date: dateStr,
                                          time: timeStr,
                                          location: meeting.location || '',
                                          notes: meeting.notes || '',
                                        });
                                        setMeetingDialogOpen(true);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                      disabled={deletingMeetingId === meeting.id}
                                      onClick={async () => {
                                        setDeletingMeetingId(meeting.id);
                                        try {
                                          await apiFetch(`/clients/${id}/meetings/${meeting.id}`, { method: 'DELETE' });
                                          await fetchMeetings();
                                          toast({ title: 'Meeting deleted' });
                                        } catch {
                                          toast({ title: 'Failed to delete', variant: 'destructive' });
                                        } finally {
                                          setDeletingMeetingId(null);
                                        }
                                      }}
                                    >
                                      {deletingMeetingId === meeting.id
                                        ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        : <Trash2 className="h-3.5 w-3.5" />}
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                      </TableBody>
                    </Table>
                  )}
                </CardContent>
              </Card>

              {/* Add / Edit Meeting Dialog */}
              <Dialog open={meetingDialogOpen} onOpenChange={setMeetingDialogOpen}>
                <DialogContent className="max-w-md">
                  <DialogHeader>
                    <DialogTitle className="font-display">{editingMeeting ? 'Edit Meeting' : 'Schedule Meeting'}</DialogTitle>
                    <DialogDescription>Face-to-face meeting with {client.company || client.name}</DialogDescription>
                  </DialogHeader>
                  <div className="space-y-4 py-2">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider">Meeting Title</Label>
                      <Input
                        placeholder="e.g. Monthly Review"
                        value={meetingForm.title}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, title: e.target.value }))}
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider">Date</Label>
                        <Input
                          type="date"
                          value={meetingForm.date}
                          onChange={(e) => setMeetingForm((p) => ({ ...p, date: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs font-semibold uppercase tracking-wider">Time</Label>
                        <Input
                          type="time"
                          value={meetingForm.time}
                          onChange={(e) => setMeetingForm((p) => ({ ...p, time: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider">Location (optional)</Label>
                      <Input
                        placeholder="e.g. Office, Café name, address"
                        value={meetingForm.location}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, location: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold uppercase tracking-wider">Notes (optional)</Label>
                      <Textarea
                        placeholder="Agenda, talking points…"
                        rows={3}
                        value={meetingForm.notes}
                        onChange={(e) => setMeetingForm((p) => ({ ...p, notes: e.target.value }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button variant="outline" onClick={() => setMeetingDialogOpen(false)}>Cancel</Button>
                    <Button
                      disabled={isSavingMeeting || !meetingForm.title || !meetingForm.date}
                      onClick={async () => {
                        if (!meetingForm.title || !meetingForm.date) return;
                        setIsSavingMeeting(true);
                        try {
                          const isoDate = new Date(`${meetingForm.date}T${meetingForm.time || '09:00'}:00`).toISOString();
                          if (editingMeeting) {
                            await apiFetch(`/clients/${id}/meetings/${editingMeeting.id}`, {
                              method: 'PUT',
                              body: JSON.stringify({
                                title: meetingForm.title,
                                date: isoDate,
                                location: meetingForm.location || null,
                                notes: meetingForm.notes || null,
                              }),
                            });
                            toast({ title: 'Meeting updated' });
                          } else {
                            await apiFetch(`/clients/${id}/meetings`, {
                              method: 'POST',
                              body: JSON.stringify({
                                title: meetingForm.title,
                                date: isoDate,
                                location: meetingForm.location || null,
                                notes: meetingForm.notes || null,
                              }),
                            });
                            toast({ title: 'Meeting scheduled' });
                          }
                          await fetchMeetings();
                          setMeetingDialogOpen(false);
                        } catch {
                          toast({ title: 'Failed to save meeting', variant: 'destructive' });
                        } finally {
                          setIsSavingMeeting(false);
                        }
                      }}
                    >
                      {isSavingMeeting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                      {isSavingMeeting ? 'Saving…' : (editingMeeting ? 'Update Meeting' : 'Schedule Meeting')}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </TabsContent>
          </Tabs>

          {/* Document Viewer Modal */}
          <DocumentViewer
            isOpen={!!selectedPreviewDoc}
            onClose={() => setSelectedPreviewDoc(null)}
            document={selectedPreviewDoc}
          />
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
  const { generatePortalAccess, fetchClients, updateClientPortalAccess } = useAgencyStore();
  const [showPassword, setShowPassword] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const handleSendWelcomeEmail = async (password?: string) => {
    try {
      setIsSendingEmail(true);
      const body: Record<string, string> = {};
      if (password) body.tempPassword = password;
      await apiFetch(`/clients/${client.id}/send-welcome-email`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      toast({
        title: '✅ Welcome email sent!',
        description: `Login credentials and portal guide sent to ${client.email}`,
      });
    } catch (error: any) {
      toast({
        title: 'Failed to send email',
        description: error?.message || 'Please check your email settings in the agency configuration.',
        variant: 'destructive',
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const portalAccess = client.portalAccess || {
    financials: true,
    projects: true,
    subscriptions: true,
    social: true,
    planner: true,
    documents: true
  };

  const handleToggleAccess = async (section: string, checked: boolean) => {
    try {
      const newAccess = { ...portalAccess, [section]: checked };
      await updateClientPortalAccess(client.id, newAccess);
      toast({ title: 'Portal access updated' });
    } catch (e) {
      toast({ title: 'Error updating access', variant: 'destructive' });
    }
  };

  const TOGGLES = [
    { id: 'financials', label: 'Financials', icon: Receipt },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'subscriptions', label: 'Subscriptions', icon: Zap },
    { id: 'social', label: 'Social Media', icon: Share2 },
    { id: 'planner', label: 'Planner', icon: Calendar },
    { id: 'documents', label: 'Documents', icon: FileText },
  ];

  const hasAccess = !!client.userId;

  const handleGenerate = async () => {
    try {
      setIsLoading(true);
      const res = await generatePortalAccess(client.id);
      const password = res.tempPassword;
      
      // Refresh local clients list to update userId field
      await fetchClients();

      setTempPassword(password);
      setShowPassword(true);
      toast({
        title: hasAccess ? 'Password reset' : 'Password generated',
        description: `Temporary portal password: ${password}`,
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
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword);
      toast({
        title: 'Copied!',
        description: 'Temporary password copied to clipboard.',
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
          {hasAccess ? 'Manage or reset client login password' : 'Create initial login password for the client portal'}
        </CardDescription>
      </CardHeader>
      <CardContent className="p-4 pt-5">
        {tempPassword ? (
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50">
              <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-1.5">Temporary Password</p>
              <div className="flex items-center justify-between">
                <code className="text-lg font-mono font-bold text-foreground">
                  {showPassword ? tempPassword : '••••••••••'}
                </code>
                <div className="flex items-center gap-1.5">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg hover:bg-muted"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
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
              For security, this temporary password is shown only once. Ask the client to log in and change it from their portal account.
            </p>
            {/* Send Welcome Email Button */}
            <Button
              variant="hero"
              size="sm"
              className="w-full h-10 text-xs font-bold gap-2 shadow-premium mt-1"
              onClick={() => handleSendWelcomeEmail(tempPassword ?? undefined)}
              disabled={isSendingEmail || !client.email}
            >
              {isSendingEmail ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Mail className="w-3.5 h-3.5" />
              )}
              {isSendingEmail ? 'Sending Email...' : 'Send Welcome Email'}
            </Button>
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
                  {isLoading ? 'Resetting...' : 'Reset Password'}
                </Button>
                {/* Resend Welcome Email */}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full h-9 text-xs font-bold gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={() => handleSendWelcomeEmail()}
                  disabled={isSendingEmail || !client.email}
                >
                  {isSendingEmail ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Mail className="w-3.5 h-3.5" />
                  )}
                  {isSendingEmail ? 'Sending...' : 'Resend Welcome Email'}
                </Button>
              </div>
            ) : (
              <>
                <p className="text-[11px] text-muted-foreground font-medium mb-4">
                  Client currently has no portal password set.
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
                  {isLoading ? 'Generating...' : 'Generate Password'}
                </Button>
              </>
            )}
          </div>
        )}

        {/* Portal Sections Toggles */}
        <div className="mt-6 pt-5 border-t border-border/50">
          <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-muted-foreground" />
            Portal Sections
          </h4>
          <p className="text-xs text-muted-foreground mb-4">
            Toggle which sections this client can see in their portal.
          </p>
          <div className="space-y-3">
            {TOGGLES.map((toggle) => (
              <div key={toggle.id} className="flex items-center justify-between">
                <Label htmlFor={`access-${toggle.id}`} className="flex items-center gap-2 text-sm cursor-pointer">
                  <toggle.icon className="h-4 w-4 text-muted-foreground" />
                  {toggle.label}
                </Label>
                <Switch 
                  id={`access-${toggle.id}`} 
                  checked={portalAccess[toggle.id] !== false} 
                  onCheckedChange={(checked) => handleToggleAccess(toggle.id, checked)}
                />
              </div>
            ))}
            <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <Label className="flex items-center gap-2 text-sm cursor-not-allowed">
                <Home className="h-4 w-4 text-muted-foreground" />
                Overview
              </Label>
              <Switch checked={true} disabled />
            </div>
            <div className="flex items-center justify-between opacity-50 cursor-not-allowed">
              <Label className="flex items-center gap-2 text-sm cursor-not-allowed">
                <User className="h-4 w-4 text-muted-foreground" />
                Account
              </Label>
              <Switch checked={true} disabled />
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Social accounts (same platforms as Social Accounts / OAuth) ──

const CLIENT_SOCIAL_PLATFORMS = [
  { id: "facebook",  label: "Facebook" },
  { id: "instagram", label: "Instagram" },
  { id: "linkedin",  label: "LinkedIn" },
  { id: "youtube",   label: "YouTube" },
  { id: "tiktok",    label: "TikTok" },
  { id: "x",         label: "X / Twitter" },
  { id: "threads",   label: "Threads" },
  { id: "pinterest", label: "Pinterest" },
] as const;

const clientSocialIcon = (platform: string) => {
  const map: Record<string, string> = {
    facebook: "/social-icons/Facebook.png",
    instagram: "/social-icons/instagram.png",
    threads: "/social-icons/Threads.png",
    tiktok: "/social-icons/tiktok.png",
    linkedin: "/social-icons/linkedin.png",
    youtube: "/social-icons/youtube.png",
    x: "/social-icons/twitter.png",
    twitter: "/social-icons/twitter.png",
    pinterest: "/social-icons/pinterest.png",
  };
  return map[platform?.toLowerCase()] || null;
};

interface ClientSocialAccount {
  id: string;
  platform: string;
  platformUsername: string;
  displayName: string;
  avatarUrl: string | null;
  healthStatus: string;
  healthMessage: string | null;
  isActive: boolean;
  tokenExpiresAt: string | null;
}

// ─── Social Profiles Tab ──────────────────────────────────────────

function ClientSocialProfilesTab({ clientId }: { clientId: string }) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [accounts, setAccounts] = useState<ClientSocialAccount[]>([]);
  const [platformStatus, setPlatformStatus] = useState<Record<string, { configured: boolean; enabled: boolean }>>({});
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [connecting, setConnecting] = useState(false);

  const fetchAccounts = useCallback(async () => {
    try {
      const [accs, status] = await Promise.all([
        apiFetch<ClientSocialAccount[]>(`/social/accounts/by-client/${clientId}`),
        apiFetch<Record<string, { configured: boolean; enabled: boolean }>>("/social/platform-status"),
      ]);
      setAccounts(Array.isArray(accs) ? accs : []);
      setPlatformStatus(status || {});
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to load social accounts", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, toast]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);

  const connectedPlatformIds = useMemo(
    () => new Set(accounts.map(a => a.platform.toLowerCase())),
    [accounts],
  );

  const handleConnect = async (platform?: string) => {
    const plat = platform || selectedPlatform;
    if (!plat) return;
    try {
      setConnecting(true);
      // After OAuth, Social Accounts page redirects back here when this is set.
      try {
        sessionStorage.setItem("oauth_return", `/dashboard/clients/view/${clientId}?tab=social`);
      } catch { /* ignore */ }
      const res = await apiFetch<{ url: string }>(
        `/social/oauth/connect?platform=${plat}&clientId=${clientId}&groupId=${clientId}`
      );
      if (res.url) window.location.href = res.url;
      else throw new Error("No OAuth URL returned");
    } catch (err: any) {
      toast({ title: "Connection failed", description: err.message || "Could not start OAuth", variant: "destructive" });
      setConnecting(false);
    }
  };

  const handleDisconnect = async (accountId: string, name: string) => {
    if (!confirm(`Disconnect ${name}? This will stop scheduled posts to this account.`)) return;
    try {
      await apiFetch(`/social/accounts/${accountId}`, { method: "DELETE" });
      await fetchAccounts();
      toast({ title: "Disconnected", description: `${name} has been removed.` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message || "Failed to disconnect", variant: "destructive" });
    }
  };

  if (loading) return <AccountsSkeleton />;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h3 className="text-lg font-display font-bold">Connected Platforms</h3>
          <p className="text-xs text-muted-foreground font-medium">
            Same OAuth accounts used for publishing and analytics
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs font-bold"
            onClick={() => navigate("/dashboard/social-media/accounts")}
          >
            <ExternalLink className="h-3.5 w-3.5" /> Manage All
          </Button>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => { setSelectedPlatform(""); setShowAdd(true); }}>
            <Plus className="h-3.5 w-3.5" /> Connect Platform
          </Button>
        </div>
      </div>

      {/* Platform availability grid — mirrors Social Accounts */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {CLIENT_SOCIAL_PLATFORMS.map(p => {
          const status = platformStatus[p.id] || { enabled: false, configured: false };
          const isConnected = connectedPlatformIds.has(p.id);
          const icon = clientSocialIcon(p.id);
          return (
            <button
              key={p.id}
              type="button"
              disabled={!status.enabled || connecting}
              onClick={() => {
                if (!status.enabled) return;
                if (isConnected) return;
                handleConnect(p.id);
              }}
              className={`flex items-center gap-2.5 p-3 rounded-xl border text-left transition-all ${
                !status.enabled
                  ? "opacity-40 cursor-not-allowed border-border/30 bg-muted/20"
                  : isConnected
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-border/60 bg-background hover:border-primary/40 hover:bg-primary/3"
              }`}
              title={!status.enabled ? "Enable this platform in Settings → Plugins" : isConnected ? "Already connected" : `Connect ${p.label}`}
            >
              <div className="h-8 w-8 rounded-lg border border-border/40 bg-background flex items-center justify-center overflow-hidden shrink-0">
                {icon ? <img src={icon} alt="" className="h-5 w-5 object-contain" /> : <Share2 className="h-4 w-4 text-muted-foreground" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold truncate">{p.label}</p>
                {!status.enabled ? (
                  <p className="text-[10px] text-muted-foreground">Not enabled</p>
                ) : isConnected ? (
                  <p className="text-[10px] text-emerald-600 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" /> Connected
                  </p>
                ) : (
                  <p className="text-[10px] text-primary font-semibold">+ Connect</p>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {accounts.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <Share2 className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No social accounts connected yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1 max-w-sm mx-auto">
              Connect an enabled platform above. These are the same accounts used in Social Media → Accounts, Publish, and Analytics.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map(acc => {
            const plat = acc.platform.toLowerCase();
            const label = CLIENT_SOCIAL_PLATFORMS.find(p => p.id === plat)?.label || acc.platform;
            const icon = clientSocialIcon(plat);
            const healthy = acc.healthStatus === "healthy";
            return (
              <Card key={acc.id} className="border-border/50 hover:border-primary/20 transition-all group">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full border border-border/60 overflow-hidden bg-muted/20">
                        {acc.avatarUrl ? (
                          <img src={acc.avatarUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-sm font-bold text-primary bg-primary/10">
                            {(acc.displayName || "?").charAt(0)}
                          </div>
                        )}
                      </div>
                      <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center overflow-hidden">
                        {icon ? <img src={icon} alt="" className="h-3.5 w-3.5 object-contain" /> : <Share2 className="h-3 w-3" />}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="text-sm font-bold truncate">{acc.displayName || label}</p>
                        {healthy ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                        ) : (
                          <AlertCircle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">{label}</p>
                      {acc.platformUsername && (
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">@{acc.platformUsername}</p>
                      )}
                      {!healthy && acc.healthMessage && (
                        <p className="text-[10px] text-amber-700 mt-1.5 line-clamp-2">{acc.healthMessage}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <Badge className={healthy ? "bg-emerald-500/10 text-emerald-600 border-0 text-[9px]" : "bg-amber-500/10 text-amber-700 border-0 text-[9px]"}>
                        {healthy ? "Connected" : acc.healthStatus || "Warning"}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => handleDisconnect(acc.id, acc.displayName || label)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showAdd} onOpenChange={open => { setShowAdd(open); if (!open) setSelectedPlatform(""); }}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display">Connect Social Platform</DialogTitle>
            <DialogDescription className="text-xs">
              Choose an enabled platform — same list as Social Media → Accounts
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 py-2">
            {CLIENT_SOCIAL_PLATFORMS.map(p => {
              const status = platformStatus[p.id] || { enabled: false };
              const icon = clientSocialIcon(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  disabled={!status.enabled}
                  onClick={() => setSelectedPlatform(p.id)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                    !status.enabled
                      ? "opacity-40 cursor-not-allowed border-border/30 bg-muted/20"
                      : selectedPlatform === p.id
                      ? "border-primary bg-primary/5 ring-1 ring-primary/20"
                      : "border-border/60 hover:border-primary/40"
                  }`}
                >
                  <div className="h-9 w-9 rounded-lg border border-border/40 bg-background flex items-center justify-center overflow-hidden">
                    {icon ? <img src={icon} alt="" className="h-5 w-5 object-contain" /> : <Share2 className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] font-bold text-center leading-tight">{p.label}</span>
                  {status.enabled ? (
                    <span className="text-[9px] font-black text-emerald-600">Available</span>
                  ) : (
                    <span className="text-[9px] font-black text-muted-foreground">Not set</span>
                  )}
                </button>
              );
            })}
          </div>
          {CLIENT_SOCIAL_PLATFORMS.every(p => !(platformStatus[p.id]?.enabled)) && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              No platforms are enabled. Enable them in Settings → Plugins first.
            </div>
          )}
          {(selectedPlatform === "facebook" || selectedPlatform === "instagram") && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs text-amber-800 leading-relaxed">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                In Facebook keep <strong>all client Pages</strong> checked (Meta revokes unchecked ones).
                In our app, pick only <strong>this</strong> client’s account.
              </span>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button
              variant="hero"
              onClick={() => handleConnect()}
              disabled={connecting || !selectedPlatform}
              className="gap-2"
            >
              {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              {connecting ? "Redirecting..." : "Authenticate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Documents Tab ────────────────────────────────────────────────

const DOC_TYPE_LABELS: Record<string, string> = {
  CONTRACT: "Contract", REPORT: "Report", ONBOARDING: "Onboarding",
  BRAND_GUIDE: "Brand Guide", CONTENT_CALENDAR: "Content Calendar", OTHER: "Other",
};

function ClientDocumentsTab({ clientId, setPreviewDoc }: { clientId: string, setPreviewDoc: (doc: any) => void }) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [form, setForm] = useState({
    title: "", type: "OTHER", internalNotes: "", clientNotes: "",
    expiryDate: "", clientVisible: true,
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const fetchDocuments = async () => {
    try {
      const res = await apiFetch<{ documents: any[] }>(`/clients/${clientId}/documents`);
      setDocuments(res.documents);
    } catch { /* ignore */ }
    setLoading(false);
  };

  useEffect(() => { fetchDocuments(); }, [clientId]);

  const handleUpload = async () => {
    if (!selectedFile || !form.title) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("title", form.title);
      formData.append("type", form.type);
      if (form.internalNotes) formData.append("internalNotes", form.internalNotes);
      if (form.clientNotes) formData.append("clientNotes", form.clientNotes);
      if (form.expiryDate) formData.append("expiryDate", form.expiryDate);
      formData.append("clientVisible", String(form.clientVisible));

      await apiUpload(`/clients/${clientId}/documents`, formData, (progress) => {
        setUploadProgress(progress);
      });

      setShowUpload(false);
      setSelectedFile(null);
      setForm({ title: "", type: "OTHER", internalNotes: "", clientNotes: "", expiryDate: "", clientVisible: true });
      await fetchDocuments();
      toast({ title: "Document uploaded", description: `"${form.title}" has been uploaded.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message || "Could not upload document", variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDelete = async (docId: string) => {
    try {
      await apiFetch(`/clients/${clientId}/documents/${docId}`, { method: "DELETE" });
      await fetchDocuments();
      toast({ title: "Deleted", description: "Document removed." });
    } catch {
      toast({ title: "Error", description: "Failed to delete document", variant: "destructive" });
    }
  };

  const handleToggleVisibility = async (docId: string, visible: boolean) => {
    try {
      await apiFetch(`/clients/${clientId}/documents/${docId}`, {
        method: "PUT",
        body: JSON.stringify({ clientVisible: visible }),
      });
      await fetchDocuments();
    } catch {
      toast({ title: "Error", description: "Failed to update visibility", variant: "destructive" });
    }
  };


  if (loading) return <InlineTableSkeleton rows={4} />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-display font-bold">Documents & Contracts</h3>
          <p className="text-xs text-muted-foreground font-medium">Uploaded files, contracts, and reports for this client</p>
        </div>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs font-bold" onClick={() => setShowUpload(true)}>
          <Upload className="h-3.5 w-3.5" /> Upload Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Upload contracts, brand guides, or reports</p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <Table>
              <TableHeader className="bg-muted/30">
                <TableRow>
                  <TableHead className="font-bold text-xs">Document</TableHead>
                  <TableHead className="font-bold text-xs">Type</TableHead>
                  <TableHead className="font-bold text-xs">Expiry</TableHead>
                  <TableHead className="font-bold text-xs text-center">Client Visible</TableHead>
                  <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {documents.map(doc => (
                  <TableRow key={doc.id} className="hover:bg-muted/30 transition-colors group">
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-bold text-foreground/90">{doc.title}</p>
                          {doc.isSigned && <Badge className="bg-emerald-500/10 text-emerald-600 border-0 text-[9px] mt-0.5">Signed</Badge>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="text-[10px] font-bold uppercase">{DOC_TYPE_LABELS[doc.type] || doc.type}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {doc.expiryDate ? new Date(doc.expiryDate).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={doc.clientVisible}
                        onCheckedChange={v => handleToggleVisibility(doc.id, v)}
                        className="mx-auto"
                      />
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-primary hover:bg-primary/5"
                          onClick={() => setPreviewDoc({
                            title: doc.title,
                            fileUrl: doc.fileUrl,
                            type: doc.type
                          })}
                        >
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-7 w-7"
                          onClick={() => downloadProtectedFile(doc.fileUrl, doc.title)}
                        >
                          <Download className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(doc.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={setShowUpload}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display">Upload Document</DialogTitle>
            <DialogDescription className="text-xs">Upload a contract, report, or brand guide for this client</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div
              className="border-2 border-dashed border-border/50 rounded-xl p-6 text-center cursor-pointer hover:border-primary/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              {selectedFile ? (
                <div className="space-y-1">
                  <FileText className="h-8 w-8 text-primary mx-auto" />
                  <p className="text-sm font-bold">{selectedFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              ) : (
                <div className="space-y-1">
                  <Upload className="h-8 w-8 text-muted-foreground/40 mx-auto" />
                  <p className="text-sm font-medium text-muted-foreground">Click to select a file</p>
                  <p className="text-[10px] text-muted-foreground/60">PDF, Word, Excel, or images (max 10MB)</p>
                </div>
              )}
              <input ref={fileInputRef} type="file" className="hidden" onChange={e => setSelectedFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <Label className="text-xs font-bold">Title</Label>
              <Input placeholder="Document title..." value={form.title} onChange={e => setForm(prev => ({ ...prev, title: e.target.value }))} className="mt-1.5" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-bold">Type</Label>
                <Select value={form.type} onValueChange={v => setForm(prev => ({ ...prev, type: v }))}>
                  <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOC_TYPE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs font-bold">Expiry Date</Label>
                <Input type="date" value={form.expiryDate} onChange={e => setForm(prev => ({ ...prev, expiryDate: e.target.value }))} className="mt-1.5" />
              </div>
            </div>
            <div>
              <Label className="text-xs font-bold">Internal Notes <span className="text-muted-foreground font-normal">(agency only)</span></Label>
              <Textarea placeholder="Notes only visible to your team..." value={form.internalNotes} onChange={e => setForm(prev => ({ ...prev, internalNotes: e.target.value }))} className="mt-1.5" rows={2} />
            </div>
            <div>
              <Label className="text-xs font-bold">Client Notes <span className="text-muted-foreground font-normal">(visible on portal)</span></Label>
              <Textarea placeholder="Notes visible to the client..." value={form.clientNotes} onChange={e => setForm(prev => ({ ...prev, clientNotes: e.target.value }))} className="mt-1.5" rows={2} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">Visible to Client on Portal</Label>
              <Switch checked={form.clientVisible} onCheckedChange={v => setForm(prev => ({ ...prev, clientVisible: v }))} />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setShowUpload(false)} disabled={uploading}>Cancel</Button>
              <Button variant="hero" onClick={handleUpload} disabled={uploading || !selectedFile || !form.title} className="gap-2">
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Upload"}
              </Button>
            </div>
            {uploading && (
              <div className="w-full space-y-1.5 mt-2">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>Uploading document</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

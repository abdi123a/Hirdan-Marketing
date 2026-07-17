import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  Instagram, Facebook, Linkedin, Youtube, Twitter,
  ListFilter, LayoutGrid, CalendarDays, Search, Plus, Sparkles,
  RefreshCw, CheckCircle2, Clock, Loader2, ExternalLink, Eye, EyeOff,
  ChevronDown, ChevronRight, Image, Video, FileText, Zap, Send, XCircle, ArrowUpRight,
  Maximize2, Minimize2, Users, Columns, History, Layers, ArrowUpDown, SortAsc, SortDesc, CalendarCheck
} from "lucide-react";
import { apiFetch, apiUpload, apiFetchBlob, downloadProtectedFile } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { DocumentViewer } from "@/components/DocumentViewer";
import { KanbanSkeleton } from "@/components/ui/PageSkeleton";

// ─── Platform utilities ───────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  INSTAGRAM: { icon: Instagram, color: "text-pink-500", bg: "bg-gradient-to-br from-purple-500/10 to-pink-500/10 border-pink-500/20" },
  FACEBOOK: { icon: Facebook, color: "text-blue-600", bg: "bg-blue-500/10 border-blue-500/20" },
  LINKEDIN: { icon: Linkedin, color: "text-blue-700", bg: "bg-blue-700/10 border-blue-700/20" },
  YOUTUBE: { icon: Youtube, color: "text-red-600", bg: "bg-red-500/10 border-red-500/20" },
  X: { icon: Twitter, color: "text-foreground", bg: "bg-foreground/5 border-foreground/10" },
  TIKTOK: { icon: Zap, color: "text-cyan-500", bg: "bg-cyan-500/10 border-cyan-500/20" },
  SNAPCHAT: { icon: Send, color: "text-yellow-500", bg: "bg-yellow-500/10 border-yellow-500/20" },
  PINTEREST: { icon: Image, color: "text-red-500", bg: "bg-red-500/10 border-red-500/20" },
  OTHER: { icon: Sparkles, color: "text-muted-foreground", bg: "bg-muted/50 border-border" },
};

function PlatformBadge({ platform }: { platform: string }) {
  const config = PLATFORM_CONFIG[platform] || PLATFORM_CONFIG.OTHER;
  const Icon = config.icon;
  const isPinterest = platform === "PINTEREST";
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border ${config.bg}`}>
      <div className="translate-y-[0.5px]">
        {isPinterest ? (
          <img src="/social-icons/pinterest.png" className="h-3.5 w-3.5 object-contain" alt="Pinterest" />
        ) : (
          <Icon className={`h-3.5 w-3.5 ${config.color}`} />
        )}
      </div>
      <span className={config.color}>{platform}</span>
    </div>
  );
}

const TYPE_ICONS: Record<string, any> = {
  POST: Image, STORY: Zap, REEL: Video, SHORT: Video, VIDEO: Video, REPORT: FileText, OTHER: Sparkles,
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  PENDING: { label: "Pending", color: "text-slate-500", bg: "bg-slate-500/10 border-slate-500/20", icon: Clock },
  PLANNED: { label: "Planned", color: "text-blue-500", bg: "bg-blue-500/10 border-blue-500/20", icon: CalendarDays },
  IN_PROGRESS: { label: "In Progress", color: "text-amber-500", bg: "bg-amber-500/10 border-amber-500/20", icon: RefreshCw },
  WAITING_APPROVAL: { label: "Awaiting Approval", color: "text-purple-500", bg: "bg-purple-500/10 border-purple-500/20", icon: Eye },
  COMPLETED: { label: "Completed", color: "text-emerald-500", bg: "bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
  CANCELLED: { label: "Cancelled", color: "text-red-400", bg: "bg-red-500/10 border-red-500/20", icon: XCircle },
};

// ─── Types ────────────────────────────────────────────────────────

interface Task {
  id: string;
  title: string;
  type: string;
  status: string;
  dueDate: string | null;
  clientVisible: boolean;
  internalNotes: string | null;
  clientNotes: string | null;
  postUrl: string | null;
  postedAt: string | null;
  proofUrl: string | null;
  mediaUrl: string | null;
  createdAt: string;
  platforms: { id?: string; platform: string }[];
  assignee: { id: string; name: string; avatar?: string } | null;
  client: { id: string; name: string; company: string };
  cycle: { id: string; label: string; cycleStart?: string; cycleEnd?: string };
  subscription: { id: string; plan: string };
}

interface Cycle {
  id: string;
  label: string;
  cycleStart: string;
  cycleEnd: string;
  tasksGenerated: boolean;
  totalTasks: number;
  completedTasks: number;
  progress: number;
  subscription: {
    id: string;
    plan: string;
    client: { id: string; name: string; company: string };
  };
}

// ─── Main Page Component ──────────────────────────────────────────

export default function SocialMediaTasksPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients, subscriptions, team, fetchClients, fetchSubscriptions, fetchTeam } = useAgencyStore();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [cycles, setCycles] = useState<Cycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"board" | "list">("board");

  // Filters
  const [filterClient, setFilterClient] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterAssignee, setFilterAssignee] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // New Organisation States
  const [groupBy, setGroupBy] = useState<"status" | "client">("status");
  const [density, setDensity] = useState<"comfortable" | "compact">("comfortable");
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());
  const [showOnlyCurrentCycle, setShowOnlyCurrentCycle] = useState(false);
  const [sortBy, setSortBy] = useState<string>("dueDate_asc");

  // Task completion modal
  const [completionTask, setCompletionTask] = useState<Task | null>(null);
  const [completionForm, setCompletionForm] = useState<{
    postUrl: string;
    postedAt: string;
    clientNotes: string;
    clientVisible: boolean;
    proofFile: File | null;
    previewUrl: string | null;
  }>({
    postUrl: "", 
    postedAt: new Date().toISOString().split("T")[0], 
    clientNotes: "", 
    clientVisible: true,
    proofFile: null,
    previewUrl: null,
  });

  // Generate tasks modal
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [generateForm, setGenerateForm] = useState({
    subscriptionId: "", cycleStart: "", cycleEnd: "", label: "",
  });
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedPreviewDoc, setSelectedPreviewDoc] = useState<{ title: string, fileUrl: string, type?: string } | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────

  const fetchTasks = async () => {
    try {
      const params = new URLSearchParams();
      if (filterClient !== "all") params.set("clientId", filterClient);
      if (filterStatus !== "all") params.set("status", filterStatus);
      if (filterAssignee !== "all") params.set("teamMemberId", filterAssignee);
      const res = await apiFetch<{ tasks: Task[] }>(`/tasks?${params.toString()}`);
      setTasks(res.tasks);
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
    }
  };

  const fetchCycles = async () => {
    try {
      const res = await apiFetch<{ cycles: Cycle[] }>("/tasks/cycles/list");
      setCycles(res.cycles);
    } catch (err) {
      console.error("Failed to fetch cycles:", err);
    }
  };

  useEffect(() => {
    const loadAll = async () => {
      setLoading(true);
      await Promise.all([
        fetchTasks(),
        fetchCycles(),
        clients.length === 0 ? fetchClients() : Promise.resolve(),
        team.length === 0 ? fetchTeam() : Promise.resolve(),
        subscriptions.length === 0 ? fetchSubscriptions() : Promise.resolve(),
      ]);
      setLoading(false);
    };
    loadAll();
  }, []);

  useEffect(() => { fetchTasks(); }, [filterClient, filterStatus, filterAssignee]);

  // ─── Derived Data ───────────────────────────────────────────────

  const filteredTasks = useMemo(() => {
    let result = tasks;

    // Search query filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        t => t.title.toLowerCase().includes(q) ||
          t.client.company.toLowerCase().includes(q) ||
          t.client.name.toLowerCase().includes(q)
      );
    }

    // Current/Next Cycle filter
    if (showOnlyCurrentCycle) {
      const now = new Date();
      const currentMonth = now.toISOString().slice(0, 7); // YYYY-MM
      // Get next month as well
      const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      const nextMonth = nextDate.toISOString().slice(0, 7);
      
      result = result.filter(t => {
        // Assuming cycle label or serviceCycle contains month info. 
        // Based on the generated tasks logic, t.cycle.label is like "March 2026"
        // Let's try to match by cycle label if YYYY-MM is not explicitly stored in the Task object.
        const label = t.cycle?.label?.toLowerCase() || "";
        const currentMonthName = now.toLocaleString("default", { month: "long" }).toLowerCase();
        const nextMonthName = nextDate.toLocaleString("default", { month: "long" }).toLowerCase();
        return label.includes(currentMonthName) || label.includes(nextMonthName);
      });
    }

    return result;
  }, [tasks, searchQuery, showOnlyCurrentCycle]);

  const sortedTasks = useMemo(() => {
    const result = [...filteredTasks];
    
    result.sort((a, b) => {
      switch (sortBy) {
        case "dueDate_asc":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        case "dueDate_desc":
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(b.dueDate).getTime() - new Date(a.dueDate).getTime();
        case "createdAt_desc":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "createdAt_asc":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        case "title_asc":
          return a.title.localeCompare(b.title);
        case "client_asc":
          return (a.client.company || a.client.name).localeCompare(b.client.company || b.client.name);
        default:
          return 0;
      }
    });

    return result;
  }, [filteredTasks, sortBy]);

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(sectionId)) next.delete(sectionId);
      else next.add(sectionId);
      return next;
    });
  };

  const statusColumns = useMemo(() => {
    const statusOrder = ["PENDING", "PLANNED", "IN_PROGRESS", "WAITING_APPROVAL", "COMPLETED"];
    return statusOrder.map(status => ({
      status,
      config: STATUS_CONFIG[status],
      tasks: sortedTasks.filter(t => t.status === status),
    }));
  }, [sortedTasks]);

  const clientRows = useMemo(() => {
    const clientsMap = new Map<string, { id: string; name: string; company: string; tasks: Task[] }>();
    
    sortedTasks.forEach(task => {
      const clientId = task.client.id;
      if (!clientsMap.has(clientId)) {
        clientsMap.set(clientId, { ...task.client, tasks: [] });
      }
      clientsMap.get(clientId)!.tasks.push(task);
    });

    const result = Array.from(clientsMap.values());
    
    // If we're grouped by client, we might want to keep the client order consistent 
    // but the tasks within each client row are already sorted by sortedTasks useMemo.
    return result.sort((a, b) => 
      (a.company || a.name).localeCompare(b.company || b.name)
    );
  }, [sortedTasks]);

  // ─── Task Status Update ─────────────────────────────────────────

  const handleStatusChange = async (taskId: string, newStatus: string) => {
    try {
      await apiFetch(`/tasks/${taskId}`, { method: "PUT", body: JSON.stringify({ status: newStatus }) });
      await fetchTasks();
      toast({ title: "Task updated", description: `Status changed to ${STATUS_CONFIG[newStatus]?.label || newStatus}` });
    } catch {
      toast({ title: "Error", description: "Failed to update task status", variant: "destructive" });
    }
  };

  // ─── Task Completion ────────────────────────────────────────────

  const handleComplete = async () => {
    if (!completionTask) return;
    try {
      setUploading(true);
      setUploadProgress(0);
      const formData = new FormData();
      formData.append("postUrl", completionForm.postUrl);
      formData.append("postedAt", completionForm.postedAt);
      formData.append("clientNotes", completionForm.clientNotes);
      formData.append("clientVisible", String(completionForm.clientVisible));
      if (completionForm.proofFile) {
        formData.append("proof", completionForm.proofFile);
      }

      await apiUpload(`/tasks/${completionTask.id}/complete`, formData, (progress) => {
        setUploadProgress(progress);
      });

      setCompletionTask(null);
      if (completionForm.previewUrl) {
        URL.revokeObjectURL(completionForm.previewUrl);
      }
      setCompletionForm({
        postUrl: "",
        postedAt: new Date().toISOString().split("T")[0],
        clientNotes: "",
        clientVisible: true,
        proofFile: null,
        previewUrl: null,
      });
      await fetchTasks();
      await fetchCycles();
      toast({ title: "Task completed!", description: `"${completionTask.title}" marked as completed.` });
    } catch {
      toast({ title: "Error", description: "Failed to complete task", variant: "destructive" });
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  // ─── Generate Tasks ─────────────────────────────────────────────

  const handleGenerate = async () => {
    try {
      setGenerating(true);
      const res = await apiFetch<{ count: number; cycle: any }>("/tasks/generate", {
        method: "POST",
        body: JSON.stringify(generateForm),
      });
      setShowGenerateModal(false);
      setGenerateForm({ subscriptionId: "", cycleStart: "", cycleEnd: "", label: "" });
      await Promise.all([fetchTasks(), fetchCycles()]);
      toast({ title: "Tasks generated!", description: `${res.count} deliverable tasks created for ${res.cycle.label}.` });
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message || "Could not generate tasks", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ─── Auto-fill month label from dates ───────────────────────────

  useEffect(() => {
    if (generateForm.cycleStart) {
      const d = new Date(generateForm.cycleStart);
      const label = d.toLocaleDateString("en-US", { month: "long", year: "numeric" });
      setGenerateForm(prev => ({ ...prev, label }));
      // Auto-fill cycle end to last day of month
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      setGenerateForm(prev => ({ ...prev, cycleEnd: end.toISOString().split("T")[0] }));
    }
  }, [generateForm.cycleStart]);

  // ─── Stats ──────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: tasks.length,
    completed: tasks.filter(t => t.status === "COMPLETED").length,
    inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
    pending: tasks.filter(t => t.status === "PENDING" || t.status === "PLANNED").length,
  }), [tasks]);

  if (loading) {
    return <KanbanSkeleton />;
  }

  return (
    <div className="space-y-6 max-w-[1600px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">Social Media Tasks</h1>
          <p className="text-sm text-muted-foreground font-medium mt-1">Manage deliverables, track progress, and complete content tasks</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold" onClick={() => navigate('/dashboard/social-media/planner')}>
            <CalendarCheck className="h-3.5 w-3.5" /> Content Planner
          </Button>
          <Button variant="outline" size="sm" className="h-9 gap-2 text-xs font-semibold" onClick={() => setShowGenerateModal(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Generate Tasks
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Tasks", value: stats.total, icon: ListFilter, color: "blue", status: "all" },
          { label: "In Progress", value: stats.inProgress, icon: RefreshCw, color: "amber", status: "IN_PROGRESS" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "slate", status: "PENDING" },
          { label: "Completed", value: stats.completed, icon: CheckCircle2, color: "emerald", status: "COMPLETED" },
        ].map((s, i) => (
          <Card 
            key={i} 
            className={`border-border/50 hover:border-primary/40 transition-all duration-300 cursor-pointer group hover:shadow-md ${filterStatus === s.status ? "border-primary/40 bg-primary/5" : ""}`}
            onClick={() => setFilterStatus(s.status)}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-${s.color}-500/10 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                <div className="translate-y-[0.5px]">
                  <s.icon className={`h-4.5 w-4.5 text-${s.color}-500`} />
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest">{s.label}</p>
                <p className="text-xl font-display font-bold">{s.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Cycle Progress Cards */}
      {cycles.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {cycles.slice(0, 3).map(cycle => (
            <Card key={cycle.id} className="border-border/50 overflow-hidden group hover:border-primary/20 transition-all">
              <div className="h-1 w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold text-foreground">{cycle.label}</p>
                    <p className="text-[10px] text-muted-foreground font-medium">
                      {cycle.subscription?.client?.company || cycle.subscription?.client?.name} · {cycle.subscription?.plan}
                    </p>
                  </div>
                  <span className="text-lg font-display font-bold text-primary">{cycle.progress}%</span>
                </div>
                <Progress value={cycle.progress} className="h-2" />
                <div className="flex items-center justify-between text-[10px] text-muted-foreground font-bold uppercase tracking-wider">
                  <span>{cycle.completedTasks}/{cycle.totalTasks} tasks</span>
                  <span>{new Date(cycle.cycleStart).toLocaleDateString("en-US", { month: "short", day: "numeric" })} – {new Date(cycle.cycleEnd).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filters & Tools */}
      <Card className="border-border/50 sticky top-4 z-30 shadow-lg shadow-primary/5 backdrop-blur-md bg-background/80">
        <CardContent className="p-3 md:p-4">
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-4">
            {/* Search & Basic Filters */}
            <div className="flex flex-1 flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full md:max-w-[240px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9 h-9 text-sm border-border/60 focus:border-primary/40 transition-all"
                />
              </div>
              <Select value={filterClient} onValueChange={setFilterClient}>
                <SelectTrigger className="w-full md:w-[160px] h-9 text-xs font-medium">
                  <SelectValue placeholder="All Clients" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Clients</SelectItem>
                  {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-full md:w-[150px] h-9 text-xs font-medium">
                  <SelectValue placeholder="All Statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={filterAssignee} onValueChange={setFilterAssignee}>
                <SelectTrigger className="w-full md:w-[150px] h-9 text-xs font-medium">
                  <SelectValue placeholder="All Assignees" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Assignees</SelectItem>
                  {team.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={sortBy} onValueChange={setSortBy}>
                <SelectTrigger className="w-full md:w-[150px] h-9 text-xs font-medium">
                  <div className="flex items-center gap-2">
                    <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                    <SelectValue placeholder="Sort by" />
                  </div>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="dueDate_asc">Due Date (Soonest)</SelectItem>
                  <SelectItem value="dueDate_desc">Due Date (Latest)</SelectItem>
                  <SelectItem value="createdAt_desc">Newest Created</SelectItem>
                  <SelectItem value="createdAt_asc">Oldest Created</SelectItem>
                  <SelectItem value="title_asc">Title (A-Z)</SelectItem>
                  <SelectItem value="client_asc">Client (A-Z)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* View Controls */}
            <div className="flex flex-wrap items-center gap-3 pt-3 lg:pt-0 border-t lg:border-t-0 lg:border-l border-border/40 lg:pl-4">
              <div className="flex items-center gap-1.5 mr-2">
                <Button 
                  variant={showOnlyCurrentCycle ? "default" : "outline"} 
                  size="sm" 
                  className="h-9 gap-2 text-xs font-semibold px-3"
                  onClick={() => setShowOnlyCurrentCycle(!showOnlyCurrentCycle)}
                >
                  <History className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">Active Cycles</span>
                </Button>
              </div>

              <div className="h-8 w-[1px] bg-border/40 hidden md:block mr-1" />

              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
                <Button 
                  variant={groupBy === "status" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="h-8 w-8 rounded-md" 
                  onClick={() => setGroupBy("status")}
                  title="Group by Status"
                >
                  <Columns className="h-4 w-4" />
                </Button>
                <Button 
                  variant={groupBy === "client" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="h-8 w-8 rounded-md" 
                  onClick={() => setGroupBy("client")}
                  title="Group by Client"
                >
                  <Users className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
                <Button 
                  variant={density === "comfortable" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="h-8 w-8 rounded-md" 
                  onClick={() => setDensity("comfortable")}
                  title="Comfortable Density"
                >
                  <Maximize2 className="h-4 w-4" />
                </Button>
                <Button 
                  variant={density === "compact" ? "secondary" : "ghost"} 
                  size="icon" 
                  className="h-8 w-8 rounded-md" 
                  onClick={() => setDensity("compact")}
                  title="Compact Density"
                >
                  <Minimize2 className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex items-center gap-1 bg-muted/30 rounded-lg p-0.5 border border-border/40">
                <Button variant={view === "board" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-md" onClick={() => setView("board")}>
                  <LayoutGrid className="h-4 w-4" />
                </Button>
                <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-8 w-8 rounded-md" onClick={() => setView("list")}>
                  <ListFilter className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Task View Content */}
      {view === "board" && groupBy === "status" ? (
        <div className="flex overflow-x-auto pb-6 gap-6 items-start scrollbar-thin scrollbar-thumb-border hover:scrollbar-thumb-primary/20">
          {statusColumns.map(col => (
            <div key={col.status} className="flex flex-col h-full min-w-[280px] last:pr-6">
              <div 
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition-all hover:bg-opacity-80 mb-3 shadow-sm ${col.config.bg}`}
                onClick={() => toggleSection(col.status)}
              >
                {collapsedSections.has(col.status) ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <div className="translate-y-[0.5px]">
                  <col.config.icon className={`h-3.5 w-3.5 ${col.config.color}`} />
                </div>
                <span className={`text-xs font-bold uppercase tracking-wider ${col.config.color}`}>{col.config.label}</span>
                <Badge variant="secondary" className="ml-auto text-[10px] h-5 px-1.5 font-bold bg-background/50">{col.tasks.length}</Badge>
              </div>
              
              {!collapsedSections.has(col.status) && (
                <div className="space-y-2 flex-1 animate-in fade-in slide-in-from-top-1 duration-300">
                  {col.tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      density={density}
                      onStatusChange={handleStatusChange}
                      onComplete={() => {
                        setCompletionTask(task);
                        setCompletionForm({
                          postUrl: task.postUrl || "",
                          postedAt: new Date().toISOString().split("T")[0],
                          clientNotes: task.clientNotes || "",
                          clientVisible: task.clientVisible,
                          proofFile: null,
                          previewUrl: null,
                        });
                      }}
                    />
                  ))}
                  {col.tasks.length === 0 && (
                    <div className="text-center py-10 border-2 border-dashed border-border/20 rounded-2xl bg-muted/5">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/30">No tasks</p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : view === "board" && groupBy === "client" ? (
        /* Board View - Grouped by Client */
        <div className="space-y-8">
          {clientRows.map(client => (
            <div key={client.id} className="space-y-4">
              <div 
                className="flex items-center gap-3 px-4 py-3 bg-muted/30 border border-border/40 rounded-xl cursor-pointer hover:bg-muted/50 transition-all group"
                onClick={() => toggleSection(client.id)}
              >
                <div className="p-1.5 bg-background rounded-lg border border-border/40 text-primary">
                  <Users className="h-4 w-4" />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-bold text-foreground">{client.company || client.name}</h3>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{client.tasks.length} Deliverables</p>
                </div>
                <div className="flex items-center gap-2">
                  <div className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-600">
                    <CheckCircle2 className="h-3 w-3" />
                    <span className="text-[10px] font-bold">{client.tasks.filter(t => t.status === "COMPLETED").length} Done</span>
                  </div>
                  {collapsedSections.has(client.id) ? <ChevronRight className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                </div>
              </div>

              {!collapsedSections.has(client.id) && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4 animate-in fade-in slide-in-from-top-2 duration-300">
                  {client.tasks.map(task => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      density={density}
                      onStatusChange={handleStatusChange}
                      onShowProof={(t) => setSelectedPreviewDoc({ title: t.title, fileUrl: t.proofUrl! })}
                      onComplete={() => {
                        setCompletionTask(task);
                        setCompletionForm({
                          postUrl: task.postUrl || "",
                          postedAt: new Date().toISOString().split("T")[0],
                          clientNotes: task.clientNotes || "",
                          clientVisible: task.clientVisible,
                          proofFile: null,
                          previewUrl: null,
                        });
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}
          {clientRows.length === 0 && (
            <div className="py-20 text-center bg-muted/10 border border-dashed border-border/40 rounded-3xl">
              <ListFilter className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm font-bold text-muted-foreground">No tasks matching your filters</p>
            </div>
          )}
        </div>
      ) : (
        /* List View */
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <table className="w-full">
              <thead className="bg-muted/30 border-b border-border/40">
                <tr>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Task</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Client</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Platforms</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Status</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Assignee</th>
                  <th className="px-4 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Due</th>
                  <th className="px-4 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {sortedTasks.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-16 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No tasks found</td>
                  </tr>
                ) : sortedTasks.map(task => {
                  const TypeIcon = TYPE_ICONS[task.type] || Sparkles;
                  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
                  return (
                    <tr key={task.id} className="hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center border border-border/40">
                            <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
                          </div>
                          <div>
                            <p className="text-sm font-bold text-foreground/90">{task.title}</p>
                            <p className="text-[10px] text-muted-foreground font-medium">{task.type} · {task.cycle?.label}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs font-medium text-foreground/80">{task.client.company || task.client.name}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-1">{task.platforms.map((p, i) => <PlatformBadge key={i} platform={p.platform} />)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <Select value={task.status} onValueChange={(v) => handleStatusChange(task.id, v)}>
                          <SelectTrigger className={`h-7 w-[150px] text-[10px] font-bold border ${sc.bg} ${sc.color}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{task.assignee?.name || "Unassigned"}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}</td>
                      <td className="px-4 py-3 text-right">
                        {task.status !== "COMPLETED" && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] font-bold uppercase gap-1 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                            onClick={() => {
                              setCompletionTask(task);
                              setCompletionForm({
                                postUrl: task.postUrl || "",
                                postedAt: new Date().toISOString().split("T")[0],
                                clientNotes: task.clientNotes || "",
                                clientVisible: task.clientVisible,
                                proofFile: null,
                                previewUrl: null,
                              });
                            }}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Complete
                          </Button>
                        )}
                        {task.postUrl && (
                          <a href={task.postUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[10px] text-primary font-bold hover:underline ml-2">
                            <ExternalLink className="h-3 w-3" /> View Post
                          </a>
                        )}
                        {task.proofUrl && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-[10px] font-bold uppercase gap-1 text-muted-foreground hover:text-primary ml-2"
                            onClick={() => setSelectedPreviewDoc({
                              title: task.title,
                              fileUrl: task.proofUrl!,
                            })}
                          >
                            <Eye className="h-3 w-3" /> Proof
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {/* ─── Task Completion Modal ──────────────────────────────── */}
      <Dialog open={!!completionTask} onOpenChange={() => setCompletionTask(null)}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display">Complete Task</DialogTitle>
            <DialogDescription className="text-xs">
              Mark "{completionTask?.title}" as completed. Add the live post URL and notes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold">Live Post URL</Label>
              <Input
                placeholder="https://instagram.com/p/..."
                value={completionForm.postUrl}
                onChange={e => setCompletionForm(prev => ({ ...prev, postUrl: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Posted Date</Label>
              <Input
                type="date"
                value={completionForm.postedAt}
                onChange={e => setCompletionForm(prev => ({ ...prev, postedAt: e.target.value }))}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label className="text-xs font-bold">Client-Visible Notes</Label>
              <Textarea
                placeholder="Notes visible to the client on their portal..."
                value={completionForm.clientNotes}
                onChange={e => setCompletionForm(prev => ({ ...prev, clientNotes: e.target.value }))}
                className="mt-1.5"
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold">Visible to Client</Label>
              <Switch
                checked={completionForm.clientVisible}
                onCheckedChange={v => setCompletionForm(prev => ({ ...prev, clientVisible: v }))}
              />
            </div>

            <div className="space-y-2 pt-2 border-t border-border/40">
              <Label className="text-xs font-bold flex items-center gap-2">
                <Image className="h-3.5 w-3.5 text-primary" /> Proof of Work (Optional)
              </Label>
              <div 
                className={`relative border-2 border-dashed rounded-xl p-4 transition-all duration-300 ${
                  completionForm.previewUrl ? "border-primary/40 bg-primary/5" : "border-border/60 hover:border-primary/40 hover:bg-muted/50"
                }`}
              >
                <input
                  type="file"
                  accept="image/*,video/*"
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (completionForm.previewUrl) URL.revokeObjectURL(completionForm.previewUrl);
                      const url = file.type.startsWith("image/") ? URL.createObjectURL(file) : null;
                      setCompletionForm(prev => ({ ...prev, proofFile: file, previewUrl: url }));
                    }
                  }}
                />
                
                {completionForm.previewUrl ? (
                  <div className="relative aspect-video rounded-lg overflow-hidden border border-border/40">
                    <img src={completionForm.previewUrl} className="w-full h-full object-cover" alt="Proof preview" />
                    <Button 
                      variant="destructive" 
                      size="icon" 
                      className="absolute top-2 right-2 h-6 w-6 rounded-md shadow-lg z-20"
                      onClick={(e) => {
                        e.preventDefault();
                        if (completionForm.previewUrl) URL.revokeObjectURL(completionForm.previewUrl);
                        setCompletionForm(prev => ({ ...prev, proofFile: null, previewUrl: null }));
                      }}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-4 space-y-2">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground">Upload Screenshot/Video</p>
                      <p className="text-[9px] text-muted-foreground mt-0.5">Drag and drop or click to browse</p>
                    </div>
                  </div>
                )}
                
                {completionForm.proofFile && !completionForm.previewUrl && (
                  <div className="flex items-center gap-2 p-2 bg-background/50 rounded-lg border border-border/40">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-[10px] font-medium truncate flex-1">{completionForm.proofFile.name}</span>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="h-5 w-5 hover:bg-destructive/10 hover:text-destructive"
                      onClick={(e) => {
                        e.preventDefault();
                        setCompletionForm(prev => ({ ...prev, proofFile: null }));
                      }}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="flex-col gap-2">
            <div className="flex w-full items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setCompletionTask(null)} disabled={uploading}>Cancel</Button>
              <Button variant="hero" onClick={handleComplete} className="gap-2" disabled={uploading}>
                {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {uploading ? "Uploading..." : "Mark Completed"}
              </Button>
            </div>
            {uploading && (
              <div className="w-full space-y-1.5">
                <div className="flex justify-between text-[10px] font-bold text-muted-foreground uppercase tracking-widest">
                  <span>Uploading files</span>
                  <span>{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="h-1.5" />
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Generate Tasks Modal ──────────────────────────────── */}
      <Dialog open={showGenerateModal} onOpenChange={setShowGenerateModal}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" /> Generate Monthly Tasks
            </DialogTitle>
            <DialogDescription className="text-xs">
              Auto-create deliverable tasks from a subscription's package template for a billing cycle.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-bold">Subscription</Label>
              <Select value={generateForm.subscriptionId} onValueChange={v => setGenerateForm(prev => ({ ...prev, subscriptionId: v }))}>
                <SelectTrigger className="mt-1.5">
                  <SelectValue placeholder="Select subscription..." />
                </SelectTrigger>
                <SelectContent>
                  {subscriptions.filter(s => s.status === "Active").map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.client} — {s.plan}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowGenerateModal(false)}>Cancel</Button>
            <Button
              variant="hero"
              onClick={handleGenerate}
              disabled={generating || !generateForm.subscriptionId || !generateForm.cycleStart || !generateForm.cycleEnd || !generateForm.label}
              className="gap-2"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {generating ? "Generating..." : "Generate Tasks"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── General Document Viewer ────────────────────────────── */}
      <DocumentViewer
        isOpen={!!selectedPreviewDoc}
        onClose={() => setSelectedPreviewDoc(null)}
        document={selectedPreviewDoc}
      />
    </div>
  );
}

// ─── Task Card Component ──────────────────────────────────────────

function TaskCard({ task, onStatusChange, onComplete, onShowProof, density = "comfortable" }: {
  task: Task;
  onStatusChange: (id: string, status: string) => void;
  onComplete: () => void;
  onShowProof?: (task: Task) => void;
  density?: "comfortable" | "compact";
}) {
  const TypeIcon = TYPE_ICONS[task.type] || Sparkles;
  const sc = STATUS_CONFIG[task.status] || STATUS_CONFIG.PENDING;
  const isCompact = density === "compact";

  return (
    <Card className={`border-border/50 hover:border-primary/20 transition-all duration-300 shadow-sm hover:shadow-md group ${isCompact ? "p-0" : ""}`}>
      <CardContent className={`${isCompact ? "p-2 space-y-1.5" : "p-3 space-y-2.5"}`}>
        {/* Title + Type */}
        <div className="flex items-start gap-2">
          {!isCompact && (
            <div className="w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center border border-border/40 shrink-0 mt-0.5">
              <div className="translate-y-[0.5px]">
                <TypeIcon className="h-3.5 w-3.5 text-muted-foreground" />
              </div>
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className={`${isCompact ? "text-[12px]" : "text-sm"} font-bold text-foreground/90 truncate leading-tight`}>{task.title}</p>
            <p className="text-[10px] text-muted-foreground font-medium truncate">{task.client.company || task.client.name}</p>
          </div>
          {!task.clientVisible && (
            <span title="Hidden from client"><EyeOff className="h-3 w-3 text-muted-foreground/40 shrink-0" /></span>
          )}
        </div>

        {/* Platforms */}
        <div className="flex flex-wrap gap-1">
          {task.platforms.slice(0, isCompact ? 2 : undefined).map((p, i) => <PlatformBadge key={i} platform={p.platform} />)}
          {isCompact && task.platforms.length > 2 && <span className="text-[8px] text-muted-foreground">+{task.platforms.length - 2}</span>}
        </div>

        {!isCompact && (
          <>
            {/* Cycle & Assignee */}
            <div className="flex items-center justify-between text-[10px] text-muted-foreground font-medium">
              <span>{task.cycle?.label || "No cycle"}</span>
              <span>{task.assignee?.name || "Unassigned"}</span>
            </div>

            {/* Due Date */}
            {task.dueDate && (
              <p className="text-[10px] text-muted-foreground/60 font-medium">
                Due: {new Date(task.dueDate).toLocaleDateString()}
              </p>
            )}
          </>
        )}

        {/* Post Link */}
        <div className="flex flex-wrap items-center gap-3">
          {task.postUrl && (
            <a href={task.postUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-[10px] text-primary font-bold hover:underline">
              <div className="translate-y-[0.5px]">
                <ExternalLink className="h-3 w-3" />
              </div>{" "}
              {isCompact ? "Post" : "View Live Post"}
            </a>
          )}
          {task.proofUrl && (
            <Button
              variant="ghost"
              size="sm"
              className="h-5 px-2 py-1 text-[9px] font-bold gap-1.5 text-muted-foreground hover:text-primary"
              onClick={() => onShowProof?.(task)}
            >
              <div className="translate-y-[0.5px]">
                <Eye className="h-3 w-3" />
              </div>{" "}
              {isCompact ? "Proof" : "View Proof"}
            </Button>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 pt-1">
          <Select value={task.status} onValueChange={(v) => onStatusChange(task.id, v)}>
            <SelectTrigger className={`${isCompact ? "h-5" : "h-6"} flex-1 text-[9px] font-bold border ${sc.bg} ${sc.color} rounded-md px-1.5`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          {task.status !== "COMPLETED" && task.status !== "CANCELLED" && (
            <Button
              variant="ghost"
              size="icon"
              className={`${isCompact ? "h-5 w-5" : "h-6 w-6"} rounded-md text-emerald-600 hover:bg-emerald-500/10`}
              onClick={onComplete}
              title="Mark completed"
            >
              <CheckCircle2 className={`${isCompact ? "h-3" : "h-3.5"} w-3.5`} />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

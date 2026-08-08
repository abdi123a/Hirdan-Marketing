import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, Mail, Phone, MoreHorizontal, Edit, Search, Eye, 
  Users, UserCheck, AlertTriangle, Building2, Clock, Archive, FileText
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAgencyStore, TeamMember } from "@/lib/store";
import { useState, useEffect, useMemo } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

type Tab = "active" | "old" | "drafts";

export default function TeamPage() {
  const { team, deleteTeamMember, fetchTeam, updateTeamMember } = useAgencyStore();

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);

  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("active");
  const { toast } = useToast();
  const navigate = useNavigate();

  // Load drafts from localStorage
  const [localDrafts, setLocalDrafts] = useState<any[]>([]);
  useEffect(() => {
    const draft = localStorage.getItem("employee_wizard_draft");
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        if (parsed?.form?.name) {
          setLocalDrafts([parsed]);
        }
      } catch {
        setLocalDrafts([]);
      }
    }
  }, []);

  // Separate by status
  const activeMembers = useMemo(
    () => team.filter(m => m.status !== "Terminated"),
    [team]
  );
  const oldMembers = useMemo(
    () => team.filter(m => m.status === "Terminated"),
    [team]
  );
  const pendingCount = useMemo(
    () => team.filter(m => m.status === "Pending Documents").length,
    [team]
  );

  // Filter by search
  const filterBySearch = (members: TeamMember[]) =>
    members.filter(m =>
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase()) ||
      (m.department || "").toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase())
    );

  const handleArchive = async (id: string, name: string) => {
    try {
      await updateTeamMember(id, { status: "Terminated" });
      toast({ title: "Employee Archived", description: `${name} has been moved to Old Employees.` });
    } catch {
      toast({ title: "Error", description: "Failed to archive employee.", variant: "destructive" });
    }
  };

  const handleReactivate = async (id: string, name: string) => {
    try {
      await updateTeamMember(id, { status: "Active" });
      toast({ title: "Employee Reactivated", description: `${name} is now active.` });
    } catch {
      toast({ title: "Error", description: "Failed to reactivate employee.", variant: "destructive" });
    }
  };

  const handleDiscardDraft = () => {
    localStorage.removeItem("employee_wizard_draft");
    setLocalDrafts([]);
    toast({ title: "Draft discarded" });
  };

  const statusColor = (s: string) => {
    switch (s) {
      case "Active": return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100";
      case "Pending Documents": return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100";
      case "Draft": return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 hover:bg-blue-100";
      case "On Leave": return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 hover:bg-purple-100";
      case "Terminated": return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const avatarColors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-cyan-500"
  ];

  const renderMemberCard = (m: TeamMember, i: number, isOld = false) => (
    <Card
      key={m.id}
      className={`shadow-card border-border hover:shadow-elevated transition-all duration-200 group cursor-pointer ${isOld ? "opacity-80 grayscale-[30%]" : ""}`}
      onClick={() => navigate(`/dashboard/team/view/${m.id}`)}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <Avatar className="h-12 w-12 shrink-0 border-2 border-border/50">
              <AvatarImage src={m.photoUrl || m.avatar} className="object-cover" />
              <AvatarFallback className={`${avatarColors[i % avatarColors.length]} text-white font-bold text-sm`}>
                {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-foreground leading-tight truncate">{m.name}</h3>
              <p className="text-sm text-muted-foreground truncate">{m.role}</p>
              {m.department && (
                <p className="text-xs text-muted-foreground/70 mt-0.5 flex items-center gap-1">
                  <Building2 className="h-2.5 w-2.5" />{m.department}
                </p>
              )}
            </div>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
              <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/team/view/${m.id}`); }}>
                <Eye className="h-4 w-4" /> View Profile
              </DropdownMenuItem>
              {!isOld && (
                <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/team/edit/${m.id}`); }}>
                  <Edit className="h-4 w-4" /> Edit
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
              {isOld ? (
                <DropdownMenuItem
                  className="gap-2 cursor-pointer text-emerald-600 focus:text-emerald-600"
                  onClick={(e) => { e.stopPropagation(); handleReactivate(m.id, m.name); }}
                >
                  <UserCheck className="h-4 w-4" /> Reactivate
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                  onClick={(e) => { e.stopPropagation(); handleArchive(m.id, m.name); }}
                >
                  <Archive className="h-4 w-4" /> Archive Employee
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="space-y-2.5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Mail className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{m.email}</span>
          </div>
          {m.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span>{m.phone}</span>
            </div>
          )}
          <div className="flex items-center justify-between pt-1">
            <Badge className={`${statusColor(m.status)} text-[10px] font-bold`}>{m.status}</Badge>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span>{m.projects} projects</span>
              {m.hourlyRate && <span className="font-semibold text-foreground">{m.hourlyRate}/hr</span>}
              {isOld && m.archivedAt && (
                <span className="text-muted-foreground/70 flex items-center gap-1">
                  <Clock className="h-2.5 w-2.5" /> {m.archivedAt}
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">
            Employees
            {pendingCount > 0 && (
              <span className="ml-2 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold bg-amber-500 text-white rounded-full animate-pulse">
                {pendingCount}
              </span>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage team members, onboarding, and employment records
            {pendingCount > 0 && (
              <span className="ml-2 text-amber-600 font-semibold text-xs inline-flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" /> {pendingCount} pending document{pendingCount > 1 ? "s" : ""}
              </span>
            )}
          </p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/team/add")}>
          <Plus className="h-4 w-4" /> Add Employee
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Employees", value: team.filter(m => m.status !== "Terminated").length, icon: Users, color: "text-foreground" },
          { label: "Active", value: team.filter(m => m.status === "Active").length, icon: UserCheck, color: "text-emerald-600 dark:text-emerald-400" },
          { label: "Pending Docs", value: pendingCount, icon: AlertTriangle, color: "text-amber-600 dark:text-amber-400" },
          { label: "Departments", value: [...new Set(team.filter(m => m.status !== "Terminated").map(m => m.department).filter(Boolean))].length, icon: Building2, color: "text-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border">
            <CardContent className="p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-muted/60 flex items-center justify-center shrink-0 border border-border/40">
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
                <p className={`text-2xl font-bold mt-0.5 ${stat.color}`}>{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search employees..."
          className="pl-9 w-full bg-muted border-0"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Tab Navigation */}
      <div className="flex border-b border-border gap-6 overflow-x-auto scrollbar-none">
        {[
          { key: "active" as Tab, label: "Active Employees", icon: UserCheck, count: activeMembers.length },
          { key: "old" as Tab, label: "Old Employees", icon: Archive, count: oldMembers.length },
          { key: "drafts" as Tab, label: "Drafts", icon: FileText, count: localDrafts.length },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 pb-3.5 text-sm font-semibold transition-all relative border-b-2 -mb-[2px] shrink-0 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-secondary text-foreground font-bold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
            {tab.count > 0 && (
              <span className={`ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold rounded-full ${
                activeTab === tab.key ? "bg-secondary text-secondary-foreground" : "bg-muted text-muted-foreground"
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ACTIVE EMPLOYEES TAB */}
      {activeTab === "active" && (
        <>
          {filterBySearch(activeMembers).length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Users className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">No active employees found</p>
              <p className="text-sm">
                <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/team/add")}>
                  Add your first employee
                </button>
              </p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filterBySearch(activeMembers).map((m, i) => renderMemberCard(m, i))}
            </div>
          )}
        </>
      )}

      {/* OLD EMPLOYEES (TERMINATED) TAB */}
      {activeTab === "old" && (
        <>
          {oldMembers.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <Archive className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">No archived employees</p>
              <p className="text-sm text-muted-foreground/70">Terminated employees will appear here</p>
            </div>
          ) : (
            <>
              <div className="p-3 rounded-xl border border-border/60 bg-muted/20 text-xs text-muted-foreground font-semibold flex items-center gap-2">
                <Archive className="h-3.5 w-3.5" />
                Showing {filterBySearch(oldMembers).length} archived employee{filterBySearch(oldMembers).length !== 1 ? "s" : ""}. Terminated records are kept for audit purposes and can be reactivated.
              </div>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filterBySearch(oldMembers).map((m, i) => renderMemberCard(m, i, true))}
              </div>
            </>
          )}
        </>
      )}

      {/* DRAFTS TAB */}
      {activeTab === "drafts" && (
        <>
          {/* Database drafts (status === 'Draft') */}
          {team.filter(m => m.status === "Draft").length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Saved to Database</h3>
              <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
                {team.filter(m => m.status === "Draft").map((m, i) => renderMemberCard(m, i))}
              </div>
            </div>
          )}

          {/* Local storage drafts */}
          {localDrafts.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-wider">Unsaved Browser Drafts</h3>
              {localDrafts.map((draft, i) => (
                <Card key={i} className="shadow-card border-border border-dashed">
                  <CardContent className="p-5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-muted-foreground shrink-0">
                        {draft.form?.name?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) || "??"}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-semibold text-foreground truncate">{draft.form?.name || "Unnamed Draft"}</h4>
                        <p className="text-xs text-muted-foreground truncate">
                          {draft.form?.email || "No email"} · Step {draft.step || 1} of 5
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="hero"
                        size="sm"
                        onClick={() => navigate("/dashboard/team/add")}
                        className="h-8 text-xs gap-1.5"
                      >
                        <Edit className="h-3.5 w-3.5" /> Resume
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDiscardDraft}
                        className="h-8 text-xs text-destructive border-destructive/30 hover:bg-destructive/10"
                      >
                        Discard
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {team.filter(m => m.status === "Draft").length === 0 && localDrafts.length === 0 && (
            <div className="text-center py-16 text-muted-foreground space-y-3">
              <FileText className="h-12 w-12 mx-auto opacity-30" />
              <p className="text-lg font-medium">No drafts found</p>
              <p className="text-sm text-muted-foreground/70">Incomplete wizard sessions auto-save here</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

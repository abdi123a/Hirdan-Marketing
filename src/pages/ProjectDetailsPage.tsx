import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { 
  ArrowLeft, Calendar, Clock, CheckCircle2, AlertCircle, 
  Settings, User, Briefcase, Tag, Target, Users,
  BarChart3, Layout, ChevronRight
} from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";

export default function ProjectDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { projects, clients, team } = useAgencyStore();

  const project = useMemo(() => projects.find((p) => p.id === id), [projects, id]);
  const client = useMemo(() => clients.find((c) => c.company === project?.client || c.name === project?.client), [clients, project]);
  
  const projectTeam = useMemo(() => {
    if (!project?.team) return [];
    return team.filter(m => project.team.includes(m.id) || project.team.includes(m.name));
  }, [team, project]);

  if (!project) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Project not found</h2>
        <Button onClick={() => navigate("/dashboard/projects")}>Back to Projects</Button>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === "Completed" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === "In Progress" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" :
        s === "On Hold" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
          "bg-muted text-muted-foreground";

  const priorityColor = (p: string) =>
    p === "Urgent" ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" :
      p === "High" ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
        p === "Medium" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
          "bg-muted text-muted-foreground";

  return (
    <div className="space-y-6 max-w-[1400px] animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full h-10 w-10 hover:bg-primary/5">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{project.name}</h1>
              <Badge className={`${statusColor(project.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`} variant="outline">{project.status}</Badge>
            </div>
            <p className="text-muted-foreground font-medium flex items-center gap-2 mt-1">
              <Briefcase className="w-3.5 h-3.5" /> {project.client}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/projects/edit/${project.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Edit Project
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Project Overview */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-primary/40 via-primary/10 to-transparent" />
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" /> Project Overview
              </CardTitle>
              <CardDescription>Detailed information about the scope and objectives</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="prose prose-sm max-w-none text-muted-foreground">
                <p className="text-sm leading-relaxed">
                  {project.description || "No description provided for this project."}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-8 pt-4 border-t border-border/40">
                <div className="space-y-4">
                  {[
                    { icon: Calendar, label: "Start Date", value: project.startDate || "Not set" },
                    { icon: Clock, label: "Due Date", value: project.dueDate },
                    { icon: AlertCircle, label: "Priority Level", value: project.priority, badge: true },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border border-border/40">
                        <item.icon className="h-4 w-4 text-muted-foreground/80" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                        {item.badge ? (
                          <Badge className={`${priorityColor(item.value)} border-0 px-2 py-0 h-4 uppercase text-[9px] font-bold mt-0.5 mt-0.5`}>{item.value}</Badge>
                        ) : (
                          <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  {[
                    { icon: BarChart3, label: "Project Budget", value: formatCurrency(project.budget || 0) },
                    { icon: CheckCircle2, label: "Milestones", value: "3 of 5 completed" }, // Mocked
                    { icon: Tag, label: "Category", value: project.tags?.join(", ") || "General" },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center shrink-0 border border-border/40">
                        <item.icon className="h-4 w-4 text-muted-foreground/80" />
                      </div>
                      <div>
                        <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{item.label}</p>
                        <p className="text-sm font-semibold text-foreground mt-0.5">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Progress & Milestones */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Layout className="w-4 h-4 text-blue-500" /> Completion Progress
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-foreground">Overall Progress</span>
                  <span className="font-bold text-primary">{project.progress}%</span>
                </div>
                <Progress value={project.progress} className="h-2.5 shadow-sm" />
              </div>
              
              <div className="space-y-3 pt-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-4">Current Milestones</h4>
                {[
                  { name: "Initial Research & Audit", status: "Completed", date: "Jan 20" },
                  { name: "Strategy & Planning", status: "Completed", date: "Feb 05" },
                  { name: "Execution Phase 1", status: "In Progress", date: "Mar 15" },
                  { name: "Final Review & Handover", status: "Pending", date: "May 10" },
                ].map((m, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-muted/30 border border-border/40 group hover:border-primary/20 transition-all">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${m.status === 'Completed' ? 'bg-emerald-500' : m.status === 'In Progress' ? 'bg-blue-500' : 'bg-muted-foreground/30'}`} />
                      <span className={`text-sm font-medium ${m.status === 'Completed' ? 'text-muted-foreground line-through' : 'text-foreground'}`}>{m.name}</span>
                    </div>
                    <span className="text-[10px] font-bold text-muted-foreground group-hover:text-primary transition-colors">{m.date}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Client Information */}
          {client && (
            <Card className="border-border/50 shadow-sm overflow-hidden border-t-2 border-t-primary/20">
              <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <User className="w-4 h-4 text-primary" /> Client Details
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-5">
                <div className="flex items-center gap-3 mb-4">
                  <Avatar className="h-10 w-10 ring-2 ring-primary/5">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{client.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="text-sm font-bold text-foreground">{client.company || client.name}</h4>
                    <p className="text-[11px] text-muted-foreground font-medium">{client.industry}</p>
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

          {/* Team Members */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Users className="w-4 h-4 text-emerald-500" /> Assigned Team
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              <div className="space-y-4">
                {projectTeam.length > 0 ? (
                  projectTeam.map((member) => (
                    <div key={member.id} className="flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <Avatar className="h-8 w-8 ring-2 ring-background group-hover:ring-primary/10 transition-all">
                          <AvatarFallback className="text-[10px] bg-muted font-bold">{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
                        </Avatar>
                        <div>
                          <p className="text-xs font-bold text-foreground group-hover:text-primary transition-colors">{member.name}</p>
                          <p className="text-[10px] text-muted-foreground">{member.role}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[8px] font-bold uppercase bg-muted/30 border-0 h-4">Active</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-muted-foreground">
                    <p className="text-[10px] font-bold uppercase tracking-widest">No team assigned</p>
                  </div>
                )}
                <Button variant="ghost" className="w-full mt-2 text-[10px] font-bold uppercase tracking-widest text-primary h-8 hover:bg-primary/5">
                  Manage Team
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Project Tags */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Project Tags</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {project.tags?.map((tag) => (
                  <Badge key={tag} className="bg-primary/5 text-primary border-primary/10 hover:bg-primary/10 text-[10px] font-semibold transition-colors">
                    {tag}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

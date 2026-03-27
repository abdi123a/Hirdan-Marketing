import { useParams, useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  ArrowLeft, Mail, Phone, Calendar, Briefcase, 
  Settings, User, Clock, Star, TrendingUp, 
  MapPin, Link2, Download, Building2, ChevronRight
} from "lucide-react";
import { useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export default function TeamMemberDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { team, projects } = useAgencyStore();

  const member = useMemo(() => team.find((m) => m.id === id), [team, id]);
  
  const memberProjects = useMemo(() => 
    projects.filter((p) => p.team.includes(member?.id || '') || p.team.includes(member?.name || '')), 
    [projects, member]
  );

  if (!member) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display">Team member not found</h2>
        <Button onClick={() => navigate("/dashboard/team")}>Back to Team</Button>
      </div>
    );
  }

  const statusColor = (s: string) =>
    s === "Active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === "Offline" ? "bg-muted text-muted-foreground" :
        "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";

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
              <AvatarImage src={member.avatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-xl font-bold">{member.name.split(' ').map(n => n[0]).join('')}</AvatarFallback>
            </Avatar>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl md:text-3xl font-display font-bold tracking-tight text-foreground">{member.name}</h1>
                <Badge className={`${statusColor(member.status)} border-0 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider`} variant="outline">{member.status}</Badge>
              </div>
              <p className="text-muted-foreground font-medium flex items-center gap-2 mt-0.5">
                <Badge variant="outline" className="text-[10px] bg-muted/30 border-0 h-4 uppercase font-bold">{member.role}</Badge> · <span className="opacity-70">{member.department}</span>
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/team/edit/${member.id}`)} className="h-9 gap-2 text-xs font-semibold">
            <Settings className="h-3.5 w-3.5" /> Edit Member
          </Button>
          <Button variant="hero" size="sm" className="h-9 gap-2 text-xs font-semibold shadow-premium">
            <Download className="h-3.5 w-3.5" /> Resume
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Member Profile */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <div className="h-1.5 w-full bg-gradient-to-r from-emerald-400/40 via-emerald-400/10 to-transparent" />
            <CardHeader>
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <User className="h-4 w-4 text-emerald-500" /> Professional Overview
              </CardTitle>
              <CardDescription>Experience and background details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6 pt-2">
              <div className="prose prose-sm max-w-none text-muted-foreground italic bg-muted/10 p-4 rounded-xl border-l-4 border-emerald-500/40">
                <p className="text-sm leading-relaxed">
                  {member.bio || "No professional bio has been added for this team member."}
                </p>
              </div>

              <div className="grid sm:grid-cols-2 gap-8 pt-4">
                <div className="space-y-5">
                  {[
                    { icon: Mail, label: "Email Address", value: member.email },
                    { icon: Phone, label: "Phone Number", value: member.phone || "Not provided" },
                    { icon: Clock, label: "Hourly Rate", value: member.hourlyRate || "Private" },
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
                    { icon: Building2, label: "Department", value: member.department || "General" },
                    { icon: Calendar, label: "Joined Date", value: member.startDate || "Jan 01, 2024" },
                    { icon: MapPin, label: "Location", value: "Remote / Office" },
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
              </div>
            </CardContent>
          </Card>

          {/* Assigned Projects */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/10 pb-3 border-b border-border/40">
              <CardTitle className="text-lg font-display flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-blue-500" /> Current Assignments
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow>
                    <TableHead className="font-bold text-xs">Project Name</TableHead>
                    <TableHead className="font-bold text-xs">Status</TableHead>
                    <TableHead className="font-bold text-xs">Progress</TableHead>
                    <TableHead className="text-right font-bold text-xs uppercase">Role</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {memberProjects.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12 text-muted-foreground text-[11px] uppercase tracking-widest font-bold">No active assignments</TableCell>
                    </TableRow>
                  ) : (
                    memberProjects.map((proj) => (
                      <TableRow key={proj.id} className="cursor-pointer hover:bg-muted/50 transition-colors group" onClick={() => navigate(`/dashboard/projects/view/${proj.id}`)}>
                        <TableCell className="font-bold text-sm text-foreground/90 group-hover:text-primary transition-colors">{proj.name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[9px] font-bold uppercase tracking-tighter bg-muted/50 border-0">{proj.status}</Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="w-16 h-1 bg-muted rounded-full overflow-hidden">
                              <div className="h-full bg-emerald-500" style={{ width: `${proj.progress}%` }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground font-bold">{proj.progress}%</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-[10px] font-bold text-muted-foreground uppercase">{member.role}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Key Metrics */}
          <Card className="border-border/50 shadow-premium overflow-hidden border-t-2 border-t-emerald-400/20">
            <CardHeader className="pb-3 border-b border-border/40 bg-muted/10">
              <CardTitle className="text-sm font-display flex items-center gap-2 text-muted-foreground uppercase tracking-widest">
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500" /> Performance Stats
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Active Projects</p>
                  <p className="text-xl font-bold text-foreground font-display">{memberProjects.length}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Rating</p>
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    <p className="text-xl font-bold text-foreground font-display">4.9</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Utilization</p>
                  <p className="text-xl font-bold text-foreground font-display">92%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Avg. Response</p>
                  <p className="text-xl font-bold text-foreground font-display">1.5h</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Social & Contact Links */}
          <Card className="border-border/50 shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">Contact & Social</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { icon: Link2, label: "LinkedIn Profile", link: "linkedin.com/in/team-member" },
                { icon: Star, label: "GitHub Profile", link: "github.com/team-member" },
                { icon: Phone, label: "Slack Handle", link: "@teammember" },
              ].map((link, i) => (
                <div key={i} className="flex items-center justify-between text-xs group cursor-pointer hover:bg-muted/30 p-2 rounded-lg transition-colors">
                  <div className="flex items-center gap-2.5">
                    <link.icon className="w-3.5 h-3.5 text-muted-foreground" />
                    <span className="font-medium text-foreground">{link.label}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

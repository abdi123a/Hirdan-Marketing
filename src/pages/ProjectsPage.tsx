import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MoreHorizontal } from "lucide-react";
import { Progress } from "@/components/ui/progress";

const projects = [
  { id: 1, name: "SEO Overhaul — TechStart", client: "TechStart Inc.", status: "In Progress", progress: 65, deadline: "Mar 30", priority: "High" },
  { id: 2, name: "Social Media Campaign Q1", client: "MediaCo Agency", status: "In Progress", progress: 40, deadline: "Apr 15", priority: "Medium" },
  { id: 3, name: "PPC Management", client: "GreenLeaf Studios", status: "Completed", progress: 100, deadline: "Mar 10", priority: "High" },
  { id: 4, name: "Brand Redesign", client: "BlueSky Holdings", status: "On Hold", progress: 20, deadline: "May 1", priority: "Low" },
  { id: 5, name: "Content Strategy 2026", client: "Nova Digital", status: "In Progress", progress: 55, deadline: "Apr 20", priority: "High" },
  { id: 6, name: "Email Marketing Setup", client: "TechStart Inc.", status: "Planning", progress: 10, deadline: "Apr 30", priority: "Medium" },
];

const statusColor = (s: string) =>
  s === "Completed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
  s === "In Progress" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
  s === "On Hold" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
  "bg-muted text-muted-foreground hover:bg-muted";

const priorityColor = (p: string) =>
  p === "High" ? "bg-red-100 text-red-700 hover:bg-red-100" :
  p === "Medium" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
  "bg-muted text-muted-foreground hover:bg-muted";

export default function ProjectsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Projects</h1>
          <p className="text-muted-foreground mt-1">Track all campaigns and deliverables</p>
        </div>
        <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> New Project</Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {projects.map((p) => (
          <Card key={p.id} className="shadow-card border-border hover:shadow-elevated transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="font-display text-base leading-tight">{p.name}</CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">{p.client}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 -mt-1"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge className={statusColor(p.status)}>{p.status}</Badge>
                <Badge className={priorityColor(p.priority)}>{p.priority}</Badge>
              </div>
              <div>
                <div className="flex items-center justify-between text-sm mb-1.5">
                  <span className="text-muted-foreground">Progress</span>
                  <span className="font-medium text-foreground">{p.progress}%</span>
                </div>
                <Progress value={p.progress} className="h-2" />
              </div>
              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Calendar className="h-3.5 w-3.5" />
                <span>Due {p.deadline}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

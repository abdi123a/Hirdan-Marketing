import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, MoreHorizontal, Edit, Trash2, Search, Eye } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useAgencyStore } from "@/lib/store";
import { useState, useEffect } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Input } from "@/components/ui/input";
import { formatCurrency } from "@/lib/utils";
import { X } from "lucide-react";

const statusColor = (s: string) =>
  s === "Completed" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
    s === "In Progress" ? "bg-blue-100 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400" :
      s === "On Hold" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" :
        "bg-muted text-muted-foreground hover:bg-muted";

const priorityColor = (p: string) =>
  p === "Urgent" ? "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400" :
    p === "High" ? "bg-orange-100 text-orange-700 hover:bg-orange-100" :
      p === "Medium" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
        "bg-muted text-muted-foreground hover:bg-muted";

export default function ProjectsPage() {
  const { projects, deleteProject, fetchProjects } = useAgencyStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const clientFilter = searchParams.get("client");
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const filtered = projects.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.client.toLowerCase().includes(search.toLowerCase());
    const matchesClient = clientFilter ? p.client === clientFilter : true;
    return matchesSearch && matchesClient;
  });

  const handleDelete = async (id: string, name: string) => {
    await deleteProject(id);
    toast({ title: "Project Deleted", description: `"${name}" has been removed.` });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Projects</h1>
          <p className="text-muted-foreground mt-1">Track all campaigns and deliverables</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/projects/add")}>
          <Plus className="h-4 w-4" /> New Project
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Projects", value: projects.length, color: "text-foreground" },
          { label: "In Progress", value: projects.filter(p => p.status === "In Progress").length, color: "text-blue-600" },
          { label: "Completed", value: projects.filter(p => p.status === "Completed").length, color: "text-emerald-600" },
          { label: "On Hold", value: projects.filter(p => p.status === "On Hold").length, color: "text-amber-600" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search & Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search projects..." className="pl-9 bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {clientFilter && (
          <Badge variant="secondary" className="h-9 px-3 gap-2 bg-primary/10 text-primary border-primary/20">
            Client: {clientFilter}
            <X className="h-3 w-3 cursor-pointer hover:text-foreground" onClick={() => {
              searchParams.delete("client");
              setSearchParams(searchParams);
            }} />
          </Badge>
        )}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No projects found</p>
          <p className="text-sm mt-1">
            <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/projects/add")}>Create your first project</button>
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <Card key={p.id} className="shadow-card border-border hover:shadow-elevated transition-all duration-200 group cursor-pointer" onClick={() => navigate(`/dashboard/projects/view/${p.id}`)}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-base font-semibold leading-tight">{p.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.client}</p>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="shrink-0 -mt-1 h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/projects/view/${p.id}`); }}>
                        <Eye className="h-4 w-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/projects/edit/${p.id}`); }}>
                        <Edit className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                      >
                        <Trash2 className="h-4 w-4" /> Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {p.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>
                )}
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={statusColor(p.status)}>{p.status}</Badge>
                  <Badge className={priorityColor(p.priority)}>{p.priority}</Badge>
                </div>
                <div>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="text-muted-foreground">Progress</span>
                    <span className="font-semibold text-foreground">{p.progress}%</span>
                  </div>
                  <Progress value={p.progress} className="h-1.5" />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Due {p.dueDate}</span>
                  {p.budget && <span className="font-medium text-foreground">{formatCurrency(p.budget)}</span>}
                </div>
                {p.tags && p.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {p.tags.map((tag) => (
                      <span key={tag} className="px-1.5 py-0.5 bg-primary/8 text-primary text-xs rounded-md font-medium">{tag}</span>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Phone, MoreHorizontal, Edit, Trash2, Search, Eye } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import { useNavigate } from "react-router-dom";
import { Input } from "@/components/ui/input";

export default function TeamPage() {
  const { team, deleteTeamMember, fetchTeam } = useAgencyStore();

  useEffect(() => {
    fetchTeam();
  }, [fetchTeam]);
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  const filtered = team.filter((m) =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.role.toLowerCase().includes(search.toLowerCase()) ||
    (m.department || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    try {
      await deleteTeamMember(id);
      toast({ title: "Member Removed", description: `${name} has been removed from the team.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to remove member.", variant: "destructive" });
    }
  };

  const statusColor = (s: string) =>
    s === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
    s === "Away" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
    "bg-muted text-muted-foreground";

  const avatarColors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-cyan-500"
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Team</h1>
          <p className="text-muted-foreground mt-1">Manage your team members and roles</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/team/add")}>
          <Plus className="h-4 w-4" /> Add Member
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Members", value: team.length, color: "text-foreground" },
          { label: "Active", value: team.filter(m => m.status === "Active").length, color: "text-emerald-600" },
          { label: "Away", value: team.filter(m => m.status === "Away").length, color: "text-amber-600" },
          { label: "Departments", value: [...new Set(team.map(m => m.department).filter(Boolean))].length, color: "text-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search team members..." className="pl-9 w-full bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <p className="text-lg font-medium">No team members found</p>
          <p className="text-sm mt-1">
            <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/team/add")}>Add your first team member</button>
          </p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((m, i) => (
            <Card key={m.id} className="shadow-card border-border hover:shadow-elevated transition-all duration-200 group cursor-pointer" onClick={() => navigate(`/dashboard/team/view/${m.id}`)}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className={`h-12 w-12 ${avatarColors[i % avatarColors.length]}`}>
                      <AvatarFallback className={`${avatarColors[i % avatarColors.length]} text-white font-bold text-sm`}>
                        {m.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-foreground leading-tight">{m.name}</h3>
                      <p className="text-sm text-muted-foreground">{m.role}</p>
                      {m.department && (
                        <p className="text-xs text-muted-foreground/70 mt-0.5">{m.department}</p>
                      )}
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuLabel>Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/team/view/${m.id}`); }}>
                        <Eye className="h-4 w-4" /> View
                      </DropdownMenuItem>
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/team/edit/${m.id}`); }}>
                        <Edit className="h-4 w-4" /> Edit
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        onClick={(e) => { e.stopPropagation(); handleDelete(m.id, m.name); }}
                      >
                        <Trash2 className="h-4 w-4" /> Remove
                      </DropdownMenuItem>
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
                    <Badge className={statusColor(m.status)}>{m.status}</Badge>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{m.projects} projects</span>
                      {m.hourlyRate && <span className="font-semibold text-foreground">{m.hourlyRate}/hr</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, Shield, User as UserIcon, MoreHorizontal, Edit, Trash2, Search, Link as LinkIcon } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useAgencyStore, User } from "@/lib/store";
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

export default function UsersPage() {
  const { users, deleteUser, fetchUsers } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const filtered = users.filter((u) =>
    (u.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.email || "").toLowerCase().includes(search.toLowerCase()) ||
    (u.role || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Are you sure you want to delete user ${name}?`)) return;
    try {
      await deleteUser(id);
      toast({ title: "User Deleted", description: `${name} has been removed.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete user.", variant: "destructive" });
    }
  };

  const roleColor = (role: string) => {
    switch (role) {
      case 'ADMIN': return "bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200";
      case 'MANAGER': return "bg-indigo-100 text-indigo-700 hover:bg-indigo-100 border-indigo-200";
      case 'STAFF': return "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200";
      case 'CLIENT': return "bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200";
      default: return "bg-muted text-muted-foreground";
    }
  };

  const avatarColors = [
    "bg-violet-500", "bg-blue-500", "bg-emerald-500", "bg-orange-500", "bg-rose-500", "bg-cyan-500"
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Users</h1>
          <p className="text-muted-foreground mt-1">Manage system access and roles</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/users/add")}>
          <Plus className="h-4 w-4" /> Add User
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Users", value: users.length, color: "text-foreground" },
          { label: "Admins", value: users.filter(u => u.role === "ADMIN").length, color: "text-rose-600" },
          { label: "Managers", value: users.filter(u => u.role === "MANAGER").length, color: "text-indigo-600" },
          { label: "Staff", value: users.filter(u => u.role === "STAFF").length, color: "text-emerald-600" },
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
        <Input placeholder="Search users..." className="pl-9 w-full bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground bg-white rounded-2xl border border-dashed border-border">
          <UserIcon className="h-12 w-12 mx-auto opacity-20 mb-4" />
          <p className="text-lg font-medium">No users found</p>
          <Button variant="link" onClick={() => navigate("/dashboard/users/add")}>Add your first user</Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((u, i) => (
            <Card key={u.id} className="shadow-card border-border hover:shadow-elevated transition-all duration-200 group">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar className={`h-12 w-12 ${avatarColors[i % avatarColors.length]}`}>
                      <AvatarFallback className="text-white font-bold">
                        {u.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-bold text-foreground leading-tight">{u.name}</h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Badge variant="outline" className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0 ${roleColor(u.role)}`}>
                          {u.role}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-muted">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuLabel>User Actions</DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => navigate(`/dashboard/users/edit/${u.id}`)}>
                        <Edit className="h-4 w-4" /> Edit User
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                        onClick={() => handleDelete(u.id, u.name)}
                      >
                        <Trash2 className="h-4 w-4" /> Delete User
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4 shrink-0 text-primary/50" />
                    <span className="truncate font-medium">{u.email}</span>
                  </div>

                  <div className="pt-3 border-t border-border">
                    {u.teamMember ? (
                      <div className="flex items-center gap-2 text-xs">
                        <Shield className="h-3.5 w-3.5 text-emerald-500" />
                        <span className="text-muted-foreground">Linked to Staff:</span>
                        <span className="font-bold text-foreground">{u.teamMember.name}</span>
                      </div>
                    ) : u.client ? (
                      <div className="flex items-center gap-2 text-xs">
                        <LinkIcon className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-muted-foreground">Linked to Client:</span>
                        <span className="font-bold text-foreground">{u.client.company}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-xs opacity-50 italic">
                        <UserIcon className="h-3.5 w-3.5" />
                        <span>Not linked to profile</span>
                      </div>
                    )}
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

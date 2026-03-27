import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Mail, Phone, Edit, Trash2, Globe, Building2, Eye } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { useAgencyStore } from "@/lib/store";
import { formatCurrency } from "@/lib/utils";
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

export default function ClientsPage() {
  const { clients, deleteClient, fetchClients } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const filtered = clients.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.company || "").toLowerCase().includes(search.toLowerCase()) ||
    c.email.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, name: string) => {
    await deleteClient(id);
    toast({ title: "Client Deleted", description: `${name} has been removed.` });
  };

  const statusColor = (s: string) =>
    s === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
      s === "Paused" ? "bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-900/30 dark:text-amber-400" :
        "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client relationships</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/clients/add")}>
          <Plus className="h-4 w-4" /> Add Client
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Clients", value: clients.length, color: "text-foreground" },
          { label: "Active", value: clients.filter(c => c.status === "Active").length, color: "text-emerald-600" },
          { label: "Paused", value: clients.filter(c => c.status === "Paused").length, color: "text-amber-600" },
          { label: "Churned", value: clients.filter(c => c.status === "Churned").length, color: "text-red-600" },
        ].map((stat) => (
          <Card key={stat.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">All Clients ({filtered.length})</CardTitle>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search clients..." className="pl-9 w-56 bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead className="hidden md:table-cell">Contact</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Projects</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-muted-foreground">
                    No clients found. <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/clients/add")}>Add your first client</button>
                  </TableCell>
                </TableRow>
              ) : filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => navigate(`/dashboard/clients/view/${c.id}`)}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-bold">{c.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-semibold text-foreground leading-tight">{c.company || c.name}</p>
                        <p className="text-xs text-muted-foreground">{c.name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1.5"><Mail className="h-3 w-3" />{c.email}</span>
                      {c.phone && <span className="flex items-center gap-1.5"><Phone className="h-3 w-3" />{c.phone}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {c.city && c.country ? `${c.city}, ${c.country}` : c.city || c.country || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(c.status)}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground font-medium">{c.projects}</TableCell>
                  <TableCell className="font-semibold text-foreground">{formatCurrency(c.revenue)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-44">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigate(`/dashboard/clients/view/${c.id}`)}>
                          <Eye className="h-4 w-4" /> View Client
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigate(`/dashboard/clients/edit/${c.id}`)}>
                          <Edit className="h-4 w-4" /> Edit Client
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={(e) => { 
                          if (c.website) {
                            window.open(c.website.startsWith('http') ? c.website : `https://${c.website}`, '_blank');
                          } else {
                            toast({ title: "Portal Access", description: `Portal link: portal.agencyflow.com/${c.id}` });
                          }
                        }}>
                          <Globe className="h-4 w-4" /> View Portal
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onSelect={() => navigate(`/dashboard/projects?client=${encodeURIComponent(c.company || c.name)}`)}>
                          <Building2 className="h-4 w-4" /> View Projects
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onSelect={() => handleDelete(c.id, c.name)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

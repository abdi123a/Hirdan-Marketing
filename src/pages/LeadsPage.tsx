import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, Mail, Trash2, Calendar, Download, MoreVertical, CheckCircle2, Clock, XCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState, useEffect } from "react";
import { useAgencyStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function LeadsPage() {
  const { leads, fetchLeads, deleteLead, updateLeadStatus } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchLeads();
  }, [fetchLeads]);

  const filtered = (leads || []).filter((l) =>
    (l.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string, email: string) => {
    try {
      await deleteLead(id);
      toast({ title: "Lead Removed", description: `${email} has been removed from the list.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete lead.", variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await updateLeadStatus(id, status);
      toast({ title: "Status Updated", description: `Lead status changed to ${status}.` });
    } catch (error) {
      toast({ title: "Error", description: "Failed to update status.", variant: "destructive" });
    }
  };

  const handleExport = () => {
    if (!leads || leads.length === 0) {
      toast({ title: "No Data", description: "There are no emails to export." });
      return;
    }

    const headers = ["Email", "Status", "Date Added"];
    const rows = leads.map(l => [
      `"${l.email}"`,
      `"${l.status || 'PENDING'}"`,
      `"${new Date(l.createdAt).toLocaleString()}"`
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(r => r.join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `hirdan-leads-${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast({ title: "Export Started", description: "Your email list is being downloaded." });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "CONTACTED":
        return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400">Contacted</Badge>;
      case "QUALIFIED":
        return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400">Qualified</Badge>;
      case "ARCHIVED":
        return <Badge className="bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200 dark:bg-gray-800/30 dark:text-gray-400">Archived</Badge>;
      default:
        return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400">Pending</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Email List</h1>
          <p className="text-muted-foreground mt-1">People interested in your agency from the Coming Soon page</p>
        </div>
        <Button variant="outline" className="gap-2 shadow-sm" onClick={handleExport}>
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="shadow-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Total Leads</p>
            <p className="text-2xl font-bold mt-1 text-foreground">{leads?.length || 0}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Pending</p>
            <p className="text-2xl font-bold mt-1 text-amber-600">
              {leads?.filter(l => l.status === "PENDING" || !l.status).length || 0}
            </p>
          </CardContent>
        </Card>
        <Card className="shadow-card border-border">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Interested Today</p>
            <p className="text-2xl font-bold mt-1 text-emerald-600">
              {leads?.filter(l => {
                const date = new Date(l.createdAt);
                const today = new Date();
                return date.toDateString() === today.toDateString();
              }).length || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3 border-b border-border/50">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold">Interested Users ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-64 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search emails..." 
                className="pl-9 w-full bg-muted border-0 h-9" 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/30">
              <TableRow>
                <TableHead className="pl-6">Email Address</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Date Added</TableHead>
                <TableHead className="w-[100px] text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground">
                    <div className="flex flex-col items-center gap-2">
                      <Mail className="h-10 w-10 opacity-20" />
                      <p>No leads found yet.</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.map((l) => (
                <TableRow key={l.id} className="hover:bg-muted/30 transition-colors group">
                  <TableCell className="pl-6 font-medium">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-lg bg-primary/5 text-primary flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-all">
                        <Mail className="h-4 w-4" />
                      </div>
                      <span className="text-foreground">{l.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="outline-none">
                          {getStatusBadge(l.status || "PENDING")}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        <DropdownMenuLabel>Change Status</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(l.id, "PENDING")}>
                          <Clock className="h-4 w-4 text-amber-500" /> Pending
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(l.id, "CONTACTED")}>
                          <Mail className="h-4 w-4 text-blue-500" /> Contacted
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(l.id, "QUALIFIED")}>
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" /> Qualified
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={() => handleStatusChange(l.id, "ARCHIVED")}>
                          <XCircle className="h-4 w-4 text-muted-foreground" /> Archived
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3 w-3" />
                      {formatDate(l.createdAt)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right pr-6">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onClick={() => handleDelete(l.id, l.email)}
                        >
                          <Trash2 className="h-4 w-4" /> Delete Lead
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

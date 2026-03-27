import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, Zap, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";

const statusColor = (s: string) =>
  s === "Available" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400" :
    "bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-900/30 dark:text-red-400";

export default function ServicesPage() {
  const { services, deleteService, fetchServices } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchServices();
  }, [fetchServices]);

  const filtered = services.filter((svc) =>
    svc.name.toLowerCase().includes(search.toLowerCase()) ||
    svc.category.toLowerCase().includes(search.toLowerCase())
  );

  const handleDelete = async (id: string) => {
    try {
      await deleteService(id);
      toast({ title: "Service Deleted", description: "The service has been removed." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete service.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Services</h1>
          <p className="text-muted-foreground mt-1">Manage individual agency offerings</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/services/add")}>
          <Plus className="h-4 w-4" /> Add Service
        </Button>
      </div>

      <div className="bg-muted/30 p-4 rounded-xl border border-border/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search services..." 
            className="pl-9 bg-card border-border/50" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <Card className="shadow-card border-border overflow-hidden rounded-2xl">
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[30%]">Service Name</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="hidden md:table-cell">Base Price</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground">
                    <Zap className="h-10 w-10 mx-auto mb-4 text-muted-foreground/20" />
                    <p className="text-lg font-medium text-foreground">No services found</p>
                    <p className="text-sm">Try adjusting your filters or create a new service.</p>
                  </TableCell>
                </TableRow>
              ) : filtered.map((svc) => (
                <TableRow key={svc.id} className="hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => navigate(`/dashboard/services/view/${svc.id}`)}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-foreground text-sm">{svc.name}</span>
                      <span className="text-xs text-muted-foreground line-clamp-1">{svc.description}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="bg-primary/5 text-primary border-primary/10">
                      {svc.category}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell font-display font-semibold">
                    {formatCurrency(svc.basePrice)}
                  </TableCell>
                  <TableCell>
                    <Badge className={statusColor(svc.status)}>{svc.status}</Badge>
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-40">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/services/view/${svc.id}`); }}>
                          <Eye className="h-3.5 w-3.5" /> View
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/services/edit/${svc.id}`); }}>
                          <Edit className="h-3.5 w-3.5" /> Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDelete(svc.id); }}>
                          <Trash2 className="h-3.5 w-3.5" /> Delete
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
      
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Services", value: services.length, icon: Zap, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/10" },
          { label: "Available", value: services.filter(s => s.status === 'Available').length, icon: Zap, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-900/10" },
          { label: "Categories", value: new Set(services.map(s => s.category)).size, icon: Zap, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/10" },
          { label: "Average Value", value: formatCurrency(450), icon: Zap, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/10" },
        ].map((stat, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-4 flex items-center gap-4">
              <div className={`p-2 rounded-xl ${stat.bg} ${stat.color}`}>
                <stat.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{stat.label}</p>
                <p className="text-xl font-bold">{stat.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

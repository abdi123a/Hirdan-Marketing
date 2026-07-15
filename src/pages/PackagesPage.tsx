import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Package, Check, MoreHorizontal, Edit, Trash2, Eye } from "lucide-react";
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

export default function PackagesPage() {
  const { packages, deletePackage, fetchPackages, subscriptions, fetchSubscriptions } = useAgencyStore();
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<'all' | 'Subscription' | 'Service' | 'One-time'>('all');
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchPackages();
    fetchSubscriptions();
  }, [fetchPackages, fetchSubscriptions]);

  const filtered = packages.filter((pkg) => {
    const matchesSearch = pkg.name.toLowerCase().includes(search.toLowerCase()) ||
      pkg.description.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === 'all' || pkg.type === activeTab;
    return matchesSearch && matchesTab;
  });

  const handleDelete = async (id: string) => {
    try {
      await deletePackage(id);
      toast({ title: "Package Deleted", description: "The package has been removed." });
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete package.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Packages</h1>
          <p className="text-muted-foreground mt-1">Pre-defined service bundles and subscriptions</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/packages/add")}>
          <Plus className="h-4 w-4" /> Create Package
        </Button>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between bg-muted/30 p-4 rounded-xl border border-border/50">
        <div className="flex flex-wrap gap-1 bg-background p-1 rounded-lg border border-border/50">
          {(['all', 'Subscription', 'Service', 'One-time'] as const).map((tab) => (
            <Button
              key={tab}
              variant={activeTab === tab ? "hero" : "ghost"}
              size="sm"
              onClick={() => setActiveTab(tab)}
              className="text-xs h-8 px-3 rounded-md"
            >
              {tab === 'all' ? 'All Packages' : tab}
            </Button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search packages..." 
            className="pl-9 bg-card border-border/50 h-9" 
            value={search} 
            onChange={(e) => setSearch(e.target.value)} 
          />
        </div>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.length === 0 ? (
          <div className="col-span-full text-center py-20 bg-card rounded-2xl border border-dashed border-border">
            <Package className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-foreground">No packages found</h3>
            <p className="text-muted-foreground">Try adjusting your search or create a new package.</p>
          </div>
        ) : filtered.map((pkg) => (
          <Card key={pkg.id} className="group relative overflow-hidden border-border/50 hover:border-primary/30 transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 cursor-pointer flex flex-col" onClick={() => navigate(`/dashboard/packages/view/${pkg.id}`)}>
            <CardHeader className="pb-4">
              <div className="flex justify-between items-start">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
                  <Package className="h-5 w-5" />
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuLabel>Options</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/packages/view/${pkg.id}`); }}>
                      <Eye className="h-3.5 w-3.5" /> View
                    </DropdownMenuItem>
                    <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/packages/edit/${pkg.id}`); }}>
                      <Edit className="h-3.5 w-3.5" /> Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem className="gap-2 text-destructive focus:text-destructive cursor-pointer" onClick={(e) => { e.stopPropagation(); handleDelete(pkg.id); }}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="mt-4">
                <div className="flex items-center gap-2">
                  <CardTitle className="text-xl font-bold">{pkg.name}</CardTitle>
                  <Badge variant="outline" className="text-[10px] uppercase tracking-wider">{pkg.type}</Badge>
                </div>
                <p className="text-muted-foreground text-sm mt-1.5 line-clamp-2">{pkg.description}</p>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              <div className="mb-4">
                <span className="text-3xl font-bold text-foreground">{formatCurrency(pkg.price)}</span>
              </div>
              <ul className="space-y-2.5 mb-4">
                {pkg.features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2.5 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              {(() => {
                const activeSubs = subscriptions.filter(s => (s.packageId === pkg.id || s.plan === pkg.name) && s.status === 'Active');
                const mrr = activeSubs.reduce((sum, s) => sum + parseFloat(s.amount.replace(/[^0-9.]/g, "")), 0);
                return (
                  <div className="grid grid-cols-2 gap-2 mt-4 pt-4 border-t border-border/50 text-xs font-semibold text-muted-foreground">
                    <div>
                      <span className="text-[10px] uppercase block tracking-wider font-bold">Adoptions</span>
                      <span className="text-foreground text-sm font-bold">{activeSubs.length} active</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase block tracking-wider font-bold">MRR Value</span>
                      <span className="text-primary text-sm font-bold">{formatCurrency(mrr)}</span>
                    </div>
                  </div>
                );
              })()}
            </CardContent>
            <CardFooter className="pt-0 border-t border-border/10 mt-auto" onClick={(e) => e.stopPropagation()}>
              <Button className="w-full mt-4 bg-primary/5 text-primary hover:bg-primary hover:text-white transition-all duration-300 rounded-xl py-6"
                onClick={() => toast({ 
                  title: "Assign Package", 
                  description: `Assigning "${pkg.name}" to a client... This will pre-fill a new subscription form.`,
                  action: <Button variant="outline" size="sm" onClick={() => navigate(`/dashboard/subscriptions/add?packageId=${pkg.id}`)}>Proceed</Button>
                })}
              >
                Assign to Client
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreHorizontal, Edit, Trash2, Ban, RefreshCw, Search, Eye, Package, ShieldCheck } from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useState, useMemo, useEffect } from "react";
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

const planColor = (plan: string) =>
  plan === "Enterprise" ? "bg-violet-100 text-violet-700 border-violet-200" :
    plan === "Business" ? "bg-blue-100 text-blue-700 border-blue-200" :
      plan === "Pro" ? "bg-primary/10 text-primary border-primary/20" :
        plan === "Starter" ? "bg-muted text-muted-foreground border-border" :
          "bg-primary/5 text-primary border-primary/10"; // Default for custom plans

const statusColor = (s: string) =>
  s === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
    s === "Trial" ? "bg-blue-100 text-blue-700 hover:bg-blue-100" :
      s === "Paused" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
        s === "Ended" ? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 hover:bg-slate-100" :
          "bg-red-100 text-red-700 hover:bg-red-100";

export default function SubscriptionsPage() {
  const { subscriptions, deleteSubscription, updateSubscription, fetchSubscriptions } = useAgencyStore();
  const [search, setSearch] = useState("");
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchSubscriptions();
  }, [fetchSubscriptions]);

  const filtered = subscriptions.filter((s) =>
    s.client.toLowerCase().includes(search.toLowerCase()) ||
    s.plan.toLowerCase().includes(search.toLowerCase())
  );

  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.status === 'Active');
    const mrr = active.reduce((sum, s) => sum + parseFloat(s.amount.replace(/[^0-9.]/g, "")), 0);
    const cancelled = subscriptions.filter(s => s.status === 'Cancelled').length;
    return [
      { label: "Monthly Recurring", value: formatCurrency(mrr), sub: `${active.length} active`, color: "text-primary" },
      { label: "Annual Value", value: formatCurrency(mrr * 12), sub: "Projected ARR", color: "text-foreground" },
      { label: "Churn", value: cancelled.toString(), sub: `${cancelled} cancelled`, color: "text-red-600" },
    ];
  }, [subscriptions]);

  const handleDelete = async (id: string, client: string) => {
    try {
      await deleteSubscription(id);
      toast({ title: "Subscription Removed", description: `Subscription for ${client} has been deleted.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to remove subscription.", variant: "destructive" });
    }
  };

  const handleCancel = async (id: string, client: string) => {
    try {
      await updateSubscription(id, { status: "Cancelled", endDate: "N/A" });
      toast({ title: "Subscription Cancelled", description: `${client}'s subscription has been cancelled.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to cancel subscription.", variant: "destructive" });
    }
  };

  const handleRenew = async (id: string, currentRenewal: string, cycle: string, client: string) => {
    let date = new Date();
    if (currentRenewal && currentRenewal !== "N/A") {
      const parsed = new Date(currentRenewal);
      if (parsed.toString() !== 'Invalid Date') {
        date = parsed;
      }
    }

    if (cycle === "Monthly") date.setMonth(date.getMonth() + 1);
    else if (cycle === "Quarterly") date.setMonth(date.getMonth() + 3);
    else if (cycle === "Annual") date.setFullYear(date.getFullYear() + 1);

    const newRenewal = date.toISOString().split('T')[0];
    try {
      await updateSubscription(id, { endDate: newRenewal, status: "Active" });
      toast({ title: "Subscription Renewed", description: `${client}'s plan has been extended to ${newRenewal}.` });
    } catch (e) {
      toast({ title: "Error", description: "Failed to renew subscription.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage recurring client plans</p>
        </div>
        <Button variant="hero" className="gap-2" onClick={() => navigate("/dashboard/subscriptions/add")}>
          <Plus className="h-4 w-4" /> Add Subscription
        </Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="shadow-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground font-medium">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg font-semibold">All Subscriptions ({filtered.length})</CardTitle>
            <div className="relative w-full sm:w-48 shrink-0">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-9 w-full bg-muted border-0" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Billing</TableHead>
                <TableHead className="hidden md:table-cell">Start Date</TableHead>
                <TableHead className="hidden lg:table-cell">End Date</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground">
                    No subscriptions found. <button className="text-primary underline underline-offset-2" onClick={() => navigate("/dashboard/subscriptions/add")}>Add a subscription</button>
                  </TableCell>
                </TableRow>
              ) : filtered.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-muted/50 transition-colors cursor-pointer group" onClick={() => navigate(`/dashboard/subscriptions/view/${sub.id}`)}>
                  <TableCell>
                    <div>
                      <p className="font-semibold text-foreground text-sm">{sub.client}</p>
                      {sub.clientEmail && <p className="text-xs text-muted-foreground">{sub.clientEmail}</p>}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`font-semibold ${planColor(sub.plan)}`}>{sub.plan}</Badge>
                      {sub.packageId && <Package className="h-3 w-3 text-primary/60" />}
                      {sub.serviceId && <ShieldCheck className="h-3 w-3 text-emerald-500/60" />}
                    </div>
                  </TableCell>
                  <TableCell className="font-semibold text-foreground">
                    {formatCurrency(sub.amount)}
                    <span className="text-xs text-muted-foreground font-normal">/{sub.billingCycle === "Monthly" ? "mo" : sub.billingCycle === "Quarterly" ? "qtr" : "yr"}</span>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground text-sm">{sub.billingCycle}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">{formatDate(sub.startDate)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">{formatDate(sub.endDate)}</TableCell>
                  <TableCell>
                    <Badge className={statusColor(sub.status)}>{sub.status}</Badge>
                  </TableCell>
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
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/subscriptions/view/${sub.id}`); }}>
                          <Eye className="h-4 w-4" /> View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/subscriptions/edit/${sub.id}`); }}>
                          <Edit className="h-4 w-4" /> Edit Plan
                        </DropdownMenuItem>
                        <DropdownMenuItem className="gap-2 cursor-pointer" onClick={(e) => { e.stopPropagation(); handleRenew(sub.id, sub.endDate, sub.billingCycle, sub.client); }}>
                          <RefreshCw className="h-4 w-4" /> Renew
                        </DropdownMenuItem>
                        {sub.status !== "Cancelled" && (
                          <DropdownMenuItem
                            className="gap-2 cursor-pointer text-amber-600 focus:text-amber-600"
                            onClick={(e) => { e.stopPropagation(); handleCancel(sub.id, sub.client); }}
                          >
                            <Ban className="h-4 w-4" /> Cancel
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                          onClick={(e) => { e.stopPropagation(); handleDelete(sub.id, sub.client); }}
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

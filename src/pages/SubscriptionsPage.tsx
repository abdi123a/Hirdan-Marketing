import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, MoreHorizontal } from "lucide-react";

const subscriptions = [
  { id: 1, client: "TechStart Inc.", plan: "Pro", amount: "$499/mo", started: "Jan 2025", renewal: "Apr 1, 2026", status: "Active" },
  { id: 2, client: "MediaCo Agency", plan: "Business", amount: "$899/mo", started: "Mar 2025", renewal: "Apr 10, 2026", status: "Active" },
  { id: 3, client: "GreenLeaf Studios", plan: "Pro", amount: "$499/mo", started: "Jun 2025", renewal: "Apr 15, 2026", status: "Active" },
  { id: 4, client: "BlueSky Holdings", plan: "Starter", amount: "$199/mo", started: "Sep 2025", renewal: "N/A", status: "Cancelled" },
  { id: 5, client: "Nova Digital", plan: "Pro", amount: "$499/mo", started: "Nov 2025", renewal: "May 1, 2026", status: "Active" },
];

export default function SubscriptionsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground mt-1">Manage recurring client plans</p>
        </div>
        <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> Add Subscription</Button>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Monthly Recurring", value: "$2,895", sub: "4 active" },
          { label: "Annual Value", value: "$34,740", sub: "Projected" },
          { label: "Churn Rate", value: "4.2%", sub: "Last 90 days" },
        ].map((s) => (
          <Card key={s.label} className="shadow-card border-border">
            <CardContent className="p-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className="text-2xl font-display font-bold text-foreground mt-1">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="shadow-card border-border">
        <CardHeader><CardTitle className="font-display text-lg">All Subscriptions</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Client</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead className="hidden sm:table-cell">Started</TableHead>
                <TableHead className="hidden md:table-cell">Next Renewal</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions.map((sub) => (
                <TableRow key={sub.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{sub.client}</TableCell>
                  <TableCell><Badge variant="outline">{sub.plan}</Badge></TableCell>
                  <TableCell className="font-medium text-foreground">{sub.amount}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{sub.started}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{sub.renewal}</TableCell>
                  <TableCell>
                    <Badge className={sub.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-red-100 text-red-700 hover:bg-red-100"}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell><Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

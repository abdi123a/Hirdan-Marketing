import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Download, MoreHorizontal } from "lucide-react";

const invoices = [
  { id: "INV-001", client: "TechStart Inc.", amount: "$4,500", date: "Mar 15, 2026", due: "Apr 15, 2026", status: "Paid" },
  { id: "INV-002", client: "MediaCo Agency", amount: "$3,200", date: "Mar 10, 2026", due: "Apr 10, 2026", status: "Pending" },
  { id: "INV-003", client: "GreenLeaf Studios", amount: "$6,800", date: "Mar 5, 2026", due: "Apr 5, 2026", status: "Paid" },
  { id: "INV-004", client: "Nova Digital", amount: "$2,100", date: "Mar 1, 2026", due: "Apr 1, 2026", status: "Overdue" },
  { id: "INV-005", client: "BlueSky Holdings", amount: "$1,500", date: "Feb 20, 2026", due: "Mar 20, 2026", status: "Overdue" },
  { id: "INV-006", client: "TechStart Inc.", amount: "$5,000", date: "Feb 15, 2026", due: "Mar 15, 2026", status: "Paid" },
];

const statusColor = (s: string) =>
  s === "Paid" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
  s === "Pending" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
  "bg-red-100 text-red-700 hover:bg-red-100";

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Invoices</h1>
          <p className="text-muted-foreground mt-1">Track payments and billing</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" className="gap-2"><Download className="h-4 w-4" /> Export</Button>
          <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> New Invoice</Button>
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-4">
        {[
          { label: "Total Outstanding", value: "$3,600", sub: "2 overdue" },
          { label: "Paid This Month", value: "$11,300", sub: "2 invoices" },
          { label: "Pending", value: "$3,200", sub: "1 invoice" },
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
        <CardHeader><CardTitle className="font-display text-lg">All Invoices</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice</TableHead>
                <TableHead>Client</TableHead>
                <TableHead className="hidden sm:table-cell">Date</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id} className="hover:bg-muted/50">
                  <TableCell className="font-medium text-foreground">{inv.id}</TableCell>
                  <TableCell className="text-muted-foreground">{inv.client}</TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{inv.date}</TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground">{inv.due}</TableCell>
                  <TableCell className="font-medium text-foreground">{inv.amount}</TableCell>
                  <TableCell><Badge className={statusColor(inv.status)}>{inv.status}</Badge></TableCell>
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

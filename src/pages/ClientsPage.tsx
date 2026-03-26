import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Search, MoreHorizontal, Mail, Phone } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useState } from "react";

const clientsData = [
  { id: 1, name: "TechStart Inc.", email: "hello@techstart.io", phone: "+1 555-0101", status: "Active", projects: 3, revenue: "$12,400", initials: "TS" },
  { id: 2, name: "MediaCo Agency", email: "info@mediaco.com", phone: "+1 555-0102", status: "Active", projects: 2, revenue: "$8,750", initials: "MC" },
  { id: 3, name: "GreenLeaf Studios", email: "contact@greenleaf.co", phone: "+1 555-0103", status: "Active", projects: 4, revenue: "$15,200", initials: "GL" },
  { id: 4, name: "BlueSky Holdings", email: "team@bluesky.com", phone: "+1 555-0104", status: "Paused", projects: 1, revenue: "$3,000", initials: "BH" },
  { id: 5, name: "Nova Digital", email: "hi@novadigital.io", phone: "+1 555-0105", status: "Active", projects: 2, revenue: "$6,800", initials: "ND" },
  { id: 6, name: "Apex Ventures", email: "info@apex.vc", phone: "+1 555-0106", status: "Churned", projects: 0, revenue: "$0", initials: "AV" },
];

export default function ClientsPage() {
  const [search, setSearch] = useState("");
  const filtered = clientsData.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Clients</h1>
          <p className="text-muted-foreground mt-1">Manage your client relationships</p>
        </div>
        <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> Add Client</Button>
      </div>

      <Card className="shadow-card border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="font-display text-lg">All Clients</CardTitle>
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
                <TableHead>Status</TableHead>
                <TableHead className="hidden sm:table-cell">Projects</TableHead>
                <TableHead>Revenue</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((c) => (
                <TableRow key={c.id} className="hover:bg-muted/50">
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9 bg-primary">
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">{c.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium text-foreground">{c.name}</p>
                        <p className="text-xs text-muted-foreground md:hidden">{c.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{c.email}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge className={
                      c.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                      c.status === "Paused" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                      "bg-red-100 text-red-700 hover:bg-red-100"
                    }>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="hidden sm:table-cell text-muted-foreground">{c.projects}</TableCell>
                  <TableCell className="font-medium text-foreground">{c.revenue}</TableCell>
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

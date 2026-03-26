import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Mail, MoreHorizontal } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const team = [
  { id: 1, name: "Ahmed Hassan", role: "Project Manager", email: "ahmed@hirdan.com", status: "Active", projects: 5, initials: "AH" },
  { id: 2, name: "Sarah Chen", role: "UI/UX Designer", email: "sarah@hirdan.com", status: "Active", projects: 3, initials: "SC" },
  { id: 3, name: "James Wilson", role: "SEO Specialist", email: "james@hirdan.com", status: "Active", projects: 4, initials: "JW" },
  { id: 4, name: "Maria Garcia", role: "Content Writer", email: "maria@hirdan.com", status: "On Leave", projects: 2, initials: "MG" },
  { id: 5, name: "David Kim", role: "PPC Manager", email: "david@hirdan.com", status: "Active", projects: 3, initials: "DK" },
  { id: 6, name: "Lisa Patel", role: "Social Media Manager", email: "lisa@hirdan.com", status: "Active", projects: 4, initials: "LP" },
];

export default function TeamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Team</h1>
          <p className="text-muted-foreground mt-1">Manage your team members and roles</p>
        </div>
        <Button variant="hero" className="gap-2"><Plus className="h-4 w-4" /> Add Member</Button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {team.map((m) => (
          <Card key={m.id} className="shadow-card border-border hover:shadow-elevated transition-shadow">
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12 bg-primary">
                    <AvatarFallback className="bg-primary text-primary-foreground font-semibold">{m.initials}</AvatarFallback>
                  </Avatar>
                  <div>
                    <h3 className="font-display font-semibold text-foreground">{m.name}</h3>
                    <p className="text-sm text-muted-foreground">{m.role}</p>
                  </div>
                </div>
                <Button variant="ghost" size="icon"><MoreHorizontal className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Mail className="h-4 w-4" /> {m.email}
                </div>
                <div className="flex items-center justify-between">
                  <Badge className={m.status === "Active" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                    {m.status}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{m.projects} projects</span>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

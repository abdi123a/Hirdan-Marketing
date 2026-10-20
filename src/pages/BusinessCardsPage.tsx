import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Plus, Eye, UserPlus, Inbox, IdCard } from "lucide-react";
import { apiFetch, getFullUrl } from "@/lib/api-client";
import { getShortDomainBase } from "@/lib/short-url";
import { usePermissions } from "@/hooks/usePermissions";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export interface BusinessCardRow {
  id: string;
  slug: string;
  enabled: boolean;
  memberId: string | null;
  name: string;
  title: string;
  phone: string | null;
  whatsapp: string | null;
  email: string | null;
  photoUrl: string | null;
  bio: string | null;
  views: number;
  saves: number;
  _count?: { leads: number };
}

export const initials = (name: string) => name.split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase();

export default function BusinessCardsPage() {
  const navigate = useNavigate();
  const { canWrite } = usePermissions();
  const { data, isLoading } = useQuery({
    queryKey: ["business-cards"],
    queryFn: () => apiFetch<{ cards: BusinessCardRow[] }>("/business-cards"),
  });
  const cards = data?.cards || [];
  const shortBase = getShortDomainBase().replace(/^https?:\/\//, "");
  const total = (k: "views" | "saves") => cards.reduce((n, c) => n + c[k], 0);
  const totalLeads = cards.reduce((n, c) => n + (c._count?.leads || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Business Cards</h1>
          <p className="text-muted-foreground mt-1">Digital business cards people open by scanning a QR code</p>
        </div>
        {canWrite("business_cards") && (
          <Button className="gap-2" onClick={() => navigate("/dashboard/business-cards/new")}>
            <Plus className="h-4 w-4" /> New card
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: "Card views", value: total("views"), icon: Eye },
          { label: "Contacts saved", value: total("saves"), icon: UserPlus },
          { label: "Leads", value: totalLeads, icon: Inbox },
        ].map((s) => (
          <Card key={s.label} className="shadow-card border-border">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide flex items-center gap-1.5"><s.icon className="h-3.5 w-3.5" />{s.label}</p>
              <p className="text-2xl font-bold mt-1 text-foreground">{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">Loading cards...</div>
      ) : cards.length === 0 ? (
        <Card className="shadow-card border-border">
          <CardContent className="p-12 flex flex-col items-center text-center gap-3">
            <IdCard className="h-10 w-10 text-muted-foreground" />
            <p className="font-semibold">Create your first business card</p>
            <p className="text-sm text-muted-foreground max-w-sm">Pick a team member, check their details, and share the link or QR code.</p>
            {canWrite("business_cards") && (
              <Button className="gap-2 mt-2" onClick={() => navigate("/dashboard/business-cards/new")}><Plus className="h-4 w-4" /> New card</Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {cards.map((c) => (
            <Card
              key={c.id}
              onClick={() => navigate(`/dashboard/business-cards/${c.id}`)}
              className="shadow-card border-border cursor-pointer hover:border-primary/40 transition-colors"
            >
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  <Avatar className="h-12 w-12">
                    {c.photoUrl && <AvatarImage src={getFullUrl(c.photoUrl)} className="object-cover" />}
                    <AvatarFallback className="bg-secondary/20 font-semibold">{initials(c.name)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold truncate">{c.name}</p>
                    <p className="text-sm text-muted-foreground truncate">{c.title}</p>
                  </div>
                  <Badge variant={c.enabled ? "default" : "outline"}>{c.enabled ? "Live" : "Off"}</Badge>
                </div>
                <p className="text-xs text-muted-foreground truncate">{shortBase}/c/{c.slug}</p>
                <div className="flex gap-4 text-xs text-muted-foreground">
                  <span>{c.views} views</span>
                  <span>{c.saves} saved</span>
                  <span>{c._count?.leads || 0} leads</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

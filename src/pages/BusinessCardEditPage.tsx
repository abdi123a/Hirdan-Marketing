import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeCanvas } from "qrcode.react";
import { ArrowLeft, Copy, Download, ExternalLink, Eye, UserPlus, Inbox, Trash2, Upload, Globe, Wallet } from "lucide-react";
import { apiFetch, getFullUrl } from "@/lib/api-client";
import { getShortDomainBase } from "@/lib/short-url";
import { formatDate } from "@/lib/utils";
import { useAgencyStore } from "@/lib/store";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials, type BusinessCardRow } from "./BusinessCardsPage";

interface CardLead {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  company: string | null;
  message: string | null;
  createdAt: string;
}

type Form = Pick<BusinessCardRow, "slug" | "enabled" | "memberId" | "name" | "title"> & {
  phone: string;
  whatsapp: string;
  email: string;
  photoUrl: string;
  bio: string;
};

const EMPTY: Form = { slug: "", enabled: true, memberId: null, name: "", title: "", phone: "", whatsapp: "", email: "", photoUrl: "", bio: "" };

const toSlug = (name: string) =>
  name.toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 40);

export default function BusinessCardEditPage() {
  const { id } = useParams<{ id: string }>();
  const isNew = !id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { canWrite, can } = usePermissions();
  const editable = canWrite("business_cards");
  const { team, fetchTeam, uploadFile } = useAgencyStore();
  const qrRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["business-card", id],
    enabled: !isNew,
    queryFn: () => apiFetch<{ card: BusinessCardRow & { leads: CardLead[] }; walletLink: string | null }>(`/business-cards/${id}`),
  });
  const card = data?.card;
  const walletLink = data?.walletLink;

  useEffect(() => {
    if (can("team") && team.length === 0) fetchTeam();
  }, [can, team.length, fetchTeam]);

  useEffect(() => {
    if (!card) return;
    setForm({
      slug: card.slug,
      enabled: card.enabled,
      memberId: card.memberId,
      name: card.name,
      title: card.title,
      phone: card.phone || "",
      whatsapp: card.whatsapp || "",
      email: card.email || "",
      photoUrl: card.photoUrl || "",
      bio: card.bio || "",
    });
  }, [card]);

  const set = <K extends keyof Form>(key: K, value: Form[K]) => setForm((f) => ({ ...f, [key]: value }));

  const fillFromMember = (memberId: string) => {
    const m = team.find((t) => t.id === memberId);
    if (!m) return;
    setForm((f) => ({
      ...f,
      memberId: m.id,
      name: m.name,
      title: m.role,
      phone: m.phone || "",
      whatsapp: m.phone || "",
      email: m.email || "",
      photoUrl: m.photoUrl || m.avatar || "",
      bio: m.bio || "",
      slug: f.slug || toSlug(m.name),
    }));
  };

  const uploadPhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      set("photoUrl", await uploadFile(file));
    } catch {
      toast({ title: "Couldn't upload photo", variant: "destructive" });
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const body = JSON.stringify({ ...form, slug: form.slug || toSlug(form.name) });
      const res = await apiFetch<{ card: BusinessCardRow }>(isNew ? "/business-cards" : `/business-cards/${id}`, {
        method: isNew ? "POST" : "PUT",
        body,
      });
      queryClient.invalidateQueries({ queryKey: ["business-cards"] });
      queryClient.invalidateQueries({ queryKey: ["business-card", res.card.id] });
      toast({ title: "Business card saved" });
      if (isNew) navigate(`/dashboard/business-cards/${res.card.id}`, { replace: true });
    } catch (err) {
      toast({ title: "Couldn't save", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(`Delete ${form.name}'s business card? The link and QR code will stop working.`)) return;
    try {
      await apiFetch(`/business-cards/${id}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["business-cards"] });
      navigate("/dashboard/business-cards");
    } catch (err) {
      toast({ title: "Couldn't delete", description: (err as Error).message, variant: "destructive" });
    }
  };

  const deleteLead = async (leadId: string) => {
    if (!confirm("Delete this lead?")) return;
    try {
      await apiFetch(`/business-cards/${id}/leads/${leadId}`, { method: "DELETE" });
      queryClient.invalidateQueries({ queryKey: ["business-card", id] });
    } catch (err) {
      toast({ title: "Couldn't delete lead", description: (err as Error).message, variant: "destructive" });
    }
  };

  if (!isNew && isLoading) {
    return <div className="p-12 text-center text-sm text-muted-foreground animate-pulse">Loading card...</div>;
  }

  const cardUrl = card ? `${getShortDomainBase()}/c/${card.slug}` : "";
  const leads = card?.leads || [];

  const downloadQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${card!.slug}-card-qr.png`;
    a.click();
  };

  const field = (key: "name" | "title" | "phone" | "whatsapp" | "email", label: string, placeholder: string, type = "text") => (
    <div className="space-y-1.5">
      <Label htmlFor={`bc-${key}`}>{label}</Label>
      <Input id={`bc-${key}`} type={type} value={form[key]} placeholder={placeholder} disabled={!editable} onChange={(e) => set(key, e.target.value)} />
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/business-cards")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">{isNew ? "New business card" : form.name || "Business card"}</h1>
            {!isNew && <p className="text-sm text-muted-foreground">{form.title}</p>}
          </div>
        </div>
        {editable && (
          <div className="flex gap-2">
            {!isNew && can("business_cards", "MANAGE") && (
              <Button variant="outline" onClick={remove} className="gap-2"><Trash2 className="h-4 w-4" /> Delete</Button>
            )}
            <Button onClick={save} disabled={saving || !form.name.trim() || !form.title.trim()}>{saving ? "Saving..." : "Save card"}</Button>
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Person on the card</CardTitle>
              <CardDescription>These details belong to this card only. Changing them here doesn't change the Team or HR records.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {editable && team.length > 0 && (
                <div className="space-y-1.5">
                  <Label>Fill from team member</Label>
                  <Select value={form.memberId || undefined} onValueChange={fillFromMember}>
                    <SelectTrigger><SelectValue placeholder="Choose a team member" /></SelectTrigger>
                    <SelectContent>
                      {team.filter((m) => !m.archivedAt).map((m) => (
                        <SelectItem key={m.id} value={m.id}>{m.name} · {m.role}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="flex items-center gap-4">
                <Avatar className="h-20 w-20">
                  {form.photoUrl && <AvatarImage src={getFullUrl(form.photoUrl)} className="object-cover" />}
                  <AvatarFallback className="bg-secondary/20 text-xl font-semibold">{form.name ? initials(form.name) : "?"}</AvatarFallback>
                </Avatar>
                {editable && (
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" asChild>
                      <label className="cursor-pointer gap-1.5">
                        <Upload className="h-4 w-4" /> {form.photoUrl ? "Change photo" : "Upload photo"}
                        <input type="file" accept="image/*" className="hidden" onChange={uploadPhoto} />
                      </label>
                    </Button>
                    {form.photoUrl && <Button variant="ghost" size="sm" onClick={() => set("photoUrl", "")}>Remove</Button>}
                  </div>
                )}
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {field("name", "Full name", "Ahmed Hassan")}
                {field("title", "Job title", "Social media manager")}
                {field("phone", "Phone", "+253 77 12 34 56", "tel")}
                {field("whatsapp", "WhatsApp", "+253 77 12 34 56", "tel")}
                {field("email", "Email", "ahmed@hirdanmarketing.com", "email")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bc-bio">Short bio</Label>
                <Textarea id="bc-bio" rows={3} maxLength={1000} value={form.bio} disabled={!editable} placeholder="One or two lines about what this person does" onChange={(e) => set("bio", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base font-semibold">Card settings</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-border/60 p-3">
                <div>
                  <p className="text-sm font-medium">Card is live</p>
                  <p className="text-xs text-muted-foreground">When off, the link shows "This card isn't available".</p>
                </div>
                <Switch checked={form.enabled} disabled={!editable} onCheckedChange={(v) => set("enabled", v)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bc-slug">Card link</Label>
                <div className="flex items-center rounded-md border border-input focus-within:ring-2 focus-within:ring-ring overflow-hidden">
                  <span className="pl-3 text-sm text-muted-foreground whitespace-nowrap">{getShortDomainBase().replace(/^https?:\/\//, "")}/c/</span>
                  <input
                    id="bc-slug"
                    value={form.slug}
                    disabled={!editable}
                    placeholder={toSlug(form.name) || "name"}
                    onChange={(e) => set("slug", e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                    maxLength={40}
                    className="flex-1 h-10 bg-transparent pr-3 text-sm outline-none"
                  />
                </div>
                {!isNew && card && form.slug !== card.slug && (
                  <p className="text-xs text-amber-600">Changing the link breaks QR codes already printed with the old one.</p>
                )}
              </div>
              <div className="flex items-start gap-3 rounded-lg bg-muted/50 p-3 text-sm">
                <Globe className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <p className="text-muted-foreground">
                  Company website, address and social media icons are the same on every card. Change them in{" "}
                  <Link to="/dashboard/settings" className="text-foreground underline underline-offset-2">Settings</Link>.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          {card ? (
            <Card className="border-border/50 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base font-semibold">Share</CardTitle>
                <CardDescription>Print the QR code on badges, desk signs or flyers.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div ref={qrRef} className="mx-auto w-fit rounded-xl bg-white p-3 border border-border/60">
                  <QRCodeCanvas value={cardUrl} size={180} marginSize={1} />
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm font-medium break-all text-center">{cardUrl}</div>
                <div className="flex flex-wrap justify-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => { navigator.clipboard.writeText(cardUrl); toast({ title: "Link copied" }); }}>
                    <Copy className="h-4 w-4 mr-1" /> Copy link
                  </Button>
                  <Button variant="outline" size="sm" onClick={downloadQr}>
                    <Download className="h-4 w-4 mr-1" /> Download QR
                  </Button>
                  <Button variant="outline" size="sm" asChild>
                    <a href={`/c/${card.slug}`} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4 mr-1" /> Open card</a>
                  </Button>
                </div>
                {!card.enabled && <p className="text-xs text-amber-600">The card is off. Turn on "Card is live" and save to share it.</p>}
                {walletLink && (
                  <div className="rounded-lg border border-border/60 p-3 space-y-2">
                    <p className="text-sm font-medium flex items-center gap-1.5"><Wallet className="h-4 w-4" /> Apple Wallet</p>
                    <p className="text-xs text-muted-foreground">Send this link to the employee. On their iPhone it shows "Add to Apple Wallet", so they can show the QR code to customers.</p>
                    <Button variant="outline" size="sm" className="w-full" onClick={() => { navigator.clipboard.writeText(walletLink); toast({ title: "Wallet link copied" }); }}>
                      <Copy className="h-4 w-4 mr-1" /> Copy employee link
                    </Button>
                  </div>
                )}
                <div className="grid grid-cols-3 gap-2 pt-1">
                  <Stat icon={Eye} label="Views" value={card.views} />
                  <Stat icon={UserPlus} label="Saved" value={card.saves} />
                  <Stat icon={Inbox} label="Leads" value={leads.length} />
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-border/50 shadow-sm">
              <CardContent className="p-6 text-sm text-muted-foreground">Save the card to get its link and QR code.</CardContent>
            </Card>
          )}
        </div>
      </div>

      {card && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Leads from this card</CardTitle>
            <CardDescription>People who tapped "Share your details". The admin email gets each new one too.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {leads.length === 0 ? (
              <div className="p-10 text-center text-xs text-muted-foreground italic">No leads yet.</div>
            ) : (
              <div className="divide-y divide-border/50">
                {leads.map((l) => (
                  <div key={l.id} className="p-4 flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-0.5 text-sm">
                      <p className="font-semibold">{l.name}{l.company && <span className="font-normal text-muted-foreground"> · {l.company}</span>}</p>
                      <p className="text-muted-foreground">
                        <a href={`tel:${l.phone}`} className="hover:text-foreground">{l.phone}</a>
                        {l.email && <> · <a href={`mailto:${l.email}`} className="hover:text-foreground">{l.email}</a></>}
                      </p>
                      {l.message && <p className="text-foreground/80 whitespace-pre-wrap">{l.message}</p>}
                      <p className="text-xs text-muted-foreground">{formatDate(l.createdAt)}</p>
                    </div>
                    {can("business_cards", "MANAGE") && (
                      <Button variant="ghost" size="icon" onClick={() => deleteLead(l.id)} aria-label="Delete lead">
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value }: { icon: typeof Eye; label: string; value: number }) {
  return (
    <div className="rounded-lg bg-muted/50 p-2.5 text-center">
      <div className="flex items-center justify-center gap-1 text-[11px] text-muted-foreground"><Icon className="h-3 w-3" />{label}</div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  );
}

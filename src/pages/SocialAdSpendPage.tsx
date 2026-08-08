import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { useAgencyStore } from "@/lib/store";
import { Wallet, Save, Trash2, RefreshCw } from "lucide-react";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PLATFORMS = ["facebook", "instagram", "tiktok", "youtube", "linkedin", "x", "threads", "pinterest"];

interface SpendRow {
  id: string;
  clientId: string;
  platform: string;
  month: number;
  year: number;
  spendCents: number;
  currency: string;
  paidReach: number | null;
  linkClicks: number | null;
  paidEngagement: number | null;
  messagesStarted: number | null;
  notes: string | null;
  client?: { id: string; name: string; company: string };
}

const EMPTY_FORM = {
  platform: "facebook",
  spend: "",
  currency: "DJF",
  paidReach: "",
  linkClicks: "",
  paidEngagement: "",
  messagesStarted: "",
  notes: "",
};

export default function SocialAdSpendPage() {
  const { toast } = useToast();
  const { clients, fetchClients } = useAgencyStore();
  const now = new Date();

  const defaultMonth = now.getMonth() === 0 ? 12 : now.getMonth();
  const defaultYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();

  const [clientId, setClientId] = useState("");
  const [month, setMonth] = useState(defaultMonth);
  const [year, setYear] = useState(defaultYear);
  const [rows, setRows] = useState<SpendRow[]>([]);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (clients.length === 0) fetchClients();
  }, [clients.length, fetchClients]);

  const load = useCallback(async () => {
    if (!clientId) { setRows([]); return; }
    setLoading(true);
    try {
      const res = await apiFetch<SpendRow[]>(
        `/social/ad-spend?clientId=${clientId}&month=${month}&year=${year}`,
      );
      setRows(res || []);
    } catch (err: any) {
      toast({ title: "Could not load ad spend", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [clientId, month, year, toast]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!clientId || !form.spend) return;
    setSaving(true);
    try {
      await apiFetch("/social/ad-spend", {
        method: "POST",
        body: JSON.stringify({
          clientId,
          month,
          year,
          platform: form.platform,
          spend: Number(form.spend),
          currency: form.currency,
          paidReach: form.paidReach === "" ? null : Number(form.paidReach),
          linkClicks: form.linkClicks === "" ? null : Number(form.linkClicks),
          paidEngagement: form.paidEngagement === "" ? null : Number(form.paidEngagement),
          messagesStarted: form.messagesStarted === "" ? null : Number(form.messagesStarted),
          notes: form.notes || null,
        }),
      });
      toast({ title: "Saved", description: `${form.platform} spend for ${MONTHS[month - 1]} ${year}` });
      setForm({ ...EMPTY_FORM, currency: form.currency });
      load();
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/social/ad-spend/${id}`, { method: "DELETE" });
      load();
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    }
  };

  const fmtMoney = (cents: number, currency: string) =>
    `${(cents / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })} ${currency}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black flex items-center gap-2">
          <Wallet className="h-6 w-6" /> Ad Spend
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Enter paid campaign figures by month. No platform reports ad spend through the analytics
          APIs we connect to, so these numbers come from your Ads Manager — they feed the
          Paid and Organic section of the client report.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Period</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-3 gap-3">
            <div>
              <Label className="text-xs font-bold">Client</Label>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger className="mt-1.5"><SelectValue placeholder="Select client" /></SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Month</Label>
              <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
                <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {MONTHS.map((m, i) => (
                    <SelectItem key={m} value={String(i + 1)}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs font-bold">Year</Label>
              <Input
                className="mt-1.5"
                type="number"
                value={year}
                onChange={(e) => setYear(Number(e.target.value) || now.getFullYear())}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {clientId && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Add / update a platform</CardTitle>
              <CardDescription>
                Saving replaces any existing entry for the same client, platform and month.
                Leave a field blank if you don't have it — blanks stay empty in the report rather than showing as zero.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs font-bold">Platform</Label>
                  <Select value={form.platform} onValueChange={(v) => setForm({ ...form, platform: v })}>
                    <SelectTrigger className="mt-1.5"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PLATFORMS.map((p) => (
                        <SelectItem key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs font-bold">Spend *</Label>
                  <Input className="mt-1.5" type="number" min="0" value={form.spend}
                    onChange={(e) => setForm({ ...form, spend: e.target.value })} placeholder="320000" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Currency</Label>
                  <Input className="mt-1.5" value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })} placeholder="DJF" />
                </div>
              </div>

              <div className="grid md:grid-cols-4 gap-3">
                <div>
                  <Label className="text-xs font-bold">Paid reach</Label>
                  <Input className="mt-1.5" type="number" min="0" value={form.paidReach}
                    onChange={(e) => setForm({ ...form, paidReach: e.target.value })} placeholder="—" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Link clicks</Label>
                  <Input className="mt-1.5" type="number" min="0" value={form.linkClicks}
                    onChange={(e) => setForm({ ...form, linkClicks: e.target.value })} placeholder="—" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Paid engagement</Label>
                  <Input className="mt-1.5" type="number" min="0" value={form.paidEngagement}
                    onChange={(e) => setForm({ ...form, paidEngagement: e.target.value })} placeholder="—" />
                </div>
                <div>
                  <Label className="text-xs font-bold">Messages started</Label>
                  <Input className="mt-1.5" type="number" min="0" value={form.messagesStarted}
                    onChange={(e) => setForm({ ...form, messagesStarted: e.target.value })} placeholder="—" />
                </div>
              </div>

              <div>
                <Label className="text-xs font-bold">Notes (internal)</Label>
                <Textarea className="mt-1.5" value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              </div>

              <Button onClick={handleSave} disabled={!form.spend || saving} className="gap-2 font-bold">
                {saving ? <><RefreshCw className="h-4 w-4 animate-spin" /> Saving…</> : <><Save className="h-4 w-4" /> Save entry</>}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Entries for {MONTHS[month - 1]} {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground text-sm py-6">
                  <RefreshCw className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : rows.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6">
                  No ad spend recorded for this month. The report's Paid and Organic section will show an empty state.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground border-b">
                        <th className="py-2 pr-4 font-bold">Platform</th>
                        <th className="py-2 pr-4 font-bold text-right">Spend</th>
                        <th className="py-2 pr-4 font-bold text-right">Paid reach</th>
                        <th className="py-2 pr-4 font-bold text-right">Clicks</th>
                        <th className="py-2 pr-4 font-bold text-right">Paid eng.</th>
                        <th className="py-2 pr-4 font-bold text-right">Messages</th>
                        <th className="py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((r) => (
                        <tr key={r.id} className="border-b last:border-0">
                          <td className="py-2.5 pr-4 font-semibold capitalize">{r.platform}</td>
                          <td className="py-2.5 pr-4 text-right">{fmtMoney(r.spendCents, r.currency)}</td>
                          <td className="py-2.5 pr-4 text-right">{r.paidReach?.toLocaleString() ?? "—"}</td>
                          <td className="py-2.5 pr-4 text-right">{r.linkClicks?.toLocaleString() ?? "—"}</td>
                          <td className="py-2.5 pr-4 text-right">{r.paidEngagement?.toLocaleString() ?? "—"}</td>
                          <td className="py-2.5 pr-4 text-right">{r.messagesStarted?.toLocaleString() ?? "—"}</td>
                          <td className="py-2.5 text-right">
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(r.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import {
  CheckCircle2, RefreshCw, AlertCircle, ArrowLeft, Users,
  Shield, ChevronRight, Sparkles, Lock,
} from "lucide-react";

interface PickerAccount {
  id: string;
  name: string;
  username: string | null;
  avatarUrl: string | null;
  followers: number;
  platform: string;
  /** Set when this Page is already attached to a client — it stays pinned there. */
  ownedBy?: { clientId: string; clientName: string; accountName: string } | null;
}

interface PickerClient {
  id: string;
  name: string;
  company: string | null;
}

const clientLabel = (c: PickerClient) => c.company || c.name;

const getPlatformIcon = (platform: string, cls = "h-5 w-5 rounded-sm object-contain") => {
  const map: Record<string, string> = {
    facebook: "/social-icons/Facebook.png",
    instagram: "/social-icons/instagram.png",
    threads: "/social-icons/Threads.png",
    tiktok: "/social-icons/tiktok.png",
    linkedin: "/social-icons/linkedin.png",
    youtube: "/social-icons/youtube.png",
    x: "/social-icons/twitter.png",
    twitter: "/social-icons/twitter.png",
    pinterest: "/social-icons/pinterest.png",
  };
  const src = map[platform?.toLowerCase()];
  return src ? <img src={src} className={cls} alt={platform} /> : null;
};

const fmtNum = (n: number) => {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toLocaleString();
};

export default function SocialAccountPickerPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const sessionId = params.get("session") || "";
  const platform = params.get("platform") || "";

  const [accounts, setAccounts] = useState<PickerAccount[]>([]);
  const [clients, setClients] = useState<PickerClient[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  /** pageId → clientId. One Facebook grant can populate several clients at once. */
  const [assignedClient, setAssignedClient] = useState<Record<string, string>>({});
  const [defaultClientId, setDefaultClientId] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [expiresIn, setExpiresIn] = useState(600);

  const selectableAccounts = accounts;

  useEffect(() => {
    if (!sessionId) { setError("Invalid session — no session ID found."); setIsLoading(false); return; }
    fetchAccounts();
  }, [sessionId]);

  // Countdown timer
  useEffect(() => {
    const timer = setInterval(() => setExpiresIn(t => Math.max(0, t - 1)), 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchAccounts = async () => {
    setIsLoading(true);
    try {
      const [res, clientRes] = await Promise.all([
        apiFetch<{ accounts: PickerAccount[]; expiresIn: number; platform: string; clientId: string }>(
          `/social/oauth/pending/${sessionId}`
        ),
        apiFetch<{ clients: PickerClient[] }>("/clients"),
      ]);
      const list = res.accounts || [];
      setAccounts(list);
      setClients(clientRes.clients || []);
      setDefaultClientId(res.clientId || "");
      setExpiresIn(res.expiresIn || 600);

      // A Page already attached to a client stays with that client; everything
      // else defaults to the client this connect flow started from.
      setAssignedClient(
        Object.fromEntries(
          list.map((a) => [a.id, a.ownedBy?.clientId || res.clientId || ""]),
        ),
      );
      // Pre-tick the starting client's own Page so the common case is one click.
      setSelected(new Set(list.filter((a) => a.ownedBy?.clientId === res.clientId).map((a) => a.id)));
    } catch (err: any) {
      setError(err.message || "Session expired or not found. Please reconnect.");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selected.size === selectableAccounts.length) setSelected(new Set());
    else setSelected(new Set(selectableAccounts.map(a => a.id)));
  };

  const setClientFor = (pageId: string, clientId: string) => {
    setAssignedClient((prev) => ({ ...prev, [pageId]: clientId }));
    setSelected((prev) => new Set(prev).add(pageId));
  };

  const handleConnect = async () => {
    if (!selected.size) {
      toast({ title: "No accounts selected", description: "Please select at least one account to connect.", variant: "destructive" });
      return;
    }
    const assignments = Array.from(selected).map((id) => ({
      id,
      clientId: assignedClient[id] || defaultClientId,
    }));
    const missing = assignments.filter((a) => !a.clientId);
    if (missing.length) {
      toast({
        title: "Pick a client",
        description: "Every selected account needs a client assigned.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      const res = await apiFetch<{
        success: boolean;
        savedCount: number;
        siblingsRefreshed?: number;
        siblingsDropped?: Array<{ accountName: string; clientName: string }>;
        skippedOwned?: string[];
      }>(`/social/oauth/select-account`, {
        method: "POST",
        body: JSON.stringify({ sessionId, assignments }),
      });
      const distinctClients = new Set(assignments.map((a) => a.clientId)).size;
      const parts: string[] = [
        distinctClients > 1
          ? `Assigned across ${distinctClients} clients.`
          : `Linked to this client.`,
      ];
      if (res.siblingsRefreshed) {
        parts.push(`Also refreshed ${res.siblingsRefreshed} other client account${res.siblingsRefreshed !== 1 ? "s" : ""}.`);
      }
      if (res.siblingsDropped?.length) {
        parts.push(
          `Meta revoked ${res.siblingsDropped.length} other account(s) because their Page was unchecked in Facebook — reconnect them with ALL Pages checked.`,
        );
      }
      if (res.skippedOwned?.length) {
        parts.push(`Skipped ${res.skippedOwned.join(", ")} — each Page stays with the client that owns it.`);
      }
      toast({
        title: `✅ ${res.savedCount} Account${res.savedCount !== 1 ? "s" : ""} Connected!`,
        description: parts.join(" "),
        variant: res.siblingsDropped?.length ? "destructive" : "default",
      });
      navigate("/dashboard/social-media/accounts?connected=true");
    } catch (err: any) {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const platformLabel = platform
    ? platform.charAt(0).toUpperCase() + platform.slice(1)
    : "Social Media";

  const minutesLeft = Math.floor(expiresIn / 60);
  const secondsLeft = expiresIn % 60;
  const lockedCount = accounts.length - selectableAccounts.length;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/10 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl space-y-6">

        {/* Step indicator */}
        <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-sm text-muted-foreground">
          {["Choose Client", "Choose Platform", "Authenticate", "Select Account", "Review", "Success"].map((step, i) => (
            <div key={step} className="flex items-center gap-2">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground/40" />}
              <span className={`text-xs font-bold ${i === 3 ? "text-primary" : i < 3 ? "text-emerald-600" : "text-muted-foreground/50"}`}>
                {i < 3 ? <CheckCircle2 className="h-3 w-3 inline mr-1" /> : null}
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Header card */}
        <Card className="rounded-2xl border border-border/80 shadow-lg overflow-hidden">
          <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border/40 px-7 py-6">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-background border border-border shadow-sm flex items-center justify-center">
                {getPlatformIcon(platform, "h-8 w-8 object-contain")}
              </div>
              <div>
                <h1 className="text-xl font-black text-foreground">
                  Choose {platformLabel} Account{accounts.length !== 1 ? "s" : ""}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {accounts.length} account{accounts.length !== 1 ? "s" : ""} found — tick each one and assign its client
                  {lockedCount > 0 ? ` · ${lockedCount} already owned by other clients` : ""}
                </p>
              </div>
              {expiresIn > 0 && (
                <div className="ml-auto text-right shrink-0">
                  <p className="text-[10px] text-muted-foreground uppercase font-bold tracking-wide">Session expires</p>
                  <p className={`text-sm font-black tabular-nums ${expiresIn < 120 ? "text-red-500" : "text-foreground"}`}>
                    {minutesLeft}:{secondsLeft.toString().padStart(2, "0")}
                  </p>
                </div>
              )}
            </div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin text-primary" />
                <span>Loading available accounts...</span>
              </div>
            ) : error ? (
              <div className="flex flex-col items-center justify-center py-16 gap-4 text-center px-8">
                <div className="h-14 w-14 rounded-2xl bg-red-50 flex items-center justify-center border border-red-100">
                  <AlertCircle className="h-6 w-6 text-red-500" />
                </div>
                <div>
                  <h3 className="font-bold text-base">Session Error</h3>
                  <p className="text-sm text-muted-foreground mt-1 max-w-sm">{error}</p>
                </div>
                <Button variant="outline" onClick={() => navigate("/dashboard/social-media/accounts")} className="rounded-xl gap-2">
                  <ArrowLeft className="h-4 w-4" /> Back to Accounts
                </Button>
              </div>
            ) : (
              <>
                {(platform === "facebook" || platform === "instagram") && (
                  <div className="mx-6 mt-4 rounded-xl border border-amber-200/80 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
                    <p className="font-semibold">Assign each account to its client</p>
                    <p className="mt-1 text-amber-900/80 text-xs leading-relaxed">
                      One Facebook login can fill in <strong>every</strong> client at once — tick each
                      account and choose who it belongs to. Separating clients is this app&apos;s job,
                      not the Facebook dialog&apos;s. In Facebook always pick{" "}
                      <strong>“Opt in to all current and future…”</strong> (the top radio button) on all
                      three screens; “current … only” makes Meta revoke every client you left unchecked.
                    </p>
                  </div>
                )}

                {/* Select all header */}
                <div className="flex items-center justify-between px-6 py-3 border-b border-border/40 bg-muted/5">
                  <div className="flex items-center gap-3">
                    <input
                      type="checkbox"
                      id="select-all"
                      checked={selected.size === selectableAccounts.length && selectableAccounts.length > 0}
                      onChange={handleSelectAll}
                      disabled={selectableAccounts.length === 0}
                      className="rounded accent-primary h-4 w-4"
                    />
                    <label htmlFor="select-all" className="text-xs font-bold text-muted-foreground cursor-pointer">
                      Select all ({selectableAccounts.length})
                    </label>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {selected.size} selected
                  </span>
                </div>

                {/* Account list */}
                <div className="divide-y divide-border/40">
                  {accounts.map((acc) => {
                    const pinned = acc.ownedBy || null;
                    const isSelected = selected.has(acc.id);
                    return (
                      <div
                        key={acc.id}
                        onClick={() => toggleSelect(acc.id)}
                        className={`flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 p-5 transition-all cursor-pointer hover:bg-muted/5 ${
                          isSelected ? "bg-primary/3 border-l-2 border-l-primary" : ""
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0 flex-1">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelect(acc.id)}
                            className="rounded accent-primary h-4 w-4 shrink-0"
                            onClick={e => e.stopPropagation()}
                          />

                          {/* Avatar */}
                          <div className="relative shrink-0">
                            {acc.avatarUrl ? (
                              <img src={acc.avatarUrl} className="h-12 w-12 rounded-full border border-border object-cover" alt="" />
                            ) : (
                              <div className="h-12 w-12 rounded-full bg-primary/10 border border-border flex items-center justify-center text-primary font-black text-lg">
                                {acc.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div className="absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full bg-background border border-border flex items-center justify-center shadow-sm">
                              {getPlatformIcon(acc.platform, "h-3 w-3 object-contain")}
                            </div>
                          </div>

                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="font-bold text-sm text-foreground truncate">{acc.name}</p>
                            {acc.username && (
                              <p className="text-xs text-muted-foreground font-mono mt-0.5">@{acc.username}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                              {acc.followers > 0 && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                                  <Users className="h-3 w-3" />
                                  {fmtNum(acc.followers)} {acc.platform?.toLowerCase() === 'youtube' ? 'subscribers' : 'followers'}
                                </span>
                              )}
                              <span className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
                                <Shield className="h-2.5 w-2.5" />
                                {acc.platform}
                              </span>
                              {pinned && (
                                <span className="flex items-center gap-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-100 px-2 py-0.5 rounded-full">
                                  <Lock className="h-2.5 w-2.5" />
                                  Already {pinned.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3 pl-8 sm:pl-0 shrink-0">
                          {/* Client assignment — a Page already attached stays with its
                              client, so that row shows the owner instead of a picker. */}
                          <div className="w-full sm:w-48" onClick={(e) => e.stopPropagation()}>
                            {pinned ? (
                              <div className="text-xs font-semibold text-muted-foreground text-right pr-1">
                                {pinned.clientName}
                                <span className="block text-[10px] font-normal opacity-70">
                                  reconnect only
                                </span>
                              </div>
                            ) : (
                              <select
                                value={assignedClient[acc.id] || ""}
                                onChange={(e) => setClientFor(acc.id, e.target.value)}
                                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/30"
                                aria-label={`Client for ${acc.name}`}
                              >
                                <option value="">Choose client…</option>
                                {clients.map((c) => (
                                  <option key={c.id} value={c.id}>
                                    {clientLabel(c)}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>

                          {isSelected ? (
                            <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                          ) : (
                            <span className="h-5 w-5 shrink-0" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Action buttons */}
        {!isLoading && !error && (
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard/social-media/accounts")}
              className="rounded-xl gap-2 px-5"
            >
              <ArrowLeft className="h-4 w-4" />
              Cancel
            </Button>

            <Button
              onClick={handleConnect}
              disabled={selected.size === 0 || isSaving}
              className="rounded-xl gap-2 px-8 font-bold shadow-md"
            >
              {isSaving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Connecting...</>
              ) : (
                <><Sparkles className="h-4 w-4" /> Connect {selected.size > 0 ? `${selected.size} ` : ""}Account{selected.size !== 1 ? "s" : ""}</>
              )}
            </Button>
          </div>
        )}

        {/* Security note */}
        <p className="text-center text-[11px] text-muted-foreground">
          🔒 Only selected accounts will be connected. Your credentials are securely encrypted and stored.
        </p>
      </div>
    </div>
  );
}

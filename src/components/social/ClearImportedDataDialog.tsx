import { useEffect, useMemo, useState } from "react";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";

// ─────────────────────────────────────────────────────────────────────────────
// Clear imported TikTok Studio data for one account.
//
// The importer only upserts, so a bad upload can't be fixed by uploading again
// — the wrong rows stay. This dialog removes them: a date window (preset or
// custom) plus which categories to touch, with a live count of exactly what
// will go so the user confirms numbers, not a vague "are you sure".
// ─────────────────────────────────────────────────────────────────────────────

type Preset = "7" | "30" | "90" | "all" | "custom";

interface Counts { daily: number; videos: number; demographics: number; activity: number }

interface Props {
  accountId: string | null;
  accountLabel?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after a successful clear so the page can refetch. */
  onCleared?: (deleted: Counts) => void;
}

const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDay(d);
};

const PRESETS: { id: Preset; label: string }[] = [
  { id: "7", label: "Last 7 days" },
  { id: "30", label: "Last 30 days" },
  { id: "90", label: "Last 90 days" },
  { id: "all", label: "Everything" },
  { id: "custom", label: "Custom range" },
];

export function ClearImportedDataDialog({ accountId, accountLabel, open, onOpenChange, onCleared }: Props) {
  const { toast } = useToast();
  const [preset, setPreset] = useState<Preset>("30");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [daily, setDaily] = useState(true);
  const [videos, setVideos] = useState(true);
  const [audience, setAudience] = useState(true);
  const [counts, setCounts] = useState<Counts | null>(null);
  const [counting, setCounting] = useState(false);
  const [clearing, setClearing] = useState(false);

  // Reset to a safe default every time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setPreset("30"); setFrom(""); setTo("");
    setDaily(true); setVideos(true); setAudience(true);
    setCounts(null);
  }, [open]);

  // The effective window. Presets end today; "all" has no bounds.
  const range = useMemo(() => {
    if (preset === "all") return { from: "", to: "" };
    if (preset === "custom") return { from, to };
    return { from: daysAgo(Number(preset) - 1), to: isoDay(new Date()) };
  }, [preset, from, to]);

  const ranged = range.from !== "" || range.to !== "";
  const invalidRange = preset === "custom" && (
    (!from && !to) || (!!from && !!to && from > to)
  );

  const query = useMemo(() => {
    const p = new URLSearchParams();
    if (range.from) p.set("from", range.from);
    if (range.to) p.set("to", range.to);
    if (!daily) p.set("daily", "0");
    if (!videos) p.set("videos", "0");
    if (!audience) p.set("audience", "0");
    const s = p.toString();
    return s ? `?${s}` : "";
  }, [range, daily, videos, audience]);

  // Live preview of what the delete would remove.
  useEffect(() => {
    if (!open || !accountId || invalidRange) { setCounts(null); return; }
    let cancelled = false;
    setCounting(true);
    apiFetch<{ counts: Counts }>(`/social/import/tiktok/${accountId}/data${query}`)
      .then(r => { if (!cancelled) setCounts(r.counts); })
      .catch(() => { if (!cancelled) setCounts(null); })
      .finally(() => { if (!cancelled) setCounting(false); });
    return () => { cancelled = true; };
  }, [open, accountId, query, invalidRange]);

  const total = counts ? counts.daily + counts.videos + counts.demographics + counts.activity : 0;
  const nothingSelected = !daily && !videos && !audience;

  const handleClear = async () => {
    if (!accountId) return;
    setClearing(true);
    try {
      const r = await apiFetch<{ deleted: Counts }>(`/social/import/tiktok/${accountId}/data${query}`, { method: "DELETE" });
      const d = r.deleted;
      toast({
        title: "Imported data cleared",
        description: `Removed ${d.daily} daily row(s), ${d.videos} video(s)` +
          (d.demographics + d.activity > 0 ? `, and audience data` : "") + ".",
      });
      onCleared?.(d);
      onOpenChange(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast({ title: "Clear failed", description: message, variant: "destructive" });
    } finally {
      setClearing(false);
    }
  };

  const windowText = !ranged
    ? "all time"
    : `${range.from || "the beginning"} → ${range.to || "today"}`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-4 w-4 text-destructive" />
            Clear imported data
          </DialogTitle>
          <DialogDescription>
            Remove TikTok Studio data{accountLabel ? ` for @${accountLabel}` : ""} so you can re-import a clean export.
            Only imported rows for this account are affected.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Window */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Timeline</Label>
            <div className="flex flex-wrap gap-1.5">
              {PRESETS.map(p => (
                <Button
                  key={p.id}
                  type="button"
                  size="sm"
                  variant={preset === p.id ? "default" : "outline"}
                  className="rounded-full h-8 px-3 text-xs"
                  onClick={() => setPreset(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
            {preset === "custom" && (
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="space-y-1">
                  <Label htmlFor="clear-from" className="text-xs">From</Label>
                  <Input id="clear-from" type="date" value={from} max={to || undefined} onChange={e => setFrom(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="clear-to" className="text-xs">To</Label>
                  <Input id="clear-to" type="date" value={to} min={from || undefined} onChange={e => setTo(e.target.value)} />
                </div>
                {invalidRange && (
                  <p className="col-span-2 text-xs text-destructive">
                    {from && to && from > to ? "\"From\" must be on or before \"To\"." : "Pick at least one date."}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Categories */}
          <div className="space-y-2">
            <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">What to remove</Label>
            <div className="space-y-2.5">
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <Checkbox checked={daily} onCheckedChange={v => setDaily(v === true)} className="mt-0.5" />
                <span>
                  Daily metrics
                  <span className="block text-xs text-muted-foreground">Followers, reach, video views, profile visits, engagement</span>
                </span>
              </label>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <Checkbox checked={videos} onCheckedChange={v => setVideos(v === true)} className="mt-0.5" />
                <span>
                  Imported videos
                  <span className="block text-xs text-muted-foreground">Per-video likes, comments, shares and views, by post date</span>
                </span>
              </label>
              <label className={`flex items-start gap-2.5 text-sm ${ranged ? "opacity-50" : "cursor-pointer"}`}>
                <Checkbox checked={audience && !ranged} disabled={ranged} onCheckedChange={v => setAudience(v === true)} className="mt-0.5" />
                <span>
                  Audience &amp; active times
                  <span className="block text-xs text-muted-foreground">
                    {ranged ? "Has no dates — only removed with \"Everything\"" : "Gender, territories and the active-followers heatmap"}
                  </span>
                </span>
              </label>
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {invalidRange || nothingSelected ? (
              <p className="text-muted-foreground text-xs">
                {nothingSelected ? "Select at least one category." : "Choose a valid date range to see what will be removed."}
              </p>
            ) : counting && !counts ? (
              <p className="flex items-center gap-2 text-muted-foreground text-xs"><Loader2 className="h-3.5 w-3.5 animate-spin" />Counting…</p>
            ) : counts ? (
              <div className="space-y-1">
                <p className="flex items-center gap-1.5 font-semibold text-destructive">
                  <AlertTriangle className="h-4 w-4" />
                  {total === 0 ? "Nothing to remove in this window" : `This will permanently delete ${total.toLocaleString()} row(s)`}
                </p>
                <p className="text-xs text-muted-foreground">
                  Window: {windowText}.
                  {daily && ` ${counts.daily.toLocaleString()} daily row(s)`}
                  {videos && `${daily ? "," : ""} ${counts.videos.toLocaleString()} video(s)`}
                  {audience && !ranged && `, ${counts.demographics} demographic + ${counts.activity} heatmap row(s)`}
                  {counting && " (updating…)"}
                </p>
              </div>
            ) : (
              <p className="text-muted-foreground text-xs">Could not load a preview.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={clearing}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            className="rounded-xl gap-2"
            onClick={handleClear}
            disabled={clearing || counting || invalidRange || nothingSelected || !counts || total === 0}
          >
            {clearing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            {clearing ? "Clearing…" : `Delete ${total > 0 ? total.toLocaleString() + " row(s)" : ""}`.trim()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

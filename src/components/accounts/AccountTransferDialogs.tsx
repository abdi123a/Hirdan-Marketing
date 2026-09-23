import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowRight, Banknote, Building2, Loader2, Smartphone } from "lucide-react";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/hooks/use-toast";
import { formatAccountAmount } from "@/lib/account-money";

export interface TransferAccount {
  id: string;
  name: string;
  type: "BANK" | "MOBILE_WALLET" | "CASH";
  currency: string;
  image: string | null;
}

function AccountOption({ acc }: { acc: TransferAccount }) {
  const AccIcon = acc.type === "BANK" ? Building2 : acc.type === "MOBILE_WALLET" ? Smartphone : Banknote;
  return (
    <div className="flex items-center gap-2">
      {acc.image ? (
        <img src={acc.image} alt={acc.name} className="h-5 w-5 rounded-full object-cover shrink-0" />
      ) : (
        <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
          <AccIcon className="h-3 w-3" />
        </div>
      )}
      <span>{acc.name}</span>
      <span className="text-[10px] text-muted-foreground">{acc.currency}</span>
    </div>
  );
}

const today = () => new Date().toISOString().split("T")[0];

/**
 * Move money between two accounts. When the currencies differ the server
 * requires `exchangeRate` (destination units per 1 source unit) and credits
 * the destination `amount × exchangeRate` in its own currency.
 */
export function AccountTransferDialog({
  accounts,
  onClose,
  onDone,
}: {
  accounts: TransferAccount[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { toast } = useToast();
  const [fromAccountId, setFromAccountId] = useState("");
  const [toAccountId, setToAccountId] = useState("");
  const [amount, setAmount] = useState("");
  // Keyed by currency pair: a rate typed for one pair means nothing for another.
  const [rateEntry, setRateEntry] = useState({ pair: "", value: "" });
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const from = accounts.find((a) => a.id === fromAccountId);
  const to = accounts.find((a) => a.id === toAccountId);
  const crossCurrency = !!from && !!to && from.currency !== to.currency;
  const pair = crossCurrency ? `${from!.currency}>${to!.currency}` : "";
  const exchangeRate = rateEntry.pair === pair ? rateEntry.value : "";
  const setExchangeRate = (value: string) => setRateEntry({ pair, value });
  const amountNum = parseFloat(amount);
  const rateNum = parseFloat(exchangeRate);
  const amountValid = Number.isFinite(amountNum) && amountNum > 0;
  const rateValid = Number.isFinite(rateNum) && rateNum > 0;

  const convertedCents = useMemo(() => {
    if (!crossCurrency || !amountValid || !rateValid) return null;
    // Same rounding as the server: round(amountCents × rate)
    return Math.round(Math.round(amountNum * 100) * rateNum);
  }, [crossCurrency, amountValid, rateValid, amountNum, rateNum]);

  const submit = async () => {
    if (!fromAccountId || !toAccountId) {
      toast({ title: "Please select both accounts", variant: "destructive" });
      return;
    }
    if (fromAccountId === toAccountId) {
      toast({ title: "Source and destination accounts must be different", variant: "destructive" });
      return;
    }
    if (!amountValid) {
      toast({ title: "Please enter a valid amount", variant: "destructive" });
      return;
    }
    if (crossCurrency && !rateValid) {
      toast({ title: `Enter the exchange rate (${to!.currency} per 1 ${from!.currency})`, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiFetch("/accounts/transfer", {
        method: "POST",
        body: JSON.stringify({
          fromAccountId,
          toAccountId,
          amount: amountNum,
          ...(crossCurrency ? { exchangeRate: rateNum } : {}),
          note,
          date: new Date(date).toISOString(),
        }),
      });
      toast({ title: "Transfer completed successfully!" });
      onDone();
    } catch (e) {
      toast({
        title: "Transfer failed",
        description: e instanceof Error && e.message ? e.message : undefined,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Transfer Money</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label>From Account</Label>
            <Select value={fromAccountId} onValueChange={setFromAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select source account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <AccountOption acc={acc} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>To Account</Label>
            <Select value={toAccountId} onValueChange={setToAccountId}>
              <SelectTrigger>
                <SelectValue placeholder="Select destination account" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((acc) => (
                  <SelectItem key={acc.id} value={acc.id}>
                    <AccountOption acc={acc} />
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="transferAmount">Amount{from ? ` (${from.currency})` : ""}</Label>
            <Input
              id="transferAmount"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          {crossCurrency && (
            <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/5 p-3">
              <Label htmlFor="transferRate">Exchange rate</Label>
              <div className="flex items-center gap-2 text-sm">
                <span className="whitespace-nowrap text-muted-foreground">1 {from!.currency} =</span>
                <Input
                  id="transferRate"
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0.0000"
                  value={exchangeRate}
                  onChange={(e) => setExchangeRate(e.target.value)}
                  className="h-8"
                />
                <span className="whitespace-nowrap text-muted-foreground">{to!.currency}</span>
              </div>
              <p className="text-xs text-muted-foreground">
                {convertedCents !== null ? (
                  <>
                    {formatAccountAmount(Math.round(amountNum * 100), from!.currency)}{" "}
                    <ArrowRight className="inline h-3 w-3" />{" "}
                    <span className="font-semibold text-foreground">
                      {formatAccountAmount(convertedCents, to!.currency)}
                    </span>{" "}
                    credited to {to!.name}
                  </>
                ) : (
                  "The accounts use different currencies — enter the rate you actually got."
                )}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label>Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Note / Purpose</Label>
            <Textarea placeholder="Reason for transfer..." value={note} onChange={(e) => setNote(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={saving || (crossCurrency && !rateValid)}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
            Transfer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface TransferRow {
  id: string;
  fromAccountId: string;
  toAccountId: string;
  amount: number; // cents, source currency
  toAmount: number | null; // cents, destination currency (null on old rows = amount)
  note: string | null;
  date: string;
  fromAccount: { id: string; name: string; currency?: string };
  toAccount: { id: string; name: string; currency?: string };
}

/** Transfers in/out of one account, with both sides shown for cross-currency moves. */
export function AccountTransfersDialog({
  account,
  openingBalance,
  onClose,
}: {
  account: TransferAccount;
  /** Cents in the account's currency. */
  openingBalance: number;
  onClose: () => void;
}) {
  const [transfers, setTransfers] = useState<TransferRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<{ transfers: TransferRow[] }>(`/accounts/${account.id}/transfers`)
      .then((res) => setTransfers(res.transfers))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load transfers"));
  }, [account.id]);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>{account.name} — transfers</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          Opening balance: <span className="font-semibold text-foreground">{formatAccountAmount(openingBalance, account.currency)}</span>
        </p>
        <div className="max-h-[60vh] overflow-y-auto divide-y divide-border/60 text-sm">
          {error ? (
            <p className="py-6 text-center text-destructive text-xs">{error}</p>
          ) : transfers === null ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : transfers.length === 0 ? (
            <p className="py-6 text-center text-muted-foreground text-xs">No transfers yet.</p>
          ) : (
            transfers.map((t) => {
              const outgoing = t.fromAccountId === account.id;
              const fromCur = t.fromAccount.currency ?? account.currency;
              const toCur = t.toAccount.currency ?? account.currency;
              const received = t.toAmount ?? t.amount;
              const converted = fromCur !== toCur || received !== t.amount;
              return (
                <div key={t.id} className="py-2.5 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium truncate">
                      {t.fromAccount.name} <ArrowRight className="inline h-3 w-3" /> {t.toAccount.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(t.date).toLocaleDateString()}
                      {t.note ? ` · ${t.note}` : ""}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`font-semibold ${outgoing ? "text-red-500" : "text-emerald-600"}`}>
                      {outgoing ? "−" : "+"}
                      {outgoing ? formatAccountAmount(t.amount, fromCur) : formatAccountAmount(received, toCur)}
                    </p>
                    {converted && (
                      <p className="text-[11px] text-muted-foreground">
                        {formatAccountAmount(t.amount, fromCur)} → {formatAccountAmount(received, toCur)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

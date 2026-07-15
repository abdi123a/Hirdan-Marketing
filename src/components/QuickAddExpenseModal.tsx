import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Wallet, Tag, Calendar, FileText, Check, X, Users, Image as ImageIcon, Building2, Smartphone, Banknote } from "lucide-react";
import { EXPENSE_CATEGORIES, centsToAmount } from "@/pages/ExpensesPage";
import { useAgencyStore } from "@/lib/store";

interface Account {
  id: string;
  name: string;
  type: "BANK" | "MOBILE_WALLET" | "CASH";
  currency: string;
  image?: string | null;
  balance: number;
}

interface Expense {
  id: string;
  accountId: string;
  amount: number;
  category: string;
  description: string;
  date: string;
  receiptUrl: string | null;
  notes: string | null;
  employeeId?: string | null;
}

interface QuickAddExpenseModalProps {
  accounts: Account[];
  expense?: Expense | null;
  prefill?: {
    amount?: number;
    description?: string;
    date?: string;
    category?: string;
    receiptUrl?: string;
    employeeId?: string;
    accountId?: string;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export function QuickAddExpenseModal({
  accounts,
  expense,
  prefill,
  onClose,
  onSaved,
}: QuickAddExpenseModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [accountId, setAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [notes, setNotes] = useState("");
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [employeeId, setEmployeeId] = useState("");
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  const { team, fetchTeam } = useAgencyStore();

  useEffect(() => {
    if (team.length === 0) {
      fetchTeam();
    }
  }, [team.length, fetchTeam]);

  // Prefill or Load editing data
  useEffect(() => {
    if (expense) {
      setAccountId(expense.accountId);
      setAmount(String(centsToAmount(expense.amount)));
      const isPresetCat = EXPENSE_CATEGORIES.some(c => c.value === expense.category);
      if (isPresetCat) {
        setCategory(expense.category);
        setIsCustomCategory(false);
      } else {
        setCategory(expense.category);
        setIsCustomCategory(true);
      }
      setDescription(expense.description);
      setDate(expense.date.split("T")[0]);
      setNotes(expense.notes || "");
      setReceiptUrl(expense.receiptUrl);
      setEmployeeId(expense.employeeId || "");
    } else if (prefill) {
      if (prefill.amount) setAmount(String(prefill.amount));
      if (prefill.description) setDescription(prefill.description);
      if (prefill.date) setDate(prefill.date);
      if (prefill.category) {
        const isPresetCat = EXPENSE_CATEGORIES.some(c => c.value === prefill.category);
        if (isPresetCat) {
          setCategory(prefill.category);
          setIsCustomCategory(false);
        } else {
          setCategory(prefill.category);
          setIsCustomCategory(true);
        }
      }
      if (prefill.receiptUrl) setReceiptUrl(prefill.receiptUrl);
      if (prefill.employeeId) setEmployeeId(prefill.employeeId);
      if (prefill.accountId) setAccountId(prefill.accountId);
    }
  }, [expense, prefill]);

  // Set default account if not selected and accounts list loads
  useEffect(() => {
    if (!accountId && accounts.length > 0) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountId) {
      toast({ title: "Account is required", variant: "destructive" });
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({ title: "Valid amount is required", variant: "destructive" });
      return;
    }
    if (!description.trim()) {
      toast({ title: "Description is required", variant: "destructive" });
      return;
    }
    if (!date) {
      toast({ title: "Date is required", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        accountId,
        employeeId: (employeeId && employeeId !== "none") ? employeeId : null,
        amount: parseFloat(amount),
        category: category.trim().toUpperCase(),
        description,
        date: new Date(date).toISOString(),
        notes,
        receiptUrl,
      };

      if (expense) {
        await apiFetch(`/expenses/${expense.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Expense updated successfully" });
      } else {
        await apiFetch("/expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Expense added successfully" });
      }
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast({
        title: expense ? "Failed to update expense" : "Failed to add expense",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{expense ? "Edit Expense" : "Quick Add Expense"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Account Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="account">Select Account</Label>
            <div className="relative">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full pl-9">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map((acc) => {
                    let AccIcon = Banknote;
                    if (acc.type === "BANK") AccIcon = Building2;
                    if (acc.type === "MOBILE_WALLET") AccIcon = Smartphone;
                    return (
                      <SelectItem key={acc.id} value={acc.id}>
                        <div className="flex items-center gap-2">
                          {acc.image ? (
                            <img src={acc.image} alt={acc.name} className="h-5 w-5 rounded-full object-cover shrink-0" />
                          ) : (
                            <div className="h-5 w-5 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
                              <AccIcon className="h-3 w-3" />
                            </div>
                          )}
                          <span>{acc.name} ({acc.type.replace("_", " ")})</span>
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Amount</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-semibold text-sm">
                $
              </span>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-7 text-lg font-semibold"
                required
              />
            </div>
          </div>

          {/* Category selection */}
          <div className="space-y-1.5">
            <Label htmlFor="category">Category</Label>
            <div className="relative">
              <Select
                value={isCustomCategory ? "CUSTOM" : category}
                onValueChange={(val) => {
                  if (val === "CUSTOM") {
                    setIsCustomCategory(true);
                    setCategory("");
                  } else {
                    setIsCustomCategory(false);
                    setCategory(val);
                  }
                }}
              >
                <SelectTrigger className="w-full pl-9">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Select Category" />
                </SelectTrigger>
                <SelectContent>
                  {EXPENSE_CATEGORIES.map((cat) => {
                    const CatIcon = cat.icon;
                    return (
                      <SelectItem key={cat.value} value={cat.value}>
                        <span className="flex items-center gap-2">
                          <CatIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span>{cat.label}</span>
                        </span>
                      </SelectItem>
                    );
                  })}
                  <SelectItem value="CUSTOM">➕ Add Custom Category...</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Custom Category Input */}
            {isCustomCategory && (
              <div className="space-y-1.5 mt-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <Label htmlFor="customCategoryName">Custom Category Name</Label>
                <Input
                  id="customCategoryName"
                  placeholder="E.g., Legal, Cleaning, Consultant..."
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  required
                />
              </div>
            )}
          </div>

          {/* Employee selection (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="employee">Associate with Employee (Optional)</Label>
            <div className="relative">
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger className="w-full pl-9">
                  <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="No employee associated" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No employee associated</SelectItem>
                  {team.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.name} ({m.role})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <div className="relative">
              <FileText className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="description"
                placeholder="E.g., AWS hosting, client lunch..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Date Picker */}
          <div className="space-y-1.5">
            <Label htmlFor="date">Date</Label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-9"
                required
              />
            </div>
          </div>

          {/* Notes (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Receipt Preview (if scanned or attached) */}
          {receiptUrl && (
            <div className="flex items-center justify-between border rounded-lg p-2 bg-muted/40">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                  Receipt Attached
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => setReceiptUrl(null)}
                className="h-6 w-6 text-muted-foreground hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : expense ? "Update Expense" : "Add Expense"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

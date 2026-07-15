import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Wallet, Tag, Calendar, FileText, Check, Building2, Smartphone, Banknote } from "lucide-react";
import { EXPENSE_CATEGORIES, centsToAmount } from "@/pages/ExpensesPage";

interface Account {
  id: string;
  name: string;
  type: "BANK" | "MOBILE_WALLET" | "CASH";
  currency: string;
  image?: string | null;
}

interface RecurringExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  accountId: string | null;
  description: string | null;
  isActive: boolean;
  dayOfMonth: number | null;
  startDate?: string;
  endDate?: string | null;
  frequency?: string;
}

interface RecurringExpenseModalProps {
  accounts: Account[];
  recurring?: RecurringExpense | null;
  onClose: () => void;
  onSaved: () => void;
}

export function RecurringExpenseModal({
  accounts,
  recurring,
  onClose,
  onSaved,
}: RecurringExpenseModalProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [category, setCategory] = useState("OTHER");
  const [amount, setAmount] = useState("");
  const [accountId, setAccountId] = useState("");
  const [description, setDescription] = useState("");
  const [dayOfMonth, setDayOfMonth] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurrenceLength, setRecurrenceLength] = useState("ongoing"); // "ongoing" | "limited"
  const [endDate, setEndDate] = useState("");
  const [frequency, setFrequency] = useState("MONTHLY");
  const [isCustomCategory, setIsCustomCategory] = useState(false);

  // Prefill or Load editing data
  useEffect(() => {
    if (recurring) {
      setName(recurring.name);
      const isPresetCat = EXPENSE_CATEGORIES.some(c => c.value === recurring.category);
      if (isPresetCat) {
        setCategory(recurring.category);
        setIsCustomCategory(false);
      } else {
        setCategory(recurring.category);
        setIsCustomCategory(true);
      }
      setAmount(String(centsToAmount(recurring.amount)));
      setAccountId(recurring.accountId || "none");
      setDescription(recurring.description || "");
      setDayOfMonth(recurring.dayOfMonth ? String(recurring.dayOfMonth) : "");
      setIsActive(recurring.isActive);
      setStartDate(recurring.startDate ? recurring.startDate.split("T")[0] : new Date().toISOString().split("T")[0]);
      setFrequency(recurring.frequency || "MONTHLY");
      if (recurring.endDate) {
        setRecurrenceLength("limited");
        setEndDate(recurring.endDate.split("T")[0]);
      } else {
        setRecurrenceLength("ongoing");
        setEndDate("");
      }
    } else {
      setName("");
      setCategory("OTHER");
      setIsCustomCategory(false);
      setAmount("");
      setAccountId(accounts[0]?.id || "none");
      setDescription("");
      setDayOfMonth("");
      setIsActive(true);
      setStartDate(new Date().toISOString().split("T")[0]);
      setRecurrenceLength("ongoing");
      setEndDate("");
      setFrequency("MONTHLY");
    }
  }, [recurring, accounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      toast({ title: "Valid amount is required", variant: "destructive" });
      return;
    }
    if (!category.trim()) {
      toast({ title: "Category is required", variant: "destructive" });
      return;
    }

    const dayNum = dayOfMonth ? parseInt(dayOfMonth) : null;
    if (frequency === "MONTHLY" && dayNum !== null && (isNaN(dayNum) || dayNum < 1 || dayNum > 31)) {
      toast({ title: "Day of month must be between 1 and 31", variant: "destructive" });
      return;
    }

    if (recurrenceLength === "limited" && !endDate) {
      toast({ title: "End date is required for limited recurrence", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const payload = {
        name,
        category: category.trim().toUpperCase(),
        amount: parseFloat(amount),
        accountId: accountId === "none" ? null : accountId,
        description: description || null,
        isActive,
        dayOfMonth: frequency === "MONTHLY" ? dayNum : null,
        startDate: new Date(startDate).toISOString(),
        endDate: recurrenceLength === "limited" && endDate ? new Date(endDate).toISOString() : null,
        frequency,
      };

      if (recurring) {
        await apiFetch(`/recurring-expenses/${recurring.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        toast({ title: "Recurring expense updated successfully" });
      } else {
        await apiFetch("/recurring-expenses", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        toast({ title: "Recurring expense added successfully" });
      }
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast({
        title: recurring ? "Failed to update recurring expense" : "Failed to add recurring expense",
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
          <DialogTitle>{recurring ? "Edit Recurring Expense" : "Add Recurring Expense Template"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Template Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Template Name (e.g. Office Rent, AWS hosting)</Label>
            <Input
              id="name"
              placeholder="E.g., Office Rent"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          {/* Amount input */}
          <div className="space-y-1.5">
            <Label htmlFor="amount">Recurring Amount</Label>
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

          {/* Account Selection */}
          <div className="space-y-1.5">
            <Label htmlFor="account">Payment Account (Optional)</Label>
            <div className="relative">
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger className="w-full pl-9">
                  <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <SelectValue placeholder="Choose an account" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No preferred account</SelectItem>
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

          {/* Recurrence Cycle / Frequency */}
          <div className="space-y-1.5">
            <Label htmlFor="frequency">Recurrence Interval</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger id="frequency">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DAILY">Daily</SelectItem>
                <SelectItem value="WEEKLY">Weekly</SelectItem>
                <SelectItem value="MONTHLY">Monthly</SelectItem>
                <SelectItem value="YEARLY">Yearly</SelectItem>
                <SelectItem value="ON_DEMAND">On Demand (Every time I need)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Day of Month (only for monthly) */}
          {frequency === "MONTHLY" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="dayOfMonth">Expected Day of Month (Optional, 1-31)</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="dayOfMonth"
                  type="number"
                  min="1"
                  max="31"
                  placeholder="E.g., 1 for the 1st of every month"
                  value={dayOfMonth}
                  onChange={(e) => setDayOfMonth(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          )}

          {/* Start Date & Duration */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="startDate">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="recurrenceLength">Duration</Label>
              <Select value={recurrenceLength} onValueChange={setRecurrenceLength}>
                <SelectTrigger id="recurrenceLength">
                  <SelectValue placeholder="Choose duration" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ongoing">Ongoing</SelectItem>
                  <SelectItem value="limited">Limited Time</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* End Date (if limited time) */}
          {recurrenceLength === "limited" && (
            <div className="space-y-1.5 animate-in fade-in slide-in-from-top-1 duration-200">
              <Label htmlFor="endDate">End Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  id="endDate"
                  type="date"
                  min={startDate}
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="pl-9"
                  required
                />
              </div>
            </div>
          )}

          {/* Description (Optional) */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description (Optional)</Label>
            <Textarea
              id="description"
              placeholder="Additional details..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>

          {/* Active status toggle */}
          <div className="flex items-center justify-between border rounded-lg p-3 bg-muted/20">
            <div className="space-y-0.5">
              <Label className="text-sm font-semibold">Active Template</Label>
              <p className="text-xs text-muted-foreground">
                Turn off to temporarily hide this template from monthly forecasts
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Saving..." : recurring ? "Update Template" : "Add Template"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

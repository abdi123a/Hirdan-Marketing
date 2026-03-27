import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Plus, Trash2, Receipt } from "lucide-react";
import { useAgencyStore, Invoice, InvoiceItem } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export default function EditInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, clients, updateInvoice, settings } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Invoice>>({});
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const invoice = invoices.find((i) => i.id === id);
    if (invoice) {
      setForm(invoice);
      setItems(invoice.items || [{ description: "", quantity: 1, unitPrice: 0 }]);
    } else {
      toast({ title: "Invoice not found", variant: "destructive" });
      navigate("/dashboard/invoices");
    }
  }, [id, invoices, navigate, toast]);

  const setField = <K extends keyof Invoice>(field: K, value: Invoice[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateItem = <K extends keyof InvoiceItem>(index: number, field: K, value: InvoiceItem[K]) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const subtotal = items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0);
  const tax = subtotal * ((form.taxRate ?? 0) / 100);
  const discount = form.discountType === 'percentage' 
    ? (subtotal * (form.discount || 0) / 100) 
    : (form.discount || 0);
  const total = subtotal + tax - discount;
  const balanceDue = total - (form.deposit || 0);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.client?.trim()) e.client = "Please select a client";
    if (items.some((i) => !i.description.trim())) e.items = "All line items must have a description";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !id) return;
    const totalStr = formatCurrency(total);
    try {
      await updateInvoice(id, { ...form, amount: totalStr, items });
      toast({ title: "Invoice updated!", description: `Invoice ${id} has been updated.` });
      navigate(`/dashboard/invoices/view/${id}`);
    } catch (e) {
      toast({ title: "Error", description: "Failed to update invoice.", variant: "destructive" });
    }
  };

  const handleDownloadPDF = async () => {
    if (!validate() || !id) return;
    const totalStr = formatCurrency(total);
    try {
      await updateInvoice(id, { ...form, amount: totalStr, items });
      toast({ title: "Changes Saved", description: "Navigating to printable invoice..." });
      navigate(`/dashboard/invoices/view/${id}`);
    } catch (e) {
      toast({ title: "Error", description: "Failed to save changes.", variant: "destructive" });
    }
  };

  if (!form.id) return null;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4 text-foreground">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Edit Invoice</h1>
            <p className="text-muted-foreground mt-0.5">Update invoice #{id}</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="hero" className="gap-2" onClick={handleSave}>
            <Save className="h-4 w-4" /> Save & View
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5 text-foreground">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Receipt className="h-4 w-4 text-primary" /> Invoice Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-primary/5 rounded-xl border border-primary/10">
                <span className="text-sm text-muted-foreground font-medium">Invoice Number</span>
                <span className="font-bold text-primary text-lg">{id}</span>
              </div>
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select
                  value={form.client}
                  onValueChange={(v) => {
                    const c = clients.find((cl) => cl.company === v || cl.name === v);
                    setForm((p) => ({ ...p, client: v, clientEmail: c?.email, clientAddress: c?.address }));
                  }}
                >
                  <SelectTrigger className={errors.client ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.company || c.name}>{c.company || c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.client && <p className="text-xs text-destructive">{errors.client}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-date">Invoice Date</Label>
                  <Input id="inv-date" type="date" value={form.date} onChange={(e) => setField("date", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-due">Due Date</Label>
                  <Input id="inv-due" type="date" value={form.dueDate} onChange={(e) => setField("dueDate", e.target.value)} />
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Status</Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setField("status", v as Invoice["status"])}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Paid">Paid</SelectItem>
                      <SelectItem value="Overdue">Overdue</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tax-rate">TVA Rate (%)</Label>
                  <Input id="tax-rate" type="number" min="0" max="100" placeholder="0" value={form.taxRate} onChange={(e) => setField("taxRate", parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Discount Type</Label>
                  <Select
                    value={form.discountType || "fixed"}
                    onValueChange={(v) => setField("discountType", v as 'percentage' | 'fixed')}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount</SelectItem>
                      <SelectItem value="percentage">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="discount">Discount {form.discountType === 'percentage' ? '(%)' : 'Value'}</Label>
                  <Input id="discount" type="number" min="0" placeholder="0" value={form.discount} onChange={(e) => setField("discount", parseFloat(e.target.value) || 0)} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="deposit">Deposit / Paid Amount</Label>
                  <Input id="deposit" type="number" min="0" placeholder="0" value={form.deposit} onChange={(e) => setField("deposit", parseFloat(e.target.value) || 0)} />
                </div>
                {form.status === "Paid" ? (
                  <div className="space-y-1.5">
                    <Label>How was it paid?</Label>
                    <Select
                      value={form.paymentMethod}
                      onValueChange={(v) => setField("paymentMethod", v)}
                    >
                      <SelectTrigger><SelectValue placeholder="Select payment method" /></SelectTrigger>
                      <SelectContent>
                        {settings.paymentMethods?.filter(m => m.isActive).map(m => (
                          <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="flex flex-col justify-end pb-1">
                    <p className="text-xs text-muted-foreground italic">Payment method only available for 'Paid' status</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border text-foreground">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-semibold">Line Items</CardTitle>
                <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5 h-8">
                  <Plus className="h-3.5 w-3.5" /> Add Item
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                <span className="col-span-6">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-1 text-right">Total</span>
                <span className="col-span-1" />
              </div>
              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <Input placeholder="Service description" value={item.description} onChange={(e) => updateItem(i, "description", e.target.value)} />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)} className="text-center" />
                  </div>
                  <div className="col-span-2">
                    <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} className="text-right" />
                  </div>
                  <div className="col-span-1 text-right text-sm font-medium text-foreground">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </div>
                  <div className="col-span-1 flex justify-end">
                    {items.length > 1 && (
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => removeItem(i)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}

              <div className="border-t border-border pt-3 mt-2 space-y-1.5">
                <div className="flex justify-between text-sm text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {(form.taxRate ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>TVA ({form.taxRate}%)</span>
                    <span className="font-medium text-foreground">{formatCurrency(tax)}</span>
                  </div>
                )}
                {(form.discount ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground">
                    <span>Discount {form.discountType === 'percentage' ? `(${form.discount}%)` : ''}</span>
                    <span className="font-medium text-destructive">-{formatCurrency(discount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-primary">{formatCurrency(total)}</span>
                </div>
                {(form.deposit ?? 0) > 0 && (
                  <div className="flex justify-between text-sm text-muted-foreground italic">
                    <span>Amount Paid (Deposit)</span>
                    <span className="font-medium text-emerald-600">-{formatCurrency(form.deposit || 0)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-foreground border-t border-border/50 pt-1">
                  <span>Balance Due</span>
                  <span className="text-primary">{formatCurrency(balanceDue)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border text-foreground">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Notes / Payment Terms</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="e.g. Thank you for your business! Payment due within 14 days." className="min-h-[80px] resize-none" value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5 text-foreground">
          <Card className="shadow-card border-border bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Invoice Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">Items</span>
                <span className="font-medium">{items.length}</span>
              </div>
              <div className="flex justify-between text-sm text-foreground">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {(form.taxRate ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-foreground">
                  <span className="text-muted-foreground">TVA</span>
                  <span className="font-medium text-foreground">{formatCurrency(tax)}</span>
                </div>
              )}
              {(form.discount ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-foreground">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="font-medium text-destructive">-{formatCurrency(discount)}</span>
                </div>
              )}
              <div className="border-t border-border/60 pt-2 flex justify-between">
                <span className="font-bold text-foreground">Total</span>
                <span className="font-bold text-xl text-primary">{formatCurrency(total)}</span>
              </div>
              {(form.deposit ?? 0) > 0 && (
                <div className="flex justify-between text-sm text-foreground italic">
                  <span className="text-muted-foreground">Paid</span>
                  <span className="font-medium text-emerald-600">-{formatCurrency(form.deposit || 0)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm text-foreground border-t border-border/40 pt-2">
                <span className="font-bold text-foreground">Balance Due</span>
                <span className="font-bold text-lg text-primary">{formatCurrency(balanceDue)}</span>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border bg-muted/30">
            <CardContent className="p-5 space-y-3">
              <Button onClick={handleSave} className="w-full gap-2" variant="hero">
                <Save className="h-4 w-4" /> Save & View Invoice
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

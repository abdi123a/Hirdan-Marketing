import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RichDescriptionEditor } from "@/components/RichDescriptionEditor";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Plus, Trash2, Receipt, Shield, Loader2, GripVertical, CreditCard } from "lucide-react";
import { useAgencyStore, Invoice, InvoiceItem } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency, parseCurrency } from "@/lib/utils";
import { ClientSelector } from "@/components/ClientSelector";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { DeliveryNoteEditor } from "@/components/DeliveryNoteEditor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FormPageSkeleton } from "@/components/ui/PageSkeleton";

export default function EditInvoicePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { invoices, clients, updateInvoice, settings, services, packages, fetchServices, fetchPackages, fetchInvoices, fetchClients } = useAgencyStore();
  const { toast } = useToast();
  const initialized = useRef(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetchServices(),
      fetchPackages(),
      fetchInvoices(),
      fetchClients()
    ]).finally(() => {
      setIsLoading(false);
    });
  }, [fetchServices, fetchPackages, fetchInvoices, fetchClients]);

  const [form, setForm] = useState<Partial<Invoice>>({});
  const [items, setItems] = useState<InvoiceItem[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [showPaymentPrompt, setShowPaymentPrompt] = useState(false);

  useEffect(() => {
    if (isLoading || initialized.current) return;

    const invoice = invoices.find((i) => i.id === id || i._dbId === id);
    if (invoice) {
      setForm(invoice);
      setItems(invoice.items && invoice.items.length > 0 ? invoice.items : [{ description: "", quantity: 1, unitPrice: 0 }]);
      initialized.current = true;
    }
  }, [id, invoices, isLoading]);

  const setField = <K extends keyof Invoice>(field: K, value: Invoice[K]) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateItem = <K extends keyof InvoiceItem>(index: number, field: K, value: InvoiceItem[K]) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const addItem = () => setItems((prev) => [...prev, { description: "", quantity: 1, unitPrice: 0 }]);
  const removeItem = (index: number) => setItems((prev) => prev.filter((_, i) => i !== index));

  const dragIndexRef = useRef<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = useCallback((index: number, e: React.DragEvent) => {
    dragIndexRef.current = index;
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDragOver = useCallback((index: number, e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(index);
  }, []);

  const handleDrop = useCallback((dropIndex: number, e: React.DragEvent) => {
    e.preventDefault();
    const dragIndex = dragIndexRef.current;
    if (dragIndex === null || dragIndex === dropIndex) {
      setDragOverIndex(null);
      return;
    }
    setItems((prev) => {
      const next = [...prev];
      const [removed] = next.splice(dragIndex, 1);
      next.splice(dropIndex, 0, removed);
      return next;
    });
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

  const handleDragEnd = useCallback(() => {
    dragIndexRef.current = null;
    setDragOverIndex(null);
  }, []);

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
    if (items.some((i) => {
      const text = (i.description || "").replace(/<[^>]*>?/gm, '').trim();
      return !text;
    })) e.items = "All line items must have a description";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !id) return;
    const totalStr = formatCurrency(total);
    try {
      let finalStatus = form.status;
      if ((form.deposit || 0) > 0 && (form.deposit || 0) < total) {
        finalStatus = 'Partially Paid';
      } else if ((form.deposit || 0) >= total) {
        finalStatus = 'Paid';
      }
      await updateInvoice(id, { ...form, status: finalStatus, amount: totalStr, items });
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

  if (isLoading) {
    return <FormPageSkeleton />;
  }

  if (!form.id) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <h2 className="text-2xl font-bold font-display text-foreground">Invoice not found</h2>
        <Button onClick={() => navigate("/dashboard/invoices")}>Back to Invoices</Button>
      </div>
    );
  }

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
                <ClientSelector
                  value={form.client || ""}
                  onValueChange={(v, client) => {
                    setForm((p) => ({ 
                      ...p, 
                      client: v, 
                      clientEmail: client?.email, 
                      clientAddress: client?.address 
                    }));
                  }}
                  error={errors.client}
                />
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
                    onValueChange={(v) => {
                      setField("status", v as Invoice["status"]);
                      if (v === "Paid") {
                        setShowPaymentPrompt(true);
                      }
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Partially Paid">Partially Paid</SelectItem>
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
                          <SelectItem key={m.id} value={m.name}>
                            <div className="flex items-center gap-2">
                              {m.image ? (
                                <img src={m.image} alt={m.name} className="h-5 w-5 rounded-full object-cover shrink-0" />
                              ) : (
                                <div className={`h-5 w-5 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold ${
                                  m.type === 'stripe' ? 'bg-indigo-100 text-indigo-700' :
                                  m.type === 'paypal' ? 'bg-blue-100 text-blue-700' :
                                  m.type === 'bank' ? 'bg-emerald-100 text-emerald-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {m.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span>{m.name}</span>
                            </div>
                          </SelectItem>
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
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button size="sm" variant="outline" className="gap-1.5 h-8">
                        <Plus className="h-3.5 w-3.5" /> Add from Inventory
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuLabel>Add Service</DropdownMenuLabel>
                      {services.map(s => (
                        <DropdownMenuItem key={s.id} onClick={() => {
                          setItems(prev => [...prev, { description: s.name, quantity: 1, unitPrice: parseCurrency(s.basePrice) }]);
                        }}>
                          {s.name} ({s.basePrice})
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuLabel>Add Package</DropdownMenuLabel>
                      {packages.map(p => (
                        <DropdownMenuItem key={p.id} onClick={() => {
                          setItems(prev => [...prev, { description: p.name, quantity: 1, unitPrice: parseCurrency(p.price) }]);
                        }}>
                          {p.name} ({p.price})
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button size="sm" variant="outline" onClick={addItem} className="gap-1.5 h-8">
                    <Plus className="h-3.5 w-3.5" /> Custom Item
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {errors.items && <p className="text-xs text-destructive">{errors.items}</p>}
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide px-1">
                <span className="col-span-1" />
                <span className="col-span-4">Description</span>
                <span className="col-span-2 text-center">Qty</span>
                <span className="col-span-2 text-right">Unit Price</span>
                <span className="col-span-2 text-right">Total</span>
                <span className="col-span-1 text-right" />
              </div>
              {items.map((item, i) => (
                <div
                  key={i}
                  className={`grid grid-cols-12 gap-2 items-start rounded-lg transition-all p-1 hover:bg-muted/40 ${
                    dragOverIndex === i ? "bg-primary/10 ring-2 ring-primary/40 scale-[1.01]" : ""
                  }`}
                  draggable
                  onDragStart={(e) => handleDragStart(i, e)}
                  onDragOver={(e) => handleDragOver(i, e)}
                  onDrop={(e) => handleDrop(i, e)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="col-span-1 flex justify-center pt-2">
                    <span
                      className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors touch-none"
                      title="Drag to reorder"
                    >
                      <GripVertical className="h-4 w-4" />
                    </span>
                  </div>
                  <div className="col-span-4">
                     <RichDescriptionEditor
                       value={item.description}
                       onChange={(html) => updateItem(i, "description", html)}
                       placeholder="Service description"
                     />
                   </div>
                  <div className="col-span-2 pt-1">
                    <Input type="number" min="1" value={item.quantity} onChange={(e) => updateItem(i, "quantity", parseInt(e.target.value) || 1)} className="text-center" />
                  </div>
                  <div className="col-span-2 pt-1">
                    <Input type="number" min="0" step="0.01" value={item.unitPrice} onChange={(e) => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)} className="text-right" />
                  </div>
                  <div className="col-span-2 text-right text-sm font-medium text-foreground">
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

          <DeliveryNoteEditor
            enabled={form.deliveryNoteEnabled ?? false}
            title={form.deliveryNoteTitle ?? "Delivery Terms"}
            content={form.deliveryNoteContent ?? ""}
            onEnabledChange={(v) => setField("deliveryNoteEnabled", v)}
            onTitleChange={(v) => setField("deliveryNoteTitle", v)}
            onContentChange={(v) => setField("deliveryNoteContent", v)}
          />

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

          <Card className="shadow-card border-border">
            <CardHeader className="pb-3 px-5">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" /> Document Seals
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5 space-y-4">
              <div className="flex items-center justify-between group p-2 hover:bg-muted/50 rounded-lg transition-all">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold cursor-pointer" htmlFor="show-signature">Authorized Signature</Label>
                  <p className="text-[10px] text-muted-foreground">Show signature at the bottom</p>
                </div>
                <Switch 
                  id="show-signature" 
                  checked={form.showSignature ?? true} 
                  onCheckedChange={(val) => setField("showSignature", val)} 
                />
              </div>
              <div className="flex items-center justify-between group p-2 hover:bg-muted/50 rounded-lg transition-all">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold cursor-pointer" htmlFor="show-stamp">Company Stamp</Label>
                  <p className="text-[10px] text-muted-foreground">Show stamp on the document</p>
                </div>
                <Switch 
                  id="show-stamp" 
                  checked={form.showStamp ?? true} 
                  onCheckedChange={(val) => setField("showStamp", val)} 
                />
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

      <Dialog open={showPaymentPrompt} onOpenChange={setShowPaymentPrompt}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" /> Select Payment Method
            </DialogTitle>
            <DialogDescription>
              This invoice is marked as paid. Please select which payment gateway or account was used.
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-2.5 py-4">
            {settings.paymentMethods?.filter(m => m.isActive).map((method) => (
              <button
                key={method.id}
                type="button"
                onClick={() => {
                  setField("paymentMethod", method.name);
                  setShowPaymentPrompt(false);
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-left hover:bg-muted/50 hover:border-primary/50 transition-all ${
                  form.paymentMethod === method.name ? 'border-primary bg-primary/5' : 'border-border'
                }`}
              >
                <div className="flex items-center gap-3">
                  {method.image ? (
                    <img src={method.image} alt={method.name} className="h-8 w-8 rounded-full object-cover shrink-0" />
                  ) : (
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 text-xs font-bold ${
                      method.type === 'stripe' ? 'bg-indigo-100 text-indigo-700' :
                      method.type === 'paypal' ? 'bg-blue-100 text-blue-700' :
                      method.type === 'bank' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-slate-100 text-slate-700'
                    }`}>
                      {method.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <p className="text-sm font-bold text-foreground">{method.name}</p>
                    <p className="text-xs text-muted-foreground capitalize">{method.type}</p>
                  </div>
                </div>
                {form.paymentMethod === method.name && (
                  <Badge variant="hero" className="text-[10px] px-2 py-0.5">Selected</Badge>
                )}
              </button>
            ))}
            {(!settings.paymentMethods || settings.paymentMethods.filter(m => m.isActive).length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">No active payment methods configured in Settings.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentPrompt(false)}>
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

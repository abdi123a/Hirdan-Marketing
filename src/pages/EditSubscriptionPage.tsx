import { useState, useEffect, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Save, RefreshCw, Banknote, Calendar, Users, FileText, Plus, X, Package as PackageIcon, ShieldCheck } from "lucide-react";
import { useAgencyStore, Subscription } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { formatCurrency } from "@/lib/utils";

export default function EditSubscriptionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { subscriptions, clients, packages, services, updateSubscription, settings } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Subscription>>({});
  const [featureInput, setFeatureInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const subscriptionOptions = useMemo(() => {
    const opts: any[] = [];
    
    // Add Packages that are explicitly marked as Subscription
    packages.filter(p => p.type === 'Subscription').forEach(pkg => {
      opts.push({
        id: pkg.id,
        type: 'package',
        name: pkg.name,
        price: pkg.price.replace(/[^0-9.]/g, ''),
        displayPrice: pkg.price,
        description: pkg.description,
        features: pkg.features,
        tag: 'Package Bundle'
      });
    });

    // Add Services that look like subscriptions (recurring pricing)
    services.filter(svc => 
      svc.basePrice.toLowerCase().includes('/mo') || 
      svc.basePrice.toLowerCase().includes('/month') || 
      svc.basePrice.toLowerCase().includes('/yr') ||
      svc.basePrice.toLowerCase().includes('/year')
    ).forEach(svc => {
      opts.push({
        id: svc.id,
        type: 'service',
        name: svc.name,
        price: svc.basePrice.replace(/[^0-9.]/g, ''),
        displayPrice: svc.basePrice,
        description: svc.description,
        features: [],
        tag: svc.category
      });
    });

    return opts;
  }, [packages, services]);

  useEffect(() => {
    const subscription = subscriptions.find((s) => s.id === id);
    if (subscription) {
      setForm(subscription);
    } else {
      toast({ title: "Subscription not found", variant: "destructive" });
      navigate("/dashboard/subscriptions");
    }
  }, [id, subscriptions, navigate, toast]);

  const setField = (field: keyof Subscription, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const selectOption = (opt: any) => {
    setForm((prev) => ({ 
      ...prev, 
      plan: opt.name, 
      packageId: opt.type === 'package' ? opt.id : undefined,
      serviceId: opt.type === 'service' ? opt.id : undefined,
      amount: opt.price,
      // Only overwrite features if they are empty or user wants to sync
      features: prev.features?.length ? prev.features : [...(opt.features || [])]
    }));
  };

  const addFeature = () => {
    if (featureInput.trim()) {
      setField("features", [...(form.features || []), featureInput.trim()]);
      setFeatureInput("");
    }
  };

  const removeFeature = (f: string) => {
    setField("features", (form.features || []).filter((x) => x !== f));
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.client?.trim()) e.client = "Please select a client";
    if (!form.plan) e.plan = "Please select a plan";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updateSubscription(id, form);
      toast({ title: "Subscription updated!", description: `${form.plan} plan for ${form.client} has been updated.` });
      navigate("/dashboard/subscriptions");
    } catch (e) {
      toast({ title: "Error", description: "Failed to update subscription.", variant: "destructive" });
    }
  };

  if (!form.id) return null;

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Edit Subscription</h1>
          <p className="text-muted-foreground mt-0.5">Update recurring plan for {form.client}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          {/* Plan Selection */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <RefreshCw className="h-4 w-4 text-primary" /> Select Offering
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                {subscriptionOptions.map((opt) => (
                  <button
                    key={`${opt.type}-${opt.id}`}
                    onClick={() => selectOption(opt)}
                    className={`p-4 rounded-xl border-2 text-left transition-all relative overflow-hidden group ${
                      (opt.type === 'package' ? form.packageId === opt.id : form.serviceId === opt.id)
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-primary/40 hover:bg-muted/50"
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {opt.type === 'package' ? <PackageIcon className="h-3.5 w-3.5 text-primary" /> : <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />}
                        <span className="font-semibold text-sm leading-tight">{opt.name}</span>
                      </div>
                      <Badge variant="secondary" className="text-[9px] h-4 uppercase font-bold tracking-tighter opacity-70">
                        {opt.tag}
                      </Badge>
                    </div>
                    <div className="flex items-baseline gap-1 mb-2">
                      <span className="text-primary font-bold text-lg">{formatCurrency(opt.price).split('/')[0]}</span>
                      <span className="text-[10px] text-muted-foreground font-medium">/{opt.displayPrice.split('/')[1] || 'mo'}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">{opt.description}</p>
                    
                    {(opt.type === 'package' ? form.packageId === opt.id : form.serviceId === opt.id) && (
                      <div className="absolute top-0 right-0 w-8 h-8 flex items-center justify-center translate-x-3 -translate-y-3 rotate-45 bg-primary">
                        <CheckCircleIcon className="h-3 w-3 text-white -rotate-45 -translate-x-1 translate-y-1" />
                      </div>
                    )}
                  </button>
                ))}
              </div>

              <div className="grid sm:grid-cols-2 gap-4 pt-2">
                <div className="space-y-1.5">
                  <Label htmlFor="custom-amount">Monthly Amount (override)</Label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm font-bold">{settings.currency}</div>
                    <Input 
                      id="custom-amount" 
                      placeholder="499" 
                      className="pl-12" 
                      value={form.amount?.toString().replace(/[^0-9.]/g, '')} 
                      onChange={(e) => setField("amount", e.target.value)} 
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label>Billing Cycle</Label>
                  <Select value={form.billingCycle} onValueChange={(v: any) => setField("billingCycle", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Monthly">Monthly</SelectItem>
                      <SelectItem value="Quarterly">Quarterly</SelectItem>
                      <SelectItem value="Annual">Annual</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Client Assignment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select
                  value={form.client}
                  onValueChange={(v) => {
                    const c = clients.find((cl) => cl.company === v || cl.name === v);
                    setForm((p) => ({ ...p, client: v, clientEmail: c?.email }));
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
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Subscription Dates
              </CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="sub-start">Start Date</Label>
                <Input id="sub-start" type="date" value={form.started} onChange={(e) => setField("started", e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="sub-renewal">Renewal Date</Label>
                <Input id="sub-renewal" type="date" value={form.renewal} onChange={(e) => setField("renewal", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Included Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="e.g. SEO Monitoring" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} />
                <Button type="button" variant="outline" onClick={addFeature} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              {form.features && form.features.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.features.map((f) => (
                    <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 text-sm font-medium border border-emerald-100">
                      {f}
                      <button onClick={() => removeFeature(f)} className="hover:opacity-70">
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea placeholder="Any additional notes about this subscription..." className="min-h-[80px] resize-none" value={form.notes || ""} onChange={(e) => setField("notes", e.target.value)} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.status} onValueChange={(v: any) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Trial">Trial</SelectItem>
                  <SelectItem value="Paused">Paused</SelectItem>
                  <SelectItem value="Cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border bg-muted/30">
            <CardContent className="p-5 space-y-3">
              <Button onClick={handleSubmit} className="w-full gap-2" variant="hero">
                <Save className="h-4 w-4" /> Save Changes
              </Button>
              <Button variant="outline" className="w-full" onClick={() => navigate(-1)}>
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function CheckCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  );
}

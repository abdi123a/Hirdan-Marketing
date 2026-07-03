import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Package, Plus, X, Layers, Trash2, CheckCircle2, Share2 } from "lucide-react";
import { useAgencyStore, Package as PackageType, PackageDeliverable } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const PLATFORMS = [
  'INSTAGRAM', 'FACEBOOK', 'TIKTOK', 'LINKEDIN',
  'X', 'SNAPCHAT', 'YOUTUBE', 'PINTEREST', 'OTHER',
] as const;

const DELIVERABLE_TYPES = [
  'POST', 'STORY', 'REEL', 'SHORT', 'VIDEO', 'REPORT', 'OTHER',
] as const;

export default function AddPackagePage() {
  const navigate = useNavigate();
  const { addPackage, services } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<PackageType>>({
    name: "",
    description: "",
    price: "",
    type: "Service",
    features: [],
    serviceIds: [],
    deliverables: [],
  });

  const [featureInput, setFeatureInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (field: keyof PackageType, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const addFeature = () => {
    if (featureInput.trim()) {
      setField("features", [...(form.features || []), featureInput.trim()]);
      setFeatureInput("");
    }
  };

  const removeFeature = (f: string) => {
    setField("features", (form.features || []).filter((x) => x !== f));
  };

  const addDeliverable = () => {
    const newDeliverable: PackageDeliverable = {
      name: "New Deliverable",
      type: "POST",
      quantity: 1,
      platforms: ["INSTAGRAM"],
    };
    setField("deliverables", [...(form.deliverables || []), newDeliverable]);
  };

  const removeDeliverable = (index: number) => {
    const next = [...(form.deliverables || [])];
    next.splice(index, 1);
    setField("deliverables", next);
  };

  const updateDeliverable = (index: number, updates: Partial<PackageDeliverable>) => {
    const next = [...(form.deliverables || [])];
    next[index] = { ...next[index], ...updates };
    setField("deliverables", next);
  };

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Package name is required";
    if (!form.price?.trim()) e.price = "Price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await addPackage(form as Omit<PackageType, "id">);
      toast({ title: "Package created!", description: `${form.name} has been added to your offerings.` });
      navigate("/dashboard/packages");
    } catch (e) {
      toast({ title: "Error", description: "Failed to create package.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Create Package</h1>
          <p className="text-muted-foreground mt-0.5">Define a new service bundle or subscription plan</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Package className="h-4 w-4 text-primary" /> Package Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="pkg-name">Package Name <span className="text-destructive">*</span></Label>
                <Input id="pkg-name" placeholder="e.g. SEO Professional" value={form.name} onChange={(e) => setField("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="pkg-price">Price (Display) <span className="text-destructive">*</span></Label>
                  <Input id="pkg-price" placeholder="e.g. $499/mo" value={form.price} onChange={(e) => setField("price", e.target.value)} className={errors.price ? "border-destructive" : ""} />
                  {errors.price && <p className="text-xs text-destructive">{errors.price}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v: any) => setField("type", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Service">Service Bundle</SelectItem>
                      <SelectItem value="Subscription">Subscription Plan</SelectItem>
                      <SelectItem value="One-time">One-time Offer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pkg-desc">Description</Label>
                <Textarea id="pkg-desc" placeholder="Briefly describe what's included in this package..." className="min-h-[80px] resize-none" value={form.description} onChange={(e) => setField("description", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Layers className="h-4 w-4 text-primary" /> Included Services
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                {services.map((service) => (
                  <label
                    key={service.id}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all cursor-pointer ${
                      form.serviceIds?.includes(service.id)
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:bg-muted/50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                      checked={form.serviceIds?.includes(service.id)}
                      onChange={(e) => {
                        const current = form.serviceIds || [];
                        if (e.target.checked) {
                          setField("serviceIds", [...current, service.id]);
                        } else {
                          setField("serviceIds", current.filter((id) => id !== service.id));
                        }
                      }}
                    />
                    <div>
                      <p className="text-sm font-medium">{service.name}</p>
                      <p className="text-xs text-muted-foreground">{service.basePrice}</p>
                    </div>
                  </label>
                ))}
              </div>
              {services.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-xl border border-dashed">
                  No services available. Create services first to link them to packages.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Deliverable Templates Section */}
          <Card className="shadow-card border-border border-t-4 border-t-amber-500/20">
            <CardHeader className="pb-4 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Share2 className="h-4 w-4 text-amber-500" /> Deliverable Templates
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">Define recurring social media outputs for this package.</p>
              </div>
              <Button type="button" size="sm" variant="outline" onClick={addDeliverable} className="h-8 gap-1 text-[10px] font-bold uppercase tracking-wider">
                <Plus className="h-3 w-3" /> Add Template
              </Button>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.deliverables?.map((del, idx) => (
                <div key={idx} className="p-4 rounded-xl border border-border/50 bg-muted/5 relative group animate-in fade-in slide-in-from-top-2 duration-300">
                  <button 
                    onClick={() => removeDeliverable(idx)}
                    className="absolute top-2 right-2 p-1.5 rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>

                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-[10px] font-bold uppercase tracking-widest">Deliverable Name</Label>
                      <Input 
                        placeholder="e.g. Weekly Instagram Reel" 
                        value={del.name} 
                        onChange={(e) => updateDeliverable(idx, { name: e.target.value })}
                        className="h-8 text-xs font-semibold"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest">Type</Label>
                        <Select value={del.type} onValueChange={(v: any) => updateDeliverable(idx, { type: v })}>
                          <SelectTrigger className="h-8 text-xs font-semibold"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DELIVERABLE_TYPES.map(t => <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-[10px] font-bold uppercase tracking-widest">Quantity / Mo</Label>
                        <Input 
                          type="number" 
                          min={1} 
                          value={del.quantity} 
                          onChange={(e) => updateDeliverable(idx, { quantity: parseInt(e.target.value) || 1 })}
                          className="h-8 text-xs font-semibold"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Label className="text-[10px] font-bold uppercase tracking-widest">Target Platforms</Label>
                    <div className="flex flex-wrap gap-x-4 gap-y-2 p-3 rounded-lg bg-background border border-border/40">
                      {PLATFORMS.map((platform) => (
                        <label key={platform} className="flex items-center gap-2 cursor-pointer group/label">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                            checked={del.platforms.includes(platform)}
                            onChange={(e) => {
                              const current = del.platforms || [];
                              if (e.target.checked) {
                                updateDeliverable(idx, { platforms: [...current, platform] });
                              } else {
                                updateDeliverable(idx, { platforms: current.filter(p => p !== platform) });
                              }
                            }}
                          />
                          <span className={`text-[10px] font-bold tracking-tight transition-colors ${del.platforms.includes(platform) ? "text-primary" : "text-muted-foreground group-hover/label:text-foreground"}`}>
                            {platform}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              ))}

              {(!form.deliverables || form.deliverables.length === 0) && (
                <div className="py-8 text-center border border-dashed rounded-xl bg-muted/20">
                  <Share2 className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground font-medium">No standardized deliverables defined yet.</p>
                  <Button type="button" variant="link" size="sm" onClick={addDeliverable} className="text-[10px] font-bold uppercase tracking-wider h-6 mt-1">
                    Add first template
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Included Features</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="e.g. 10 Keywords Tracking" value={featureInput} onChange={(e) => setFeatureInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addFeature())} />
                <Button type="button" variant="outline" onClick={addFeature} className="gap-1.5">
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
              <div className="flex flex-wrap gap-2">
                {form.features?.map((f) => (
                  <span key={f} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/5 text-primary text-sm font-medium border border-primary/10">
                    {f}
                    <button onClick={() => removeFeature(f)} className="hover:opacity-70 transition-opacity">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-card border-border bg-muted/30">
            <CardContent className="p-5 space-y-3">
              <Button onClick={handleSubmit} className="w-full gap-2" variant="hero">
                <Save className="h-4 w-4" /> Save Package
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

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Package, Plus, X, Layers } from "lucide-react";
import { useAgencyStore, Package as PackageType } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

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

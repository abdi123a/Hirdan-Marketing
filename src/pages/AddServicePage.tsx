import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Zap } from "lucide-react";
import { useAgencyStore, Service } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

export default function AddServicePage() {
  const navigate = useNavigate();
  const { addService } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Service>>({
    name: "",
    category: "",
    basePrice: "",
    description: "",
    status: "Available",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const setField = (field: keyof Service, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Service name is required";
    if (!form.category?.trim()) e.category = "Category is required";
    if (!form.basePrice?.trim()) e.basePrice = "Base price is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    try {
      await addService(form as Omit<Service, "id">);
      toast({ title: "Service added!", description: `${form.name} is now available in your service list.` });
      navigate("/dashboard/services");
    } catch (e) {
      toast({ title: "Error", description: "Failed to create service.", variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Add Service</h1>
          <p className="text-muted-foreground mt-0.5">Configure a new individual agency service offering</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" /> Service Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="svc-name">Service Name <span className="text-destructive">*</span></Label>
                <Input id="svc-name" placeholder="e.g. UI/UX Audit" value={form.name} onChange={(e) => setField("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="svc-category">Category <span className="text-destructive">*</span></Label>
                  <Input id="svc-category" placeholder="e.g. Design" value={form.category} onChange={(e) => setField("category", e.target.value)} className={errors.category ? "border-destructive" : ""} />
                  {errors.category && <p className="text-xs text-destructive">{errors.category}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="svc-price">Base Price <span className="text-destructive">*</span></Label>
                  <Input id="svc-price" placeholder="e.g. $100/hr or $1,500" value={form.basePrice} onChange={(e) => setField("basePrice", e.target.value)} className={errors.basePrice ? "border-destructive" : ""} />
                  {errors.basePrice && <p className="text-xs text-destructive">{errors.basePrice}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="svc-desc">Description</Label>
                <Textarea id="svc-desc" placeholder="Detailed description of what this service entails..." className="min-h-[120px] resize-none" value={form.description} onChange={(e) => setField("description", e.target.value)} />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Availability</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.status} onValueChange={(v: any) => setField("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Available">Available</SelectItem>
                  <SelectItem value="Unavailable">Unavailable</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border bg-muted/30">
            <CardContent className="p-5 space-y-3">
              <Button onClick={handleSubmit} className="w-full gap-2" variant="hero">
                <Save className="h-4 w-4" /> Save Service
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

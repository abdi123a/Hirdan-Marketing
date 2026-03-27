import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ArrowLeft, Save, User, Building2, Mail, Phone, Globe, MapPin, Briefcase, FileText } from "lucide-react";
import { useAgencyStore, Client } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

export default function AddClientPage() {
  const navigate = useNavigate();
  const { addClient } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Client>>({
    name: "",
    company: "",
    email: "",
    phone: "",
    website: "",
    address: "",
    city: "",
    country: "",
    industry: "",
    status: "Active",
    revenue: "$0",
    projects: 0,
    notes: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (field: keyof Client, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Contact name is required";
    if (!form.company?.trim()) e.company = "Company name is required";
    if (!form.email?.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = "Invalid email address";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const initials = form.name!.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
    await addClient({ ...form as Omit<Client, "id">, initials });
    toast({ title: "Client added!", description: `${form.name} has been added to your clients.` });
    navigate("/dashboard/clients");
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-10 w-10 hover:bg-muted">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Add New Client</h1>
          <p className="text-muted-foreground mt-0.5">Fill in the details to add a new client to your agency</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Form */}
        <div className="lg:col-span-2 space-y-5">
          {/* Contact Info */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-sm font-medium">Contact Name <span className="text-destructive">*</span></Label>
                  <Input id="name" placeholder="Jane Smith" value={form.name} onChange={(e) => set("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                  {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="company" className="text-sm font-medium">Company Name <span className="text-destructive">*</span></Label>
                  <Input id="company" placeholder="Acme Corporation" value={form.company} onChange={(e) => set("company", e.target.value)} className={errors.company ? "border-destructive" : ""} />
                  {errors.company && <p className="text-xs text-destructive">{errors.company}</p>}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-sm font-medium">Email Address <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="email" type="email" placeholder="jane@acme.com" className={`pl-9 ${errors.email ? "border-destructive" : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-medium">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="phone" type="tel" placeholder="+1 555-0000" className="pl-9" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="website" className="text-sm font-medium">Website</Label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="website" placeholder="https://acme.com" className="pl-9" value={form.website} onChange={(e) => set("website", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry" className="text-sm font-medium">Industry</Label>
                  <div className="relative">
                    <Briefcase className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input id="industry" placeholder="e.g. Technology, Finance" className="pl-9" value={form.industry} onChange={(e) => set("industry", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Address */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" /> Address
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm font-medium">Street Address</Label>
                <Input id="address" placeholder="123 Business Ave, Suite 100" value={form.address} onChange={(e) => set("address", e.target.value)} />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="city" className="text-sm font-medium">City</Label>
                  <Input id="city" placeholder="San Francisco" value={form.city} onChange={(e) => set("city", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="country" className="text-sm font-medium">Country</Label>
                  <Input id="country" placeholder="United States" value={form.country} onChange={(e) => set("country", e.target.value)} />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notes */}
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="notes"
                placeholder="Any additional notes about this client..."
                className="min-h-[100px] resize-none"
                value={form.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Client Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-sm font-medium">Status</Label>
                <Select value={form.status} onValueChange={(v) => set("status", v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Active">Active</SelectItem>
                    <SelectItem value="Paused">Paused</SelectItem>
                    <SelectItem value="Churned">Churned</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="revenue" className="text-sm font-medium">Estimated Revenue</Label>
                <Input id="revenue" placeholder="$5,000" value={form.revenue} onChange={(e) => set("revenue", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border bg-muted/30">
            <CardContent className="p-5 space-y-3">
              <Button onClick={handleSubmit} className="w-full gap-2" variant="hero">
                <Save className="h-4 w-4" /> Save Client
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

import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, User, Mail, Phone, Briefcase, DollarSign, Calendar, FileText } from "lucide-react";
import { useAgencyStore, TeamMember } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";

const DEPARTMENTS = ["Leadership", "Creative", "Marketing", "Development", "Operations", "Sales", "Finance", "Support"];

export default function EditTeamMemberPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { team, updateTeamMember } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<TeamMember>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const member = team.find((m) => m.id === id);
    if (member) {
      setForm(member);
    } else {
      toast({ title: "Team member not found", variant: "destructive" });
      navigate("/dashboard/team");
    }
  }, [id, team, navigate, toast]);

  const set = (field: keyof TeamMember, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Full name is required";
    if (!form.email?.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(form.email || "")) e.email = "Invalid email address";
    if (!form.role?.trim()) e.role = "Job title / role is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updateTeamMember(id, form);
      toast({ title: "Team member updated!", description: `${form.name} has been updated.` });
      navigate("/dashboard/team");
    } catch (e) {
      toast({ title: "Error", description: "Failed to update team member.", variant: "destructive" });
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Edit Team Member</h1>
          <p className="text-muted-foreground mt-0.5">Update details for {form.name}</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Personal Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="mem-name">Full Name <span className="text-destructive">*</span></Label>
                <Input id="mem-name" placeholder="John Doe" value={form.name} onChange={(e) => set("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mem-email">Email Address <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="mem-email" type="email" placeholder="john@agencyflow.com" className={`pl-9 ${errors.email ? "border-destructive" : ""}`} value={form.email} onChange={(e) => set("email", e.target.value)} />
                  </div>
                  {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mem-phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="mem-phone" type="tel" placeholder="+1 555-0000" className="pl-9" value={form.phone || ""} onChange={(e) => set("phone", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Briefcase className="h-4 w-4 text-primary" /> Role & Department
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="mem-role">Job Title / Role <span className="text-destructive">*</span></Label>
                  <Input id="mem-role" placeholder="Senior Designer" value={form.role} onChange={(e) => set("role", e.target.value)} className={errors.role ? "border-destructive" : ""} />
                  {errors.role && <p className="text-xs text-destructive">{errors.role}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label>Department</Label>
                  <Select value={form.department} onValueChange={(v) => set("department", v)}>
                    <SelectTrigger><SelectValue placeholder="Select department" /></SelectTrigger>
                    <SelectContent>
                      {DEPARTMENTS.map((d) => (
                        <SelectItem key={d} value={d}>{d}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="hourly-rate">Hourly Rate</Label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="hourly-rate" placeholder="85" className="pl-9" value={form.hourlyRate || ""} onChange={(e) => set("hourlyRate", e.target.value)} />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Start Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input id="start-date" type="date" className="pl-9" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" /> Bio / Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                placeholder="Short bio or notes about this team member..."
                className="min-h-[100px] resize-none"
                value={form.bio || ""}
                onChange={(e) => set("bio", e.target.value)}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={form.status} onValueChange={(v: any) => set("status", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Active">Active</SelectItem>
                  <SelectItem value="Away">Away</SelectItem>
                  <SelectItem value="Offline">Offline</SelectItem>
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

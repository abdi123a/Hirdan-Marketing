import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Save, Folder, Users, DollarSign, Calendar, Tag } from "lucide-react";
import { useAgencyStore, Project } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";

export default function EditProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { projects, clients, updateProject } = useAgencyStore();
  const { toast } = useToast();

  const [form, setForm] = useState<Partial<Project>>({});
  const [tagInput, setTagInput] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const project = projects.find((p) => p.id === id);
    if (project) {
      setForm(project);
    } else {
      toast({ title: "Project not found", variant: "destructive" });
      navigate("/dashboard/projects");
    }
  }, [id, projects, navigate, toast]);

  const set = (field: keyof Project, value: any) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name?.trim()) e.name = "Project name is required";
    if (!form.client?.trim()) e.client = "Please select a client";
    if (!form.dueDate) e.dueDate = "Due date is required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const addTag = () => {
    if (tagInput.trim() && !form.tags?.includes(tagInput.trim())) {
      set("tags", [...(form.tags || []), tagInput.trim()]);
      setTagInput("");
    }
  };

  const removeTag = (tag: string) => {
    set("tags", (form.tags || []).filter((t) => t !== tag));
  };

  const handleSubmit = async () => {
    if (!validate() || !id) return;
    try {
      await updateProject(id, form);
      toast({ title: "Project updated!", description: `"${form.name}" has been updated.` });
      navigate("/dashboard/projects");
    } catch (e) {
      toast({ title: "Error", description: "Failed to update project.", variant: "destructive" });
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
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Edit Project</h1>
          <p className="text-muted-foreground mt-0.5">Update project details and progress</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Folder className="h-4 w-4 text-primary" /> Project Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="proj-name">Project Name <span className="text-destructive">*</span></Label>
                <Input id="proj-name" placeholder="Website Redesign" value={form.name} onChange={(e) => set("name", e.target.value)} className={errors.name ? "border-destructive" : ""} />
                {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Client <span className="text-destructive">*</span></Label>
                <Select value={form.client} onValueChange={(v) => set("client", v)}>
                  <SelectTrigger className={errors.client ? "border-destructive" : ""}>
                    <SelectValue placeholder="Select a client" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.company || c.name}>{c.company || c.name} — {c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.client && <p className="text-xs text-destructive">{errors.client}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="proj-desc">Description</Label>
                <Textarea id="proj-desc" placeholder="Briefly describe the project scope and objectives..." className="min-h-[100px] resize-none" value={form.description} onChange={(e) => set("description", e.target.value)} />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Calendar className="h-4 w-4 text-primary" /> Timeline & Budget
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="start-date">Start Date</Label>
                  <Input id="start-date" type="date" value={form.startDate} onChange={(e) => set("startDate", e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="due-date">Due Date <span className="text-destructive">*</span></Label>
                  <Input id="due-date" type="date" value={form.dueDate} onChange={(e) => set("dueDate", e.target.value)} className={errors.dueDate ? "border-destructive" : ""} />
                  {errors.dueDate && <p className="text-xs text-destructive">{errors.dueDate}</p>}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="budget">Budget</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input id="budget" placeholder="8,500" className="pl-9" value={form.budget} onChange={(e) => set("budget", e.target.value)} />
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Progress</Label>
                  <span className="text-sm font-semibold text-primary">{form.progress}%</span>
                </div>
                <Slider
                  value={[form.progress ?? 0]}
                  onValueChange={([v]) => set("progress", v)}
                  min={0} max={100} step={5}
                  className="cursor-pointer"
                />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Tag className="h-4 w-4 text-primary" /> Tags
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <Input placeholder="Add a tag (e.g. Design, SEO)" value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <Button type="button" variant="outline" onClick={addTag}>Add</Button>
              </div>
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {form.tags.map((tag) => (
                    <span key={tag} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="hover:opacity-70 transition-opacity">×</button>
                    </span>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card className="shadow-card border-border">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Project Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v: any) => set("status", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="In Progress">In Progress</SelectItem>
                    <SelectItem value="Completed">Completed</SelectItem>
                    <SelectItem value="On Hold">On Hold</SelectItem>
                    <SelectItem value="Archived">Archived</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Priority</Label>
                <Select value={form.priority} onValueChange={(v: any) => set("priority", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Low">Low</SelectItem>
                    <SelectItem value="Medium">Medium</SelectItem>
                    <SelectItem value="High">High</SelectItem>
                    <SelectItem value="Urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
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

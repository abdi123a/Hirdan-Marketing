/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiUpload } from "@/lib/api-client";
import {
  Loader2, Save, FileText, Image as ImageIcon, Plus, Trash2, Edit2,
  Star, CheckCircle2, ChevronRight, Folder, UploadCloud, Sparkles, Settings, ArrowUpRight,
  HelpCircle as HelpIcon, X, Layers, Play, Compass, DollarSign, Award, ThumbsUp,
  Smartphone, MonitorIcon, ChevronDown, Lock, ArrowLeft,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface CaseStudy {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
}

interface LandingPageProject {
  id: string;
  title: string;
  category: string;
  description: string;
  imageUrl: string;
  imageUrl2?: string | null;
  imageUrl3?: string | null;
  imageUrl4?: string | null;
  clientName?: string | null;
  projectDate?: string | null;
  location?: string | null;
  duration?: string | null;
  sections?: any[] | null;
}

interface Testimonial {
  id: string;
  name: string;
  role: string;
  feedback: string;
  rating: number;
  avatarUrl: string | null;
}

const EMPTY_CS = { title: "", category: "", description: "", imageUrl: "" };
const EMPTY_T = { name: "", role: "", feedback: "", rating: 5, avatarUrl: "" };
const EMPTY_P: any = {
  title: "", category: "", description: "", imageUrl: "", imageUrl2: "", imageUrl3: "", imageUrl4: "",
  clientName: "", projectDate: "", location: "", duration: "", sections: [],
};

// Form state for a dialog: the blank form's keys, taken from `src` when present.
const fill = <T extends object>(empty: T, src?: any): T =>
  Object.fromEntries(Object.keys(empty).map(k => [k, src?.[k] ?? (empty as any)[k]])) as T;

// value/onChange pair for a text field backed by one key of a state object.
const binder = <T,>(form: T, set: React.Dispatch<React.SetStateAction<T>>) => (key: string) => ({
  value: (form as any)[key] || "",
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(prev => ({ ...prev, [key]: e.target.value })),
});

const LABEL = "text-xs font-semibold text-muted-foreground";
const SMALL_LABEL = "text-[10px] font-bold text-muted-foreground uppercase";
const MOCK_BADGE = "absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10";

const navigationGroups = [
  {
    title: "Core Branding & Pages",
    items: [
      { id: "hero", label: "Hero Banner", icon: Sparkles },
      { id: "about", label: "About Page / Mission", icon: Compass },
      { id: "clientlogos", label: "Client Logos", icon: Award },
    ]
  },
  {
    title: "Content & Blocks",
    items: [
      { id: "services", label: "Services Cards", icon: Layers },
      { id: "process", label: "Roadmap Timeline", icon: Play },
      { id: "packages", label: "Pricing Packages", icon: DollarSign },
      { id: "faqs", label: "FAQ Accordion", icon: HelpIcon },
    ]
  },
  {
    title: "Portfolios & Reviews",
    items: [
      { id: "casestudies", label: "Case Studies", icon: FileText },
      { id: "projects", label: "Agency Projects", icon: Folder },
      { id: "testimonials", label: "Client Reviews", icon: ThumbsUp },
    ]
  },
  {
    title: "Metadata & SEO",
    items: [
      { id: "seo", label: "SEO & Taglines", icon: Settings },
    ]
  }
];

// Custom Premium Upload Zone
function UploadZone({
  label,
  imageUrl,
  onUpload,
  isUploading,
  onClear
}: {
  label: string;
  imageUrl: string;
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  onClear?: () => void;
}) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        {imageUrl && onClear && (
          <button
            type="button"
            onClick={onClear}
            className="text-[11px] text-destructive hover:underline flex items-center gap-1 transition-all"
          >
            <Trash2 className="w-3 h-3" /> Clear
          </button>
        )}
      </div>
      <div className={`relative border-2 border-dashed border-border hover:border-primary/50 transition-all rounded-xl p-4 flex flex-col items-center justify-center min-h-[140px] bg-muted/10 group overflow-hidden ${imageUrl ? 'border-solid bg-muted/5' : ''}`}>
        {imageUrl ? (
          <div className="relative w-full h-full min-h-[108px] flex items-center justify-center">
            <img src={imageUrl} alt={label} className="max-h-[120px] max-w-full object-contain rounded-lg shadow-sm transition-transform group-hover:scale-[1.02]" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center rounded-lg gap-2">
              <label className="cursor-pointer bg-white text-black hover:bg-neutral-100 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-md flex items-center gap-1 transition-all">
                <UploadCloud className="w-3.5 h-3.5" /> Replace
                <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={isUploading} />
              </label>
              {onClear && (
                <button type="button" onClick={onClear} className="bg-destructive text-destructive-foreground hover:bg-destructive/90 p-1.5 rounded-lg shadow-md transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        ) : (
          <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer py-4">
            <div className="bg-primary/10 p-3 rounded-full text-primary mb-2 group-hover:scale-110 transition-transform">
              {isUploading ? <Loader2 className="w-5 h-5 animate-spin" /> : <UploadCloud className="w-5 h-5" />}
            </div>
            <span className="text-xs font-medium text-foreground">Click to upload image</span>
            <span className="text-[10px] text-muted-foreground mt-1">PNG, JPG, SVG or WebP</span>
            <input type="file" accept="image/*" className="hidden" onChange={onUpload} disabled={isUploading} />
          </label>
        )}
        {isUploading && (
          <div className="absolute inset-0 bg-background/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
            <span className="text-[10px] text-muted-foreground font-semibold">Uploading...</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, className = "space-y-1.5", labelClass = LABEL, children }: { label: string; className?: string; labelClass?: string; children: React.ReactNode }) {
  return (
    <div className={className}>
      <label className={labelClass}>{label}</label>
      {children}
    </div>
  );
}

// A tab whose fields live in the static content object and save together via PUT /landing-page/content.
function ContentForm({ onSubmit, saving, icon: Icon, title, desc, headerClass, contentClass, saveLabel, children }: {
  onSubmit: (e: React.FormEvent) => void; saving: boolean; icon: React.ElementType; title: string; desc: string;
  headerClass?: string; contentClass: string; saveLabel: string; children: React.ReactNode;
}) {
  return (
    <form onSubmit={onSubmit}>
      <Card className="border border-border shadow-sm rounded-2xl">
        <CardHeader className={headerClass}>
          <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
            <Icon className="w-5 h-5 text-[#504289]" /> {title}
          </CardTitle>
          <CardDescription>{desc}</CardDescription>
        </CardHeader>
        <CardContent className={contentClass}>{children}</CardContent>
        <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
          <Button type="submit" disabled={saving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saveLabel}
          </Button>
        </div>
      </Card>
    </form>
  );
}

// Repeatable card (service / package / FAQ) inside a ContentForm.
function ItemCard({ className, badge, onRemove, children }: { className: string; badge: React.ReactNode; onRemove: () => void; children: React.ReactNode }) {
  return (
    <div className={className}>
      <div className="flex justify-between items-center">
        {badge}
        <button type="button" className="text-xs text-destructive hover:underline flex items-center gap-1" onClick={onRemove}>
          <Trash2 className="w-3.5 h-3.5" /> Remove
        </button>
      </div>
      {children}
    </div>
  );
}

// A tab listing API-backed records (case studies / projects / testimonials) edited through a dialog.
function ListCard({ icon: Icon, title, desc, addLabel, onAdd, empty, emptyIcon: EmptyIcon, emptyText, children }: {
  icon: React.ElementType; title: string; desc: string; addLabel: string; onAdd: () => void;
  empty: boolean; emptyIcon: React.ElementType; emptyText: string; children: React.ReactNode;
}) {
  return (
    <Card className="border border-border shadow-sm rounded-2xl">
      <CardHeader className="flex flex-col items-start sm:flex-row sm:items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
            <Icon className="w-5 h-5 text-[#504289]" /> {title}
          </CardTitle>
          <CardDescription>{desc}</CardDescription>
        </div>
        <Button size="sm" onClick={onAdd} className="gap-1 rounded-xl text-xs font-bold">
          <Plus className="w-3.5 h-3.5" /> {addLabel}
        </Button>
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
            <EmptyIcon className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-xs">{emptyText}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4">{children}</div>
        )}
      </CardContent>
    </Card>
  );
}

function Row({ media, onEdit, onDelete, children }: { media: React.ReactNode; onEdit: () => void; onDelete: () => void; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl p-3 flex gap-4 items-center bg-muted/15 shadow-xs">
      {media}
      <div className="flex-grow text-left">{children}</div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={onEdit}>
          <Edit2 className="w-3.5 h-3.5" />
        </Button>
        <Button size="icon" variant="destructive" className="h-8 w-8 rounded-lg" onClick={onDelete}>
          <Trash2 className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PortfolioRow({ item, onEdit, onDelete }: { item: CaseStudy; onEdit: () => void; onDelete: () => void }) {
  return (
    <Row
      onEdit={onEdit}
      onDelete={onDelete}
      media={
        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
          <img src={item.imageUrl} alt={item.title} className="w-full h-full object-cover" />
        </div>
      }
    >
      <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">{item.category}</span>
      <h4 className="text-xs font-bold text-foreground line-clamp-1">{item.title}</h4>
      <p className="text-[10px] text-muted-foreground line-clamp-1">{item.description}</p>
    </Row>
  );
}

function CrudDialog({ open, onOpenChange, icon: Icon, title, desc, saveLabel, onSave, children }: {
  open: boolean; onOpenChange: (open: boolean) => void; icon: React.ElementType; title: string; desc: string;
  saveLabel: string; onSave: () => void; children: React.ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-2xl border-border p-6 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            {title}
          </DialogTitle>
          <DialogDescription>{desc}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4 text-left">{children}</div>
        <DialogFooter className="bg-muted/10 p-4 border-t border-border -mx-6 -mb-6 rounded-b-2xl">
          <Button variant="outline" className="rounded-xl text-xs" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button className="rounded-xl text-xs bg-[#504289] text-white hover:bg-[#FFC107]" onClick={onSave}>{saveLabel}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// One section of the preview mockup, highlighted while its tab is being edited.
function MockSection({ id, active, dark, className, badge, badgeClass = MOCK_BADGE, children }: {
  id: string; active: boolean; dark?: boolean; className: string; badge: string; badgeClass?: string; children: React.ReactNode;
}) {
  return (
    <div
      id={`mock-section-${id}`}
      className={`${className} transition-all relative ${
        active ? (dark ? "bg-[#504289]/15 ring-2 ring-[#504289] ring-inset" : "bg-[#504289]/5 ring-2 ring-[#504289] ring-inset") : ""
      }`}
    >
      {active && <span className={badgeClass}>{badge}</span>}
      {children}
    </div>
  );
}

function MockTitle({ sub, title, className = "text-sm font-bold text-[#101828] text-center mb-4" }: { sub: React.ReactNode; title: React.ReactNode; className?: string }) {
  return (
    <>
      <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">{sub}</span>
      <h3 className={className}>{title}</h3>
    </>
  );
}

export default function LandingPageEditor() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("hero");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");
  const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(0);

  // Dynamic content states
  const [staticContent, setStaticContent] = useState<any>({
    heroImageUrl: "",
    heroShapeImageUrl: "",
    heroBadgeImageUrl: "",
    aboutImageUrl: "",
    contactImageUrl: "",
    trustImageUrl: "",
    clientLogos: [],
    heroSubtitle: "",
    heroTitle: "",
    heroDescription: "",
    heroBtn1Text: "",
    heroBtn2Text: "",
    heroAwardNumber: "",
    heroAwardLabel: "",
    aboutSubtitle: "",
    aboutTitle: "",
    aboutDescription: "",
    aboutBullets: "",
    aboutCampaigns: "",
    aboutClients: "",
    processSubtitle: "",
    processTitle: "",
    process1Title: "",
    process1Desc: "",
    process2Title: "",
    process2Desc: "",
    process3Title: "",
    process3Desc: "",
    process4Title: "",
    process4Desc: "",
    ctaSubtitle: "",
    ctaTitle: "",
    ctaDescription: "",
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    seoImage: "",
    servicesJson: [],
    faqsJson: [],
    packagesJson: [],
    footerTagline: "",
    aboutMissionTitle: "",
    aboutMissionDesc: "",
    aboutMissionBullets: "",
    aboutStatsJson: [],
  });

  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [projects, setProjects] = useState<LandingPageProject[]>([]);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  const [pDialogOpen, setPDialogOpen] = useState(false);
  const [pEditingId, setPEditingId] = useState<string | null>(null);
  const [pForm, setPForm] = useState<any>(EMPTY_P);
  const [pUploadingField, setPUploadingField] = useState<string | null>(null);

  const [csDialogOpen, setCsDialogOpen] = useState(false);
  const [csEditingId, setCsEditingId] = useState<string | null>(null);
  const [csForm, setCsForm] = useState(EMPTY_CS);
  const [csUploading, setCsUploading] = useState(false);

  const [tDialogOpen, setTDialogOpen] = useState(false);
  const [tEditingId, setTEditingId] = useState<string | null>(null);
  const [tForm, setTForm] = useState(EMPTY_T);
  const [tUploading, setTUploading] = useState(false);

  const [staticUploading, setStaticUploading] = useState<string | null>(null);

  const sc = binder(staticContent, setStaticContent);
  const cs = binder(csForm, setCsForm);
  const tf = binder(tForm, setTForm);
  const pf = binder(pForm, setPForm);

  const uploadImage = async (
    e: React.ChangeEvent<HTMLInputElement>,
    setBusy: (busy: boolean) => void,
    onUrl: (url: string) => void,
    what = "Image"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setBusy(true);
    try {
      const res = await apiUpload<{ url: string }>("/landing-page/upload", formData);
      onUrl(res.url);
      toast({ title: "Uploaded", description: `${what} uploaded successfully.` });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Upload Failed", description: error.message || "Image upload failed.", variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const uploadLogos = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setStaticUploading("clientLogos");
    const uploadedUrls: string[] = [];
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await apiUpload<{ url: string }>("/landing-page/upload", formData);
        uploadedUrls.push(res.url);
      }
      setStaticContent((prev: any) => ({ ...prev, clientLogos: [...(prev.clientLogos || []), ...uploadedUrls] }));
      toast({ title: "Uploaded", description: `${uploadedUrls.length} logo(s) added successfully.` });
    } catch (error: any) {
      toast({ title: "Upload Failed", description: error.message || "Upload failed.", variant: "destructive" });
    } finally {
      setStaticUploading(null);
      e.target.value = '';
    }
  };

  // Load Data from API
  const loadData = async () => {
    try {
      setIsLoading(true);
      const resData = await apiFetch<any>("/landing-page/content");
      if (resData.content) {
        setStaticContent(resData.content);
      }
      setCaseStudies(resData.caseStudies || []);
      setProjects(resData.projects || []);
      setTestimonials(resData.testimonials || []);
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: "Failed to load landing page editor content.", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveContent = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await apiFetch("/landing-page/content", {
        method: "PUT",
        body: JSON.stringify(staticContent),
      });
      toast({ title: "Settings Saved", description: "Landing page texts updated successfully!" });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Error", description: error.message || "Failed to update landing page.", variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  // Shared create/update/delete for the dialog-edited records.
  const saveRecord = async (path: string, id: string | null, body: unknown, noun: string, setOpen: (open: boolean) => void) => {
    try {
      await apiFetch(id ? `${path}/${id}` : path, { method: id ? "PUT" : "POST", body: JSON.stringify(body) });
      toast(id
        ? { title: "Updated", description: `${noun} updated successfully.` }
        : { title: "Created", description: `${noun} created successfully.` });
      setOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Operation failed", variant: "destructive" });
    }
  };

  const deleteRecord = async (path: string, id: string, noun: string) => {
    const lower = noun.toLowerCase();
    if (!confirm(`Are you sure you want to delete this ${lower}?`)) return;
    try {
      await apiFetch(`${path}/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: `${noun} removed.` });
      loadData();
    } catch {
      toast({ title: "Error", description: `Failed to delete ${lower}.`, variant: "destructive" });
    }
  };

  const invalid = (description: string) => toast({ title: "Validation Error", description, variant: "destructive" });

  const openCs = (study?: CaseStudy) => {
    setCsEditingId(study?.id ?? null);
    setCsForm(fill(EMPTY_CS, study));
    setCsDialogOpen(true);
  };
  const saveCs = () => {
    if (!csForm.title || !csForm.category || !csForm.description || !csForm.imageUrl) return invalid("Please fill in all case study fields.");
    saveRecord("/landing-page/case-studies", csEditingId, csForm, "Case study", setCsDialogOpen);
  };

  const openP = (project?: LandingPageProject) => {
    setPEditingId(project?.id ?? null);
    setPForm(fill(EMPTY_P, project));
    setPDialogOpen(true);
  };
  const saveP = () => {
    if (!pForm.title || !pForm.category || !pForm.description || !pForm.imageUrl) return invalid("Please fill in title, category, description and primary image.");
    saveRecord("/landing-page/projects", pEditingId, pForm, "Project", setPDialogOpen);
  };

  const openT = (t?: Testimonial) => {
    setTEditingId(t?.id ?? null);
    setTForm(fill(EMPTY_T, t));
    setTDialogOpen(true);
  };
  const saveT = () => {
    if (!tForm.name || !tForm.role || !tForm.feedback) return invalid("Please fill in all testimonial fields.");
    saveRecord("/landing-page/testimonials", tEditingId, tForm, "Testimonial", setTDialogOpen);
  };

  const setSections = (fn: (sections: any[]) => any[]) => setPForm((prev: any) => ({ ...prev, sections: fn(prev.sections || []) }));
  const updateSection = (index: number, field: string, value: any) =>
    setSections(s => s.map((sec, i) => i === index ? { ...sec, [field]: value } : sec));

  // Repeatable arrays inside staticContent (servicesJson, packagesJson, faqsJson).
  const list = (key: string): any[] => (Array.isArray(staticContent[key]) ? staticContent[key] : []);
  const setList = (key: string, fn: (items: any[]) => any[]) => setStaticContent((prev: any) => ({ ...prev, [key]: fn(prev[key] || []) }));
  const setItem = (key: string, idx: number, patch: object) => setList(key, l => l.map((x, i) => i === idx ? { ...x, ...patch } : x));
  const removeItem = (key: string, idx: number) => setList(key, l => l.filter((_, i) => i !== idx));
  const itemField = (key: string, idx: number, item: any, field: string) => ({
    value: item[field] || "",
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setItem(key, idx, { [field]: e.target.value }),
  });
  const addButton = (key: string, item: object, label: string, className: string) => (
    <Button type="button" variant="outline" className={className} onClick={() => setList(key, l => [...l, item])}>
      <Plus className="w-4 h-4" /> {label}
    </Button>
  );

  const zone = (label: string, key: string) => (
    <UploadZone
      label={label}
      imageUrl={staticContent[key]}
      isUploading={staticUploading === key}
      onUpload={e => uploadImage(e, busy => setStaticUploading(busy ? key : null), url => setStaticContent((prev: any) => ({ ...prev, [key]: url })))}
      onClear={() => setStaticContent((prev: any) => ({ ...prev, [key]: "" }))}
    />
  );

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading landing page CMS...</p>
      </div>
    );
  }

  const formProps = { onSubmit: handleSaveContent, saving: isSaving };
  const services = list("servicesJson");
  const packages = list("packagesJson");
  const faqs = list("faqsJson");

  return (
    <div className="w-full min-h-[calc(100vh-2rem)] text-left px-4 md:px-6 lg:px-8 py-6">
      {/* Top Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-card border border-border p-5 md:p-6 rounded-2xl shadow-xs">
        <div className="flex items-start gap-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/dashboard/settings?tab=general")}
            className="shrink-0 h-9 rounded-xl border-border hover:bg-muted"
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" />
            Settings
          </Button>
          <div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-[#504289] px-2.5 py-1 bg-[#504289]/10 rounded-md">Live CMS Suite</span>
            <h1 className="text-2xl md:text-3xl font-extrabold font-display tracking-tight text-foreground mt-2 flex items-center gap-2">
              Landing Page Customizer
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build, edit, and reorganize SMM Agency sections in a live split workspace environment.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <a
            href={import.meta.env.VITE_LANDING_URL || "https://hirdanmarketing.com"}
            target="_blank"
            rel="noreferrer"
            className="px-4 py-2 border border-border hover:bg-muted text-xs font-bold rounded-xl flex items-center gap-1.5 transition-colors bg-background text-foreground shadow-xs"
          >
            Visit Live Site <ArrowUpRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      {/* Main CMS Split Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 xl:gap-8 items-start">

        {/* Panel 1: Vertical Sidebar Navigation (col-span-2) */}
        <div className="xl:col-span-2 space-y-6">
          <Card className="border border-border shadow-sm p-4 bg-card rounded-2xl">
            <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-widest px-3 mb-3">Navigation</h3>
            <div className="space-y-4">
              {navigationGroups.map((group) => (
                <div key={group.title} className="space-y-1">
                  <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide px-3 mt-2 mb-1">{group.title}</h4>
                  {group.items.map(({ id, label, icon: Icon }) => {
                    const isActive = activeTab === id;
                    return (
                      <button
                        key={id}
                        onClick={() => {
                          setActiveTab(id);
                          // Auto scroll preview panel to correct mock section
                          document.getElementById(`mock-section-${id}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          isActive
                            ? "bg-[#504289] text-white shadow-sm shadow-[#504289]/20 scale-[1.01]"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{label}</span>
                        {isActive && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
                      </button>
                    );
                  })}
                </div>
              ))}
            </div>
          </Card>

          {/* Quick Help Card */}
          <Card className="border border-border shadow-xs bg-muted/30 p-4 rounded-2xl hidden lg:block">
            <div className="flex gap-3">
              <HelpIcon className="w-5 h-5 text-[#504289] shrink-0" />
              <div>
                <h4 className="text-xs font-bold text-foreground">Interactive Mockup</h4>
                <p className="text-[11px] text-muted-foreground leading-relaxed mt-1">
                  Your changes are applied directly in real-time. The browser mockup replicates your <strong>Next.js theme design</strong> exactly, including correct colors, shapes, badge layouts, checkmarks, and brand styles.
                </p>
              </div>
            </div>
          </Card>
        </div>

        {/* Panel 2: Active Form Area (col-span-5) */}
        <div className="xl:col-span-5 space-y-6">

          {activeTab === "hero" && (
            <ContentForm {...formProps} icon={Sparkles} title="Hero Banner" headerClass="pb-4" contentClass="space-y-6" saveLabel="Save Hero Section"
              desc="Setup layout content, background structures, and primary client call-to-actions.">
              {zone("Hero Main Background Image", "heroImageUrl")}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {zone("Shape Overlay Graphics", "heroShapeImageUrl")}
                {zone("Subtitle Badge Graphic", "heroBadgeImageUrl")}
              </div>

              <div className="space-y-4 pt-2">
                <Field label="Badge Subtitle Label">
                  <Input {...sc("heroSubtitle")} placeholder="e.g. Creative Social Media Marketing" required className="rounded-xl" />
                </Field>
                <Field label="Main Title Heading">
                  <Input {...sc("heroTitle")} placeholder="e.g. Growth With High-Impact Social Media" required className="rounded-xl" />
                </Field>
                <Field label="Intro Description Content">
                  <Textarea {...sc("heroDescription")} placeholder="Introduce your agency..." rows={3} required className="rounded-xl resize-none" />
                </Field>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Primary CTA Text"><Input {...sc("heroBtn1Text")} required className="rounded-xl" /></Field>
                  <Field label="Secondary CTA Text"><Input {...sc("heroBtn2Text")} required className="rounded-xl" /></Field>
                </div>

                <div className="border-t border-border pt-4 mt-2 grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Award Number"><Input {...sc("heroAwardNumber")} required className="rounded-xl font-mono text-xs" /></Field>
                  <Field label="Award Label Text"><Input {...sc("heroAwardLabel")} required className="rounded-xl text-xs" /></Field>
                </div>

                {zone("Trust Badge Image (Trusted Clients overlay)", "trustImageUrl")}
              </div>
            </ContentForm>
          )}

          {activeTab === "about" && (
            <ContentForm {...formProps} icon={Compass} title="About & Mission" contentClass="space-y-6" saveLabel="Save About Settings"
              desc="Configure brand details, checkboxes bullet checklist, and statistics charts.">
              {zone("About Showcase Image", "aboutImageUrl")}

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Section Subtitle"><Input {...sc("aboutSubtitle")} required className="rounded-xl" /></Field>
                  <Field label="Section Title"><Input {...sc("aboutTitle")} required className="rounded-xl" /></Field>
                </div>
                <Field label="Section Description">
                  <Textarea {...sc("aboutDescription")} rows={4} required className="rounded-xl resize-none" />
                </Field>
                <Field label="Checklist Bullets (Comma-separated)">
                  <Input {...sc("aboutBullets")} placeholder="e.g. Premium Strategy, 24/7 Monitoring, Fast Setup" required className="rounded-xl" />
                </Field>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Campaigns Stat Count"><Input {...sc("aboutCampaigns")} required className="rounded-xl" /></Field>
                  <Field label="Active Clients Stat"><Input {...sc("aboutClients")} required className="rounded-xl" /></Field>
                </div>

                <div className="border-t border-border pt-4 space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-primary">About Page Specific Mission & Stats</h4>
                  <Field label="Mission Title"><Input {...sc("aboutMissionTitle")} className="rounded-xl" /></Field>
                  <Field label="Mission Description">
                    <Textarea {...sc("aboutMissionDesc")} rows={2} className="rounded-xl resize-none" />
                  </Field>
                  <Field label="Mission Bullets (One per line)">
                    <Textarea {...sc("aboutMissionBullets")} placeholder="e.g. Bullet One&#10;Bullet Two" rows={3} className="rounded-xl font-mono text-xs" />
                  </Field>
                  <Field label="About Page Stats (One per line)">
                    <Textarea
                      value={Array.isArray(staticContent.aboutStatsJson) ? staticContent.aboutStatsJson.join("\n") : ""}
                      onChange={e => setStaticContent((prev: any) => ({ ...prev, aboutStatsJson: e.target.value.split("\n").filter(Boolean) }))}
                      placeholder="e.g. 150+ Happy Businesses&#10;99.9% Success Rate"
                      rows={3}
                      className="rounded-xl font-mono text-xs"
                    />
                  </Field>
                </div>
              </div>
            </ContentForm>
          )}

          {activeTab === "services" && (
            <ContentForm {...formProps} icon={Layers} title="Services Cards" contentClass="space-y-4" saveLabel="Save Services Settings"
              desc="Manage the grid items that display your key service offerings.">
              <div className="space-y-3">
                {services.map((service, idx) => (
                  <ItemCard
                    key={idx}
                    className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3 shadow-xs"
                    badge={<span className="text-[10px] font-bold text-[#504289] px-2 py-0.5 bg-[#504289]/10 rounded-md">Service #{idx + 1}</span>}
                    onRemove={() => removeItem("servicesJson", idx)}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Service Title" className="space-y-1" labelClass={SMALL_LABEL}>
                          <Input {...itemField("servicesJson", idx, service, "title")} required className="h-8 text-xs rounded-lg" />
                        </Field>
                        <Field label="Icon CSS Class" className="space-y-1" labelClass={SMALL_LABEL}>
                          <Input {...itemField("servicesJson", idx, service, "icon")} value={service.icon || "flaticon-graphic-design"} className="h-8 text-xs rounded-lg font-mono" />
                        </Field>
                      </div>
                      <Field label="Description" className="space-y-1" labelClass={SMALL_LABEL}>
                        <Textarea {...itemField("servicesJson", idx, service, "description")} rows={2} required className="text-xs rounded-lg resize-none" />
                      </Field>
                    </div>
                  </ItemCard>
                ))}
              </div>
              {addButton("servicesJson", { title: "", description: "", icon: "flaticon-graphic-design" }, "Add New Service Card", "w-full gap-2 border-dashed rounded-xl py-6")}
            </ContentForm>
          )}

          {activeTab === "process" && (
            <ContentForm {...formProps} icon={Play} title="Roadmap Process & CTA Forms" contentClass="space-y-6" saveLabel="Save Timeline Settings"
              desc="Setup the step-by-step roadmap items and the lead capture backdrop.">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Field label="Section Subtitle"><Input {...sc("processSubtitle")} required className="rounded-xl" /></Field>
                <Field label="Section Title"><Input {...sc("processTitle")} required className="rounded-xl" /></Field>
              </div>

              {[1, 2, 3, 4].map((num) => (
                <div key={num} className="p-4 border border-border rounded-xl bg-muted/20 space-y-3">
                  <span className="text-[10px] font-bold text-foreground bg-primary/20 px-2 py-0.5 rounded">Step 0{num}</span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <Field label="Title" className="space-y-1" labelClass="text-[10px] font-semibold text-muted-foreground">
                      <Input {...sc(`process${num}Title`)} required className="h-8 text-xs rounded-lg" />
                    </Field>
                    <Field label="Short Description" className="space-y-1" labelClass="text-[10px] font-semibold text-muted-foreground">
                      <Input {...sc(`process${num}Desc`)} required className="h-8 text-xs rounded-lg" />
                    </Field>
                  </div>
                </div>
              ))}

              <div className="border-t border-border pt-4 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Contact / Lead Capture Backdrop</h4>
                {zone("Contact Area Background Image", "contactImageUrl")}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="CTA Subtitle"><Input {...sc("ctaSubtitle")} required className="rounded-xl" /></Field>
                  <Field label="CTA Title"><Input {...sc("ctaTitle")} required className="rounded-xl" /></Field>
                </div>
                <Field label="CTA Description text"><Input {...sc("ctaDescription")} required className="rounded-xl" /></Field>
              </div>
            </ContentForm>
          )}

          {activeTab === "clientlogos" && (
            <ContentForm {...formProps} icon={Award} title="Client Logos Slider" contentClass="space-y-6" saveLabel="Save Client Logos"
              desc="Upload customer brand logos displayed in the scrolling marquee banner.">
              <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/10">
                <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                <span className="text-xs font-semibold text-foreground block">Add Client Logo Graphic(s)</span>
                <span className="text-[10px] text-muted-foreground block mt-1 mb-4">Multiple files can be chosen at once.</span>
                <Input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={uploadLogos}
                  disabled={staticUploading === "clientLogos"}
                  className="max-w-xs mx-auto cursor-pointer text-xs"
                />
              </div>

              {staticUploading === "clientLogos" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span>Processing file uploads...</span>
                </div>
              )}

              {list("clientLogos").length > 0 ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {list("clientLogos").map((url: string, index: number) => (
                    <div key={index} className="border border-border p-3 rounded-xl bg-card relative group flex items-center justify-center min-h-[70px]">
                      <img src={url} alt={`Client ${index + 1}`} className="max-h-8 max-w-full object-contain" />
                      <button
                        type="button"
                        onClick={() => removeItem("clientLogos", index)}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-full flex items-center justify-center shadow-md transition-all opacity-0 group-hover:opacity-100"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground">
                  No custom client logos uploaded yet. Defaults will display.
                </div>
              )}
            </ContentForm>
          )}

          {activeTab === "packages" && (
            <ContentForm {...formProps} icon={DollarSign} title="Pricing Packages" contentClass="space-y-4" saveLabel="Save Packages Settings"
              desc="Setup agency subscriptions and packages shown to prospects.">
              <div className="space-y-4">
                {packages.map((pkg, idx) => (
                  <ItemCard
                    key={idx}
                    className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-4"
                    badge={<span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">{pkg.name || "Unnamed Package"}</span>}
                    onRemove={() => removeItem("packagesJson", idx)}
                  >
                    <div className="space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <Field label="Package Name" className="space-y-1" labelClass={SMALL_LABEL}>
                          <Input {...itemField("packagesJson", idx, pkg, "name")} required className="h-8 text-xs rounded-lg" />
                        </Field>
                        <Field label="Price / Schedule" className="space-y-1" labelClass={SMALL_LABEL}>
                          <Input {...itemField("packagesJson", idx, pkg, "price")} required className="h-8 text-xs rounded-lg" />
                        </Field>
                      </div>
                      <Field label="Best For / Tagline" className="space-y-1" labelClass={SMALL_LABEL}>
                        <Input {...itemField("packagesJson", idx, pkg, "bestFor")} className="h-8 text-xs rounded-lg" />
                      </Field>
                      <Field label="Bullet Features (One per line)" className="space-y-1" labelClass={SMALL_LABEL}>
                        <Textarea
                          value={Array.isArray(pkg.features) ? pkg.features.join("\n") : ""}
                          onChange={(e) => setItem("packagesJson", idx, { features: e.target.value.split("\n").filter(Boolean) })}
                          rows={4}
                          required
                          className="text-xs rounded-lg font-sans"
                        />
                      </Field>
                    </div>
                  </ItemCard>
                ))}
              </div>
              {addButton("packagesJson", { name: "", price: "", bestFor: "", features: [] }, "Add Pricing Package Card", "w-full gap-2 border-dashed rounded-xl py-5")}
            </ContentForm>
          )}

          {activeTab === "casestudies" && (
            <ListCard icon={FileText} title="Case Studies Portfolio" desc="Showcase your visual success stories, views generated, ROAS etc."
              addLabel="Add Case Study" onAdd={() => openCs()} empty={caseStudies.length === 0}
              emptyIcon={FileText} emptyText="No custom case studies yet. Static items are rendering.">
              {caseStudies.map(study => (
                <PortfolioRow key={study.id} item={study} onEdit={() => openCs(study)} onDelete={() => deleteRecord("/landing-page/case-studies", study.id, "Case study")} />
              ))}
            </ListCard>
          )}

          {activeTab === "projects" && (
            <ListCard icon={Folder} title="Portfolio Projects" desc="Manage the detailed case/project profiles displayed on your showcases."
              addLabel="Add Project" onAdd={() => openP()} empty={projects.length === 0}
              emptyIcon={Folder} emptyText="No projects configured. Showcase is empty.">
              {projects.map(project => (
                <PortfolioRow key={project.id} item={project} onEdit={() => openP(project)} onDelete={() => deleteRecord("/landing-page/projects", project.id, "Project")} />
              ))}
            </ListCard>
          )}

          {activeTab === "testimonials" && (
            <ListCard icon={ThumbsUp} title="Client Reviews" desc="Manage user feedback testimonials and star ratings."
              addLabel="Add Review" onAdd={() => openT()} empty={testimonials.length === 0}
              emptyIcon={Star} emptyText="No client reviews configured. Default review slide showing.">
              {testimonials.map(t => (
                <Row
                  key={t.id}
                  onEdit={() => openT(t)}
                  onDelete={() => deleteRecord("/landing-page/testimonials", t.id, "Testimonial")}
                  media={
                    <div className="w-12 h-12 bg-muted rounded-full overflow-hidden shrink-0">
                      {t.avatarUrl ? (
                        <img src={t.avatarUrl} alt={t.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">{t.name[0]}</div>
                      )}
                    </div>
                  }
                >
                  <h4 className="text-xs font-bold text-foreground line-clamp-1">{t.name}</h4>
                  <span className="text-[9px] text-muted-foreground block mb-0.5">{t.role}</span>
                  <div className="flex items-center text-yellow-500">
                    {[...Array(t.rating)].map((_, i) => (
                      <Star key={i} className="w-2.5 h-2.5 fill-current" />
                    ))}
                  </div>
                </Row>
              ))}
            </ListCard>
          )}

          {activeTab === "faqs" && (
            <ContentForm {...formProps} icon={HelpIcon} title="FAQ Accordions" contentClass="space-y-4" saveLabel="Save FAQs Settings"
              desc="Setup questions and answers listed on your sales page footer.">
              <div className="space-y-4">
                {faqs.map((faq, idx) => (
                  <ItemCard
                    key={idx}
                    className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3"
                    badge={<span className="text-[10px] font-bold text-[#504289] px-2 py-0.5 bg-[#504289]/10 rounded-md">FAQ #{idx + 1}</span>}
                    onRemove={() => removeItem("faqsJson", idx)}
                  >
                    <div className="space-y-2">
                      <Field label="Question Text" className="space-y-1" labelClass={SMALL_LABEL}>
                        <Input {...itemField("faqsJson", idx, faq, "question")} required className="h-8 text-xs rounded-lg" />
                      </Field>
                      <Field label="Answer Detail" className="space-y-1" labelClass={SMALL_LABEL}>
                        <Textarea {...itemField("faqsJson", idx, faq, "answer")} rows={2} required className="text-xs rounded-lg resize-none" />
                      </Field>
                    </div>
                  </ItemCard>
                ))}
              </div>
              {addButton("faqsJson", { question: "", answer: "" }, "Add FAQ Item", "w-full gap-2 border-dashed rounded-xl py-5")}
            </ContentForm>
          )}

          {activeTab === "seo" && (
            <ContentForm {...formProps} icon={Settings} title="SEO & Taglines" contentClass="space-y-6" saveLabel="Save SEO Settings"
              desc="Tune landing page titles, keywords, description tags, and social graphic previews.">
              <Field label="SEO Meta Title">
                <Input {...sc("seoTitle")} placeholder="e.g. Hirdan Marketing - Premium Agency" className="rounded-xl" />
              </Field>
              <Field label="SEO Meta Description">
                <Textarea {...sc("seoDescription")} placeholder="Enter a brief summary..." rows={3} className="rounded-xl resize-none" />
              </Field>
              <Field label="SEO Keywords (Comma Separated)">
                <Input {...sc("seoKeywords")} placeholder="marketing, smm agency, design" className="rounded-xl" />
              </Field>
              {zone("OG Social Share Image (1200x630px recommended)", "seoImage")}
              <Field label="Footer Tagline Text" className="border-t border-border pt-4 space-y-1.5">
                <Input {...sc("footerTagline")} placeholder="We grow your business with creative marketing that delivers real results." className="rounded-xl" />
              </Field>
            </ContentForm>
          )}

        </div>

        {/* Panel 3: Accurate Next.js Theme Visual Preview Window (col-span-5) */}
        <div className="xl:col-span-5 sticky top-6 hidden xl:block">
          <div className="border border-border rounded-2xl shadow-2xl bg-white text-slate-800 overflow-hidden font-sans">

            {/* Mock Window Top Bar */}
            <div className="bg-[#101828] px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500 block" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500 block" />
              </div>
              <div className="bg-slate-900/60 text-[10px] text-slate-300 font-mono px-3 py-1 rounded-md text-center truncate max-w-[200px] select-none flex items-center gap-1">
                <Lock className="w-2.5 h-2.5 text-green-400" />
                <span>hirdanmarketing.com</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-900/80 px-2 py-0.5 rounded-lg border border-slate-700">
                {([["desktop", "Desktop View", MonitorIcon], ["mobile", "Mobile View", Smartphone]] as const).map(([mode, title, Icon]) => (
                  <button
                    key={mode}
                    onClick={() => setPreviewMode(mode)}
                    className={`p-1 rounded transition-colors ${previewMode === mode ? "bg-[#504289] text-white" : "text-slate-400 hover:text-white"}`}
                    title={title}
                  >
                    <Icon className="w-3.5 h-3.5" />
                  </button>
                ))}
              </div>
            </div>

            {/* Mock Scrollable Content */}
            <div
              className={`p-0 overflow-y-auto space-y-0 scrollbar-thin scrollbar-thumb-slate-200 scrollbar-track-white text-left transition-all duration-300 ${
                previewMode === "mobile" ? "max-w-[360px] mx-auto border-x border-slate-200 shadow-inner" : "w-full"
              }`}
              style={{ maxHeight: "700px" }}
            >
              {/* Header Navigation Mockup */}
              <div className="bg-[#101828] text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
                <div className="flex items-center gap-1">
                  <span className="font-extrabold text-sm tracking-tight text-white">Hirdan<span className="text-[#504289]">Marketing</span></span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[10px] text-slate-300 hover:text-white font-medium cursor-pointer hidden md:inline">Services</span>
                  <span className="text-[10px] text-slate-300 hover:text-white font-medium cursor-pointer hidden md:inline">About</span>
                  <span className="bg-[#504289] text-white font-bold text-[9px] px-3 py-1.5 rounded-[10px] hover:bg-[#FFC107] transition-all cursor-pointer">
                    Get Quote
                  </span>
                </div>
              </div>

              {/* 1. MOCK HERO SECTION (Matches hero-section hero-4 exact style) */}
              <MockSection id="hero" active={activeTab === "hero"} className="p-6 bg-white border-b border-slate-100" badge="Hero Edit"
                badgeClass="absolute top-2 right-2 text-[9px] font-extrabold uppercase bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">
                <div className="flex flex-col gap-4">
                  <div className="space-y-3">
                    <span className="inline-flex items-center gap-1 bg-[#504289]/10 text-[#504289] text-[10px] font-bold px-2.5 py-1 rounded-full">
                      {staticContent.heroBadgeImageUrl ? (
                        <img src={staticContent.heroBadgeImageUrl} alt="icon" className="h-3 object-contain" />
                      ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#504289]" />
                      )}
                      {staticContent.heroSubtitle || "Digital Marketing Agency"}
                    </span>
                    <h1 className="text-xl md:text-2xl font-black text-[#101828] leading-tight font-display">
                      {staticContent.heroTitle || "Marketing That Builds Real Growth"}
                    </h1>
                    <p className="text-[11px] text-[#696969] leading-relaxed">
                      {staticContent.heroDescription || "Hirdan Marketing helps businesses build their brand, grow their audience, and turn attention into actual sales."}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 pt-2">
                      <span className="bg-[#504289] text-white font-bold text-[10px] px-5 py-2.5 rounded-[14px] hover:bg-[#FFC107] transition-all flex items-center gap-1.5 cursor-pointer shadow-sm shadow-[#504289]/15">
                        {staticContent.heroBtn1Text || "Get A Quote"}
                        <ChevronRight className="w-3.5 h-3.5" />
                      </span>
                      {staticContent.heroBtn2Text && (
                        <span className="border border-slate-200 text-slate-700 font-bold text-[10px] px-5 py-2.5 rounded-[14px] hover:bg-slate-50 transition-all cursor-pointer">
                          {staticContent.heroBtn2Text}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Trust Author Area */}
                  <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
                    <div className="w-10 h-10 rounded-full bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center shrink-0">
                      {staticContent.trustImageUrl ? (
                        <img src={staticContent.trustImageUrl} alt="trust" className="w-full h-full object-cover" />
                      ) : (
                        <Award className="w-5 h-5 text-[#504289]" />
                      )}
                    </div>
                    <div className="text-[9px] text-[#101828] font-bold leading-tight">
                      {staticContent.heroAwardLabel || "Trusted by 15+ businesses and organizations"}
                      {staticContent.heroAwardNumber && (
                        <div className="text-primary font-mono text-[10px]">{staticContent.heroAwardNumber}</div>
                      )}
                    </div>
                  </div>
                </div>
              </MockSection>

              {/* 2. MOCK BRAND MARQUEE (Matches brand-section-2) */}
              <MockSection id="clientlogos" active={activeTab === "clientlogos"} className="py-4 bg-[#FAF9FF] border-y border-[#E6E6E6]" badge="Logos"
                badgeClass="absolute top-1 right-2 text-[8px] font-bold bg-[#504289] text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse z-10">
                <span className="text-[9px] font-extrabold uppercase text-[#696969] tracking-wider text-center block mb-2 opacity-80">
                  Brands We've Worked With
                </span>
                <div className="flex items-center justify-center gap-6 px-4 overflow-hidden">
                  {list("clientLogos").length > 0 ? (
                    list("clientLogos").slice(0, 5).map((logo: string, idx: number) => (
                      <img key={idx} src={logo} alt="brand logo" className="h-5 object-contain max-w-[50px] shrink-0 opacity-70 hover:opacity-100 transition-opacity" />
                    ))
                  ) : (
                    <div className="flex gap-4 opacity-30 select-none">
                      <span className="text-[9px] font-bold">BRAND A</span>
                      <span className="text-[9px] font-bold">BRAND B</span>
                      <span className="text-[9px] font-bold">BRAND C</span>
                    </div>
                  )}
                </div>
              </MockSection>

              {/* 3. MOCK ABOUT SECTION (Matches about-section fix section-padding) */}
              <MockSection id="about" active={activeTab === "about"} className="p-6 bg-white border-b border-slate-100" badge="About">
                <div className="flex flex-col gap-4">
                  <div className="bg-slate-50 border border-slate-100 rounded-2xl aspect-[4/3] overflow-hidden flex items-center justify-center relative shadow-sm">
                    {staticContent.aboutImageUrl ? (
                      <img src={staticContent.aboutImageUrl} alt="About Showcase" className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-slate-300 flex flex-col items-center gap-1">
                        <ImageIcon className="w-8 h-8" />
                        <span className="text-[9px]">About Section Image</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2">
                    <span className="inline-flex items-center gap-1 text-[9px] font-extrabold text-[#504289] uppercase tracking-wider">
                      <img src="assets/img/bale.png" alt="bale" className="h-2.5" onError={(e) => { e.currentTarget.style.display = 'none'; }} />
                      {staticContent.aboutSubtitle || "Who We Are"}
                    </span>
                    <h3 className="text-base font-extrabold text-[#101828] leading-tight">
                      {staticContent.aboutTitle || "A Full-Service Digital Marketing Agency"}
                    </h3>
                    <p className="text-[10px] text-[#696969] leading-relaxed">
                      {staticContent.aboutDescription || "We bring together strategy, design, and content under one team, so every part of your presence works toward the same goal."}
                    </p>

                    <div className="grid grid-cols-1 gap-1.5 pt-2">
                      {staticContent.aboutBullets ? (
                        staticContent.aboutBullets.split(",").map((bullet: string, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-[10px] font-medium text-[#101828]">
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#504289] shrink-0" />
                            <span>{bullet.trim()}</span>
                          </div>
                        ))
                      ) : (
                        <div className="flex items-center gap-2 text-[10px] text-[#696969]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-slate-300" />
                          <span>Consistent quality content</span>
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-4 border-t border-slate-100 grid grid-cols-2">
                      {[[staticContent.aboutCampaigns || "240+", "Campaigns Run"], [staticContent.aboutClients || "15+", "Active Clients"]].map(([value, label]) => (
                        <div key={label} className="bg-[#FAF9FF] p-2.5 rounded-xl border border-slate-100">
                          <span className="text-xs font-black text-[#504289] block">{value}</span>
                          <span className="text-[8px] text-[#696969] block mt-0.5">{label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </MockSection>

              {/* 4. MOCK SERVICES (Matches service-section-4 fix bg-cover) */}
              <MockSection id="services" active={activeTab === "services"} dark className="p-6 bg-[#101828] text-white border-b border-slate-900" badge="Services">
                <MockTitle sub="Popular Services" title="We Provide Best Digital Marketing Services" className="text-sm font-bold text-white text-center mb-4 leading-snug" />
                <div className="grid grid-cols-1 gap-3">
                  {services.length > 0 ? (
                    services.slice(0, 3).map((svc, idx) => {
                      const isActive = idx === 1; // Middle matches Next.js theme active box hover styling
                      return (
                        <div
                          key={idx}
                          className={`p-3.5 rounded-xl border transition-all ${
                            isActive
                              ? "bg-[#504289] border-transparent text-white shadow-md shadow-[#504289]/10 scale-[1.01]"
                              : "bg-slate-900/50 border-slate-800 text-slate-300"
                          }`}
                        >
                          <span className={`text-[8px] font-mono block mb-1 opacity-70 ${isActive ? 'text-yellow-300' : 'text-[#8760FD]'}`}>
                            [{svc.icon || "service-icon"}]
                          </span>
                          <h4 className="text-xs font-bold text-white mb-1">{svc.title || "Graphic Design"}</h4>
                          <p className={`text-[9px] leading-relaxed ${isActive ? 'text-white/90' : 'text-slate-400'}`}>
                            {svc.description || "Branded graphic assets..."}
                          </p>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-[10px] text-slate-500">
                      No services cards loaded. Default catalog displays.
                    </div>
                  )}
                </div>
              </MockSection>

              {/* 5. MOCK TIMELINE ROADMAP (Matches working-section-2) */}
              <MockSection id="process" active={activeTab === "process"} className="p-6 bg-white border-b border-slate-100" badge="Roadmap">
                <MockTitle sub={staticContent.processSubtitle || "How We Work"} title={staticContent.processTitle || "A Process Built On Strategy"} className="text-sm font-bold text-[#101828] text-center mb-5" />
                <div className="space-y-4">
                  {[1, 2, 3, 4].map((num) => (
                    <div
                      key={num}
                      className={`p-3 rounded-xl border border-slate-150 flex gap-3 items-center ${num % 2 === 0 ? 'bg-[#FAF9FF]' : 'bg-white'}`}
                    >
                      <div className="w-8 h-8 rounded-full bg-[#504289]/10 text-[#504289] font-black text-xs flex items-center justify-center shrink-0">
                        {num}
                      </div>
                      <div className="flex-grow text-left">
                        <span className="text-[8px] font-bold text-[#696969] block">Step 0{num}</span>
                        <h4 className="text-[10px] font-bold text-[#101828]">{staticContent[`process${num}Title`] || `Phase ${num}`}</h4>
                        <p className="text-[9px] text-[#696969] line-clamp-1">{staticContent[`process${num}Desc`] || `Description snippet.`}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </MockSection>

              {/* 6. MOCK PRICING PACKAGES (Matches pricing-section) */}
              <MockSection id="packages" active={activeTab === "packages"} className="p-6 bg-[#FAF9FF] border-b border-slate-100" badge="Pricing">
                <MockTitle sub="Pricing Package" title="Flexible Packages Built For Your Growth" className="text-sm font-bold text-[#101828] text-center mb-5" />
                <div className="space-y-4">
                  {packages.length > 0 ? (
                    packages.slice(0, 3).map((pkg, idx) => {
                      const isActive = idx === 1; // Middle card holds active status in Next.js
                      return (
                        <div
                          key={idx}
                          className={`p-4 rounded-xl border bg-white transition-all relative overflow-hidden ${
                            isActive ? "border-[#504289] ring-1 ring-[#504289] shadow-md" : "border-slate-200"
                          }`}
                        >
                          {isActive && (
                            <div className="absolute top-0 right-0 bg-[#504289] text-white font-bold text-[7px] uppercase px-2 py-0.5 rounded-bl">
                              Popular
                            </div>
                          )}
                          <span className="text-[8px] font-bold text-[#696969] uppercase block">{pkg.name} Plan</span>
                          <h4 className="text-sm font-black text-[#101828] mt-1 mb-2">{pkg.price || "Contact Us"}</h4>
                          <p className="text-[8px] text-[#696969] mb-3 leading-relaxed">{pkg.bestFor}</p>

                          <div className="space-y-1 pt-2 border-t border-slate-100 text-[8px] text-[#101828]">
                            {Array.isArray(pkg.features) && pkg.features.slice(0, 3).map((feat: string, fIdx: number) => (
                              <div key={fIdx} className="flex items-center gap-1.5">
                                <span className="text-green-500">✓</span> {feat}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="text-center py-4 text-[10px] text-slate-400">No packages loaded.</div>
                  )}
                </div>
              </MockSection>

              {/* 7. MOCK PORTFOLIOS & PROJECTS */}
              <MockSection id="projects" active={activeTab === "projects" || activeTab === "casestudies"} className="p-6 bg-white border-b border-slate-100" badge="Showcase">
                <MockTitle sub="Our Work" title="Case Studies & Projects" />
                <div className="grid grid-cols-2 gap-3">
                  {projects.slice(0, 2).map((p, pIdx) => (
                    <div key={pIdx} className="border border-slate-150 bg-white rounded-xl overflow-hidden shadow-xs">
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <img src={p.imageUrl} alt={p.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-2">
                        <span className="text-[7px] font-bold text-[#504289] uppercase">{p.category}</span>
                        <h4 className="text-[9px] font-bold text-[#101828] truncate mt-0.5">{p.title}</h4>
                      </div>
                    </div>
                  ))}
                </div>
              </MockSection>

              {/* 8. MOCK TESTIMONIALS SLIDER */}
              <MockSection id="testimonials" active={activeTab === "testimonials"} dark className="p-6 bg-[#101828] text-white border-b border-slate-900" badge="Reviews">
                <MockTitle sub="Testimonials" title="What Global Clients Say" className="text-sm font-bold text-white text-center mb-4" />
                <div className="bg-slate-900/60 p-4 rounded-xl border border-slate-800 text-center space-y-3">
                  <div className="flex items-center justify-center gap-0.5 text-yellow-400">
                    {[...Array(5)].map((_, star) => (
                      <Star key={star} className="w-3 h-3 fill-current" />
                    ))}
                  </div>
                  <p className="text-[10px] italic text-slate-300 leading-relaxed">
                    {testimonials[0]?.feedback || "Hirdan Marketing helped us grow our active user audience base and visual campaigns."}
                  </p>
                  <div className="flex items-center justify-center gap-2">
                    <div className="w-7 h-7 bg-slate-850 rounded-full border border-slate-700 overflow-hidden">
                      {testimonials[0]?.avatarUrl && (
                        <img src={testimonials[0].avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      )}
                    </div>
                    <div className="text-left leading-tight">
                      <span className="text-[9px] font-bold text-white block">{testimonials[0]?.name || "Alex Carter"}</span>
                      <span className="text-[8px] text-slate-400 block">{testimonials[0]?.role || "Founder, Growth"}</span>
                    </div>
                  </div>
                </div>
              </MockSection>

              {/* 9. MOCK FAQ (Matches Faq accordion) */}
              <MockSection id="faqs" active={activeTab === "faqs"} className="p-6 bg-white border-b border-slate-100" badge="FAQ">
                <MockTitle sub="Some Questions" title="Frequently Asked Questions" />
                <div className="space-y-2">
                  {faqs.slice(0, 3).map((faq, fIdx) => {
                    const isExpanded = expandedFaqIndex === fIdx;
                    return (
                      <div key={fIdx} className="border border-slate-100 rounded-lg overflow-hidden bg-white">
                        <button
                          type="button"
                          onClick={() => setExpandedFaqIndex(isExpanded ? null : fIdx)}
                          className="w-full p-2.5 flex items-center justify-between text-left text-[9px] font-bold text-[#101828] hover:bg-slate-50 transition-colors"
                        >
                          <span>{faq.question || "FAQ Question"}</span>
                          <span className={`transition-transform duration-200 text-[#504289] ${isExpanded ? 'rotate-180' : ''}`}>
                            <ChevronDown className="w-3.5 h-3.5" />
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="p-2.5 bg-slate-50 text-[9px] text-[#696969] border-t border-slate-100 leading-relaxed">
                            {faq.answer || "Answer content detail."}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </MockSection>

              {/* Footer Mockup */}
              <div className="bg-[#101828] text-white p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <span className="font-black text-xs text-white">Hirdan<span className="text-[#504289]">Marketing</span></span>
                  <span className="text-[7px] text-slate-400">© 2026 Hirdan Marketing</span>
                </div>
                <p className="text-[9px] text-slate-400 max-w-xs leading-relaxed">
                  {staticContent.footerTagline || "We grow your business with creative marketing that delivers real results."}
                </p>
              </div>

            </div>
          </div>
        </div>

      </div>

      <CrudDialog open={csDialogOpen} onOpenChange={setCsDialogOpen} icon={FileText}
        title={csEditingId ? "Configure Case Study" : "Add Success Portfolio"}
        desc="Detail a strategic marketing success story. Upload high-res images to showcase ROAS, views, or CTR."
        saveLabel="Save Case Study" onSave={saveCs}>
        <Field label="Case Study Title">
          <Input {...cs("title")} placeholder="e.g. Organic Viral Reels Booster" className="rounded-xl" />
        </Field>
        <Field label="Category Tag">
          <Input {...cs("category")} placeholder="e.g. TikTok Marketing" className="rounded-xl" />
        </Field>
        <Field label="Short Description & Outcomes">
          <Textarea {...cs("description")} placeholder="Include stats like: 12M views generated, 15% CTR increase..." rows={3} className="rounded-xl resize-none" />
        </Field>
        <UploadZone
          label="Feature Portfolio Image"
          imageUrl={csForm.imageUrl}
          isUploading={csUploading}
          onUpload={e => uploadImage(e, setCsUploading, url => setCsForm(prev => ({ ...prev, imageUrl: url })), "Case study image")}
          onClear={() => setCsForm(prev => ({ ...prev, imageUrl: "" }))}
        />
      </CrudDialog>

      <CrudDialog open={tDialogOpen} onOpenChange={setTDialogOpen} icon={ThumbsUp}
        title={tEditingId ? "Edit Review Card" : "New Client Review"}
        desc="Create or edit a customer feedback review quote."
        saveLabel="Save Testimonial" onSave={saveT}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Client Name"><Input {...tf("name")} placeholder="Sophia Carter" className="rounded-xl" /></Field>
          <Field label="Role / Company"><Input {...tf("role")} placeholder="Founder, Bloom" className="rounded-xl" /></Field>
        </div>
        <Field label="Feedback Quote Text">
          <Textarea {...tf("feedback")} placeholder="Writing client review feedback..." rows={3} className="rounded-xl resize-none" />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Rating Star Count (1-5)">
            <Input
              type="number"
              min={1}
              max={5}
              value={tForm.rating}
              onChange={e => setTForm(prev => ({ ...prev, rating: parseInt(e.target.value) || 5 }))}
              className="rounded-xl"
            />
          </Field>
          <Field label="Avatar Image">
            <div className="flex gap-2">
              <Input {...tf("avatarUrl")} placeholder="/uploads/client.png" className="rounded-xl text-xs flex-grow" />
              <label className="cursor-pointer bg-muted border border-border h-10 px-3 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 hover:bg-muted/80">
                {tUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                <input type="file" accept="image/*" onChange={e => uploadImage(e, setTUploading, url => setTForm(prev => ({ ...prev, avatarUrl: url })), "Client avatar")} className="hidden" disabled={tUploading} />
              </label>
            </div>
          </Field>
        </div>
      </CrudDialog>

      {/* PROJECT CRUD DIALOG */}
      <Dialog open={pDialogOpen} onOpenChange={setPDialogOpen}>
        <DialogContent className="max-w-3xl rounded-2xl border-border p-0 overflow-hidden shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-muted/20 border-b border-border flex-shrink-0">
            <DialogTitle className="font-display font-bold text-xl flex items-center gap-2">
              <Folder className="w-5 h-5 text-[#504289]" />
              {pEditingId ? "Modify Portfolio Project" : "Create Portfolio Project"}
            </DialogTitle>
            <DialogDescription className="text-sm">
              Input strategic details, metadata, and dynamic images to display in the case study portal.
            </DialogDescription>
          </DialogHeader>

          <div className="p-6 space-y-6 overflow-y-auto flex-grow bg-background">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="Project Title"><Input {...pf("title")} placeholder="e.g. SEO Campaign & Redesign" className="rounded-xl" /></Field>
              <Field label="Category Tag"><Input {...pf("category")} placeholder="e.g. SEO, Design" className="rounded-xl" /></Field>
            </div>

            <Field label="Project Overview">
              <Textarea {...pf("description")} placeholder="Provide a detailed description of the project achievements..." rows={3} className="rounded-xl resize-none" />
            </Field>

            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Project Metadata</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[["clientName", "Client Name"], ["projectDate", "Project Date"], ["location", "Location"], ["duration", "Duration"]].map(([field, label]) => (
                  <Field key={field} label={label} className="space-y-1" labelClass="text-[10px] font-semibold text-muted-foreground">
                    <Input {...pf(field)} className="h-9 text-xs rounded-xl" />
                  </Field>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Project Showcase Images (Up to 4)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { field: "imageUrl", label: "Image 1 (Primary Header)" },
                  { field: "imageUrl2", label: "Image 2 (Grid Right)" },
                  { field: "imageUrl3", label: "Image 3 (Grid Mid)" },
                  { field: "imageUrl4", label: "Image 4 (Grid Base)" }
                ].map(({ field, label }) => (
                  <Field key={field} label={label} className="space-y-1" labelClass={SMALL_LABEL}>
                    <div className="flex gap-2">
                      <Input {...pf(field)} placeholder="/uploads/project..." className="text-xs h-9 rounded-xl flex-grow" />
                      <label className="cursor-pointer bg-muted border border-border h-9 px-3 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 hover:bg-muted/80">
                        {pUploadingField === field ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={e => uploadImage(e, busy => setPUploadingField(busy ? field : null), url => setPForm((prev: any) => ({ ...prev, [field]: url })), "Project image")}
                          className="hidden"
                          disabled={pUploadingField !== null}
                        />
                      </label>
                    </div>
                  </Field>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Key Content Sections</h4>
                <Button type="button" size="sm" variant="outline" onClick={() => setSections(s => [...s, { title: "", content: "", bullets: [] }])} className="text-xs font-bold h-8 rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
                </Button>
              </div>

              <div className="space-y-3">
                {pForm.sections?.map((section: any, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-xl bg-muted/15 relative space-y-3 shadow-xs">
                    <button
                      type="button"
                      className="absolute top-2.5 right-2.5 text-xs text-destructive hover:underline"
                      onClick={() => setSections(s => s.filter((_, i) => i !== index))}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                      <Field label="Section Title" className="md:col-span-1 space-y-1" labelClass="text-[9px] font-semibold uppercase text-muted-foreground">
                        <Input value={section.title} onChange={e => updateSection(index, "title", e.target.value)} className="h-8 text-xs rounded-lg" />
                      </Field>
                      <Field label="Short Content" className="md:col-span-2 space-y-1" labelClass="text-[9px] font-semibold uppercase text-muted-foreground">
                        <Input value={section.content} onChange={e => updateSection(index, "content", e.target.value)} className="h-8 text-xs rounded-lg" />
                      </Field>
                    </div>

                    <Field label="Checklist Bullets (Comma Separated)" className="space-y-1" labelClass="text-[9px] font-semibold uppercase text-muted-foreground">
                      <Input
                        value={section.bullets?.join(", ") || ""}
                        onChange={e => updateSection(index, "bullets", e.target.value.split(",").map(s => s.trim()).filter(Boolean))}
                        placeholder="Bullet 1, Bullet 2"
                        className="h-8 text-xs rounded-lg"
                      />
                    </Field>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
            <Button variant="outline" onClick={() => setPDialogOpen(false)} className="h-9 font-bold text-xs rounded-xl">Cancel</Button>
            <Button onClick={saveP} className="h-9 font-bold text-xs rounded-xl gap-1 bg-[#504289] text-white hover:bg-[#FFC107]">
              <Save className="w-3.5 h-3.5" /> {pEditingId ? "Save Project" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

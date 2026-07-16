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
  Star, LayoutGrid, CheckCircle2, ChevronRight, HelpCircle, Folder,
  UploadCloud, Monitor, Eye, Sparkles, Settings, ArrowUpRight, HelpCircle as HelpIcon,
  X, Layers, Play, Compass, DollarSign, Award, ThumbsUp, Tag, PlusCircle, Check,
  Smartphone, MonitorIcon, ChevronDown, ChevronUp, Lock, ArrowLeft
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

  // Dialog States for Landing Page Projects
  const [pDialogOpen, setPDialogOpen] = useState(false);
  const [pEditingId, setPEditingId] = useState<string | null>(null);
  const [pForm, setPForm] = useState<any>({
    title: "",
    category: "",
    description: "",
    imageUrl: "",
    imageUrl2: "",
    imageUrl3: "",
    imageUrl4: "",
    clientName: "",
    projectDate: "",
    location: "",
    duration: "",
    sections: []
  });
  const [pUploadingField, setPUploadingField] = useState<string | null>(null);

  // Dialog States for Case Studies
  const [csDialogOpen, setCsDialogOpen] = useState(false);
  const [csEditingId, setCsEditingId] = useState<string | null>(null);
  const [csForm, setCsForm] = useState({ title: "", category: "", description: "", imageUrl: "" });
  const [csUploading, setCsUploading] = useState(false);

  // Dialog States for Testimonials
  const [tDialogOpen, setTDialogOpen] = useState(false);
  const [tEditingId, setTEditingId] = useState<string | null>(null);
  const [tForm, setTForm] = useState({ name: "", role: "", feedback: "", rating: 5, avatarUrl: "" });
  const [tUploading, setTUploading] = useState(false);

  const [staticUploading, setStaticUploading] = useState<string | null>(null);

  const handleStaticImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: string) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    setStaticUploading(fieldName);
    try {
      const res = await apiUpload<{ url: string }>("/landing-page/upload", formData);
      setStaticContent((prev: any) => ({ ...prev, [fieldName]: res.url }));
      toast({ title: "Uploaded", description: "Image uploaded successfully." });
    } catch (error: any) {
      console.error(error);
      toast({ title: "Upload Failed", description: error.message || "Image upload failed.", variant: "destructive" });
    } finally {
      setStaticUploading(null);
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

  // Update static sections content
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

  // Image Upload helper
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "case-study" | "testimonial" | "project_imageUrl" | "project_imageUrl2" | "project_imageUrl3" | "project_imageUrl4"
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("image", file);

    if (type === "case-study") setCsUploading(true);
    else if (type.startsWith("project_")) setPUploadingField(type);
    else setTUploading(true);

    try {
      const res = await apiUpload<{ url: string }>("/landing-page/upload", formData);
      if (type === "case-study") {
        setCsForm(prev => ({ ...prev, imageUrl: res.url }));
        toast({ title: "Uploaded", description: "Case study image uploaded successfully." });
      } else if (type.startsWith("project_")) {
        const fieldName = type.replace("project_", "");
        setPForm((prev: any) => ({ ...prev, [fieldName]: res.url }));
        toast({ title: "Uploaded", description: "Project image uploaded successfully." });
      } else {
        setTForm(prev => ({ ...prev, avatarUrl: res.url }));
        toast({ title: "Uploaded", description: "Client avatar uploaded successfully." });
      }
    } catch (error: any) {
      console.error(error);
      toast({ title: "Upload Failed", description: error.message || "Image upload failed.", variant: "destructive" });
    } finally {
      if (type === "case-study") setCsUploading(false);
      else if (type.startsWith("project_")) setPUploadingField(null);
      else setTUploading(false);
    }
  };

  // CRUD Case Studies
  const handleOpenCsDialog = (study?: CaseStudy) => {
    if (study) {
      setCsEditingId(study.id);
      setCsForm({ title: study.title, category: study.category, description: study.description, imageUrl: study.imageUrl });
    } else {
      setCsEditingId(null);
      setCsForm({ title: "", category: "", description: "", imageUrl: "" });
    }
    setCsDialogOpen(true);
  };

  const handleSaveCs = async () => {
    if (!csForm.title || !csForm.category || !csForm.description || !csForm.imageUrl) {
      toast({ title: "Validation Error", description: "Please fill in all case study fields.", variant: "destructive" });
      return;
    }

    try {
      if (csEditingId) {
        await apiFetch(`/landing-page/case-studies/${csEditingId}`, {
          method: "PUT",
          body: JSON.stringify(csForm),
        });
        toast({ title: "Updated", description: "Case study updated successfully." });
      } else {
        await apiFetch("/landing-page/case-studies", {
          method: "POST",
          body: JSON.stringify(csForm),
        });
        toast({ title: "Created", description: "Case study created successfully." });
      }
      setCsDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Operation failed", variant: "destructive" });
    }
  };

  const handleDeleteCs = async (id: string) => {
    if (!confirm("Are you sure you want to delete this case study?")) return;
    try {
      await apiFetch(`/landing-page/case-studies/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Case study removed." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete case study.", variant: "destructive" });
    }
  };

  // CRUD Landing Page Projects
  const handleOpenPDialog = (project?: LandingPageProject) => {
    if (project) {
      setPEditingId(project.id);
      setPForm({
        title: project.title,
        category: project.category,
        description: project.description,
        imageUrl: project.imageUrl,
        imageUrl2: project.imageUrl2 || "",
        imageUrl3: project.imageUrl3 || "",
        imageUrl4: project.imageUrl4 || "",
        clientName: project.clientName || "",
        projectDate: project.projectDate || "",
        location: project.location || "",
        duration: project.duration || "",
        sections: project.sections || []
      });
    } else {
      setPEditingId(null);
      setPForm({
        title: "",
        category: "",
        description: "",
        imageUrl: "",
        imageUrl2: "",
        imageUrl3: "",
        imageUrl4: "",
        clientName: "",
        projectDate: "",
        location: "",
        duration: "",
        sections: []
      });
    }
    setPDialogOpen(true);
  };

  const handleSaveP = async () => {
    if (!pForm.title || !pForm.category || !pForm.description || !pForm.imageUrl) {
      toast({ title: "Validation Error", description: "Please fill in title, category, description and primary image.", variant: "destructive" });
      return;
    }

    try {
      if (pEditingId) {
        await apiFetch(`/landing-page/projects/${pEditingId}`, {
          method: "PUT",
          body: JSON.stringify(pForm),
        });
        toast({ title: "Updated", description: "Project updated successfully." });
      } else {
        await apiFetch("/landing-page/projects", {
          method: "POST",
          body: JSON.stringify(pForm),
        });
        toast({ title: "Created", description: "Project created successfully." });
      }
      setPDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Operation failed", variant: "destructive" });
    }
  };

  const handleDeleteP = async (id: string) => {
    if (!confirm("Are you sure you want to delete this project?")) return;
    try {
      await apiFetch(`/landing-page/projects/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Project removed." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete project.", variant: "destructive" });
    }
  };

  // Section Helpers for Projects Dialog
  const addSection = () => {
    setPForm((prev: any) => ({
      ...prev,
      sections: [...(prev.sections || []), { title: "", content: "", bullets: [] }]
    }));
  };

  const removeSection = (index: number) => {
    setPForm((prev: any) => ({
      ...prev,
      sections: prev.sections.filter((_: any, i: number) => i !== index)
    }));
  };

  const updateSection = (index: number, field: string, value: any) => {
    setPForm((prev: any) => ({
      ...prev,
      sections: prev.sections.map((sec: any, i: number) => i === index ? { ...sec, [field]: value } : sec)
    }));
  };

  // CRUD Testimonials
  const handleOpenTDialog = (t?: Testimonial) => {
    if (t) {
      setTEditingId(t.id);
      setTForm({ name: t.name, role: t.role, feedback: t.feedback, rating: t.rating, avatarUrl: t.avatarUrl || "" });
    } else {
      setTEditingId(null);
      setTForm({ name: "", role: "", feedback: "", rating: 5, avatarUrl: "" });
    }
    setTDialogOpen(true);
  };

  const handleSaveT = async () => {
    if (!tForm.name || !tForm.role || !tForm.feedback) {
      toast({ title: "Validation Error", description: "Please fill in all testimonial fields.", variant: "destructive" });
      return;
    }

    try {
      if (tEditingId) {
        await apiFetch(`/landing-page/testimonials/${tEditingId}`, {
          method: "PUT",
          body: JSON.stringify(tForm),
        });
        toast({ title: "Updated", description: "Testimonial updated successfully." });
      } else {
        await apiFetch("/landing-page/testimonials", {
          method: "POST",
          body: JSON.stringify(tForm),
        });
        toast({ title: "Created", description: "Testimonial created successfully." });
      }
      setTDialogOpen(false);
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: error.message || "Operation failed", variant: "destructive" });
    }
  };

  const handleDeleteT = async (id: string) => {
    if (!confirm("Are you sure you want to delete this testimonial?")) return;
    try {
      await apiFetch(`/landing-page/testimonials/${id}`, { method: "DELETE" });
      toast({ title: "Deleted", description: "Testimonial removed." });
      loadData();
    } catch (error: any) {
      toast({ title: "Error", description: "Failed to delete testimonial.", variant: "destructive" });
    }
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[500px] gap-4">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading landing page CMS...</p>
      </div>
    );
  }

  // Sidebar Grouped Navigation Setup
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
              {navigationGroups.map((group, gIdx) => (
                <div key={gIdx} className="space-y-1">
                  <h4 className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-wide px-3 mt-2 mb-1">{group.title}</h4>
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          setActiveTab(item.id);
                          // Auto scroll preview panel to correct mock section
                          const el = document.getElementById(`mock-section-${item.id}`);
                          if (el) {
                            el.scrollIntoView({ behavior: "smooth", block: "center" });
                          }
                        }}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                          isActive 
                            ? "bg-[#504289] text-white shadow-sm shadow-[#504289]/20 scale-[1.01]" 
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{item.label}</span>
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
          
          {/* TAB CONTENT: HERO SECTION */}
          {activeTab === "hero" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-[#504289]" /> Hero Banner
                  </CardTitle>
                  <CardDescription>Setup layout content, background structures, and primary client call-to-actions.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <UploadZone 
                    label="Hero Main Background Image" 
                    imageUrl={staticContent.heroImageUrl} 
                    isUploading={staticUploading === "heroImageUrl"}
                    onUpload={e => handleStaticImageUpload(e, "heroImageUrl")}
                    onClear={() => setStaticContent((prev: any) => ({ ...prev, heroImageUrl: "" }))}
                  />

                  <div className="grid grid-cols-2 gap-4">
                    <UploadZone 
                      label="Shape Overlay Graphics" 
                      imageUrl={staticContent.heroShapeImageUrl} 
                      isUploading={staticUploading === "heroShapeImageUrl"}
                      onUpload={e => handleStaticImageUpload(e, "heroShapeImageUrl")}
                      onClear={() => setStaticContent((prev: any) => ({ ...prev, heroShapeImageUrl: "" }))}
                    />
                    <UploadZone 
                      label="Subtitle Badge Graphic" 
                      imageUrl={staticContent.heroBadgeImageUrl} 
                      isUploading={staticUploading === "heroBadgeImageUrl"}
                      onUpload={e => handleStaticImageUpload(e, "heroBadgeImageUrl")}
                      onClear={() => setStaticContent((prev: any) => ({ ...prev, heroBadgeImageUrl: "" }))}
                    />
                  </div>

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Badge Subtitle Label</label>
                      <Input 
                        value={staticContent.heroSubtitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                        placeholder="e.g. Creative Social Media Marketing"
                        required
                        className="rounded-xl"
                      />
                    </div>
                    
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Main Title Heading</label>
                      <Input 
                        value={staticContent.heroTitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, heroTitle: e.target.value }))}
                        placeholder="e.g. Growth With High-Impact Social Media"
                        required
                        className="rounded-xl"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Intro Description Content</label>
                      <Textarea 
                        value={staticContent.heroDescription} 
                        onChange={e => setStaticContent(prev => ({ ...prev, heroDescription: e.target.value }))}
                        placeholder="Introduce your agency..."
                        rows={3}
                        required
                        className="rounded-xl resize-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Primary CTA Text</label>
                        <Input 
                          value={staticContent.heroBtn1Text} 
                          onChange={e => setStaticContent(prev => ({ ...prev, heroBtn1Text: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Secondary CTA Text</label>
                        <Input 
                          value={staticContent.heroBtn2Text} 
                          onChange={e => setStaticContent(prev => ({ ...prev, heroBtn2Text: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 mt-2 grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Award Number</label>
                        <Input 
                          value={staticContent.heroAwardNumber} 
                          onChange={e => setStaticContent(prev => ({ ...prev, heroAwardNumber: e.target.value }))}
                          required
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Award Label Text</label>
                        <Input 
                          value={staticContent.heroAwardLabel} 
                          onChange={e => setStaticContent(prev => ({ ...prev, heroAwardLabel: e.target.value }))}
                          required
                          className="rounded-xl text-xs"
                        />
                      </div>
                    </div>

                    <UploadZone 
                      label="Trust Badge Image (Trusted Clients overlay)" 
                      imageUrl={staticContent.trustImageUrl} 
                      isUploading={staticUploading === "trustImageUrl"}
                      onUpload={e => handleStaticImageUpload(e, "trustImageUrl")}
                      onClear={() => setStaticContent((prev: any) => ({ ...prev, trustImageUrl: "" }))}
                    />
                  </div>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Hero Section
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: ABOUT SECTION */}
          {activeTab === "about" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Compass className="w-5 h-5 text-[#504289]" /> About & Mission
                  </CardTitle>
                  <CardDescription>Configure brand details, checkboxes bullet checklist, and statistics charts.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <UploadZone 
                    label="About Showcase Image" 
                    imageUrl={staticContent.aboutImageUrl} 
                    isUploading={staticUploading === "aboutImageUrl"}
                    onUpload={e => handleStaticImageUpload(e, "aboutImageUrl")}
                    onClear={() => setStaticContent((prev: any) => ({ ...prev, aboutImageUrl: "" }))}
                  />

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Section Subtitle</label>
                        <Input 
                          value={staticContent.aboutSubtitle} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutSubtitle: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Section Title</label>
                        <Input 
                          value={staticContent.aboutTitle} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutTitle: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Section Description</label>
                      <Textarea 
                        value={staticContent.aboutDescription} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutDescription: e.target.value }))}
                        rows={4}
                        required
                        className="rounded-xl resize-none"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Checklist Bullets (Comma-separated)</label>
                      <Input 
                        value={staticContent.aboutBullets} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutBullets: e.target.value }))}
                        placeholder="e.g. Premium Strategy, 24/7 Monitoring, Fast Setup"
                        required
                        className="rounded-xl"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Campaigns Stat Count</label>
                        <Input 
                          value={staticContent.aboutCampaigns} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutCampaigns: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Active Clients Stat</label>
                        <Input 
                          value={staticContent.aboutClients} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutClients: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="border-t border-border pt-4 space-y-4">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-primary">About Page Specific Mission & Stats</h4>
                      
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Mission Title</label>
                        <Input 
                          value={staticContent.aboutMissionTitle || ""} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionTitle: e.target.value }))}
                          className="rounded-xl"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Mission Description</label>
                        <Textarea 
                          value={staticContent.aboutMissionDesc || ""} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionDesc: e.target.value }))}
                          rows={2}
                          className="rounded-xl resize-none"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">Mission Bullets (One per line)</label>
                        <Textarea 
                          value={staticContent.aboutMissionBullets || ""} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionBullets: e.target.value }))}
                          placeholder="e.g. Bullet One&#10;Bullet Two"
                          rows={3}
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">About Page Stats (One per line)</label>
                        <Textarea 
                          value={Array.isArray(staticContent.aboutStatsJson) ? staticContent.aboutStatsJson.join("\n") : ""} 
                          onChange={e => setStaticContent(prev => ({ ...prev, aboutStatsJson: e.target.value.split("\n").filter(Boolean) }))}
                          placeholder="e.g. 150+ Happy Businesses&#10;99.9% Success Rate"
                          rows={3}
                          className="rounded-xl font-mono text-xs"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save About Settings
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: SERVICES */}
          {activeTab === "services" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#504289]" /> Services Cards
                  </CardTitle>
                  <CardDescription>Manage the grid items that display your key service offerings.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    {Array.isArray(staticContent.servicesJson) && staticContent.servicesJson.map((service: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3 shadow-xs">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#504289] px-2 py-0.5 bg-[#504289]/10 rounded-md">Service #{idx + 1}</span>
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                            onClick={() => {
                              const updated = [...staticContent.servicesJson];
                              updated.splice(idx, 1);
                              setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">Service Title</label>
                              <Input
                                value={service.title || ""}
                                onChange={(e) => {
                                  const updated = [...staticContent.servicesJson];
                                  updated[idx] = { ...service, title: e.target.value };
                                  setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                                }}
                                required
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">Icon CSS Class</label>
                              <Input
                                value={service.icon || "flaticon-graphic-design"}
                                onChange={(e) => {
                                  const updated = [...staticContent.servicesJson];
                                  updated[idx] = { ...service, icon: e.target.value };
                                  setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                                }}
                                className="h-8 text-xs rounded-lg font-mono"
                              />
                            </div>
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Description</label>
                            <Textarea
                              value={service.description || ""}
                              onChange={(e) => {
                                const updated = [...staticContent.servicesJson];
                                updated[idx] = { ...service, description: e.target.value };
                                  setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                              }}
                              rows={2}
                              required
                              className="text-xs rounded-lg resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed rounded-xl py-6"
                    onClick={() => {
                      const updated = [...(staticContent.servicesJson || []), { title: "", description: "", icon: "flaticon-graphic-design" }];
                      setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                    }}
                  >
                    <Plus className="w-4 h-4" /> Add New Service Card
                  </Button>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Services Settings
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: TIMELINE ROADMAP PROCESS */}
          {activeTab === "process" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Play className="w-5 h-5 text-[#504289]" /> Roadmap Process & CTA Forms
                  </CardTitle>
                  <CardDescription>Setup the step-by-step roadmap items and the lead capture backdrop.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Section Subtitle</label>
                      <Input 
                        value={staticContent.processSubtitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, processSubtitle: e.target.value }))}
                        required
                        className="rounded-xl"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Section Title</label>
                      <Input 
                        value={staticContent.processTitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, processTitle: e.target.value }))}
                        required
                        className="rounded-xl"
                      />
                    </div>
                  </div>

                  {/* Render 4 steps */}
                  {[1, 2, 3, 4].map((num) => (
                    <div key={num} className="p-4 border border-border rounded-xl bg-muted/20 space-y-3">
                      <span className="text-[10px] font-bold text-foreground bg-primary/20 px-2 py-0.5 rounded">Step 0{num}</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Title</label>
                          <Input 
                            value={staticContent[`process${num}Title`] || ""} 
                            onChange={e => setStaticContent(prev => ({ ...prev, [`process${num}Title`]: e.target.value }))}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-semibold text-muted-foreground">Short Description</label>
                          <Input 
                            value={staticContent[`process${num}Desc`] || ""} 
                            onChange={e => setStaticContent(prev => ({ ...prev, [`process${num}Desc`]: e.target.value }))}
                            required
                            className="h-8 text-xs rounded-lg"
                          />
                        </div>
                      </div>
                    </div>
                  ))}

                  {/* Form Call to Action Segment */}
                  <div className="border-t border-border pt-4 space-y-4">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Contact / Lead Capture Backdrop</h4>
                    
                    <UploadZone 
                      label="Contact Area Background Image" 
                      imageUrl={staticContent.contactImageUrl} 
                      isUploading={staticUploading === "contactImageUrl"}
                      onUpload={e => handleStaticImageUpload(e, "contactImageUrl")}
                      onClear={() => setStaticContent((prev: any) => ({ ...prev, contactImageUrl: "" }))}
                    />

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">CTA Subtitle</label>
                        <Input 
                          value={staticContent.ctaSubtitle} 
                          onChange={e => setStaticContent(prev => ({ ...prev, ctaSubtitle: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-muted-foreground">CTA Title</label>
                        <Input 
                          value={staticContent.ctaTitle} 
                          onChange={e => setStaticContent(prev => ({ ...prev, ctaTitle: e.target.value }))}
                          required
                          className="rounded-xl"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">CTA Description text</label>
                      <Input 
                        value={staticContent.ctaDescription} 
                        onChange={e => setStaticContent(prev => ({ ...prev, ctaDescription: e.target.value }))}
                        required
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Timeline Settings
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: CLIENT LOGOS */}
          {activeTab === "clientlogos" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Award className="w-5 h-5 text-[#504289]" /> Client Logos Slider
                  </CardTitle>
                  <CardDescription>Upload customer brand logos displayed in the scrolling marquee banner.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="border-2 border-dashed border-border rounded-xl p-6 text-center bg-muted/10">
                    <UploadCloud className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <span className="text-xs font-semibold text-foreground block">Add Client Logo Graphic(s)</span>
                    <span className="text-[10px] text-muted-foreground block mt-1 mb-4">Multiple files can be chosen at once.</span>
                    <Input 
                      type="file" 
                      accept="image/*" 
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || files.length === 0) return;
                        
                        setStaticUploading("clientLogos");
                        const uploadedUrls: string[] = [];
                        
                        try {
                          for (let i = 0; i < files.length; i++) {
                            const file = files[i];
                            const formData = new FormData();
                            formData.append("image", file);
                            const res = await apiUpload<{ url: string }>("/landing-page/upload", formData);
                            uploadedUrls.push(res.url);
                          }
                          
                          setStaticContent((prev: any) => ({
                            ...prev,
                            clientLogos: [...(prev.clientLogos || []), ...uploadedUrls]
                          }));
                          toast({ title: "Uploaded", description: `${uploadedUrls.length} logo(s) added successfully.` });
                        } catch (error: any) {
                          toast({ title: "Upload Failed", description: error.message || "Upload failed.", variant: "destructive" });
                        } finally {
                          setStaticUploading(null);
                          e.target.value = '';
                        }
                      }} 
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

                  {Array.isArray(staticContent.clientLogos) && staticContent.clientLogos.length > 0 ? (
                    <div className="grid grid-cols-3 gap-4">
                      {staticContent.clientLogos.map((url: string, index: number) => (
                        <div key={index} className="border border-border p-3 rounded-xl bg-card relative group flex items-center justify-center min-h-[70px]">
                          <img src={url} alt={`Client ${index + 1}`} className="max-h-8 max-w-full object-contain" />
                          <button
                            type="button"
                            onClick={() => {
                              setStaticContent((prev: any) => ({
                                ...prev,
                                clientLogos: prev.clientLogos.filter((_: any, i: number) => i !== index)
                              }));
                            }}
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
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Client Logos
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: PRICING PACKAGES */}
          {activeTab === "packages" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <DollarSign className="w-5 h-5 text-[#504289]" /> Pricing Packages
                  </CardTitle>
                  <CardDescription>Setup agency subscriptions and packages shown to prospects.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {Array.isArray(staticContent.packagesJson) && staticContent.packagesJson.map((pkg: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-4">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-primary px-2 py-0.5 bg-primary/10 rounded-md">{pkg.name || "Unnamed Package"}</span>
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                            onClick={() => {
                              const updated = [...staticContent.packagesJson];
                              updated.splice(idx, 1);
                              setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                        <div className="space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">Package Name</label>
                              <Input
                                value={pkg.name || ""}
                                onChange={(e) => {
                                  const updated = [...staticContent.packagesJson];
                                  updated[idx] = { ...pkg, name: e.target.value };
                                  setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                                }}
                                required
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                            <div className="space-y-1">
                              <label className="text-[10px] font-bold text-muted-foreground uppercase">Price / Schedule</label>
                              <Input
                                value={pkg.price || ""}
                                onChange={(e) => {
                                  const updated = [...staticContent.packagesJson];
                                  updated[idx] = { ...pkg, price: e.target.value };
                                  setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                                }}
                                required
                                className="h-8 text-xs rounded-lg"
                              />
                            </div>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Best For / Tagline</label>
                            <Input
                              value={pkg.bestFor || ""}
                              onChange={(e) => {
                                const updated = [...staticContent.packagesJson];
                                updated[idx] = { ...pkg, bestFor: e.target.value };
                                setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                              }}
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Bullet Features (One per line)</label>
                            <Textarea
                              value={Array.isArray(pkg.features) ? pkg.features.join("\n") : ""}
                              onChange={(e) => {
                                const updated = [...staticContent.packagesJson];
                                updated[idx] = { ...pkg, features: e.target.value.split("\n").filter(Boolean) };
                                setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                              }}
                              rows={4}
                              required
                              className="text-xs rounded-lg font-sans"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed rounded-xl py-5"
                    onClick={() => {
                      const updated = [...(staticContent.packagesJson || []), { name: "", price: "", bestFor: "", features: [] }];
                      setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                    }}
                  >
                    <Plus className="w-4 h-4" /> Add Pricing Package Card
                  </Button>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save Packages Settings
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: CASE STUDIES */}
          {activeTab === "casestudies" && (
            <Card className="border border-border shadow-sm rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <FileText className="w-5 h-5 text-[#504289]" /> Case Studies Portfolio
                  </CardTitle>
                  <CardDescription>Showcase your visual success stories, views generated, ROAS etc.</CardDescription>
                </div>
                <Button size="sm" onClick={() => handleOpenCsDialog()} className="gap-1 rounded-xl text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Add Case Study
                </Button>
              </CardHeader>
              <CardContent>
                {caseStudies.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No custom case studies yet. Static items are rendering.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {caseStudies.map(study => (
                      <div key={study.id} className="border border-border rounded-xl p-3 flex gap-4 items-center bg-muted/15 shadow-xs">
                        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
                          <img src={study.imageUrl} alt={study.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-grow text-left">
                          <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">{study.category}</span>
                          <h4 className="text-xs font-bold text-foreground line-clamp-1">{study.title}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{study.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleOpenCsDialog(study)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="destructive" className="h-8 w-8 rounded-lg" onClick={() => handleDeleteCs(study.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB CONTENT: PROJECTS */}
          {activeTab === "projects" && (
            <Card className="border border-border shadow-sm rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Folder className="w-5 h-5 text-[#504289]" /> Portfolio Projects
                  </CardTitle>
                  <CardDescription>Manage the detailed case/project profiles displayed on your showcases.</CardDescription>
                </div>
                <Button size="sm" onClick={() => handleOpenPDialog()} className="gap-1 rounded-xl text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Add Project
                </Button>
              </CardHeader>
              <CardContent>
                {projects.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <Folder className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No projects configured. Showcase is empty.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {projects.map(project => (
                      <div key={project.id} className="border border-border rounded-xl p-3 flex gap-4 items-center bg-muted/15 shadow-xs">
                        <div className="w-16 h-16 bg-muted rounded-lg overflow-hidden shrink-0">
                          <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover" />
                        </div>
                        <div className="flex-grow text-left">
                          <span className="text-[9px] font-bold text-primary uppercase tracking-wider block">{project.category}</span>
                          <h4 className="text-xs font-bold text-foreground line-clamp-1">{project.title}</h4>
                          <p className="text-[10px] text-muted-foreground line-clamp-1">{project.description}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleOpenPDialog(project)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="destructive" className="h-8 w-8 rounded-lg" onClick={() => handleDeleteP(project.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB CONTENT: TESTIMONIALS */}
          {activeTab === "testimonials" && (
            <Card className="border border-border shadow-sm rounded-2xl">
              <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
                <div>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <ThumbsUp className="w-5 h-5 text-[#504289]" /> Client Reviews
                  </CardTitle>
                  <CardDescription>Manage user feedback testimonials and star ratings.</CardDescription>
                </div>
                <Button size="sm" onClick={() => handleOpenTDialog()} className="gap-1 rounded-xl text-xs font-bold">
                  <Plus className="w-3.5 h-3.5" /> Add Review
                </Button>
              </CardHeader>
              <CardContent>
                {testimonials.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/10">
                    <Star className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="text-xs">No client reviews configured. Default review slide showing.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {testimonials.map(t => (
                      <div key={t.id} className="border border-border rounded-xl p-3 flex gap-4 items-center bg-muted/15 shadow-xs">
                        <div className="w-12 h-12 bg-muted rounded-full overflow-hidden shrink-0">
                          {t.avatarUrl ? (
                            <img src={t.avatarUrl} alt={t.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-xs font-bold text-muted-foreground uppercase">{t.name[0]}</div>
                          )}
                        </div>
                        <div className="flex-grow text-left">
                          <h4 className="text-xs font-bold text-foreground line-clamp-1">{t.name}</h4>
                          <span className="text-[9px] text-muted-foreground block mb-0.5">{t.role}</span>
                          <div className="flex items-center text-yellow-500">
                            {[...Array(t.rating)].map((_, i) => (
                              <Star key={i} className="w-2.5 h-2.5 fill-current" />
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <Button size="icon" variant="outline" className="h-8 w-8 rounded-lg" onClick={() => handleOpenTDialog(t)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="destructive" className="h-8 w-8 rounded-lg" onClick={() => handleDeleteT(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* TAB CONTENT: FAQs */}
          {activeTab === "faqs" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <HelpIcon className="w-5 h-5 text-[#504289]" /> FAQ Accordions
                  </CardTitle>
                  <CardDescription>Setup questions and answers listed on your sales page footer.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {Array.isArray(staticContent.faqsJson) && staticContent.faqsJson.map((faq: any, idx: number) => (
                      <div key={idx} className="p-4 border border-border rounded-xl bg-muted/20 relative space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] font-bold text-[#504289] px-2 py-0.5 bg-[#504289]/10 rounded-md">FAQ #{idx + 1}</span>
                          <button
                            type="button"
                            className="text-xs text-destructive hover:underline flex items-center gap-1"
                            onClick={() => {
                              const updated = [...staticContent.faqsJson];
                              updated.splice(idx, 1);
                              setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                            }}
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Remove
                          </button>
                        </div>
                        <div className="space-y-2">
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Question Text</label>
                            <Input
                              value={faq.question || ""}
                              onChange={(e) => {
                                const updated = [...staticContent.faqsJson];
                                updated[idx] = { ...faq, question: e.target.value };
                                setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                              }}
                              required
                              className="h-8 text-xs rounded-lg"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[10px] font-bold text-muted-foreground uppercase">Answer Detail</label>
                            <Textarea
                              value={faq.answer || ""}
                              onChange={(e) => {
                                const updated = [...staticContent.faqsJson];
                                updated[idx] = { ...faq, answer: e.target.value };
                                setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                              }}
                              rows={2}
                              required
                              className="text-xs rounded-lg resize-none"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2 border-dashed rounded-xl py-5"
                    onClick={() => {
                      const updated = [...(staticContent.faqsJson || []), { question: "", answer: "" }];
                      setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                    }}
                  >
                    <Plus className="w-4 h-4" /> Add FAQ Item
                  </Button>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save FAQs Settings
                  </Button>
                </div>
              </Card>
            </form>
          )}

          {/* TAB CONTENT: SEO SETTINGS */}
          {activeTab === "seo" && (
            <form onSubmit={handleSaveContent}>
              <Card className="border border-border shadow-sm rounded-2xl">
                <CardHeader>
                  <CardTitle className="text-lg font-bold font-display flex items-center gap-2">
                    <Settings className="w-5 h-5 text-[#504289]" /> SEO & Taglines
                  </CardTitle>
                  <CardDescription>Tune landing page titles, keywords, description tags, and social graphic previews.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">SEO Meta Title</label>
                    <Input
                      value={staticContent.seoTitle || ""}
                      onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoTitle: e.target.value }))}
                      placeholder="e.g. AgencyFlow - Premium SMM Agency"
                      className="rounded-xl"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">SEO Meta Description</label>
                    <Textarea
                      value={staticContent.seoDescription || ""}
                      onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoDescription: e.target.value }))}
                      placeholder="Enter a brief summary..."
                      rows={3}
                      className="rounded-xl resize-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">SEO Keywords (Comma Separated)</label>
                    <Input
                      value={staticContent.seoKeywords || ""}
                      onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoKeywords: e.target.value }))}
                      placeholder="marketing, smm agency, design"
                      className="rounded-xl"
                    />
                  </div>

                  <UploadZone 
                    label="OG Social Share Image (1200x630px recommended)" 
                    imageUrl={staticContent.seoImage} 
                    isUploading={staticUploading === "seoImage"}
                    onUpload={e => handleStaticImageUpload(e, "seoImage")}
                    onClear={() => setStaticContent((prev: any) => ({ ...prev, seoImage: "" }))}
                  />

                  <div className="border-t border-border pt-4 space-y-1.5">
                    <label className="text-xs font-semibold text-muted-foreground">Footer Tagline Text</label>
                    <Input
                      value={staticContent.footerTagline || ""}
                      onChange={(e) => setStaticContent((prev: any) => ({ ...prev, footerTagline: e.target.value }))}
                      placeholder="We grow your business with creative marketing that delivers real results."
                      className="rounded-xl"
                    />
                  </div>
                </CardContent>
                <div className="p-6 border-t border-border flex justify-end bg-muted/20 rounded-b-2xl">
                  <Button type="submit" disabled={isSaving} className="gap-2 rounded-xl bg-[#504289] hover:bg-[#FFC107] text-white">
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Save SEO Settings
                  </Button>
                </div>
              </Card>
            </form>
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
                <button 
                  onClick={() => setPreviewMode("desktop")}
                  className={`p-1 rounded transition-colors ${previewMode === "desktop" ? "bg-[#504289] text-white" : "text-slate-400 hover:text-white"}`}
                  title="Desktop View"
                >
                  <MonitorIcon className="w-3.5 h-3.5" />
                </button>
                <button 
                  onClick={() => setPreviewMode("mobile")}
                  className={`p-1 rounded transition-colors ${previewMode === "mobile" ? "bg-[#504289] text-white" : "text-slate-400 hover:text-white"}`}
                  title="Mobile View"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                </button>
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
              <div 
                id="mock-section-hero"
                className={`p-6 bg-white transition-all relative border-b border-slate-100 ${
                  activeTab === 'hero' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'hero' && (
                  <span className="absolute top-2 right-2 text-[9px] font-extrabold uppercase bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Hero Edit</span>
                )}
                
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
              </div>

              {/* 2. MOCK BRAND MARQUEE (Matches brand-section-2) */}
              <div 
                id="mock-section-clientlogos"
                className={`py-4 bg-[#FAF9FF] border-y border-[#E6E6E6] transition-all relative ${
                  activeTab === 'clientlogos' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'clientlogos' && (
                  <span className="absolute top-1 right-2 text-[8px] font-bold bg-[#504289] text-white px-1.5 py-0.5 rounded shadow-sm animate-pulse z-10">Logos</span>
                )}
                <span className="text-[9px] font-extrabold uppercase text-[#696969] tracking-wider text-center block mb-2 opacity-80">
                  Brands We've Worked With
                </span>
                <div className="flex items-center justify-center gap-6 px-4 overflow-hidden">
                  {Array.isArray(staticContent.clientLogos) && staticContent.clientLogos.length > 0 ? (
                    staticContent.clientLogos.slice(0, 5).map((logo: string, idx: number) => (
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
              </div>

              {/* 3. MOCK ABOUT SECTION (Matches about-section fix section-padding) */}
              <div 
                id="mock-section-about"
                className={`p-6 bg-white transition-all relative border-b border-slate-100 ${
                  activeTab === 'about' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'about' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">About</span>
                )}
                
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
                      <img src="assets/img/bale.png" alt="bale" className="h-2.5" onerror="this.style.display='none'" />
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
                      <div className="bg-[#FAF9FF] p-2.5 rounded-xl border border-slate-100">
                        <span className="text-xs font-black text-[#504289] block">{staticContent.aboutCampaigns || "240+"}</span>
                        <span className="text-[8px] text-[#696969] block mt-0.5">Campaigns Run</span>
                      </div>
                      <div className="bg-[#FAF9FF] p-2.5 rounded-xl border border-slate-100">
                        <span className="text-xs font-black text-[#504289] block">{staticContent.aboutClients || "15+"}</span>
                        <span className="text-[8px] text-[#696969] block mt-0.5">Active Clients</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* 4. MOCK SERVICES (Matches service-section-4 fix bg-cover) */}
              <div 
                id="mock-section-services"
                className={`p-6 bg-[#101828] text-white transition-all relative border-b border-slate-900 ${
                  activeTab === 'services' ? 'bg-[#504289]/15 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'services' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Services</span>
                )}
                
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  Popular Services
                </span>
                <h3 className="text-sm font-bold text-white text-center mb-4 leading-snug">
                  We Provide Best Digital Marketing Services
                </h3>

                <div className="grid grid-cols-1 gap-3">
                  {Array.isArray(staticContent.servicesJson) && staticContent.servicesJson.length > 0 ? (
                    staticContent.servicesJson.slice(0, 3).map((svc: any, idx: number) => {
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
              </div>

              {/* 5. MOCK TIMELINE ROADMAP (Matches working-section-2) */}
              <div 
                id="mock-section-process"
                className={`p-6 bg-white transition-all relative border-b border-slate-100 ${
                  activeTab === 'process' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'process' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Roadmap</span>
                )}
                
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  {staticContent.processSubtitle || "How We Work"}
                </span>
                <h3 className="text-sm font-bold text-[#101828] text-center mb-5">
                  {staticContent.processTitle || "A Process Built On Strategy"}
                </h3>

                <div className="space-y-4">
                  {[1, 2, 3, 4].map((num) => {
                    const isEven = num % 2 === 0;
                    return (
                      <div 
                        key={num} 
                        className={`p-3 rounded-xl border border-slate-150 flex gap-3 items-center ${
                          isEven ? 'bg-[#FAF9FF]' : 'bg-white'
                        }`}
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
                    );
                  })}
                </div>
              </div>

              {/* 6. MOCK PRICING PACKAGES (Matches pricing-section) */}
              <div 
                id="mock-section-packages"
                className={`p-6 bg-[#FAF9FF] transition-all relative border-b border-slate-100 ${
                  activeTab === 'packages' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'packages' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Pricing</span>
                )}
                
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  Pricing Package
                </span>
                <h3 className="text-sm font-bold text-[#101828] text-center mb-5">
                  Flexible Packages Built For Your Growth
                </h3>

                <div className="space-y-4">
                  {Array.isArray(staticContent.packagesJson) && staticContent.packagesJson.length > 0 ? (
                    staticContent.packagesJson.slice(0, 3).map((pkg: any, idx: number) => {
                      const isActive = idx === 1; // Middle card holds active status in Next.js
                      return (
                        <div 
                          key={idx} 
                          className={`p-4 rounded-xl border bg-white transition-all relative overflow-hidden ${
                            isActive 
                              ? "border-[#504289] ring-1 ring-[#504289] shadow-md" 
                              : "border-slate-200"
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
              </div>

              {/* 7. MOCK PORTFOLIOS & PROJECTS */}
              <div 
                id="mock-section-projects"
                className={`p-6 bg-white transition-all relative border-b border-slate-100 ${
                  activeTab === 'projects' || activeTab === 'casestudies' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {(activeTab === 'projects' || activeTab === 'casestudies') && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Showcase</span>
                )}
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  Our Work
                </span>
                <h3 className="text-sm font-bold text-[#101828] text-center mb-4">
                  Case Studies & Projects
                </h3>

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
              </div>

              {/* 8. MOCK TESTIMONIALS SLIDER */}
              <div 
                id="mock-section-testimonials"
                className={`p-6 bg-[#101828] text-white transition-all relative border-b border-slate-900 ${
                  activeTab === 'testimonials' ? 'bg-[#504289]/15 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'testimonials' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">Reviews</span>
                )}
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  Testimonials
                </span>
                <h3 className="text-sm font-bold text-white text-center mb-4">
                  What Global Clients Say
                </h3>

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
              </div>

              {/* 9. MOCK FAQ (Matches Faq accordion) */}
              <div 
                id="mock-section-faqs"
                className={`p-6 bg-white transition-all relative border-b border-slate-100 ${
                  activeTab === 'faqs' ? 'bg-[#504289]/5 ring-2 ring-[#504289] ring-inset' : ''
                }`}
              >
                {activeTab === 'faqs' && (
                  <span className="absolute top-2 right-2 text-[9px] font-bold bg-[#504289] text-white px-2 py-0.5 rounded shadow-sm animate-pulse z-10">FAQ</span>
                )}
                <span className="text-[#504289] text-[9px] font-extrabold uppercase tracking-widest text-center block mb-1">
                  Some Questions
                </span>
                <h3 className="text-sm font-bold text-[#101828] text-center mb-4">
                  Frequently Asked Questions
                </h3>

                <div className="space-y-2">
                  {Array.isArray(staticContent.faqsJson) && staticContent.faqsJson.slice(0, 3).map((faq: any, fIdx: number) => {
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
              </div>

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

      {/* ─── DIALOGS REDESIGNED ─── */}
      
      {/* CASE STUDY CRUD DIALOG */}
      <Dialog open={csDialogOpen} onOpenChange={setCsDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-primary" />
              {csEditingId ? "Configure Case Study" : "Add Success Portfolio"}
            </DialogTitle>
            <DialogDescription>
              Detail a strategic marketing success story. Upload high-res images to showcase ROAS, views, or CTR.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-left">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Case Study Title</label>
              <Input 
                value={csForm.title} 
                onChange={e => setCsForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Organic Viral Reels Booster"
                className="rounded-xl"
              />
            </div>
            
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Category Tag</label>
              <Input 
                value={csForm.category} 
                onChange={e => setCsForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. TikTok Marketing"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Short Description & Outcomes</label>
              <Textarea 
                value={csForm.description} 
                onChange={e => setCsForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Include stats like: 12M views generated, 15% CTR increase..."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            <UploadZone 
              label="Feature Portfolio Image" 
              imageUrl={csForm.imageUrl} 
              isUploading={csUploading}
              onUpload={e => handleFileUpload(e, "case-study")}
              onClear={() => setCsForm(prev => ({ ...prev, imageUrl: "" }))}
            />
          </div>
          <DialogFooter className="bg-muted/10 p-4 border-t border-border -mx-6 -mb-6 rounded-b-2xl">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setCsDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl text-xs bg-[#504289] text-white hover:bg-[#FFC107]" onClick={handleSaveCs}>Save Case Study</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TESTIMONIAL CRUD DIALOG */}
      <Dialog open={tDialogOpen} onOpenChange={setTDialogOpen}>
        <DialogContent className="sm:max-w-[480px] rounded-2xl border-border p-6 shadow-2xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <ThumbsUp className="w-5 h-5 text-primary" />
              {tEditingId ? "Edit Review Card" : "New Client Review"}
            </DialogTitle>
            <DialogDescription>
              Create or edit a customer feedback review quote.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4 text-left">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Client Name</label>
                <Input 
                  value={tForm.name} 
                  onChange={e => setTForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="Sophia Carter"
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Role / Company</label>
                <Input 
                  value={tForm.role} 
                  onChange={e => setTForm(prev => ({ ...prev, role: e.target.value }))}
                  placeholder="Founder, Bloom"
                  className="rounded-xl"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Feedback Quote Text</label>
              <Textarea 
                value={tForm.feedback} 
                onChange={e => setTForm(prev => ({ ...prev, feedback: e.target.value }))}
                placeholder="Writing client review feedback..."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Rating Star Count (1-5)</label>
                <Input 
                  type="number"
                  min={1}
                  max={5}
                  value={tForm.rating} 
                  onChange={e => setTForm(prev => ({ ...prev, rating: parseInt(e.target.value) || 5 }))}
                  className="rounded-xl"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Avatar Image</label>
                <div className="flex gap-2">
                  <Input 
                    value={tForm.avatarUrl} 
                    onChange={e => setTForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    placeholder="/uploads/client.png"
                    className="rounded-xl text-xs flex-grow"
                  />
                  <label className="cursor-pointer bg-muted border border-border h-10 px-3 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 hover:bg-muted/80">
                    {tUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                    <input type="file" accept="image/*" onChange={e => handleFileUpload(e, "testimonial")} className="hidden" disabled={tUploading} />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter className="bg-muted/10 p-4 border-t border-border -mx-6 -mb-6 rounded-b-2xl">
            <Button variant="outline" className="rounded-xl text-xs" onClick={() => setTDialogOpen(false)}>Cancel</Button>
            <Button className="rounded-xl text-xs bg-[#504289] text-white hover:bg-[#FFC107]" onClick={handleSaveT}>Save Testimonial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Project Title</label>
                <Input value={pForm.title} onChange={e => setPForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. SEO Campaign & Redesign" className="rounded-xl" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Category Tag</label>
                <Input value={pForm.category} onChange={e => setPForm(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g. SEO, Design" className="rounded-xl" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Project Overview</label>
              <Textarea 
                value={pForm.description} 
                onChange={e => setPForm(prev => ({ ...prev, description: e.target.value }))} 
                placeholder="Provide a detailed description of the project achievements..."
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Project Metadata</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Client Name</label>
                  <Input value={pForm.clientName} onChange={e => setPForm(prev => ({ ...prev, clientName: e.target.value }))} className="h-9 text-xs rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Project Date</label>
                  <Input value={pForm.projectDate} onChange={e => setPForm(prev => ({ ...prev, projectDate: e.target.value }))} className="h-9 text-xs rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Location</label>
                  <Input value={pForm.location} onChange={e => setPForm(prev => ({ ...prev, location: e.target.value }))} className="h-9 text-xs rounded-xl" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-semibold text-muted-foreground">Duration</label>
                  <Input value={pForm.duration} onChange={e => setPForm(prev => ({ ...prev, duration: e.target.value }))} className="h-9 text-xs rounded-xl" />
                </div>
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Project Showcase Images (Up to 4)</h4>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { field: "imageUrl", label: "Image 1 (Primary Header)" },
                  { field: "imageUrl2", label: "Image 2 (Grid Right)" },
                  { field: "imageUrl3", label: "Image 3 (Grid Mid)" },
                  { field: "imageUrl4", label: "Image 4 (Grid Base)" }
                ].map(({ field, label }) => (
                  <div key={field} className="space-y-1">
                    <label className="text-[10px] font-bold text-muted-foreground uppercase">{label}</label>
                    <div className="flex gap-2">
                      <Input 
                        value={pForm[field] || ""} 
                        onChange={e => setPForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="/uploads/project..."
                        className="text-xs h-9 rounded-xl flex-grow"
                      />
                      <label className="cursor-pointer bg-muted border border-border h-9 px-3 flex items-center justify-center rounded-xl text-xs font-bold shrink-0 hover:bg-muted/80">
                        {pUploadingField === `project_${field}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <UploadCloud className="w-3.5 h-3.5" />}
                        <input type="file" accept="image/*" onChange={e => handleFileUpload(e, `project_${field}` as any)} className="hidden" disabled={pUploadingField !== null} />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary">Key Content Sections</h4>
                <Button type="button" size="sm" variant="outline" onClick={addSection} className="text-xs font-bold h-8 rounded-lg">
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Section
                </Button>
              </div>

              <div className="space-y-3">
                {pForm.sections && pForm.sections.map((section: any, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-xl bg-muted/15 relative space-y-3 shadow-xs">
                    <button 
                      type="button" 
                      className="absolute top-2.5 right-2.5 text-xs text-destructive hover:underline"
                      onClick={() => removeSection(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    
                    <div className="grid grid-cols-3 gap-3 pt-2">
                      <div className="col-span-1 space-y-1">
                        <label className="text-[9px] font-semibold uppercase text-muted-foreground">Section Title</label>
                        <Input value={section.title} onChange={e => updateSection(index, "title", e.target.value)} className="h-8 text-xs rounded-lg" />
                      </div>
                      <div className="col-span-2 space-y-1">
                        <label className="text-[9px] font-semibold uppercase text-muted-foreground">Short Content</label>
                        <Input value={section.content} onChange={e => updateSection(index, "content", e.target.value)} className="h-8 text-xs rounded-lg" />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-semibold uppercase text-muted-foreground">Checklist Bullets (Comma Separated)</label>
                      <Input 
                        value={section.bullets?.join(", ") || ""} 
                        onChange={e => updateSection(index, "bullets", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} 
                        placeholder="Bullet 1, Bullet 2"
                        className="h-8 text-xs rounded-lg"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
            <Button variant="outline" onClick={() => setPDialogOpen(false)} className="h-9 font-bold text-xs rounded-xl">Cancel</Button>
            <Button onClick={handleSaveP} className="h-9 font-bold text-xs rounded-xl gap-1 bg-[#504289] text-white hover:bg-[#FFC107]">
              <Save className="w-3.5 h-3.5" /> {pEditingId ? "Save Project" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

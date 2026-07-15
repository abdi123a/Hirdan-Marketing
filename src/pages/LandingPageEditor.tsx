import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiFetch, apiUpload } from "@/lib/api-client";
import { 
  Loader2, Save, FileText, Image as ImageIcon, Plus, Trash2, Edit2, 
  Star, LayoutGrid, CheckCircle2, ChevronRight, HelpCircle, Folder
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function LandingPageEditor() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

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
        <p className="text-sm text-muted-foreground">Loading landing page editor...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4 text-left max-w-6xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-bold font-display tracking-tight text-foreground flex items-center gap-2">
            <LayoutGrid className="w-8 h-8 text-primary" />
            Landing Page Editor
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Customize SMM Agency layout texts, case studies, and testimonials in real-time.
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <a 
            href={import.meta.env.VITE_LANDING_URL || "https://hirdanmarketing.com"} 
            target="_blank" 
            rel="noreferrer"
            className="px-4 py-2 border border-border hover:bg-muted text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors"
          >
            Preview Landing Page <ChevronRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>

      <Tabs defaultValue="hero" className="w-full flex flex-col gap-6">
        <TabsList className="bg-muted p-1 border border-border rounded-xl self-start flex-wrap h-auto gap-1">
          <TabsTrigger value="hero" className="rounded-lg text-xs font-bold px-4 py-2">Hero Section</TabsTrigger>
          <TabsTrigger value="about" className="rounded-lg text-xs font-bold px-4 py-2">About Section</TabsTrigger>
          <TabsTrigger value="services" className="rounded-lg text-xs font-bold px-4 py-2">Services</TabsTrigger>
          <TabsTrigger value="process" className="rounded-lg text-xs font-bold px-4 py-2">Roadmap Steps</TabsTrigger>
          <TabsTrigger value="packages" className="rounded-lg text-xs font-bold px-4 py-2">Pricing Packages</TabsTrigger>
          <TabsTrigger value="casestudies" className="rounded-lg text-xs font-bold px-4 py-2">Case Studies</TabsTrigger>
          <TabsTrigger value="projects" className="rounded-lg text-xs font-bold px-4 py-2">Projects</TabsTrigger>
          <TabsTrigger value="testimonials" className="rounded-lg text-xs font-bold px-4 py-2">Testimonials</TabsTrigger>
          <TabsTrigger value="faqs" className="rounded-lg text-xs font-bold px-4 py-2">FAQs</TabsTrigger>
          <TabsTrigger value="clientlogos" className="rounded-lg text-xs font-bold px-4 py-2">Client Logos</TabsTrigger>
          <TabsTrigger value="seo" className="rounded-lg text-xs font-bold px-4 py-2">SEO Settings</TabsTrigger>
        </TabsList>

        {/* ─── TAB: HERO SECTION ────────────────────────────────────────── */}
        <TabsContent value="hero">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">Hero Customization</CardTitle>
                <CardDescription>Configure the main title, descriptions, CTA actions, and trust badge.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hero Background Image</label>
                  <div className="flex items-center gap-4">
                    {staticContent.heroImageUrl && (
                      <img src={staticContent.heroImageUrl} alt="Hero" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => handleStaticImageUpload(e, "heroImageUrl")} 
                        disabled={staticUploading === "heroImageUrl"}
                      />
                      {staticUploading === "heroImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hero Background Shape Image</label>
                  <div className="flex items-center gap-4">
                    {staticContent.heroShapeImageUrl && (
                      <img src={staticContent.heroShapeImageUrl} alt="Shape" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => handleStaticImageUpload(e, "heroShapeImageUrl")} 
                        disabled={staticUploading === "heroShapeImageUrl"}
                      />
                      {staticUploading === "heroShapeImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hero Subtitle Badge Icon</label>
                  <div className="flex items-center gap-4">
                    {staticContent.heroBadgeImageUrl && (
                      <img src={staticContent.heroBadgeImageUrl} alt="Badge" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => handleStaticImageUpload(e, "heroBadgeImageUrl")} 
                        disabled={staticUploading === "heroBadgeImageUrl"}
                      />
                      {staticUploading === "heroBadgeImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Hero Badge Subtitle</label>
                  <Input 
                    value={staticContent.heroSubtitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroSubtitle: e.target.value }))}
                    placeholder="e.g. Social Media Marketing"
                    required
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Main Title Heading</label>
                  <Input 
                    value={staticContent.heroTitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroTitle: e.target.value }))}
                    placeholder="e.g. Growth With High-Impact Social Media"
                    required
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Description Content</label>
                  <Textarea 
                    value={staticContent.heroDescription} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroDescription: e.target.value }))}
                    placeholder="Brief intro text..."
                    rows={3}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Button 1 (Primary CTA) Text</label>
                  <Input 
                    value={staticContent.heroBtn1Text} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroBtn1Text: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Button 2 (Secondary CTA) Text</label>
                  <Input 
                    value={staticContent.heroBtn2Text} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroBtn2Text: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Award/Trust Statistics Number</label>
                  <Input 
                    value={staticContent.heroAwardNumber} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroAwardNumber: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Award/Trust Label Text</label>
                  <Input 
                    value={staticContent.heroAwardLabel} 
                    onChange={e => setStaticContent(prev => ({ ...prev, heroAwardLabel: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Trust/Award Image ("Trusted By 1M+ People")</label>
                  <div className="flex items-center gap-4">
                    {staticContent.trustImageUrl && (
                      <img src={staticContent.trustImageUrl} alt="Trust" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => handleStaticImageUpload(e, "trustImageUrl")} 
                        disabled={staticUploading === "trustImageUrl"}
                      />
                      {staticUploading === "trustImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Hero Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        {/* ─── TAB: ABOUT SECTION ───────────────────────────────────────── */}
        <TabsContent value="about">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">About Customization</CardTitle>
                <CardDescription>Configure about copywriting text, bullet points checklist, and agency growth counts.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">About Image</label>
                  <div className="flex items-center gap-4">
                    {staticContent.aboutImageUrl && (
                      <img src={staticContent.aboutImageUrl} alt="About" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                    )}
                    <div className="flex-1">
                      <Input 
                        type="file" 
                        accept="image/*" 
                        onChange={e => handleStaticImageUpload(e, "aboutImageUrl")} 
                        disabled={staticUploading === "aboutImageUrl"}
                      />
                      {staticUploading === "aboutImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">About Section Subtitle</label>
                  <Input 
                    value={staticContent.aboutSubtitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutSubtitle: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">About Section Title</label>
                  <Input 
                    value={staticContent.aboutTitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutTitle: e.target.value }))}
                    required
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">About Section Description</label>
                  <Textarea 
                    value={staticContent.aboutDescription} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutDescription: e.target.value }))}
                    rows={4}
                    required
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Checklist Bullets (Comma-separated)</label>
                  <Input 
                    value={staticContent.aboutBullets} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutBullets: e.target.value }))}
                    placeholder="e.g. Bullet 1, Bullet 2, Bullet 3"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Campaigns Managed Stat Count</label>
                  <Input 
                    value={staticContent.aboutCampaigns} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutCampaigns: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Total Active Clients Stat Count</label>
                  <Input 
                    value={staticContent.aboutClients} 
                    onChange={e => setStaticContent(prev => ({ ...prev, aboutClients: e.target.value }))}
                    required
                  />
                </div>

                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">About Page Mission & Stats</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Mission Title</label>
                      <Input 
                        value={staticContent.aboutMissionTitle || ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionTitle: e.target.value }))}
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Mission Description</label>
                      <Textarea 
                        value={staticContent.aboutMissionDesc || ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionDesc: e.target.value }))}
                        rows={2}
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Mission Bullets (One per line or Comma-separated)</label>
                      <Textarea 
                        value={staticContent.aboutMissionBullets || ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutMissionBullets: e.target.value }))}
                        placeholder="e.g. Bullet 1&#10;Bullet 2&#10;Bullet 3"
                        rows={3}
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">About Page Stats (One per line)</label>
                      <Textarea 
                        value={Array.isArray(staticContent.aboutStatsJson) ? staticContent.aboutStatsJson.join("\n") : ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, aboutStatsJson: e.target.value.split("\n").filter(Boolean) }))}
                        placeholder="e.g. 15+ Businesses We've Worked With&#10;8+ Years Of Experience"
                        rows={4}
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save About Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        {/* ─── TAB: ROADMAP STEPS ────────────────────────────────────────── */}
        <TabsContent value="process">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">Workflow Roadmap Steps</CardTitle>
                <CardDescription>Customize the step-by-step roadmap timeline graphics.</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Roadmap Subtitle</label>
                  <Input 
                    value={staticContent.processSubtitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, processSubtitle: e.target.value }))}
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">Roadmap Section Title</label>
                  <Input 
                    value={staticContent.processTitle} 
                    onChange={e => setStaticContent(prev => ({ ...prev, processTitle: e.target.value }))}
                    required
                  />
                </div>

                {/* Step 1 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">Step 01 - Discovery</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input 
                        value={staticContent.process1Title} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process1Title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <Input 
                        value={staticContent.process1Desc} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process1Desc: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Step 2 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">Step 02 - Development</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input 
                        value={staticContent.process2Title} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process2Title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <Input 
                        value={staticContent.process2Desc} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process2Desc: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">Step 03 - Optimization</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input 
                        value={staticContent.process3Title} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process3Title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <Input 
                        value={staticContent.process3Desc} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process3Desc: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Step 4 */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">Step 04 - Reporting</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input 
                        value={staticContent.process4Title || ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process4Title: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <Input 
                        value={staticContent.process4Desc || ""} 
                        onChange={e => setStaticContent(prev => ({ ...prev, process4Desc: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* CTA Form Text Section */}
                <div className="md:col-span-2 border-t border-border pt-4 mt-2">
                  <h4 className="text-sm font-bold text-foreground mb-4">CTA Section (Forms Area)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Contact Area Background Image</label>
                      <div className="flex items-center gap-4">
                        {staticContent.contactImageUrl && (
                          <img src={staticContent.contactImageUrl} alt="Contact" className="w-16 h-16 object-cover rounded shadow-sm border border-border" />
                        )}
                        <div className="flex-1">
                          <Input 
                            type="file" 
                            accept="image/*" 
                            onChange={e => handleStaticImageUpload(e, "contactImageUrl")} 
                            disabled={staticUploading === "contactImageUrl"}
                          />
                          {staticUploading === "contactImageUrl" && <span className="text-xs text-muted-foreground mt-1 inline-block">Uploading...</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Subtitle</label>
                      <Input 
                        value={staticContent.ctaSubtitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, ctaSubtitle: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Title</label>
                      <Input 
                        value={staticContent.ctaTitle} 
                        onChange={e => setStaticContent(prev => ({ ...prev, ctaTitle: e.target.value }))}
                        required
                      />
                    </div>
                    <div className="md:col-span-2 flex flex-col gap-1.5">
                      <label className="text-xs font-semibold text-muted-foreground">Description</label>
                      <Input 
                        value={staticContent.ctaDescription} 
                        onChange={e => setStaticContent(prev => ({ ...prev, ctaDescription: e.target.value }))}
                        required
                      />
                    </div>
                  </div>
                </div>

              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Steps Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        {/* ─── TAB: CASE STUDIES ────────────────────────────────────────── */}
        <TabsContent value="casestudies">
          <Card className="border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold font-display">Case Studies Portfolio</CardTitle>
                <CardDescription>Add, update, or remove SMM success stories.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenCsDialog()} className="gap-1.5 text-xs font-bold">
                <Plus className="w-4 h-4" /> Add Case Study
              </Button>
            </CardHeader>
            <CardContent>
              {caseStudies.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No custom case studies added yet. Displaying layout placeholders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {caseStudies.map(study => (
                    <div key={study.id} className="border border-border rounded-xl overflow-hidden flex flex-col justify-between bg-muted/20">
                      <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                        <img src={study.imageUrl} alt={study.title} className="w-full h-full object-cover" />
                      </div>
                      <div className="p-4 flex-grow text-left">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-widest block mb-1">{study.category}</span>
                        <h4 className="text-sm font-bold text-foreground line-clamp-1 mb-2">{study.title}</h4>
                        <p className="text-xs text-muted-foreground line-clamp-3 leading-relaxed font-light">{study.description}</p>
                      </div>
                      <div className="p-3 border-t border-border flex items-center justify-end gap-2 bg-card">
                        <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => handleOpenCsDialog(study)}>
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button size="sm" variant="destructive" className="h-8 px-2.5" onClick={() => handleDeleteCs(study.id)}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: PROJECTS ──────────────────────────────────────────────── */}
        <TabsContent value="projects">
          <Card className="border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold font-display">Landing Page Projects</CardTitle>
                <CardDescription>Manage the projects displayed on the portfolio page.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenPDialog()} className="gap-1.5 text-xs font-bold">
                <Plus className="w-4 h-4" /> Add Project
              </Button>
            </CardHeader>
            <CardContent>
              {projects.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-border rounded-xl bg-muted/20">
                  <Folder className="w-10 h-10 mx-auto text-muted-foreground mb-3 opacity-20" />
                  <p className="text-sm font-semibold text-foreground">No projects found</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">Click "Add Project" to showcase your work.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                  {projects.map(project => (
                    <div key={project.id} className="group border border-border bg-card rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-300">
                      <div className="h-40 w-full bg-muted relative overflow-hidden">
                        {project.imageUrl ? (
                          <img src={project.imageUrl} alt={project.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center opacity-30"><ImageIcon className="w-8 h-8" /></div>
                        )}
                        <div className="absolute top-3 left-3">
                          <span className="bg-background/90 backdrop-blur text-foreground text-[10px] font-bold px-2.5 py-1 rounded-md border border-border shadow-sm uppercase tracking-wide">
                            {project.category}
                          </span>
                        </div>
                      </div>
                      <div className="p-4 flex flex-col justify-between">
                        <div>
                          <h4 className="font-bold text-sm text-foreground mb-1.5 line-clamp-1">{project.title}</h4>
                          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{project.description}</p>
                        </div>
                        <div className="mt-4 pt-4 border-t border-border/60 flex items-center justify-between gap-2">
                          <Button size="sm" variant="outline" className="flex-1 h-8 text-xs font-bold" onClick={() => handleOpenPDialog(project)}>
                            <Edit2 className="w-3.5 h-3.5 mr-1.5" /> Edit
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 px-2.5" onClick={() => handleDeleteP(project.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: TESTIMONIALS ────────────────────────────────────────── */}
        <TabsContent value="testimonials">
          <Card className="border border-border shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between gap-4">
              <div>
                <CardTitle className="text-lg font-bold font-display">Client Testimonials</CardTitle>
                <CardDescription>Manage dynamic client feedback quotes slider.</CardDescription>
              </div>
              <Button size="sm" onClick={() => handleOpenTDialog()} className="gap-1.5 text-xs font-bold">
                <Plus className="w-4 h-4" /> Add Testimonial
              </Button>
            </CardHeader>
            <CardContent>
              {testimonials.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Star className="w-12 h-12 mx-auto mb-3 opacity-30" />
                  <p className="text-sm">No custom testimonials added yet. Displaying layout placeholders.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {testimonials.map(t => (
                    <div key={t.id} className="border border-border p-6 rounded-xl flex flex-col justify-between bg-muted/20 text-left">
                      <div>
                        <div className="flex items-center gap-1 text-secondary mb-3">
                          {[...Array(t.rating)].map((_, i) => (
                            <Star key={i} className="w-3.5 h-3.5 fill-current" />
                          ))}
                        </div>
                        <p className="text-sm italic font-light text-foreground/80 leading-relaxed mb-6">"{t.feedback}"</p>
                      </div>
                      <div className="flex items-center justify-between border-t border-border pt-4 bg-transparent">
                        <div className="flex items-center gap-3">
                          {t.avatarUrl && (
                            <img src={t.avatarUrl} alt={t.name} className="w-10 h-10 rounded-full object-cover border border-border" />
                          )}
                          <div>
                            <h4 className="text-xs font-bold text-foreground block">{t.name}</h4>
                            <span className="text-[10px] text-muted-foreground block">{t.role}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button size="sm" variant="outline" className="h-8 px-2.5" onClick={() => handleOpenTDialog(t)}>
                            <Edit2 className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="sm" variant="destructive" className="h-8 px-2.5" onClick={() => handleDeleteT(t.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─── TAB: CLIENT LOGOS ────────────────────────────────────────── */}
        <TabsContent value="clientlogos">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold font-display">Client Logos (Infinite Slider)</CardTitle>
                  <CardDescription>Upload client logos to display in the infinitely scrolling marquee on the landing page.</CardDescription>
                </div>
                <div className="flex items-center gap-2">
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
                        toast({ title: "Uploaded", description: `${uploadedUrls.length} logo(s) added. Remember to save settings!` });
                      } catch (error: any) {
                        toast({ title: "Upload Failed", description: error.message || "Image upload failed.", variant: "destructive" });
                      } finally {
                        setStaticUploading(null);
                        e.target.value = '';
                      }
                    }} 
                    disabled={staticUploading === "clientLogos"}
                    className="w-auto cursor-pointer"
                  />
                </div>
              </CardHeader>
              <CardContent>
                {staticUploading === "clientLogos" && <p className="text-sm text-muted-foreground mb-4">Uploading image...</p>}
                {!(staticContent.clientLogos?.length > 0) ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <ImageIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p className="text-sm">No client logos added yet. Static placeholders will be shown.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                    {staticContent.clientLogos.map((url: string, index: number) => (
                      <div key={index} className="border border-border p-4 rounded-xl flex flex-col justify-between bg-muted/20 items-center relative group">
                        <img src={url} alt={`Client Logo ${index + 1}`} className="max-w-full max-h-16 object-contain" />
                        <Button 
                          type="button"
                          variant="destructive" 
                          size="icon" 
                          className="absolute -top-2 -right-2 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity rounded-full shadow-md"
                          onClick={() => {
                            setStaticContent((prev: any) => ({
                              ...prev,
                              clientLogos: prev.clientLogos.filter((_: any, i: number) => i !== index)
                            }));
                          }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Client Logos
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        {/* ─── TAB: SEO SETTINGS ────────────────────────────────────────── */}
        <TabsContent value="seo">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader className="border-b border-border bg-card">
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  Landing Page SEO Settings
                </CardTitle>
                <CardDescription>
                  Optimize how your landing page appears on Google and other search engines. Good SEO settings are essential for generating organic search traffic.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-6">
                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-foreground">SEO Meta Title</label>
                    <span className="text-xs text-muted-foreground">
                      {(staticContent.seoTitle || "").length} / 60 chars (recommended)
                    </span>
                  </div>
                  <Input
                    value={staticContent.seoTitle || ""}
                    onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoTitle: e.target.value }))}
                    placeholder="e.g. SEOX - High-Impact Social Media Marketing Agency"
                    className="border border-input rounded-xl px-4 py-2.5 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    This is the main title displayed on Google search results. Keep it catchy and under 60 characters.
                  </p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center">
                    <label className="text-sm font-semibold text-foreground">SEO Meta Description</label>
                    <span className="text-xs text-muted-foreground">
                      {(staticContent.seoDescription || "").length} / 160 chars (recommended)
                    </span>
                  </div>
                  <Textarea
                    value={staticContent.seoDescription || ""}
                    onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoDescription: e.target.value }))}
                    placeholder="e.g. Whether you're a local business or national brand, we help you grow with custom high-impact marketing..."
                    className="border border-input rounded-xl px-4 py-2.5 text-sm min-h-[100px]"
                  />
                  <p className="text-xs text-muted-foreground">
                    A brief summary of your landing page. Google usually truncates descriptions longer than 150-160 characters.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">SEO Keywords (Comma Separated)</label>
                  <Input
                    value={staticContent.seoKeywords || ""}
                    onChange={(e) => setStaticContent((prev: any) => ({ ...prev, seoKeywords: e.target.value }))}
                    placeholder="e.g. social media agency, branding, marketing strategy, SEOX"
                    className="border border-input rounded-xl px-4 py-2.5 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    List relevant keywords separated by commas to help search crawlers categorize your website.
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-foreground">SEO Share Image (OG Image)</label>
                  <div className="flex items-center gap-4">
                    {staticContent.seoImage ? (
                      <div className="relative w-40 h-24 rounded-lg overflow-hidden border border-border bg-muted flex items-center justify-center">
                        <img 
                          src={staticContent.seoImage} 
                          alt="SEO Share Preview" 
                          className="object-cover w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="w-40 h-24 rounded-lg border border-dashed border-border bg-muted flex flex-col items-center justify-center text-muted-foreground">
                        <ImageIcon className="w-6 h-6 mb-1" />
                        <span className="text-[10px]">No Image</span>
                      </div>
                    )}
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2">
                        <Input
                          type="file"
                          accept="image/*"
                          id="seo-image-upload"
                          className="hidden"
                          onChange={(e) => handleStaticImageUpload(e, "seoImage")}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => document.getElementById("seo-image-upload")?.click()}
                          disabled={staticUploading === "seoImage"}
                          className="gap-2 text-xs font-semibold rounded-lg"
                        >
                          {staticUploading === "seoImage" ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Uploading...
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" />
                              Upload Share Image
                            </>
                          )}
                        </Button>
                        {staticContent.seoImage && (
                          <Button
                            type="button"
                            variant="destructive"
                            onClick={() => setStaticContent((prev: any) => ({ ...prev, seoImage: "" }))}
                            className="p-2 h-9 rounded-lg"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Recommended size: 1200x630 pixels. This image is displayed when your landing page is shared on social networks like Facebook, LinkedIn, Twitter, etc.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-2 border-t border-border pt-4">
                  <label className="text-sm font-semibold text-foreground">Footer Tagline Text</label>
                  <Input
                    value={staticContent.footerTagline || ""}
                    onChange={(e) => setStaticContent((prev: any) => ({ ...prev, footerTagline: e.target.value }))}
                    placeholder="e.g. We grow your business with creative marketing that delivers real results."
                    className="border border-input rounded-xl px-4 py-2.5 text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    This tagline text is shown in the footer layout under the agency logo.
                  </p>
                </div>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save SEO Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="services">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">Services Customization</CardTitle>
                <CardDescription>Configure the customer-facing services displayed on your home and services page.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {Array.isArray(staticContent.servicesJson) && staticContent.servicesJson.map((service: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-xl bg-muted/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-foreground">Service {idx + 1}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 px-2 hover:bg-destructive/10"
                          onClick={() => {
                            const updated = [...staticContent.servicesJson];
                            updated.splice(idx, 1);
                            setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Title</label>
                        <Input
                          value={service.title || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.servicesJson];
                            updated[idx] = { ...service, title: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Description</label>
                        <Textarea
                          value={service.description || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.servicesJson];
                            updated[idx] = { ...service, description: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                          }}
                          rows={3}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Icon Class</label>
                        <Input
                          value={service.icon || "flaticon-graphic-design"}
                          onChange={(e) => {
                            const updated = [...staticContent.servicesJson];
                            updated[idx] = { ...service, icon: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed"
                  onClick={() => {
                    const updated = [...(staticContent.servicesJson || []), { title: "", description: "", icon: "flaticon-graphic-design" }];
                    setStaticContent((prev: any) => ({ ...prev, servicesJson: updated }));
                  }}
                >
                  <Plus className="w-4 h-4" /> Add New Service Card
                </Button>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Services Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="faqs">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">Frequently Asked Questions</CardTitle>
                <CardDescription>Customize the FAQs displayed on the Home and Services pages.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  {Array.isArray(staticContent.faqsJson) && staticContent.faqsJson.map((faq: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-xl bg-muted/10 space-y-3 relative">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 w-6 h-6 text-destructive hover:bg-destructive/10"
                        onClick={() => {
                          const updated = [...staticContent.faqsJson];
                          updated.splice(idx, 1);
                          setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                        }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Question {idx + 1}</label>
                        <Input
                          value={faq.question || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.faqsJson];
                            updated[idx] = { ...faq, question: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-muted-foreground">Answer</label>
                        <Textarea
                          value={faq.answer || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.faqsJson];
                            updated[idx] = { ...faq, answer: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                          }}
                          rows={3}
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed"
                  onClick={() => {
                    const updated = [...(staticContent.faqsJson || []), { question: "", answer: "" }];
                    setStaticContent((prev: any) => ({ ...prev, faqsJson: updated }));
                  }}
                >
                  <Plus className="w-4 h-4" /> Add FAQ Item
                </Button>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save FAQs Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>

        <TabsContent value="packages">
          <form onSubmit={handleSaveContent}>
            <Card className="border border-border shadow-sm">
              <CardHeader>
                <CardTitle className="text-lg font-bold font-display">Pricing Packages</CardTitle>
                <CardDescription>Configure the package names, prices, features lists, and best-for descriptions shown on the pricing plan and service pages.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {Array.isArray(staticContent.packagesJson) && staticContent.packagesJson.map((pkg: any, idx: number) => (
                    <div key={idx} className="p-4 border border-border rounded-xl bg-muted/10 space-y-4">
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-foreground">{pkg.name || "New Package"}</h4>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-destructive h-7 px-2 hover:bg-destructive/10"
                          onClick={() => {
                            const updated = [...staticContent.packagesJson];
                            updated.splice(idx, 1);
                            setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                          }}
                        >
                          Remove
                        </Button>
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Package Name</label>
                        <Input
                          value={pkg.name || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.packagesJson];
                            updated[idx] = { ...pkg, name: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Price (e.g. 120,000 FDJ/month)</label>
                        <Input
                          value={pkg.price || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.packagesJson];
                            updated[idx] = { ...pkg, price: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                          }}
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Best For</label>
                        <Input
                          value={pkg.bestFor || ""}
                          onChange={(e) => {
                            const updated = [...staticContent.packagesJson];
                            updated[idx] = { ...pkg, bestFor: e.target.value };
                            setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-muted-foreground">Features (One per line)</label>
                        <Textarea
                          value={Array.isArray(pkg.features) ? pkg.features.join("\n") : ""}
                          onChange={(e) => {
                            const updated = [...staticContent.packagesJson];
                            updated[idx] = { ...pkg, features: e.target.value.split("\n").filter(Boolean) };
                            setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                          }}
                          rows={6}
                          required
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full gap-2 border-dashed"
                  onClick={() => {
                    const updated = [...(staticContent.packagesJson || []), { name: "", price: "", bestFor: "", features: [] }];
                    setStaticContent((prev: any) => ({ ...prev, packagesJson: updated }));
                  }}
                >
                  <Plus className="w-4 h-4" /> Add Pricing Package
                </Button>
              </CardContent>
              <div className="p-6 border-t border-border flex justify-end">
                <Button type="submit" disabled={isSaving} className="gap-2">
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Packages Settings
                </Button>
              </div>
            </Card>
          </form>
        </TabsContent>
      </Tabs>

      {/* ─── DIALOG: CASE STUDY CRUD ───────────────────────────────────── */}
      <Dialog open={csDialogOpen} onOpenChange={setCsDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{csEditingId ? "Edit Case Study" : "Add Case Study"}</DialogTitle>
            <DialogDescription>Create SMM case studies. Upload local images to make them public.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Case Study Title</label>
              <Input 
                value={csForm.title} 
                onChange={e => setCsForm(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g. Viral Reels Strategy"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Category</label>
              <Input 
                value={csForm.category} 
                onChange={e => setCsForm(prev => ({ ...prev, category: e.target.value }))}
                placeholder="e.g. TikTok & Reels"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Short Description</label>
              <Textarea 
                value={csForm.description} 
                onChange={e => setCsForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Details about outcomes, views generated, ROAS etc."
                rows={3}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Display Image</label>
              <div className="flex items-center gap-3">
                <Input 
                  value={csForm.imageUrl} 
                  onChange={e => setCsForm(prev => ({ ...prev, imageUrl: e.target.value }))}
                  placeholder="URL or upload a file"
                  className="flex-grow"
                />
                <label className="cursor-pointer bg-muted hover:bg-muted/80 border border-border h-10 px-4 flex items-center justify-center rounded-lg text-xs font-bold gap-2">
                  {csUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                  Upload
                  <input 
                    type="file" 
                    accept="image/*" 
                    onChange={e => handleFileUpload(e, "case-study")} 
                    className="hidden" 
                    disabled={csUploading}
                  />
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveCs}>Save Case Study</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: TESTIMONIAL CRUD ──────────────────────────────────── */}
      <Dialog open={tDialogOpen} onOpenChange={setTDialogOpen}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>{tEditingId ? "Edit Testimonial" : "Add Testimonial"}</DialogTitle>
            <DialogDescription>Create client feedback testimonial.</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-4 py-4 text-left">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Client Name</label>
              <Input 
                value={tForm.name} 
                onChange={e => setTForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Sophia Carter"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Client Role / Company</label>
              <Input 
                value={tForm.role} 
                onChange={e => setTForm(prev => ({ ...prev, role: e.target.value }))}
                placeholder="e.g. Founder, Bloom Cosmetics"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Feedback Quote</label>
              <Textarea 
                value={tForm.feedback} 
                onChange={e => setTForm(prev => ({ ...prev, feedback: e.target.value }))}
                placeholder="Client quote..."
                rows={4}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Rating Stars (1-5)</label>
                <Input 
                  type="number"
                  min={1}
                  max={5}
                  value={tForm.rating} 
                  onChange={e => setTForm(prev => ({ ...prev, rating: parseInt(e.target.value) || 5 }))}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Client Avatar</label>
                <div className="flex items-center gap-3">
                  <Input 
                    value={tForm.avatarUrl} 
                    onChange={e => setTForm(prev => ({ ...prev, avatarUrl: e.target.value }))}
                    placeholder="/uploads/branding/logo.png"
                    className="flex-grow text-xs"
                  />
                  <label className="cursor-pointer bg-muted hover:bg-muted/80 border border-border h-10 px-3 flex items-center justify-center rounded-lg text-xs font-bold gap-1">
                    {tUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    Upload
                    <input 
                      type="file" 
                      accept="image/*" 
                      onChange={e => handleFileUpload(e, "testimonial")} 
                      className="hidden" 
                      disabled={tUploading}
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTDialogOpen(false)}>Cancel</Button>
            <Button onClick={handleSaveT}>Save Testimonial</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── DIALOG: PROJECT ──────────────────────────────────────────── */}
      <Dialog open={pDialogOpen} onOpenChange={setPDialogOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden border-border shadow-2xl max-h-[85vh] flex flex-col">
          <DialogHeader className="p-6 pb-4 bg-muted/30 border-b border-border flex-shrink-0">
            <DialogTitle className="font-display font-bold text-xl">{pEditingId ? "Edit Project" : "Add Project"}</DialogTitle>
            <DialogDescription className="text-sm">Enter the project details and professional portfolio information below.</DialogDescription>
          </DialogHeader>
          
          <div className="p-6 space-y-6 overflow-y-auto flex-grow bg-background">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Project Title</label>
                <Input value={pForm.title} onChange={e => setPForm(prev => ({ ...prev, title: e.target.value }))} placeholder="e.g. Website Redesign & Development" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-semibold text-muted-foreground">Category</label>
                <Input value={pForm.category} onChange={e => setPForm(prev => ({ ...prev, category: e.target.value }))} placeholder="e.g. Design, Branding" />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Main Overview Description</label>
              <Textarea 
                value={pForm.description} 
                onChange={e => setPForm(prev => ({ ...prev, description: e.target.value }))} 
                placeholder="Designing a digital product and branding project involves several key steps..."
                rows={3}
                className="resize-none"
              />
            </div>

            {/* Metadata Fields */}
            <div className="border-t border-border pt-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">Project Metadata (Sidebar Info)</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Client Name</label>
                  <Input value={pForm.clientName} onChange={e => setPForm(prev => ({ ...prev, clientName: e.target.value }))} placeholder="e.g. Myron S." className="h-9 text-xs" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Project Date</label>
                  <Input value={pForm.projectDate} onChange={e => setPForm(prev => ({ ...prev, projectDate: e.target.value }))} placeholder="e.g. October, 2024" className="h-9 text-xs" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Location</label>
                  <Input value={pForm.location} onChange={e => setPForm(prev => ({ ...prev, location: e.target.value }))} placeholder="e.g. New York" className="h-9 text-xs" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground">Duration</label>
                  <Input value={pForm.duration} onChange={e => setPForm(prev => ({ ...prev, duration: e.target.value }))} placeholder="e.g. 1 month" className="h-9 text-xs" />
                </div>
              </div>
            </div>

            {/* Project Gallery Images */}
            <div className="border-t border-border pt-4 space-y-4">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Project Gallery Images (Up to 4)</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { field: "imageUrl", label: "Image 1 (Main Top-Left)" },
                  { field: "imageUrl2", label: "Image 2 (Top-Right)" },
                  { field: "imageUrl3", label: "Image 3 (Bottom-Left)" },
                  { field: "imageUrl4", label: "Image 4 (Bottom-Right)" }
                ].map(({ field, label }) => (
                  <div key={field} className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-semibold text-muted-foreground">{label}</label>
                    <div className="flex items-center gap-2">
                      <Input 
                        value={pForm[field] || ""} 
                        onChange={e => setPForm(prev => ({ ...prev, [field]: e.target.value }))}
                        placeholder="/uploads/branding/..."
                        className="text-xs h-9 flex-grow"
                      />
                      <label className="cursor-pointer bg-muted hover:bg-muted/80 border border-border h-9 px-3 flex items-center justify-center rounded-lg text-xs font-bold gap-1 shadow-sm">
                        {pUploadingField === `project_${field}` ? <Loader2 className="w-3 animate-spin" /> : <ImageIcon className="w-3 text-muted-foreground" />}
                        Upload
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={e => handleFileUpload(e, `project_${field}` as any)} 
                          className="hidden" 
                          disabled={pUploadingField !== null}
                        />
                      </label>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dynamic Content Sections Builder */}
            <div className="border-t border-border pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Detailed Content Sections</h4>
                <Button type="button" size="sm" variant="outline" onClick={addSection} className="text-xs font-bold h-8 gap-1">
                  <Plus className="w-3.5 h-3.5" /> Add Section
                </Button>
              </div>

              <div className="space-y-4">
                {pForm.sections && pForm.sections.map((section: any, index: number) => (
                  <div key={index} className="p-4 border border-border rounded-xl bg-muted/10 relative space-y-3">
                    <Button 
                      type="button" 
                      variant="ghost" 
                      size="icon" 
                      className="absolute top-2 right-2 w-6 h-6 text-destructive hover:bg-destructive/10" 
                      onClick={() => removeSection(index)}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-1 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Section Title</label>
                        <Input 
                          value={section.title} 
                          onChange={e => updateSection(index, "title", e.target.value)} 
                          placeholder="e.g. Project Initiation"
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="md:col-span-2 flex flex-col gap-1">
                        <label className="text-[10px] font-semibold text-muted-foreground">Description (Optional)</label>
                        <Input 
                          value={section.content} 
                          onChange={e => updateSection(index, "content", e.target.value)} 
                          placeholder="Short introductory text..."
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] font-semibold text-muted-foreground">Checklist Bullet Points (Comma-separated)</label>
                      <Input 
                        value={section.bullets?.join(", ") || ""} 
                        onChange={e => updateSection(index, "bullets", e.target.value.split(",").map(s => s.trim()).filter(Boolean))} 
                        placeholder="Bullet 1, Bullet 2, Bullet 3"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          
          <DialogFooter className="p-4 border-t border-border bg-muted/20 flex-shrink-0">
            <Button variant="outline" onClick={() => setPDialogOpen(false)} className="h-9 font-bold text-xs">Cancel</Button>
            <Button onClick={handleSaveP} className="h-9 font-bold text-xs gap-1.5 shadow-sm">
              <Save className="w-3.5 h-3.5" /> {pEditingId ? "Save Changes" : "Create Project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

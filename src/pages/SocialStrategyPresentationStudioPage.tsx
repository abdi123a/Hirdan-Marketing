import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Presentation, Users, Target, Compass, PieChart, Sparkles,
  FileDown, ChevronLeft, ChevronRight, Pencil, Maximize2, Minimize2,
  CheckCircle2, Building2, Zap, BarChart3, MessageSquare, Layers,
  Instagram, Linkedin, Youtube, Twitter, ArrowRight, Check, RefreshCw,
  Sun, Moon, ShieldCheck, Heart, MessageCircle, Smartphone, Upload,
  Phone, Mail, Globe, Save, ArrowLeft
} from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { useToast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";
import pptxgen from "pptxgenjs";
import { exportHtmlPagesPdf, serializeElementForPdf } from "@/lib/document-pdf";
import hirdanLogo from "@/assets/hirdan-logo.png";
import { ProtectedBrandingImage } from "@/components/ProtectedBrandingImage";

// ─── PLATFORM SVG ICONS ──────────────────────────────────────────

function TikTokIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="currentColor">
      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64c.29 0 .58.04.85.12V9.33a6.33 6.33 0 00-1-.08 6.34 6.34 0 106.34 6.34V8.56a8.28 8.28 0 004.92 1.58V6.69z"/>
    </svg>
  );
}

// ─── INTERACTIVE IMAGE PLACEHOLDER DROPZONE COMPONENT ─────────────

interface ImagePlaceholderProps {
  id: string;
  src?: string;
  defaultFallback?: string;
  onImageChange: (id: string, newSrc: string) => void;
  label?: string;
  className?: string;
}

function ImagePlaceholder({ id, src, defaultFallback, onImageChange, label = "Click to Upload Photo", className = "" }: ImagePlaceholderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const displaySrc = src || defaultFallback;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageChange(id, event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div 
      className={`relative group rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-slate-900/80 cursor-pointer transition-all duration-300 hover:border-amber-500 hover:shadow-lg flex flex-col items-center justify-center ${className}`}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileSelect} 
        accept="image/*" 
        className="hidden" 
      />

      {displaySrc ? (
        <>
          <img src={displaySrc} alt="Media Specimen" className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" />
          <div className="absolute inset-0 bg-slate-950/60 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col items-center justify-center text-white text-xs font-bold gap-1.5 backdrop-blur-xs">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center text-amber-400">
              <Pencil className="h-4 w-4" />
            </div>
            <span className="tracking-wide">Change Image</span>
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center p-4 text-center text-slate-400 group-hover:text-amber-500 transition-colors">
          <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 flex items-center justify-center mb-2 group-hover:scale-110 transition-transform">
            <Upload className="h-4 w-4" />
          </div>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-200">{label}</span>
          <span className="text-[10px] text-slate-400 mt-0.5">PNG, JPG or WebP</span>
        </div>
      )}
    </div>
  );
}

// ─── IPHONE MOCKUP FRAME ──────────────────────────────────────────

interface IPhoneMockupProps {
  platform: "INSTAGRAM" | "TIKTOK" | "LINKEDIN";
  accountName: string;
  handle: string;
  avatarText: string;
  hookText: string;
  likes: string;
  comments: string;
  caption: string;
  imageSrc?: string;
  onImageChange?: (newSrc: string) => void;
}

function IPhoneMockup({
  platform,
  accountName,
  handle,
  avatarText,
  hookText,
  likes,
  comments,
  caption,
  imageSrc,
  onImageChange
}: IPhoneMockupProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onImageChange) {
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          onImageChange(event.target.result as string);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="w-[240px] lg:w-[260px] h-[470px] bg-slate-900 rounded-[38px] p-3 border-[4px] border-slate-700 shadow-2xl relative flex flex-col justify-between select-none overflow-hidden text-white shrink-0 mx-auto">
      {/* Side Device Buttons */}
      <div className="absolute -left-[7px] top-24 w-[3px] h-10 bg-slate-600 rounded-l-sm" />
      <div className="absolute -left-[7px] top-38 w-[3px] h-10 bg-slate-600 rounded-l-sm" />
      <div className="absolute -right-[7px] top-28 w-[3px] h-14 bg-slate-600 rounded-r-sm" />

      {/* Dynamic Island */}
      <div className="w-24 h-4 bg-black rounded-full mx-auto z-30 flex items-center justify-center gap-2 mb-1">
        <div className="w-2 h-2 rounded-full bg-slate-800" />
        <div className="w-1.5 h-1.5 rounded-full bg-blue-900/60" />
      </div>

      {/* Mobile Screen Container */}
      <div className="flex-1 bg-slate-950 rounded-[28px] overflow-hidden relative flex flex-col justify-between border border-slate-800">
        
        {/* Top Status Bar */}
        <div className="h-6 px-4 pt-1 flex items-center justify-between text-[10px] text-slate-400 font-mono z-20">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <span>5G</span>
            <div className="w-4 h-2 border border-slate-400 rounded-sm p-0.5">
              <div className="w-full h-full bg-slate-200 rounded-xs" />
            </div>
          </div>
        </div>

        {/* Platform Header */}
        <div className="px-3 py-1.5 border-b border-slate-800/80 flex items-center justify-between z-20 bg-slate-950/80 backdrop-blur-md">
          <div className="flex items-center gap-2">
            {platform === "INSTAGRAM" && <Instagram className="h-4 w-4 text-pink-500" />}
            {platform === "TIKTOK" && <TikTokIcon className="h-4 w-4 text-cyan-400" />}
            <span className="text-xs font-bold tracking-tight">{handle}</span>
          </div>
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-slate-700 text-slate-300">
            Preview
          </Badge>
        </div>

        {/* Mobile Feed Viewport */}
        <div 
          className="flex-1 relative flex flex-col justify-between p-4 overflow-hidden bg-slate-900 group cursor-pointer"
          onClick={() => fileInputRef.current?.click()}
        >
          <input type="file" ref={fileInputRef} onChange={handleFileSelect} accept="image/*" className="hidden" />

          {imageSrc ? (
            <img src={imageSrc} alt="Post Specimen" className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-purple-950/60 via-indigo-950/40 to-slate-900" />
          )}

          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20" />

          {/* Hook Overlay */}
          <div className="relative z-10 my-auto bg-slate-900/90 border border-slate-700/80 p-3 rounded-xl text-center backdrop-blur-md shadow-xl">
            <Badge className="bg-amber-500/20 text-amber-300 text-[9px] mb-1 font-bold uppercase">
              ⚡ Viral Hook Concept
            </Badge>
            <p className="text-xs font-extrabold text-white leading-tight">
              "{hookText}"
            </p>
          </div>

          {/* Sidebar Actions */}
          <div className="absolute right-2 bottom-12 flex flex-col items-center gap-3 z-20 text-slate-300">
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-7 h-7 rounded-full bg-slate-800/80 flex items-center justify-center text-rose-500">
                <Heart className="h-3.5 w-3.5 fill-rose-500" />
              </div>
              <span className="text-[9px] font-mono">{likes}</span>
            </div>
            <div className="flex flex-col items-center gap-0.5">
              <div className="w-7 h-7 rounded-full bg-slate-800/80 flex items-center justify-center">
                <MessageCircle className="h-3.5 w-3.5" />
              </div>
              <span className="text-[9px] font-mono">{comments}</span>
            </div>
          </div>

          {/* Bottom Account Overlay */}
          <div className="relative z-10 space-y-1 pr-8">
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-500 to-amber-500 flex items-center justify-center font-bold text-[9px]">
                {avatarText}
              </div>
              <span className="text-xs font-bold text-white">{accountName}</span>
            </div>
            <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed font-medium">
              {caption}
            </p>
          </div>
        </div>

        {/* Home Bar */}
        <div className="h-4 flex items-center justify-center bg-slate-950 z-20">
          <div className="w-20 h-1 bg-slate-600 rounded-full" />
        </div>
      </div>
    </div>
  );
}

// ─── PRESENTATION DATA SCHEMA ─────────────────────────────────────

export interface StrategyPresentationData {
  id: string;
  clientId: string;
  clientName: string;
  companyName: string;
  agencyName: string;
  preparedBy: string;
  presentationDate: string;
  pageImages: Record<string, string>;
  clientSignOffName: string;
  clientSignOffDate: string;
  isSignedOff: boolean;
}

const createDefaultStrategyPresentation = (clientName: string = "Acme Global", companyName: string = "Acme Industries"): StrategyPresentationData => ({
  id: "deck-master-" + Date.now(),
  clientId: "",
  clientName: clientName,
  companyName: companyName,
  agencyName: "Hirdan Marketing Agency",
  preparedBy: "Lead Social Strategist",
  presentationDate: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }),
  pageImages: {},
  clientSignOffName: clientName,
  clientSignOffDate: new Date().toLocaleDateString("en-US"),
  isSignedOff: false
});

// ─── MAIN COMPONENT ───────────────────────────────────────────────

export function SocialStrategyPresentationStudioPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { clients, settings } = useAgencyStore();

  // Brand Design Tokens (Matching Premium Invoice standard)
  const primaryColor = settings.primaryColor || "#5A428A"; // Hirdan Deep Purple
  const accentColor = "#f6b317"; // Hirdan Gold Accent
  const darkTextColor = "#0f172a";

  const [selectedClientId, setSelectedClientId] = useState<string>("");
  const [deck, setDeck] = useState<StrategyPresentationData>(() => createDefaultStrategyPresentation());
  const [currentSlideIndex, setCurrentSlideIndex] = useState<number>(0);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [canvasTheme, setCanvasTheme] = useState<"light" | "dark">("light");
  const slideRef = useRef<HTMLDivElement>(null);

  // Sync client profile
  useEffect(() => {
    if (selectedClientId) {
      const client = clients.find(c => c.id === selectedClientId);
      if (client) {
        setDeck(prev => ({
          ...prev,
          clientId: client.id,
          clientName: client.name,
          companyName: client.company || client.name,
          clientSignOffName: client.name
        }));
        toast({
          title: "Client Profile Loaded",
          description: `Presentation synced for ${client.company || client.name}`
        });
      }
    }
  }, [selectedClientId, clients, toast]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Space") {
        setCurrentSlideIndex(prev => Math.min(prev + 1, 6));
      } else if (e.key === "ArrowLeft") {
        setCurrentSlideIndex(prev => Math.max(prev - 1, 0));
      } else if (e.key === "Escape" && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullscreen]);

  // Image Upload Handler
  const handleImageChange = (key: string, newSrc: string) => {
    setDeck(prev => ({
      ...prev,
      pageImages: {
        ...prev.pageImages,
        [key]: newSrc
      }
    }));
    toast({
      title: "Image Uploaded",
      description: "Photo updated in presentation deck."
    });
  };

  // High-Resolution PDF Exporter (Puppeteer via serialized slide HTML)
  const handleExportPDF = async () => {
    if (!slideRef.current) return;
    setIsExporting(true);
    toast({
      title: "Generating High-Res Strategy PDF...",
      description: "Capturing 7 exact presentation slides into PDF format..."
    });

    try {
      const originalSlideIndex = currentSlideIndex;
      const pages: string[] = [];

      for (let i = 0; i < 7; i++) {
        setCurrentSlideIndex(i);
        await new Promise((res) => setTimeout(res, 400));
        if (!slideRef.current) throw new Error("Slide canvas unavailable");
        pages.push(serializeElementForPdf(slideRef.current));
      }

      setCurrentSlideIndex(originalSlideIndex);
      await exportHtmlPagesPdf({
        pages,
        widthPx: 1400,
        heightPx: 787.5,
        filename: `${deck.companyName.replace(/\s+/g, "_")}_Social_Strategy.pdf`,
      });
      toast({
        title: "PDF Presentation Exported!",
        description: "Your 7-page PDF presentation with the real design is downloaded."
      });
    } catch (err) {
      console.error("PDF export error", err);
      toast({
        title: "Export Failed",
        description: "Could not generate PDF.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  // PowerPoint (.pptx) Generator with Exact Real Design Slide Images
  const handleExportPPTX = async () => {
    if (!slideRef.current) return;
    setIsExporting(true);
    toast({
      title: "Generating PowerPoint (.pptx) Deck...",
      description: "Capturing 7 exact presentation slides into PowerPoint..."
    });

    try {
      const originalSlideIndex = currentSlideIndex;
      const pptx = new pptxgen();
      pptx.layout = "LAYOUT_16x9";
      pptx.author = deck.preparedBy;
      pptx.company = settings.agencyName || deck.agencyName;
      pptx.title = `${deck.companyName} - Social Media Growth Strategy`;

      for (let i = 0; i < 7; i++) {
        setCurrentSlideIndex(i);
        await new Promise(res => setTimeout(res, 400));

        const canvas = await html2canvas(slideRef.current, {
          scale: 3,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: canvasTheme === "dark" ? "#090d16" : "#ffffff",
          windowWidth: 1400,
          windowHeight: 787.5
        });

        const imgData = canvas.toDataURL("image/png", 1.0);
        const slide = pptx.addSlide();
        slide.addImage({
          data: imgData,
          x: 0,
          y: 0,
          w: 10,
          h: 5.625
        });
      }

      setCurrentSlideIndex(originalSlideIndex);
      pptx.writeFile({ fileName: `${deck.companyName.replace(/\s+/g, "_")}_Social_Strategy.pptx` });
      toast({
        title: "PowerPoint Deck (.pptx) Exported!",
        description: "Your PowerPoint deck with the real visual design is downloaded."
      });
    } catch (err) {
      console.error("PPTX export error", err);
      toast({
        title: "PPTX Export Failed",
        description: "Could not generate PowerPoint file.",
        variant: "destructive"
      });
    } finally {
      setIsExporting(false);
    }
  };

  const slideTitles = [
    "Page 1 – Overview & Mission",
    "Page 2 – Comprehensive Brand Audit",
    "Page 3 – Competitor Analysis",
    "Page 4 – Audience Research",
    "Page 5 – Customized Strategy",
    "Page 6 – Content Plan & Inspiration",
    "Page 7 – Roadmap & Final Deliverables"
  ];

  return (
    <div className={`space-y-6 max-w-[1600px] animate-in fade-in duration-500 ${isFullscreen ? "fixed inset-0 z-50 bg-[#07090e] p-6 overflow-auto max-w-none" : ""}`}>
      
      {/* Top Controls Header */}
      {!isFullscreen && (
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-card/60 backdrop-blur-xl border border-border/60 p-5 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground hover:text-foreground" onClick={() => navigate('/dashboard/social-media')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl md:text-2xl font-display font-bold tracking-tight text-foreground flex items-center gap-2">
                  <Presentation className="h-5 w-5" style={{ color: primaryColor }} />
                  Social Strategy Presentation Studio
                </h1>
                <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5" style={{ backgroundColor: `${primaryColor}15`, color: primaryColor, borderColor: `${primaryColor}30` }}>
                  Agency Design System
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground font-medium mt-0.5">
                7-page executive strategy presentation built strictly matching your agency brand colors, watermark & signature
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Client Selector */}
            <div className="w-56">
              <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                <SelectTrigger className="h-9 text-xs bg-background/80 border-border/60 font-semibold">
                  <Building2 className="h-3.5 w-3.5 text-muted-foreground mr-1.5" />
                  <SelectValue placeholder="Select Client..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom-demo">✨ Preset: Demo Client</SelectItem>
                  {clients.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.company || c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Canvas Theme Toggle */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setCanvasTheme(prev => prev === "light" ? "dark" : "light")}
            >
              {canvasTheme === "light" ? <Sun className="h-3.5 w-3.5 text-amber-500" /> : <Moon className="h-3.5 w-3.5 text-indigo-400" />}
              {canvasTheme === "light" ? "Light Mode" : "Dark Mode"}
            </Button>

            {/* Edit Deck Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setIsEditModalOpen(true)}
            >
              <Pencil className="h-3.5 w-3.5 text-amber-500" />
              Edit Data
            </Button>

            {/* Fullscreen Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold"
              onClick={() => setIsFullscreen(true)}
            >
              <Maximize2 className="h-3.5 w-3.5" />
              Present
            </Button>

            {/* Export PowerPoint Button */}
            <Button
              variant="outline"
              size="sm"
              className="h-9 gap-1.5 text-xs font-semibold bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
              onClick={handleExportPPTX}
              disabled={isExporting}
            >
              {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5 text-amber-500" />}
              Export PPTX
            </Button>

            {/* Export PDF Button */}
            <Button
              size="sm"
              className="h-9 gap-1.5 text-xs font-bold text-white shadow-md"
              style={{ backgroundColor: primaryColor }}
              onClick={handleExportPDF}
              disabled={isExporting}
            >
              {isExporting ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FileDown className="h-3.5 w-3.5" />}
              Export PDF
            </Button>
          </div>
        </div>
      )}

      {/* Fullscreen Header */}
      {isFullscreen && (
        <div className="flex items-center justify-between bg-card/90 border border-border px-6 py-3 rounded-xl mb-4 text-foreground shadow-md">
          <div className="flex items-center gap-3">
            <Presentation className="h-5 w-5" style={{ color: primaryColor }} />
            <span className="font-display font-bold text-sm">{deck.companyName} — Social Media Strategy</span>
            <Badge className="text-[10px] uppercase font-bold text-white" style={{ backgroundColor: primaryColor }}>
              Page {currentSlideIndex + 1} of 7
            </Badge>
          </div>
          <Button variant="ghost" size="sm" className="h-8 text-xs font-semibold" onClick={() => setIsFullscreen(false)}>
            <Minimize2 className="h-4 w-4 mr-1.5" /> Exit Fullscreen
          </Button>
        </div>
      )}

      {/* ─── 16:9 MASTER PRESENTATION CANVAS (STRICT AGENCY BRANDING) ────────────────────────────── */}
      <div className="flex flex-col items-center">
        <div 
          className={`w-full max-w-[1400px] aspect-[16/9] border rounded-3xl shadow-2xl overflow-hidden relative transition-all duration-300 flex flex-col ${
            canvasTheme === "dark" 
              ? "bg-[#090d16] border-slate-800 text-white" 
              : "bg-white border-slate-200 text-slate-900"
          }`}
          ref={slideRef}
        >
          {/* Top Signature Dual Color Bar (Golden Standard) */}
          <div className="flex h-2.5 w-full z-20 relative">
            <div className="flex-1" style={{ backgroundColor: primaryColor }} />
            <div className="w-[30%]" style={{ backgroundColor: accentColor }} />
          </div>

          {/* Background Watermark */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0 opacity-[0.035] rotate-[-25deg] select-none">
            {settings.logo ? (
              <ProtectedBrandingImage
                src={settings.logo}
                alt="watermark"
                className="w-[70%] max-h-[70%] object-contain filter grayscale"
              />
            ) : (
              <div className="text-[140px] font-black uppercase text-center tracking-tighter" style={{ color: primaryColor }}>
                {settings.agencyName || "HIRDAN"}
              </div>
            )}
          </div>

          {/* Slide Top Bar */}
          <div className={`h-16 border-b px-8 flex items-center justify-between text-xs font-semibold relative z-10 ${
            canvasTheme === "dark" ? "border-slate-800/80 bg-slate-950/40 text-slate-400" : "border-slate-100 bg-slate-50/50 text-slate-600"
          }`}>
            <div className="flex items-center gap-4">
              <ProtectedBrandingImage
                src={settings.logo || hirdanLogo}
                alt={settings.agencyName}
                className="h-9 w-auto object-contain max-w-[180px]"
              />
              <span className="text-slate-300 font-light">|</span>
              <span className="font-bold text-xs uppercase tracking-wider" style={{ color: primaryColor }}>
                {deck.companyName}
              </span>
            </div>

            <div className="flex items-center gap-4">
              <span className="font-mono text-[11px] opacity-75">{deck.presentationDate}</span>
              <Badge variant="outline" className="text-[10px] font-bold px-2 py-0.5" style={{ borderColor: `${primaryColor}40`, color: primaryColor }}>
                PAGE {currentSlideIndex + 1} / 7
              </Badge>
            </div>
          </div>

          {/* Slide Main Content Area */}
          <div className="flex-1 p-8 lg:p-10 relative z-10 flex flex-col justify-between overflow-hidden">

            {/* ─── PAGE 1: WELCOME & OVERVIEW ─── */}
            {currentSlideIndex === 0 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in zoom-in-95 duration-500">
                <div className="grid grid-cols-12 gap-8 h-full items-stretch">
                  {/* Left Column Text Block */}
                  <div className="col-span-7 flex flex-col justify-between space-y-4">
                    <div className="space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                        <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                          Page 1 – Welcome & Project Overview
                        </span>
                      </div>

                      <h1 className="text-4xl lg:text-5xl font-display font-extrabold tracking-tight leading-tight" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                        Social Media Growth Strategy
                      </h1>

                      <div className={`p-5 rounded-2xl border ${
                        canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <p className="text-xs font-extrabold uppercase tracking-wider mb-1" style={{ color: primaryColor }}>
                          Our Mission
                        </p>
                        <p className="text-sm font-semibold leading-relaxed" style={{ color: canvasTheme === "dark" ? "#e2e8f0" : darkTextColor }}>
                          "To create a strategic social media presence that builds brand awareness, engages your target audience, and generates measurable business growth."
                        </p>
                      </div>
                    </div>

                    {/* Process Pipeline Bar */}
                    <div className="space-y-1.5">
                      <p className="text-[10px] font-bold uppercase text-slate-400">Our Strategy Process</p>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
                        {["Research", "Strategy", "Content Creation", "Approval", "Publishing", "Optimization", "Growth"].map((step, i) => (
                          <span key={i} className="flex items-center gap-1">
                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border text-slate-700 dark:text-slate-200">{step}</span>
                            {i < 6 && <span className="text-slate-400 text-xs">→</span>}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Right Column Cover Image Placeholder */}
                  <div className="col-span-5 h-full min-h-[260px]">
                    <ImagePlaceholder
                      id="cover-photo"
                      src={deck.pageImages["cover-photo"]}
                      onImageChange={handleImageChange}
                      label="Upload Cover / Team Photo"
                      className="h-full w-full"
                    />
                  </div>
                </div>

                {/* What You'll Receive Chips Block */}
                <div className={`p-4 rounded-2xl border mt-4 ${
                  canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50/80 border-slate-200"
                }`}>
                  <p className="text-[10px] uppercase font-bold text-slate-400 mb-2 tracking-wider">What You'll Receive</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2">
                    {[
                      "Comprehensive Brand Audit",
                      "Competitor Analysis",
                      "Audience Research",
                      "Customized Social Strategy",
                      "Content Plan & Creative Direction",
                      "Monthly Content Calendar",
                      "Performance Tracking & Reporting"
                    ].map((item, idx) => (
                      <div key={idx} className={`p-2 rounded-xl border text-[10px] font-bold flex items-center gap-1.5 ${
                        canvasTheme === "dark" ? "bg-slate-950/60 border-slate-800 text-slate-200" : "bg-white border-slate-200 text-slate-800 shadow-xs"
                      }`}>
                        <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                        <span className="leading-tight">{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── PAGE 2: BRAND AUDIT ─── */}
            {currentSlideIndex === 1 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 2 – Comprehensive Brand Audit
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    Understanding Your Brand
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">
                    Before creating content, we conduct a complete evaluation of your brand to identify strengths, opportunities, and areas for improvement.
                  </p>
                </div>

                <div className="grid grid-cols-12 gap-6 my-auto items-stretch">
                  <div className="col-span-8 grid grid-cols-2 gap-4">
                    {[
                      { title: "Brand Identity", bullets: ["Logo consistency", "Brand colors & typography", "Visual identity", "Brand messaging"] },
                      { title: "Social Profiles", bullets: ["Profile optimization", "Bio and call-to-action", "Profile & cover images", "Link optimization"] },
                      { title: "Content Performance", bullets: ["Content quality", "Engagement rate", "Posting consistency", "Reach & impressions"] },
                      { title: "Customer Experience", bullets: ["Response time", "Community engagement", "Reviews & feedback", "Brand reputation"] }
                    ].map((col, idx) => (
                      <div key={idx} className={`p-4 rounded-2xl border space-y-2 ${
                        canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                      }`}>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                            0{idx + 1}
                          </span>
                          <h4 className="text-sm font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>{col.title}</h4>
                        </div>
                        <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                          {col.bullets.map((b, i) => (
                            <li key={i} className="flex items-center gap-1.5"><span style={{ color: primaryColor }}>•</span> {b}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>

                  <div className="col-span-4 h-full min-h-[220px]">
                    <ImagePlaceholder
                      id="audit-photo"
                      src={deck.pageImages["audit-photo"]}
                      onImageChange={handleImageChange}
                      label="Upload Brand Audit Specimen"
                      className="h-full w-full"
                    />
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
                  canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Deliverable:</span>
                  <span className="font-bold" style={{ color: primaryColor }}>A professional Brand Audit Report with recommendations and action items.</span>
                </div>
              </div>
            )}

            {/* ─── PAGE 3: COMPETITOR ANALYSIS ─── */}
            {currentSlideIndex === 2 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 3 – Competitor Analysis
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    Understanding Your Market Position
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">We research your competitors to discover what works, identify gaps, and position your brand effectively.</p>
                </div>

                <div className="grid grid-cols-12 gap-6 my-auto items-center">
                  <div className="col-span-7 grid grid-cols-2 gap-4">
                    <div className={`p-5 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase text-amber-500">We Analyze</p>
                      <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                        {["Top competitors", "Content strategy & frequency", "Engagement performance", "Branding & video strategy", "Strengths and weaknesses"].map((item, i) => (
                          <li key={i} className="flex items-center gap-1.5">• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={`p-5 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase" style={{ color: primaryColor }}>Opportunities We Identify</p>
                      <ul className="text-xs space-y-1.5 text-slate-600 dark:text-slate-300">
                        {["Untapped content ideas", "Market gaps", "Trending content formats", "Competitive advantages", "Positioning opportunities"].map((item, i) => (
                          <li key={i} className="flex items-center gap-1.5">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="col-span-5 grid grid-cols-2 gap-3 h-[220px]">
                    <ImagePlaceholder id="comp-photo-1" src={deck.pageImages["comp-photo-1"]} onImageChange={handleImageChange} label="Competitor Specimen 1" className="h-full" />
                    <ImagePlaceholder id="comp-photo-2" src={deck.pageImages["comp-photo-2"]} onImageChange={handleImageChange} label="Competitor Specimen 2" className="h-full" />
                  </div>
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
                  canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Deliverable:</span>
                  <span className="font-bold" style={{ color: primaryColor }}>A Competitor Analysis Report with actionable recommendations.</span>
                </div>
              </div>
            )}

            {/* ─── PAGE 4: AUDIENCE RESEARCH ─── */}
            {currentSlideIndex === 3 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 4 – Audience Research
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    Understanding Your Ideal Customers
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Great content starts with understanding who you're trying to reach.</p>
                </div>

                <div className="grid grid-cols-12 gap-6 my-auto items-stretch">
                  <div className="col-span-8 grid grid-cols-2 gap-4">
                    <div className={`p-4 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase" style={{ color: primaryColor }}>Customer Profile</p>
                      <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                        {["Age groups & Gender", "Geographic location & Languages", "Interests & Profession", "Buying behavior & Triggers"].map((item, i) => (
                          <li key={i} className="flex items-center gap-1.5">• {item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase text-amber-500">Audience Insights</p>
                      <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                        {["Pain points & Goals", "FAQs & motivations", "Preferred content formats", "Online behavior"].map((item, i) => (
                          <li key={i} className="flex items-center gap-1.5">• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="col-span-4 h-full min-h-[200px]">
                    <ImagePlaceholder id="persona-photo" src={deck.pageImages["persona-photo"]} onImageChange={handleImageChange} label="Upload Persona Photo" className="h-full w-full" />
                  </div>
                </div>

                {/* Customer Journey Pipeline */}
                <div className={`p-4 rounded-xl border space-y-1.5 ${
                  canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <p className="text-[10px] font-bold uppercase text-slate-400">Customer Journey Pipeline</p>
                  <div className="flex items-center justify-between text-xs font-bold">
                    {["Awareness", "Interest", "Consideration", "Purchase", "Loyalty", "Advocacy"].map((step, i) => (
                      <span key={i} className="flex items-center gap-2">
                        <span className="px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 border" style={{ color: primaryColor }}>{step}</span>
                        {i < 5 && <span className="text-slate-400 text-xs">→</span>}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ─── PAGE 5: CUSTOMIZED STRATEGY ─── */}
            {currentSlideIndex === 4 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 5 – Customized Social Media Strategy
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    Your Personalized Growth Plan
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Using the research gathered, we develop a strategy tailored specifically to your business objectives.</p>
                </div>

                <div className="grid grid-cols-4 gap-4 my-auto">
                  {[
                    { title: "Business Goals", bullets: ["Brand awareness", "Lead generation", "Sales growth", "Customer retention", "Community building"] },
                    { title: "Content Pillars", bullets: ["Educational", "Promotional", "Social Proof", "Behind the Scenes", "Entertainment"] },
                    { title: "Platform Strategy", bullets: ["Instagram", "Facebook", "TikTok", "LinkedIn", "X (Twitter)"] },
                    { title: "Creative Direction", bullets: ["Visual style & voice", "Video concepts", "Graphic design", "Storytelling approach"] }
                  ].map((col, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border space-y-2 flex flex-col justify-between ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className="w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px]" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>
                            0{idx + 1}
                          </span>
                          <h4 className="text-sm font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>{col.title}</h4>
                        </div>
                        <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                          {col.bullets.map((b, i) => (
                            <li key={i} className="flex items-center gap-1.5">• {b}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ))}
                </div>

                <div className={`p-4 rounded-xl border flex items-center justify-between gap-4 text-xs ${
                  canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                }`}>
                  <span className="font-bold text-slate-400 uppercase text-[10px]">Deliverable:</span>
                  <span className="font-bold" style={{ color: primaryColor }}>A complete Social Media Strategy document with clear recommendations and next steps.</span>
                </div>
              </div>
            )}

            {/* ─── PAGE 6: CONTENT PLAN & INSPIRATION (WITH IPHONE MOCKUP) ─── */}
            {currentSlideIndex === 5 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 6 – Content Plan & Inspiration
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    Bringing the Strategy to Life
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">Monthly content calendar, short-form reels & creative trends</p>
                </div>

                <div className="grid grid-cols-12 gap-6 my-auto items-center">
                  <div className="col-span-7 space-y-4">
                    <div className={`p-4 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase text-amber-500">Monthly Content Calendar & Types</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        {["Reels & Shorts", "Carousels", "Stories", "Static Posts", "Educational Graphics", "Viral Concepts"].map((ct, i) => (
                          <Badge key={i} variant="outline" className="text-[10px] font-medium justify-center py-1">
                            {ct}
                          </Badge>
                        ))}
                      </div>
                    </div>

                    <div className={`p-4 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <p className="text-xs font-bold uppercase" style={{ color: primaryColor }}>Inspiration Library Insights</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                        Curated examples of high-performing Reels, viral video hooks, carousel designs, and story ideas — with exact breakdowns of why each concept works and how to adapt it to your brand.
                      </p>
                    </div>
                  </div>

                  <div className="col-span-5 flex items-center justify-center">
                    <IPhoneMockup
                      platform="INSTAGRAM"
                      accountName={deck.companyName}
                      handle={`@${deck.companyName.toLowerCase().replace(/\s+/g, "")}`}
                      avatarText={deck.companyName.charAt(0)}
                      hookText="Stop making this #1 social media mistake in 2026..."
                      likes="24.5K"
                      comments="512"
                      caption="Tap to upload your own video frame / mockup image!"
                      imageSrc={deck.pageImages["reel-preview-photo"]}
                      onImageChange={(src) => handleImageChange("reel-preview-photo", src)}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* ─── PAGE 7: IMPLEMENTATION ROADMAP & DIGITAL SIGN-OFF ─── */}
            {currentSlideIndex === 6 && (
              <div className="h-full flex flex-col justify-between animate-in fade-in slide-in-from-right-4 duration-500">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-4 h-0.5" style={{ backgroundColor: primaryColor }} />
                    <span className="text-[10px] font-extrabold uppercase tracking-widest" style={{ color: primaryColor }}>
                      Page 7 – Implementation & Growth Roadmap
                    </span>
                  </div>
                  <h2 className="text-3xl lg:text-4xl font-display font-bold" style={{ color: canvasTheme === "dark" ? "#ffffff" : darkTextColor }}>
                    From Strategy to Results & Final Deliverables
                  </h2>
                  <p className="text-xs text-slate-500 font-medium mt-1">4-Phase execution pipeline & onboarding deliverables checklist</p>
                </div>

                <div className="grid grid-cols-4 gap-4 my-auto">
                  {[
                    { phase: "Phase 1 – Research", bullets: ["Brand Audit", "Competitor Analysis", "Audience Research"] },
                    { phase: "Phase 2 – Strategy", bullets: ["Customized Strategy", "Content Calendar", "Creative Planning"] },
                    { phase: "Phase 3 – Execution", bullets: ["Content Creation & Design", "Video Editing", "Scheduling & Publishing"] },
                    { phase: "Phase 4 – Optimization", bullets: ["Performance Monitoring", "Monthly Analytics", "Strategy Adjustments"] }
                  ].map((p, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border space-y-2 ${
                      canvasTheme === "dark" ? "bg-slate-900/80 border-slate-800" : "bg-slate-50 border-slate-200"
                    }`}>
                      <Badge className="text-[10px] font-bold" style={{ backgroundColor: `${primaryColor}20`, color: primaryColor }}>{p.phase}</Badge>
                      <ul className="text-xs space-y-1 text-slate-600 dark:text-slate-300">
                        {p.bullets.map((b, i) => (
                          <li key={i} className="flex items-center gap-1.5">• {b}</li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>

                {/* Final Deliverables Checklist & Sign-off */}
                <div className="space-y-3">
                  <div className={`p-3.5 rounded-2xl border ${
                    canvasTheme === "dark" ? "bg-slate-900/60 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <p className="text-xs font-bold uppercase mb-1.5" style={{ color: primaryColor }}>Final Deliverables Checklist</p>
                    <div className="grid grid-cols-3 md:grid-cols-9 gap-1.5 text-[10px] font-bold">
                      {[
                        "Brand Audit", "Competitor Analysis", "Audience Research",
                        "Social Strategy", "Content Pillars", "Content Calendar",
                        "Inspiration Library", "KPI Framework", "90-Day Roadmap"
                      ].map((item, i) => (
                        <div key={i} className={`p-1.5 rounded-lg border flex items-center justify-center gap-1 text-center ${
                          canvasTheme === "dark" ? "bg-slate-950/60 border-slate-800 text-slate-200" : "bg-white border-slate-200 shadow-xs"
                        }`}>
                          <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Sign Off Authorization Bar */}
                  <div className={`p-4 rounded-2xl border flex items-center justify-between gap-4 text-xs ${
                    canvasTheme === "dark" ? "bg-slate-900/90 border-slate-800" : "bg-slate-50 border-slate-200"
                  }`}>
                    <div>
                      <p className="font-bold uppercase text-[10px]" style={{ color: primaryColor }}>Strategy Authorization</p>
                      <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5">Approved for <span className="font-bold">{deck.clientSignOffName}</span> on {deck.clientSignOffDate}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {settings.stamp && (
                        <ProtectedBrandingImage src={settings.stamp} alt="stamp" className="h-10 w-auto object-contain" />
                      )}
                      {settings.signature && (
                        <ProtectedBrandingImage src={settings.signature} alt="signature" className="h-8 w-auto object-contain" />
                      )}

                      <Button
                        size="sm"
                        className="h-8 px-4 gap-1.5 text-xs font-bold text-white shadow-xs"
                        style={{ backgroundColor: deck.isSignedOff ? "#10b981" : primaryColor }}
                        onClick={() => {
                          setDeck(prev => ({ ...prev, isSignedOff: !prev.isSignedOff }));
                          toast({
                            title: deck.isSignedOff ? "Sign-Off Reset" : "Strategy Approved!",
                            description: deck.isSignedOff ? "Marked as pending." : `Strategy authorized for ${deck.companyName}`
                          });
                        }}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {deck.isSignedOff ? "Strategy Authorized ✓" : "Authorize Strategy"}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>

          {/* Slide Bottom Bar */}
          <div className={`h-10 border-t px-8 flex items-center justify-between text-[11px] relative z-10 font-mono ${
            canvasTheme === "dark" ? "border-slate-800/80 bg-slate-950/40 text-slate-500" : "border-slate-100 bg-slate-50/50 text-slate-400"
          }`}>
            <span>{deck.companyName} Confidential • {settings.agencyName || deck.agencyName} Strategy Presentation</span>
            <span>Page {currentSlideIndex + 1} of 7</span>
          </div>
        </div>

        {/* Slide Navigation Controls */}
        <div className="w-full max-w-[1400px] mt-4 bg-card/60 backdrop-blur-xl border border-border/60 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentSlideIndex(prev => Math.max(prev - 1, 0))}
              disabled={currentSlideIndex === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <span className="text-xs font-semibold px-2">
              Page {currentSlideIndex + 1} of 7
            </span>

            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setCurrentSlideIndex(prev => Math.min(prev + 1, 6))}
              disabled={currentSlideIndex === 6}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Slide Thumbnails */}
          <div className="flex items-center gap-1.5 overflow-x-auto max-w-full py-1">
            {slideTitles.map((title, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentSlideIndex(idx)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all shrink-0 ${
                  currentSlideIndex === idx
                    ? "text-white shadow-sm"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground"
                }`}
                style={currentSlideIndex === idx ? { backgroundColor: primaryColor } : {}}
              >
                {title}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── LIVE DATA EDITING MODAL ────────────────────────────────────────── */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="h-4 w-4" style={{ color: primaryColor }} /> Edit Presentation Master Data
            </DialogTitle>
            <DialogDescription>
              Customize headlines and company details for {deck.companyName}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-4 py-3">
            <div className="space-y-2">
              <Label>Company Name</Label>
              <Input value={deck.companyName} onChange={e => setDeck({ ...deck, companyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Client Contact Name</Label>
              <Input value={deck.clientName} onChange={e => setDeck({ ...deck, clientName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Agency Name</Label>
              <Input value={deck.agencyName} onChange={e => setDeck({ ...deck, agencyName: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Presentation Date</Label>
              <Input value={deck.presentationDate} onChange={e => setDeck({ ...deck, presentationDate: e.target.value })} />
            </div>
          </div>

          <DialogFooter>
            <Button style={{ backgroundColor: primaryColor, color: '#ffffff' }} onClick={() => {
              setIsEditModalOpen(false);
              toast({ title: "Changes Saved", description: "Presentation data updated successfully." });
            }}>
              <Save className="h-4 w-4 mr-1.5" /> Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default SocialStrategyPresentationStudioPage;

import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useEffect } from "react";
import { 
  Download, Clock, File, FileText, FileSpreadsheet, FileArchive, 
  FileImage, FileVideo, FileAudio, AlertCircle, ShieldCheck,
  Sparkles, Building, Globe, Zap, ArrowRight, Play
} from "lucide-react";
import { useAgencyStore } from "@/lib/store";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import hirdanLogo from "@/assets/hirdan-logo.png";

interface SharedFileMetadata {
  fileName: string;
  fileSize: number;
  mimeType: string;
  message: string | null;
  expiresAt: string;
  expired?: boolean;
}

const API_BASE = import.meta.env.VITE_API_URL || "/api";

function formatBytes(bytes: number) {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "pdf":
      return <FileText className="h-16 w-16 text-rose-500" />;
    case "xlsx":
    case "xls":
    case "csv":
      return <FileSpreadsheet className="h-16 w-16 text-emerald-500" />;
    case "zip":
    case "rar":
    case "7z":
    case "tar":
    case "gz":
      return <FileArchive className="h-16 w-16 text-amber-500" />;
    case "png":
    case "jpg":
    case "jpeg":
    case "gif":
    case "webp":
    case "svg":
      return <FileImage className="h-16 w-16 text-blue-500" />;
    case "mp4":
    case "mov":
    case "avi":
    case "mkv":
      return <FileVideo className="h-16 w-16 text-purple-500" />;
    case "mp3":
    case "wav":
    case "ogg":
    case "aac":
      return <FileAudio className="h-16 w-16 text-teal-500" />;
    default:
      return <File className="h-16 w-16 text-muted-foreground" />;
  }
}

function isImageFile(fileName: string, mimeType?: string) {
  if (mimeType?.startsWith("image/")) return true;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
}

function isVideoFile(fileName: string, mimeType?: string) {
  if (mimeType?.startsWith("video/")) return true;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return ["mp4", "mov", "avi", "mkv", "webm"].includes(ext || "");
}

export default function ShareDownload() {
  const { shareId } = useParams<{ shareId: string }>();
  const { settings } = useAgencyStore();
  const [slide, setSlide] = useState(0);
  const [isVideoPlaying, setIsVideoPlaying] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSlide((prev) => (prev + 1) % 3);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const { data: file, error, isLoading } = useQuery<SharedFileMetadata>({
    queryKey: ["share-metadata", shareId],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/transfer/${shareId}`);
      if (!res.ok) {
        if (res.status === 410) {
          const expiredData = await res.json();
          return expiredData;
        }
        throw new Error("Failed to load file details. It might have been deleted.");
      }
      return res.json();
    },
    retry: false,
  });

  const downloadUrl = `${API_BASE}/transfer/${shareId}/download`;
  const previewUrl = `${downloadUrl}?preview=true&t=${file?.expiresAt ? new Date(file.expiresAt).getTime() : Date.now()}`;

  const handleDownload = () => {
    window.location.href = downloadUrl;
  };

  const isExpired = file?.expired || (file?.expiresAt && new Date(file.expiresAt) < new Date());
  
  const showPreview = file && !isExpired && !error && !isLoading;
  const isImage = showPreview && isImageFile(file.fileName, file.mimeType);
  const isVideo = showPreview && isVideoFile(file.fileName, file.mimeType);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-gradient-hero text-slate-100 relative overflow-hidden font-display select-none">
      
      {/* Orb animations mimicking high-end landing designs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div 
          animate={{ x: [0, 30, 0], y: [0, -30, 0] }}
          transition={{ repeat: Infinity, duration: 25, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-[500px] h-[500px] rounded-full bg-primary/10 blur-[130px]" 
        />
        <motion.div 
          animate={{ x: [0, -40, 0], y: [0, 40, 0] }}
          transition={{ repeat: Infinity, duration: 20, ease: "easeInOut" }}
          className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] rounded-full bg-secondary/8 blur-[120px]" 
        />
        <div className="absolute top-[-100px] right-[-100px] w-96 h-96 rounded-full bg-purple-500/5 blur-[100px]" />
      </div>

      {/* Left Area: Frosted Download Screen */}
      <div className="flex-1 flex flex-col justify-between p-6 sm:p-8 md:p-10 lg:max-w-[480px] xl:max-w-[520px] bg-slate-950/40 backdrop-blur-3xl border-r border-border/10 relative z-10">
        
        {/* Branding Logo */}
        <header className="flex justify-center lg:justify-start">
          <img
            src={settings.logo || hirdanLogo}
            alt={settings.agencyName || "Hirdan Marketing"}
            className="h-11 object-contain hover:scale-105 transition-transform duration-300"
          />
        </header>

        {/* Core Card Container */}
        <div className="my-auto py-8">
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          >
            <Card className="bg-slate-950/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl relative">
              {/* Highlight Glow Border */}
              <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-transparent via-secondary/80 to-transparent opacity-100" />
              
              <CardContent className="p-8 md:p-9 flex flex-col items-center text-center space-y-6">
                
                {isLoading ? (
                  <div className="space-y-4 py-16">
                    <div className="w-10 h-10 border-3 border-secondary border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-xs text-slate-400 font-medium">Resolving secure sharing node...</p>
                  </div>
                ) : error ? (
                  <div className="space-y-5 py-6">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-destructive/15 border border-destructive/25 shadow-lg shadow-destructive/5">
                      <AlertCircle className="h-8 w-8 text-destructive animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-white tracking-tight">Transfer Expired</h2>
                      <p className="text-xs text-slate-400 leading-relaxed px-4">
                        This file sharing path is no longer active. It has either expired or been removed from storage.
                      </p>
                    </div>
                  </div>
                ) : isExpired ? (
                  <div className="space-y-5 py-6">
                    <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-500/15 border border-amber-500/25">
                      <Clock className="h-8 w-8 text-amber-500 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                      <h2 className="text-xl font-bold text-white tracking-tight">Link Pruned</h2>
                      <p className="text-xs text-slate-400 leading-relaxed px-4">
                        To guarantee space availability and metadata privacy, transfers auto-delete after their designated expiry window.
                      </p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Media Frame Preview */}
                    {isImage && (
                      <div className="w-full bg-slate-950/70 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                        {/* Titlebar */}
                        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-950/80 border-b border-white/5">
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="ml-auto text-[9px] font-bold text-slate-500 uppercase tracking-widest">Preview</div>
                        </div>
                        {/* Content */}
                        <div className="p-1 flex items-center justify-center bg-slate-950/20 max-h-[240px] overflow-hidden relative group">
                          <img 
                            src={previewUrl} 
                            className="max-h-[220px] max-w-full object-contain rounded-xl transition-transform duration-500 group-hover:scale-[1.03]" 
                            alt={file.fileName} 
                          />
                        </div>
                      </div>
                    )}

                    {isVideo && (
                      <div className="w-full bg-slate-950/70 border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                        {/* Titlebar */}
                        <div className="flex items-center gap-1.5 px-4 py-2.5 bg-slate-950/80 border-b border-white/5">
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="w-2 h-2 rounded-full bg-slate-800" />
                          <div className="ml-auto text-[9px] font-bold text-slate-500 uppercase tracking-widest">Video</div>
                        </div>
                        {/* Content */}
                        <div className="p-1 bg-black relative group cursor-pointer" onClick={() => setIsVideoPlaying(true)}>
                          <video 
                            src={previewUrl} 
                            className="max-h-[220px] w-full object-contain rounded-xl" 
                            controls={isVideoPlaying} 
                            autoPlay={isVideoPlaying}
                            preload="metadata" 
                          />
                          {!isVideoPlaying && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/25 hover:bg-black/35 transition-colors rounded-xl">
                              <div className="p-4 bg-white/10 backdrop-blur-md rounded-full border border-white/20 text-white shadow-lg group-hover:scale-110 transition-all duration-300">
                                <Play className="h-6 w-6 fill-white ml-0.5" />
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Standard file representation */}
                    {!isImage && !isVideo && (
                      <div className="w-full p-5 bg-slate-950/60 border border-white/5 rounded-2xl shadow-xl flex items-center gap-4 text-left">
                        <div className="p-3.5 bg-slate-900 border border-white/5 rounded-xl text-primary shrink-0 relative shadow-inner">
                          {getFileIcon(file.fileName)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Shared Document</p>
                          <p className="text-sm font-bold text-white truncate pr-2" title={file.fileName}>{file.fileName}</p>
                        </div>
                      </div>
                    )}

                    {/* Detailed Metadata Grid */}
                    <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 text-left p-4 bg-white/5 border border-white/5 rounded-2xl">
                      <div className="min-w-0">
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">File Name</span>
                        <p className="text-xs font-bold text-white mt-0.5 truncate pr-2" title={file.fileName}>{file.fileName}</p>
                      </div>
                      <div>
                        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">File Size</span>
                        <p className="text-xs font-bold text-white mt-0.5">{formatBytes(file.fileSize)}</p>
                      </div>
                    </div>

                    {/* Clock countdown */}
                    <div className="flex items-center gap-2 text-xs bg-slate-950/60 border border-white/5 px-4.5 py-2 rounded-full text-slate-300">
                      <Clock className="h-4 w-4 text-secondary shrink-0" />
                      <span className="font-semibold text-[11px] tracking-wide">Available until: {new Date(file.expiresAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}</span>
                    </div>



                    {/* Download Trigger */}
                    <Button 
                      onClick={handleDownload}
                      variant="hero"
                      className="w-full h-14 rounded-xl text-slate-950 font-bold text-sm tracking-wide shadow-lg shadow-secondary/15 flex items-center justify-center gap-2.5 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Download className="h-4 w-4" />
                      Download File
                    </Button>

                    <div className="flex items-center gap-1.5 text-[9px] text-slate-500 tracking-wider uppercase font-bold">
                      <ShieldCheck className="h-4 w-4 text-emerald-500" />
                      <span>Secured & encrypted transmission</span>
                    </div>
                  </>
                )}

              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Footer */}
        <footer className="py-2 text-center lg:text-left text-xs text-slate-500">
          <p>© {new Date().getFullYear()} {settings.agencyName || "Hirdan Marketing"}. All rights reserved.</p>
        </footer>

      </div>

      {/* Right Column: High-end Portfolio Showroom with Light Background */}
      <div className="hidden lg:flex flex-1 flex-col justify-center items-center p-12 bg-slate-50 relative overflow-hidden border-l border-slate-200">
        {/* Dynamic ambient overlays */}
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,rgba(139,92,246,0.05),transparent_60%)]" />
        
        <div className="max-w-2xl w-full text-center space-y-12 relative z-10 flex flex-col items-center">
          
          {/* Header promo item */}
          <div className="flex justify-center">
            <div className="p-2.5 bg-primary/5 rounded-full border border-primary/10 shadow-inner animate-pulse-slow">
              <Sparkles className="h-6 w-6 text-secondary" />
            </div>
          </div>

          {/* Interactive CSS Showcases representing the agency portfolio */}
          <div className="w-full max-w-lg h-72 relative flex items-center justify-center">
            <AnimatePresence mode="wait">
              {slide === 0 && (
                <motion.div
                  key="slide-brand"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full h-full flex flex-col justify-center items-center space-y-6"
                >
                  {/* Visual Grid of Mock Brand Assets - Light Mode */}
                  <div className="grid grid-cols-3 gap-3 w-72 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xl relative">
                    <div className="h-10 bg-secondary/80 rounded-xl flex items-center justify-center font-bold text-slate-950 text-xs shadow">H</div>
                    <div className="h-10 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 bg-primary/80 rounded-xl flex items-center justify-center font-bold text-white text-xs">M</div>
                    <div className="h-10 col-span-2 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 bg-slate-50 rounded-xl border border-slate-100"></div>
                    <div className="h-10 col-span-2 bg-gradient-to-r from-secondary to-orange-400 rounded-xl"></div>
                  </div>
                  
                  <div className="space-y-2">
                    <span className="inline-block text-[9px] font-extrabold tracking-widest uppercase text-secondary bg-secondary/10 px-3.5 py-1 rounded-full border border-secondary/20">
                      Branding & Design
                    </span>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                      We Build Brands That Stand Out
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                      From custom logo design to complete visual identity guidelines, we format your brand for maximum reach and authority.
                    </p>
                  </div>
                </motion.div>
              )}

              {slide === 1 && (
                <motion.div
                  key="slide-dev"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full h-full flex flex-col justify-center items-center space-y-6"
                >
                  {/* Visual Web Dashboard mockup - Light Mode */}
                  <div className="w-80 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xl relative text-left space-y-3">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full bg-rose-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                      <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    </div>
                    <div className="h-3 w-1/3 bg-slate-100 rounded-md" />
                    <div className="grid grid-cols-2 gap-2">
                      <div className="h-12 bg-slate-50 rounded-xl p-2 border border-slate-100 flex flex-col justify-between">
                        <div className="h-2 w-10 bg-slate-200 rounded-md" />
                        <div className="h-3 w-16 bg-secondary/80 rounded-md" />
                      </div>
                      <div className="h-12 bg-slate-50 rounded-xl p-2 border border-slate-100 flex flex-col justify-between">
                        <div className="h-2 w-12 bg-slate-200 rounded-md" />
                        <div className="h-3 w-10 bg-primary/80 rounded-md" />
                      </div>
                    </div>
                    <div className="h-8 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between px-3">
                      <div className="h-2 w-20 bg-slate-200 rounded-md" />
                      <div className="h-2.5 w-6 bg-slate-200 rounded-md" />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <span className="inline-block text-[9px] font-extrabold tracking-widest uppercase text-secondary bg-secondary/10 px-3.5 py-1 rounded-full border border-secondary/20">
                      Systems & Web Apps
                    </span>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                      Premium High-Performance Platforms
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Responsive dashboards, interactive customer portals, and optimized tools engineered for scalability and speed.
                    </p>
                  </div>
                </motion.div>
              )}

              {slide === 2 && (
                <motion.div
                  key="slide-marketing"
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full h-full flex flex-col justify-center items-center space-y-6"
                >
                  {/* Analytics graph mockup - Light Mode */}
                  <div className="w-80 h-32 p-4 bg-white rounded-3xl border border-slate-200/80 shadow-xl relative flex flex-col justify-between">
                    <div className="flex justify-between items-center">
                      <div className="h-2 w-14 bg-slate-100 rounded-md" />
                      <div className="h-4 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-[8px] text-emerald-600 font-extrabold">+82%</div>
                    </div>
                    {/* SVG mini graph */}
                    <svg className="w-full h-16" viewBox="0 0 100 30">
                      <defs>
                        <linearGradient id="chart-grad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(42 92% 52%)" stopOpacity="0.4" />
                          <stop offset="100%" stopColor="hsl(42 92% 52%)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d="M0,25 Q15,10 30,18 T60,5 T90,2 T100,5" fill="none" stroke="hsl(42 92% 52%)" strokeWidth="2" />
                      <path d="M0,25 Q15,10 30,18 T60,5 T90,2 T100,5 L100,30 L0,30 Z" fill="url(#chart-grad)" />
                    </svg>
                  </div>

                  <div className="space-y-2">
                    <span className="inline-block text-[9px] font-extrabold tracking-widest uppercase text-secondary bg-secondary/10 px-3.5 py-1 rounded-full border border-secondary/20">
                      Growth Marketing
                    </span>
                    <h3 className="text-2xl font-bold text-slate-900 tracking-tight leading-tight">
                      Data-Driven Business Scaling
                    </h3>
                    <p className="text-xs text-slate-500 leading-relaxed max-w-sm mx-auto">
                      Strategic campaigns on Google Search, Meta ads, and LinkedIn that target high-quality intent to convert traffic to ROI.
                    </p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Dots Indicator */}
          <div className="flex justify-center gap-2 mt-4">
            {[0, 1, 2].map((i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSlide(i)}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  slide === i ? "w-6 bg-secondary" : "w-1.5 bg-slate-300 hover:bg-slate-400"
                }`}
              />
            ))}
          </div>

        </div>
      </div>

    </div>
  );
}

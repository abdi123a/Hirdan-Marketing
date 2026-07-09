import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { 
  Globe, 
  User, 
  Bell, 
  Palette, 
  Clock, 
  Shield, 
  Link, 
  Mail, 
  Phone, 
  MapPin, 
  Upload, 
  Image as ImageIcon,
  Check,
  CreditCard,
  FileText,
  Percent,
  X,
  Search,
  Plus,
  Trash2,
  HelpCircle,
  AlertCircle,
  ChevronRight,
  Settings,
  Briefcase,
  Loader2,
  Sparkles,
  GitCommit,
  Tag,
  History,
  ArrowUpCircle,
  Terminal,
  Package,
  Calendar,
  SendHorizontal,
  Eye,
  EyeOff,
  RotateCcw,
  Server,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyStore, AgencySettings, PaymentMethod, VersionEntry } from "@/lib/store";
import { ProtectedBrandingImage } from "@/components/ProtectedBrandingImage";
import { Progress } from "@/components/ui/progress";
import { apiFetch } from "@/lib/api-client";

// Comprehensive Timezones list with countries
const timezones = [
  { group: "Africa", zones: [
    { value: "Africa/Djibouti", label: "Djibouti (EAT)" },
    { value: "Africa/Nairobi", label: "Kenya, Nairobi (EAT)" },
    { value: "Africa/Cairo", label: "Egypt, Cairo (EET)" },
    { value: "Africa/Johannesburg", label: "South Africa (SAST)" },
    { value: "Africa/Lagos", label: "Nigeria, Lagos (WAT)" },
    { value: "Africa/Casablanca", label: "Morocco, Casablanca (WET)" },
  ]},
  { group: "Americas", zones: [
    { value: "America/New_York", label: "USA, New York (ET)" },
    { value: "America/Chicago", label: "USA, Chicago (CT)" },
    { value: "America/Denver", label: "USA, Denver (MT)" },
    { value: "America/Los_Angeles", label: "USA, Los_Angeles (PT)" },
    { value: "America/Toronto", label: "Canada, Toronto (ET)" },
    { value: "America/Sao_Paulo", label: "Brazil, Sao_Paulo (BRT)" },
  ]},
  { group: "Europe", zones: [
    { value: "Europe/London", label: "UK, London (GMT)" },
    { value: "Europe/Paris", label: "France, Paris (CET)" },
    { value: "Europe/Berlin", label: "Germany, Berlin (CET)" },
    { value: "Europe/Istanbul", label: "Turkey, Istanbul (TRT)" },
    { value: "Europe/Moscow", label: "Russia, Moscow (MSK)" },
  ]},
  { group: "Asia/Pacific", zones: [
    { value: "Asia/Dubai", label: "UAE, Dubai (GST)" },
    { value: "Asia/Tokyo", label: "Japan, Tokyo (JST)" },
    { value: "Asia/Shanghai", label: "China, Shanghai (CST)" },
    { value: "Asia/Singapore", label: "Singapore (SGT)" },
    { value: "Australia/Sydney", label: "Australia, Sydney (AEST)" },
  ]},
];

// Currencies
const currencies = [
  { value: "DJF", label: "DJF (Djibouti Franc)", symbol: "Fdj" },
  { value: "USD", label: "USD (US Dollar)", symbol: "$" },
  { value: "EUR", label: "EUR (Euro)", symbol: "€" },
  { value: "GBP", label: "GBP (British Pound)", symbol: "£" },
  { value: "AED", label: "AED (UAE Dirham)", symbol: "د.إ" },
  { value: "SAR", label: "SAR (Saudi Riyal)", symbol: "ر.س" },
  { value: "KES", label: "KES (Kenyan Shilling)", symbol: "KSh" },
  { value: "ETB", label: "ETB (Ethiopian Birr)", symbol: "Br" },
];

export default function SettingsPage() {
  const { toast } = useToast();
  const { settings, updateSettings, fetchSettings, uploadFile } = useAgencyStore();
  const [formData, setFormData] = useState<AgencySettings>(settings);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState<{ [key: string]: boolean }>({});
  const [uploadProgress, setUploadProgress] = useState<{ [key: string]: number }>({});
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Version control state
  const [newVersionEntry, setNewVersionEntry] = useState<Omit<VersionEntry, 'date'>>({ version: '', description: '', author: '' });
  const [bumpType, setBumpType] = useState<'major' | 'minor' | 'patch'>('patch');
  const [showAddVersion, setShowAddVersion] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const whiteLogoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const signatureInputRef = useRef<HTMLInputElement>(null);
  const stampInputRef = useRef<HTMLInputElement>(null);
  const colorInputRef = useRef<HTMLInputElement>(null);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateSettings(formData);
      toast({
        title: "Settings Saved",
        description: "Your agency preferences have been updated successfully.",
      });
    } catch (error) {
      toast({
        title: "Save Failed",
        description: "There was an error saving your settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value, type } = e.target as HTMLInputElement;
    setFormData(prev => ({ 
      ...prev, 
      [id]: type === 'number' ? parseFloat(value) || 0 : value 
    }));
  };

  const handleSocialChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({
      ...prev,
      socialLinks: { ...prev.socialLinks, [id]: value }
    }));
  };

  const handleNotificationChange = (key: keyof AgencySettings['notifications'], value: boolean) => {
    setFormData(prev => ({
      ...prev,
      notifications: { ...prev.notifications, [key]: value }
    }));
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'whiteLogo' | 'favicon' | 'signature' | 'stamp') => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) { // Increased to 5MB to match server
        toast({
          title: "File too large",
          description: "Please upload an image smaller than 5MB.",
          variant: "destructive"
        });
        return;
      }

      setIsUploading(prev => ({ ...prev, [key]: true }));
      setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      try {
        const isPrivate = key === 'signature' || key === 'stamp';
        const url = await uploadFile(file, (progress) => {
          setUploadProgress(prev => ({ ...prev, [key]: progress }));
        }, isPrivate);
        setFormData(prev => ({ ...prev, [key]: url }));
        toast({
          title: "Upload Successful",
          description: "Your image has been uploaded to the server.",
        });
      } catch (error) {
        toast({
          title: "Upload Failed",
          description: "There was an error uploading your image. Please try again.",
          variant: "destructive"
        });
      } finally {
        setIsUploading(prev => ({ ...prev, [key]: false }));
        setUploadProgress(prev => ({ ...prev, [key]: 0 }));
      }
    }
  };

  const handlePaymentMethodChange = (id: string, field: keyof PaymentMethod, value: any) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).map(m => m.id === id ? { ...m, [field]: value } : m)
    }));
  };

  const addPaymentMethod = () => {
    const newMethod: PaymentMethod = {
      id: Math.random().toString(36).substr(2, 9),
      name: 'New Payment Method',
      type: 'other',
      details: '',
      isActive: true
    };
    setFormData(prev => ({
      ...prev,
      paymentMethods: [...(prev.paymentMethods || []), newMethod]
    }));
  };

  const removePaymentMethod = (id: string) => {
    setFormData(prev => ({
      ...prev,
      paymentMethods: (prev.paymentMethods || []).filter(m => m.id !== id)
    }));
  };

  const removeImage = (e: React.MouseEvent, key: 'logo' | 'whiteLogo' | 'favicon' | 'signature' | 'stamp') => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <div className="animate-in fade-in duration-500 max-w-[1400px]">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your agency portal and branding preferences</p>
        </div>
        <Button
          onClick={handleSave}
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-white px-8 h-11 transition-all active:scale-95 shadow-lg shadow-primary/20 shrink-0"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        {/* ── Mobile: horizontal scrollable tab bar ── */}
        <TabsList className="lg:hidden bg-muted/50 p-1 mb-6 flex overflow-x-auto whitespace-nowrap scrollbar-none justify-start border border-border/50 rounded-xl w-full">
          <TabsTrigger value="general" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <User className="h-3.5 w-3.5" /> General
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Palette className="h-3.5 w-3.5" /> Branding
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Link className="h-3.5 w-3.5" /> Social
          </TabsTrigger>
          <TabsTrigger value="localization" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Globe className="h-3.5 w-3.5" /> Localization
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <CreditCard className="h-3.5 w-3.5" /> Billing
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Settings className="h-3.5 w-3.5" /> Payments
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Bell className="h-3.5 w-3.5" /> Alerts
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0 text-blue-600 dark:text-blue-400">
            <Mail className="h-3.5 w-3.5" /> Mail
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0 text-purple-600 dark:text-purple-400">
            <Sparkles className="h-3.5 w-3.5" /> AI
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Shield className="h-3.5 w-3.5" /> Security
          </TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5 px-4 py-1.5 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all text-xs font-medium shrink-0">
            <Terminal className="h-3.5 w-3.5" /> System
          </TabsTrigger>
        </TabsList>

        {/* ── Desktop: sidebar + content flex wrapper ── */}
        <div className="lg:flex lg:gap-8 lg:items-start">

        {/* ── Desktop sidebar (hidden on mobile) ── */}
        <div className="hidden lg:block lg:w-[260px] lg:shrink-0">
          <div className="sticky top-20 space-y-3">
            {/* Agency Info Card */}
            <div className="rounded-2xl border border-border bg-card p-4 mb-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="h-10 w-10 rounded-xl flex items-center justify-center text-white font-bold text-base shadow-md"
                  style={{ backgroundColor: formData.primaryColor || '#3b82f6' }}
                >
                  {formData.agencyName?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm text-foreground truncate">{formData.agencyName || 'Your Agency'}</p>
                  <p className="text-xs text-muted-foreground truncate">{formData.adminEmail || 'admin@example.com'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>v{formData.appVersion || '1.0.0'} — Active</span>
              </div>
            </div>

            {/* ─ Group 1: Account & Branding ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">Account &amp; Branding</p>
              <TabsList className="flex flex-col w-full bg-transparent p-0 gap-0.5 h-auto">
                <TabsTrigger
                  value="general"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <User className="h-4 w-4 shrink-0" />
                  <span>General</span>
                </TabsTrigger>
                <TabsTrigger
                  value="branding"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Palette className="h-4 w-4 shrink-0" />
                  <span>Identity &amp; Branding</span>
                </TabsTrigger>
                <TabsTrigger
                  value="social"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Link className="h-4 w-4 shrink-0" />
                  <span>Social Links</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="h-px bg-border/50 mx-3" />

            {/* ─ Group 2: Finance & Localization ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">Finance &amp; Localization</p>
              <TabsList className="flex flex-col w-full bg-transparent p-0 gap-0.5 h-auto">
                <TabsTrigger
                  value="localization"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span>Localization</span>
                </TabsTrigger>
                <TabsTrigger
                  value="billing"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <CreditCard className="h-4 w-4 shrink-0" />
                  <span>Billing &amp; Tax</span>
                </TabsTrigger>
                <TabsTrigger
                  value="payments"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  <span>Payment Gateways</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="h-px bg-border/50 mx-3" />

            {/* ─ Group 3: Integrations ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">Integrations</p>
              <TabsList className="flex flex-col w-full bg-transparent p-0 gap-0.5 h-auto">
                <TabsTrigger
                  value="notifications"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Bell className="h-4 w-4 shrink-0" />
                  <span>Notifications</span>
                </TabsTrigger>
                <TabsTrigger
                  value="email"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-600 dark:data-[state=active]:text-blue-400 data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  <span>Mail Config</span>
                  <span className="ml-auto text-[9px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">SMTP</span>
                </TabsTrigger>
                <TabsTrigger
                  value="ai"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-600 dark:data-[state=active]:text-purple-400 data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Sparkles className="h-4 w-4 shrink-0" />
                  <span>AI Settings</span>
                  <span className="ml-auto text-[9px] font-bold bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded-full uppercase tracking-wider">Beta</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <div className="h-px bg-border/50 mx-3" />

            {/* ─ Group 4: Security & System ─ */}
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">Security &amp; System</p>
              <TabsList className="flex flex-col w-full bg-transparent p-0 gap-0.5 h-auto">
                <TabsTrigger
                  value="security"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  <span>Security</span>
                </TabsTrigger>
                <TabsTrigger
                  value="system"
                  className="w-full justify-start gap-3 px-3 py-2.5 text-sm font-medium rounded-xl data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none hover:bg-muted/60 transition-all text-muted-foreground data-[state=active]:font-semibold"
                >
                  <Terminal className="h-4 w-4 shrink-0" />
                  <span>System &amp; Versioning</span>
                </TabsTrigger>
              </TabsList>
            </div>
          </div>{/* end sticky sidebar */}
        </div>{/* end desktop sidebar */}

        {/* ── Tab content area (visible on all screen sizes) ── */}
        <div className="lg:flex-1 lg:min-w-0">

        <TabsContent value="general" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">General Information</CardTitle>
              <CardDescription>Basic information about your agency and contact details.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="agencyName" className="font-semibold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" /> Agency Name
                    </Label>
                    <Input id="agencyName" value={formData.agencyName} onChange={handleInputChange} placeholder="Your Agency Name" className="h-11 focus-visible:ring-primary" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="adminEmail" className="font-semibold flex items-center gap-2">
                      <Mail className="h-4 w-4 text-primary" /> Admin Email
                    </Label>
                    <Input id="adminEmail" type="email" value={formData.adminEmail} onChange={handleInputChange} placeholder="admin@example.com" className="h-11 focus-visible:ring-primary" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="phone" className="font-semibold flex items-center gap-2">
                      <Phone className="h-4 w-4 text-primary" /> Phone Number
                    </Label>
                    <Input id="phone" value={formData.phone} onChange={handleInputChange} placeholder="+1 (555) 000-0000" className="h-11 focus-visible:ring-primary" />
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="website" className="font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" /> Website URL
                    </Label>
                    <Input id="website" value={formData.website} onChange={handleInputChange} placeholder="https://example.com" className="h-11 focus-visible:ring-primary" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="address" className="font-semibold flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-primary" /> Office Address
                    </Label>
                    <Input id="address" value={formData.address} onChange={handleInputChange} placeholder="123 Agency St, City, Country" className="h-11 focus-visible:ring-primary" />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="branding" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Identity & Branding</CardTitle>
              <CardDescription>Customize your logos, icons and primary colors.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-10">
              <input type="file" ref={mainLogoInputRef} onChange={(e) => handleFileChange(e, 'logo')} accept="image/*" className="hidden" />
              <input type="file" ref={whiteLogoInputRef} onChange={(e) => handleFileChange(e, 'whiteLogo')} accept="image/*" className="hidden" />
              <input type="file" ref={faviconInputRef} onChange={(e) => handleFileChange(e, 'favicon')} accept="image/*" className="hidden" />
              <input type="file" ref={signatureInputRef} onChange={(e) => handleFileChange(e, 'signature')} accept="image/*" className="hidden" />
              <input type="file" ref={stampInputRef} onChange={(e) => handleFileChange(e, 'stamp')} accept="image/*" className="hidden" />

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">Main Logo</Label>
                  <div 
                    className="group relative border border-dashed border-border rounded-xl p-8 bg-muted/20 flex flex-col items-center justify-center gap-4 group-hover:border-primary/50 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:bg-muted/30 active:scale-[0.98]"
                    onClick={() => mainLogoInputRef.current?.click()}
                  >
                    {isUploading['logo'] ? (
                      <div className="flex flex-col items-center gap-2 w-full px-8">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-bold text-primary">{uploadProgress['logo'] || 0}%</span>
                        </div>
                        <Progress value={uploadProgress['logo'] || 0} className="h-1.5 w-full" />
                        <p className="text-[10px] items-center uppercase font-bold text-muted-foreground tracking-widest mt-1">Uploading Logo...</p>
                      </div>
                    ) : formData.logo ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <ProtectedBrandingImage src={formData.logo} alt="Main Logo" className="max-h-full object-contain drop-shadow-sm" />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                          <Button variant="secondary" size="sm" className="gap-2 shadow-sm">
                            <Upload className="h-4 w-4" /> Change
                          </Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => removeImage(e, 'logo')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-background shadow-sm border border-border group-hover:scale-110 transition-transform">
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Upload Logo</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG, SVG or JPG</p>
                        </div>
                      </>
                    ) }
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">White Logo (Dark Mode)</Label>
                  <div 
                    className="group relative border border-dashed border-slate-700/50 rounded-xl p-8 bg-slate-900 flex flex-col items-center justify-center gap-4 group-hover:border-white/30 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:shadow-slate-900/40 active:scale-[0.98]"
                    onClick={() => whiteLogoInputRef.current?.click()}
                  >
                    {isUploading['whiteLogo'] ? (
                      <div className="flex flex-col items-center gap-2 w-full px-8">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-white" />
                          <span className="text-sm font-bold text-white">{uploadProgress['whiteLogo'] || 0}%</span>
                        </div>
                        <Progress value={uploadProgress['whiteLogo'] || 0} className="h-1.5 w-full bg-white/20" />
                        <p className="text-[10px] items-center uppercase font-bold text-white/70 tracking-widest mt-1">Uploading Logo...</p>
                      </div>
                    ) : formData.whiteLogo ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <ProtectedBrandingImage src={formData.whiteLogo} alt="White Logo" className="max-h-full object-contain" />
                        <div className="absolute inset-0 bg-slate-800/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-white gap-2">
                          <Button variant="secondary" size="sm" className="gap-2 bg-white/10 text-white hover:bg-white/20">
                            <Upload className="h-4 w-4" /> Change
                          </Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => removeImage(e, 'whiteLogo')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-white/10 shadow-sm border border-white/20 group-hover:scale-110 transition-transform">
                          <ImageIcon className="h-6 w-6 text-white/70" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium text-white">Upload White Logo</p>
                          <p className="text-xs text-white/50 mt-1">PNG, SVG or JPG</p>
                        </div>
                      </>
                    ) }
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">Favicon</Label>
                  <div 
                    className="group relative border border-dashed border-border rounded-xl p-8 bg-muted/20 flex flex-col items-center justify-center gap-4 group-hover:border-primary/50 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:bg-muted/30 active:scale-[0.98]"
                    onClick={() => faviconInputRef.current?.click()}
                  >
                    {isUploading['favicon'] ? (
                      <div className="flex flex-col items-center gap-2 w-full px-8">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-bold text-primary">{uploadProgress['favicon'] || 0}%</span>
                        </div>
                        <Progress value={uploadProgress['favicon'] || 0} className="h-1.5 w-full" />
                        <p className="text-[10px] items-center uppercase font-bold text-muted-foreground tracking-widest mt-1">Uploading Icon...</p>
                      </div>
                    ) : formData.favicon ? (
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <ProtectedBrandingImage src={formData.favicon} alt="Favicon" className="w-full h-full object-contain rounded-lg shadow-sm" />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded-lg gap-2">
                          <Upload className="h-4 w-4 text-primary" />
                          <X className="h-4 w-4 text-destructive" onClick={(e) => removeImage(e, 'favicon')} />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-background shadow-sm border border-border group-hover:scale-110 transition-transform">
                          <Globe className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Upload Icon</p>
                          <p className="text-xs text-muted-foreground mt-1">32x32px or 64x64px</p>
                        </div>
                      </>
                    ) }
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">Authorized Signature</Label>
                  <div 
                    className="group relative border border-dashed border-border rounded-xl p-8 bg-muted/20 flex flex-col items-center justify-center gap-4 group-hover:border-primary/50 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:bg-muted/30 active:scale-[0.98]"
                    onClick={() => signatureInputRef.current?.click()}
                  >
                    {isUploading['signature'] ? (
                      <div className="flex flex-col items-center gap-2 w-full px-8">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-bold text-primary">{uploadProgress['signature'] || 0}%</span>
                        </div>
                        <Progress value={uploadProgress['signature'] || 0} className="h-1.5 w-full" />
                        <p className="text-[10px] items-center uppercase font-bold text-muted-foreground tracking-widest mt-1">Uploading Signature...</p>
                      </div>
                    ) : formData.signature ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <ProtectedBrandingImage src={formData.signature} alt="Signature" className="max-h-full object-contain drop-shadow-sm" />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                          <Button variant="secondary" size="sm" className="gap-2 shadow-sm">
                            <Upload className="h-4 w-4" /> Change
                          </Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => removeImage(e, 'signature')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-background shadow-sm border border-border group-hover:scale-110 transition-transform">
                          <FileText className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Upload Signature</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG with transparency</p>
                        </div>
                      </>
                    ) }
                  </div>
                </div>

                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">Company Stamp</Label>
                  <div 
                    className="group relative border border-dashed border-border rounded-xl p-8 bg-muted/20 flex flex-col items-center justify-center gap-4 group-hover:border-primary/50 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:bg-muted/30 active:scale-[0.98]"
                    onClick={() => stampInputRef.current?.click()}
                  >
                    {isUploading['stamp'] ? (
                      <div className="flex flex-col items-center gap-2 w-full px-8">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-5 w-5 animate-spin text-primary" />
                          <span className="text-sm font-bold text-primary">{uploadProgress['stamp'] || 0}%</span>
                        </div>
                        <Progress value={uploadProgress['stamp'] || 0} className="h-1.5 w-full" />
                        <p className="text-[10px] items-center uppercase font-bold text-muted-foreground tracking-widest mt-1">Uploading Stamp...</p>
                      </div>
                    ) : formData.stamp ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <ProtectedBrandingImage src={formData.stamp} alt="Stamp" className="max-h-full object-contain drop-shadow-sm" />
                        <div className="absolute inset-0 bg-background/80 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity gap-2">
                          <Button variant="secondary" size="sm" className="gap-2 shadow-sm">
                            <Upload className="h-4 w-4" /> Change
                          </Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={(e) => removeImage(e, 'stamp')}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="p-3 rounded-full bg-background shadow-sm border border-border group-hover:scale-110 transition-transform">
                          <Shield className="h-6 w-6 text-muted-foreground" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-medium">Upload Stamp</p>
                          <p className="text-xs text-muted-foreground mt-1">PNG with transparency</p>
                        </div>
                      </>
                    ) }
                  </div>
                </div>
              </div>

              <Separator />

              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <Label className="text-xl font-bold flex items-center gap-2">
                      <Palette className="h-5 w-5 text-primary" /> Primary Theme Color
                    </Label>
                    <p className="text-sm text-muted-foreground">This color will be used for buttons, links, and highlights.</p>
                  </div>
                  <div className="flex items-center gap-4 bg-muted/30 p-2.5 pl-4 rounded-2xl border border-border/50 self-start md:self-center shadow-sm">
                    <input 
                      type="color" 
                      ref={colorInputRef} 
                      value={formData.primaryColor || '#3b82f6'} 
                      onChange={(e) => setFormData(prev => ({ ...prev, primaryColor: e.target.value }))}
                      className="sr-only"
                    />
                    <div 
                      className="h-12 w-12 rounded-xl shadow-md flex items-center justify-center ring-4 ring-background cursor-pointer hover:scale-110 active:scale-95 transition-all duration-300 group relative"
                      style={{ backgroundColor: formData.primaryColor }}
                      onClick={() => colorInputRef.current?.click()}
                    >
                      <Check className="h-5 w-5 text-white drop-shadow-sm" />
                      <div className="absolute -top-1 -right-1 bg-primary text-[8px] text-white px-1.5 py-0.5 rounded-full font-bold shadow-sm opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">Edit</div>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <Label htmlFor="primaryColorInput" className="text-[10px] items-center font-bold text-muted-foreground uppercase tracking-widest px-0.5 flex gap-1">
                        <Palette className="h-2.5 w-2.5" /> Hex Code
                      </Label>
                      <div className="relative">
                        <Input 
                          id="primaryColorInput"
                          value={formData.primaryColor} 
                          onChange={(e) => {
                            let val = e.target.value;
                            if (val && !val.startsWith('#') && val.length > 0) val = '#' + val;
                            setFormData(prev => ({ ...prev, primaryColor: val }));
                          }}
                          placeholder="#000000"
                          className="font-mono text-base font-bold border-none h-8 px-0.5 focus-visible:ring-0 bg-transparent uppercase w-28 tracking-wider"
                        />
                        <div className="absolute bottom-1 left-0.5 right-0 h-[1px] bg-primary/20"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-4">
                  {[
                    '#3b82f6', '#6366f1', '#8b5cf6', '#ec4899', '#ef4444', 
                    '#f59e0b', '#10b981', '#0ea5e9', '#18181b', '#312e81', '#065f46',
                  ].map(color => (
                    <button
                      key={color}
                      onClick={() => setFormData(prev => ({ ...prev, primaryColor: color }))}
                      className={`h-12 w-12 rounded-xl transition-all duration-300 border-2 flex items-center justify-center ${formData.primaryColor === color ? 'border-primary shadow-xl scale-125 ring-4 ring-primary/20 z-10' : 'border-transparent hover:scale-110 hover:border-border'}`}
                      style={{ backgroundColor: color }}
                    >
                      {formData.primaryColor === color && <Check className="h-6 w-6 text-white drop-shadow-sm" />}
                    </button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="localization" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Localization & Regions</CardTitle>
              <CardDescription>Setup your regional preferences for numbers and dates.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8 border-b pb-8">
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="timezone" className="font-semibold flex items-center gap-2">
                      <Clock className="h-4 w-4 text-primary" /> Default Timezone (Country based)
                    </Label>
                    <Select 
                      value={formData.timezone} 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, timezone: val }))}
                    >
                      <SelectTrigger className="h-12 focus:ring-primary bg-background">
                        <SelectValue placeholder="Select timezone" />
                      </SelectTrigger>
                      <SelectContent className="max-h-[300px]">
                        {timezones.map(group => (
                          <SelectGroup key={group.group}>
                            <SelectLabel className="text-primary font-bold px-2 py-1.5 uppercase text-[10px] tracking-widest">{group.group}</SelectLabel>
                            {group.zones.map(zone => (
                              <SelectItem key={zone.value} value={zone.value} className="pl-4">
                                {zone.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="currency" className="font-semibold flex items-center gap-2">
                      <Globe className="h-4 w-4 text-primary" /> Base Currency
                    </Label>
                    <Select 
                      value={formData.currency} 
                      onValueChange={(val) => setFormData(prev => ({ ...prev, currency: val }))}
                    >
                      <SelectTrigger className="h-12 focus:ring-primary bg-background">
                        <SelectValue placeholder="Select currency" />
                      </SelectTrigger>
                      <SelectContent>
                        {currencies.map(curr => (
                          <SelectItem key={curr.value} value={curr.value}>
                            <span className="font-bold mr-2">{curr.symbol}</span> {curr.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10">
                <div className="flex items-start gap-4">
                  <div className="p-2 bg-primary/20 rounded-lg text-primary">
                    <Check className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-primary">Universal Formatting Active</h4>
                    <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
                      Changes made here will apply **universally** across the entire AgencyFlow system. 
                      All dashboards, invoices, and reports will automatically use **{formData.currency}** formatting 
                      and the **{formData.timezone}** timezone.
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Billing & Tax Configuration</CardTitle>
              <CardDescription>Configure default tax rates and invoice settings.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div className="grid gap-2">
                    <Label htmlFor="taxRate" className="font-semibold flex items-center gap-2">
                      <Percent className="h-4 w-4 text-primary" /> Default Tax Rate (%)
                    </Label>
                    <Input 
                      id="taxRate" 
                      type="number" 
                      value={formData.taxRate} 
                      onChange={handleInputChange} 
                      className="h-11 focus-visible:ring-primary" 
                    />
                  </div>
                </div>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="defaultInvoiceNotes" className="font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Default Invoice Notes
                </Label>
                <Textarea 
                  id="defaultInvoiceNotes" 
                  value={formData.defaultInvoiceNotes} 
                  onChange={handleInputChange} 
                  rows={4} 
                  className="resize-none focus-visible:ring-primary rounded-xl" 
                  placeholder="Terms, payment methods, or a thank you note..."
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-0 outline-none space-y-4">
          <Card className="shadow-sm border-border overflow-hidden">
            <CardHeader className="bg-muted/20 border-b py-4 px-6 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg font-bold">Payment Gateways</CardTitle>
                <CardDescription className="text-xs">Manage your agency's payment methods.</CardDescription>
              </div>
              <Button 
                onClick={addPaymentMethod} 
                variant="outline" 
                size="sm" 
                className="gap-2 h-8 text-xs border-primary/20 hover:border-primary/50 hover:bg-primary/5"
              >
                <Plus className="h-3.5 w-3.5 text-primary" /> Add
              </Button>
            </CardHeader>
            <CardContent className="p-4 md:p-6 space-y-4">
              <div className="grid gap-3">
                {formData.paymentMethods.length === 0 ? (
                  <div className="text-center py-8 bg-muted/10 border border-dashed rounded-xl">
                    <CreditCard className="h-8 w-8 text-muted-foreground mx-auto mb-2 opacity-20" />
                    <p className="text-xs text-muted-foreground">No payment methods added yet.</p>
                  </div>
                ) : (
                  formData.paymentMethods.map((method) => (
                    <div 
                      key={method.id} 
                      className={`group border rounded-xl p-4 transition-all duration-200 ${method.isActive ? 'bg-background hover:shadow-sm' : 'bg-muted/20 opacity-60'}`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <div className={`p-2 rounded-lg ${
                              method.type === 'stripe' ? 'bg-indigo-50 text-indigo-500' : 
                              method.type === 'paypal' ? 'bg-blue-50 text-blue-500' : 
                              method.type === 'bank' ? 'bg-emerald-50 text-emerald-500' : 
                              'bg-slate-50 text-slate-500'
                            }`}>
                              {method.type === 'stripe' && <CreditCard className="h-4 w-4" />}
                              {method.type === 'paypal' && <CreditCard className="h-4 w-4" />}
                              {method.type === 'bank' && <Briefcase className="h-4 w-4" />}
                              {method.type === 'other' && <HelpCircle className="h-4 w-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                              <Input 
                                value={method.name} 
                                onChange={(e) => handlePaymentMethodChange(method.id, 'name', e.target.value)}
                                className="font-bold text-base border-none p-0 focus-visible:ring-0 bg-transparent h-auto"
                                placeholder="Method Name"
                              />
                              <div className="flex items-center gap-2 mt-0.5">
                                <Select 
                                  value={method.type} 
                                  onValueChange={(val: any) => handlePaymentMethodChange(method.id, 'type', val)}
                                >
                                  <SelectTrigger className="h-6 w-fit text-[9px] uppercase tracking-wider font-bold bg-muted/30 border-none shadow-none focus:ring-0 px-2">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="stripe">Stripe</SelectItem>
                                    <SelectItem value="paypal">PayPal</SelectItem>
                                    <SelectItem value="bank">Bank Transfer</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                  </SelectContent>
                                </Select>
                                {method.isActive ? (
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-md">Active</span>
                                ) : (
                                  <span className="text-[9px] uppercase tracking-wider font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">Hidden</span>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-muted-foreground uppercase opacity-70">Payment Instructions</Label>
                            <Textarea 
                              value={method.details} 
                              onChange={(e) => handlePaymentMethodChange(method.id, 'details', e.target.value)}
                              placeholder="Enter details..."
                              className="min-h-[60px] bg-muted/5 border-muted-foreground/10 focus:border-primary/20 transition-all rounded-lg text-xs leading-relaxed"
                            />
                          </div>
                        </div>

                        <div className="flex md:flex-col items-center gap-2 shrink-0">
                          <div className="flex items-center gap-2 bg-muted/30 p-1 px-2 rounded-lg border">
                            <span className="text-[9px] font-bold text-muted-foreground">{method.isActive ? 'ON' : 'OFF'}</span>
                            <Switch 
                              checked={method.isActive} 
                              onCheckedChange={(val) => handlePaymentMethodChange(method.id, 'isActive', val)}
                              className="data-[state=checked]:bg-primary h-4 w-8"
                            />
                          </div>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={() => removePaymentMethod(method.id)}
                            className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg transition-all"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="bg-primary/5 p-4 rounded-xl border border-primary/10 mt-6 flex items-start gap-3">
                <AlertCircle className="h-4 w-4 text-primary mt-0.5 opacity-70" />
                <div>
                  <h4 className="font-bold text-sm text-primary">Instructions Visibility</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                    These details appear on client invoices and portal. **Do not share secret keys here.**
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="social" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Social Media Links</CardTitle>
              <CardDescription>Connect your agency social profiles to display in portal.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-2">
                  <Label htmlFor="linkedin" className="font-semibold">LinkedIn Profile</Label>
                  <Input 
                    id="linkedin" 
                    value={formData.socialLinks.linkedin || ''} 
                    onChange={handleSocialChange} 
                    placeholder="https://linkedin.com/company/your-agency" 
                    className="h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="twitter" className="font-semibold">Twitter (X) Profile</Label>
                  <Input 
                    id="twitter" 
                    value={formData.socialLinks.twitter || ''} 
                    onChange={handleSocialChange} 
                    placeholder="https://twitter.com/your-agency" 
                    className="h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="instagram" className="font-semibold">Instagram Profile</Label>
                  <Input 
                    id="instagram" 
                    value={formData.socialLinks.instagram || ''} 
                    onChange={handleSocialChange} 
                    placeholder="https://instagram.com/your-agency" 
                    className="h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="facebook" className="font-semibold">Facebook Page</Label>
                  <Input 
                    id="facebook" 
                    value={formData.socialLinks.facebook || ''} 
                    onChange={handleSocialChange} 
                    placeholder="https://facebook.com/your-agency" 
                    className="h-11 focus-visible:ring-primary"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Notifications</CardTitle>
              <CardDescription>Configure how you want to be alerted about agency activities.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-4">
              <div className="flex items-center justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <Mail className="h-4 w-4 text-primary" /> Email Alerts
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">Receive weekly summary reports and important system updates via email.</p>
                </div>
                <Switch 
                  checked={formData.notifications.emailAlerts} 
                  onCheckedChange={(val) => handleNotificationChange('emailAlerts', val)} 
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Project Updates
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">Get notified immediately when a project status changes or a new task is created.</p>
                </div>
                <Switch 
                  checked={formData.notifications.projectUpdates} 
                  onCheckedChange={(val) => handleNotificationChange('projectUpdates', val)} 
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              <div className="flex items-center justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" /> Billing & Invoices
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">Receive notifications for paid invoices, overdue payments and new proformas.</p>
                </div>
                <Switch 
                  checked={formData.notifications.billingAlerts} 
                  onCheckedChange={(val) => handleNotificationChange('billingAlerts', val)} 
                  className="data-[state=checked]:bg-primary"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl">Security Configuration</CardTitle>
              <CardDescription>Setup Google reCAPTCHA v3 to protect your forms from spam.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="flex items-center justify-between p-6 rounded-2xl border bg-background hover:bg-muted/10 transition-all group">
                <div className="space-y-1">
                  <p className="font-bold flex items-center gap-2">
                    <Shield className="h-4 w-4 text-primary" /> Enable Google reCAPTCHA v3
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">Protect your admin and client login forms from bots and abuse.</p>
                </div>
                <Switch 
                  checked={formData.enableRecaptcha} 
                  onCheckedChange={(val) => setFormData(p => ({ ...p, enableRecaptcha: val }))} 
                  className="data-[state=checked]:bg-primary"
                />
              </div>

              {formData.enableRecaptcha && (
                <div className="grid md:grid-cols-2 gap-8 border bg-muted/10 p-6 rounded-2xl animate-in fade-in zoom-in duration-300">
                  <div className="space-y-2">
                    <Label htmlFor="recaptchaSiteKey" className="font-semibold">reCAPTCHA Site Key</Label>
                    <Input 
                      id="recaptchaSiteKey" 
                      value={formData.recaptchaSiteKey || ''} 
                      onChange={handleInputChange} 
                      placeholder="Enter reCAPTCHA v3 Site Key" 
                      className="h-11 focus-visible:ring-primary"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recaptchaSecretKey" className="font-semibold">reCAPTCHA Secret Key</Label>
                    <Input 
                      id="recaptchaSecretKey" 
                      type="password"
                      value={formData.recaptchaSecretKey || ''} 
                      onChange={handleInputChange} 
                      placeholder="Enter reCAPTCHA v3 Secret Key" 
                      className="h-11 focus-visible:ring-primary"
                    />
                    <p className="text-[10px] text-muted-foreground mt-1">Stored securely and never exposed to the client.</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ai" className="mt-0 outline-none space-y-6">
          <Card className="shadow-card border-purple-500/20 overflow-hidden ring-1 ring-purple-500/10">
            <CardHeader className="bg-gradient-to-r from-purple-500/10 to-transparent border-b pb-6">
              <CardTitle className="font-display text-xl text-purple-700 dark:text-purple-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5" /> AI Integration
              </CardTitle>
              <CardDescription>Configure OpenAI to power AI content generation features.</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
              <div className="grid gap-2 max-w-xl">
                <Label htmlFor="openAiApiKey" className="font-semibold">OpenAI API Key</Label>
                <div className="relative">
                  <Input 
                    id="openAiApiKey" 
                    type="password"
                    value={formData.openAiApiKey || ''} 
                    onChange={handleInputChange} 
                    placeholder="sk-..." 
                    className="h-11 focus-visible:ring-purple-500 border-purple-200"
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Your key is encrypted and never sent to the client. Needs access to `gpt-4o` or similar.
                  <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="ml-1 text-purple-600 hover:underline">Get an API key</a>
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ─────────── MAIL CONFIG ─────────── */}
        <TabsContent value="email" className="mt-0 outline-none space-y-5">

          {/* Test + status bar */}
          <div className="flex items-center justify-between gap-4 p-4 rounded-2xl border border-border bg-muted/30">
            <button
              id="test-email-btn"
              disabled={isTestingEmail || !formData.mailEnabled}
              onClick={async () => {
                setIsTestingEmail(true);
                setEmailStatus('idle');
                try {
                  await apiFetch('/settings/email/test', { method: 'POST', body: JSON.stringify({}) });
                  setEmailStatus('success');
                  toast({ title: 'Test email sent!', description: 'Check your admin inbox and Resend dashboard.' });
                } catch {
                  setEmailStatus('error');
                  toast({ title: 'Test failed', description: 'Check your API key and sender address.', variant: 'destructive' });
                } finally {
                  setIsTestingEmail(false);
                }
              }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-border bg-background text-sm font-medium text-foreground hover:bg-muted/60 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
            >
              {isTestingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
              Test your email integration
            </button>
            <div className={`text-xs font-medium px-3 py-1.5 rounded-full transition-all ${
              emailStatus === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' :
              emailStatus === 'error'   ? 'bg-red-500/10 text-red-600 border border-red-500/20' :
              'opacity-0'
            }`}>
              {emailStatus === 'success' ? '✓ Delivered' : emailStatus === 'error' ? '✗ Failed' : ''}
            </div>
          </div>

          {/* Config card */}
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="font-display text-xl flex items-center gap-2">
                    <Server className="h-5 w-5 text-blue-500" />
                    Mail Configuration
                  </CardTitle>
                  <CardDescription className="mt-1">SMTP settings for sending transactional emails via Resend.</CardDescription>
                </div>
                {/* Status toggle */}
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-muted-foreground">Mail Configuration Status</span>
                  <div className="flex items-center gap-2">
                    <Switch
                      id="mailEnabled"
                      checked={formData.mailEnabled}
                      onCheckedChange={(val) => setFormData(p => ({ ...p, mailEnabled: val }))}
                      className="data-[state=checked]:bg-blue-500"
                    />
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                      formData.mailEnabled ? 'bg-blue-500 text-white' : 'bg-muted text-muted-foreground'
                    }`}>
                      {formData.mailEnabled ? 'ON' : 'OFF'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-8">
              <div className="grid md:grid-cols-2 gap-x-10 gap-y-7">

                {/* Mailer Name */}
                <div className="space-y-2">
                  <Label htmlFor="mailerName" className="text-sm font-semibold text-foreground/80">
                    Mailer Name
                  </Label>
                  <Input
                    id="mailerName"
                    value={formData.mailerName}
                    onChange={handleInputChange}
                    placeholder="e.g. Hirdan Marketing"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Shown as the sender name in email clients.</p>
                </div>

                {/* Host */}
                <div className="space-y-2">
                  <Label htmlFor="smtpHost" className="text-sm font-semibold text-foreground/80">
                    Host
                  </Label>
                  <Input
                    id="smtpHost"
                    value={formData.smtpHost}
                    onChange={handleInputChange}
                    placeholder="smtp.resend.com"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                </div>

                {/* Driver */}
                <div className="space-y-2">
                  <Label htmlFor="smtpDriver" className="text-sm font-semibold text-foreground/80">
                    Driver
                  </Label>
                  <Input
                    id="smtpDriver"
                    value={formData.smtpDriver}
                    onChange={handleInputChange}
                    placeholder="smtp"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                </div>

                {/* Port */}
                <div className="space-y-2">
                  <Label htmlFor="smtpPort" className="text-sm font-semibold text-foreground/80">
                    Port
                  </Label>
                  <Input
                    id="smtpPort"
                    type="number"
                    value={formData.smtpPort}
                    onChange={handleInputChange}
                    placeholder="587"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                </div>

                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="smtpUsername" className="text-sm font-semibold text-foreground/80">
                    Username
                  </Label>
                  <Input
                    id="smtpUsername"
                    value={formData.smtpUsername}
                    onChange={handleInputChange}
                    placeholder="resend"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] text-muted-foreground">For Resend SMTP, username is always <code className="font-mono bg-muted px-1 rounded">resend</code>.</p>
                </div>

                {/* Email Id */}
                <div className="space-y-2">
                  <Label htmlFor="emailFrom" className="text-sm font-semibold text-foreground/80">
                    Email Id <span className="text-[10px] text-muted-foreground font-normal">(From address)</span>
                  </Label>
                  <Input
                    id="emailFrom"
                    type="email"
                    value={formData.emailFrom}
                    onChange={handleInputChange}
                    placeholder="noreply@yourdomain.com"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                  <p className="text-[11px] text-muted-foreground">Must use a verified domain in your Resend account.</p>
                </div>

                {/* Encryption */}
                <div className="space-y-2">
                  <Label htmlFor="smtpEncryption" className="text-sm font-semibold text-foreground/80">
                    Encryption
                  </Label>
                  <Input
                    id="smtpEncryption"
                    value={formData.smtpEncryption}
                    onChange={handleInputChange}
                    placeholder="tls"
                    className="h-11 focus-visible:ring-blue-500"
                  />
                </div>

                {/* Password / API Key */}
                <div className="space-y-2">
                  <Label htmlFor="resendApiKey" className="text-sm font-semibold text-foreground/80">
                    Password <span className="text-[10px] text-muted-foreground font-normal">(Resend API Key)</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="resendApiKey"
                      type={showSmtpPassword ? 'text' : 'password'}
                      value={formData.resendApiKey}
                      onChange={handleInputChange}
                      placeholder="re_xxxxxxxxxxxxxxxxxxxx"
                      className="h-11 pr-10 focus-visible:ring-blue-500 font-mono"
                    />
                    <button
                      type="button"
                      tabIndex={-1}
                      onClick={() => setShowSmtpPassword(p => !p)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showSmtpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Your Resend API key — stored securely and never exposed to clients.{' '}
                    <a href="https://resend.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">Get a key ↗</a>
                  </p>
                </div>

              </div>

              {/* Resend SMTP quick-ref */}
              <div className="mt-8 p-4 rounded-2xl bg-blue-500/5 border border-blue-500/20 flex gap-3">
                <div className="mt-0.5 shrink-0 w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Mail className="h-4 w-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-blue-700 dark:text-blue-400">Resend SMTP quick reference</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    Host: <code className="font-mono bg-muted px-1 rounded">smtp.resend.com</code> · Port: <code className="font-mono bg-muted px-1 rounded">587</code> · 
                    Username: <code className="font-mono bg-muted px-1 rounded">resend</code> · Encryption: <code className="font-mono bg-muted px-1 rounded">tls</code> · 
                    Password: your API key starting with <code className="font-mono bg-muted px-1 rounded">re_</code>
                  </p>
                </div>
              </div>

              {/* Footer actions */}
              <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-border">
                <Button
                  variant="outline"
                  className="gap-2 h-10 px-6"
                  onClick={() => setFormData(p => ({
                    ...p,
                    mailerName: '',
                    smtpHost: 'smtp.resend.com',
                    smtpPort: 587,
                    smtpUsername: 'resend',
                    smtpEncryption: 'tls',
                    smtpDriver: 'smtp',
                    emailFrom: '',
                    resendApiKey: '',
                    mailEnabled: false,
                  }))}
                >
                  <RotateCcw className="h-4 w-4" /> Reset
                </Button>
                <Button
                  id="save-mail-config-btn"
                  disabled={isSaving}
                  onClick={async () => {
                    if (!formData.resendApiKey?.startsWith('re_')) {
                      toast({ title: 'Invalid API key', description: 'Resend API keys must start with re_', variant: 'destructive' });
                      return;
                    }
                    setIsSaving(true);
                    try {
                      // Save all SMTP fields via the standard settings endpoint
                      await updateSettings(formData);
                      // Also sync the key into process.env via the dedicated email endpoint
                      await apiFetch('/settings/email', {
                        method: 'POST',
                        body: JSON.stringify({
                          resendApiKey: formData.resendApiKey,
                          emailFrom: formData.emailFrom || undefined,
                        }),
                      });
                      toast({ title: 'Mail config saved', description: 'Your email settings have been updated.' });
                    } catch {
                      toast({ title: 'Save failed', description: 'Please check your settings and try again.', variant: 'destructive' });
                    } finally {
                      setIsSaving(false);
                    }
                  }}
                  className="gap-2 h-10 px-8 bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20"
                >
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Save
                </Button>
              </div>

            </CardContent>
          </Card>

        </TabsContent>

        {/* ─────────── SYSTEM / VERSION CONTROL ─────────── */}
        <TabsContent value="system" className="mt-0 outline-none space-y-6">

          {/* Current version banner */}
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-primary/10 to-transparent border-b pb-6">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <Package className="h-5 w-5 text-primary" /> System Version
              </CardTitle>
              <CardDescription>Manage the application version and track changes over time.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              <div className="flex flex-col md:flex-row gap-8 items-start">
                {/* Current version display */}
                <div className="flex-1 space-y-4">
                  <div className="inline-flex items-center gap-3 bg-primary/10 border border-primary/20 rounded-2xl px-6 py-4">
                    <Tag className="h-6 w-6 text-primary" />
                    <div>
                      <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">Current Version</p>
                      <p className="text-3xl font-bold font-mono text-primary">v{formData.appVersion || '1.0.0'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated: {formData.updatedAt ? new Date(formData.updatedAt).toLocaleString() : '—'}
                  </p>
                </div>

                {/* Quick bump buttons */}
                <div className="space-y-3 min-w-[220px]">
                  <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Bump</p>
                  <div className="flex flex-col gap-2">
                    {(['major', 'minor', 'patch'] as const).map((type) => {
                      const parts = (formData.appVersion || '1.0.0').split('.').map(Number);
                      let preview = '';
                      if (type === 'major') preview = `${parts[0] + 1}.0.0`;
                      else if (type === 'minor') preview = `${parts[0]}.${parts[1] + 1}.0`;
                      else preview = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
                      return (
                        <button
                          key={type}
                          type="button"
                          onClick={() => setBumpType(type)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all ${
                            bumpType === type
                              ? 'border-primary bg-primary/10 text-primary shadow-sm'
                              : 'border-border bg-muted/20 text-muted-foreground hover:border-primary/40 hover:bg-muted/40'
                          }`}
                        >
                          <span className="capitalize">{type}</span>
                          <span className="font-mono text-xs">→ v{preview}</span>
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    onClick={() => setShowAddVersion(true)}
                    className="w-full gap-2 bg-primary hover:bg-primary/90"
                    size="sm"
                  >
                    <ArrowUpCircle className="h-4 w-4" /> Bump & Log Version
                  </Button>
                </div>
              </div>

              {/* Add version dialog inline */}
              {showAddVersion && (
                <div className="mt-6 p-6 border border-primary/30 bg-primary/5 rounded-2xl space-y-4 animate-in fade-in zoom-in duration-200">
                  <p className="font-semibold flex items-center gap-2">
                    <GitCommit className="h-4 w-4 text-primary" />
                    Log New Version Entry
                  </p>
                  <div className="grid md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Version (auto from bump)</Label>
                      <div className="relative">
                        <Input
                          value={newVersionEntry.version || (() => {
                            const parts = (formData.appVersion || '1.0.0').split('.').map(Number);
                            if (bumpType === 'major') return `${parts[0] + 1}.0.0`;
                            if (bumpType === 'minor') return `${parts[0]}.${parts[1] + 1}.0`;
                            return `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
                          })()}
                          onChange={(e) => setNewVersionEntry(p => ({ ...p, version: e.target.value }))}
                          placeholder="e.g. 1.2.0"
                          className="h-10 font-mono"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Author</Label>
                      <Input
                        value={newVersionEntry.author}
                        onChange={(e) => setNewVersionEntry(p => ({ ...p, author: e.target.value }))}
                        placeholder="Your name"
                        className="h-10"
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">What changed?</Label>
                    <Textarea
                      value={newVersionEntry.description}
                      onChange={(e) => setNewVersionEntry(p => ({ ...p, description: e.target.value }))}
                      placeholder="Describe the changes in this version..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <Button variant="ghost" size="sm" onClick={() => { setShowAddVersion(false); setNewVersionEntry({ version: '', description: '', author: '' }); }}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90 gap-2"
                      onClick={() => {
                        const parts = (formData.appVersion || '1.0.0').split('.').map(Number);
                        let bumped = '';
                        if (bumpType === 'major') bumped = `${parts[0] + 1}.0.0`;
                        else if (bumpType === 'minor') bumped = `${parts[0]}.${parts[1] + 1}.0`;
                        else bumped = `${parts[0]}.${parts[1]}.${parts[2] + 1}`;
                        const resolvedVersion = newVersionEntry.version || bumped;
                        const entry: VersionEntry = {
                          version: resolvedVersion,
                          description: newVersionEntry.description || 'No description provided.',
                          author: newVersionEntry.author || 'Unknown',
                          date: new Date().toISOString(),
                        };
                        setFormData(prev => ({
                          ...prev,
                          appVersion: resolvedVersion,
                          versionHistory: [entry, ...(prev.versionHistory || [])],
                        }));
                        setShowAddVersion(false);
                        setNewVersionEntry({ version: '', description: '', author: '' });
                        toast({
                          title: `Version bumped to v${resolvedVersion}`,
                          description: 'Click "Save Changes" to persist this update.',
                        });
                      }}
                    >
                      <Check className="h-4 w-4" /> Confirm Bump
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Git-style version history */}
          <Card className="shadow-card border-border overflow-hidden">
            <CardHeader className="bg-muted/30 border-b pb-6">
              <CardTitle className="font-display text-xl flex items-center gap-2">
                <History className="h-5 w-5 text-primary" /> Version History
              </CardTitle>
              <CardDescription>A full log of all version changes made to this system.</CardDescription>
            </CardHeader>
            <CardContent className="p-8">
              {(formData.versionHistory || []).length === 0 ? (
                <div className="text-center py-10 text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No version history yet.</p>
                  <p className="text-sm">Bump a version above to start tracking changes.</p>
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-[22px] top-3 bottom-3 w-px bg-border" />
                  <div className="space-y-6">
                    {(formData.versionHistory || []).map((entry, idx) => (
                      <div key={idx} className="flex gap-5 group">
                        {/* Node */}
                        <div className={`relative z-10 flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center border-2 transition-all ${
                          idx === 0
                            ? 'bg-primary border-primary text-white shadow-lg shadow-primary/30'
                            : 'bg-background border-border text-muted-foreground group-hover:border-primary/50'
                        }`}>
                          <GitCommit className="h-4 w-4" />
                        </div>
                        {/* Content */}
                        <div className={`flex-1 pb-2 rounded-2xl border px-5 py-4 transition-all ${
                          idx === 0
                            ? 'border-primary/30 bg-primary/5'
                            : 'border-border bg-muted/20 group-hover:bg-muted/30'
                        }`}>
                          <div className="flex flex-wrap items-center gap-2 mb-1">
                            <span className={`font-mono font-bold text-sm ${
                              idx === 0 ? 'text-primary' : 'text-foreground'
                            }`}>v{entry.version}</span>
                            {idx === 0 && (
                              <span className="text-[10px] bg-primary text-white font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Latest</span>
                            )}
                            <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {new Date(entry.date).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          <p className="text-sm text-foreground/90 leading-relaxed">{entry.description}</p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <User className="h-3 w-3" /> {entry.author}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

        </TabsContent>
        </div>{/* end content area */}
        </div>{/* end desktop layout wrapper */}
      </Tabs>
    </div>
  );
}

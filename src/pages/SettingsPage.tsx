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
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAgencyStore, AgencySettings, PaymentMethod } from "@/lib/store";

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

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    setFormData(settings);
  }, [settings]);

  const mainLogoInputRef = useRef<HTMLInputElement>(null);
  const whiteLogoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);

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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>, key: 'logo' | 'whiteLogo' | 'favicon') => {
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
      try {
        const url = await uploadFile(file);
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

  const removeImage = (e: React.MouseEvent, key: 'logo' | 'whiteLogo' | 'favicon') => {
    e.stopPropagation();
    setFormData(prev => ({ ...prev, [key]: '' }));
  };

  return (
    <div className="space-y-6 max-w-5xl animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-display font-bold text-foreground">Settings</h1>
          <p className="text-muted-foreground mt-1 text-lg">Manage your agency portal and branding</p>
        </div>
        <Button 
          onClick={handleSave} 
          disabled={isSaving}
          className="bg-primary hover:bg-primary/90 text-white px-8 h-11 transition-all active:scale-95 shadow-lg shadow-primary/20"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="bg-muted/50 p-1 mb-6 flex overflow-x-auto whitespace-nowrap scrollbar-none justify-start md:justify-center border border-border/50 rounded-xl">
          <TabsTrigger value="general" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <User className="h-4 w-4" /> General
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Palette className="h-4 w-4" /> Branding
          </TabsTrigger>
          <TabsTrigger value="localization" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Globe className="h-4 w-4" /> Localization
          </TabsTrigger>
          <TabsTrigger value="billing" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <CreditCard className="h-4 w-4" /> Billing
          </TabsTrigger>
          <TabsTrigger value="payments" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Settings className="h-4 w-4" /> Payments
          </TabsTrigger>
          <TabsTrigger value="social" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Link className="h-4 w-4" /> Social
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2 px-6 data-[state=active]:bg-background data-[state=active]:shadow-sm rounded-lg transition-all">
            <Bell className="h-4 w-4" /> Notifications
          </TabsTrigger>
        </TabsList>

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

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                <div className="space-y-4">
                  <Label className="font-bold text-sm uppercase tracking-wider text-muted-foreground underline decoration-primary decoration-2 underline-offset-4">Main Logo</Label>
                  <div 
                    className="group relative border border-dashed border-border rounded-xl p-8 bg-muted/20 flex flex-col items-center justify-center gap-4 group-hover:border-primary/50 transition-all cursor-pointer overflow-hidden h-48 hover:shadow-lg hover:bg-muted/30 active:scale-[0.98]"
                    onClick={() => mainLogoInputRef.current?.click()}
                  >
                    {isUploading['logo'] ? (
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-xs text-muted-foreground">Uploading...</p>
                      </div>
                    ) : formData.logo ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={formData.logo} alt="Main Logo" className="max-h-full object-contain drop-shadow-sm" />
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
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        <p className="text-xs text-white/70">Uploading...</p>
                      </div>
                    ) : formData.whiteLogo ? (
                      <div className="relative w-full h-full flex items-center justify-center p-4">
                        <img src={formData.whiteLogo} alt="White Logo" className="max-h-full object-contain" />
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
                      <div className="flex flex-col items-center gap-2">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        <p className="text-xs text-muted-foreground">Uploading...</p>
                      </div>
                    ) : formData.favicon ? (
                      <div className="relative w-20 h-20 flex items-center justify-center">
                        <img src={formData.favicon} alt="Favicon" className="w-full h-full object-contain rounded-lg shadow-sm" />
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
                  <div className="flex items-center gap-3 bg-muted/50 p-3 rounded-xl border self-start md:self-center">
                    <div 
                      className="h-10 w-10 rounded-lg shadow-sm flex items-center justify-center ring-2 ring-white"
                      style={{ backgroundColor: formData.primaryColor }}
                    >
                      <Check className="h-4 w-4 text-white drop-shadow-sm" />
                    </div>
                    <span className="font-mono text-sm font-bold pr-2 uppercase">{formData.primaryColor}</span>
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
                      Changes made here will apply **universally** across the entire Hirdan Marketing system. 
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
      </Tabs>
    </div>
  );
}

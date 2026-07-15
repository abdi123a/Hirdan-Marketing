import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useAgencyStore } from "@/lib/store";
import {
  Globe,
  User,
  Bell,
  Palette,
  Shield,
  Link as LinkIcon,
  Mail,
  FileText,
  Sparkles,
  Terminal,
  Wallet,
  Settings,
  CreditCard,
  Puzzle,
  Edit2,
  ChevronRight,
  ShieldCheck,
  BarChart3,
  Loader2
} from "lucide-react";

export default function PluginsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings, updateSettings } = useAgencyStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<"recaptcha" | "analytics" | null>(null);

  // Modal form states
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(settings.recaptchaSiteKey || "");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(settings.recaptchaSecretKey || "");
  const [analyticsId, setAnalyticsId] = useState(settings.googleAnalyticsMeasurementId || "");

  // Sidebar settings links matching screenshot
  const sidebarItems = [
    { label: "Basic Settings", tab: "general", icon: User },
    { label: "Identity & Branding", tab: "branding", icon: Palette },
    { label: "Social Links", tab: "social", icon: LinkIcon },
    { label: "Localization", tab: "localization", icon: Globe },
    { label: "Billing & Tax", tab: "billing", icon: CreditCard },
    { label: "Accounts", tab: "accounts", icon: Wallet },
    { label: "Payment Gateways", tab: "payments", icon: Settings },
    { label: "Notifications", tab: "notifications", icon: Bell },
    { label: "Mail Config", tab: "email", icon: Mail },
    { label: "Email Templates", tab: "email-templates", icon: FileText },
    { label: "AI Settings", tab: "ai", icon: Sparkles },
    { label: "Security", tab: "security", icon: Shield },
    { label: "System & Versioning", tab: "system", icon: Terminal },
    { label: "Plugins", url: "/dashboard/plugins", active: true, icon: Puzzle }
  ];

  const handleTogglePlugin = async (plugin: "recaptcha" | "analytics", enabled: boolean) => {
    try {
      if (plugin === "recaptcha") {
        await updateSettings({ enableRecaptcha: enabled });
        toast({
          title: enabled ? "Google reCAPTCHA Enabled" : "Google reCAPTCHA Disabled",
          description: enabled
            ? "reCAPTCHA is now protecting your login forms."
            : "reCAPTCHA protection has been turned off."
        });
      } else if (plugin === "analytics") {
        await updateSettings({ googleAnalyticsEnabled: enabled });
        toast({
          title: enabled ? "Google Analytics Enabled" : "Google Analytics Disabled",
          description: enabled
            ? "Google Analytics tracking has been activated."
            : "Google Analytics tracking has been deactivated."
        });
      }
    } catch (error) {
      toast({
        title: "Error updating plugin state",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  const handleSavePluginConfig = async () => {
    setIsSaving(true);
    try {
      if (editingPlugin === "recaptcha") {
        await updateSettings({
          recaptchaSiteKey,
          recaptchaSecretKey
        });
        toast({
          title: "reCAPTCHA Settings Saved",
          description: "Google reCAPTCHA v3 keys have been updated successfully."
        });
      } else if (editingPlugin === "analytics") {
        await updateSettings({
          googleAnalyticsMeasurementId: analyticsId,
          googleAnalyticsEnabled: true // Enable by default when config is set
        });
        toast({
          title: "Google Analytics Saved",
          description: "Measurement ID (G-XXXXXXXXXX) has been updated successfully."
        });
      }
      setEditingPlugin(null);
    } catch (error) {
      toast({
        title: "Failed to save settings",
        description: "Please check your keys and try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEditModal = (plugin: "recaptcha" | "analytics") => {
    if (plugin === "recaptcha") {
      setRecaptchaSiteKey(settings.recaptchaSiteKey || "");
      setRecaptchaSecretKey(settings.recaptchaSecretKey || "");
    } else {
      setAnalyticsId(settings.googleAnalyticsMeasurementId || "");
    }
    setEditingPlugin(plugin);
  };

  return (
    <div className="animate-in fade-in duration-500 w-full">
      <Card className="shadow-card border-border overflow-hidden rounded-2xl">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[600px] border-collapse text-left">
                <thead>
                  <tr className="bg-blue-50/50 border-b border-border/60">
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Plugin</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="px-6 py-4 text-sm font-semibold text-muted-foreground text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {/* Google Recaptcha v3 Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 text-blue-600 shadow-sm">
                          <ShieldCheck className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Google Recaptcha v3</p>
                          <p className="text-xs text-muted-foreground">Anti-spam protection for login and checkout</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {settings.enableRecaptcha ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100 font-medium">
                          Disable
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={settings.enableRecaptcha}
                          onCheckedChange={(val) => handleTogglePlugin("recaptcha", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal("recaptcha")}
                          className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Google Analytics Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 text-orange-600 shadow-sm">
                          <BarChart3 className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Google Analytics</p>
                          <p className="text-xs text-muted-foreground">Traffic statistics and tracking visitors</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {settings.googleAnalyticsEnabled ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100 font-medium">
                          Disable
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={settings.googleAnalyticsEnabled}
                          onCheckedChange={(val) => handleTogglePlugin("analytics", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal("analytics")}
                          className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

      {/* Edit Config Modal */}
      <Dialog open={editingPlugin !== null} onOpenChange={() => setEditingPlugin(null)}>
        <DialogContent className="sm:max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              {editingPlugin === "recaptcha" ? (
                <>
                  <ShieldCheck className="h-5 w-5 text-blue-600" />
                  Google reCAPTCHA v3 Config
                </>
              ) : (
                <>
                  <BarChart3 className="h-5 w-5 text-orange-600" />
                  Google Analytics Config
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingPlugin === "recaptcha"
                ? "Enter your Google reCAPTCHA v3 keys. These protect your login screens from bots."
                : "Enter your Google Analytics 4 Measurement ID. Format is usually G-XXXXXXXXXX."}
            </DialogDescription>
          </DialogHeader>

          {editingPlugin === "recaptcha" && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="site-key" className="font-semibold text-sm">Site Key</Label>
                <Input
                  id="site-key"
                  value={recaptchaSiteKey}
                  onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                  placeholder="Enter reCAPTCHA site key"
                  className="rounded-xl h-11 focus-visible:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="secret-key" className="font-semibold text-sm">Secret Key</Label>
                <Input
                  id="secret-key"
                  type="password"
                  value={recaptchaSecretKey}
                  onChange={(e) => setRecaptchaSecretKey(e.target.value)}
                  placeholder="Enter reCAPTCHA secret key"
                  className="rounded-xl h-11 focus-visible:ring-primary"
                />
              </div>
            </div>
          )}

          {editingPlugin === "analytics" && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="measurement-id" className="font-semibold text-sm">Measurement ID</Label>
                <Input
                  id="measurement-id"
                  value={analyticsId}
                  onChange={(e) => setAnalyticsId(e.target.value)}
                  placeholder="G-XXXXXXXXXX"
                  className="rounded-xl h-11 focus-visible:ring-primary"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setEditingPlugin(null)}
              className="rounded-xl px-5"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSavePluginConfig}
              disabled={isSaving}
              className="rounded-xl px-5 bg-primary text-white hover:bg-primary/95"
            >
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save Config"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

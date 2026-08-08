import { useState, useEffect } from "react";
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
  Loader2,
  Database,
  Cloud,
  Facebook,
  Instagram,
  Linkedin,
  Youtube,
  Twitter,
  Pin,
  Music,
  MessageCircle,
} from "lucide-react";
import { apiFetch } from "@/lib/api-client";

const GoogleRecaptchaLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <img src="/google-recaptcha.png" alt="Google reCAPTCHA v3" className={`${className} object-contain`} />
);

const GoogleAnalyticsLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <img src="/google-analytics.png" alt="Google Analytics" className={`${className} object-contain`} />
);

const GoogleDriveLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <img src="/google-drive.png" alt="Google Drive" className={`${className} object-contain`} />
);

const OneSignalLogo = ({ className = "h-5 w-5" }: { className?: string }) => (
  <img src="/onesignal.png" alt="OneSignal" className={`${className} object-contain`} />
);

export default function PluginsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings, updateSettings } = useAgencyStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<"recaptcha" | "analytics" | "gdrive" | "onesignal" | null>(null);

  const [platformStatuses, setPlatformStatuses] = useState<Record<string, { configured: boolean; enabled: boolean }>>({
    facebook: { configured: false, enabled: false },
    instagram: { configured: false, enabled: false },
    threads: { configured: false, enabled: false },
    tiktok: { configured: false, enabled: false },
    linkedin: { configured: false, enabled: false },
    youtube: { configured: false, enabled: false },
    x: { configured: false, enabled: false },
    pinterest: { configured: false, enabled: false },
  });

  useEffect(() => {
    apiFetch('/social/platform-status')
      .then((res: any) => {
        if (res) setPlatformStatuses(res);
      })
      .catch(() => {});
  }, []);

  const handleToggleSocialPlatform = async (platform: string, enabled: boolean) => {
    const isConfigured = platformStatuses[platform]?.configured;
    if (enabled && !isConfigured) {
      toast({
        title: "Configuration Required",
        description: `Please configure the credentials for ${platform} in your server/.env file first.`,
        variant: "destructive"
      });
      return;
    }

    try {
      const fieldMap: Record<string, string> = {
        facebook: 'metaEnabled',
        instagram: 'metaEnabled',
        threads: 'metaEnabled',
        tiktok: 'tiktokEnabled',
        linkedin: 'linkedinEnabled',
        youtube: 'googleEnabled',
        x: 'xEnabled',
        pinterest: 'pinterestEnabled',
      };
      
      const field = fieldMap[platform];
      await updateSettings({ [field]: enabled });
      
      setPlatformStatuses(prev => ({
        ...prev,
        [platform]: { ...prev[platform], enabled }
      }));

      toast({
        title: enabled ? `${platform.toUpperCase()} Enabled` : `${platform.toUpperCase()} Disabled`,
        description: enabled
          ? `${platform} integration is now active.`
          : `${platform} integration has been deactivated.`
      });
    } catch (err) {
      toast({
        title: "Error updating platform state",
        description: "Please try again later.",
        variant: "destructive"
      });
    }
  };

  // Modal form states
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(settings.recaptchaSiteKey || "");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(settings.recaptchaSecretKey || "");
  const [recaptchaAndroidSiteKey, setRecaptchaAndroidSiteKey] = useState(settings.recaptchaAndroidSiteKey || "");
  const [recaptchaIosSiteKey, setRecaptchaIosSiteKey] = useState(settings.recaptchaIosSiteKey || "");
  const [recaptchaEnterpriseProjectId, setRecaptchaEnterpriseProjectId] = useState(settings.recaptchaEnterpriseProjectId || "");
  const [analyticsId, setAnalyticsId] = useState(settings.googleAnalyticsMeasurementId || "");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState(settings.googleDriveFolderId || "");
  const [googleDriveServiceAccountJson, setGoogleDriveServiceAccountJson] = useState(settings.googleDriveServiceAccountJson || "");
  const [googleDriveClientId, setGoogleDriveClientId] = useState(settings.googleDriveClientId || "");
  const [googleDriveClientSecret, setGoogleDriveClientSecret] = useState(settings.googleDriveClientSecret || "");
  const [googleDriveAuthType, setGoogleDriveAuthType] = useState<"oauth" | "service_account">(
    settings.googleDriveClientId ? "oauth" : "service_account"
  );
  const [isAuthorizingDrive, setIsAuthorizingDrive] = useState(false);
  const [isTestingDrive, setIsTestingDrive] = useState(false);

  const [oneSignalAppId, setOneSignalAppId] = useState(settings.oneSignalAppId || "");
  const [oneSignalApiKey, setOneSignalApiKey] = useState(settings.oneSignalApiKey || "");


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

  const handleTogglePlugin = async (plugin: "recaptcha" | "analytics" | "gdrive" | "onesignal", enabled: boolean) => {
    if (enabled) {
      if (plugin === "recaptcha" && (!settings.recaptchaSiteKey || !settings.recaptchaSecretKey)) {
        toast({
          title: "Configuration Required",
          description: "Please enter your reCAPTCHA site and secret keys before enabling this plugin.",
          variant: "destructive"
        });
        openEditModal("recaptcha");
        return;
      }
      if (plugin === "analytics" && !settings.googleAnalyticsMeasurementId) {
        toast({
          title: "Configuration Required",
          description: "Please enter your Google Analytics Measurement ID before enabling this plugin.",
          variant: "destructive"
        });
        openEditModal("analytics");
        return;
      }
      if (plugin === "gdrive") {
        const hasServiceAccount = !!settings.googleDriveServiceAccountJson;
        const hasOAuth = !!(settings.googleDriveClientId && settings.googleDriveClientSecret && settings.googleDriveRefreshToken);
        if (!hasServiceAccount && !hasOAuth) {
          toast({
            title: "Configuration Required",
            description: "Please configure Google Drive integration (OAuth 2.0 or Service Account JSON) before enabling this plugin.",
            variant: "destructive"
          });
          openEditModal("gdrive");
          return;
        }
      }
      if (plugin === "onesignal" && (!settings.oneSignalAppId || !settings.oneSignalApiKey)) {
        toast({
          title: "Configuration Required",
          description: "Please configure your OneSignal App ID and API Key before enabling this plugin.",
          variant: "destructive"
        });
        openEditModal("onesignal");
        return;
      }
    }

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
      } else if (plugin === "gdrive") {
        await updateSettings({ googleDriveEnabled: enabled });
        toast({
          title: enabled ? "Google Drive Backup Sync Enabled" : "Google Drive Backup Sync Disabled",
          description: enabled
            ? "Database backups will now sync automatically to Google Drive."
            : "Google Drive backup sync has been deactivated."
        });
      } else if (plugin === "onesignal") {
        await updateSettings({ oneSignalEnabled: enabled });
        toast({
          title: enabled ? "OneSignal Notifications Enabled" : "OneSignal Notifications Disabled",
          description: enabled
            ? "Push notifications are now active for external clients."
            : "Push notifications have been disabled."
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

  const handleTestGDriveConnection = async () => {
    setIsTestingDrive(true);
    try {
      const res = await apiFetch<{ success: boolean; fileId: string }>('/settings/backups/gdrive-test', {
        method: 'POST',
        body: JSON.stringify({
          serviceAccountJson: googleDriveAuthType === "service_account" ? googleDriveServiceAccountJson : null,
          folderId: googleDriveFolderId
        })
      });
      if (res.success) {
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Google Drive and created test file!"
        });
      }
    } catch (err: any) {
      toast({
        title: "Connection Failed",
        description: err.message || "Could not verify Google Drive integration.",
        variant: "destructive"
      });
    } finally {
      setIsTestingDrive(false);
    }
  };

  const handleSavePluginConfig = async () => {
    setIsSaving(true);
    try {
      if (editingPlugin === "recaptcha") {
        await updateSettings({
          recaptchaSiteKey,
          recaptchaSecretKey,
          recaptchaAndroidSiteKey,
          recaptchaIosSiteKey,
          recaptchaEnterpriseProjectId,
        });
        toast({
          title: "reCAPTCHA Settings Saved",
          description: "Website and Application (Android/iOS) reCAPTCHA keys have been updated."
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
      } else if (editingPlugin === "gdrive") {
        const payload: any = {
          googleDriveFolderId,
          googleDriveServiceAccountJson: googleDriveAuthType === "service_account" ? googleDriveServiceAccountJson : null,
          googleDriveClientId: googleDriveAuthType === "oauth" ? googleDriveClientId : null,
          googleDriveClientSecret: googleDriveAuthType === "oauth" ? googleDriveClientSecret : null,
        };
        // Auto-enable only if service account is set OR OAuth is fully authenticated (has refresh token)
        const hasServiceAccount = googleDriveAuthType === "service_account" && !!googleDriveServiceAccountJson;
        const hasOAuth = googleDriveAuthType === "oauth" && !!settings.googleDriveRefreshToken;
        if (hasServiceAccount || hasOAuth) {
          payload.googleDriveEnabled = true;
        }

        await updateSettings(payload);
        toast({
          title: "Google Drive Settings Saved",
          description: "Google Drive backup sync integration has been updated successfully."
        });
      } else if (editingPlugin === "onesignal") {
        await updateSettings({
          oneSignalAppId,
          oneSignalApiKey,
          oneSignalEnabled: !!(oneSignalAppId && oneSignalApiKey)
        });
        toast({
          title: "OneSignal Config Saved",
          description: "OneSignal Push Notification keys have been updated successfully."
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

  const handleAuthorizeDrive = async () => {
    if (!googleDriveClientId || !googleDriveClientSecret) {
      toast({
        title: "Credentials Required",
        description: "Please enter your Google OAuth Client ID and Client Secret first.",
        variant: "destructive"
      });
      return;
    }

    setIsAuthorizingDrive(true);
    try {
      await updateSettings({
        googleDriveFolderId,
        googleDriveClientId,
        googleDriveClientSecret,
        googleDriveServiceAccountJson: null,
      });

      const redirectUri = window.location.origin + "/dashboard/settings";
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${googleDriveClientId}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code&scope=${encodeURIComponent(
        "https://www.googleapis.com/auth/drive.file"
      )}&access_type=offline&prompt=consent`;

      window.location.href = authUrl;
    } catch (err: any) {
      toast({
        title: "Authorization Failed",
        description: err.message || "Failed to initialize authorization.",
        variant: "destructive"
      });
      setIsAuthorizingDrive(false);
    }
  };

  const openEditModal = (plugin: "recaptcha" | "analytics" | "gdrive" | "onesignal") => {
    if (plugin === "recaptcha") {
      setRecaptchaSiteKey(settings.recaptchaSiteKey || "");
      setRecaptchaSecretKey(settings.recaptchaSecretKey || "");
      setRecaptchaAndroidSiteKey(settings.recaptchaAndroidSiteKey || "");
      setRecaptchaIosSiteKey(settings.recaptchaIosSiteKey || "");
      setRecaptchaEnterpriseProjectId(settings.recaptchaEnterpriseProjectId || "");
    } else if (plugin === "analytics") {
      setAnalyticsId(settings.googleAnalyticsMeasurementId || "");
    } else if (plugin === "gdrive") {
      setGoogleDriveFolderId(settings.googleDriveFolderId || "");
      setGoogleDriveServiceAccountJson(settings.googleDriveServiceAccountJson || "");
      setGoogleDriveClientId(settings.googleDriveClientId || "");
      setGoogleDriveClientSecret(settings.googleDriveClientSecret || "");
      setGoogleDriveAuthType(settings.googleDriveClientId ? "oauth" : "service_account");
    } else if (plugin === "onesignal") {
      setOneSignalAppId(settings.oneSignalAppId || "");
      setOneSignalApiKey(settings.oneSignalApiKey || "");
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
                        <div className="h-10 w-10 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm shrink-0">
                          <GoogleRecaptchaLogo className="h-5 w-5" />
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
                        <div className="h-10 w-10 rounded-xl bg-orange-50/40 flex items-center justify-center border border-orange-100 shadow-sm shrink-0">
                          <GoogleAnalyticsLogo className="h-5 w-5" />
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

                  {/* Google Drive Backup Sync Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-green-50/30 flex items-center justify-center border border-green-100 shadow-sm shrink-0">
                          <GoogleDriveLogo className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Google Drive Backup Sync</p>
                          <p className="text-xs text-muted-foreground">Automated database backups directly to your Google Drive</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {settings.googleDriveEnabled ? (
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
                          checked={settings.googleDriveEnabled}
                          onCheckedChange={(val) => handleTogglePlugin("gdrive", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal("gdrive")}
                          className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* OneSignal Push Notifications Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-orange-50 flex items-center justify-center border border-orange-100 shadow-sm shrink-0">
                          <OneSignalLogo className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">OneSignal Push Notifications</p>
                          <p className="text-xs text-muted-foreground">Deliver browser push notifications to clients even when offline</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {settings.oneSignalEnabled ? (
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
                          checked={settings.oneSignalEnabled}
                          onCheckedChange={(val) => handleTogglePlugin("onesignal", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal("onesignal")}
                          className="h-8 w-8 rounded-lg border border-border bg-card text-muted-foreground hover:text-foreground shadow-sm"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>

                  {/* Social Media Platforms Header */}
                  <tr>
                    <td colSpan={3} className="bg-muted/15 px-6 py-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Social Media Platforms
                    </td>
                  </tr>

                  {/* Meta / Facebook Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-50/50 flex items-center justify-center border border-blue-100 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/Facebook.png" className="h-6 w-6 object-contain" alt="Facebook" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Facebook Pages</p>
                          <p className="text-xs text-muted-foreground">Publish posts directly to connected Facebook Pages</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.facebook?.configured ? (
                        platformStatuses.facebook?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.facebook?.enabled && platformStatuses.facebook?.configured}
                          disabled={!platformStatuses.facebook?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("facebook", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Instagram Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-pink-50/50 flex items-center justify-center border border-pink-100 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/instagram.png" className="h-6 w-6 object-contain" alt="Instagram" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Instagram Business</p>
                          <p className="text-xs text-muted-foreground">Publish images, carousel, and video posts to Instagram</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.instagram?.configured ? (
                        platformStatuses.instagram?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.instagram?.enabled && platformStatuses.instagram?.configured}
                          disabled={!platformStatuses.instagram?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("instagram", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Threads Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-zinc-50 flex items-center justify-center border border-zinc-200 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/Threads.png" className="h-6 w-6 object-contain" alt="Threads" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Meta Threads</p>
                          <p className="text-xs text-muted-foreground">Publish short threads and media to Meta Threads</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.threads?.configured ? (
                        platformStatuses.threads?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.threads?.enabled && platformStatuses.threads?.configured}
                          disabled={!platformStatuses.threads?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("threads", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* TikTok Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-slate-50 flex items-center justify-center border border-slate-150 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/tiktok.png" className="h-6 w-6 object-contain" alt="TikTok" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">TikTok Videos</p>
                          <p className="text-xs text-muted-foreground">Publish draft or public video clips to TikTok profile</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.tiktok?.configured ? (
                        platformStatuses.tiktok?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.tiktok?.enabled && platformStatuses.tiktok?.configured}
                          disabled={!platformStatuses.tiktok?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("tiktok", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* LinkedIn Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-blue-50/50 flex items-center justify-center border border-blue-150 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/linkedin.png" className="h-6 w-6 object-contain" alt="LinkedIn" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">LinkedIn Share</p>
                          <p className="text-xs text-muted-foreground">Post professional updates, articles and links to LinkedIn</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.linkedin?.configured ? (
                        platformStatuses.linkedin?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.linkedin?.enabled && platformStatuses.linkedin?.configured}
                          disabled={!platformStatuses.linkedin?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("linkedin", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* YouTube Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-100 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/youtube.png" className="h-6 w-6 object-contain" alt="YouTube" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">YouTube Videos</p>
                          <p className="text-xs text-muted-foreground">Upload and publish video clips to YouTube channels</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.youtube?.configured ? (
                        platformStatuses.youtube?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.youtube?.enabled && platformStatuses.youtube?.configured}
                          disabled={!platformStatuses.youtube?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("youtube", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* X Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/twitter.png" className="h-6 w-6 object-contain" alt="X" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">X / Twitter</p>
                          <p className="text-xs text-muted-foreground">Publish text updates and media tweets directly to X profiles</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.x?.configured ? (
                        platformStatuses.x?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.x?.enabled && platformStatuses.x?.configured}
                          disabled={!platformStatuses.x?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("x", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>

                  {/* Pinterest Row */}
                  <tr className="hover:bg-muted/5 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 rounded-xl bg-red-50 flex items-center justify-center border border-red-150 shadow-sm shrink-0 overflow-hidden">
                          <img src="/social-icons/pinterest.png" className="h-6 w-6 object-contain" alt="Pinterest" />
                        </div>
                        <div>
                          <p className="font-semibold text-foreground text-sm">Pinterest Pins</p>
                          <p className="text-xs text-muted-foreground">Create and publish image pins directly to Pinterest boards</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      {platformStatuses.pinterest?.configured ? (
                        platformStatuses.pinterest?.enabled ? (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-600 border border-emerald-100">
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-slate-50 text-slate-600 border border-slate-100">
                            Configured (Disabled)
                          </span>
                        )
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-orange-50 text-orange-600 border border-orange-100">
                          Not Configured (.env)
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center justify-end gap-4">
                        <Switch
                          checked={platformStatuses.pinterest?.enabled && platformStatuses.pinterest?.configured}
                          disabled={!platformStatuses.pinterest?.configured}
                          onCheckedChange={(val) => handleToggleSocialPlatform("pinterest", val)}
                          className="data-[state=checked]:bg-primary"
                        />
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

      {/* Edit Config Modal */}
      <Dialog open={editingPlugin !== null} onOpenChange={() => setEditingPlugin(null)}>
        <DialogContent className="sm:max-w-xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg font-bold">
              {editingPlugin === "recaptcha" && (
                <>
                  <GoogleRecaptchaLogo className="h-6 w-6" />
                  Google reCAPTCHA v3 Config
                </>
              )}
              {editingPlugin === "analytics" && (
                <>
                  <GoogleAnalyticsLogo className="h-6 w-6" />
                  Google Analytics Config
                </>
              )}
              {editingPlugin === "gdrive" && (
                <>
                  <GoogleDriveLogo className="h-6 w-6" />
                  Google Drive Backup Sync Config
                </>
              )}
              {editingPlugin === "onesignal" && (
                <>
                  <OneSignalLogo className="h-6 w-6" />
                  OneSignal Push Notifications Config
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingPlugin === "recaptcha" && "Website keys protect the dashboard login. Application keys (Android/iOS) are required for the native mobile app."}
              {editingPlugin === "analytics" && "Enter your Google Analytics 4 Measurement ID. Format is usually G-XXXXXXXXXX."}
              {editingPlugin === "gdrive" && "Configure your Google Service Account credentials to upload backups automatically to Google Drive."}
              {editingPlugin === "onesignal" && "Configure your OneSignal credentials to send browser push notifications directly to your clients."}
            </DialogDescription>
          </DialogHeader>

          {editingPlugin === "recaptcha" && (
            <div className="space-y-5 py-3">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Website (v3)</p>
                <div className="space-y-2">
                  <Label htmlFor="site-key" className="font-semibold text-sm">Web Site Key</Label>
                  <Input
                    id="site-key"
                    value={recaptchaSiteKey}
                    onChange={(e) => setRecaptchaSiteKey(e.target.value)}
                    placeholder="Web score-based site key"
                    className="rounded-xl h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="secret-key" className="font-semibold text-sm">Web Secret Key</Label>
                  <Input
                    id="secret-key"
                    type="password"
                    value={recaptchaSecretKey}
                    onChange={(e) => setRecaptchaSecretKey(e.target.value)}
                    placeholder="Web secret key"
                    className="rounded-xl h-11 focus-visible:ring-primary"
                  />
                </div>
              </div>

              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Mobile app (Application type)</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Create keys in Google Cloud → reCAPTCHA → Application type Android/iOS.
                  Package: <code className="text-foreground">com.hirdanmarketing.agency</code>.
                  For emulator/sideload, enable “Support apps outside Play Store”.
                  Debug SHA-1 (if Google asks):{' '}
                  <code className="text-foreground break-all">
                    5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25
                  </code>
                  . Also set <code className="text-foreground">RECAPTCHA_ENTERPRISE_API_KEY</code> on the API server.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="android-site-key" className="font-semibold text-sm">Android Site Key</Label>
                  <Input
                    id="android-site-key"
                    value={recaptchaAndroidSiteKey}
                    onChange={(e) => setRecaptchaAndroidSiteKey(e.target.value)}
                    placeholder="Android Application site key"
                    className="rounded-xl h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ios-site-key" className="font-semibold text-sm">iOS Site Key</Label>
                  <Input
                    id="ios-site-key"
                    value={recaptchaIosSiteKey}
                    onChange={(e) => setRecaptchaIosSiteKey(e.target.value)}
                    placeholder="iOS Application site key (optional for now)"
                    className="rounded-xl h-11 focus-visible:ring-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="enterprise-project" className="font-semibold text-sm">GCP Project ID</Label>
                  <Input
                    id="enterprise-project"
                    value={recaptchaEnterpriseProjectId}
                    onChange={(e) => setRecaptchaEnterpriseProjectId(e.target.value)}
                    placeholder="Google Cloud project id (for assessments)"
                    className="rounded-xl h-11 focus-visible:ring-primary"
                  />
                </div>
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

          {editingPlugin === "gdrive" && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="gdrive-folder-id" className="font-semibold text-sm">Google Drive Folder ID (Optional)</Label>
                <Input
                  id="gdrive-folder-id"
                  value={googleDriveFolderId}
                  onChange={(e) => setGoogleDriveFolderId(e.target.value)}
                  placeholder="e.g. 1Bv8i7v0_1B2u3t..."
                  className="rounded-xl h-11 focus-visible:ring-primary"
                />
                <p className="text-[11px] text-muted-foreground">
                  Target folder ID in Google Drive. If left empty, backups will be saved in the root directory.
                </p>
              </div>

              <div className="space-y-2">
                <Label className="font-semibold text-sm">Authentication Method</Label>
                <div className="flex flex-wrap gap-x-6 gap-y-2 pt-1">
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
                    <input
                      type="radio"
                      name="auth_type"
                      checked={googleDriveAuthType === "oauth"}
                      onChange={() => setGoogleDriveAuthType("oauth")}
                      className="h-4 w-4 rounded-full border-primary text-primary focus:ring-primary accent-primary"
                    />
                    Google Account (OAuth 2.0 - Recommended)
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-sm font-medium text-foreground">
                    <input
                      type="radio"
                      name="auth_type"
                      checked={googleDriveAuthType === "service_account"}
                      onChange={() => setGoogleDriveAuthType("service_account")}
                      className="h-4 w-4 rounded-full border-primary text-primary focus:ring-primary accent-primary"
                    />
                    Service Account JSON Key
                  </label>
                </div>
              </div>

              {googleDriveAuthType === "oauth" ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gdrive-client-id" className="font-semibold text-sm">OAuth Client ID</Label>
                    <Input
                      id="gdrive-client-id"
                      value={googleDriveClientId}
                      onChange={(e) => setGoogleDriveClientId(e.target.value)}
                      placeholder="Enter Client ID"
                      className="rounded-xl h-11 focus-visible:ring-primary font-mono text-xs"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gdrive-client-secret" className="font-semibold text-sm">OAuth Client Secret</Label>
                    <Input
                      id="gdrive-client-secret"
                      type="password"
                      value={googleDriveClientSecret}
                      onChange={(e) => setGoogleDriveClientSecret(e.target.value)}
                      placeholder="Enter Client Secret"
                      className="rounded-xl h-11 focus-visible:ring-primary font-mono text-xs"
                    />
                  </div>
                  <div className="flex flex-col gap-2.5 p-4 border border-blue-500/10 bg-blue-500/5 rounded-xl text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-muted-foreground">Authorization Status:</span>
                      {settings.googleDriveRefreshToken ? (
                        <span className="text-green-600 dark:text-green-400 font-bold flex items-center gap-1">Authorized ✅</span>
                      ) : (
                        <span className="text-red-500 dark:text-red-400 font-bold flex items-center gap-1">Not Authorized ❌</span>
                      )}
                    </div>
                    <Button
                      type="button"
                      onClick={handleAuthorizeDrive}
                      disabled={isAuthorizingDrive || !googleDriveClientId || !googleDriveClientSecret}
                      className="w-full mt-1 bg-blue-600 hover:bg-blue-700 text-white font-medium h-10 rounded-xl"
                    >
                      {isAuthorizingDrive ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Redirecting to Google...
                        </>
                      ) : (
                        "Authorize Google Drive"
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="gdrive-service-account" className="font-semibold text-sm">Google Service Account JSON Key</Label>
                  <textarea
                    id="gdrive-service-account"
                    value={googleDriveServiceAccountJson}
                    onChange={(e) => setGoogleDriveServiceAccountJson(e.target.value)}
                    placeholder='{ "type": "service_account", "project_id": ... }'
                    className="flex min-h-[120px] w-full rounded-xl border border-input bg-transparent px-3 py-2 text-xs font-mono shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-not-allowed disabled:opacity-50"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    Paste the content of your Google Service Account credentials JSON file.
                  </p>
                </div>
              )}

              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestGDriveConnection}
                  disabled={
                    isTestingDrive ||
                    (googleDriveAuthType === "service_account" && !googleDriveServiceAccountJson) ||
                    (googleDriveAuthType === "oauth" && !settings.googleDriveRefreshToken)
                  }
                  className="h-10 px-5 text-xs rounded-xl"
                >
                  {isTestingDrive ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin text-blue-500" />
                      Testing Connection...
                    </>
                  ) : (
                    "Test Google Drive Connection"
                  )}
                </Button>
              </div>

              {/* Setup Guide */}
              <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p className="font-semibold text-blue-700 dark:text-blue-400">📋 Setup Guide for Google Drive Integration:</p>
                {googleDriveAuthType === "oauth" ? (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600">Google Cloud Console ↗</a>, create a project, and enable the <strong>Google Drive API</strong>.</li>
                    <li>Go to <strong>OAuth Consent Screen</strong>, configure it for external or internal users, and add the <code className="bg-muted px-1 py-0.5 rounded break-all">.../auth/drive.file</code> scope.</li>
                    <li>Go to <strong>Credentials</strong>, click <strong>Create Credentials</strong> &rarr; <strong>OAuth Client ID</strong>, select <strong>Web Application</strong>.</li>
                    <li>Add the redirect URI: <code className="bg-muted px-1 py-0.5 rounded break-all">{window.location.origin}/dashboard/settings</code> to the <strong>Authorized Redirect URIs</strong>.</li>
                    <li>Copy the Client ID and Client Secret, paste them above, and click <strong>Authorize Google Drive</strong>.</li>
                  </ol>
                ) : (
                  <ol className="list-decimal list-outside pl-4 space-y-1">
                    <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600">Google Cloud Console ↗</a>, create a project, and enable the <strong>Google Drive API</strong>.</li>
                    <li>Create a <strong>Service Account</strong> under Credentials, generate a <strong>JSON Private Key</strong>, download it, and paste it above.</li>
                    <li>Create a folder in a Google Workspace <strong>Shared Drive</strong> (since Service Accounts created after April 15, 2025 have 0 GB quota on My Drive), and share it with the service account client email as <strong>Content Manager</strong> or <strong>Contributor</strong>.</li>
                    <li>Copy the folder's ID from the URL and paste it into the Folder ID field above.</li>
                  </ol>
                )}
              </div>
            </div>
          )}

          {editingPlugin === "onesignal" && (
            <div className="space-y-4 py-3">
              <div className="space-y-2">
                <Label htmlFor="onesignal-app-id" className="font-semibold text-sm">OneSignal App ID</Label>
                <Input
                  id="onesignal-app-id"
                  value={oneSignalAppId}
                  onChange={(e) => setOneSignalAppId(e.target.value)}
                  placeholder="Enter OneSignal App ID"
                  className="rounded-xl h-11 focus-visible:ring-primary font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="onesignal-api-key" className="font-semibold text-sm">REST API Key</Label>
                <Input
                  id="onesignal-api-key"
                  type="password"
                  value={oneSignalApiKey}
                  onChange={(e) => setOneSignalApiKey(e.target.value)}
                  placeholder={settings.oneSignalApiKey ? "••••••••••••••••" : "Enter REST API Key"}
                  className="rounded-xl h-11 focus-visible:ring-primary font-mono text-xs"
                />
              </div>

              {/* Setup Guide */}
              <div className="p-4 rounded-xl bg-orange-500/5 border border-orange-500/10 text-xs text-muted-foreground space-y-2 leading-relaxed">
                <p className="font-semibold text-orange-700 dark:text-orange-400">📋 Setup Guide for OneSignal Push Notifications:</p>
                <ol className="list-decimal list-outside pl-4 space-y-1">
                  <li>Go to the <a href="https://onesignal.com/" target="_blank" rel="noopener noreferrer" className="text-orange-500 underline hover:text-orange-600">OneSignal Dashboard ↗</a> and create a new Web Push app.</li>
                  <li>In your App Settings under <strong>Keys & IDs</strong>, copy the <strong>OneSignal App ID</strong> and paste it above.</li>
                  <li>Copy the <strong>REST API Key</strong> and paste it above.</li>
                  <li>This enables sending automatic server-side push alerts to clients using browser push technology.</li>
                </ol>
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

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
  Loader2,
  Database,
  Cloud,
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

export default function PluginsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { settings, updateSettings } = useAgencyStore();
  
  const [isSaving, setIsSaving] = useState(false);
  const [editingPlugin, setEditingPlugin] = useState<"recaptcha" | "analytics" | "gdrive" | null>(null);

  // Modal form states
  const [recaptchaSiteKey, setRecaptchaSiteKey] = useState(settings.recaptchaSiteKey || "");
  const [recaptchaSecretKey, setRecaptchaSecretKey] = useState(settings.recaptchaSecretKey || "");
  const [analyticsId, setAnalyticsId] = useState(settings.googleAnalyticsMeasurementId || "");
  const [googleDriveFolderId, setGoogleDriveFolderId] = useState(settings.googleDriveFolderId || "");
  const [googleDriveServiceAccountJson, setGoogleDriveServiceAccountJson] = useState(settings.googleDriveServiceAccountJson || "");
  const [isTestingDrive, setIsTestingDrive] = useState(false);

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

  const handleTogglePlugin = async (plugin: "recaptcha" | "analytics" | "gdrive", enabled: boolean) => {
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
      if (plugin === "gdrive" && !settings.googleDriveServiceAccountJson) {
        toast({
          title: "Configuration Required",
          description: "Please paste your Google Service Account JSON key before enabling this plugin.",
          variant: "destructive"
        });
        openEditModal("gdrive");
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
          serviceAccountJson: googleDriveServiceAccountJson,
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
      } else if (editingPlugin === "gdrive") {
        await updateSettings({
          googleDriveFolderId,
          googleDriveServiceAccountJson,
          googleDriveEnabled: true // Enable by default when credentials are saved
        });
        toast({
          title: "Google Drive Settings Saved",
          description: "Google Drive backup sync integration has been updated successfully."
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

  const openEditModal = (plugin: "recaptcha" | "analytics" | "gdrive") => {
    if (plugin === "recaptcha") {
      setRecaptchaSiteKey(settings.recaptchaSiteKey || "");
      setRecaptchaSecretKey(settings.recaptchaSecretKey || "");
    } else if (plugin === "analytics") {
      setAnalyticsId(settings.googleAnalyticsMeasurementId || "");
    } else if (plugin === "gdrive") {
      setGoogleDriveFolderId(settings.googleDriveFolderId || "");
      setGoogleDriveServiceAccountJson(settings.googleDriveServiceAccountJson || "");
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
            </DialogTitle>
            <DialogDescription>
              {editingPlugin === "recaptcha" && "Enter your Google reCAPTCHA v3 keys. These protect your login screens from bots."}
              {editingPlugin === "analytics" && "Enter your Google Analytics 4 Measurement ID. Format is usually G-XXXXXXXXXX."}
              {editingPlugin === "gdrive" && "Configure your Google Service Account credentials to upload backups automatically to Google Drive."}
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

              <div className="flex justify-start">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleTestGDriveConnection}
                  disabled={isTestingDrive || !googleDriveServiceAccountJson}
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
                <ol className="list-decimal list-outside pl-4 space-y-1">
                  <li>Go to the <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-500 underline hover:text-blue-600">Google Cloud Console ↗</a>, create a project, and enable the <strong>Google Drive API</strong>.</li>
                  <li>Create a <strong>Service Account</strong> under Credentials, generate a <strong>JSON Private Key</strong>, and download it.</li>
                  <li>Paste the contents of that JSON key into the key field above.</li>
                  <li>Create a folder in your Google Drive, and <strong>share it</strong> with the service account's client email (found in the JSON file) as Editor.</li>
                  <li>Copy the folder's ID from the URL (the string after <code className="bg-muted px-1 py-0.5 rounded break-all">folders/</code>) and paste it into the Folder ID field above.</li>
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

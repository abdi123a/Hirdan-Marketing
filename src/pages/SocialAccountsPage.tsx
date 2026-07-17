import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { 
  Facebook, Instagram, Linkedin, Youtube, Twitter, Pin, Music, MessageCircle,
  Plus, Settings, RefreshCw, Trash2, ShieldAlert, CheckCircle2, AlertTriangle, Building2, User, Link as LinkIcon
} from "lucide-react";

interface SocialAccount {
  id: string;
  clientId: string;
  platform: string;
  platformUserId: string;
  platformUsername: string;
  displayName: string;
  avatarUrl: string | null;
  pageId: string | null;
  igAccountId: string | null;
  healthStatus: string;
  healthMessage: string | null;
  groupName: string | null;
  groupColor: string | null;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
  company: string;
}

export default function SocialAccountsPage() {
  const { toast } = useToast();
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [platformStatus, setPlatformStatus] = useState<Record<string, { configured: boolean; enabled: boolean }>>({});
  const [isLoading, setIsLoading] = useState(true);

  // Connection form state
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [selectedPlatform, setSelectedPlatform] = useState("");
  const [selectedClient, setSelectedClient] = useState("");
  const [groupName, setGroupName] = useState("");
  const [groupColor, setGroupColor] = useState("blue");

  // Edit group state
  const [isEditGroupOpen, setIsEditGroupOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [editGroupName, setEditGroupName] = useState("");
  const [editGroupColor, setEditGroupColor] = useState("blue");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [accountsData, clientsData, statusData] = await Promise.all([
        apiFetch<{ accounts: SocialAccount[] }>("/social/accounts"),
        apiFetch<{ clients: Client[] }>("/clients"),
        apiFetch<Record<string, { configured: boolean; enabled: boolean }>>("/social/platform-status"),
      ]);
      setAccounts(accountsData.accounts || []);
      setClients(clientsData.clients || []);
      setPlatformStatus(statusData || {});
    } catch (err: any) {
      toast({
        title: "Error fetching data",
        description: err.message || "Failed to load accounts list",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnect = async () => {
    if (!selectedPlatform || !selectedClient || !groupName) {
      toast({
        title: "Validation Error",
        description: "Please fill in all connection details",
        variant: "destructive",
      });
      return;
    }

    try {
      const { url } = await apiFetch<{ url: string }>(`/social/oauth/connect?platform=${selectedPlatform}&clientId=${selectedClient}&groupId=${encodeURIComponent(groupName)}`);
      if (url) {
        window.location.href = url;
      } else {
        throw new Error("No authorization URL returned from server");
      }
    } catch (err: any) {
      toast({
        title: "OAuth Connection Failed",
        description: err.message || "Could not generate auth link",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async (accountId: string) => {
    if (!confirm("Are you sure you want to disconnect this account? This will stop all scheduled posts to this platform.")) return;

    try {
      await apiFetch<any>(`/social/accounts/${accountId}`, { method: "DELETE" });
      toast({
        title: "Success",
        description: "Social account successfully disconnected",
      });
      fetchData();
    } catch (err: any) {
      toast({
        title: "Disconnect Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleSaveGroup = async () => {
    if (!editingAccount) return;
    try {
      await apiFetch<any>(`/social/accounts/${editingAccount.id}`, {
        method: "PUT",
        body: JSON.stringify({
          groupName: editGroupName,
          groupColor: editGroupColor,
        }),
      });
      toast({
        title: "Group Updated",
        description: "Group assignment saved successfully",
      });
      setIsEditGroupOpen(false);
      fetchData();
    } catch (err: any) {
      toast({
        title: "Update Failed",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const getPlatformIcon = (platform: string, className = "h-5 w-5 rounded-sm object-contain") => {
    switch (platform.toLowerCase()) {
      case "facebook": return <img src="/social-icons/Facebook.png" className={className} alt="Facebook" />;
      case "instagram": return <img src="/social-icons/instagram.png" className={className} alt="Instagram" />;
      case "threads": return <img src="/social-icons/Threads.png" className={className} alt="Threads" />;
      case "tiktok": return <img src="/social-icons/tiktok.png" className={className} alt="TikTok" />;
      case "linkedin": return <img src="/social-icons/linkedin.png" className={className} alt="LinkedIn" />;
      case "youtube": return <img src="/social-icons/youtube.png" className={className} alt="YouTube" />;
      case "x": 
      case "twitter": return <img src="/social-icons/twitter.png" className={className} alt="Twitter" />;
      default: return <Settings className={className} />;
    }
  };

  const groupedAccounts = accounts.reduce<Record<string, SocialAccount[]>>((groups, acc) => {
    const key = acc.groupName || "Unassigned Groups";
    if (!groups[key]) groups[key] = [];
    groups[key].push(acc);
    return groups;
  }, {});

  const getBadgeBg = (color: string | null) => {
    switch (color) {
      case "purple": return "bg-purple-50 text-purple-600 border-purple-100";
      case "emerald": return "bg-emerald-50 text-emerald-600 border-emerald-100";
      case "rose": return "bg-rose-50 text-rose-600 border-rose-100";
      case "orange": return "bg-orange-50 text-orange-600 border-orange-100";
      default: return "bg-blue-50 text-blue-600 border-blue-100";
    }
  };

  const allSupportedPlatforms = [
    { id: "facebook", name: "Facebook Page", icon: Facebook, color: "text-blue-600 bg-blue-50" },
    { id: "instagram", name: "Instagram Business", icon: Instagram, color: "text-pink-600 bg-pink-50" },
    { id: "linkedin", name: "LinkedIn Profile", icon: Linkedin, color: "text-blue-700 bg-blue-50" },
    { id: "youtube", name: "YouTube Channel", icon: Youtube, color: "text-red-600 bg-red-50" },
    { id: "x", name: "X / Twitter", icon: Twitter, color: "text-zinc-900 bg-zinc-50" },
    { id: "tiktok", name: "TikTok Video", icon: Music, color: "text-black bg-slate-50" },
    { id: "pinterest", name: "Pinterest Board", icon: Pin, color: "text-red-600 bg-red-50" },
    { id: "threads", name: "Meta Threads", icon: MessageCircle, color: "text-zinc-950 bg-zinc-50" },
  ];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Social Accounts</h1>
          <p className="text-sm text-muted-foreground">Manage brand groups and link their respective social media accounts.</p>
        </div>
        <Button onClick={() => setIsConnectOpen(true)} className="rounded-xl flex items-center gap-2 px-5 py-2.5 shadow-md">
          <Plus className="h-4.5 w-4.5" />
          <span className="font-semibold text-sm">Connect Social Account</span>
        </Button>
      </div>

      {/* Connection Warning Banners */}
      {Object.values(platformStatus).every(p => !p.enabled) && !isLoading && (
        <Card className="border-orange-200 bg-orange-50/20 rounded-2xl">
          <CardContent className="pt-6 flex gap-3">
            <AlertTriangle className="h-5 w-5 text-orange-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-orange-850">API Integrations Suspended</p>
              <p className="text-xs text-orange-700 mt-1">
                Go to <span className="font-semibold cursor-pointer underline" onClick={() => window.location.href='/dashboard/settings/plugins'}>Settings → Plugins</span> to input API secrets and enable Facebook, Instagram, LinkedIn, or other channels first.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Platform Integration Status (4/12) */}
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-2xl border border-border/80 shadow-sm overflow-hidden bg-card">
            <CardHeader className="bg-muted/5 border-b border-border/40 py-4 px-6">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <LinkIcon className="h-4 w-4 text-primary" />
                <span>Integration Plugins</span>
              </CardTitle>
              <CardDescription className="text-xs">API channels state enabled in settings</CardDescription>
            </CardHeader>
            <CardContent className="p-4 space-y-2.5">
              {allSupportedPlatforms.map(p => {
                const status = platformStatus[p.id] || { configured: false, enabled: false };
                return (
                  <div key={p.id} className="flex items-center justify-between p-3 rounded-xl border border-border/40 hover:bg-muted/5 transition-all bg-muted/5">
                    <div className="flex items-center gap-3">
                      <div className={`h-8 w-8 rounded-lg flex items-center justify-center ${p.color} border border-border/30 overflow-hidden`}>
                        {getPlatformIcon(p.id, "h-5 w-5 object-contain")}
                      </div>
                      <span className="text-xs font-bold text-foreground">{p.name}</span>
                    </div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                      status.enabled 
                        ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                        : "bg-muted text-muted-foreground border-border/60"
                    }`}>
                      {status.enabled ? "Active" : "Inactive"}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Connected Accounts Listings (8/12) */}
        <div className="lg:col-span-8 space-y-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-muted-foreground gap-2">
              <RefreshCw className="h-5 w-5 animate-spin text-primary" />
              <span>Loading connected accounts...</span>
            </div>
          ) : accounts.length === 0 ? (
            <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center rounded-2xl bg-card">
              <div className="h-14 w-14 rounded-2xl bg-muted flex items-center justify-center mb-4 border shadow-inner">
                <User className="h-7 w-7 text-muted-foreground" />
              </div>
              <h3 className="font-bold text-base text-foreground">No Accounts Connected</h3>
              <p className="text-sm text-muted-foreground max-w-xs mt-1 mb-6">
                Connect your client brand campaigns to social channels to start scheduling content.
              </p>
              <Button onClick={() => setIsConnectOpen(true)} className="rounded-xl px-5 font-semibold shadow-md">
                Link Social Account
              </Button>
            </Card>
          ) : (
            <div className="grid md:grid-cols-1 gap-6">
              {Object.entries(groupedAccounts).map(([group, list]) => (
                <Card key={group} className="border border-border/80 shadow-sm rounded-2xl overflow-hidden bg-card">
                  <CardHeader className="bg-muted/15 border-b border-border/40 py-4 px-6 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full bg-${list[0]?.groupColor || 'blue'}-500 shadow-sm`} />
                      <CardTitle className="text-base font-bold">{group}</CardTitle>
                    </div>
                    <span className="text-[10px] font-black text-muted-foreground bg-muted/60 px-3 py-1 rounded-full uppercase border">
                      {list.length} {list.length === 1 ? 'Account' : 'Accounts'}
                    </span>
                  </CardHeader>
                  <CardContent className="p-0 divide-y divide-border/45">
                    {list.map((acc) => (
                      <div key={acc.id} className="p-5 flex items-center justify-between hover:bg-muted/5 transition-all gap-4">
                        <div className="flex items-center gap-3.5 min-w-0">
                          <div className="relative shrink-0 select-none">
                            <div className="h-11 w-11 rounded-full border border-border/70 flex items-center justify-center bg-muted/20 overflow-hidden shadow-sm">
                              {acc.avatarUrl ? (
                                <img src={acc.avatarUrl} alt={acc.displayName} className="h-full w-full object-cover" />
                              ) : (
                                <div className="h-full w-full bg-primary/5 flex items-center justify-center text-primary font-bold">
                                  {acc.displayName[0]}
                                </div>
                              )}
                            </div>
                            <div className="absolute -bottom-1 -right-1 h-5 w-5 bg-background rounded-full border border-border flex items-center justify-center shadow">
                              {getPlatformIcon(acc.platform)}
                            </div>
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-foreground text-sm leading-none truncate">{acc.displayName}</p>
                              {acc.healthStatus === "healthy" ? (
                                <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                              ) : (
                                <ShieldAlert className="h-4 w-4 text-red-500 shrink-0" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1.5 truncate font-mono">@{acc.platformUsername}</p>
                            {acc.healthStatus !== "healthy" && (
                              <p className="text-[10px] text-red-500 mt-1.5 font-bold">{acc.healthMessage || "Connection expired. Re-auth required."}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setEditingAccount(acc);
                              setEditGroupName(acc.groupName || "");
                              setEditGroupColor(acc.groupColor || "blue");
                              setIsEditGroupOpen(true);
                            }}
                            className="rounded-xl border border-border hover:bg-muted text-muted-foreground hover:text-foreground h-8 text-xs font-semibold px-3"
                          >
                            Edit Group
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleDisconnect(acc.id)}
                            className="h-8.5 w-8.5 text-red-500 hover:text-red-600 hover:bg-red-50/50 rounded-xl"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Connect Modal */}
      <Dialog open={isConnectOpen} onOpenChange={setIsConnectOpen}>
        <DialogContent className="sm:max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-lg">Connect Social Media Account</DialogTitle>
            <DialogDescription className="text-xs">
              Link a client company to their official social media profiles.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Select Platform</label>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="w-full border border-border bg-background rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="">-- Choose Platform --</option>
                {platformStatus.facebook?.enabled && <option value="facebook">Facebook Page</option>}
                {platformStatus.instagram?.enabled && <option value="instagram">Instagram Business</option>}
                {platformStatus.threads?.enabled && <option value="threads">Meta Threads</option>}
                {platformStatus.tiktok?.enabled && <option value="tiktok">TikTok Video</option>}
                {platformStatus.linkedin?.enabled && <option value="linkedin">LinkedIn Profile</option>}
                {platformStatus.youtube?.enabled && <option value="youtube">YouTube Channel</option>}
                {platformStatus.x?.enabled && <option value="x">X / Twitter Profile</option>}
                {platformStatus.pinterest?.enabled && <option value="pinterest">Pinterest Board</option>}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Linked Client (DB Record)</label>
              <select
                value={selectedClient}
                onChange={(e) => setSelectedClient(e.target.value)}
                className="w-full border border-border bg-background rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="">-- Choose Client --</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.company} ({c.name})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Brand / Group Name</label>
              <Input
                placeholder="e.g. Tokka Campaign, Acme Corp"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Color Badge</label>
              <select
                value={groupColor}
                onChange={(e) => setGroupColor(e.target.value)}
                className="w-full border border-border bg-background rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="orange">Orange</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl px-5" onClick={() => setIsConnectOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl px-5 font-bold shadow-md" onClick={handleConnect}>
              Connect & Redirect
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Group Modal */}
      <Dialog open={isEditGroupOpen} onOpenChange={setIsEditGroupOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl">
          <DialogHeader>
            <DialogTitle className="font-bold text-base">Assign Group</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group / Brand Name</label>
              <Input
                value={editGroupName}
                onChange={(e) => setEditGroupName(e.target.value)}
                className="rounded-xl h-11"
              />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Group Color</label>
              <select
                value={editGroupColor}
                onChange={(e) => setEditGroupColor(e.target.value)}
                className="w-full border border-border bg-background rounded-xl p-3 text-sm focus:ring-2 focus:ring-primary/20 outline-none"
              >
                <option value="blue">Blue</option>
                <option value="purple">Purple</option>
                <option value="emerald">Emerald</option>
                <option value="rose">Rose</option>
                <option value="orange">Orange</option>
              </select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" className="rounded-xl px-5" onClick={() => setIsEditGroupOpen(false)}>
              Cancel
            </Button>
            <Button className="rounded-xl px-5 font-bold shadow-md" onClick={handleSaveGroup}>
              Save Group
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

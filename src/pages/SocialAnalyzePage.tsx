import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";
import { apiFetch } from "@/lib/api-client";
import { Input } from "@/components/ui/input";
import { 
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, Legend
} from "recharts";
import { 
  Facebook, Instagram, Linkedin, Youtube, Twitter, Pin, Music, MessageCircle,
  Users, Eye, TrendingUp, UserPlus, RefreshCw, BarChart2, ShieldAlert, CheckCircle2, Heart, MessageSquare, Share2, Search, Calendar, Filter
} from "lucide-react";

interface AnalyticsData {
  accounts: Array<{
    id: string;
    platform: string;
    displayName: string;
    healthStatus: string;
    latestMetrics: {
      followers: number;
      reach: number;
      impressions: number;
      profileVisits: number;
    };
  }>;
  chartData: Array<{
    date: string;
    followers: number;
    reach: number;
    impressions: number;
    profileVisits: number;
  }>;
  totals: {
    followers: number;
    reach: number;
    impressions: number;
    profileVisits: number;
  };
}

interface TopPost {
  id: string;
  caption: string;
  mediaUrls: any;
  publishedAt: string | null;
  likes: number;
  comments: number;
  shares: number;
  engagement: number;
  destinations: Array<{ platform: string }>;
}

interface Client {
  id: string;
  name: string;
  company: string;
}

export default function SocialAnalyzePage() {
  const { toast } = useToast();
  const [clients, setClients] = useState<Client[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [topPosts, setTopPosts] = useState<TopPost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Filter States
  const [dateRange, setDateRange] = useState<7 | 30 | 90>(30);
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [contentSearch, setContentSearch] = useState<string>("");

  useEffect(() => {
    // Load clients first
    apiFetch<{ clients: Client[] }>("/clients")
      .then((res) => {
        const clientsList = res.clients || [];
        setClients(clientsList);
        if (clientsList.length > 0) {
          setSelectedClient(clientsList[0].id);
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedClient) {
      fetchAnalytics();
    } else {
      setAnalytics(null);
      setTopPosts([]);
    }
  }, [selectedClient]);

  const fetchAnalytics = async () => {
    setIsLoading(true);
    try {
      const [metricsRes, postsRes] = await Promise.all([
        apiFetch<AnalyticsData>(`/social/analytics/${selectedClient}`),
        apiFetch<{ posts: TopPost[] }>(`/social/analytics/${selectedClient}/posts?limit=50`),
      ]);
      setAnalytics(metricsRes);
      setTopPosts(postsRes.posts || []);
    } catch (err: any) {
      toast({
        title: "Error loading analytics",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    if (!selectedClient) return;
    setIsRefreshing(true);
    try {
      await apiFetch<any>(`/social/analytics/${selectedClient}/refresh`, { method: "POST" });
      toast({
        title: "Metrics Synced",
        description: "Latest insights retrieved from platform API servers",
      });
      fetchAnalytics();
    } catch (err: any) {
      toast({
        title: "Sync Failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getPlatformIcon = (platform: string, className = "h-4 w-4 rounded-sm object-contain") => {
    switch (platform.toLowerCase()) {
      case "facebook": return <img src="/social-icons/Facebook.png" className={className} alt="Facebook" />;
      case "instagram": return <img src="/social-icons/instagram.png" className={className} alt="Instagram" />;
      case "threads": return <img src="/social-icons/Threads.png" className={className} alt="Threads" />;
      case "tiktok": return <img src="/social-icons/tiktok.png" className={className} alt="TikTok" />;
      case "linkedin": return <img src="/social-icons/linkedin.png" className={className} alt="LinkedIn" />;
      case "youtube": return <img src="/social-icons/youtube.png" className={className} alt="YouTube" />;
      case "x": 
      case "twitter": return <img src="/social-icons/twitter.png" className={className} alt="Twitter" />;
      default: return <BarChart2 className={className} />;
    }
  };

  // ----------------------------------------------------
  // Apply interactive filtering (Platform + Date Range)
  // ----------------------------------------------------
  
  // 1. Filtered Chart Data based on Date Range
  const getFilteredChartData = () => {
    if (!analytics || !analytics.chartData) return [];
    
    // Sort and grab recent days matching selection
    const sorted = [...analytics.chartData].sort((a, b) => a.date.localeCompare(b.date));
    return sorted.slice(-dateRange);
  };

  // 2. Filtered Totals based on Selected Platform
  const getFilteredTotals = () => {
    if (!analytics) return { followers: 0, reach: 0, impressions: 0, profileVisits: 0 };
    if (selectedPlatform === "ALL") return analytics.totals;

    // Aggregate only accounts matching selected platform
    const platformAccounts = analytics.accounts.filter(
      acc => acc.platform.toUpperCase() === selectedPlatform.toUpperCase()
    );

    return platformAccounts.reduce(
      (sum, acc) => {
        sum.followers += acc.latestMetrics?.followers || 0;
        sum.reach += acc.latestMetrics?.reach || 0;
        sum.impressions += acc.latestMetrics?.impressions || 0;
        sum.profileVisits += acc.latestMetrics?.profileVisits || 0;
        return sum;
      },
      { followers: 0, reach: 0, impressions: 0, profileVisits: 0 }
    );
  };

  // 3. Filtered Top Posts based on Keyword and Platform selection
  const getFilteredTopPosts = () => {
    return topPosts.filter(post => {
      const matchesKeyword = post.caption?.toLowerCase().includes(contentSearch.toLowerCase());
      const matchesPlatform = selectedPlatform === "ALL" || 
        post.destinations.some(d => d.platform.toUpperCase() === selectedPlatform.toUpperCase());
      return matchesKeyword && matchesPlatform;
    });
  };

  const filteredChartData = getFilteredChartData();
  const totals = getFilteredTotals();
  const filteredTopPosts = getFilteredTopPosts();

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-border/40 pb-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Analytics Dashboard</h1>
          <p className="text-sm text-muted-foreground">Track followers, reach, engagement, and post metrics per client.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select
            value={selectedClient}
            onChange={(e) => setSelectedClient(e.target.value)}
            className="border border-border bg-background rounded-xl p-2.5 text-sm font-semibold shadow-sm w-full md:w-56 focus:ring-2 focus:ring-primary/20 outline-none"
          >
            <option value="">-- Choose Client --</option>
            {clients.map(c => <option key={c.id} value={c.id}>{c.company}</option>)}
          </select>
          {selectedClient && (
            <Button
              variant="outline"
              disabled={isRefreshing || isLoading}
              onClick={handleRefresh}
              className="rounded-xl border border-border bg-card shadow-sm gap-2 shrink-0 h-[38px] px-3.5 hover:bg-muted/50 transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Sync Metrics</span>
            </Button>
          )}
        </div>
      </div>

      {!selectedClient ? (
        <Card className="border-dashed py-16 text-center text-muted-foreground rounded-2xl">
          Select a client company at the top right to analyze their social media accounts.
        </Card>
      ) : isLoading ? (
        <div className="flex justify-center items-center py-24 text-muted-foreground gap-2">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
          <span>Loading analytics metrics...</span>
        </div>
      ) : !analytics || analytics.accounts.length === 0 ? (
        <Card className="border-dashed py-16 flex flex-col items-center justify-center text-center rounded-2xl">
          <BarChart2 className="h-10 w-10 text-muted-foreground mb-3" />
          <h3 className="font-semibold text-base">No Accounts Connected</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-sm">
            This client has no active social media accounts connected. Connect accounts under Accounts page first.
          </p>
        </Card>
      ) : (
        <div className="space-y-6">
          
          {/* Controls toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-muted/20 p-4 rounded-2xl border border-border/80">
            <div className="flex flex-wrap items-center gap-3">
              {/* Date Filter selector */}
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase">Date Range:</span>
              </div>
              <div className="flex bg-background border rounded-lg p-0.5 shadow-sm">
                {[
                  { label: "7D", val: 7 },
                  { label: "30D", val: 30 },
                  { label: "90D", val: 90 },
                ].map(r => (
                  <button
                    key={r.val}
                    onClick={() => setDateRange(r.val as any)}
                    className={`px-3 py-1 rounded text-xs font-bold transition-all ${
                      dateRange === r.val ? "bg-primary text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>

              {/* Platform selector */}
              <div className="flex items-center gap-2 ml-2">
                <Filter className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-bold text-muted-foreground uppercase">Platform:</span>
              </div>
              <select
                value={selectedPlatform}
                onChange={(e) => setSelectedPlatform(e.target.value)}
                className="border border-border bg-background rounded-lg px-2.5 py-1 text-xs font-semibold shadow-sm outline-none focus:ring-1 focus:ring-primary/20"
              >
                <option value="ALL">All Platforms</option>
                <option value="FACEBOOK">Facebook</option>
                <option value="INSTAGRAM">Instagram</option>
                <option value="LINKEDIN">LinkedIn</option>
                <option value="YOUTUBE">YouTube</option>
              </select>
            </div>

            {/* Keyword Content filter */}
            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Filter by caption text..."
                value={contentSearch}
                onChange={(e) => setContentSearch(e.target.value)}
                className="pl-9 text-xs rounded-xl h-9 bg-background focus-visible:ring-primary/20"
              />
            </div>
          </div>

          {/* Large Stat Cards */}
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card className="rounded-2xl shadow-sm border border-border/80 hover:shadow transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Followers</p>
                  <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{totals.followers.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-blue-50/60 flex items-center justify-center text-blue-600 border border-blue-100/50 shadow-sm">
                  <Users className="h-5.5 w-5.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-border/80 hover:shadow transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Impressions</p>
                  <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{totals.impressions.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-purple-50/60 flex items-center justify-center text-purple-600 border border-purple-100/50 shadow-sm">
                  <Eye className="h-5.5 w-5.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-border/80 hover:shadow transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Total Reach</p>
                  <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{totals.reach.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-emerald-50/60 flex items-center justify-center text-emerald-600 border border-emerald-100/50 shadow-sm">
                  <TrendingUp className="h-5.5 w-5.5" />
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-border/80 hover:shadow transition-shadow">
              <CardContent className="p-6 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Profile Visits</p>
                  <h3 className="text-3xl font-black mt-2 text-foreground tracking-tight">{totals.profileVisits.toLocaleString()}</h3>
                </div>
                <div className="h-12 w-12 rounded-2xl bg-amber-50/60 flex items-center justify-center text-amber-600 border border-amber-100/50 shadow-sm">
                  <UserPlus className="h-5.5 w-5.5" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Chart Section */}
          <div className="grid md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 rounded-2xl shadow-sm border border-border/80 overflow-hidden bg-card">
              <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <TrendingUp className="h-4 w-4 text-primary" />
                  <span>Audience Growth Trend</span>
                </CardTitle>
                <CardDescription className="text-xs">Followers progression rate over last {dateRange} days</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={filteredChartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorFollowers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.15)" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(var(--border), 0.3)" }} />
                      <Area type="monotone" dataKey="followers" stroke="hsl(var(--primary))" strokeWidth={2.5} fillOpacity={1} fill="url(#colorFollowers)" name="Followers" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="rounded-2xl shadow-sm border border-border/80 overflow-hidden bg-card">
              <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                  <Eye className="h-4 w-4 text-emerald-600" />
                  <span>Reach vs Impressions</span>
                </CardTitle>
                <CardDescription className="text-xs">Daily views performance metrics</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={filteredChartData.slice(-7)} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(var(--border), 0.15)" />
                      <XAxis dataKey="date" fontSize={9} tickLine={false} />
                      <YAxis fontSize={9} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "12px", border: "1px solid rgba(var(--border), 0.3)" }} />
                      <Legend iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Bar dataKey="reach" fill="#10b981" radius={[4, 4, 0, 0]} name="Reach" />
                      <Bar dataKey="impressions" fill="#6366f1" radius={[4, 4, 0, 0]} name="Impressions" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Accounts status list + Top posts grid */}
          <div className="grid lg:grid-cols-3 gap-6">
            
            {/* Account List */}
            <Card className="lg:col-span-1 rounded-2xl shadow-sm border border-border/80 overflow-hidden flex flex-col justify-between bg-card">
              <div>
                <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                  <CardTitle className="text-sm font-bold">Linked Accounts</CardTitle>
                </CardHeader>
                <div className="divide-y divide-border/40 max-h-96 overflow-y-auto">
                  {analytics.accounts
                    .filter(acc => selectedPlatform === "ALL" || acc.platform.toUpperCase() === selectedPlatform.toUpperCase())
                    .map((acc) => (
                      <div key={acc.id} className="p-4 flex items-center justify-between hover:bg-muted/5 transition-all">
                        <div className="flex items-center gap-2.5">
                          {getPlatformIcon(acc.platform)}
                          <div>
                            <p className="font-bold text-sm leading-none text-foreground">{acc.displayName}</p>
                            <p className="text-xs text-muted-foreground mt-1 capitalize">{acc.platform}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-black text-foreground">{acc.latestMetrics?.followers?.toLocaleString() || 0}</p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">Followers</p>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            </Card>

            {/* Top Posts Grid */}
            <Card className="lg:col-span-2 rounded-2xl shadow-sm border border-border/80 overflow-hidden bg-card">
              <CardHeader className="py-4 px-6 border-b border-border/40 bg-muted/5">
                <CardTitle className="text-sm font-bold">Top Performing Posts</CardTitle>
                <CardDescription className="text-xs">Highest engagement posts published recently</CardDescription>
              </CardHeader>
              <CardContent className="p-0 divide-y divide-border/40 max-h-96 overflow-y-auto">
                {filteredTopPosts.length === 0 ? (
                  <div className="text-center py-16 text-muted-foreground text-sm">No published posts stats recorded yet.</div>
                ) : (
                  filteredTopPosts.map((post) => (
                    <div key={post.id} className="p-5 flex items-center justify-between hover:bg-muted/5 transition-all gap-4">
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        {post.mediaUrls && (post.mediaUrls.length > 0 || (Array.isArray(post.mediaUrls) && post.mediaUrls.length > 0)) ? (
                          <img src={Array.isArray(post.mediaUrls) ? post.mediaUrls[0] : post.mediaUrls} className="h-14 w-14 rounded-xl object-cover bg-muted shrink-0 border shadow-sm" alt="Thumbnail" />
                        ) : (
                          <div className="h-14 w-14 rounded-xl bg-muted flex items-center justify-center shrink-0 border border-border/50">
                            <BarChart2 className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-xs text-foreground font-bold leading-normal line-clamp-2">{post.caption}</p>
                          <p className="text-[10px] text-muted-foreground mt-2 flex items-center gap-1.5">
                            {post.destinations.map((d, i) => (
                              <span key={i} className="inline-flex items-center gap-1">
                                {getPlatformIcon(d.platform)}
                              </span>
                            ))}
                            <span>•</span>
                            <span>{post.publishedAt ? new Date(post.publishedAt).toLocaleDateString() : ""}</span>
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-5 text-right pl-4 shrink-0">
                        <div className="text-xs text-muted-foreground space-y-1.5 font-bold">
                          <div className="flex items-center justify-end gap-1.5">
                            <Heart className="h-3.5 w-3.5 text-red-500 fill-red-500" />
                            <span>{post.likes || 0}</span>
                          </div>
                          <div className="flex items-center justify-end gap-1.5">
                            <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
                            <span>{post.comments || 0}</span>
                          </div>
                        </div>
                        <div className="bg-primary/5 border border-primary/15 rounded-xl px-3 py-1.5 text-center min-w-20 shadow-inner">
                          <p className="text-sm font-black text-primary leading-none">{post.engagement || 0}</p>
                          <p className="text-[9px] text-muted-foreground mt-1 uppercase font-semibold">Engaged</p>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>

          </div>
        </div>
      )}
    </div>
  );
}

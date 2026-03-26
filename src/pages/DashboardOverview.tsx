import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { DollarSign, Users, Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight, Activity, Clock } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Area, AreaChart } from "recharts";
import { Badge } from "@/components/ui/badge";

const stats = [
  { title: "Total Revenue", value: "$48,250", change: "+12.5%", up: true, icon: DollarSign, desc: "vs last month" },
  { title: "Active Clients", value: "34", change: "+3", up: true, icon: Users, desc: "new this month" },
  { title: "Running Projects", value: "18", change: "+2", up: true, icon: Briefcase, desc: "in progress" },
  { title: "Growth Rate", value: "24%", change: "-2.1%", up: false, icon: TrendingUp, desc: "quarterly avg" },
];

const revenueData = [
  { month: "Jan", revenue: 12000, expenses: 8000 },
  { month: "Feb", revenue: 15000, expenses: 9200 },
  { month: "Mar", revenue: 18000, expenses: 10100 },
  { month: "Apr", revenue: 16000, expenses: 9800 },
  { month: "May", revenue: 22000, expenses: 11500 },
  { month: "Jun", revenue: 28000, expenses: 13000 },
  { month: "Jul", revenue: 32000, expenses: 14500 },
  { month: "Aug", revenue: 35000, expenses: 15000 },
  { month: "Sep", revenue: 38000, expenses: 16200 },
  { month: "Oct", revenue: 42000, expenses: 17000 },
  { month: "Nov", revenue: 45000, expenses: 18500 },
  { month: "Dec", revenue: 48250, expenses: 19000 },
];

const projectTypes = [
  { name: "SEO", value: 35, color: "hsl(260, 35%, 40%)" },
  { name: "Social Media", value: 28, color: "hsl(42, 92%, 52%)" },
  { name: "PPC", value: 20, color: "hsl(260, 35%, 60%)" },
  { name: "Content", value: 17, color: "hsl(42, 70%, 70%)" },
];

const recentActivities = [
  { action: "New client onboarded", detail: "TechStart Inc.", time: "2h ago", type: "client", color: "bg-primary" },
  { action: "Invoice paid", detail: "$4,500 from MediaCo", time: "5h ago", type: "invoice", color: "bg-secondary" },
  { action: "Project completed", detail: "Social Campaign Q1", time: "1d ago", type: "project", color: "bg-primary/60" },
  { action: "Team member added", detail: "Sarah — Designer", time: "2d ago", type: "team", color: "bg-accent-foreground/40" },
  { action: "Subscription renewed", detail: "Pro Plan — Annual", time: "3d ago", type: "subscription", color: "bg-secondary/60" },
];

const topClients = [
  { name: "TechStart Inc.", revenue: "$12,400", projects: 4, avatar: "TS" },
  { name: "MediaCo Digital", revenue: "$9,800", projects: 3, avatar: "MC" },
  { name: "BrandFlow Agency", revenue: "$8,200", projects: 2, avatar: "BF" },
  { name: "GrowthLab", revenue: "$6,500", projects: 3, avatar: "GL" },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-2">
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-sm">Welcome back! Here's your agency overview.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3.5 w-3.5" />
          Last updated: Today at 9:41 AM
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <Card key={stat.title} className="group relative overflow-hidden border-border/50 hover:border-primary/20 transition-all duration-300 hover:shadow-elevated">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.03] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <CardContent className="p-5 relative">
              <div className="flex items-center justify-between mb-4">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center ring-1 ring-primary/10">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge 
                  variant="outline" 
                  className={stat.up 
                    ? "bg-emerald-50 text-emerald-600 border-emerald-200 text-xs font-medium" 
                    : "bg-destructive/10 text-destructive border-destructive/20 text-xs font-medium"
                  }
                >
                  {stat.up ? <ArrowUpRight className="h-3 w-3 mr-0.5" /> : <ArrowDownRight className="h-3 w-3 mr-0.5" />}
                  {stat.change}
                </Badge>
              </div>
              <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-0.5">{stat.title} · <span className="text-muted-foreground/70">{stat.desc}</span></div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-base">Revenue & Expenses</CardTitle>
                <CardDescription className="text-xs">Monthly financial performance</CardDescription>
              </div>
              <div className="flex items-center gap-4 text-xs">
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-primary" /> Revenue</div>
                <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-sm bg-secondary" /> Expenses</div>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={revenueData}>
                <defs>
                  <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(260, 35%, 40%)" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="hsl(260, 35%, 40%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(42, 92%, 52%)" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="hsl(42, 92%, 52%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 15%, 92%)" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} stroke="hsl(260, 10%, 70%)" axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(260, 10%, 70%)" axisLine={false} tickLine={false} tickFormatter={(v) => `$${v/1000}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(260, 15%, 90%)", boxShadow: "0 8px 24px rgba(0,0,0,0.08)", fontSize: 12 }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Area type="monotone" dataKey="revenue" stroke="hsl(260, 35%, 40%)" strokeWidth={2} fill="url(#revenueGrad)" />
                <Area type="monotone" dataKey="expenses" stroke="hsl(42, 92%, 52%)" strokeWidth={2} fill="url(#expenseGrad)" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="font-display text-base">Project Mix</CardTitle>
            <CardDescription className="text-xs">Distribution by service type</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center pt-0">
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={projectTypes} cx="50%" cy="50%" innerRadius={50} outerRadius={78} dataKey="value" paddingAngle={3} strokeWidth={0}>
                  {projectTypes.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ borderRadius: "0.75rem", fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-1 w-full">
              {projectTypes.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-xs">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-muted-foreground">{p.name}</span>
                  <span className="ml-auto font-semibold text-foreground">{p.value}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row */}
      <div className="grid lg:grid-cols-5 gap-4">
        {/* Activity */}
        <Card className="lg:col-span-3 border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="font-display text-base">Recent Activity</CardTitle>
                <CardDescription className="text-xs">Latest updates across your agency</CardDescription>
              </div>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-center gap-3 py-2.5 px-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <div className={`w-2 h-2 rounded-full shrink-0 ${a.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="text-[11px] text-muted-foreground/70 whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Clients */}
        <Card className="lg:col-span-2 border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="font-display text-base">Top Clients</CardTitle>
            <CardDescription className="text-xs">By revenue this quarter</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {topClients.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-display font-bold text-primary shrink-0">
                    {c.avatar}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.projects} projects</p>
                  </div>
                  <span className="text-sm font-display font-bold text-foreground">{c.revenue}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign, Users, Briefcase, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import { Badge } from "@/components/ui/badge";

const stats = [
  { title: "Total Revenue", value: "$48,250", change: "+12.5%", up: true, icon: DollarSign },
  { title: "Active Clients", value: "34", change: "+3", up: true, icon: Users },
  { title: "Running Projects", value: "18", change: "+2", up: true, icon: Briefcase },
  { title: "Growth Rate", value: "24%", change: "-2.1%", up: false, icon: TrendingUp },
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
  { action: "New client onboarded", detail: "TechStart Inc.", time: "2h ago", type: "client" },
  { action: "Invoice paid", detail: "$4,500 from MediaCo", time: "5h ago", type: "invoice" },
  { action: "Project completed", detail: "Social Campaign Q1", time: "1d ago", type: "project" },
  { action: "Team member added", detail: "Sarah — Designer", time: "2d ago", type: "team" },
  { action: "Subscription renewed", detail: "Pro Plan — Annual", time: "3d ago", type: "subscription" },
];

export default function DashboardOverview() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground mt-1">Welcome back! Here's your agency overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
          <Card key={stat.title} className="shadow-card border-border hover:shadow-elevated transition-shadow">
            <CardContent className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-xl bg-accent flex items-center justify-center">
                  <stat.icon className="h-5 w-5 text-primary" />
                </div>
                <Badge variant={stat.up ? "default" : "destructive"} className={stat.up ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : ""}>
                  {stat.up ? <ArrowUpRight className="h-3 w-3 mr-1" /> : <ArrowDownRight className="h-3 w-3 mr-1" />}
                  {stat.change}
                </Badge>
              </div>
              <div className="text-2xl font-display font-bold text-foreground">{stat.value}</div>
              <div className="text-sm text-muted-foreground">{stat.title}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts */}
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 shadow-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Revenue vs Expenses</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 15%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(260, 10%, 45%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(260, 10%, 45%)" />
                <Tooltip
                  contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(260, 15%, 90%)", boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
                  formatter={(value: number) => [`$${value.toLocaleString()}`, undefined]}
                />
                <Bar dataKey="revenue" fill="hsl(260, 35%, 40%)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="expenses" fill="hsl(42, 92%, 52%)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Project Types</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center">
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={projectTypes} cx="50%" cy="50%" innerRadius={55} outerRadius={85} dataKey="value" paddingAngle={4}>
                  {projectTypes.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-2 mt-2 w-full">
              {projectTypes.map((p) => (
                <div key={p.name} className="flex items-center gap-2 text-sm">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: p.color }} />
                  <span className="text-muted-foreground">{p.name} ({p.value}%)</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Activity & Performance */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentActivities.map((a, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="w-2 h-2 rounded-full bg-secondary mt-2 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{a.action}</p>
                    <p className="text-xs text-muted-foreground">{a.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{a.time}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card border-border">
          <CardHeader>
            <CardTitle className="font-display text-lg">Monthly Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={revenueData.slice(-6)}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(260, 15%, 90%)" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="hsl(260, 10%, 45%)" />
                <YAxis tick={{ fontSize: 12 }} stroke="hsl(260, 10%, 45%)" />
                <Tooltip contentStyle={{ borderRadius: "0.75rem", border: "1px solid hsl(260, 15%, 90%)" }} />
                <Line type="monotone" dataKey="revenue" stroke="hsl(260, 35%, 40%)" strokeWidth={2.5} dot={{ fill: "hsl(260, 35%, 40%)", r: 4 }} />
                <Line type="monotone" dataKey="expenses" stroke="hsl(42, 92%, 52%)" strokeWidth={2.5} dot={{ fill: "hsl(42, 92%, 52%)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

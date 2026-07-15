import sys

with open("src/pages/DashboardOverview.tsx", "r") as f:
    content = f.read()

prefix_end = content.find("  return (\n    <div className=\"space-y-6 pb-10\">\n\n      {/* ── Header ── */}")

if prefix_end == -1:
    print("Could not find anchor point.")
    sys.exit(1)

prefix = content[:prefix_end]
suffix = """  const crmStats = [
    {
      id: "active-clients",
      title: "Active Clients",
      value: activeClientsCount.toString(),
      change: "+2",
      changeColor: "success",
      gradientFrom: "from-blue-600/10",
      bgCircle: "#487fff",
      icon: Users,
    },
    {
      id: "new-leads",
      title: "New Leads",
      value: newLeadsThisMonth.toString(),
      change: "+5",
      changeColor: "success",
      gradientFrom: "from-green-600/10",
      bgCircle: "#45b369",
      icon: Activity,
    },
    {
      id: "total-revenue",
      title: "Total Revenue",
      value: stats.find(s => s.id === 'revenue')?.value || "$0",
      change: growthRate >= 0 ? `+${growthRate}%` : `${growthRate}%`,
      changeColor: growthRate >= 0 ? "success" : "danger",
      gradientFrom: "from-yellow-500/10",
      bgCircle: "#f4941e",
      icon: Banknote,
    },
    {
      id: "net-profit",
      title: "Net Profit",
      value: formatCurrency(netProfitValue),
      change: `${profitMarginValue}%`,
      changeColor: netProfitValue >= 0 ? "success" : "danger",
      gradientFrom: "from-purple-600/10",
      bgCircle: "#8252e9",
      icon: Coins,
    },
    {
      id: "active-mrr",
      title: "Active MRR",
      value: formatCurrency(activeMrr),
      change: "+12",
      changeColor: "success",
      gradientFrom: "from-pink-600/10",
      bgCircle: "#de3ace",
      icon: TrendingUp,
    },
    {
      id: "total-expenses",
      title: "Total Expenses",
      value: formatCurrency(monthlyExpenses),
      change: "-$2k",
      changeColor: "danger",
      gradientFrom: "from-cyan-600/10",
      bgCircle: "#00b8f2",
      icon: TrendingDown,
    },
  ];

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-foreground tracking-tight">CRM Dashboard</h2>
          <p className="text-sm text-muted-foreground mt-0.5">CRM Dashboard Overview</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={() => setShowAddModal(true)} className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all h-auto cursor-pointer">
            <Plus className="w-3.5 h-3.5 text-primary" /> Add Expense
          </Button>
          <Link to="/dashboard/invoices/add" className="flex items-center gap-2 px-4 py-2 bg-primary hover:opacity-90 text-primary-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all shadow-md shadow-primary/20">
            <Plus className="w-3.5 h-3.5" /> New Invoice
          </Link>
          <Link to="/dashboard/clients/add" className="flex items-center gap-2 px-4 py-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl text-xs font-bold uppercase tracking-wider transition-all">
            <UserPlus className="w-3.5 h-3.5 text-primary" /> Add Client
          </Link>
          <Link to="/dashboard/settings" className="p-2 bg-background border border-border hover:bg-muted text-foreground rounded-xl transition-all">
            <Settings className="w-4 h-4" />
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-6 pb-10">

        <div className="lg:col-span-12 2xl:col-span-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 xl:grid-cols-3 gap-6 h-full">
            {crmStats.map((item) => {
              const Icon = item.icon;
              const colorClass = item.changeColor === "success"
                ? "bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400";
              return (
                <Card key={item.id} className={`shadow-sm rounded-xl border border-gray-200 dark:border-neutral-800 h-full bg-gradient-to-br ${item.gradientFrom} to-white dark:to-neutral-900`}>
                  <CardContent className="p-5 flex flex-col justify-between h-full">
                    <div className="flex flex-wrap items-start justify-between gap-1 mb-4">
                      <div className="flex items-center gap-3">
                        <span style={{ backgroundColor: item.bgCircle }} className="w-11 h-11 text-white flex justify-center items-center rounded-full shadow-sm">
                          <Icon className="w-5 h-5" />
                        </span>
                        <div>
                          <span className="text-sm font-semibold text-neutral-500 dark:text-neutral-400">
                            {item.title}
                          </span>
                          <h6 className="font-bold text-xl text-foreground">{item.value}</h6>
                        </div>
                      </div>
                      <div className="w-16 h-10 opacity-60">
                         <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={[{v:3},{v:5},{v:2},{v:8},{v:6}]} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                              <defs>
                                <linearGradient id={`grad-${item.id}`} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="0%" stopColor={item.bgCircle} stopOpacity={0.4} />
                                  <stop offset="100%" stopColor={item.bgCircle} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <Area type="monotone" dataKey="v" stroke={item.bgCircle} strokeWidth={2} fill={`url(#grad-${item.id})`} dot={false} isAnimationActive={false} />
                            </AreaChart>
                         </ResponsiveContainer>
                      </div>
                    </div>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400">
                      Performance {" "}
                      <span className={`px-1.5 py-0.5 rounded font-bold ${colorClass}`}>
                        {item.change}
                      </span>{" "}
                      this period
                    </p>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        <div className="lg:col-span-12 2xl:col-span-12">
          <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
                <div>
                  <h6 className="font-bold text-lg text-foreground mb-0">Earning Statistic</h6>
                  <span className="text-sm font-medium text-neutral-500 dark:text-neutral-400">Revenue and spending overview</span>
                </div>
                <Tabs value={trajectoryView} onValueChange={(v) => setTrajectoryView(v as any)}>
                  <TabsList className="h-9 p-1 bg-muted rounded-lg">
                    <TabsTrigger value="daily" className="text-xs font-semibold px-3 py-1 rounded-md transition-all">Daily</TabsTrigger>
                    <TabsTrigger value="weekly" className="text-xs font-semibold px-3 py-1 rounded-md transition-all">Weekly</TabsTrigger>
                    <TabsTrigger value="monthly" className="text-xs font-semibold px-3 py-1 rounded-md transition-all">Monthly</TabsTrigger>
                    <TabsTrigger value="yearly" className="text-xs font-semibold px-3 py-1 rounded-md transition-all">Yearly</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div className="h-[330px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={revenueTrend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} opacity={0.4} />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis tick={{ fontSize: 11, fontWeight: 600, fill: 'hsl(var(--muted-foreground))' }} axisLine={false} tickLine={false} tickFormatter={(v) => v >= 1000 ? `$${v / 1000}k` : `$${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid hsl(var(--border))", padding: '12px', background: 'hsl(var(--card))', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                      itemStyle={{ fontWeight: 600, fontSize: '12px' }}
                      labelStyle={{ fontWeight: 700, color: 'hsl(var(--foreground))', marginBottom: '8px' }}
                      formatter={(v, name) => [formatCurrency(v as number), name]}
                    />
                    <Bar dataKey="paid" name="Revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="recurring" name="Recurring" fill="hsl(var(--secondary))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                    <Bar dataKey="expenses" name="Expenses" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} maxBarSize={40} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
          <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-6">
                <AlertCircle className="w-5 h-5 text-secondary" />
                <h4 className="text-lg font-bold text-foreground">Receivables</h4>
              </div>
              {receivables.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="w-10 h-10 text-emerald-500 opacity-50 mb-3" />
                  <p className="text-sm font-bold text-emerald-600/70 italic">All clear — no outstanding invoices!</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {receivables.map(inv => {
                    const isOverdue = inv.status === 'Overdue';
                    return (
                      <Link key={inv.id} to={inv.link} className={`block p-4 rounded-xl border transition-all ${isOverdue ? 'bg-red-50 border-red-100 hover:bg-red-100 dark:bg-red-900/10 dark:border-red-900/30' : 'bg-neutral-50 border-neutral-100 hover:bg-neutral-100 dark:bg-neutral-900 dark:border-neutral-800'}`}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-xs font-bold uppercase tracking-widest flex items-center gap-1.5 ${isOverdue ? 'text-red-500' : 'text-primary'}`}>
                            {isOverdue && <span className="h-1.5 w-1.5 rounded-full bg-red-500 animate-pulse" />}
                            {inv.status}
                          </span>
                          <span className="text-sm font-black text-foreground">{inv.amount}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-foreground truncate pr-2">{inv.client}</p>
                          <p className="text-[10px] text-muted-foreground font-semibold shrink-0">Due {formatDate(inv.dueDate)}</p>
                        </div>
                      </Link>
                    );
                  })}
                  <Button variant="outline" className="w-full text-xs font-bold uppercase tracking-wider mt-4 h-10" asChild>
                    <Link to="/dashboard/invoices">View All</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-6 2xl:col-span-4">
           <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h4 className="text-lg font-bold text-foreground">Project Pulse</h4>
                  <p className="text-xs font-medium text-muted-foreground mt-1">Health of active projects</p>
                </div>
                <Badge className="bg-emerald-50 text-emerald-600 border-0 text-[10px] uppercase font-black px-2">Live</Badge>
              </div>
              <div className="space-y-6">
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    <span>On Track</span>
                    <span className="text-primary">{projectHealth.onTrack}%</span>
                  </div>
                  <Progress value={projectHealth.onTrack} className="h-2 bg-muted" indicatorClassName="bg-primary" />
                </div>
                <div>
                  <div className="flex justify-between text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">
                    <span>At Risk</span>
                    <span className="text-secondary">{projectHealth.atRisk}%</span>
                  </div>
                  <Progress value={projectHealth.atRisk} className="h-2 bg-muted" indicatorClassName="bg-secondary" />
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-dashed border-border/60 flex flex-col gap-1">
                <p className="text-3xl font-black text-foreground">{projectHealth.total}</p>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Active Projects</p>
              </div>
            </CardContent>
           </Card>
        </div>

        <div className="lg:col-span-12 2xl:col-span-4">
          <Card className="rounded-xl border border-gray-200 dark:border-neutral-800 shadow-sm h-full">
            <CardContent className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h4 className="text-lg font-bold text-foreground">Recent Activity</h4>
              </div>
              <div className="space-y-4">
                {activities.length > 0 ? activities.map((act, i) => (
                  <Link key={i} to={act.link} className="flex items-start gap-4 group p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-900 transition-all border border-transparent hover:border-border">
                    <div className={`w-10 h-10 rounded-xl ${act.colorType === 'primary' ? 'bg-primary/10 text-primary' : 'bg-secondary/10 text-secondary'} flex items-center justify-center shrink-0`}>
                      <act.icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{act.subject}</p>
                      <p className="text-xs font-medium text-muted-foreground mt-0.5">{act.action}</p>
                    </div>
                    <p className="text-[10px] font-bold text-muted-foreground shrink-0 mt-1">{formatDistanceToNow(act.time)}</p>
                  </Link>
                )) : (
                  <div className="text-center py-8 text-muted-foreground text-sm font-medium">
                    No recent activity yet.
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

      </div>

      {showAddModal && (
        <QuickAddExpenseModal
          accounts={accounts}
          onClose={() => setShowAddModal(false)}
          onSaved={async () => {
            setShowAddModal(false);
            setIsLoading(true);
            const now = new Date();
            const fourYearsAgo = subYears(now, 4);
            const fromStr = format(startOfYear(fourYearsAgo), "yyyy-MM-dd");
            const toStr = format(endOfYear(now), "yyyy-MM-dd");
            await Promise.all([
              fetchAllData(),
              apiFetch<{ expenses: any[]; total: number }>(`/expenses?from=${fromStr}&to=${toStr}&limit=2000`).then(res => {
                setAllExpenses(res.expenses);
                const currentMonthStart = startOfMonth(now);
                const currentMonthEnd = endOfMonth(now);
                const currentMonthExpenses = res.expenses.filter((e: any) => {
                  const d = new Date(e.date);
                  return d >= currentMonthStart && d <= currentMonthEnd;
                });
                const totalDollars = currentMonthExpenses.reduce((sum: number, e: any) => sum + e.amount, 0) / 100;
                setMonthlyExpenses(totalDollars);
              }).catch(err => console.error(err)),
              apiFetch<{ accounts: any[] }>("/accounts").then(res => setAccounts(res.accounts)).catch(err => console.error(err))
            ]);
            setIsLoading(false);
          }}
        />
      )}
    </>
  );
}
"""

with open("src/pages/DashboardOverview.tsx", "w") as f:
    f.write(prefix + suffix)
print("Rewrite complete.")

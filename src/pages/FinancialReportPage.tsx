import { useState, useEffect, useMemo } from "react";
import { useToast } from "@/hooks/use-toast";
import { apiFetch } from "@/lib/api-client";
import { formatCurrency } from "@/lib/utils";
import { useAgencyStore } from "@/lib/store";
import { parseAmountNumber } from "@/lib/money";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  TrendingUp,
  TrendingDown,
  Printer,
  Calendar,
  DollarSign,
  Briefcase,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  Percent,
  Wallet,
  Activity,
  FileText,
  PieChart as PieIcon,
  Percent as PercentIcon
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { startOfMonth, endOfMonth, subMonths, startOfYear, endOfYear, format } from "date-fns";

interface IncomeStatementData {
  period: { from: string; to: string; months: number };
  revenue: { invoiceRevenue: number; subscriptionRevenue: number; total: number };
  expenses: {
    payroll: number;
    rent: number;
    software: number;
    marketing: number;
    utilities: number;
    miscellaneous: number;
    total: number;
  };
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
}

interface BalanceSheetData {
  asOf: string;
  assets: {
    cash: number;
    accountsReceivable: number;
    fixedAssets: number;
    accumulatedDepreciation: number;
    total: number;
  };
  liabilities: { accountsPayable: number; accruedPayroll: number; total: number };
  equity: { retainedEarnings: number; total: number };
  totalLiabilitiesAndEquity: number;
}

interface CashFlowData {
  period: { from: string; to: string };
  operatingActivities: {
    receiptsFromClients: number;
    paymentsForPayroll: number;
    paymentsForExpenses: number;
    netCashFromOperating: number;
  };
  investingActivities: { purchaseOfEquipment: number; netCashFromInvesting: number };
  financingActivities: { ownerDrawings: number; netCashFromFinancing: number };
  netChangeInCash: number;
  cashAtBeginning: number;
  cashAtEnd: number;
}

export default function FinancialReportPage() {
  const { toast } = useToast();
  const { invoices, fetchInvoices } = useAgencyStore();
  const [activeTab, setActiveTab] = useState<string>("income-statement");
  const [preset, setPreset] = useState<string>("this-month");
  
  // Date states
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  const [isCustomDate, setIsCustomDate] = useState<boolean>(false);

  // Data states
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementData | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetData | null>(null);
  const [cashFlow, setCashFlow] = useState<CashFlowData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Set default dates based on preset
  useEffect(() => {
    const now = new Date();
    let start: Date;
    let end: Date;

    setIsCustomDate(preset === "custom");

    switch (preset) {
      case "this-month":
        start = startOfMonth(now);
        end = endOfMonth(now);
        break;
      case "last-month":
        start = startOfMonth(subMonths(now, 1));
        end = endOfMonth(subMonths(now, 1));
        break;
      case "this-quarter": {
        const quarterStartMonth = Math.floor(now.getMonth() / 3) * 3;
        start = new Date(now.getFullYear(), quarterStartMonth, 1);
        end = new Date(now.getFullYear(), quarterStartMonth + 3, 0);
        break;
      }
      case "this-year":
        start = startOfYear(now);
        end = endOfYear(now);
        break;
      case "custom":
        // Keep current dates, let user edit
        return;
      default:
        start = startOfMonth(now);
        end = endOfMonth(now);
    }

    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
  }, [preset]);

  // Fetch financial data when dates change
  useEffect(() => {
    if (!startDate || !endDate) return;

    const fetchFinancialData = async () => {
      setLoading(true);
      try {
        const [isRes, bsRes, cfRes] = await Promise.all([
          apiFetch<IncomeStatementData>(`/financial/income-statement?from=${startDate}&to=${endDate}`),
          apiFetch<BalanceSheetData>(`/financial/balance-sheet?asOf=${endDate}`),
          apiFetch<CashFlowData>(`/financial/cash-flow?from=${startDate}&to=${endDate}`)
        ]);

        setIncomeStatement(isRes);
        setBalanceSheet(bsRes);
        setCashFlow(cfRes);
      } catch (err: any) {
        console.error("Failed to fetch financial data:", err);
        toast({
          title: "Error fetching reports",
          description: err.message || "Failed to load financial records.",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchFinancialData();
  }, [startDate, endDate, toast]);

  useEffect(() => {
    fetchInvoices();
  }, [fetchInvoices]);

  const handlePrint = () => {
    window.print();
  };

  const gatewayReportData = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);

    const groups: Record<string, number> = {};
    let totalCollected = 0;

    const rangeInvoices = invoices.filter(inv => {
      const d = new Date(inv.date);
      return d >= start && d <= end && (inv.status === 'Paid' || inv.status === 'Partially Paid');
    });

    rangeInvoices.forEach(inv => {
      const method = inv.paymentMethod || 'Unspecified';
      const amount = inv.status === 'Paid' ? parseAmountNumber(inv.amount) : (inv.deposit || 0);
      groups[method] = (groups[method] || 0) + amount;
      totalCollected += amount;
    });

    const colors = [
      "hsl(var(--primary))",
      "hsl(260, 45%, 55%)",
      "hsl(var(--secondary))",
      "hsl(142, 72%, 29%)",
      "hsl(200, 80%, 40%)",
      "hsl(0, 72%, 51%)",
      "#9ca3af"
    ];

    return Object.entries(groups).map(([gateway, amount], index) => {
      return {
        name: gateway,
        value: Math.round(amount * 100) / 100,
        color: colors[index % colors.length],
        percentage: totalCollected > 0 ? (amount / totalCollected) * 100 : 0
      };
    }).sort((a, b) => b.value - a.value);
  }, [invoices, startDate, endDate]);

  const rangeInvoices = useMemo(() => {
    if (!startDate || !endDate) return [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    end.setHours(23, 59, 59, 999);
    return invoices
      .filter(inv => {
        const d = new Date(inv.date);
        return d >= start && d <= end && (inv.status === 'Paid' || inv.status === 'Partially Paid');
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [invoices, startDate, endDate]);

  // Safe division utility
  const formatVal = (cents: number | undefined) => {
    if (cents === undefined) return formatCurrency(0);
    return formatCurrency(cents / 100);
  };

  // Recharts Chart Formatter
  const formatChartVal = (cents: number) => {
    return Math.round(cents / 100);
  };

  // Render Loading State
  const renderLoading = () => (
    <div className="space-y-6 animate-pulse">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="border-border">
            <CardHeader className="h-12 bg-muted/20 rounded-t-xl"></CardHeader>
            <CardContent className="h-20 bg-muted/10 rounded-b-xl"></CardContent>
          </Card>
        ))}
      </div>
      <Card className="border-border">
        <CardHeader className="h-16 bg-muted/25 rounded-t-xl"></CardHeader>
        <CardContent className="h-96 bg-muted/10 rounded-b-xl"></CardContent>
      </Card>
    </div>
  );

  if (!incomeStatement || !balanceSheet || !cashFlow) {
    return loading ? renderLoading() : <div className="text-center py-10">No data available</div>;
  }

  // Chart data preparing
  const profitLossChartData = [
    {
      name: "Total Revenue",
      Invoiced: formatChartVal(incomeStatement.revenue.invoiceRevenue),
      Subscription: formatChartVal(incomeStatement.revenue.subscriptionRevenue),
      Total: formatChartVal(incomeStatement.revenue.total),
    },
    {
      name: "Operating Expenses",
      Payroll: formatChartVal(incomeStatement.expenses.payroll),
      Rent: formatChartVal(incomeStatement.expenses.rent),
      Software: formatChartVal(incomeStatement.expenses.software),
      Marketing: formatChartVal(incomeStatement.expenses.marketing),
      Utilities: formatChartVal(incomeStatement.expenses.utilities),
      Misc: formatChartVal(incomeStatement.expenses.miscellaneous),
      Total: formatChartVal(incomeStatement.expenses.total),
    }
  ];

  const expensePieData = [
    { name: "Payroll", value: incomeStatement.expenses.payroll },
    { name: "Office Rent", value: incomeStatement.expenses.rent },
    { name: "Software Subscriptions", value: incomeStatement.expenses.software },
    { name: "Marketing", value: incomeStatement.expenses.marketing },
    { name: "Utilities & Services", value: incomeStatement.expenses.utilities },
    { name: "Miscellaneous", value: incomeStatement.expenses.miscellaneous },
  ].filter(item => item.value > 0);

  const COLORS = [
    "hsl(var(--primary))",
    "hsl(260, 45%, 55%)",
    "hsl(var(--secondary))",
    "hsl(142, 72%, 29%)",
    "hsl(200, 80%, 40%)",
    "hsl(0, 72%, 51%)"
  ];

  const isBalanced = Math.abs(balanceSheet.assets.total - balanceSheet.totalLiabilitiesAndEquity) < 100; // Allow 1 dollar float diff

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 print:hidden">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">Financial Reports</h1>
          <p className="text-muted-foreground mt-1">Live Profit & Loss, Balance Sheets, and Statement of Cash Flows</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2 rounded-xl" onClick={handlePrint}>
            <Printer className="h-4 w-4" /> Print / Export PDF
          </Button>
        </div>
      </div>

      {/* Filter and Date Controls */}
      <Card className="shadow-card border-border print:hidden">
        <CardContent className="p-4 flex flex-col lg:flex-row lg:items-end justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4 w-full lg:w-auto">
            <div className="space-y-1 min-w-[160px]">
              <Label className="text-xs text-muted-foreground">Reporting Period</Label>
              <Select value={preset} onValueChange={setPreset}>
                <SelectTrigger className="rounded-xl h-10 border-border bg-card">
                  <SelectValue placeholder="Select period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="this-month">This Month</SelectItem>
                  <SelectItem value="last-month">Last Month</SelectItem>
                  <SelectItem value="this-quarter">This Quarter</SelectItem>
                  <SelectItem value="this-year">This Year</SelectItem>
                  <SelectItem value="custom">Custom Range</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Start Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  disabled={!isCustomDate}
                  className="pl-9 h-10 rounded-xl border-border bg-card w-40"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">End/Snapshot Date</Label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="date"
                  disabled={!isCustomDate}
                  className="pl-9 h-10 rounded-xl border-border bg-card w-40"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary text-[11px] px-2 py-0.5 rounded-full font-mono">
              Live DB calculations
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Printed Header (Only visible when printing) */}
      <div className="hidden print:block border-b border-border pb-6 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">FINANCIAL REPORT</h1>
            <p className="text-sm text-slate-500 mt-1">Statement Period: {startDate} to {endDate}</p>
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold text-slate-800">Agency Flow Pro</h2>
            <p className="text-xs text-slate-500">Corporate Finance & Ledger</p>
          </div>
        </div>
      </div>

      {loading ? (
        renderLoading()
      ) : (
        <>
          {/* Financial KPI Cards Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-4 gap-4 print:grid-cols-4">
            <Card className="shadow-card border-border overflow-hidden relative group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Revenue</span>
                  <div className="p-2 rounded-xl bg-green-500/10 text-green-500">
                    <TrendingUp className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mt-2 text-foreground tracking-tight">
                  {formatVal(incomeStatement.revenue.total)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span className="text-green-500 font-medium">Invoiced & Active Subs</span>
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border overflow-hidden relative group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Expenses</span>
                  <div className="p-2 rounded-xl bg-red-500/10 text-red-500">
                    <TrendingDown className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mt-2 text-foreground tracking-tight">
                  {formatVal(incomeStatement.expenses.total)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                  <span>Payroll + simulated operations</span>
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border overflow-hidden relative group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Net Profit</span>
                  <div className={`p-2 rounded-xl ${incomeStatement.netProfit >= 0 ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
                    <DollarSign className="h-4 w-4" />
                  </div>
                </div>
                <h3 className={`text-2xl font-bold mt-2 tracking-tight ${incomeStatement.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {formatVal(incomeStatement.netProfit)}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Operating net income
                </p>
              </CardContent>
            </Card>

            <Card className="shadow-card border-border overflow-hidden relative group">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Profit Margin</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-500">
                    <Activity className="h-4 w-4" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold mt-2 text-foreground tracking-tight">
                  {incomeStatement.profitMargin.toFixed(1)}%
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Return on total revenue
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Main Statement Tabs */}
          <Tabs defaultValue="income-statement" className="w-full" onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-muted/50 p-1 rounded-xl h-11 print:hidden max-w-2xl">
              <TabsTrigger value="income-statement" className="rounded-lg text-[13px] font-medium transition-all">
                Income Statement
              </TabsTrigger>
              <TabsTrigger value="balance-sheet" className="rounded-lg text-[13px] font-medium transition-all">
                Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="cash-flow" className="rounded-lg text-[13px] font-medium transition-all">
                Cash Flow
              </TabsTrigger>
              <TabsTrigger value="payment-gateways" className="rounded-lg text-[13px] font-medium transition-all">
                Payment Gateways
              </TabsTrigger>
            </TabsList>

            {/* INCOME STATEMENT TAB */}
            <TabsContent value="income-statement" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Statement Sheet */}
                <Card className="shadow-card border-border xl:col-span-2 print:border-0 print:shadow-none">
                  <CardHeader className="border-b border-border pb-4 print:px-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <FileText className="h-5 w-5 text-primary" />
                      Income Statement (Profit & Loss)
                    </CardTitle>
                    <CardDescription className="text-xs">
                      For the period from {startDate} to {endDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 print:p-0">
                    <div className="divide-y divide-border/60 text-sm">
                      {/* REVENUE SECTION */}
                      <div className="p-4 bg-muted/10 print:px-0">
                        <div className="flex justify-between font-bold text-foreground py-1 text-[15px]">
                          <span>1. REVENUE</span>
                          <span>{formatVal(incomeStatement.revenue.total)}</span>
                        </div>
                        <div className="pl-4 mt-2 space-y-1.5 text-muted-foreground">
                          <div className="flex justify-between py-0.5">
                            <span>Client Invoices (Paid / Received Deposits)</span>
                            <span className="text-foreground">{formatVal(incomeStatement.revenue.invoiceRevenue)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Active Recurring Subscriptions</span>
                            <span className="text-foreground">{formatVal(incomeStatement.revenue.subscriptionRevenue)}</span>
                          </div>
                        </div>
                      </div>

                      {/* GROSS PROFIT */}
                      <div className="p-4 bg-muted/20 flex justify-between font-bold text-foreground py-2 text-[15px] print:px-0">
                        <span>GROSS PROFIT</span>
                        <span>{formatVal(incomeStatement.grossProfit)}</span>
                      </div>

                      {/* OPERATING EXPENSES SECTION */}
                      <div className="p-4 bg-muted/10 print:px-0">
                        <div className="flex justify-between font-bold text-foreground py-1 text-[15px]">
                          <span>2. OPERATING EXPENSES</span>
                          <span>({formatVal(incomeStatement.expenses.total)})</span>
                        </div>
                        <div className="pl-4 mt-2 space-y-1.5 text-muted-foreground">
                          <div className="flex justify-between py-0.5">
                            <span>Employee Payroll & Salaries (Active Team)</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.payroll)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Office Rental & Co-Working Space</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.rent)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Software & Cloud Subscriptions (SaaS tools)</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.software)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Marketing & Client Acquisition Advertising</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.marketing)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Utilities, Server & Infrastructure Fees</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.utilities)}</span>
                          </div>
                          <div className="flex justify-between py-0.5">
                            <span>Miscellaneous & Other Operating Outlays</span>
                            <span className="text-foreground">{formatVal(incomeStatement.expenses.miscellaneous)}</span>
                          </div>
                        </div>
                      </div>

                      {/* OPERATING NET INCOME */}
                      <div className="p-5 flex justify-between font-bold py-3 text-[16px] border-t-2 border-primary/50 bg-primary/5 print:px-0">
                        <span className="text-primary font-display">NET PROFIT / INCOME</span>
                        <span className={incomeStatement.netProfit >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}>
                          {formatVal(incomeStatement.netProfit)}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Charts Sidebar */}
                <div className="space-y-6 print:hidden">
                  <Card className="shadow-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Activity className="h-4 w-4" /> Profitability Ratio
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={profitLossChartData}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" stroke="#888888" fontSize={11} tickLine={false} axisLine={false} />
                          <YAxis stroke="#888888" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${v}`} />
                          <RechartsTooltip formatter={(v) => [`$${v}`, '']} />
                          <Bar dataKey="Total" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} maxBarSize={50} />
                        </BarChart>
                      </ResponsiveContainer>
                    </CardContent>
                  </Card>

                  <Card className="shadow-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <PieIcon className="h-4 w-4" /> Expense Breakdown
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-60 flex items-center justify-center">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={expensePieData}
                            cx="50%"
                            cy="50%"
                            innerRadius={45}
                            outerRadius={70}
                            paddingAngle={3}
                            dataKey="value"
                          >
                            {expensePieData.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip formatter={(v) => [`$${Math.round(Number(v) / 100)}`, '']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-1.5 text-xs ml-2 shrink-0">
                        {expensePieData.map((item, idx) => (
                          <div key={item.name} className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* BALANCE SHEET TAB */}
            <TabsContent value="balance-sheet" className="space-y-6 mt-6">
              <Card className="shadow-card border-border print:border-0 print:shadow-none">
                <CardHeader className="border-b border-border pb-4 print:px-0 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      Balance Sheet
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Snapshot of assets, liabilities and equity as of {balanceSheet.asOf}
                    </CardDescription>
                  </div>
                  {isBalanced && (
                    <Badge className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-green-500/20 rounded-full py-1 px-3 flex items-center gap-1">
                      <ShieldCheck className="h-4 w-4" /> Balanced Sheet
                    </Badge>
                  )}
                </CardHeader>
                <CardContent className="p-6 print:p-0">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8 print:grid-cols-2">
                    {/* ASSETS COLUMN */}
                    <div className="space-y-4">
                      <h3 className="text-[15px] font-bold text-foreground border-b border-border pb-2 flex items-center justify-between">
                        <span>A. ASSETS</span>
                        <span className="text-primary">{formatVal(balanceSheet.assets.total)}</span>
                      </h3>
                      <div className="divide-y divide-border/40 text-sm space-y-3 pl-1">
                        <div className="flex justify-between py-1.5">
                          <div>
                            <p className="font-semibold text-foreground">Cash & Cash Equivalents</p>
                            <p className="text-xs text-muted-foreground">Bank account balances & liquidity</p>
                          </div>
                          <span className="font-medium text-foreground">{formatVal(balanceSheet.assets.cash)}</span>
                        </div>

                        <div className="flex justify-between py-1.5">
                          <div>
                            <p className="font-semibold text-foreground">Accounts Receivable (A/R)</p>
                            <p className="text-xs text-muted-foreground">Unpaid client invoices & billed revenue</p>
                          </div>
                          <span className="font-medium text-foreground">{formatVal(balanceSheet.assets.accountsReceivable)}</span>
                        </div>

                        <div className="flex justify-between py-1.5">
                          <div>
                            <p className="font-semibold text-foreground">Office Equipment & Hardware</p>
                            <p className="text-xs text-muted-foreground">Computers, IT gear, and furniture assets</p>
                          </div>
                          <span className="font-medium text-foreground">{formatVal(balanceSheet.assets.fixedAssets)}</span>
                        </div>

                        <div className="flex justify-between py-1.5 text-muted-foreground">
                          <div>
                            <p className="font-semibold">Less: Accumulated Depreciation</p>
                            <p className="text-xs">Estimated write-downs on hardware</p>
                          </div>
                          <span className="font-medium">({formatVal(Math.abs(balanceSheet.assets.accumulatedDepreciation))})</span>
                        </div>
                      </div>
                    </div>

                    {/* LIABILITIES & OWNER'S EQUITY COLUMN */}
                    <div className="space-y-6">
                      {/* LIABILITIES */}
                      <div className="space-y-4">
                        <h3 className="text-[15px] font-bold text-foreground border-b border-border pb-2 flex items-center justify-between">
                          <span>B. LIABILITIES</span>
                          <span className="text-red-500">{formatVal(balanceSheet.liabilities.total)}</span>
                        </h3>
                        <div className="divide-y divide-border/40 text-sm space-y-3 pl-1">
                          <div className="flex justify-between py-1.5">
                            <div>
                              <p className="font-semibold text-foreground">Accounts Payable (A/P)</p>
                              <p className="text-xs text-muted-foreground">Unpaid SaaS, utility bills, or vendors</p>
                            </div>
                            <span className="font-medium text-foreground">{formatVal(balanceSheet.liabilities.accountsPayable)}</span>
                          </div>

                          <div className="flex justify-between py-1.5">
                            <div>
                              <p className="font-semibold text-foreground">Accrued Payroll & Salaries</p>
                              <p className="text-xs text-muted-foreground">Pro-rated payroll due in current cycle</p>
                            </div>
                            <span className="font-medium text-foreground">{formatVal(balanceSheet.liabilities.accruedPayroll)}</span>
                          </div>
                        </div>
                      </div>

                      {/* OWNER'S EQUITY */}
                      <div className="space-y-4 pt-2">
                        <h3 className="text-[15px] font-bold text-foreground border-b border-border pb-2 flex items-center justify-between">
                          <span>C. OWNER'S EQUITY</span>
                          <span className="text-green-500">{formatVal(balanceSheet.equity.total)}</span>
                        </h3>
                        <div className="divide-y divide-border/40 text-sm space-y-3 pl-1">
                          <div className="flex justify-between py-1.5">
                            <div>
                              <p className="font-semibold text-foreground">Retained Earnings</p>
                              <p className="text-xs text-muted-foreground">Cumulative retained agency profits</p>
                            </div>
                            <span className="font-medium text-foreground">{formatVal(balanceSheet.equity.retainedEarnings)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary row */}
                  <div className="border-t-2 border-border mt-8 pt-4 flex flex-col sm:flex-row justify-between items-center text-base font-bold gap-4 print:flex-row">
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Total Assets:</span>
                      <span className="text-foreground">{formatVal(balanceSheet.assets.total)}</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-muted-foreground">Total Liabilities & Equity:</span>
                      <span className="text-foreground">{formatVal(balanceSheet.totalLiabilitiesAndEquity)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* CASH FLOW TAB */}
            <TabsContent value="cash-flow" className="space-y-6 mt-6">
              <Card className="shadow-card border-border print:border-0 print:shadow-none">
                <CardHeader className="border-b border-border pb-4 print:px-0">
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Activity className="h-5 w-5 text-primary" />
                    Statement of Cash Flows
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Tracks cash coming in and going out from {startDate} to {endDate}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-0 print:p-0">
                  <div className="divide-y divide-border/60 text-sm">
                    {/* OPERATING ACTIVITIES */}
                    <div className="p-4 bg-muted/10 print:px-0">
                      <div className="flex justify-between font-bold text-foreground py-1 text-[15px]">
                        <span>1. CASH FLOWS FROM OPERATING ACTIVITIES</span>
                        <span className={cashFlow.operatingActivities.netCashFromOperating >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatVal(cashFlow.operatingActivities.netCashFromOperating)}
                        </span>
                      </div>
                      <div className="pl-4 mt-2 space-y-1.5 text-muted-foreground">
                        <div className="flex justify-between py-0.5">
                          <span>Cash receipts from clients (Invoices received)</span>
                          <span className="text-foreground">{formatVal(cashFlow.operatingActivities.receiptsFromClients)}</span>
                        </div>
                        <div className="flex justify-between py-0.5 text-red-500/90 dark:text-red-400/90">
                          <span>Cash paid for team member payroll</span>
                          <span>({formatVal(Math.abs(cashFlow.operatingActivities.paymentsForPayroll))})</span>
                        </div>
                        <div className="flex justify-between py-0.5 text-red-500/90 dark:text-red-400/90">
                          <span>Cash paid for operating bills & software</span>
                          <span>({formatVal(Math.abs(cashFlow.operatingActivities.paymentsForExpenses))})</span>
                        </div>
                      </div>
                    </div>

                    {/* INVESTING ACTIVITIES */}
                    <div className="p-4 bg-muted/20 print:px-0">
                      <div className="flex justify-between font-bold text-foreground py-1 text-[15px]">
                        <span>2. CASH FLOWS FROM INVESTING ACTIVITIES</span>
                        <span className={cashFlow.investingActivities.netCashFromInvesting >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatVal(cashFlow.investingActivities.netCashFromInvesting)}
                        </span>
                      </div>
                      <div className="pl-4 mt-2 space-y-1.5 text-muted-foreground">
                        <div className="flex justify-between py-0.5 text-red-500/90 dark:text-red-400/90">
                          <span>Purchase of computer hardware & assets</span>
                          <span>({formatVal(Math.abs(cashFlow.investingActivities.purchaseOfEquipment))})</span>
                        </div>
                      </div>
                    </div>

                    {/* FINANCING ACTIVITIES */}
                    <div className="p-4 bg-muted/10 print:px-0">
                      <div className="flex justify-between font-bold text-foreground py-1 text-[15px]">
                        <span>3. CASH FLOWS FROM FINANCING ACTIVITIES</span>
                        <span className={cashFlow.financingActivities.netCashFromFinancing >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatVal(cashFlow.financingActivities.netCashFromFinancing)}
                        </span>
                      </div>
                      <div className="pl-4 mt-2 space-y-1.5 text-muted-foreground">
                        <div className="flex justify-between py-0.5 text-red-500/90 dark:text-red-400/90">
                          <span>Owner distributions & equity draws</span>
                          <span>({formatVal(Math.abs(cashFlow.financingActivities.ownerDrawings))})</span>
                        </div>
                      </div>
                    </div>

                    {/* CASH RECONCILIATION */}
                    <div className="p-6 space-y-3 bg-card border-t-2 border-primary/50 print:px-0">
                      <div className="flex justify-between font-semibold py-0.5 text-foreground text-sm">
                        <span>Net Increase / (Decrease) in Cash & Cash Equivalents</span>
                        <span className={cashFlow.netChangeInCash >= 0 ? "text-green-600" : "text-red-600"}>
                          {formatVal(cashFlow.netChangeInCash)}
                        </span>
                      </div>
                      <div className="flex justify-between py-0.5 text-muted-foreground text-sm">
                        <span>Cash & Cash Equivalents at Beginning of Period</span>
                        <span className="text-foreground">{formatVal(cashFlow.cashAtBeginning)}</span>
                      </div>
                      <div className="flex justify-between font-bold py-1.5 text-foreground text-[16px] border-t border-border mt-2">
                        <span className="text-primary font-display">Cash & Cash Equivalents at End of Period</span>
                        <span className="text-primary">{formatVal(cashFlow.cashAtEnd)}</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* PAYMENT GATEWAYS TAB */}
            <TabsContent value="payment-gateways" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Gateway breakdown table */}
                <Card className="shadow-card border-border xl:col-span-2 print:border-0 print:shadow-none">
                  <CardHeader className="border-b border-border pb-4 print:px-0">
                    <CardTitle className="text-lg font-bold flex items-center gap-2">
                      <Wallet className="h-5 w-5 text-primary" />
                      Payment Gateway Revenue Breakdown
                    </CardTitle>
                    <CardDescription className="text-xs">
                      Total collections grouped by payment gateway for period from {startDate} to {endDate}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0 print:p-0">
                    <div className="divide-y divide-border/60 text-sm">
                      <div className="p-4 bg-muted/10 print:px-0 flex justify-between font-bold text-foreground py-2 text-[15px]">
                        <span>GATEWAY / METHOD</span>
                        <span>TOTAL RECEIVED</span>
                      </div>
                      {gatewayReportData.map((gateway) => (
                        <div key={gateway.name} className="p-4 flex justify-between items-center text-foreground font-semibold">
                          <div className="flex items-center gap-2">
                            <span className="w-3.5 h-3.5 rounded-full" style={{ backgroundColor: gateway.color }} />
                            <span>{gateway.name}</span>
                            <Badge variant="outline" className="text-[10px] ml-2">
                              {gateway.percentage.toFixed(1)}%
                            </Badge>
                          </div>
                          <span>{formatCurrency(gateway.value)}</span>
                        </div>
                      ))}
                      {gatewayReportData.length === 0 && (
                        <div className="p-8 text-center text-muted-foreground text-sm">
                          No payments recorded in this period.
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Pie Chart Card */}
                <div className="space-y-6 print:hidden">
                  <Card className="shadow-card border-border">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <PieIcon className="h-4 w-4" /> Share of Wallet
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="h-60 flex items-center justify-center">
                      {gatewayReportData.length > 0 ? (
                        <div className="flex items-center justify-between w-full">
                          <div className="w-[120px] h-[120px] shrink-0">
                            <ResponsiveContainer width="100%" height="100%">
                              <PieChart>
                                <Pie
                                  data={gatewayReportData}
                                  cx="50%"
                                  cy="50%"
                                  innerRadius={35}
                                  outerRadius={55}
                                  paddingAngle={3}
                                  dataKey="value"
                                >
                                  {gatewayReportData.map((entry, index) => (
                                    <Cell key={`cell-${index}`} fill={entry.color} />
                                  ))}
                                </Pie>
                                <RechartsTooltip formatter={(v) => [formatCurrency(Number(v)), '']} />
                              </PieChart>
                            </ResponsiveContainer>
                          </div>
                          <div className="flex flex-col gap-1.5 text-xs ml-2 shrink-0">
                            {gatewayReportData.map((item) => (
                              <div key={item.name} className="flex items-center gap-1.5">
                                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                <span className="text-muted-foreground truncate max-w-[120px]">{item.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="text-center text-muted-foreground text-sm py-8">
                          No data to display.
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>

                {/* Detailed range transactions list */}
                {rangeInvoices.length > 0 && (
                  <Card className="shadow-card border-border xl:col-span-3">
                    <CardHeader>
                      <CardTitle className="text-base font-bold flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-muted-foreground" />
                        Transactions List
                      </CardTitle>
                      <CardDescription className="text-xs">
                        Individual paid invoices in this period
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="p-0">
                      <div className="divide-y divide-border/60 text-xs">
                        <div className="grid grid-cols-5 p-3 bg-muted/20 font-bold text-muted-foreground">
                          <div>Invoice ID</div>
                          <div>Client</div>
                          <div>Date</div>
                          <div>Gateway</div>
                          <div className="text-right">Paid Amount</div>
                        </div>
                        {rangeInvoices.map((inv) => {
                          const amt = inv.status === 'Paid' ? parseAmountNumber(inv.amount) : (inv.deposit || 0);
                          return (
                            <div key={inv.id} className="grid grid-cols-5 p-3 items-center text-foreground hover:bg-muted/10 transition-colors">
                              <div className="font-semibold text-primary">{inv.invoiceNumber}</div>
                              <div className="truncate pr-2 font-medium">{inv.client}</div>
                              <div className="text-muted-foreground">{new Date(inv.date).toLocaleDateString()}</div>
                              <div>
                                <Badge variant="outline" className="text-[10px] py-0 px-2 font-medium capitalize">
                                  {inv.paymentMethod || 'Unspecified'}
                                </Badge>
                              </div>
                              <div className="text-right font-black">{formatCurrency(amt)}</div>
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}

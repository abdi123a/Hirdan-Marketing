import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore, type ClientUser } from '@/lib/auth-store';
import { useAgencyStore } from '@/lib/store';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  LogOut, FileText, Receipt, User, Building2, Mail, Phone,
  Globe, MapPin, Download, Eye, Calendar, DollarSign, Clock,
  ChevronRight, Shield, X, Printer, Loader2
} from 'lucide-react';
import hirdanLogo from '@/assets/hirdan-logo.png';
import { useReactToPrint } from 'react-to-print';
import { useRef } from 'react';
import { PremiumInvoice } from '@/components/PremiumInvoice';

const fadeIn = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.4, ease: 'easeOut' },
  }),
};

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    Paid: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Pending: 'bg-amber-100 text-amber-700 border-amber-200',
    Overdue: 'bg-red-100 text-red-700 border-red-200',
    Draft: 'bg-slate-100 text-slate-600 border-slate-200',
    Sent: 'bg-blue-100 text-blue-700 border-blue-200',
    Accepted: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    Expired: 'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${variants[status] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
      {status}
    </span>
  );
}

export default function ClientPortalPage() {
  const { user, logout } = useAuthStore();
  const { clients, invoices, proformas, settings, fetchAllData } = useAgencyStore();

  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    fetchAllData().finally(() => setIsInitialLoading(false));
  }, [fetchAllData]);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedDocument, setSelectedDocument] = useState<{ type: 'Invoice' | 'Proforma', data: any } | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: selectedDocument?.type === 'Invoice' ? `Invoice_${selectedDocument?.data?.id}` : `Proforma_${selectedDocument?.data?.id}`,
  });

  const clientUser = user as ClientUser;
  const client = clients.find((c) => c.id === clientUser.clientId);

  // Filter invoices and proformas for this client
  const clientInvoices = invoices.filter(
    (inv) => inv.client === client?.company || inv.client === client?.name
  );
  const clientProformas = proformas.filter(
    (pro) => pro.client === client?.company || pro.client === client?.name
  );

  const handleLogout = () => {
    logout();
    navigate('/client/login', { replace: true });
  };

  if (isInitialLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary opacity-20" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-2xl font-display font-bold text-foreground mb-2">Account Not Found</h2>
          <p className="text-muted-foreground mb-6">Your account could not be located.</p>
          <Button onClick={handleLogout}>Back to Login</Button>
        </div>
      </div>
    );
  }

  const totalInvoiced = clientInvoices.reduce((sum, inv) => {
    const num = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ''));
    return sum + (isNaN(num) ? 0 : num);
  }, 0);

  const totalPaid = clientInvoices
    .filter((inv) => inv.status === 'Paid')
    .reduce((sum, inv) => {
      const num = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

  const totalPending = clientInvoices
    .filter((inv) => inv.status !== 'Paid')
    .reduce((sum, inv) => {
      const num = parseFloat(inv.amount.replace(/[^0-9.-]+/g, ''));
      return sum + (isNaN(num) ? 0 : num);
    }, 0);

  const initials = client.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 md:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img src={settings.logo || hirdanLogo} alt={settings.agencyName} className="h-8 object-contain" />
            <div className="hidden md:block w-px h-6 bg-border" />
            <span className="hidden md:block text-sm text-muted-foreground">Client Portal</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-3 mr-2">
              <Avatar className="h-9 w-9 ring-2 ring-secondary/20">
                <AvatarFallback className="bg-secondary/10 text-secondary text-sm font-display font-bold">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden md:block">
                <p className="text-sm font-semibold text-foreground leading-none">{client.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{client.company}</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              <span className="hidden md:inline">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8">
        {/* Welcome section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <h1 className="text-3xl font-display font-bold text-foreground">
            Welcome back, <span className="text-gradient-gold">{client.name.split(' ')[0]}</span>
          </h1>
          <p className="text-muted-foreground mt-1">Here's an overview of your account with {settings.agencyName}.</p>
        </motion.div>

        {/* Stats cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Invoiced', value: formatCurrency(totalInvoiced), icon: DollarSign, color: 'text-primary' },
            { label: 'Paid', value: formatCurrency(totalPaid), icon: Shield, color: 'text-emerald-600' },
            { label: 'Pending Balance', value: formatCurrency(totalPending), icon: Clock, color: 'text-amber-600' },
            { label: 'Documents', value: `${clientInvoices.length + clientProformas.length}`, icon: FileText, color: 'text-blue-600' },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              variants={fadeIn}
              initial="hidden"
              animate="visible"
              custom={i}
              className="bg-card rounded-2xl border border-border p-5 shadow-card hover:shadow-elevated transition-all duration-300"
            >
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm text-muted-foreground">{stat.label}</span>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </div>
              <p className="text-2xl font-display font-bold text-foreground">{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="bg-muted/50 p-1 rounded-xl mb-6 h-auto flex-wrap">
            <TabsTrigger value="overview" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <User className="h-4 w-4 mr-1.5" /> Account Info
            </TabsTrigger>
            <TabsTrigger value="invoices" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <Receipt className="h-4 w-4 mr-1.5" /> Invoices ({clientInvoices.length})
            </TabsTrigger>
            <TabsTrigger value="proformas" className="rounded-lg text-sm px-4 py-2 data-[state=active]:bg-card data-[state=active]:shadow-sm">
              <FileText className="h-4 w-4 mr-1.5" /> Proformas ({clientProformas.length})
            </TabsTrigger>
          </TabsList>

          {/* Account Info Tab */}
          <TabsContent value="overview">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="bg-card rounded-2xl border border-border shadow-card p-6 md:p-8"
            >
              <h3 className="text-lg font-display font-semibold text-foreground mb-6 flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                Account Information
              </h3>
              <div className="grid md:grid-cols-2 gap-6">
                {[
                  { icon: User, label: 'Contact Name', value: client.name },
                  { icon: Building2, label: 'Company', value: client.company },
                  { icon: Mail, label: 'Email', value: client.email },
                  { icon: Phone, label: 'Phone', value: client.phone },
                  { icon: MapPin, label: 'Address', value: [client.address, client.city, client.country].filter(Boolean).join(', ') || 'Not provided' },
                  { icon: Globe, label: 'Website', value: client.website || 'Not provided' },
                ].map((item) => (
                  <div key={item.label} className="flex items-start gap-4 p-4 rounded-xl bg-muted/30 border border-border/50">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <item.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{item.label}</p>
                      <p className="text-sm font-medium text-foreground mt-0.5">{item.value}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Account status */}
              <div className="mt-6 p-4 rounded-xl bg-muted/30 border border-border/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${client.status === 'Active' ? 'bg-emerald-500' : client.status === 'Paused' ? 'bg-amber-500' : 'bg-red-500'}`} />
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">Account Status</p>
                    <p className="text-sm font-semibold text-foreground">{client.status}</p>
                  </div>
                </div>
                {client.industry && (
                  <Badge variant="secondary" className="text-xs">
                    {client.industry}
                  </Badge>
                )}
              </div>
            </motion.div>
          </TabsContent>

          {/* Invoices Tab */}
          <TabsContent value="invoices">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {clientInvoices.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border shadow-card p-12 text-center">
                  <Receipt className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Invoices Yet</h3>
                  <p className="text-muted-foreground text-sm">You don't have any invoices at the moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientInvoices.map((invoice, i) => (
                    <motion.div
                      key={invoice.id}
                      variants={fadeIn}
                      initial="hidden"
                      animate="visible"
                      custom={i}
                      onClick={() => setSelectedDocument({ type: 'Invoice', data: invoice })}
                      className="bg-card cursor-pointer rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden"
                    >
                      <div className="p-5 md:p-6">
                        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                              <Receipt className="h-6 w-6 text-primary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="text-base font-display font-semibold text-foreground">{invoice.id}</h4>
                                <StatusBadge status={invoice.status} />
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" /> {formatDate(invoice.date)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> Due: {formatDate(invoice.dueDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xl font-display font-bold text-foreground">{formatCurrency(invoice.amount)}</p>
                            </div>
                          </div>
                        </div>

                        {/* Items preview */}
                        {invoice.items && invoice.items.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="space-y-2">
                              {invoice.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{item.description}</span>
                                  <span className="font-medium text-foreground">
                                    {item.quantity} × {formatCurrency(item.unitPrice)}
                                  </span>
                                </div>
                              ))}
                            </div>
                            {invoice.taxRate ? (
                              <div className="flex items-center justify-between text-sm mt-2 pt-2 border-t border-dashed border-border/50">
                                <span className="text-muted-foreground">Tax ({invoice.taxRate}%)</span>
                                <span className="font-medium text-foreground">Included</span>
                              </div>
                            ) : null}
                          </div>
                        )}

                        {invoice.notes && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/70">Note: </span>
                            {invoice.notes}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>

          {/* Proformas Tab */}
          <TabsContent value="proformas">
            <motion.div
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
            >
              {clientProformas.length === 0 ? (
                <div className="bg-card rounded-2xl border border-border shadow-card p-12 text-center">
                  <FileText className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                  <h3 className="text-lg font-display font-semibold text-foreground mb-2">No Proformas</h3>
                  <p className="text-muted-foreground text-sm">You don't have any proforma invoices at the moment.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {clientProformas.map((proforma, i) => (
                    <motion.div
                      key={proforma.id}
                      variants={fadeIn}
                      initial="hidden"
                      animate="visible"
                      custom={i}
                      onClick={() => setSelectedDocument({ type: 'Proforma', data: proforma })}
                      className="bg-card cursor-pointer rounded-2xl border border-border shadow-card hover:shadow-elevated transition-all duration-300 overflow-hidden"
                    >
                      <div className="p-5 md:p-6">
                        <div className="flex items-start md:items-center justify-between flex-col md:flex-row gap-4">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-xl bg-secondary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-6 w-6 text-secondary" />
                            </div>
                            <div>
                              <div className="flex items-center gap-3">
                                <h4 className="text-base font-display font-semibold text-foreground">{proforma.id}</h4>
                                <StatusBadge status={proforma.status} />
                              </div>
                              <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Calendar className="h-3.5 w-3.5" /> {formatDate(proforma.date)}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="h-3.5 w-3.5" /> Due: {formatDate(proforma.dueDate)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xl font-display font-bold text-foreground">{formatCurrency(proforma.amount)}</p>
                          </div>
                        </div>

                        {/* Items preview */}
                        {proforma.items && proforma.items.length > 0 && (
                          <div className="mt-4 pt-4 border-t border-border/50">
                            <div className="space-y-2">
                              {proforma.items.map((item, idx) => (
                                <div key={idx} className="flex items-center justify-between text-sm">
                                  <span className="text-muted-foreground">{item.description}</span>
                                  <span className="font-medium text-foreground">
                                    {item.quantity} × {formatCurrency(item.unitPrice)}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {proforma.notes && (
                          <div className="mt-3 p-3 rounded-lg bg-muted/30 text-sm text-muted-foreground">
                            <span className="font-medium text-foreground/70">Note: </span>
                            {proforma.notes}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          </TabsContent>
        </Tabs>
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-12">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">© 2026 {settings.agencyName}. All rights reserved.</p>
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            {settings.phone && <span>{settings.phone}</span>}
            {settings.adminEmail && <span>{settings.adminEmail}</span>}
          </div>
        </div>
      </footer>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4 sm:p-6 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-background w-full max-w-5xl max-h-[90vh] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-border bg-card">
              <h3 className="text-lg font-display font-semibold text-foreground flex items-center gap-2">
                {selectedDocument.type === 'Invoice' ? <Receipt className="h-5 w-5 text-primary" /> : <FileText className="h-5 w-5 text-secondary" />}
                {selectedDocument.type} #{selectedDocument.data.id}
              </h3>
              <div className="flex items-center gap-2">
                <Button onClick={() => handlePrint()} variant="outline" size="sm" className="gap-2">
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setSelectedDocument(null)} className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Modal Body - Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-muted/20">
              <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none print:m-0" ref={printRef}>
                <PremiumInvoice
                  type={selectedDocument.type}
                  data={selectedDocument.data}
                  settings={settings}
                  showSignature={false}
                />
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

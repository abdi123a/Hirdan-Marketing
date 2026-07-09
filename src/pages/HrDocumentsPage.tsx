import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAgencyStore } from "@/lib/store";
import { useAuthStore } from "@/lib/auth-store";
import { 
  Card, CardContent, CardDescription, CardHeader, CardTitle 
} from "@/components/ui/card";
import { 
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { 
  Plus, FileText, Landmark, FileSpreadsheet, ShieldAlert,
  Download, RefreshCw, Eye, CheckCircle2, XCircle, Search, Mail, Loader2,
  GraduationCap, Award
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const getDocTypeLabel = (docType: string) => {
  if (docType === 'WORK_CERTIFICATE') return 'Work Certificate';
  if (docType === 'SALARY_CERTIFICATE') return 'Salary Certificate';
  if (docType === 'PAYSLIP') return 'Payslip';
  if (docType === 'WARNING_CERTIFICATE') return 'Warning Certificate';
  if (docType === 'INTERNSHIP_ACCEPTED_CERTIFICATE') return 'Internship Confirmation';
  if (docType === 'INTERNSHIP_LETTER') return 'Internship Completion Letter';
  return docType.replace('_', ' ');
};

export default function HrDocumentsPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    hrDocuments, fetchHrDocuments, approveHrDocument, rejectHrDocument, sendHrDocumentEmail, settings: rawSettings 
  } = useAgencyStore();
  const settings = rawSettings || { agencyName: "" };

  const [activeTab, setActiveTab] = useState<string>("documents");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(true);

  // Approval modal states
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [comment, setComment] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  // Email modal states
  const [emailDocId, setEmailDocId] = useState<string | null>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailCc, setEmailCc] = useState<string>("");
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchHrDocuments(activeTab === 'approvals');
    } catch (err) {}
    setLoading(false);
  };

  const handleApprove = async (id: string) => {
    setSelectedDocId(id);
    setIsApproveModalOpen(true);
  };

  const handleConfirmApprove = async () => {
    if (!selectedDocId) return;
    setActionLoading(true);
    try {
      await approveHrDocument(selectedDocId, comment);
      toast({
        title: "Success",
        description: "Warning certificate approved.",
      });
      setIsApproveModalOpen(false);
      setComment("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Approval Failed",
        description: err.message || "Could not approve the document.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (id: string) => {
    setSelectedDocId(id);
    setIsRejectModalOpen(true);
  };

  const handleConfirmReject = async () => {
    if (!selectedDocId) return;
    if (!comment || comment.trim().length === 0) {
      toast({
        title: "Comment Required",
        description: "You must provide a reason for rejecting the warning certificate.",
        variant: "destructive",
      });
      return;
    }
    setActionLoading(true);
    try {
      await rejectHrDocument(selectedDocId, comment);
      toast({
        title: "Success",
        description: "Warning certificate rejected.",
      });
      setIsRejectModalOpen(false);
      setComment("");
      loadData();
    } catch (err: any) {
      toast({
        title: "Rejection Failed",
        description: err.message || "Could not reject the document.",
        variant: "destructive",
      });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenEmailModal = (doc: any) => {
    setEmailDocId(doc.id);
    setEmailTo(doc.employee?.email || "");
    setEmailCc("");
    setEmailSubject(`${getDocTypeLabel(doc.docType)}: ${doc.docNumber}`);
    setEmailBody(
      `Hi ${doc.employee?.name || 'there'},\n\n` +
      `Please find attached your official ${getDocTypeLabel(doc.docType).toLowerCase()} (${doc.docNumber}) issued on ${formatDate(doc.generatedAt)}.\n\n` +
      `Best regards,\nHR Department\n${settings.agencyName}`
    );
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailDocId) return;
    setIsSendingEmail(true);
    try {
      await sendHrDocumentEmail(emailDocId, {
        to: emailTo,
        cc: emailCc || undefined,
        subject: emailSubject,
        body: emailBody,
      });
      toast({
        title: "Success",
        description: "HR document emailed to employee.",
      });
      setIsEmailModalOpen(false);
    } catch (err: any) {
      toast({
        title: "Email Failed",
        description: err.message || "Could not send email.",
        variant: "destructive",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const filteredDocs = hrDocuments.filter((doc) => {
    const query = searchQuery.toLowerCase();
    return (
      doc.docNumber.toLowerCase().includes(query) ||
      doc.employee.name.toLowerCase().includes(query) ||
      doc.docType.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight bg-gradient-to-r from-primary to-violet-500 bg-clip-text text-transparent">
            HR Document Hub
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Auto-generate and manage formal, A4-formatted employee certificates and warning notices.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="documents" className="rounded-lg text-xs font-semibold px-4 py-1.5">
              Documents Library
            </TabsTrigger>
            {user?.role !== "staff" && (
              <TabsTrigger value="approvals" className="rounded-lg text-xs font-semibold px-4 py-1.5 flex items-center gap-1.5">
                Approvals Queue
                {hrDocuments.filter(d => d.status === 'PENDING_APPROVAL').length > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 rounded-full text-[9px] flex items-center justify-center font-bold">
                    {hrDocuments.filter(d => d.status === 'PENDING_APPROVAL').length}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <div className="relative w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl border-border bg-card"
            />
          </div>
        </div>

        {/* Tab 1: Documents list and Card Grid */}
        <TabsContent value="documents" className="space-y-8 mt-0 outline-none">
          {/* Card Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Work Certificate */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-primary/10 rounded-xl flex items-center justify-center text-primary mb-3">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Work Certificate</CardTitle>
                <CardDescription className="text-xs">
                  Certificate of employment confirming hire date, role, and active/ended contract status.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=WORK_CERTIFICATE")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>

            {/* Salary Certificate */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-amber-500/10 rounded-xl flex items-center justify-center text-amber-500 mb-3">
                  <Landmark className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Salary Certificate</CardTitle>
                <CardDescription className="text-xs">
                  Formal compensation verification listing basic salary, all allowances, and gross total.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=SALARY_CERTIFICATE")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>

            {/* Last 3 Months Payslip */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 mb-3">
                  <FileSpreadsheet className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Last 3 Months Payslip</CardTitle>
                <CardDescription className="text-xs">
                  Print-friendly historical payslips for the employee's last three completed payroll cycles.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=PAYSLIP")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>

            {/* Warning Certificate */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-rose-500/10 rounded-xl flex items-center justify-center text-rose-500 mb-3">
                  <ShieldAlert className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Warning Certificate</CardTitle>
                <CardDescription className="text-xs">
                  Formal disciplinary notice. Requires manager sign-off before it can be finalized and delivered.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=WARNING_CERTIFICATE")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>

            {/* Internship Accepted Certificate */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-indigo-500/10 rounded-xl flex items-center justify-center text-indigo-500 mb-3">
                  <GraduationCap className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Internship Confirmation</CardTitle>
                <CardDescription className="text-xs">
                  Official confirmation of internship acceptance detailing duration, schedule, and learning objectives.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=INTERNSHIP_ACCEPTED_CERTIFICATE")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>

            {/* Internship Completion Letter */}
            <Card className="border-border/50 shadow-sm hover:shadow-md transition duration-200 flex flex-col justify-between">
              <CardHeader className="pb-3">
                <div className="h-10 w-10 bg-purple-500/10 rounded-xl flex items-center justify-center text-purple-500 mb-3">
                  <Award className="h-5 w-5" />
                </div>
                <CardTitle className="text-base font-bold">Internship Letter (Completion)</CardTitle>
                <CardDescription className="text-xs">
                  Official internship completion letter certifying achievements, performance, and projects.
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <Button 
                  onClick={() => navigate("/dashboard/hr/generate?type=INTERNSHIP_LETTER")}
                  className="w-full h-9 text-xs rounded-lg font-semibold"
                  variant="hero"
                >
                  <Plus className="h-3.5 w-3.5 mr-1" /> Generate
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Recent Documents Table */}
          <Card className="border-border/50 shadow-sm overflow-hidden bg-card">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-lg font-bold">Recent HR Documents</CardTitle>
              <CardDescription className="text-xs">History of all generated certificates, warnings, and payslips.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading documents...
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground italic">No generated documents found.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Doc Number</TableHead>
                      <TableHead className="font-bold text-xs">Employee</TableHead>
                      <TableHead className="font-bold text-xs">Type</TableHead>
                      <TableHead className="font-bold text-xs">Version</TableHead>
                      <TableHead className="font-bold text-xs">Date Generated</TableHead>
                      <TableHead className="font-bold text-xs">Status</TableHead>
                      <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => {
                      const isDownloadable = doc.status === 'APPROVED' || doc.status === 'FINAL';
                      
                      return (
                        <TableRow key={doc.id} className="hover:bg-muted/5">
                          <TableCell className="font-mono text-xs font-bold text-primary">{doc.docNumber}</TableCell>
                          <TableCell>
                            <div>
                              <p className="font-semibold text-sm text-foreground/80">{doc.employee?.name}</p>
                              <span className="text-[10px] text-muted-foreground">{doc.employee?.department || 'Staff'}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-medium text-muted-foreground">
                            {getDocTypeLabel(doc.docType)}
                          </TableCell>
                          <TableCell className="text-xs font-mono">v{doc.version}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(doc.generatedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge 
                              variant="outline" 
                              className={`text-[9px] font-black uppercase tracking-wider border-0 px-2.5 py-0.5 rounded-full ${
                                doc.status === 'APPROVED' || doc.status === 'FINAL' 
                                  ? 'bg-emerald-500/10 text-emerald-600'
                                  : doc.status === 'PENDING_APPROVAL'
                                    ? 'bg-amber-500/10 text-amber-600'
                                    : doc.status === 'REJECTED'
                                      ? 'bg-red-500/10 text-red-600'
                                      : 'bg-muted/40 text-muted-foreground'
                              }`}
                            >
                              {doc.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Re-edit / new version */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
                                title="Edit / Generate New Version"
                                onClick={() => navigate(`/dashboard/hr/generate?editId=${doc.id}`)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>

                              {/* Download PDF */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-emerald-500/10 text-emerald-600 disabled:opacity-30"
                                title="Download PDF"
                                disabled={!isDownloadable || !doc.pdfUrl}
                                onClick={() => doc.pdfUrl && window.open(`${import.meta.env.VITE_API_URL || ''}${doc.pdfUrl}`, '_blank')}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>

                              {/* Email directly to employee */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-violet-500/10 text-violet-600 disabled:opacity-30"
                                title="Email PDF to Employee"
                                disabled={!isDownloadable || !doc.pdfUrl}
                                onClick={() => handleOpenEmailModal(doc)}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>

                              {/* View Details */}
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg hover:bg-primary/5 hover:text-primary"
                                title="View Details"
                                onClick={() => navigate(`/dashboard/hr/generate?viewId=${doc.id}`)}
                              >
                                <Eye className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2: Approvals Queue */}
        <TabsContent value="approvals" className="mt-0 outline-none">
          <Card className="border-border/50 shadow-sm overflow-hidden bg-card">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-lg font-bold flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-amber-500" /> Pending Approvals Queue
              </CardTitle>
              <CardDescription className="text-xs">Warnings certificates awaiting manager review and sign-off.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" /> Loading queue...
                </div>
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-xs text-muted-foreground italic">No warning certificates pending approval.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-bold text-xs">Doc Number</TableHead>
                      <TableHead className="font-bold text-xs">Employee</TableHead>
                      <TableHead className="font-bold text-xs">Generated By</TableHead>
                      <TableHead className="font-bold text-xs">Date Generated</TableHead>
                      <TableHead className="text-right font-bold text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-muted/5">
                        <TableCell className="font-mono text-xs font-bold text-primary">{doc.docNumber}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-semibold text-sm text-foreground/80">{doc.employee?.name}</p>
                            <span className="text-[10px] text-muted-foreground">{doc.employee?.department || 'Staff'}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs font-semibold text-muted-foreground">
                          {doc.generatedBy?.name || 'HR'}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(doc.generatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            {/* Review preview */}
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs font-semibold rounded-lg"
                              onClick={() => navigate(`/dashboard/hr/generate?viewId=${doc.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Review Draft
                            </Button>

                            {/* Approve */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 rounded-lg"
                              title="Approve & Sign"
                              onClick={() => { setSelectedDocId(doc.id); setIsApproveModalOpen(true); }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>

                            {/* Reject */}
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-500/10 rounded-lg"
                              title="Reject warning"
                              onClick={() => { setSelectedDocId(doc.id); setIsRejectModalOpen(true); }}
                            >
                              <XCircle className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Approve Modal */}
      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Approve Warning Certificate</DialogTitle>
            <DialogDescription>
              Confirming this document will apply the company signature & stamp, setting its status to APPROVED. The PDF will be saved to the employee profile.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label htmlFor="approve-comment" className="text-xs font-bold uppercase tracking-wider">Comment (Optional)</Label>
            <Textarea
              id="approve-comment"
              placeholder="e.g. Approved after counseling session."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsApproveModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleApprove} variant="hero" disabled={actionLoading} className="gap-1">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />} Approve & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Modal */}
      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject Warning Certificate</DialogTitle>
            <DialogDescription>
              Provide feedback explaining why this warning certificate is being rejected. This comment is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label htmlFor="reject-comment" className="text-xs font-bold uppercase tracking-wider text-red-500">Rejection Reason (Required)</Label>
            <Textarea
              id="reject-comment"
              placeholder="e.g. Please correct the incident date; it happened on Tuesday, not Wednesday."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleReject} variant="destructive" disabled={actionLoading} className="gap-1">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />} Reject Draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Modal */}
      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle>Send Document via Email</DialogTitle>
            <DialogDescription>
              Deliver the approved HR document directly to the employee. The PDF will be attached automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="email-to">Employee Email</Label>
              <Input
                id="email-to"
                placeholder="employee@company.com"
                value={emailTo}
                onChange={(e) => setEmailTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-cc">CC (comma-separated)</Label>
              <Input
                id="email-cc"
                placeholder="hr@company.com, management@company.com"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-subject">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-body">Message</Label>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="min-h-[140px] text-xs leading-relaxed"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSendingEmail}>Cancel</Button>
            <Button onClick={handleSendEmail} variant="hero" disabled={isSendingEmail} className="gap-1">
              {isSendingEmail && <Loader2 className="h-3 w-3 animate-spin" />} Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}

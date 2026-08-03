import { useState, useEffect, useRef, KeyboardEvent } from "react";
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
  GraduationCap, Award, Send, RotateCcw, X, AtSign, Users, Paperclip, ChevronRight
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { InlineTableSkeleton } from "@/components/ui/PageSkeleton";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const DOC_TYPES = [
  {
    type: "WORK_CERTIFICATE",
    label: "Work Certificate",
    description: "Employment confirmation with role, department, and hire date",
    icon: FileText,
    tone: "text-primary bg-primary/10",
  },
  {
    type: "SALARY_CERTIFICATE",
    label: "Salary Certificate",
    description: "Compensation verification with salary breakdown",
    icon: Landmark,
    tone: "text-amber-600 bg-amber-500/10",
  },
  {
    type: "PAYSLIP",
    label: "Payslip",
    description: "Last three months of payroll statements",
    icon: FileSpreadsheet,
    tone: "text-emerald-600 bg-emerald-500/10",
  },
  {
    type: "WARNING_CERTIFICATE",
    label: "Warning Notice",
    description: "Disciplinary letter — requires manager approval",
    icon: ShieldAlert,
    tone: "text-rose-600 bg-rose-500/10",
  },
  {
    type: "INTERNSHIP_ACCEPTED_CERTIFICATE",
    label: "Internship Confirmation",
    description: "Acceptance letter with schedule and responsibilities",
    icon: GraduationCap,
    tone: "text-sky-600 bg-sky-500/10",
  },
  {
    type: "INTERNSHIP_LETTER",
    label: "Internship Completion",
    description: "Completion letter certifying internship achievements",
    icon: Award,
    tone: "text-violet-600 bg-violet-500/10",
  },
] as const;

const getDocTypeLabel = (docType: string) =>
  DOC_TYPES.find((d) => d.type === docType)?.label || docType.replace(/_/g, " ");

function CcTagInput({ tags, onAdd, onRemove }: { tags: string[]; onAdd: (v: string) => void; onRemove: (v: string) => void }) {
  const [inputVal, setInputVal] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    const trimmed = inputVal.trim().toLowerCase();
    if (trimmed && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed) && !tags.includes(trimmed)) {
      onAdd(trimmed);
    }
    setInputVal("");
  };

  const handleKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === " ") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !inputVal && tags.length > 0) {
      onRemove(tags[tags.length - 1]);
    }
  };

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[40px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm cursor-text focus-within:ring-2 focus-within:ring-ring/50 focus-within:border-primary transition-all"
      onClick={() => inputRef.current?.focus()}
    >
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 bg-primary/10 text-primary rounded-full px-2.5 py-0.5 text-[11px] font-semibold leading-none"
        >
          {tag}
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(tag); }} className="hover:text-destructive transition-colors ml-0.5">
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        ref={inputRef}
        type="email"
        value={inputVal}
        onChange={(e) => setInputVal(e.target.value)}
        onKeyDown={handleKey}
        onBlur={commit}
        placeholder={tags.length === 0 ? "Add CC recipients…" : ""}
        className="flex-1 min-w-[160px] bg-transparent outline-none text-xs placeholder:text-muted-foreground"
      />
    </div>
  );
}

function statusBadgeClass(status: string) {
  if (status === "APPROVED" || status === "FINAL") return "bg-emerald-500/10 text-emerald-600";
  if (status === "PENDING_APPROVAL") return "bg-amber-500/10 text-amber-600";
  if (status === "REJECTED") return "bg-red-500/10 text-red-600";
  return "bg-muted/40 text-muted-foreground";
}

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

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [isApproveModalOpen, setIsApproveModalOpen] = useState<boolean>(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState<boolean>(false);
  const [comment, setComment] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<boolean>(false);

  const [emailDocId, setEmailDocId] = useState<string | null>(null);
  const [emailDocRef, setEmailDocRef] = useState<any>(null);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState<boolean>(false);
  const [emailTo, setEmailTo] = useState<string>("");
  const [emailToError, setEmailToError] = useState<string>("");
  const [ccTags, setCcTags] = useState<string[]>([]);
  const [emailSubject, setEmailSubject] = useState<string>("");
  const [emailBody, setEmailBody] = useState<string>("");
  const [isSendingEmail, setIsSendingEmail] = useState<boolean>(false);

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      await fetchHrDocuments({ pendingApproval: activeTab === "approvals" });
    } catch (err) { }
    setLoading(false);
  };

  const handleConfirmApprove = async () => {
    if (!selectedDocId) return;
    setActionLoading(true);
    try {
      await approveHrDocument(selectedDocId, comment);
      toast({ title: "Approved", description: "Warning certificate approved." });
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

  const handleConfirmReject = async () => {
    if (!selectedDocId) return;
    if (!comment.trim()) {
      toast({
        title: "Comment Required",
        description: "Provide a reason for rejecting this warning.",
        variant: "destructive",
      });
      return;
    }
    setActionLoading(true);
    try {
      await rejectHrDocument(selectedDocId, comment);
      toast({ title: "Rejected", description: "Warning certificate rejected." });
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

  const buildDefaultBody = (doc: any) =>
    `Hi ${doc.employee?.name || "there"},\n\n` +
    `Please find attached your official ${getDocTypeLabel(doc.docType).toLowerCase()} (${doc.docNumber}) issued on ${formatDate(doc.generatedAt)}.\n\n` +
    `If you have any questions, please contact the HR department.\n\n` +
    `Best regards,\nHR Department\n${settings.agencyName}`;

  const handleOpenEmailModal = (doc: any) => {
    setEmailDocId(doc.id);
    setEmailDocRef(doc);
    setEmailTo(doc.employee?.email || "");
    setEmailToError("");
    setCcTags([]);
    setEmailSubject(`${getDocTypeLabel(doc.docType)} – ${doc.docNumber}`);
    setEmailBody(buildDefaultBody(doc));
    setIsEmailModalOpen(true);
  };

  const handleSendEmail = async () => {
    if (!emailDocId) return;
    const emailRegex = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
    if (!emailTo.trim() || !emailRegex.test(emailTo.trim())) {
      setEmailToError("Please enter a valid email address.");
      return;
    }
    setEmailToError("");
    setIsSendingEmail(true);
    try {
      await sendHrDocumentEmail(emailDocId, {
        to: emailTo.trim(),
        cc: ccTags.length > 0 ? ccTags.join(",") : undefined,
        subject: emailSubject,
        body: emailBody,
      });
      toast({
        title: "Email Sent",
        description: `Document delivered to ${emailTo.trim()}.`,
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

  const pendingCount = hrDocuments.filter((d) => d.status === "PENDING_APPROVAL").length;

  const filteredDocs = hrDocuments.filter((doc) => {
    const query = searchQuery.toLowerCase();
    return (
      doc.docNumber.toLowerCase().includes(query) ||
      doc.employee.name.toLowerCase().includes(query) ||
      doc.docType.toLowerCase().includes(query) ||
      getDocTypeLabel(doc.docType).toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6 p-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground tracking-tight">HR Documents</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Generate certificates, payslips, and notices — then download or email them.
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-muted/60 p-1 rounded-xl">
            <TabsTrigger value="documents" className="rounded-lg text-xs font-semibold px-4 py-1.5">
              Library
            </TabsTrigger>
            {user?.role !== "staff" && (
              <TabsTrigger value="approvals" className="rounded-lg text-xs font-semibold px-4 py-1.5 flex items-center gap-1.5">
                Approvals
                {pendingCount > 0 && (
                  <Badge variant="destructive" className="h-4 min-w-4 px-1 rounded-full text-[9px] font-bold">
                    {pendingCount}
                  </Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search by name or ref…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs rounded-xl"
            />
          </div>
        </div>

        <TabsContent value="documents" className="space-y-6 mt-0 outline-none">
          {/* Compact type picker */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-base font-bold">Create a document</CardTitle>
              <CardDescription className="text-xs">
                Choose a type to start — pick the employee and edit every field on the next screen.
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 divide-y sm:divide-y-0 sm:divide-x divide-border/40">
                {DOC_TYPES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => navigate(`/dashboard/hr/generate?type=${item.type}`)}
                      className="group flex items-start gap-3 p-4 text-left hover:bg-muted/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
                    >
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", item.tone)}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-foreground">{item.label}</span>
                          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                          {item.description}
                        </p>
                      </div>
                      <Plus className="h-3.5 w-3.5 text-muted-foreground/50 mt-1 shrink-0 group-hover:text-primary transition-colors" />
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Recent documents */}
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold">Recent documents</CardTitle>
              <CardDescription className="text-xs">Edit, download, email, or review any generated document.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <InlineTableSkeleton rows={5} />
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  No documents yet. Create one above to get started.
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-semibold text-xs">Reference</TableHead>
                      <TableHead className="font-semibold text-xs">Employee</TableHead>
                      <TableHead className="font-semibold text-xs">Type</TableHead>
                      <TableHead className="font-semibold text-xs">Issued</TableHead>
                      <TableHead className="font-semibold text-xs">Status</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => {
                      const isDownloadable = doc.status === "APPROVED" || doc.status === "FINAL";
                      return (
                        <TableRow key={doc.id} className="hover:bg-muted/5">
                          <TableCell>
                            <div className="font-mono text-xs font-semibold text-primary">{doc.docNumber}</div>
                            <div className="text-[10px] text-muted-foreground">v{doc.version}</div>
                          </TableCell>
                          <TableCell>
                            <p className="font-medium text-sm">{doc.employee?.name}</p>
                            <span className="text-[10px] text-muted-foreground">{doc.employee?.department || "Staff"}</span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {getDocTypeLabel(doc.docType)}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {formatDate(doc.generatedAt)}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[9px] font-bold uppercase tracking-wider border-0 px-2.5 py-0.5 rounded-full",
                                statusBadgeClass(doc.status)
                              )}
                            >
                              {doc.status.replace(/_/g, " ")}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-0.5">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                title="Edit / new version"
                                onClick={() => navigate(`/dashboard/hr/generate?editId=${doc.id}`)}
                              >
                                <RefreshCw className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-emerald-600 disabled:opacity-30"
                                title="Download PDF"
                                disabled={!isDownloadable || !doc.pdfUrl}
                                onClick={() => doc.pdfUrl && window.open(`${import.meta.env.VITE_API_URL || ""}${doc.pdfUrl}`, "_blank")}
                              >
                                <Download className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg text-primary disabled:opacity-30"
                                title="Email PDF"
                                disabled={!isDownloadable || !doc.pdfUrl}
                                onClick={() => handleOpenEmailModal(doc)}
                              >
                                <Mail className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 rounded-lg"
                                title="View"
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

        <TabsContent value="approvals" className="mt-0 outline-none">
          <Card className="border-border/50 shadow-sm overflow-hidden">
            <CardHeader className="border-b border-border/40 pb-4">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-amber-500" /> Pending approvals
              </CardTitle>
              <CardDescription className="text-xs">Warning notices awaiting manager review.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {loading ? (
                <InlineTableSkeleton rows={3} />
              ) : filteredDocs.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">Nothing pending approval.</div>
              ) : (
                <Table>
                  <TableHeader className="bg-muted/10">
                    <TableRow>
                      <TableHead className="font-semibold text-xs">Reference</TableHead>
                      <TableHead className="font-semibold text-xs">Employee</TableHead>
                      <TableHead className="font-semibold text-xs">Generated by</TableHead>
                      <TableHead className="font-semibold text-xs">Date</TableHead>
                      <TableHead className="text-right font-semibold text-xs">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredDocs.map((doc) => (
                      <TableRow key={doc.id} className="hover:bg-muted/5">
                        <TableCell className="font-mono text-xs font-semibold text-primary">{doc.docNumber}</TableCell>
                        <TableCell>
                          <p className="font-medium text-sm">{doc.employee?.name}</p>
                          <span className="text-[10px] text-muted-foreground">{doc.employee?.department || "Staff"}</span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {doc.generatedBy?.name || "HR"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {formatDate(doc.generatedAt)}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 text-xs rounded-lg"
                              onClick={() => navigate(`/dashboard/hr/generate?viewId=${doc.id}`)}
                            >
                              <Eye className="h-3.5 w-3.5 mr-1" /> Review
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-emerald-600 hover:bg-emerald-500/10 rounded-lg"
                              title="Approve"
                              onClick={() => { setSelectedDocId(doc.id); setIsApproveModalOpen(true); }}
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-red-600 hover:bg-red-500/10 rounded-lg"
                              title="Reject"
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

      <Dialog open={isApproveModalOpen} onOpenChange={setIsApproveModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Approve warning</DialogTitle>
            <DialogDescription>
              This applies the company signature and stamp and marks the document as approved.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label htmlFor="approve-comment" className="text-xs font-semibold">Comment (optional)</Label>
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
            <Button onClick={handleConfirmApprove} variant="hero" disabled={actionLoading} className="gap-1">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />} Approve & Sign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isRejectModalOpen} onOpenChange={setIsRejectModalOpen}>
        <DialogContent className="sm:max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Reject warning</DialogTitle>
            <DialogDescription>
              Explain why this warning is being rejected. A comment is required.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-3">
            <Label htmlFor="reject-comment" className="text-xs font-semibold text-red-500">Rejection reason</Label>
            <Textarea
              id="reject-comment"
              placeholder="e.g. Please correct the incident date."
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRejectModalOpen(false)} disabled={actionLoading}>Cancel</Button>
            <Button onClick={handleConfirmReject} variant="destructive" disabled={actionLoading} className="gap-1">
              {actionLoading && <Loader2 className="h-3 w-3 animate-spin" />} Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isEmailModalOpen} onOpenChange={setIsEmailModalOpen}>
        <DialogContent className="sm:max-w-[540px] p-0 overflow-hidden gap-0">
          <div className="bg-primary px-6 pt-6 pb-5 text-primary-foreground">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-9 w-9 rounded-xl bg-white/15 flex items-center justify-center">
                <Send className="h-4 w-4" />
              </div>
              <div>
                <DialogTitle className="text-primary-foreground text-base font-bold m-0 p-0">Send via email</DialogTitle>
                <p className="text-primary-foreground/70 text-[11px] mt-0.5">PDF will be attached automatically</p>
              </div>
            </div>
            {emailDocRef && (
              <div className="mt-3 flex items-center gap-2 bg-white/10 rounded-lg px-3 py-2">
                <Paperclip className="h-3.5 w-3.5 opacity-80 shrink-0" />
                <span className="text-[11px] font-mono font-semibold">{emailDocRef.docNumber}.pdf</span>
              </div>
            )}
          </div>

          <div className="p-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email-to" className="text-xs font-semibold flex items-center gap-1.5">
                <AtSign className="h-3 w-3" /> To
              </Label>
              <Input
                id="email-to"
                type="email"
                placeholder="employee@company.com"
                value={emailTo}
                onChange={(e) => { setEmailTo(e.target.value); setEmailToError(""); }}
                className={`h-10 rounded-xl text-sm ${emailToError ? "border-destructive" : ""}`}
              />
              {emailToError && <p className="text-[11px] text-destructive">{emailToError}</p>}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3 w-3" /> CC
              </Label>
              <CcTagInput
                tags={ccTags}
                onAdd={(v) => setCcTags((prev) => [...prev, v])}
                onRemove={(v) => setCcTags((prev) => prev.filter((t) => t !== v))}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email-subject" className="text-xs font-semibold">Subject</Label>
              <Input
                id="email-subject"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="h-10 rounded-xl text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email-body" className="text-xs font-semibold">Message</Label>
                <button
                  type="button"
                  onClick={() => emailDocRef && setEmailBody(buildDefaultBody(emailDocRef))}
                  className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                >
                  <RotateCcw className="h-3 w-3" /> Reset
                </button>
              </div>
              <Textarea
                id="email-body"
                value={emailBody}
                onChange={(e) => setEmailBody(e.target.value)}
                className="min-h-[150px] text-xs leading-relaxed rounded-xl resize-none"
              />
            </div>
          </div>

          <DialogFooter className="px-6 pb-5 pt-0 gap-2">
            <Button variant="outline" onClick={() => setIsEmailModalOpen(false)} disabled={isSendingEmail} className="rounded-xl">
              Cancel
            </Button>
            <Button onClick={handleSendEmail} variant="hero" disabled={isSendingEmail} className="gap-2 rounded-xl min-w-[120px]">
              {isSendingEmail ? (
                <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
              ) : (
                <><Send className="h-3.5 w-3.5" /> Send</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
